import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TONES = Object.freeze(["#28577d", "#35688f", "#477b9f", "#5c8dab", "#78a3bd", "#9ab9cb", "#adc7d5", "#bfd4df"]);
const BACK_TONES = Object.freeze(["#1f4664", "#28577d", "#35688f", "#477b9f", "#5c8dab", "#78a3bd", "#91aec0", "#a7c0ce"]);

function text(value, max, field) {
  const result = String(value ?? "").trim();
  if (!result || [...result].length > max) throw new Error(`${field} 超出容量`);
  return result;
}

function list(value, min, max, field) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${field} 需要 ${min}–${max} 项`);
  return value;
}

function normalize(parameters) {
  return {
    center: text(parameters?.center, 18, "center"),
    inner: list(parameters?.inner, 3, 4, "inner").map((value, index) => text(value, 9, `inner[${index}]`)),
    outer: list(parameters?.outer, 4, 8, "outer").map((value, index) => text(value, 10, `outer[${index}]`)),
  };
}

function orbitAngles(count, tier) {
  if (tier === "inner") return count === 3 ? [-90, 30, 150] : [-45, 45, 135, 225];
  const start = count === 4 ? -45 : 0;
  return Array.from({ length: count }, (_, index) => start + index * (360 / count));
}

function orbitGeometry(count, tier) {
  const inner = tier === "inner";
  const rx = inner ? 230 : 405;
  const ry = inner ? 110 : 168;
  const size = inner ? 92 : 78;
  return orbitAngles(count, tier).map((angle) => {
    const radians = angle * Math.PI / 180;
    const x = 585 + rx * Math.cos(radians);
    const y = 246 + ry * Math.sin(radians);
    return {
      x,
      y,
      label: { left: x - size / 2, top: y - size / 2 },
    };
  });
}

function labelRegion({ id, field, value, className, align, name }) {
  return textRegionMarkup({
    id,
    field,
    itemId: id,
    regionId: "label",
    layoutId: "statement-flow",
    compatibleLayoutIds: ["statement-flow"],
    content: { title: value },
    className,
    align,
    valign: "middle",
    density: "compact",
    required: true,
    names: { heading: name },
  });
}

export const visualComponent = Object.freeze({
  id: "hub-two-tier-capabilities-004",
  schemaVersion: 7,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const inner = orbitGeometry(model.inner.length, "inner");
    const outer = orbitGeometry(model.outer.length, "outer");
    return `<section class="two-tier-review" data-ppt-root data-inner-count="${model.inner.length}" data-outer-count="${model.outer.length}">
      <svg viewBox="0 0 1170 492" aria-hidden="true">
        <ellipse class="orbit-shell orbit-shell--outer" cx="585" cy="246" rx="405" ry="168" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-secondary-orbit"></ellipse>
        <ellipse class="orbit-shell orbit-shell--inner" cx="585" cy="246" rx="230" ry="110" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-primary-orbit"></ellipse>
        ${outer.map((point, index) => `<circle class="secondary-node-back" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="39" fill="${TONES[index]}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-secondary-node-${index + 1}-back"></circle><circle class="secondary-node-disc" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="33" fill="#f2f6f8" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-secondary-node-${index + 1}"></circle>`).join("")}
        ${inner.map((point, index) => `<circle class="primary-node-back" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="46" fill="${BACK_TONES[index]}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-primary-node-${index + 1}-back"></circle><circle class="primary-node-disc" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="39" fill="${TONES[index]}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-primary-node-${index + 1}"></circle>`).join("")}
        <circle class="core-rule" cx="585" cy="246" r="83" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-rule"></circle>
        <circle class="core-back" cx="585" cy="246" r="74" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-back"></circle>
        <circle class="core-disc" cx="585" cy="246" r="65" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-disc"></circle>
      </svg>
      <div class="tier-caption tier-caption--outer">第二级成果</div><div class="tier-caption tier-caption--inner">第一级能力</div>
      ${labelRegion({ id: "ecology-center", field: "center", value: model.center, className: "core-region", align: "center", name: "ecology-center-title" })}
      ${model.inner.map((value, index) => `<div class="inner-label" style="left:${inner[index].label.left.toFixed(1)}px;top:${inner[index].label.top.toFixed(1)}px;--tone:${TONES[index]}">${labelRegion({ id: `ecology-inner-${index}`, field: `inner[${index}]`, value, className: "inner-region", align: "center", name: `ecology-inner-${index}-title` })}</div>`).join("")}
      ${model.outer.map((value, index) => `<div class="outer-label" style="left:${outer[index].label.left.toFixed(1)}px;top:${outer[index].label.top.toFixed(1)}px;--tone:${TONES[index]}">${labelRegion({ id: `ecology-outer-${index}`, field: `outer[${index}]`, value, className: "outer-region", align: "center", name: `ecology-outer-${index}-title` })}</div>`).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  center: "可靠 PPTX 生成",
  inner: Object.freeze(["内容理解", "结构选择", "响应布局", "原生编译"]),
  outer: Object.freeze(["稿件适配", "叙事连贯", "逻辑清晰", "数量扩散", "风格一致", "对象可编辑", "失败可诊断", "资产可演进"]),
});

export function resolvePreviewParameters(base, selection) {
  const innerCount = Number(selection?.innerCount ?? 4);
  const outerCount = Number(selection?.outerCount ?? 6);
  if (![3, 4].includes(innerCount)) throw new Error("内圈能力数需要 3 或 4 项");
  if (![4, 6, 8].includes(outerCount)) throw new Error("共同结果数需要 4、6 或 8 项");
  const result = structuredClone(base);
  result.inner = result.inner.slice(0, innerCount);
  result.outer = result.outer.slice(0, outerCount);
  return result;
}
