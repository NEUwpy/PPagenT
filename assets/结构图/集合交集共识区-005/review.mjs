import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";
import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const COLORS = Object.freeze([
  Object.freeze({ highlight: "#5d88c1", surface: "#3f6fae", wall: "#315b96", base: "#244979" }),
  Object.freeze({ highlight: "#6891c7", surface: "#4b7ab7", wall: "#38649f", base: "#294f83" }),
  Object.freeze({ highlight: "#76a0d0", surface: "#5a86c0", wall: "#426da8", base: "#31588d" }),
  Object.freeze({ highlight: "#82a8d5", surface: "#688fc7", wall: "#4f78b0", base: "#3b6297" }),
  Object.freeze({ highlight: "#8eb1dc", surface: "#779bd0", wall: "#5b82b8", base: "#476ca0" }),
]);

const SCENE = Object.freeze({
  centerX: 585,
  centerY: 232,
  radiusX: 430,
  radiusY: 150,
  roll: 0,
  perspectiveScale: 0.12,
  podiumWidth: 205,
  podiumHeight: 58,
});
const START_ANGLES = Object.freeze({ 2: -78, 3: -138, 4: -168, 5: -114 });
const FIELD_SIZES = Object.freeze({
  2: Object.freeze({ width: 410, height: 164 }),
  3: Object.freeze({ width: 430, height: 154 }),
  4: Object.freeze({ width: 420, height: 158 }),
  5: Object.freeze({ width: 380, height: 148 }),
});

