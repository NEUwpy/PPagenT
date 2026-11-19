import fs from "node:fs/promises";
import {
  renderAdaptiveMarkup,
  resolveConvergenceLayout,
} from "../../assets/结构图/多路汇聚结果-003/review.mjs";
import { universityMckinseySkin } from "../../src/runtime/skins/university-mckinsey.mjs";
import { compileHtmlComponentTheme, htmlComponentThemeCss } from "../../src/visual-runtime/html-component-theme.mjs";
import { htmlTextFlowCss } from "../../src/visual-runtime/text-flow.mjs";

const fromHere = (file) => fs.readFile(new URL(file, import.meta.url), "utf8");
const [pageCss, assetCss] = await Promise.all([
  fromHere("gray.css"),
  fromHere("../../assets/结构图/多路汇聚结果-003/component.css"),
]);
const theme = {
  ...universityMckinseySkin,
  font: "Noto Sans SC",
  primaryColor: "#626262",
  line: "#c5c5c5",
  dark: "#262626",
  body: "#424242",
  muted: "#535353",
};
const convergenceAsset = "convergence-many-to-one-003";
const minimumCurveWidth = 24;
// The adaptive asset reserves at least 190px and 210px for its nodes and 6px at each end.
const minimumConvergenceWidth = 190 + 210 + 12 + minimumCurveWidth;
const sheetCss = htmlComponentThemeCss(theme) + htmlTextFlowCss()
  + compileHtmlComponentTheme({ css: assetCss.slice(assetCss.indexOf(".merge {")), theme }).css + pageCss;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function textAttributes(id, field, role) {
  return ` data-node="${escapeHtml(id)}" data-text data-role="${role}" data-source-ids="${escapeHtml(field.sourceIds.join(" "))}"`;
}

function text(tag, field, id, role, className) {
  const classes = className ? ` class="${className}"` : "";
  return `<${tag}${classes}${textAttributes(id, field, role)}>${escapeHtml(field.text)}</${tag}>`;
}

function renderNotes(notes, related, className) {
  if (!notes?.length) return "";
  const names = new Map(related.map((item) => [item.id, item.title.text]));
  return `<div class="${className}">${notes.map((note) => {
    const scope = note.appliesTo.length < related.length
      ? `<span class="scope-label" data-node="note:${escapeHtml(note.id)}:scope" data-role="scope-label">适用于 ${escapeHtml(note.appliesTo.map((id) => names.get(id)).join("、"))}</span>`
      : "";
    return `<aside class="scope-note" data-node="note:${escapeHtml(note.id)}" data-applies-to="${escapeHtml(note.appliesTo.join(" "))}">${scope}
      ${text("p", note.text, `note:${note.id}:text`, "scope-note")}</aside>`;
  }).join("")}</div>`;
}

function arrow(id, from, to) {
  return `<svg class="sequence-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 16" width="18" height="16" aria-hidden="true">
    <path d="M1 8h15m-6-5l6 5-6 5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" data-node="${escapeHtml(id)}" data-from="${escapeHtml(from)}" data-to="${escapeHtml(to)}"/>
  </svg>`;
}

function renderSteps(steps, prefix, width) {
  const vertical = steps.length > 5 || width < steps.length * 90 + (steps.length - 1) * 30;
  const stepId = (i) => `${prefix}:step:${i + 1}`;
  return `<div class="sequence-steps${vertical ? " vertical" : ""}" data-node="${escapeHtml(prefix)}" data-component="sequence-flow">
    ${steps.map((step, index) => (index ? arrow(`${prefix}:link:${index}`, stepId(index - 1), stepId(index)) : "")
      + text("span", step, stepId(index), "step", [...step.text].length <= 4 ? "step short-step" : "step")).join("")}
  </div>`;
}

