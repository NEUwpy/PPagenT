import {
  listTextPrimitives,
  textListPrimitiveMarkup,
  textPrimitiveMarkup,
} from "./text-primitives.mjs";
import { textRegionAttributes } from "./text-flow.mjs";

const ALIGNMENTS = new Set(["left", "center", "right"]);
const VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
const DENSITIES = new Set(["compact", "standard", "loose"]);

function layout({ id, name, description, roles, compositions, recommended, status }) {
  return Object.freeze({
    id,
    name,
    description,
    status,
    contentRoles: Object.freeze(roles),
    compositions: Object.freeze(compositions),
    minimumFrame: Object.freeze({ width: recommended[0], height: recommended[1] }),
    recommendedFrame: Object.freeze({ width: recommended[0], height: recommended[1] }),
    alignments: Object.freeze(["left", "center", "right"]),
    verticalAlignments: Object.freeze(["top", "middle", "bottom"]),
    densities: Object.freeze(["compact", "standard", "loose"]),
  });
}

const DEFINITIONS = Object.freeze([
  layout({ id: "statement-flow", name: "单段陈述", description: "用标题、正文或强调语独立表达一个完整观点。", roles: ["heading", "body", "emphasis"], compositions: ["heading-only", "body-only", "emphasis-only"], recommended: [220, 80], status: "candidate" }),
  layout({ id: "heading-content-flow", name: "标题内容", description: "标题与正文或分点按同一信息层级自适应排列。", roles: ["heading", "body", "list"], compositions: ["heading-only", "body-only", "list-only", "heading-body", "heading-list"], recommended: [240, 130], status: "approved" }),
  layout({ id: "label-content-flow", name: "标签内容", description: "用短标签建立语境，再承接标题或正文。", roles: ["label", "heading", "body"], compositions: ["label-heading", "label-body", "label-heading-body"], recommended: [250, 130], status: "candidate" }),
  layout({ id: "structured-list-flow", name: "结构化列表", description: "在一个区域中排列多组小标题与说明，支持编号、分点或无标记。", roles: ["heading", "body", "list"], compositions: ["heading-items", "items-only"], recommended: [300, 190], status: "candidate" }),
  layout({ id: "metric-content-flow", name: "数值说明", description: "突出数值，并用标签或说明交代指标含义。", roles: ["metric", "label", "annotation"], compositions: ["metric-only", "metric-label", "metric-label-annotation"], recommended: [160, 105], status: "approved" }),
  layout({ id: "metric-set-flow", name: "多指标组", description: "在一个连续区域内并列呈现二至四项指标。", roles: ["metric", "label", "annotation"], compositions: ["metric-set"], recommended: [320, 120], status: "candidate" }),
  layout({ id: "key-value-flow", name: "键值信息", description: "以稳定的名称—内容关系排列多项事实。", roles: ["label", "body", "metric"], compositions: ["key-value-list"], recommended: [280, 160], status: "candidate" }),
  layout({ id: "quote-attribution-flow", name: "引语来源", description: "呈现引语、人物或来源以及可选补充说明。", roles: ["quote", "label", "annotation"], compositions: ["quote-only", "quote-source", "quote-source-annotation"], recommended: [300, 165], status: "candidate" }),
  layout({ id: "heading-metric-content-flow", name: "标题指标正文", description: "标题、突出指标和解释文字形成清晰的三层层级。", roles: ["heading", "metric", "label", "body", "annotation"], compositions: ["heading-metric", "heading-metric-body", "heading-metric-annotation"], recommended: [280, 190], status: "candidate" }),
  layout({ id: "summary-information-flow", name: "摘要信息组", description: "用若干短标签、关键词和简短说明组织高密度摘要。", roles: ["label", "emphasis", "body", "annotation"], compositions: ["summary-items"], recommended: [330, 185], status: "candidate" }),
]);

const ALIASES = Object.freeze({
  "title-body-adaptive": "heading-content-flow",
  "value-label-stacked": "metric-content-flow",
});

