import { cloneParameters, escapeHtml, itemText, requireCount, text } from "../../../src/visual-runtime/component-authoring.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });

function normalize(parameters) {
  const side = (value, label) => ({
    title: text(value?.title) || label,
    items: requireCount(value?.items, 1, 5, `${label}对比项`).map(itemText),
    emphasis: Boolean(value?.emphasis),
  });
  return { centerLabel: text(parameters?.centerLabel) || "VS", left: side(parameters?.left, "左侧"), right: side(parameters?.right, "右侧") };
}

function columnMarkup(side, model) {
  const primary = side === "right" || model.emphasis;
  const rows = model.items.map((item, index) => `<div class="compare-row" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="compare-${side}-item-${index}">${escapeHtml(item.title)}</div>`).join("");
  return `<article class="compare-card ${primary ? "primary" : "muted"}" data-side="${side}">
    <div class="compare-card-bg" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="compare-${side}-card"></div>
    <div class="compare-heading" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="compare-${side}-heading">${escapeHtml(model.title)}</div>
    <div class="compare-items" data-count="${model.items.length}">${rows}</div>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "comparison-dual-column-p55",
  schemaVersion: 4,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="comparison-root" data-ppt-root data-items-per-side="${Math.max(model.left.items.length, model.right.items.length)}">
      <div class="comparison-floor floor-outer" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-floor-outer"></div>
      <div class="comparison-floor floor-inner" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-floor-inner"></div>
      ${columnMarkup("left", model.left)}${columnMarkup("right", model.right)}
      <div class="comparison-center-orbit" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-center-orbit"></div>
      <div class="comparison-center" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="comparison-center">${escapeHtml(model.centerLabel)}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({ title: "两种路线的差异", centerLabel: "VS", left: { title: "自由生成", items: ["版式质量波动", "结果难以复现", "反复消耗判断", "经验难以沉淀", "维护成本较高"] }, right: { title: "受控生成", items: ["输出稳定可靠", "边界清楚可验", "问题可以回归", "能力持续积累", "维护责任明确"], emphasis: true } });
export function resolvePreviewParameters(base, selection) { const result = cloneParameters(base); result.left.items = result.left.items.slice(0, selection.itemsPerSide); result.right.items = result.right.items.slice(0, selection.itemsPerSide); return result; }