function renderFacts(component, prefix, width) {
  const labelWidth = component.label ? Math.max(78, width * .195) : 0;
  const widest = Math.max(...component.facts.flatMap(({ label, value }) =>
    [label, value].map(({ text }) => Math.max(...text.split("\n").map((line) => [...line].length)))));
  const cellWidth = Math.max(60, 18 * widest + 14);
  let columns = Math.max(1, Math.min(component.facts.length, Math.floor((width - labelWidth) / cellWidth)));
  // A single cell stranded on the final line makes equal facts look unequal.
  if (columns > 2 && component.facts.length % columns === 1) columns -= 1;
  const label = component.label ? text("p", component.label, `${prefix}:label`, "facts-label", "facts-label") : "";
  return `<div class="short-facts" data-node="${escapeHtml(prefix)}" data-component="label-value-strip">
    ${label}<div class="facts-pairs" style="--fact-columns:${columns}">${component.facts.map(({ label, value }, index) => {
      const factId = `${prefix}:fact:${index + 1}`;
      return `<dl data-node="${escapeHtml(factId)}" data-clip>${text("dt", label, `${factId}:label`, "fact-label")}
        ${text("dd", value, `${factId}:value`, "fact-value")}</dl>`;
    }).join("")}</div>
  </div>`;
}

function renderConvergence(component, prefix, width, density) {
  const nodeGap = density === "compact" ? 5 : 8;
  const height = 58 * component.inputs.length + nodeGap * (component.inputs.length - 1) + 24;
  const frame = { width, height };
  const geometry = resolveConvergenceLayout(frame, component.inputs.length);
  const connectionSpan = width - geometry.resultRight - geometry.resultWidth - geometry.inputLeft - geometry.inputWidth;
  if (connectionSpan < minimumCurveWidth) {
    throw new RangeError(`${prefix} 的汇聚区宽度 ${width}px 留给曲线的空间不足`);
  }
  const bindings = new Map();
  const shapes = new Map();
  const edges = new Map();
  const resultId = `${prefix}:result`;
  for (const [index, input] of component.inputs.entries()) {
    const legacy = `merge-input-${index + 1}`;
    const node = `${prefix}:input:${input.id}`;
    shapes.set(legacy, node);
    edges.set(`merge-lane-${index + 1}`, { id: `${prefix}:edge:${index + 1}`, from: node, to: resultId });
    bindings.set(legacy + "-title", { id: `${node}:title`, field: input.title, role: "diagram-title" });
    if (input.body) bindings.set(legacy + "-body", { id: `${node}:body`, field: input.body, role: "diagram-body" });
  }
  shapes.set("merge-result", resultId);
  bindings.set("merge-result-title", { id: `${resultId}:title`, field: component.result, role: "diagram-result" });
  let markup;
  try {
    markup = renderAdaptiveMarkup({
      inputs: component.inputs.map(({ id, title, body }) => ({ key: `${prefix}-${id}`, title: title.text, body: body?.text })),
      result: { title: component.result.text },
    }, { frame });
  } catch (error) {
    throw new RangeError(`${prefix} 的汇聚实文超过结构容量（${error.message}）`, { cause: error });
  }
  // The skin compiler preserves the shape/slot markup. Bind field metadata to its actual text leaves.
  markup = compileHtmlComponentTheme({ markup, theme }).markup.replace(
    /<[a-z][\w-]*\s[^>]*?\sdata-ppt-name="([^"]+)"[^>]*>/gu,
    (tag, name) => {
      const binding = bindings.get(name);
      const shape = shapes.get(name);
      const edge = edges.get(name);
      const base = tag.slice(0, -1).replace(`data-ppt-name="${name}"`, `data-ppt-name="${escapeHtml(prefix)}:${name}"`);
      if (binding) return base + textAttributes(binding.id, binding.field, binding.role) + ">";
      if (shape) return base + ` data-clip data-node="${escapeHtml(shape)}">`;
      if (edge) return base + ` data-node="${escapeHtml(edge.id)}" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}">`;
      return base + ">";
    },
  );
  return `<figure class="convergence" data-node="${escapeHtml(prefix)}" data-component="convergence" data-asset="${convergenceAsset}" data-component-version="6" data-frame-width="${width}" data-frame-height="${height}">${markup}</figure>`;
}

function renderComponent(component, prefix, width, density) {
  if (!component) return "";
  switch (component.kind) {
    case "sequence":
      return renderSteps(component.steps, prefix, width);
    case "short-facts":
      return renderFacts(component, prefix, width);
    case "convergence":
      return renderConvergence(component, prefix, width, density);
    default:
      throw new RangeError(`不支持的组件 ${component.kind}`);
  }
}

