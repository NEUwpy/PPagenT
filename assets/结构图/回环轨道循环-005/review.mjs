import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TRACK = Object.freeze({ left: 160, right: 1010, top: 174, bottom: 318, radius: 72 });
const NODE_RADIUS = 31;
const NODE_COLORS = Object.freeze(["#345f9f", "#4774b2", "#5b87c0", "#6c96c8", "#5684b9", "#416ca8"]);
const X_POSITIONS = Object.freeze({
  1: Object.freeze([585]),
  2: Object.freeze([410, 760]),
  3: Object.freeze([310, 585, 860]),
});

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
  if (items.length < 3 || items.length > 6) throw new Error("回环轨道支持 3–6 个循环阶段");
  const keys = new Set(items.map((item) => item.key));
  if (keys.size !== items.length) throw new Error("循环阶段 key 必须唯一");
  const center = { title: text(parameters?.center?.title), body: text(parameters?.center?.body) };
  return {
    items,
    center,
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function stageGeometry(items) {
  const topCount = Math.ceil(items.length / 2);
  const bottomCount = items.length - topCount;
  const topXs = X_POSITIONS[topCount];
  const bottomXs = [...X_POSITIONS[bottomCount]].reverse();
  return items.map((item, index) => {
    const side = index < topCount ? "top" : "bottom";
    const localIndex = side === "top" ? index : index - topCount;
    const x = side === "top" ? topXs[localIndex] : bottomXs[localIndex];
    const y = side === "top" ? TRACK.top : TRACK.bottom;
    return {
      ...item,
      side,
      x,
      y,
      region: side === "top"
        ? { left: x - 120, top: 12, width: 240, height: 112 }
        : { left: x - 120, top: 368, width: 240, height: 112 },
    };
  });
}

function trackPath() {
  const startX = TRACK.left + TRACK.radius;
  const endX = TRACK.right - TRACK.radius;
  return `M ${startX} ${TRACK.top} H ${endX} A ${TRACK.radius} ${TRACK.radius} 0 0 1 ${TRACK.right} ${TRACK.top + TRACK.radius} A ${TRACK.radius} ${TRACK.radius} 0 0 1 ${endX} ${TRACK.bottom} H ${startX} A ${TRACK.radius} ${TRACK.radius} 0 0 1 ${TRACK.left} ${TRACK.bottom - TRACK.radius} A ${TRACK.radius} ${TRACK.radius} 0 0 1 ${startX} ${TRACK.top}`;
}

function trackMarkup() {
  const path = trackPath();
  return `<svg class="cycle-track" viewBox="0 0 ${DESIGN_FRAME.width} ${DESIGN_FRAME.height}" aria-hidden="true">
    <path class="cycle-track-halo" data-ppt-kind="path" data-ppt-name="cycle-track-halo" d="${path}"></path>
    <path class="cycle-track-band" data-ppt-kind="path" data-ppt-name="cycle-track-band" d="${path}"></path>
    <path class="cycle-track-line" data-ppt-kind="path" data-ppt-name="cycle-track-line" d="${path}"></path>
    <path class="cycle-arrow cycle-arrow-forward" data-ppt-kind="path" data-ppt-name="cycle-arrow-forward" d="M 1001 232 L 1010 254 L 1019 232 Z"></path>
    <path class="cycle-arrow cycle-arrow-return" data-ppt-kind="path" data-ppt-name="cycle-arrow-return" d="M 151 260 L 160 238 L 169 260 Z"></path>
  </svg>`;
}

function stageMarkup(stage, textLayoutBindings) {
  const slotId = `stage-${stage.key}-content`;
  const color = NODE_COLORS[stage.index % NODE_COLORS.length];
  const connectorTop = stage.side === "top" ? 124 : 349;
  return `<article class="cycle-stage cycle-stage-${stage.side}" data-stage-key="${escapeHtml(stage.key)}">
    <div class="cycle-stage-connector" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="cycle-stage-connector-${stage.index}" style="left:${stage.x - 1}px;top:${connectorTop}px;height:19px"></div>
    <div class="cycle-stage-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="cycle-stage-halo-${stage.index}" style="left:${stage.x - NODE_RADIUS - 8}px;top:${stage.y - NODE_RADIUS - 8}px"></div>
    <div class="cycle-stage-node" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="cycle-stage-node-${stage.index}" style="left:${stage.x - NODE_RADIUS}px;top:${stage.y - NODE_RADIUS}px;background:${color}">${String(stage.index + 1).padStart(2, "0")}</div>
    ${enforceReadableFontTiers(textRegionMarkup({
      id: slotId,
      field: `items[${stage.index}]`,
      itemId: stage.key,
      regionId: "content",
      layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow", "structured-list-flow"],
      content: { title: stage.title, body: stage.body },
      className: `cycle-stage-content cycle-stage-content-${stage.side}`,
      align: "center",
      valign: "middle",
      density: "compact",
      required: true,
      names: { heading: `cycle-stage-title-${stage.index}`, body: `cycle-stage-body-${stage.index}` },
    }).replace(
      `class="ppagent-text-region cycle-stage-content cycle-stage-content-${stage.side}"`,
      `class="ppagent-text-region cycle-stage-content cycle-stage-content-${stage.side}" style="left:${stage.region.left}px;top:${stage.region.top}px;width:${stage.region.width}px;height:${stage.region.height}px"`,
    ))}
  </article>`;
}

function centerMarkup(center, textLayoutBindings) {
  const slotId = "cycle-center-content";
  const hasContent = Boolean(center.title || center.body);
  if (!hasContent) return "";
  const content = hasContent
    ? enforceReadableFontTiers(textRegionMarkup({
      id: slotId,
      field: "center",
      itemId: "center",
      regionId: "center",
      layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow", "metric-content-flow"],
      content: center,
      className: "cycle-center-content",
      align: "center",
      valign: "middle",
      density: "compact",
      required: false,
      names: { heading: "cycle-center-title", body: "cycle-center-body" },
    }))
    : "";
  return `<div class="cycle-center-halo" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="cycle-center-halo"></div>
    <div class="cycle-center-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="cycle-center-surface"></div>
    ${content}`;
}

export const visualComponent = Object.freeze({
  id: "cycle-racetrack-loop",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const stages = stageGeometry(model.items);
    return `<section class="cycle-racetrack-review" data-ppt-root data-item-count="${stages.length}">
      <div class="cycle-copy-band cycle-copy-band-top" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="cycle-copy-band-top"></div>
      <div class="cycle-copy-band cycle-copy-band-bottom" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="cycle-copy-band-bottom"></div>
      ${trackMarkup()}
      ${centerMarkup(model.center, model.textLayoutBindings)}
      ${stages.map((stage) => stageMarkup(stage, model.textLayoutBindings)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  center: Object.freeze({ title: "持续反馈", body: "每轮结果进入下一轮" }),
  items: Object.freeze([
    Object.freeze({ key: "observe", title: "识别现状", body: "明确本轮需要解决的关键问题" }),
    Object.freeze({ key: "decide", title: "形成判断", body: "结合目标与约束确定行动重点" }),
    Object.freeze({ key: "act", title: "推进执行", body: "按既定路径落实核心动作" }),
    Object.freeze({ key: "review", title: "复盘结果", body: "对照预期识别偏差与有效做法" }),
    Object.freeze({ key: "adjust", title: "校准优化", body: "修正方案并沉淀可复用经验" }),
    Object.freeze({ key: "restart", title: "进入新一轮", body: "以更新后的基线继续运行" }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount ?? 4);
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 6) throw new Error("循环阶段数支持 3–6");
  const resolved = structuredClone(base);
  resolved.items = resolved.items.slice(0, itemCount);
  return resolved;
}
