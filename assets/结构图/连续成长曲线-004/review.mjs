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

function pointsAttribute(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function interpolate(from, to, ratio) {
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function mountainMarkup(peaks) {
  const baseY = 460;
  const leftEdge = { x: 28, y: baseY };
  const rightEdge = { x: 1138, y: baseY };
  const profiles = [
    { left: .31, right: .29, leftDrop: .27, rightDrop: .23, valley: .50, split: .46 },
    { left: .27, right: .34, leftDrop: .20, rightDrop: .29, valley: .46, split: .55 },
    { left: .34, right: .27, leftDrop: .39, rightDrop: .32, valley: .53, split: .43 },
    { left: .28, right: .35, leftDrop: .24, rightDrop: .31, valley: .48, split: .58 },
    { left: .33, right: .26, leftDrop: .37, rightDrop: .29, valley: .52, split: .45 },
    { left: .28, right: .31, leftDrop: .31, rightDrop: .25, valley: .47, split: .54 },
  ];
  const shoulders = peaks.map((peak, index) => {
    const previousX = index === 0 ? leftEdge.x : peaks[index - 1].x;
    const nextX = index === peaks.length - 1 ? rightEdge.x : peaks[index + 1].x;
    const profile = profiles[index];
    return {
      left: {
        x: peak.x - (peak.x - previousX) * profile.left,
        y: peak.y + (baseY - peak.y) * profile.leftDrop,
      },
      right: {
        x: peak.x + (nextX - peak.x) * profile.right,
        y: peak.y + (baseY - peak.y) * profile.rightDrop,
      },
    };
  });
  const ridge = [leftEdge];
  peaks.forEach((peak, index) => {
    ridge.push(shoulders[index].left, peak, shoulders[index].right);
    if (index >= peaks.length - 1) return;
    const nextLeft = shoulders[index + 1].left;
    const profile = profiles[index];
    ridge.push({
      x: shoulders[index].right.x + (nextLeft.x - shoulders[index].right.x) * profile.valley,
      y: Math.min(baseY - 18, Math.max(shoulders[index].right.y, nextLeft.y) + 17 + (index % 2) * 5),
    });
  });
  ridge.push(rightEdge);
  const silhouette = [...ridge, rightEdge, leftEdge];
  const lightTones = ["#dce7ec", "#d1dfe5", "#c7d8df", "#d4e2e8", "#bfd2db", "#c9d9e1"];
  const detailTones = ["#ccdce3", "#c0d2da", "#afc3cd", "#bfd1d9", "#a3bbc7", "#adc4ce"];
  const shadeTones = ["#b7cbd5", "#a9c0cc", "#9fb8c5", "#aec4cf", "#91aebb", "#9cb7c4"];
  const detailSides = ["none", "left", "right", "left", "right", "left"];
  const facets = [];
  peaks.forEach((peak, index) => {
    const leftRidgeIndex = index === 0 ? 0 : index * 4;
    const peakRidgeIndex = index * 4 + 2;
    const rightRidgeIndex = index === peaks.length - 1 ? ridge.length - 1 : index * 4 + 4;
    const leftBoundary = ridge[leftRidgeIndex];
    const rightBoundary = ridge[rightRidgeIndex];
    const profile = profiles[index];
    const splitAnchor = {
      x: leftBoundary.x + (rightBoundary.x - leftBoundary.x) * profile.split,
      y: baseY - 8 - (index % 3) * 8,
    };
    const leftBase = { x: leftBoundary.x, y: baseY };
    const rightBase = { x: rightBoundary.x, y: baseY };
    const leftFace = [leftBase, ...ridge.slice(leftRidgeIndex, peakRidgeIndex + 1), splitAnchor];
    const rightFace = [splitAnchor, ...ridge.slice(peakRidgeIndex, rightRidgeIndex + 1), rightBase];
    facets.push(`<polygon class="facet mountain-face mountain-face--light" fill="${lightTones[index]}" points="${pointsAttribute(leftFace)}" data-ppt-kind="path" data-ppt-name="mountain-${index + 1}-light-face"/>`);
    facets.push(`<polygon class="facet mountain-face mountain-face--shade" fill="${shadeTones[index]}" points="${pointsAttribute(rightFace)}" data-ppt-kind="path" data-ppt-name="mountain-${index + 1}-shade-face"/>`);

    const detailSide = detailSides[index];
    const seamMid = interpolate(peak, splitAnchor, .52 + (index % 3) * .07);
    if (detailSide === "left") {
      const detailFace = [leftBase, leftBoundary, shoulders[index].left, seamMid, splitAnchor];
      facets.push(`<polygon class="facet mountain-face mountain-face--detail" fill="${detailTones[index]}" points="${pointsAttribute(detailFace)}" data-ppt-kind="path" data-ppt-name="mountain-${index + 1}-slope-detail"/>`);
    } else if (detailSide === "right") {
      const detailFace = [splitAnchor, seamMid, shoulders[index].right, rightBoundary, rightBase];
      facets.push(`<polygon class="facet mountain-face mountain-face--detail" fill="${detailTones[index]}" points="${pointsAttribute(detailFace)}" data-ppt-kind="path" data-ppt-name="mountain-${index + 1}-slope-detail"/>`);
    }
  });

  const finalPeak = peaks.at(-1);
  const finalShoulders = shoulders.at(-1);
  const snowLeftEdge = interpolate(finalPeak, finalShoulders.left, .39);
  const snowRightEdge = interpolate(finalPeak, finalShoulders.right, .40);
  const snowDivide = { x: finalPeak.x + 5, y: finalPeak.y + 48 };
  const snowLeftNotch = { x: finalPeak.x - 18, y: finalPeak.y + 51 };
  const snowRightNotch = { x: finalPeak.x + 22, y: finalPeak.y + 55 };
  const snow = `<polygon class="snow-face snow-face--light" points="${pointsAttribute([finalPeak, snowLeftEdge, snowLeftNotch, snowDivide])}" data-ppt-kind="path" data-ppt-name="summit-snow-light"/>
    <polygon class="snow-face snow-face--shade" points="${pointsAttribute([finalPeak, snowDivide, snowRightNotch, snowRightEdge])}" data-ppt-kind="path" data-ppt-name="summit-snow-shade"/>`;
  const foreground = [
    { x: leftEdge.x, y: baseY },
    { x: peaks[Math.max(0, peaks.length - 3)].x - 42, y: baseY - 18 },
    { x: peaks[Math.max(0, peaks.length - 2)].x + 18, y: baseY - 54 },
    { x: rightEdge.x, y: baseY - 16 },
    rightEdge,
  ];

  return `<polygon class="mountain-base" points="${pointsAttribute(silhouette)}" data-ppt-kind="path" data-ppt-name="mountain-silhouette-base"/>
    ${facets.join("")}
    <polygon class="foreground-plane" points="${pointsAttribute(foreground)}" data-ppt-kind="path" data-ppt-name="mountain-foreground-plane"/>
    ${snow}
    <polyline class="ridge-seam" points="${pointsAttribute(ridge)}" data-ppt-kind="path" data-ppt-name="mountain-ridge-outline"/>`;
}

function labelMarkup(point, index, count, position) {
  const isLast = index === count - 1;
  const isPenultimate = count >= 5 && index === count - 2;
  const left = isLast
    ? Math.max(12, position.x - 170)
    : isPenultimate
      ? Math.max(12, position.x - 174)
      : Math.max(12, Math.min(990, position.x - 80));
  const top = isLast
    ? Math.max(24, position.y - 80)
    : isPenultimate
      ? Math.min(FRAME.height - 82, position.y - 50)
      : Math.max(5, position.y - 94);
  return `${textRegionMarkup({
    id: `${point.key}-text`, field: `points[${index}]`, itemId: point.key, regionId: `milestone-${index + 1}`,
    layoutId: "heading-content-flow",
    compatibleLayoutIds: ["statement-flow", "heading-content-flow"], content: { heading: point.title, body: point.body },
    className: `milestone-copy${isLast ? " milestone-copy--last" : ""}`, align: "left", valign: "bottom", density: "compact", tone: "dark",
  }).replace(`class="ppagent-text-region milestone-copy${isLast ? " milestone-copy--last" : ""}"`, `class="ppagent-text-region milestone-copy${isLast ? " milestone-copy--last" : ""}" style="left:${left}px;top:${top}px"`)}
  <div class="milestone-node" style="left:${position.x - 20}px;top:${position.y - 20}px" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="mountain-milestone-${index + 1}">${String(index + 1).padStart(2, "0")}</div>`;
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
    const summit = positions.at(-1);
    const flag = `<line class="summit-pole" x1="${summit.x}" y1="${summit.y - 54}" x2="${summit.x}" y2="${summit.y + 3}" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="summit-flag-pole"/><polygon class="summit-flag" points="${summit.x},${summit.y - 54} ${summit.x + 32},${summit.y - 45} ${summit.x},${summit.y - 36}" data-ppt-kind="path" data-ppt-name="summit-flag"/>`;
    return `<section class="mountain-progress" data-ppt-root data-point-count="${points.length}"><svg class="mountain-art" viewBox="0 0 1170 492" aria-hidden="true">${mountainMarkup(positions)}${flag}<path class="route-shadow" d="${route}" data-ppt-kind="path" data-ppt-name="mountain-route-halo"/><path class="route-line" d="${route}" data-ppt-kind="path" data-ppt-name="mountain-route"/></svg>${points.map((point, index) => labelMarkup(point, index, points.length, positions[index])).join("")}</section>`;
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
