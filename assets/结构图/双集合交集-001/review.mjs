const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ title: 10, body: 24 });

function text(value) { return String(value ?? "").trim(); }
function chars(value) { return Array.from(value).length; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function normalizeRegion(region, field) {
  const title = text(region?.title);
  const body = text(region?.body);
  if (!title) throw new Error(`${field}.title 不能为空`);
  if (chars(title) > LIMITS.title) throw new Error(`${field}.title 超过 ${LIMITS.title} 字`);
  if (chars(body) > LIMITS.body) throw new Error(`${field}.body 超过 ${LIMITS.body} 字`);
  return { title, body };
}

function normalize(parameters) {
  const textMode = parameters?.textMode ?? "title-body";
  if (!["title-body", "title-only"].includes(textMode)) throw new Error("textMode 仅支持 title-body 或 title-only");
  const model = {
    textMode,
    left: normalizeRegion(parameters?.left, "left"),
    shared: normalizeRegion(parameters?.shared, "shared"),
    right: normalizeRegion(parameters?.right, "right"),
  };
  if (textMode === "title-body" && !model.left.body && !model.shared.body && !model.right.body) throw new Error("标题与说明状态至少需要一处说明文字");
  if (textMode === "title-only") {
    model.left.body = "";
    model.shared.body = "";
    model.right.body = "";
  }
  return model;
}

function regionMarkup(region, name, label) {
  const body = region.body
    ? `<div class="${name === "shared" ? "shared-body" : `set-body set-body-${name}`}" data-slot-id="${name}-body" data-slot-role="item-body" data-slot-field="${name}.body" data-slot-item-id="${name}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.body}" data-slot-max-lines="3" data-ppt-kind="text" data-ppt-name="${name}-body">${escapeHtml(region.body)}</div>`
    : "";
  return `${name === "shared" ? "" : `<div class="set-mark set-mark-${name}" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="${name}-mark">${label}</div>`}
    <div class="${name === "shared" ? "shared-title" : `set-title set-title-${name}`}" data-slot-id="${name}-title" data-slot-role="item-title" data-slot-field="${name}.title" data-slot-item-id="${name}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.title}" data-slot-max-lines="2" data-ppt-kind="text" data-ppt-name="${name}-title">${escapeHtml(region.title)}</div>
    ${body}`;
}

export const visualComponent = Object.freeze({
  id: "containment-two-set-intersection",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({ maxTitleChars: LIMITS.title, maxBodyChars: LIMITS.body }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="intersection-review" data-ppt-root data-text-mode="${model.textMode}">
      <div class="set-shadow set-left" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="left-shadow"></div>
      <div class="set-shadow set-right" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="right-shadow"></div>
      <div class="set-circle set-left" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="left-set"></div>
      <div class="set-circle set-right" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="right-set"></div>
      <div class="set-ring set-left" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="left-ring"></div>
      <div class="set-ring set-right" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="right-ring"></div>
      <svg class="lens-layer" viewBox="0 0 1170 492" aria-hidden="true">
        <path d="M585 46.3 A235 235 0 0 1 585 423.7 A235 235 0 0 1 585 46.3 Z" fill="#3977bc" fill-opacity="0.90" stroke="#ffffff" stroke-opacity="0.72" stroke-width="2" data-ppt-kind="path" data-ppt-name="shared-lens"></path>
      </svg>
      ${regionMarkup(model.left, "left", "A")}
      ${regionMarkup(model.shared, "shared", "")}
      ${regionMarkup(model.right, "right", "B")}
      <div class="scope-caption scope-caption-left" data-ppt-kind="text" data-ppt-name="left-caption">左侧独有范围</div>
      <div class="scope-caption scope-caption-right" data-ppt-kind="text" data-ppt-name="right-caption">右侧独有范围</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  textMode: "title-body",
  left: { title: "组织标准", body: "稳定流程、统一规范与可靠交付" },
  shared: { title: "可靠且有表现力", body: "在规范基础上清晰表达" },
  right: { title: "灵活表达", body: "适配内容差异与真实汇报需要" },
});

export function resolvePreviewParameters(base, selection) {
  const textMode = selection?.textMode ?? "title-body";
  if (!["title-body", "title-only"].includes(textMode)) throw new Error("文本模式无效");
  return { ...structuredClone(base), textMode };
}
