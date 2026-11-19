import { layoutNextLineRange, layoutWithLines, materializeLineRange, prepareWithSegments, setLocale } from "/pretext/layout.js";
import { materializeRichInlineLineRange, prepareRichInline, walkRichInlineLineRanges } from "/pretext/rich-inline.js";

const family = '"Microsoft YaHei"';
const widths = [198, 236, 278, 317, 386, 467, 519];
const bodyFont = (size) => `400 ${size}px ${family}`;
const titleFont = (size) => `700 ${size}px ${family}`;
const seedCursor = { segmentIndex: 0, graphemeIndex: 0 };
const top = 158;
const escape = (value) => value.replace(/[&<>"']/gu, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function columns(items, count) {
  if (count === 1) return [[items]];
  return items.slice(0, items.length - count + 1).flatMap((_, index) =>
    columns(items.slice(index + 1), count - 1).map((tail) => [items.slice(0, index + 1), ...tail]));
}

function widthsFor(count, total, gaps) {
  const width = total - gaps * (count - 1);
  if (count === 1) return [[Math.min(width, 850)]];
  if (count === 3) return [[width / 3, width / 3, width / 3]];
  return [0.43, 0.46, 0.50, 0.54, 0.57].map((share) => {
    const first = Math.round(width * share);
    return [first, width - first];
  });
}

function dataFor(size, groups) {
  return new Map(groups.flatMap((group) => group.items).map((item) =>
    [item.id, {
      heading: prepareWithSegments(item.heading, titleFont(size + 2)),
      body: prepareWithSegments(item.text, bodyFont(size)),
      inline: item.heading ? prepareRichInline([
        { text: item.heading + "。 ", font: titleFont(size) },
        { text: item.text, font: bodyFont(size) },
      ]) : null,
    }]));
}

function inlineHeight(prepared, width, lineHeight) {
  const lines = [];
  walkRichInlineLineRanges(prepared, width, (range) => {
    const { fragments } = materializeRichInlineLineRange(prepared, range);
    lines.push({ text: fragments.map((fragment) => fragment.text).join("") });
  });
  return { lines, height: lines.length * lineHeight };
}

function chooseGroups(groups, width, size, layout, text) {
  return groups.map((group) => {
    const available = width - layout.rail - layout.railGap;
    const shapes = [];
    for (let count = 1; count <= Math.min(3, group.items.length); count += 1) {
      for (const allocation of columns(group.items, count)) {
        for (const measures of widthsFor(count, available, layout.gap)) {
          if (Math.min(...measures) < 225 || Math.max(...measures) > 850) continue;
          const estimated = allocation.map((column, index) => {
            const measure = measures[index];
            const items = column.map((item) => {
              const prepared = text.get(item.id);
              if (layout.inline && prepared.inline) {
                const body = inlineHeight(prepared.inline, measure, layout.bodyLine);
                return { body, h: body.height };
              }
              const heading = layoutWithLines(prepared.heading, measure, layout.headingLine);
              const body = layoutWithLines(prepared.body, measure, layout.bodyLine);
              return { body, h: heading.height + body.height + (item.heading ? layout.subGap : 0) };
            });
            const h = items.reduce((sum, item) => sum + item.h, 0) + layout.itemGap * (items.length - 1);
            return { h, items };
          });
          const height = Math.max(...estimated.map((column) => column.h));
          const ragged = Math.max(...estimated.map((column) => column.h)) - Math.min(...estimated.map((column) => column.h));
          const longMeasure = Math.max(0, ...measures.map((measure) => measure / size - 33));
          const narrowMeasure = Math.max(0, ...measures.map((measure) => 16 - measure / size));
          const widows = estimated.flatMap((column) => column.items).filter(({ body }) =>
            body.lines.length > 1 && body.lines.at(-1).text.trim().length < 5).length;
          const unequalPeers = group.peer && count === group.items.length ? Math.abs(measures[0] - measures.at(-1)) : 0;
          const breakPenalty = group.peer && count !== group.items.length ? 25 : 0;
          const score = height + breakPenalty + ragged * 0.45 + unequalPeers * 0.20 + narrowMeasure * 10
            + longMeasure * 4 + widows * 9 + count * 7;
          shapes.push({ allocation, measures, height, estimated, score, widows });
        }
      }
    }
    shapes.sort((a, b) => a.score - b.score);
    if (!shapes.length) throw new Error(`No candidates fit ${group.id}`);
    return { ...group, chosen: shapes[0], candidateCount: shapes.length, ranking: shapes.slice(0, 4).map((shape) => ({
      columns: shape.allocation.map((column) => column.map((item) => item.id)),
      measures: shape.measures, height: shape.height, score: shape.score, widows: shape.widows,
    })) };
  });
}

function blockMarkup(item, inline) {
  if (inline && item.heading) {
    return `<div class="unit" data-id="${item.id}"><p><strong data-heading-id="${item.id}">${escape(item.heading)}。</strong> <span data-body-id="${item.id}">${escape(item.text)}</span></p></div>`;
  }
  return `<div class="unit" data-id="${item.id}">
    ${item.heading ? `<h3 data-heading-id="${item.id}">${escape(item.heading)}</h3>` : ""}
    <p data-body-id="${item.id}">${escape(item.text)}</p></div>`;
}

function markup(plan, layout) {
  const rendered = plan.groups.map((group) => {
    const columnMarkup = group.chosen.allocation.map((column) =>
      `<div class="flow">${column.map((item) => blockMarkup(item, layout.inline)).join("")}</div>`).join("");
    return `<section class="group" data-group-id="${group.id}">
      <h2>${escape(group.label)}</h2>
      <div class="columns" style="grid-template-columns:${group.chosen.measures.map((w) => `${w}px`).join(" ")}">${columnMarkup}</div>
    </section>`;
  }).join("");
  return `<article class="slide ${layout.headline ? "headline" : "rail"}" style="--w:${plan.frame.width}px;--h:${plan.frame.height}px;--top:${top}px;
      --rail:${layout.rail}px;--rg:${layout.railGap}px;--g:${layout.gap}px;--base:${plan.size}px;--head:${plan.size + 2}px;
      --body-line:${layout.bodyLine}px;--head-line:${layout.headingLine}px;--ig:${layout.itemGap}px;--sg:${layout.subGap}px;
      --pad:${layout.padding}px">
    <header class="masthead">${plan.intro ? `<div class="intro">${escape(plan.intro)}</div>` : ""}
       <h1>${escape(plan.title)}</h1>${plan.deck ? `<div class="deck">${escape(plan.deck)}</div>` : ""}
    </header>
    <main data-content-frame>${rendered}</main></article>`;
}

function geometry(node) {
  const { x, y, width, height } = node.getBoundingClientRect();
  return { x, y, width, height };
}

function linesFrom(element) {
  const node = element.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return [];
  const text = node.textContent;
  const rows = new Map();
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
  for (const { segment, index } of segmenter.segment(text)) {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + segment.length);
    const box = range.getClientRects()[0];
    if (!box || !box.height || box.width <= 0) continue;
    const y = box.top.toFixed(2);
    const row = rows.get(y) ?? { text: "", left: box.left, right: box.right, y: box.top, bottom: box.bottom };
    row.text += segment;
    row.left = Math.min(row.left, box.left);
    row.right = Math.max(row.right, box.right);
    row.bottom = Math.max(row.bottom, box.bottom);
    rows.set(y, row);
  }
  return [...rows.values()];
}