function itemInsets({ relation, index }) {
  const readingInset = index ? 84 : 0;
  const relationInset = { parallel: index ? 0 : 20, comparison: index ? 0 : 26, sequence: 12 };
  return readingInset + (relationInset[relation] ?? 0);
}

function hasConvergence(group) {
  return group.items.some(({ component }) => component?.kind === "convergence");
}

function groupInsets(padding) {
  return 2 * (padding + 1);
}

export function minimumGroupWidth(group, padding) {
  const interior = hasConvergence(group)
    ? minimumConvergenceWidth + itemInsets(group)
    : group.relation === "comparison" ? 350 : 190;
  return interior + groupInsets(padding);
}

function renderGroup(group, width, layout) {
  const groupId = `group:${group.id}`;
  const relation = group.relation;
  const indexed = Boolean(group.index);
  const innerWidth = width - groupInsets(layout.padding);
  const itemInset = itemInsets(group);
  const comparisonTrack = hasConvergence(group) ? minimumConvergenceWidth + itemInset : 240;
  const comparisonColumns = relation === "comparison"
    ? Math.min(group.items.length, Math.max(1, Math.floor((innerWidth + 14) / (comparisonTrack + 14))))
    : 1;
  const itemWidth = Math.floor((innerWidth - 14 * (comparisonColumns - 1)) / comparisonColumns);
  const items = group.items.map((item, index) => {
    const id = `item:${item.id}`;
    const marker = indexed ? `<span class="index-marker" aria-hidden="true" data-node="${escapeHtml(id)}:index" data-role="index">${String(index + 1).padStart(2, "0")}</span>` : "";
    const surface = indexed
      ? `<svg class="reading-surface" aria-hidden="true" viewBox="0 0 550 100" preserveAspectRatio="none"><polygon points="0,0 534,0 550,50 534,100 0,100" data-node="${escapeHtml(id)}:surface"/></svg>`
      : "";
    const widthBudget = itemWidth - itemInset;
    const markup = `<li data-item data-node="${escapeHtml(id)}">${marker}<div class="item-copy">${surface}
      ${text("h3", item.title, `${id}:title`, "item-title")}
      ${item.body ? text("p", item.body, `${id}:body`, "body") : ""}
      ${renderComponent(item.component, `component:${item.id}`, widthBudget, layout.density)}
    </div></li>`;
    if (relation !== "sequence" || !index) return markup;
    return `<li class="group-flow-link" aria-hidden="true">${arrow(`${groupId}:link:${index}`, `item:${group.items[index - 1].id}`, id)}</li>` + markup;
  }).join("");
  return `<section class="group" data-group data-node="${escapeHtml(groupId)}" data-relation="${escapeHtml(relation)}" data-indexed="${indexed}" style="--comparison-columns:${comparisonColumns};width:${width}px">
    <div class="group-heading">${text("h2", group.title, `${groupId}:title`, "group-title")}</div>
    <ol class="group-items">${items}</ol>
    ${renderNotes(group.scopeNotes, group.items, "group-notes")}
  </section>`;
}

export function renderGrayPage(plan, layout) {
  const { page } = plan;
  const { canvas, margin, gap, padding, direction, columns, density } = layout;
  const groups = page.groups.map((group, index) => renderGroup(group, columns[index], layout)).join("");
  const tracks = direction === "row" ? columns.map((width) => `${width}px`).join(" ") : `${Math.max(...columns)}px`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(page.title.text)} · 灰稿</title>
<style>${sheetCss}</style></head>
<body><article class="gray-slide" data-slide data-node="slide" data-density="${escapeHtml(density)}"
  style="--width:${canvas.width}px;--height:${canvas.height}px;--margin:${margin}px;--group-gap:${gap}px;--group-padding:${padding}px;--tracks:${tracks}">
  <header class="theme-heading" data-node="theme-header">
    ${text("h1", page.claim, "claim", "claim")}
    ${text("p", page.title, "title", "page-title", "page-title")}
  </header>
  <main data-content-frame data-node="content-frame">
    ${renderNotes(page.scopeNotes, page.groups, "page-notes")}
    <div class="groups" data-direction="${escapeHtml(direction)}">${groups}</div>
  </main>
</article></body></html>`;
}
