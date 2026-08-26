const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const CENTER = Object.freeze({ x: 585, y: 246 });
const PLANE_ROTATION = -5 * Math.PI / 180;
const INNER_ORBIT = Object.freeze({ rx: 260, ry: 125 });
const OUTER_ORBIT = Object.freeze({ rx: 414, ry: 160 });
const INNER_TONES = Object.freeze(["#315f89", "#3f7099", "#4f80a6", "#638fac"]);
const OUTER_TONES = Object.freeze(["#6f99b5", "#7fa6be", "#8fb2c7", "#a0bed0", "#adc8d7", "#b9d1dd", "#9ab9cb", "#88adc3"]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value, max, field) {
  const result = String(value ?? "").trim();
  if (!result || [...result].length > max) throw new Error(`${field} 超出容量`);
  return result;
}

function list(value, min, max, field) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${field} 需要 ${min}–${max} 项`);
  return value;
}

function optionalOuterList(value) {
  if (!Array.isArray(value) || (value.length !== 0 && (value.length < 3 || value.length > 8))) {
    throw new Error("outer 需要 0 项或 3–8 项");
  }
  return value;
}

function normalize(parameters) {
  return {
    center: text(parameters?.center, 18, "center"),
    inner: list(parameters?.inner, 3, 5, "inner").map((value, index) => text(value, 9, `inner[${index}]`)),
    outer: optionalOuterList(parameters?.outer).map((value, index) => text(value, 10, `outer[${index}]`)),
  };
}

function project(angle, orbit) {
  const x0 = orbit.rx * Math.cos(angle);
  const y0 = orbit.ry * Math.sin(angle);
  return {
    x: CENTER.x + x0 * Math.cos(PLANE_ROTATION) - y0 * Math.sin(PLANE_ROTATION),
    y: CENTER.y + x0 * Math.sin(PLANE_ROTATION) + y0 * Math.cos(PLANE_ROTATION),
    depth: Math.sin(angle),
  };
}

function angleSeries(count, tier) {
  const offset = tier === "inner"
    ? (count === 3 ? -Math.PI / 2 : -Math.PI / 4)
    : (count === 4 ? -Math.PI / 4 : -Math.PI / 2 + Math.PI / count);
  return Array.from({ length: count }, (_, index) => offset + index * (Math.PI * 2 / count));
}

function orbitNodes(values, tier, angles = angleSeries(values.length, tier)) {
  const orbit = tier === "inner" ? INNER_ORBIT : OUTER_ORBIT;
  const baseRadius = tier === "inner" ? 42 : 25;
  return angles.map((angle, index) => {
    const point = project(angle, orbit);
    const radius = baseRadius * (0.9 + (point.depth + 1) * 0.08);
    return { ...point, angle, index, value: values[index], radius, tier };
  });
}

function optimizedOuterAngles(count, innerNodes) {
  if (!count) return [];
  const period = Math.PI * 2 / count;
  let best = null;
  for (let step = 0; step < 48; step += 1) {
    const offset = -Math.PI / 2 + period * step / 48;
    const angles = Array.from({ length: count }, (_, index) => offset + index * period);
    const points = angles.map((angle) => project(angle, OUTER_ORBIT));
    const clearance = Math.min(...points.flatMap((outerPoint) => innerNodes.map((innerPoint) => (
      Math.hypot(outerPoint.x - innerPoint.x, outerPoint.y - innerPoint.y)
    ))));
    if (!best || clearance > best.clearance) best = { angles, clearance };
  }
  return best.angles;
}

function orbitPath(orbit, start, end, steps = 56) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = project(start + (end - start) * index / steps, orbit);
    return `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" ");
}

function labelRegion({ id, field, value, className, name, maxChars, maxLines = 2 }) {
  return `<div class="${className}"
    data-slot-id="${id}" data-slot-role="label" data-slot-field="${field}"
    data-slot-item-id="${id}" data-slot-content-type="text" data-slot-required="true"
    data-slot-text-mode="flow" data-slot-list-policy="none"
    data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}"
    data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="${name}">${escapeHtml(value)}</div>`;
}

function planetMarkup(node) {
  const tones = node.tier === "inner" ? INNER_TONES : OUTER_TONES;
  const fill = tones[node.index % tones.length];
  const dark = node.tier === "inner" ? "#244f76" : "#628ba7";
  const highlightRadius = Math.max(4, node.radius * 0.2);
  return `<g class="planet planet--${node.tier}" data-depth="${node.depth.toFixed(3)}">
    <ellipse class="planet-depth" cx="${(node.x + 2.8).toFixed(1)}" cy="${(node.y + 4.2).toFixed(1)}" rx="${node.radius.toFixed(1)}" ry="${(node.radius * 0.92).toFixed(1)}" fill="${dark}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-${node.tier}-node-${node.index + 1}-depth"></ellipse>
    <circle class="planet-body" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.radius.toFixed(1)}" fill="${fill}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-${node.tier}-node-${node.index + 1}"></circle>
    <circle class="planet-highlight" cx="${(node.x - node.radius * 0.28).toFixed(1)}" cy="${(node.y - node.radius * 0.3).toFixed(1)}" r="${highlightRadius.toFixed(1)}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-${node.tier}-node-${node.index + 1}-highlight"></circle>
  </g>`;
}

