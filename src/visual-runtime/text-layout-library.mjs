import { resolveTextFlowContent, textFlowMarkup, textRegionAttributes } from "./text-flow.mjs";

const DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "title-body-adaptive",
    name: "标题正文自适应",
    description: "同一连续区域内自动处理仅标题、仅正文或标题加正文。",
    contentRoles: Object.freeze(["title", "body", "points"]),
    compositions: Object.freeze(["title-only", "body-only", "title-body"]),
    segmentCount: Object.freeze({ min: 1, max: 2 }),
    minimumFrame: Object.freeze({ width: 120, height: 54 }),
  }),
  Object.freeze({
    id: "value-label-stacked",
    name: "数值说明上下排",
    description: "强调数值置于上方，指标名称或简短说明置于下方；两者共用一个区域。",
    contentRoles: Object.freeze(["value", "label"]),
    compositions: Object.freeze(["value-label", "value-only", "label-only"]),
    segmentCount: Object.freeze({ min: 1, max: 2 }),
    minimumFrame: Object.freeze({ width: 72, height: 54 }),
  }),
]);

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function definition(layoutId) {
  const found = DEFINITIONS.find((item) => item.id === layoutId);
  if (!found) throw new Error(`未知文字排版：${layoutId}`);
  return found;
}

export function listTextLayouts() {
  return structuredClone(DEFINITIONS);
}

export function compatibleTextLayouts({ width, height, contentRoles = [] } = {}) {
  const segmentCount = Math.max(1, Math.min(2, contentRoles.filter((role) => role !== "points").length));
  return DEFINITIONS.filter((item) => (
    Number(width) >= item.minimumFrame.width
    && Number(height) >= item.minimumFrame.height
    && segmentCount >= item.segmentCount.min
    && segmentCount <= item.segmentCount.max
  )).map((item) => item.id);
}

function valueLabelMarkup({ id, content, className = "", names = {} }) {
  const value = text(content?.value);
  const label = text(content?.label);
  if (!value && !label) throw new Error(`${id} 的数值说明排版至少需要 value 或 label`);
  const composition = value && label ? "value-label" : value ? "value-only" : "label-only";
  const classes = ["ppagent-text-layout", "ppagent-text-layout--value-label", className].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(classes)}" data-ppagent-text-layout data-text-layout-id="value-label-stacked" data-text-layout-composition="${composition}">
    ${value ? `<div class="ppagent-text-layout__value" data-text-layout-part="value" data-text-layout-field="value" data-ppt-kind="text" data-ppt-name="${escapeHtml(names.value ?? `${id}-value`)}">${escapeHtml(value)}</div>` : ""}
    ${label ? `<div class="ppagent-text-layout__label" data-text-layout-part="label" data-text-layout-field="label" data-ppt-kind="text" data-ppt-name="${escapeHtml(names.label ?? `${id}-label`)}">${escapeHtml(label)}</div>` : ""}
  </div>`;
}

/**
 * 连续文字区域是结构提供的几何插槽；layoutId 只决定本次如何排字。
 * 因而同一个区域可以在不修改结构图代码的前提下更换兼容的文字排版。
 */
export function textRegionMarkup({
  id,
  field,
  itemId = "",
  regionId = "main",
  layoutId,
  content = {},
  className = "",
  layoutClassName = "",
  align = "left",
  valign = "middle",
  tone = "light",
  required = true,
  names = {},
} = {}) {
  const layout = definition(layoutId);
  let innerMarkup;
  if (layoutId === "title-body-adaptive") {
    const flowContent = {
      title: content.title ?? content.value,
      body: content.body ?? content.label,
      points: content.points,
    };
    const resolved = resolveTextFlowContent(flowContent);
    if (required && resolved.composition === "empty") throw new Error(`${id} 的文字区域不能为空`);
    innerMarkup = textFlowMarkup({
      id: `${id}-layout`,
      field,
      itemId,
      regionId,
      title: flowContent.title,
      body: flowContent.body,
      points: flowContent.points,
      className: layoutClassName,
      align,
      valign,
      tone,
      required,
      names,
      exposeSlot: false,
      layoutId,
    });
  } else if (layoutId === "value-label-stacked") {
    innerMarkup = valueLabelMarkup({
      id,
      content: { value: content.value ?? content.title, label: content.label ?? content.body },
      className: layoutClassName,
      names,
    });
  }
  const roles = layout.contentRoles.filter((role) => {
    if (role === "points") return Array.isArray(content.points) && content.points.length > 0;
    return Boolean(text(content[role]));
  });
  const classes = ["ppagent-text-region", className].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(classes)}" ${textRegionAttributes({ id, field, itemId, regionId, required })} data-text-layout-id="${escapeHtml(layoutId)}" data-text-layout-content-roles="${escapeHtml(roles.join(","))}">${innerMarkup}</div>`;
}