const BINDING_CONTRACTS = Object.freeze({
  "statement-flow": Object.freeze({ optional: Object.freeze(["title", "body", "emphasis"]), rule: "至少一个字段；只呈现一个主陈述" }),
  "heading-content-flow": Object.freeze({ optional: Object.freeze(["title", "body", "points[]", "listMarker"]), rule: "至少一个内容字段；空字段自动折叠" }),
  "label-content-flow": Object.freeze({ required: Object.freeze(["label"]), optional: Object.freeze(["title", "body"]) }),
  "structured-list-flow": Object.freeze({ required: Object.freeze(["items[].title|body"]), optional: Object.freeze(["title", "listMarker"]) }),
  "metric-content-flow": Object.freeze({ required: Object.freeze(["value|label"]), optional: Object.freeze(["annotation"]) }),
  "metric-set-flow": Object.freeze({ required: Object.freeze(["metrics[2..4].value|label"]), optional: Object.freeze(["metrics[].annotation"]) }),
  "key-value-flow": Object.freeze({ required: Object.freeze(["items[].label", "items[].value"]), optional: Object.freeze([]) }),
  "quote-attribution-flow": Object.freeze({ required: Object.freeze(["quote"]), optional: Object.freeze(["attribution", "annotation"]) }),
  "heading-metric-content-flow": Object.freeze({ optional: Object.freeze(["title", "value", "label", "body", "annotation", "metrics[2..4]"]), rule: "标题、指标或正文至少存在一种" }),
  "summary-information-flow": Object.freeze({ required: Object.freeze(["items[]"]), optional: Object.freeze(["items[].label", "items[].value", "items[].body", "items[].annotation"]) }),
});

const PREVIEW_CONTENT = Object.freeze({
  "statement-flow": Object.freeze({ emphasis: "把复杂内容讲清楚" }),
  "heading-content-flow": Object.freeze({ title: "内容标准化", body: "把原稿整理为稳定、可复用的结构化字段" }),
  "label-content-flow": Object.freeze({ label: "核心能力", title: "可靠生成", body: "规则约束下稳定交付" }),
  "structured-list-flow": Object.freeze({ title: "关键动作", items: Object.freeze([{ title: "理解", body: "识别真实逻辑" }, { title: "编排", body: "匹配合适结构" }]) }),
  "metric-content-flow": Object.freeze({ value: "≥95%", label: "结构化通过率", annotation: "目标状态" }),
  "metric-set-flow": Object.freeze({ metrics: Object.freeze([{ value: "80%", label: "覆盖" }, { value: "17pt", label: "正文" }, { value: "0", label: "溢出" }]) }),
  "key-value-flow": Object.freeze({ items: Object.freeze([{ label: "主题", value: "东北大学" }, { label: "逻辑", value: "并列枚举" }, { label: "状态", value: "可调用" }]) }),
  "quote-attribution-flow": Object.freeze({ quote: "模板有时尽，现状无穷多。", attribution: "PPagenT", annotation: "用有限规则覆盖高概率需求" }),
  "heading-metric-content-flow": Object.freeze({ title: "稳定交付", body: "让结构、文字和主题各负其责", metrics: Object.freeze([{ value: "17pt", label: "正文" }, { value: "15pt", label: "下限" }]) }),
  "summary-information-flow": Object.freeze({ items: Object.freeze([{ label: "输入", value: "稿件", body: "结构化理解" }, { label: "输出", value: "PPT", body: "确定性渲染" }]) }),
});

const PREVIEW_MINIMAL_CONTENT = Object.freeze({
  "statement-flow": Object.freeze({ emphasis: "讲清重点" }),
  "heading-content-flow": Object.freeze({ title: "内容标准化" }),
  "label-content-flow": Object.freeze({ label: "核心能力", title: "可靠生成" }),
  "structured-list-flow": Object.freeze({ items: Object.freeze([{ title: "理解" }, { title: "编排" }]) }),
  "metric-content-flow": Object.freeze({ value: "≥95%", label: "通过率" }),
  "metric-set-flow": Object.freeze({ metrics: Object.freeze([{ value: "80%", label: "覆盖" }, { value: "0", label: "溢出" }]) }),
  "key-value-flow": Object.freeze({ items: Object.freeze([{ label: "主题", value: "东北大学" }, { label: "状态", value: "可调用" }]) }),
  "quote-attribution-flow": Object.freeze({ quote: "模板有时尽，现状无穷多。" }),
  "heading-metric-content-flow": Object.freeze({ title: "稳定交付", value: "17pt", label: "正文" }),
  "summary-information-flow": Object.freeze({ items: Object.freeze([{ label: "输入", value: "稿件" }, { label: "输出", value: "PPT" }]) }),
});

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function canonicalLayoutId(layoutId) {
  return ALIASES[layoutId] ?? layoutId;
}

