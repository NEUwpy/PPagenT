import { textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });

function text(value) { return String(value ?? "").trim(); }

function normalizeRegion(region, field) {
  const title = text(region?.title);
  const body = text(region?.body);
  if (!title && !body) throw new Error(`${field} 至少需要标题或正文`);
  return { title, body };
}

function normalize(parameters) {
  return {
    left: normalizeRegion(parameters?.left, "left"),
    shared: normalizeRegion(parameters?.shared, "shared"),
    right: normalizeRegion(parameters?.right, "right"),
  };
}

function regionMarkup(region, name, label) {
  return `${name === "shared" ? "" : `<div class="set-mark set-mark-${name}" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="${name}-mark">${label}</div>`}
    ${textFlowMarkup({
      id: `${name}-content`,
      field: name,
      itemId: name,
      title: region.title,
      body: region.body,
      className: name === "shared" ? "shared-content" : `set-content set-content-${name}`,
      align: "center",
      valign: "middle",
      names: { title: `${name}-title`, body: `${name}-body` },
    })}`;
}

export const visualComponent = Object.freeze({
  id: "containment-two-set-intersection",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "standard", scope: "structured-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="intersection-review" data-ppt-root>
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
  left: { title: "组织标准", body: "稳定流程、统一规范与可靠交付" },
  shared: { title: "可靠且有表现力", body: "在规范基础上清晰表达" },
  right: { title: "灵活表达", body: "适配内容差异与真实汇报需要" },
});

export function resolvePreviewParameters(base, selection) {
  void selection;
  return structuredClone(base);
}