function outerLabelFrame(node) {
  const dx = node.x - CENTER.x;
  const dy = node.y - CENTER.y;
  const length = Math.hypot(dx, dy) || 1;
  const anchorX = node.x + dx / length * 78;
  const anchorY = node.y + dy / length * 64;
  const width = 124;
  const height = 42;
  return {
    left: Math.max(4, Math.min(DESIGN_FRAME.width - width - 4, anchorX - width / 2)),
    top: Math.max(2, Math.min(DESIGN_FRAME.height - height - 2, anchorY - height / 2)),
    width, height,
  };
}

function innerLabelFrame(node) {
  const size = node.radius * 2;
  return { left: node.x - size / 2, top: node.y - size / 2, width: size, height: size };
}

function nodeLabels(model, inner, outer) {
  return `${inner.map((node) => {
    const frame = innerLabelFrame(node);
    return `<div class="inner-label" style="left:${frame.left.toFixed(1)}px;top:${frame.top.toFixed(1)}px;width:${frame.width.toFixed(1)}px;height:${frame.height.toFixed(1)}px">${labelRegion({ id: `ecology-inner-${node.index}`, field: `inner[${node.index}]`, value: model.inner[node.index], className: "inner-region", name: `ecology-inner-${node.index}-title`, maxChars: 9, maxLines: 3 })}</div>`;
  }).join("")}
  ${outer.map((node) => {
    const frame = outerLabelFrame(node);
    return `<div class="outer-label" style="left:${frame.left.toFixed(1)}px;top:${frame.top.toFixed(1)}px;width:${frame.width}px;height:${frame.height}px">${labelRegion({ id: `ecology-outer-${node.index}`, field: `outer[${node.index}]`, value: model.outer[node.index], className: "outer-region", name: `ecology-outer-${node.index}-title`, maxChars: 10 })}</div>`;
  }).join("")}`;
}

export const visualComponent = Object.freeze({
  id: "hub-two-tier-capabilities-004",
  schemaVersion: 8,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const inner = orbitNodes(model.inner, "inner");
    const outer = orbitNodes(model.outer, "outer", optimizedOuterAngles(model.outer.length, inner));
    const hasOuter = outer.length > 0;
    const allNodes = [...outer, ...inner];
    const backNodes = allNodes.filter((node) => node.depth < 0).sort((a, b) => a.y - b.y);
    const frontNodes = allNodes.filter((node) => node.depth >= 0).sort((a, b) => a.y - b.y);
    return `<section class="two-tier-review" data-ppt-root data-inner-count="${model.inner.length}" data-outer-count="${model.outer.length}">
      <svg viewBox="0 0 1170 492" aria-hidden="true">
        ${hasOuter ? `<path class="orbit orbit--outer orbit--back" d="${orbitPath(OUTER_ORBIT, Math.PI, Math.PI * 2)}" data-ppt-kind="path" data-ppt-name="ecology-secondary-orbit-back"></path>` : ""}
        <path class="orbit orbit--inner orbit--back" d="${orbitPath(INNER_ORBIT, Math.PI, Math.PI * 2)}" data-ppt-kind="path" data-ppt-name="ecology-primary-orbit-back"></path>
        ${backNodes.map(planetMarkup).join("")}
        <ellipse class="core-depth" cx="590" cy="253" rx="82" ry="76" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-depth"></ellipse>
        <circle class="core-disc" cx="585" cy="246" r="76" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-disc"></circle>
        <circle class="core-highlight" cx="562" cy="220" r="14" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-highlight"></circle>
        ${hasOuter ? `<path class="orbit orbit--outer orbit--front" d="${orbitPath(OUTER_ORBIT, 0, Math.PI)}" data-ppt-kind="path" data-ppt-name="ecology-secondary-orbit-front"></path>` : ""}
        <path class="orbit orbit--inner orbit--front" d="${orbitPath(INNER_ORBIT, 0, Math.PI)}" data-ppt-kind="path" data-ppt-name="ecology-primary-orbit-front"></path>
        ${frontNodes.map(planetMarkup).join("")}
      </svg>
      ${hasOuter ? `<span class="tier-caption-line tier-caption-line--outer" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="ecology-outer-caption-line"></span><div class="tier-caption tier-caption--outer" data-ppt-kind="text" data-ppt-name="ecology-outer-caption">共同结果轨道</div>` : ""}
      <span class="tier-caption-line tier-caption-line--inner" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="ecology-inner-caption-line"></span><div class="tier-caption tier-caption--inner" data-ppt-kind="text" data-ppt-name="ecology-inner-caption">直接能力轨道</div>
      ${labelRegion({ id: "ecology-center", field: "center", value: model.center, className: "core-region", name: "ecology-center-title", maxChars: 18 })}
      ${nodeLabels(model, inner, outer)}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  center: "可靠 PPTX 生成",
  inner: Object.freeze(["内容理解", "结构选择", "响应布局", "原生编译", "质量校验"]),
  outer: Object.freeze(["稿件适配", "叙事连贯", "逻辑清晰", "数量扩散", "风格一致", "对象可编辑", "失败可诊断", "资产可演进"]),
});

export function resolvePreviewParameters(base, selection) {
  const innerCount = Number(selection?.innerCount ?? 4);
  const outerCount = Number(selection?.outerCount ?? 6);
  if (![3, 4, 5].includes(innerCount)) throw new Error("内圈能力数需要 3–5 项");
  if (![0, 3, 4, 5, 6, 7, 8].includes(outerCount)) throw new Error("共同结果数需要 0 项或 3–8 项");
  const result = structuredClone(base);
  result.inner = result.inner.slice(0, innerCount);
  result.outer = result.outer.slice(0, outerCount);
  return result;
}
