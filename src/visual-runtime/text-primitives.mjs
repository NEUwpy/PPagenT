const FONT_LADDER = Object.freeze([25, 23, 21, 19, 17, 15]);

const DEFINITIONS = Object.freeze([
  Object.freeze({ id: "heading", name: "标题", defaultFontSizePt: 21, fontSizesPt: Object.freeze([25, 23, 21, 19, 17]), weight: 700, lineHeight: 1.2 }),
  Object.freeze({ id: "body", name: "正文", defaultFontSizePt: 17, fontSizesPt: Object.freeze([19, 17, 15]), weight: 400, lineHeight: 1.45 }),
  Object.freeze({ id: "list", name: "列表", defaultFontSizePt: 17, fontSizesPt: Object.freeze([19, 17, 15]), weight: 400, lineHeight: 1.38 }),
  Object.freeze({ id: "metric", name: "数值指标", defaultFontSizePt: 25, fontSizesPt: Object.freeze([25, 23, 21, 19]), weight: 700, lineHeight: 1.08 }),
  Object.freeze({ id: "label", name: "标签", defaultFontSizePt: 17, fontSizesPt: Object.freeze([19, 17, 15]), weight: 600, lineHeight: 1.2 }),
  Object.freeze({ id: "annotation", name: "注释与来源", defaultFontSizePt: 15, fontSizesPt: Object.freeze([17, 15]), weight: 400, lineHeight: 1.3 }),
  Object.freeze({ id: "quote", name: "引语", defaultFontSizePt: 21, fontSizesPt: Object.freeze([23, 21, 19, 17]), weight: 500, lineHeight: 1.35 }),
  Object.freeze({ id: "emphasis", name: "强调语", defaultFontSizePt: 23, fontSizesPt: Object.freeze([25, 23, 21, 19, 17]), weight: 700, lineHeight: 1.2 }),
]);

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function definition(primitiveId) {
  const found = DEFINITIONS.find((item) => item.id === primitiveId);
  if (!found) throw new Error(`未知基础文字组件：${primitiveId}`);
  return found;
}

function attributes({ primitiveId, part, field, name, className = "" }) {
  const primitive = definition(primitiveId);
  return {
    primitive,
    classNames: [
      "ppagent-text-primitive",
      `ppagent-text-primitive--${primitiveId}`,
      className,
    ].filter(Boolean).join(" "),
    data: `data-text-primitive="${primitiveId}" data-text-layout-part="${escapeHtml(part || primitiveId)}" data-text-layout-field="${escapeHtml(field || part || primitiveId)}" data-text-primitive-font-tiers="${primitive.fontSizesPt.join(",")}" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="${escapeHtml(name || `${part || primitiveId}-text`)}"`,
  };
}

export const structureTextFontLadder = FONT_LADDER;

export function listTextPrimitives() {
  return structuredClone(DEFINITIONS);
}

export function textPrimitiveMarkup({
  primitiveId,
  value,
  part = primitiveId,
  field = part,
  name = `${part}-text`,
  className = "",
  tag = "div",
} = {}) {
  const content = text(value);
  if (!content) return "";
  const resolved = attributes({ primitiveId, part, field, name, className });
  return `<${tag} class="${escapeHtml(resolved.classNames)}" ${resolved.data}>${escapeHtml(content)}</${tag}>`;
}

export function textListPrimitiveMarkup({
  items = [],
  field = "points",
  name = "list",
  className = "",
  marker = "bullet",
} = {}) {
  const values = Array.isArray(items) ? items.map((item) => text(item?.text ?? item)).filter(Boolean) : [];
  if (!values.length) return "";
  if (!["bullet", "ordered", "none"].includes(marker)) throw new Error(`未知列表标记：${marker}`);
  const primitive = definition("list");
  const classes = ["ppagent-text-primitive", "ppagent-text-primitive--list", className].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(classes)}" data-text-primitive="list" data-text-list-marker="${marker}">
    ${values.map((value, index) => {
      const prefix = marker === "bullet" ? "• " : marker === "ordered" ? `${index + 1}. ` : "";
      return `<div class="ppagent-text-list__item" data-text-primitive="list" data-text-layout-part="list-item" data-text-layout-field="${escapeHtml(`${field}[${index}]`)}" data-text-primitive-font-tiers="${primitive.fontSizesPt.join(",")}" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="${escapeHtml(`${name}-${index}`)}">${escapeHtml(`${prefix}${value}`)}</div>`;
    }).join("")}
  </div>`;
}