function definition(layoutId) {
  const canonicalId = canonicalLayoutId(layoutId);
  const found = DEFINITIONS.find((item) => item.id === canonicalId);
  if (!found) throw new Error(`未知文字排版：${layoutId}`);
  return found;
}

function points(content) {
  return Array.isArray(content?.points)
    ? content.points.map((item) => text(item?.text ?? item)).filter(Boolean)
    : [];
}

function items(content, key = "items") {
  return Array.isArray(content?.[key]) ? content[key].filter(Boolean) : [];
}

function primitive(primitiveId, value, options = {}) {
  return textPrimitiveMarkup({ primitiveId, value, ...options });
}

function statementMarkup(id, content, names) {
  if (text(content.emphasis)) return primitive("emphasis", content.emphasis, { part: "emphasis", field: "emphasis", name: names.emphasis ?? `${id}-emphasis` });
  if (text(content.title ?? content.heading)) return primitive("heading", content.title ?? content.heading, { part: "heading", field: "title", name: names.heading ?? names.title ?? `${id}-heading` });
  return primitive("body", content.body ?? content.text, { part: "body", field: "body", name: names.body ?? `${id}-body` });
}

function headingContentMarkup(id, content, names) {
  return [
    primitive("heading", content.title ?? content.heading, { part: "heading", field: "title", name: names.heading ?? names.title ?? `${id}-heading` }),
    primitive("body", content.body, { part: "body", field: "body", name: names.body ?? `${id}-body` }),
    textListPrimitiveMarkup({ items: points(content), field: "points", name: names.list ?? `${id}-point`, marker: content.listMarker ?? "bullet" }),
  ].join("");
}

function labelContentMarkup(id, content, names) {
  return [
    primitive("label", content.label, { part: "label", field: "label", name: names.label ?? `${id}-label` }),
    primitive("heading", content.title ?? content.heading, { part: "heading", field: "title", name: names.heading ?? `${id}-heading` }),
    primitive("body", content.body, { part: "body", field: "body", name: names.body ?? `${id}-body` }),
  ].join("");
}

function structuredListMarkup(id, content, names) {
  const rows = items(content);
  return [
    primitive("heading", content.title ?? content.heading, { part: "heading", field: "title", name: names.heading ?? `${id}-heading` }),
    `<div class="ppagent-structured-list" data-text-list-marker="${escapeHtml(content.listMarker ?? "none")}">${rows.map((item, index) => `<div class="ppagent-structured-list__item">
      ${primitive("heading", item?.title ?? item?.label, { part: "item-heading", field: `items[${index}].title`, name: `${id}-item-${index}-heading` })}
      ${primitive("body", item?.body ?? item?.text, { part: "item-body", field: `items[${index}].body`, name: `${id}-item-${index}-body` })}
    </div>`).join("")}</div>`,
  ].join("");
}

function metricContentMarkup(id, content, names) {
  const metric = content.metric ?? content;
  return [
    primitive("metric", metric.value ?? content.value, { part: "metric", field: "value", name: names.metric ?? names.value ?? `${id}-metric` }),
    primitive("label", metric.label ?? content.label ?? content.title, { part: "label", field: "label", name: names.label ?? `${id}-label` }),
    primitive("annotation", metric.annotation ?? content.annotation ?? content.body, { part: "annotation", field: "annotation", name: names.annotation ?? `${id}-annotation` }),
  ].join("");
}

function metricSetMarkup(id, content) {
  const metrics = items(content, "metrics");
  return `<div class="ppagent-metric-set" data-metric-count="${metrics.length}">${metrics.map((metric, index) => `<div class="ppagent-metric-set__item">
    ${primitive("metric", metric?.value, { part: "metric", field: `metrics[${index}].value`, name: `${id}-metric-${index}` })}
    ${primitive("label", metric?.label ?? metric?.title, { part: "label", field: `metrics[${index}].label`, name: `${id}-metric-${index}-label` })}
    ${primitive("annotation", metric?.annotation ?? metric?.body, { part: "annotation", field: `metrics[${index}].annotation`, name: `${id}-metric-${index}-annotation` })}
  </div>`).join("")}</div>`;
}

