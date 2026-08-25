import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });
const TRACK = Object.freeze({ startX: 105, endX: 1065, y: 194 });
const NODE_RADIUS = 29;
const NODE_COLORS = Object.freeze(["#355f98", "#4776ae", "#5b88bd", "#6d99c8", "#5683b6", "#416da5"]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function enforceReadableFontTiers(markup) {
  return markup.replaceAll('data-text-primitive-font-tiers="16,14,12"', 'data-text-primitive-font-tiers="16,14"');
}

function normalizeItem(item, index) {
  const title = text(item?.title);
  const body = text(item?.body);
  if (!title && !body) throw new Error(`items[${index}] 至少需要 title 或 body`);
  return { key: text(item?.key) || `stage-${index + 1}`, title, body, index };
}

function normalize(parameters) {
  const items = Array.isArray(parameters?.items) ? parameters.items.map(normalizeItem) : [];
  if (items.length < 3 || items.length > 6) throw new Error("单链反馈控制环支持 3–6 个前向阶段");
  const keys = new Set(items.map((item) => item.key));
  if (keys.size !== items.length) throw new Error("前向阶段 key 必须唯一");
  const feedback = { title: text(parameters?.feedback?.title), body: text(parameters?.feedback?.body) };
  if (!feedback.title && !feedback.body) throw new Error("反馈校准区域不能为空");
  return {
    items,
    feedback,
    feedbackTargetIndex: Math.max(0, Math.min(items.length - 2, Number(parameters?.feedbackTargetIndex ?? 0))),
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function stageGeometry(items) {
  const gap = (TRACK.endX - TRACK.startX) / (items.length - 1);
  const regionWidth = Math.min(196, Math.max(154, gap - 14));
  return items.map((item, index) => ({
    ...item,
    x: TRACK.startX + gap * index,
    region: { left: TRACK.startX + gap * index - regionWidth / 2, top: 24, width: regionWidth, height: 106 },
  }));
}

function pathMarkup(stages, feedbackTargetIndex) {
  const first = stages[feedbackTargetIndex];
  const last = stages.at(-1);
  const feedbackPath = `M ${last.x} ${TRACK.y + NODE_RADIUS} V 330 Q ${last.x} 410 ${last.x - 80} 410 H ${first.x + 80} Q ${first.x} 410 ${first.x} 330 V ${TRACK.y + NODE_RADIUS}`;
  const forwardArrows = stages.slice(0, -1).map((stage, index) => {
    const next = stages[index + 1];
    const x = (stage.x + next.x) / 2;
    return `<path class="forward-arrow" data-ppt-kind="path" data-ppt-name="forward-arrow-${index}" d="M ${x - 7} ${TRACK.y - 8} L ${x + 8} ${TRACK.y} L ${x - 7} ${TRACK.y + 8} Z"></path>`;
  }).join("");
  return `<svg class="feedback-track" viewBox="0 0 ${FRAME.width} ${FRAME.height}" aria-hidden="true">
    <path class="forward-halo" data-ppt-kind="path" data-ppt-name="forward-halo" d="M ${stages[0].x} ${TRACK.y} H ${last.x}"></path>
    <path class="forward-band" data-ppt-kind="path" data-ppt-name="forward-band" d="M ${stages[0].x} ${TRACK.y} H ${last.x}"></path>
    <path class="forward-line" data-ppt-kind="path" data-ppt-name="forward-line" d="M ${stages[0].x} ${TRACK.y} H ${last.x}"></path>
    ${forwardArrows}
    <path class="return-halo" data-ppt-kind="path" data-ppt-name="return-halo" d="${feedbackPath}"></path>
    <path class="return-band" data-ppt-kind="path" data-ppt-name="return-band" d="${feedbackPath}"></path>
    <path class="return-line" data-ppt-kind="path" data-ppt-name="return-line" d="${feedbackPath}"></path>
    <path class="return-arrow" data-ppt-kind="path" data-ppt-name="return-arrow" d="M ${first.x - 9} 260 L ${first.x} 241 L ${first.x + 9} 260 Z"></path>
  </svg>`;
}

function stageMarkup(stage, textLayoutBindings) {
  const slotId = `stage-${stage.key}-content`;
  const color = NODE_COLORS[stage.index % NODE_COLORS.length];
  const region = enforceReadableFontTiers(textRegionMarkup({
    id: slotId,
    field: `items[${stage.index}]`,
    itemId: stage.key,
    regionId: "stage-content",
    layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
    compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
    content: { title: stage.title, body: stage.body },
    className: "feedback-stage-content",
    align: "center",
    valign: "middle",
    density: "compact",
    required: true,
    names: { heading: `feedback-stage-title-${stage.index}`, body: `feedback-stage-body-${stage.index}` },
  })).replace(
    'class="ppagent-text-region feedback-stage-content"',
    `class="ppagent-text-region feedback-stage-content" style="left:${stage.region.left}px;top:${stage.region.top}px;width:${stage.region.width}px;height:${stage.region.height}px"`,
  );
  return `<article class="feedback-stage" data-stage-key="${escapeHtml(stage.key)}">
    <div class="feedback-stage-connector" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="feedback-stage-connector-${stage.index}" style="left:${stage.x - 1}px"></div>
    <div class="feedback-stage-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="feedback-stage-halo-${stage.index}" style="left:${stage.x - NODE_RADIUS - 7}px"></div>
    <div class="feedback-stage-node" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="feedback-stage-node-${stage.index}" style="left:${stage.x - NODE_RADIUS}px;background:${color}">${String(stage.index + 1).padStart(2, "0")}</div>
    ${region}
  </article>`;
}

function feedbackMarkup(feedback, textLayoutBindings) {
  const slotId = "feedback-control-content";
  const region = enforceReadableFontTiers(textRegionMarkup({
    id: slotId,
    field: "feedback",
    itemId: "feedback",
    regionId: "feedback-control",
    layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
    compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
    content: feedback,
    className: "feedback-control-content",
    align: "center",
    valign: "middle",
    density: "compact",
    required: true,
    names: { heading: "feedback-control-title", body: "feedback-control-body" },
  }));
  return `<div class="feedback-control-halo" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="feedback-control-halo"></div>
    <div class="feedback-control-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="feedback-control-surface"></div>
    ${region}`;
}

export const visualComponent = Object.freeze({
  id: "cycle-single-chain-feedback",
  schemaVersion: 1,
  designFrame: FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const stages = stageGeometry(model.items);
    return `<section class="single-chain-feedback" data-ppt-root data-item-count="${stages.length}">
      <div class="forward-zone" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="forward-zone"></div>
      ${pathMarkup(stages, model.feedbackTargetIndex)}
      ${stages.map((stage) => stageMarkup(stage, model.textLayoutBindings)).join("")}
      ${feedbackMarkup(model.feedback, model.textLayoutBindings)}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  feedbackTargetIndex: 0,
  feedback: Object.freeze({ title: "反馈校准", body: "依据结果修正上游判断与下一轮行动" }),
  items: Object.freeze([
    Object.freeze({ key: "sense", title: "识别需求", body: "明确输入与约束" }),
    Object.freeze({ key: "design", title: "形成方案", body: "把目标转为行动路径" }),
    Object.freeze({ key: "execute", title: "推进执行", body: "按既定步骤完成交付" }),
    Object.freeze({ key: "evaluate", title: "评估结果", body: "对照目标识别偏差" }),
    Object.freeze({ key: "adjust", title: "修正策略", body: "沉淀有效做法" }),
    Object.freeze({ key: "restart", title: "进入新一轮", body: "用更新基线继续运行" }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount ?? 4);
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 6) throw new Error("前向阶段数支持 3–6");
  const resolved = structuredClone(base);
  resolved.items = resolved.items.slice(0, itemCount);
  resolved.feedbackTargetIndex = Math.min(resolved.feedbackTargetIndex, itemCount - 2);
  return resolved;
}