function paint(plan, layout) {
  document.body.innerHTML = markup(plan, layout);
  const boundary = document.querySelector("[data-content-frame]").getBoundingClientRect();
  const groups = Array.from(document.querySelectorAll(".group"), (element) => ({
    id: element.dataset.groupId, ...geometry(element),
  }));
  const text = Array.from(document.querySelectorAll("[data-body-id],[data-heading-id]"), (element) => {
    const lines = linesFrom(element);
    const node = element.closest(".unit").getBoundingClientRect();
    return {
      id: element.dataset.bodyId ?? element.dataset.headingId, role: element.dataset.bodyId ? "body" : "heading",
      text: element.textContent, lines,
      out: lines.some((line) => line.left < node.left - 1 || line.right > node.right + 1 || line.bottom > boundary.bottom + 1),
    };
  });
  const used = groups.at(-1).y + groups.at(-1).height - boundary.y;
  const bottom = Math.max(...text.flatMap((unit) => unit.lines.map((line) => line.bottom)));
  return {
    used, bottom, groups, text,
    valid: used <= boundary.height && text.every((unit) => !unit.out) && document.querySelector("h1").getBoundingClientRect().bottom < boundary.y,
    boundText: plan.groups.flatMap((group) => group.items.map((item) => item.text)).join("")
      === text.filter((unit) => unit.role === "body").map((unit) => unit.text).join(""),
  };
}