function keyValueMarkup(id, content) {
  const rows = items(content, "pairs").length ? items(content, "pairs") : items(content);
  return `<div class="ppagent-key-value">${rows.map((item, index) => `<div class="ppagent-key-value__row">
    ${primitive("label", item?.label ?? item?.key, { part: "key", field: `items[${index}].label`, name: `${id}-key-${index}` })}
    ${primitive(/^[-+]?\d/.test(text(item?.value)) ? "metric" : "body", item?.value ?? item?.body, { part: "value", field: `items[${index}].value`, name: `${id}-value-${index}` })}
  </div>`).join("")}</div>`;
}

function quoteMarkup(id, content, names) {
  return [
    primitive("quote", content.quote ?? content.body ?? content.text, { part: "quote", field: "quote", name: names.quote ?? `${id}-quote` }),
    primitive("label", content.attribution ?? content.source, { part: "attribution", field: "attribution", name: names.attribution ?? `${id}-attribution` }),
    primitive("annotation", content.annotation, { part: "annotation", field: "annotation", name: names.annotation ?? `${id}-annotation` }),
  ].join("");
}

function headingMetricMarkup(id, content, names) {
  const metrics = items(content, "metrics");
  if (metrics.length) {
    return [
      primitive("heading", content.title ?? content.heading, { part: "heading", field: "title", name: names.heading ?? `${id}-heading` }),
      primitive("body", content.body, { part: "body", field: "body", name: names.body ?? `${id}-body` }),
      metricSetMarkup(id, { metrics }),
      primitive("annotation", content.annotation, { part: "annotation", field: "annotation", name: names.annotation ?? `${id}-annotation` }),
    ].join("");
  }
  return [
    primitive("heading", content.title ?? content.heading, { part: "heading", field: "title", name: names.heading ?? `${id}-heading` }),
    primitive("metric", content.value ?? content.metric?.value, { part: "metric", field: "value", name: names.metric ?? `${id}-metric` }),
    primitive("label", content.label ?? content.metric?.label, { part: "label", field: "label", name: names.label ?? `${id}-label` }),
    primitive("body", content.body, { part: "body", field: "body", name: names.body ?? `${id}-body` }),
    primitive("annotation", content.annotation, { part: "annotation", field: "annotation", name: names.annotation ?? `${id}-annotation` }),
  ].join("");
}

function summaryMarkup(id, content) {
  return `<div class="ppagent-summary-information">${items(content).map((item, index) => `<div class="ppagent-summary-information__item">
    ${primitive("label", item?.label, { part: "label", field: `items[${index}].label`, name: `${id}-summary-${index}-label` })}
    ${primitive("emphasis", item?.value ?? item?.title ?? item?.keyword, { part: "emphasis", field: `items[${index}].value`, name: `${id}-summary-${index}-emphasis` })}
    ${primitive("body", item?.body ?? item?.text, { part: "body", field: `items[${index}].body`, name: `${id}-summary-${index}-body` })}
    ${primitive("annotation", item?.annotation, { part: "annotation", field: `items[${index}].annotation`, name: `${id}-summary-${index}-annotation` })}
  </div>`).join("")}</div>`;
}

const RENDERERS = Object.freeze({
  "statement-flow": statementMarkup,
  "heading-content-flow": headingContentMarkup,
  "label-content-flow": labelContentMarkup,
  "structured-list-flow": structuredListMarkup,
  "metric-content-flow": metricContentMarkup,
  "metric-set-flow": metricSetMarkup,
  "key-value-flow": keyValueMarkup,
  "quote-attribution-flow": quoteMarkup,
  "heading-metric-content-flow": headingMetricMarkup,
  "summary-information-flow": summaryMarkup,
});