function centeredFieldFrame(count) {
  const size = FIELD_SIZES[count];
  return {
    left: SCENE.centerX - size.width / 2,
    top: SCENE.centerY - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) { return String(value ?? "").trim(); }
function pointRows(value) {
  return Array.isArray(value) ? value.map((item) => text(item?.text ?? item)).filter(Boolean) : [];
}

function normalizeItem(item, index) {
  const title = text(item?.title);
  const body = text(item?.body);
  const points = pointRows(item?.points);
  if (!title && !body && points.length === 0) throw new Error(`sets[${index}] 至少需要一项文字内容`);
  const key = text(item?.key) || `set-${index + 1}`;
  const iconQuery = text(item?.iconQuery);
  const icon = resolveTablerIcon(text(item?.iconKey) || iconQuery);
  return { key, title, body, points, iconQuery, icon };
}

function normalize(parameters) {
  const sets = Array.isArray(parameters?.sets) ? parameters.sets.map(normalizeItem) : [];
  if (sets.length < 2 || sets.length > 5) throw new Error("集合交集共识区要求 2–5 个主体");
  const shared = {
    title: text(parameters?.shared?.title),
    body: text(parameters?.shared?.body),
    points: pointRows(parameters?.shared?.points),
  };
  if (!shared.title && !shared.body && shared.points.length === 0) throw new Error("shared 至少需要一项内容");
  return { sets, shared, textLayoutBindings: parameters?.textLayoutBindings ?? {} };
}

function regionMarkup({ id, field, itemId, content, frame, className, textLayoutBindings, compatibleLayoutIds, defaultLayoutId = "heading-content-flow" }) {
  return textRegionMarkup({
    id,
    field,
    itemId,
    regionId: id,
    layoutId: String(textLayoutBindings?.[id] ?? defaultLayoutId),
    compatibleLayoutIds,
    content,
    className,
    align: "center",
    valign: "middle",
    density: "compact",
    names: { heading: `${id}-title`, body: `${id}-body`, list: `${id}-point` },
  }).replace(
    `class="ppagent-text-region ${className}"`,
    `class="ppagent-text-region ${className}" style="left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px"`,
  );
}

function projectScenePoint(angle) {
  const radians = angle * Math.PI / 180;
  const depth = Math.sin(radians);
  const scale = 1 + depth * SCENE.perspectiveScale;
  const planeX = Math.cos(radians) * SCENE.radiusX;
  const planeY = depth * SCENE.radiusY;
  const rollRadians = SCENE.roll * Math.PI / 180;
  const rotatedX = planeX * Math.cos(rollRadians) - planeY * Math.sin(rollRadians);
  const rotatedY = planeX * Math.sin(rollRadians) + planeY * Math.cos(rollRadians);
  return {
    x: SCENE.centerX + rotatedX,
    y: SCENE.centerY + rotatedY,
    depth,
    scale,
  };
}

function sceneActors(count) {
  const start = START_ANGLES[count];
  return Array.from({ length: count }, (_, index) => {
    const angle = start + index * 360 / count;
    const point = projectScenePoint(angle);
    const width = SCENE.podiumWidth * point.scale;
    const height = SCENE.podiumHeight * point.scale;
    return {
      angle,
      depth: point.depth,
      scale: point.scale,
      left: point.x - width / 2,
      top: point.y - height / 2,
      width,
      height,
    };
  });
}

function projectedArcPath(startAngle, endAngle) {
  const steps = 48;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = projectScenePoint(startAngle + (endAngle - startAngle) * index / steps);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

function orbitMarkup(count) {
  return `<svg class="consensus-orbit" viewBox="0 0 1170 492" aria-hidden="true">
    <path class="consensus-orbit-back" data-ppt-kind="path" data-ppt-name="consensus-orbit-back-${count}" d="${projectedArcPath(180, 360)}"></path>
    <path class="consensus-orbit-front" data-ppt-kind="path" data-ppt-name="consensus-orbit-front-${count}" d="${projectedArcPath(0, 180)}"></path>
  </svg>`;
}

function iconSvg(item, index, layer) {
  if (!item.icon) {
    return `<i class="actor-icon-fallback" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="actor-icon-fallback-${index}"></i>`;
  }
  return tablerIconSvgMarkup(item.icon, {
    name: `actor-icon-${layer}-${index}`,
    className: `actor-icon-svg actor-icon-svg--${layer}`,
  });
}

function actorMarkup(item, frame, index, count, textLayoutBindings) {
  const color = COLORS[index];
  const iconSize = Math.max(50, Math.min(66, Math.round(frame.width * 0.3)));
  const iconLeft = Math.round(frame.left + frame.width / 2 - iconSize / 2);
  const iconTop = Math.round(frame.top - iconSize + 10);
  const copyWidth = Math.max(190, Math.min(240, frame.width + 12));
  const copyLeft = Math.round(frame.left + frame.width / 2 - copyWidth / 2);
  const copyTop = frame.top + frame.height + 10;
  const copyHeight = count === 5 ? 58 : 62;
  const content = { title: item.title, body: item.body, points: item.points };
  const baseShift = 3;
  const surfaceTransform = `transform:rotate(${SCENE.roll}deg);transform-origin:50% 50%`;
  const baseTransform = surfaceTransform;
  return `<article class="actor-node" data-actor-index="${index}" style="--actor-highlight:${color.highlight};--actor-surface:${color.surface};--actor-wall:${color.wall};--actor-base:${color.base}">
    <div class="actor-base" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="actor-base-${index}" style="left:${frame.left + baseShift}px;top:${frame.top + 11}px;width:${frame.width}px;height:${frame.height}px;${baseTransform}"></div>
    <div class="actor-surface" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="actor-surface-${index}" style="left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px;${surfaceTransform}"></div>
    <div class="actor-surface-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="actor-surface-ring-${index}" style="left:${frame.left + 9}px;top:${frame.top + 7}px;width:${frame.width - 18}px;height:${frame.height - 14}px;${surfaceTransform}"></div>
    <div class="actor-icon-depth" aria-hidden="true" style="left:${iconLeft + 2}px;top:${iconTop + 2}px;width:${iconSize}px;height:${iconSize}px">${iconSvg(item, index, "depth")}</div>
    <div class="actor-icon-slot" data-slot-id="${escapeHtml(item.key)}-icon" data-slot-role="icon" data-slot-field="sets[${index}].iconKey" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="icon" data-slot-provider="tabler-icons" data-slot-required="true" style="left:${iconLeft}px;top:${iconTop}px;width:${iconSize}px;height:${iconSize}px">${iconSvg(item, index, "front")}</div>
    <div class="actor-icon-foot" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="actor-icon-foot-${index}" style="left:${frame.left + frame.width / 2 - 29}px;top:${frame.top + 15}px;width:58px;height:18px"></div>
    ${regionMarkup({
      id: `set-${item.key}`,
      field: `sets[${index}]`,
      itemId: item.key,
      content,
      frame: { left: copyLeft, top: copyTop, width: copyWidth, height: copyHeight },
      className: "actor-copy",
      textLayoutBindings,
      compatibleLayoutIds: ["statement-flow", "heading-content-flow", "structured-list-flow"],
    })}
  </article>`;
}

function sharedFieldMarkup(shared, frame, textLayoutBindings) {
  const content = shared.points.length
    ? { title: shared.title, body: shared.body, items: shared.points.map((point) => ({ title: point })) }
    : shared;
  const contentFrame = {
    left: frame.left + Math.round(frame.width * 0.11),
    top: frame.top + Math.round(frame.height * 0.17),
    width: Math.round(frame.width * 0.78),
    height: Math.round(frame.height * 0.66),
  };
  const fieldTransform = `transform:rotate(${SCENE.roll}deg);transform-origin:50% 50%`;
  let sharedItemIndex = 0;
  const sharedRegion = regionMarkup({
    id: "shared-consensus",
    field: "shared",
    itemId: "shared",
    content,
    frame: contentFrame,
    className: "shared-copy",
    textLayoutBindings,
    compatibleLayoutIds: ["statement-flow", "heading-content-flow", "structured-list-flow", "metric-content-flow"],
    defaultLayoutId: shared.points.length ? "structured-list-flow" : "heading-content-flow",
  }).replace(/<div class="ppagent-structured-list__item">/g, () => (
    `<div class="ppagent-structured-list__item" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="shared-consensus-item-${sharedItemIndex++}-surface">`
  ));
  return `<div class="field-base" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="consensus-field-base" style="left:${frame.left + 3}px;top:${frame.top + 10}px;width:${frame.width}px;height:${frame.height}px;${fieldTransform}"></div>
    <div class="field-outer" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="consensus-field-outer" style="left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px;${fieldTransform}"></div>
    <div class="field-inner" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="consensus-field-inner" style="left:${frame.left + 15}px;top:${frame.top + 14}px;width:${frame.width - 30}px;height:${frame.height - 28}px;${fieldTransform}"></div>
    ${sharedRegion}`;
}

export const visualComponent = Object.freeze({
  id: "containment-consensus-field",
  schemaVersion: 8,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const count = model.sets.length;
    const actors = sceneActors(count);
    const field = centeredFieldFrame(count);
    return `<section class="consensus-review" data-ppt-root data-set-count="${count}">
      ${orbitMarkup(count)}
      ${sharedFieldMarkup(model.shared, field, model.textLayoutBindings)}
      ${model.sets.map((item, index) => actorMarkup(item, actors[index], index, count, model.textLayoutBindings)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  sets: Object.freeze([
    Object.freeze({ key: "content", title: "内容需求", body: "事实准确 · 叙事清楚", iconQuery: "file text" }),
    Object.freeze({ key: "visual", title: "视觉能力", body: "结构可靠 · 容量适配", iconQuery: "palette design" }),
    Object.freeze({ key: "delivery", title: "交付约束", body: "原生可编 · 稳定一致", iconQuery: "file check" }),
    Object.freeze({ key: "scenario", title: "使用场景", body: "边界明确 · 需求稳定", iconQuery: "target focus" }),
    Object.freeze({ key: "governance", title: "治理要求", body: "标准统一 · 过程可控", iconQuery: "shield check" }),
  ]),
  shared: Object.freeze({
    title: "共同要求",
    points: Object.freeze(["内容准确", "结构清楚", "稳定可编"]),
  }),
});

export function resolvePreviewParameters(base, selection) {
  const setCount = Number(selection?.setCount ?? 3);
  if (!Number.isInteger(setCount) || setCount < 2 || setCount > 5) throw new Error("主体数支持 2–5");
  const resolved = structuredClone(base);
  resolved.sets = resolved.sets.slice(0, setCount);
  return resolved;
}
