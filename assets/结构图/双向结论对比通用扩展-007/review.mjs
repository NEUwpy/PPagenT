import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TITLE_LIMIT = 12;
const BODY_LIMIT = 46;
const LABEL_LIMIT = 4;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(value).length;
}

function selectedLayout(bindings, regionId) {
  return text(bindings?.[regionId]) || "heading-content-flow";
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.items) || parameters.items.length !== 2) {
    throw new Error("二对象概括对比需要且只需要两个 items");
  }
  const relationLabel = text(parameters.relationLabel) || "对照";
  if (charCount(relationLabel) > LABEL_LIMIT) throw new Error(`relationLabel 超过 ${LABEL_LIMIT} 字`);
  const items = parameters.items.map((item, index) => {
    const key = text(item?.key) || `item-${index + 1}`;
    const title = text(item?.title);
    const body = text(item?.body);
    if (!title && !body) throw new Error(`items[${index}] 至少需要标题或正文`);
    if (charCount(title) > TITLE_LIMIT) throw new Error(`items[${index}].title 超过 ${TITLE_LIMIT} 字`);
    if (charCount(body) > BODY_LIMIT) throw new Error(`items[${index}].body 超过 ${BODY_LIMIT} 字`);
    return { key, title, body };
  });
  return {
    items,
    relationLabel,
    textLayoutBindings: parameters.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function itemMarkup(item, index, textLayoutBindings) {
  const side = index === 0 ? "left" : "right";
  const regionId = `${item.key}-content-region`;
  return `<article class="summary-field summary-field-${side}">
    ${textRegionMarkup({
      id: regionId,
      field: `items[${index}]`,
      itemId: item.key,
      regionId: "content",
      layoutId: selectedLayout(textLayoutBindings, regionId),
      compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
      content: { title: item.title, body: item.body },
      className: "summary-text-region",
      align: "center",
      valign: "middle",
      density: "standard",
      required: true,
      names: { heading: `summary-title-${index}`, body: `summary-body-${index}` },
    })}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "comparison-two-object-summary",
  schemaVersion: 5,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxTitleChars: TITLE_LIMIT,
    maxTitleLines: 2,
    maxBodyChars: BODY_LIMIT,
    maxBodyLines: 3,
    maxRelationLabelChars: LABEL_LIMIT,
    maxRelationLabelLines: 1,
  }),
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="summary-review" data-ppt-root>
      <svg class="summary-geometry" viewBox="0 0 1170 492" aria-hidden="true">
        <path class="summary-half summary-half-left" d="M201 90 L585 90 L585 402 L201 402 C115 402 45 332 45 246 C45 160 115 90 201 90 Z" data-ppt-kind="path" data-ppt-name="summary-half-left"></path>
        <path class="summary-half summary-half-right" d="M969 90 L585 90 L585 402 L969 402 C1055 402 1125 332 1125 246 C1125 160 1055 90 969 90 Z" data-ppt-kind="path" data-ppt-name="summary-half-right"></path>
        <rect class="summary-outline" x="45" y="90" width="1080" height="312" rx="156" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="summary-outline"></rect>
        <path class="summary-divider" d="M585 112 L585 380" data-ppt-kind="path" data-ppt-name="summary-divider"></path>
        <circle class="summary-hinge-halo" cx="585" cy="246" r="70" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="summary-hinge-halo"></circle>
        <circle class="summary-hinge-core" cx="585" cy="246" r="48" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="summary-hinge-core"></circle>
      </svg>
      ${model.items.map((item, index) => itemMarkup(item, index, model.textLayoutBindings)).join("")}
      <div class="summary-hinge-label" data-slot-id="relation-label" data-slot-role="relation-label" data-slot-field="relationLabel" data-slot-content-type="text" data-slot-required="true" data-slot-max-chars="${LABEL_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="summary-hinge-label">${escapeHtml(model.relationLabel)}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  relationLabel: "对照",
  items: [
    { key: "peace", title: "和平年代底片", body: "记录生活的美好与温馨，留存平凡日常中的真实瞬间" },
    { key: "war", title: "战争年代底片", body: "记录罪证并守护真相，成为对抗谎言的重要见证" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const mode = text(selection?.contentMode) || "标题+正文";
  if (!["标题+正文", "仅标题", "仅正文"].includes(mode)) throw new Error("不支持的文字示例");
  const result = structuredClone(base);
  if (mode === "仅标题") result.items = result.items.map((item) => ({ ...item, body: "" }));
  if (mode === "仅正文") result.items = result.items.map((item) => ({ ...item, title: "" }));
  return result;
}