function presentRoles(content) {
  const roles = new Set();
  if (text(content?.title ?? content?.heading)) roles.add("heading");
  if (text(content?.body ?? content?.text)) roles.add("body");
  if (points(content).length) roles.add("list");
  if (text(content?.value ?? content?.metric?.value)) roles.add("metric");
  if (text(content?.label ?? content?.metric?.label)) roles.add("label");
  if (text(content?.annotation ?? content?.source ?? content?.attribution)) roles.add("annotation");
  if (text(content?.quote)) roles.add("quote");
  if (text(content?.emphasis ?? content?.keyword)) roles.add("emphasis");
  for (const item of [...items(content), ...items(content, "metrics"), ...items(content, "pairs")]) {
    if (text(item?.title ?? item?.heading)) roles.add("heading");
    if (text(item?.body ?? item?.text)) roles.add("body");
    if (text(item?.value)) roles.add(/^[-+]?\d/.test(text(item.value)) ? "metric" : "body");
    if (text(item?.label ?? item?.key)) roles.add("label");
    if (text(item?.annotation)) roles.add("annotation");
  }
  return [...roles];
}

export function listTextLayouts({ status = "all" } = {}) {
  const result = status === "all" ? DEFINITIONS : DEFINITIONS.filter((item) => item.status === status);
  return structuredClone(result.map((item) => ({ ...item, bindingContract: BINDING_CONTRACTS[item.id] })));
}

export function listTextLayoutPrimitives() {
  return listTextPrimitives();
}

export function resolveTextLayoutDefinition(layoutId) {
  const item = definition(layoutId);
  return structuredClone({ ...item, bindingContract: BINDING_CONTRACTS[item.id] });
}

export function textLayoutCatalogPreviewMarkup({ layoutId, id = `catalog-${layoutId}`, profile = "representative", align = "left", valign = "middle", density = "standard" } = {}) {
  const canonicalId = canonicalLayoutId(layoutId);
  const previewContent = profile === "minimal" ? PREVIEW_MINIMAL_CONTENT[canonicalId] : PREVIEW_CONTENT[canonicalId];
  return textRegionMarkup({
    id,
    field: `textLayouts.${canonicalId}`,
    regionId: "catalog-preview",
    layoutId: canonicalId,
    content: structuredClone(previewContent),
    align,
    valign,
    density,
  });
}

export function compatibleTextLayouts({ width, height, contentRoles = [], status = "all" } = {}) {
  return DEFINITIONS.filter((item) => (
    (status === "all" || item.status === status)
    && Number(width) >= item.minimumFrame.width
    && Number(height) >= item.minimumFrame.height
  )).map((item) => item.id);
}

export function textRegionMarkup({
  id,
  field,
  itemId = "",
  regionId = "main",
  layoutId,
  compatibleLayoutIds = null,
  content = {},
  className = "",
  layoutClassName = "",
  align = "left",
  valign = "middle",
  density = "standard",
  tone = "light",
  required = true,
  names = {},
} = {}) {
  if (!ALIGNMENTS.has(align)) throw new Error(`${id} 的横向对齐非法：${align}`);
  if (!VERTICAL_ALIGNMENTS.has(valign)) throw new Error(`${id} 的纵向对齐非法：${valign}`);
  if (!DENSITIES.has(density)) throw new Error(`${id} 的排版密度非法：${density}`);
  const resolvedLayout = definition(layoutId);
  const roles = presentRoles(content);
  if (required && !roles.length) throw new Error(`${id} 的文字区域不能为空`);
  const innerMarkup = RENDERERS[resolvedLayout.id](id, content, names);
  if (required && !innerMarkup.replace(/<[^>]+>/g, "").trim()) throw new Error(`${id} 的文字排版没有可见内容`);
  const compatible = Array.isArray(compatibleLayoutIds) && compatibleLayoutIds.length
    ? compatibleLayoutIds.map(canonicalLayoutId)
    : [resolvedLayout.id];
  const regionClasses = ["ppagent-text-region", className].filter(Boolean).join(" ");
  const layoutClasses = ["ppagent-text-layout", `ppagent-text-layout--${resolvedLayout.id}`, layoutClassName].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(regionClasses)}" ${textRegionAttributes({ id, field, itemId, regionId, required })} data-text-layout-id="${resolvedLayout.id}" data-text-layout-default-id="${resolvedLayout.id}" data-text-layout-compatible="${escapeHtml(compatible.join(","))}" data-text-layout-content-roles="${escapeHtml(roles.join(","))}">
    <div class="${escapeHtml(layoutClasses)}" data-ppagent-text-layout data-text-layout-id="${resolvedLayout.id}" data-text-layout-align="${align}" data-text-layout-valign="${valign}" data-text-layout-density="${density}" data-text-layout-tone="${escapeHtml(tone)}">${innerMarkup}</div>
  </div>`;
}