export async function renderTrial({ input, frame, sz, sparse, variant = "aside" }) {
  const headline = variant === "above";
  const layout = {
    headline, inline: variant === "run-in",
    rail: headline ? 0 : Math.round(frame.width * 0.115), railGap: headline ? 0 : 28, gap: 35,
    headingLine: Math.round((sz + 2) * 1.40), bodyLine: Math.round(sz * (headline ? 1.36 : 1.43)),
    itemGap: sparse ? 18 : 13, subGap: 5, padding: sparse ? 27 : headline ? 13 : 19,
  };
  const planned = chooseGroups(input.groups, frame.width, sz, layout, dataFor(sz, input.groups));
  const plan = { title: input.title, intro: input.intro, deck: input.deck, groups: planned, frame, size: sz };
  const measured = paint(plan, layout);
  return {
    title: input.title, frame, sz, layout, measured, html: markup(plan, layout),
    groups: planned.map(({ id, label, chosen, candidateCount, ranking }) => ({ id, label, candidateCount, ranking,
      chosen: chosen.allocation.map((column, i) => ({ width: chosen.measures[i], items: column.map((item) => item.id),
        predicted: chosen.estimated[i].items.map(({ body }) => body.lines.map((line) => line.text)) })),
    })),
  };
}

function putProbe(value, w, wrap, float) {
  const element = document.createElement("div");
  Object.assign(element.style, {
    font: `400 20px/28px ${family}`, width: `${w}px`, whiteSpace: "normal",
    wordBreak: "normal", overflowWrap: "break-word", lineBreak: "auto", textWrapStyle: wrap,
    position: "absolute", left: "0", top: "0", visibility: "hidden",
  });
  element.append(document.createTextNode(value));
  if (float) {
    const obstacle = document.createElement("div");
    Object.assign(obstacle.style, { float: "right", width: `${float.w}px`, height: `${float.h}px` });
    element.append(obstacle);
    // The floating object must occur before the text, so insert it and
    // measure the text in its anonymous span after it.
    const span = document.createElement("span");
    span.append(element.firstChild);
    element.append(span);
  }
  document.body.append(element);
  const result = linesFrom(float ? element.querySelector("span") : element).map((line) => line.text.trim());
  element.remove();
  return result;
}

export async function probe(inputs) {
  setLocale("zh-CN");
  const list = inputs.flatMap((input) => input.groups.flatMap((group) => group.items));
  await document.fonts.load('400 20px "Microsoft YaHei"', list.map((item) => item.text).join(""));
  await document.fonts.load('700 32px "Microsoft YaHei"', list.map((item) => item.heading).join(""));
  await document.fonts.load('650 56px "Noto Serif SC"', inputs.map((input) => input.title).join(""));
  const results = [];
  for (const item of list) {
    const prepared = prepareWithSegments(item.text, bodyFont(20));
    for (const w of widths) {
      const pretext = layoutWithLines(prepared, w, 28).lines.map((line) => line.text.trim());
      const greedy = putProbe(item.text, w, "auto");
      const pretty = putProbe(item.text, w, "pretty");
      results.push({ id: item.id, w, pretext, greedy, pretty });
    }
  }
  const variable = [];
  const specimens = list.filter((item) => item.text.length >= 75);
  for (const item of specimens) {
    const prepared = prepareWithSegments(item.text, bodyFont(20));
    const rows = [];
    let cursor = seedCursor;
    const w = 510;
    const float = { w: 166, h: 56 };
    while (true) {
      const lineWidth = rows.length * 28 < float.h ? w - float.w : w;
      const range = layoutNextLineRange(prepared, lineWidth, cursor);
      if (!range) break;
      rows.push({ lineWidth, width: range.width, text: materializeLineRange(prepared, range).text.trim() });
      cursor = range.end;
    }
    const native = putProbe(item.text, w, "auto", float);
    variable.push({ id: item.id, pretext: rows, native });
  }
  return { results, variable };
}
