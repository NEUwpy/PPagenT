import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });
const MIN_LEVELS = 3;
const MAX_LEVELS = 6;
const TOP_COLORS = ["#c8d9e3", "#adc6d5", "#91b1c5", "#7398b1", "#557f9f", "#3d698b"];
const RISER_COLORS = ["#9db7c7", "#84a5b9", "#6b91aa", "#537b99", "#3f6687", "#315775"];
const VANISHING_POINT = Object.freeze({ x: 1350, y: 28 });
const DEPTH_RATIO = 0.062;

function normalize(parameters) {
  const levels = Array.isArray(parameters?.levels) ? parameters.levels : [];
  if (levels.length < MIN_LEVELS || levels.length > MAX_LEVELS) throw new Error("成熟度能力阶梯支持 3–6 级");
  const normalized = levels.map((level, index) => {
    const title = String(level?.title ?? "").trim();
    const body = String(level?.body ?? "").trim();
    if (!title) throw new Error(`levels[${index}].title 不能为空`);
    return { key: String(level?.key ?? `level-${index + 1}`), title, body };
  });
  const showGap = Boolean(parameters?.showGap);
  const currentIndex = Math.max(0, Math.min(normalized.length - 2, Number(parameters?.currentIndex ?? 1)));
  const targetIndex = Math.max(currentIndex + 1, Math.min(normalized.length - 1, Number(parameters?.targetIndex ?? normalized.length - 1)));
  return { levels: normalized, showGap, currentIndex, targetIndex };
}

function projectDepth(point) {
  return {
    x: point.x + (VANISHING_POINT.x - point.x) * DEPTH_RATIO,
    y: point.y + (VANISHING_POINT.y - point.y) * DEPTH_RATIO,
  };
}

