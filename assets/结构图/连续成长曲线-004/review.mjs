import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });
const MIN_POINTS = 3;
const MAX_POINTS = 6;

function normalize(parameters) {
  const points = Array.isArray(parameters?.points) ? parameters.points : [];
  if (points.length < MIN_POINTS || points.length > MAX_POINTS) throw new Error("山路递进支持 3–6 个里程点");
  return points.map((point, index) => {
    const title = String(point?.title ?? "").trim();
    const body = String(point?.body ?? "").trim();
    if (!title) throw new Error(`points[${index}].title 不能为空`);
    return { key: String(point?.key ?? `point-${index + 1}`), title, body };
  });
}

function pointAt(index, count) {
  const t = count === 1 ? 0 : index / (count - 1);
  return {
    x: 118 + 900 * t + 45 * Math.sin(3 * Math.PI * t),
    y: 407 - 297 * t - 22 * Math.sin(Math.PI * t),
  };
}

function interpolate(from, to, ratio) {
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function pointsAttribute(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function mountainMarkup(peaks) {
  const baseY = 460;
  const leftEdge = { x: 28, y: baseY };
  const rightEdge = { x: 1138, y: baseY };
  const valleys = peaks.slice(0, -1).map((peak, index) => {
    const next = peaks[index + 1];
    return {
      x: (peak.x + next.x) / 2,
      y: Math.min(baseY - 24, (peak.y + next.y) / 2 + 72),
    };
  });

  return peaks.map((peak, index) => {
    const left = index === 0 ? leftEdge : valleys[index - 1];
    const right = index === peaks.length - 1 ? rightEdge : valleys[index];
    const baseLeft = index === 0 ? leftEdge : { x: valleys[index - 1].x, y: baseY };
    const baseRight = index === peaks.length - 1 ? rightEdge : { x: valleys[index].x, y: baseY };
    const split = {
      x: peak.x + (index % 2 === 0 ? 18 : -18),
      y: peak.y + (baseY - peak.y) * (0.48 + (index % 3) * 0.035),
    };
    const leftShoulder = interpolate(peak, left, 0.34);
    const rightShoulder = interpolate(peak, right, 0.31);
    const capCenter = {
      x: peak.x + (index % 2 === 0 ? 4 : -5),
      y: peak.y + Math.min(34, (baseY - peak.y) * 0.18),
    };
    const tone = index % 5;

    return `<g class="mountain-cell mountain-cell--${tone}">
      <polygon class="facet facet-left" points="${pointsAttribute([left, peak, split, baseLeft])}"/>
      <polygon class="facet facet-right" points="${pointsAttribute([peak, right, baseRight, split])}"/>
      <polygon class="facet facet-lower" points="${pointsAttribute([baseLeft, split, baseRight])}"/>
      <polygon class="facet facet-cap" points="${pointsAttribute([peak, rightShoulder, capCenter, leftShoulder])}"/>
      <polyline class="ridge-seam" points="${pointsAttribute([leftShoulder, peak, rightShoulder])}"/>
    </g>`;
  }).join("");
}

function labelMarkup(point, index, count, position) {
  const isLast = index === count - 1;
  const isCrowdedPenultimate = count === 6 && index === count - 2;
  const left = isLast
    ? Math.max(12, position.x - 180)
    : isCrowdedPenultimate
      ? Math.max(12, position.x - 195)
      : Math.max(12, Math.min(990, position.x - 80));
  const top = Math.max(5, position.y - 94);
  return `${textRegionMarkup({
    id: `${point.key}-text`, field: `points[${index}]`, itemId: point.key, regionId: `milestone-${index + 1}`,
    layoutId: "heading-content-flow",
    compatibleLayoutIds: ["statement-flow", "heading-content-flow"], content: { heading: point.title, body: point.body },
    className: `milestone-copy${isLast ? " milestone-copy--last" : ""}`, align: "left", valign: "bottom", density: "compact", tone: "dark",
  }).replace(`class="ppagent-text-region milestone-copy${isLast ? " milestone-copy--last" : ""}"`, `class="ppagent-text-region milestone-copy${isLast ? " milestone-copy--last" : ""}" style="left:${left}px;top:${top}px"`)}
  <div class="milestone-node" style="left:${position.x - 20}px;top:${position.y - 20}px">${String(index + 1).padStart(2, "0")}</div>`;
}

function routePath(points) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    path += ` C ${midX - 28} ${previous.y - 22}, ${midX + 28} ${current.y + 20}, ${current.x} ${current.y}`;
  }
  return path;
}

export const visualComponent = Object.freeze({
  id: "progression-growth-curve", schemaVersion: 5, designFrame: FRAME, cssFile: "component.css",
  textCapacity: { maxHeadingChars: 10, maxBodyChars: 22, maxBodyLines: 2 },
  renderMarkup(parameters) {
    const points = normalize(parameters);
    const positions = points.map((_, index) => pointAt(index, points.length));
    const route = routePath(positions);
    return `<section class="mountain-progress" data-ppt-root data-point-count="${points.length}"><svg class="mountain-art" viewBox="0 0 1170 492" aria-hidden="true"><defs><linearGradient id="mountain-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fafc"/><stop offset="1" stop-color="#edf3f7"/></linearGradient></defs><rect width="1170" height="492" fill="url(#mountain-sky)" rx="22"/>${mountainMarkup(positions)}<path class="route-shadow" d="${route}"/><path class="route-line" d="${route}"/></svg>${points.map((point, index) => labelMarkup(point, index, points.length, positions[index])).join("")}<div class="summit-mark" style="left:${positions.at(-1).x - 6}px;top:${positions.at(-1).y - 56}px"><span></span></div></section>`;
  },
});

export const previewParameters = Object.freeze({ points: [
  { key: "p1", title: "立足", body: "明确起点与基本边界" }, { key: "p2", title: "积累", body: "形成可复用的方法基础" },
  { key: "p3", title: "突破", body: "跨越关键能力瓶颈" }, { key: "p4", title: "协同", body: "让多项能力共同发力" },
  { key: "p5", title: "跃升", body: "实现质量与效率提升" }, { key: "p6", title: "引领", body: "沉淀可持续领先优势" },
] });

export function resolvePreviewParameters(base, selection) {
  const pointCount = Number(selection?.pointCount ?? 5);
  if (pointCount < MIN_POINTS || pointCount > MAX_POINTS) throw new Error("支持 3–6 个里程点");
  const result = structuredClone(base);
  result.points = result.points.slice(0, pointCount);
  return result;
}
