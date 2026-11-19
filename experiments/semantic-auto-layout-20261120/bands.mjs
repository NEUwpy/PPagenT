import { minimumGroupWidth, renderGrayPage } from "../gray-compiler-20261120/render.mjs";
import { collectFields } from "../gray-compiler-20261120/validate.mjs";

function rowPartitions(groups, maxPerRow = 4) {
  if (groups.length === 0) return [[]];
  const partitions = [];
  for (let count = 1; count <= Math.min(maxPerRow, groups.length); count += 1) {
    for (const tail of rowPartitions(groups.slice(count), maxPerRow)) {
      partitions.push([groups.slice(0, count), ...tail]);
    }
  }
  return partitions;
}

function allocate(total, minima, weights) {
  const widths = [...minima];
  const locked = new Set();
  while (locked.size < widths.length) {
    const leftover = total - widths.reduce((sum, width, index) => sum + (locked.has(index) ? width : 0), 0);
    const openWeights = weights.reduce((sum, weight, index) => sum + (locked.has(index) ? 0 : weight), 0);
    const pin = minima.findIndex((min, index) => !locked.has(index) && leftover * weights[index] / openWeights < min);
    if (pin >= 0) {
      locked.add(pin);
      continue;
    }
    for (const [index, weight] of weights.entries()) {
      if (!locked.has(index)) widths[index] = Math.floor(leftover * weight / openWeights);
    }
    break;
  }
  widths[widths.length - 1] += total - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}

function groupDemand(group) {
  const demand = collectFields(group).reduce((sum, { field }) => sum + [...field.text].length, 0);
  return Math.sqrt(demand + 28 * group.items.length);
}

function localColumns(group, width, rowLength, flow, rules) {
  if (!flow || group.items.some(({ component }) => component)
    || !["independent", "parallel"].includes(group.relation)) return 1;
  const localCount = group.items.length - rules.length;
  const perColumn = rowLength === 1 ? 300 : 325;
  return Math.max(1, Math.min(localCount, 3, Math.floor(width / perColumn)));
}

export function bandCandidates(expression, canvas) {
  const groups = expression.plan.page.groups;
  if (groups.length > 6) return [];
  const margin = Math.max(22, Math.min(54, Math.round(canvas.width * 0.042)));
  const width = canvas.width - margin * 2;
  const gap = Math.max(14, Math.min(28, Math.round(canvas.width * 0.022)));
  const partitions = rowPartitions(groups);
  const candidates = [];
  const seen = new Set();
  for (const [density, padding] of [["standard", 12], ["compact", 10]]) {
    for (const partition of partitions) {
      for (const widths of ["balanced", "content-weighted"]) {
        const rows = [];
        for (const row of partition) {
          const budget = width - (row.length - 1) * gap;
          const minima = row.map((group) => minimumGroupWidth(group, padding));
          if (minima.reduce((sum, value) => sum + value, 0) > budget) break;
          const weights = row.map((group) => widths === "balanced" ? 1 : groupDemand(group));
          const columns = allocate(budget, minima, weights);
          rows.push(row.map((group, index) => ({ group, width: columns[index] })));
        }
        if (rows.length !== partition.length) continue;
        for (const flow of [true, false]) {
          const candidateRows = rows.map((row) => row.map(({ group, width }) => ({
            id: group.id, width,
            itemsAcross: localColumns(group, width - 2 * (padding + 1), row.length, flow,
              expression.crossCase.filter(({ groupId }) => groupId === group.id)),
          })));
          const key = JSON.stringify([density, candidateRows]);
          if (seen.has(key)) continue;
          seen.add(key);
          const shape = candidateRows.map((row) => row.length).join("+");
          const hasLocalFlow = candidateRows.flat().some(({ itemsAcross }) => itemsAcross > 1);
          candidates.push({ id: density + "-" + shape + "-" + widths + (hasLocalFlow ? "-flow" : "-stack"),
            canvas, density, margin, gap, padding, rows: candidateRows,
            direction: "column", columns: candidateRows.flat().map(({ width }) => width) });
        }
      }
    }
  }
  return candidates;
}

export function renderBand(expression, layout) {
  let html = renderGrayPage(expression.plan, layout);
  const coordinates = layout.rows.map((row) => {
    let x = 0;
    return row.map((cell) => {
      const left = x;
      const right = left + cell.width;
      x = right + layout.gap;
      return { ...cell, left, right };
    });
  });
  const edges = [...new Set(coordinates.flat().flatMap(({ left, right }) => [left, right]))].sort((a, b) => a - b);
  const lineNumber = new Map(edges.map((edge, index) => [edge, index + 1]));
  const tracks = edges.slice(1).map((edge, index) => (edge - edges[index]) + "px").join(" ");
  const css = [
    `.groups { grid-template-columns: ${tracks}; column-gap: 0; align-items: start }`,
    ".group[data-relation][data-indexed] .group-items > [data-case-wide] { grid-column: 1 / -1; background:#eaeaea; border-top:2px solid #777; padding:7px 10px }",
  ];
  for (const [row, cells] of coordinates.entries()) {
    for (const { id, left, right, itemsAcross } of cells) {
      const selector = `[data-node="group:${id}"]`;
      css.push(`${selector} { grid-row:${row + 1}; grid-column:${lineNumber.get(left)} / ${lineNumber.get(right)} }`);
      if (itemsAcross > 1) {
        css.push(`${selector} .group-items { display:grid; grid-template-columns:repeat(${itemsAcross}, minmax(0,1fr)); align-items:start }`,
          `${selector} .group-items > [data-item]:not([data-case-wide]) { border-top:1px solid var(--rule); padding:7px 8px }`);
      }
    }
  }
  for (const { id, appliesTo } of expression.crossCase) {
    html = html.replace(`data-node="item:${id}"`, `data-node="item:${id}" data-case-wide data-applies-to="${appliesTo.join(" ")}"`);
  }
  return html.replace("</head>", `<style>${css.join("\n")}</style></head>`);
}

export function evaluateBand(layout, measured) {
  const weakEnds = measured.texts.filter(({ lines }) => lines.length > 1 && [...lines.at(-1).text.trim()].length <= 3).length;
  const extraLineBreaks = measured.texts.filter(({ role }) => role === "body" || role === "item-title")
    .reduce((sum, { text, lines, role }) => {
      const target = role === "body" ? Math.max(1, Math.ceil([...text].length / 30)) : 1;
      return sum + Math.max(0, lines.length - target);
    }, 0);
  const groups = new Map(measured.groups.map((group) => [group.id, group]));
  const imbalance = layout.rows.reduce((sum, row) => {
    const heights = row.map(({ id }) => groups.get("group:" + id).bounds.height);
    return sum + (Math.max(...heights) - Math.min(...heights));
  }, 0);
  const bottom = Math.max(...measured.groups.map(({ bounds }) => bounds.y + bounds.height));
  const occupancy = (bottom - measured.frame.y) / measured.frame.height;
  const majorRows = layout.rows.length;
  const densityPenalty = layout.density === "compact" ? 7 : 0;
  const cost = extraLineBreaks * 8 + weakEnds * 9 + imbalance / 26 + (majorRows - 1) * 4
    + Math.abs(0.78 - occupancy) * 14 + densityPenalty;
  return { cost, weakEnds, extraLineBreaks, imbalance, occupancy, majorRows, densityPenalty };
}