function pointsAttribute(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function solveLayout(count) {
  const startX = 54;
  const endX = 1042;
  const baseY = 430;
  const riseByCount = { 3: 74, 4: 62, 5: 54, 6: 45 };
  const rise = riseByCount[count];
  const treadWidth = (endX - startX) / count;
  const steps = Array.from({ length: count }, (_, index) => {
    const y = baseY - index * rise;
    const frontLeft = { x: startX + index * treadWidth, y };
    const frontRight = { x: frontLeft.x + treadWidth, y };
    const backLeft = projectDepth(frontLeft);
    const backRight = projectDepth(frontRight);
    const top = [frontLeft, frontRight, backRight, backLeft];
    return { index, frontLeft, frontRight, backLeft, backRight, top, center: averagePoint(top) };
  });
  return { steps, rise, treadWidth };
}

function staircaseMarkup(layout) {
  const { steps } = layout;
  return steps.map((step, index) => {
    const next = steps[index + 1];
    const riser = next
      ? [step.frontRight, next.frontLeft, next.backLeft, step.backRight]
      : [step.frontRight, { x: step.frontRight.x, y: step.frontRight.y + 18 }, { x: step.backRight.x, y: step.backRight.y + 18 }, step.backRight];
    const insetFrontLeft = { x: step.frontLeft.x + 13, y: step.frontLeft.y };
    const insetFrontRight = { x: step.frontRight.x - 13, y: step.frontRight.y };
    const insetBackLeft = projectDepth(insetFrontLeft);
    const insetBackRight = projectDepth(insetFrontRight);
    return `<g class="perspective-step perspective-step--${index}">
      <polygon class="step-riser" style="--riser:${RISER_COLORS[index]}" points="${pointsAttribute(riser)}"/>
      <polygon class="step-top" style="--top:${TOP_COLORS[index]}" points="${pointsAttribute(step.top)}"/>
      <polyline class="step-inset" points="${pointsAttribute([insetFrontLeft, insetFrontRight, insetBackRight])}"/>
      <line class="projection-edge" x1="${insetBackLeft.x.toFixed(1)}" y1="${insetBackLeft.y.toFixed(1)}" x2="${insetBackRight.x.toFixed(1)}" y2="${insetBackRight.y.toFixed(1)}"/>
    </g>`;
  }).join("");
}

function levelMarkup(level, index, layout) {
  const step = layout.steps[index];
  const copyWidth = layout.steps.length === 6 ? 148 : 158;
  const left = Math.max(10, Math.min(FRAME.width - copyWidth - 10, step.center.x - copyWidth / 2));
  const top = Math.max(8, step.center.y - 108);
  return `${textRegionMarkup({
    id: `${level.key}-text`, field: `levels[${index}]`, itemId: level.key, regionId: `level-${index + 1}`,
    layoutId: "heading-content-flow",
    compatibleLayoutIds: ["statement-flow", "heading-content-flow"],
    content: { heading: level.title, body: level.body }, className: "level-copy",
    align: "left", valign: "bottom", density: "compact",
  }).replace('class="ppagent-text-region level-copy"', `class="ppagent-text-region level-copy" style="left:${left}px;top:${top}px;width:${copyWidth}px"`)}
  <div class="level-index" style="left:${step.center.x - 21}px;top:${step.center.y - 21}px">${String(index + 1).padStart(2, "0")}</div>`;
}

function gapPath(layout, currentIndex, targetIndex) {
  const offsetY = 38;
  const current = layout.steps[currentIndex];
  const target = layout.steps[targetIndex];
  const points = [{ x: current.center.x, y: current.frontLeft.y + offsetY }];
  for (let index = currentIndex; index < targetIndex; index += 1) {
    const step = layout.steps[index];
    const next = layout.steps[index + 1];
    points.push({ x: step.frontRight.x, y: step.frontRight.y + offsetY });
    points.push({ x: next.frontLeft.x, y: next.frontLeft.y + offsetY });
  }
  points.push({ x: target.center.x, y: target.frontLeft.y + offsetY });
  const end = points.at(-1);
  const arrow = [
    { x: end.x - 13, y: end.y + 9 },
    end,
    { x: end.x - 5, y: end.y + 15 },
  ];
  return { points, arrow, start: points[0], end };
}

function gapSvg(layout, currentIndex, targetIndex) {
  const gap = gapPath(layout, currentIndex, targetIndex);
  return `<g class="gap-geometry"><polyline class="gap-path" points="${pointsAttribute(gap.points)}"/><circle cx="${gap.start.x}" cy="${gap.start.y}" r="5"/><polyline class="gap-arrow" points="${pointsAttribute(gap.arrow)}"/></g>`;
}

function gapHtml(layout, currentIndex, targetIndex) {
  const gap = gapPath(layout, currentIndex, targetIndex);
  const mid = { x: (gap.start.x + gap.end.x) / 2, y: (gap.start.y + gap.end.y) / 2 };
  return `<div class="gap-tag current" style="left:${gap.start.x - 30}px;top:${gap.start.y + 10}px">当前</div><div class="gap-tag target" style="left:${gap.end.x + 14}px;top:${gap.end.y - 15}px">目标</div><div class="gap-label" style="left:${mid.x - 40}px;top:${mid.y + 22}px">能力差距</div>`;
}

export const visualComponent = Object.freeze({
  id: "progression-maturity-steps", schemaVersion: 6, designFrame: FRAME, cssFile: "component.css",
  textCapacity: { maxHeadingChars: 10, maxBodyChars: 24, maxBodyLines: 2 },
  renderMarkup(parameters) {
    const { levels, showGap, currentIndex, targetIndex } = normalize(parameters);
    const layout = solveLayout(levels.length);
    return `<section class="maturity-ladder" data-ppt-root data-level-count="${levels.length}" data-show-gap="${showGap}"><svg class="ladder-art" viewBox="0 0 1170 492" aria-hidden="true">${staircaseMarkup(layout)}${showGap ? gapSvg(layout, currentIndex, targetIndex) : ""}</svg>${levels.map((level, index) => levelMarkup(level, index, layout)).join("")}${showGap ? gapHtml(layout, currentIndex, targetIndex) : ""}</section>`;
  },
});

export const previewParameters = Object.freeze({ levels: [
  { key: "l1", title: "起步", body: "形成可重复的基础动作" }, { key: "l2", title: "规范", body: "建立统一标准与职责边界" },
  { key: "l3", title: "复用", body: "把成熟方法沉淀为共享能力" }, { key: "l4", title: "协同", body: "跨角色形成稳定配合机制" },
  { key: "l5", title: "优化", body: "依据反馈持续校准效率" }, { key: "l6", title: "引领", body: "形成可扩散的领先实践" },
], showGap: true, currentIndex: 1, targetIndex: 4 });

export function resolvePreviewParameters(base, selection) {
  const levelCount = Number(selection?.levelCount ?? 5);
  if (levelCount < MIN_LEVELS || levelCount > MAX_LEVELS) throw new Error("支持 3–6 级");
  const result = structuredClone(base);
  result.levels = result.levels.slice(0, levelCount);
  result.showGap = String(selection?.showGap ?? "显示") === "显示";
  result.currentIndex = Math.min(1, levelCount - 2);
  result.targetIndex = levelCount - 1;
  return result;
}
