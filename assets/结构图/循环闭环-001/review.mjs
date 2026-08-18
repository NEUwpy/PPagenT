import {
  DESIGN_FRAME,
  CYCLE_TEXT_LIMITS,
  RING,
  RING_FRAME,
  normalizeCycleParameters,
  panelItems,
  ringItems,
  svgBandPath,
} from "./layout.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function panelMarkup(item, density) {
  const { frame } = item;
  const key = escapeHtml(item.step.key);
  const slotId = `step-${item.step.key}-support`;
  return `<article class="cycle-note" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="cycle-panel-${item.index}" data-side="${item.side}" data-key="${escapeHtml(item.step.key)}" data-density="${density}" style="--left:${frame.left}px;--top:${frame.top}px;--width:${frame.width}px;--height:${frame.height}px">
    <p class="cycle-copy" data-content-slot-id="${escapeHtml(slotId)}" data-content-slot-role="stage-support" data-slot-id="${escapeHtml(slotId)}" data-slot-role="item-body" data-slot-field="steps[${item.index}].support" data-slot-item-id="${key}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="inline" data-slot-max-chars="${CYCLE_TEXT_LIMITS.body.maxChars}" data-slot-max-lines="${CYCLE_TEXT_LIMITS.body.maxLines}" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-valign="middle" data-ppt-name="cycle-${item.index}-support">${escapeHtml(item.step.supportText)}</p>
  </article>`;
}

function ringMarkup(model) {
  const items = ringItems(model.steps);
  const bands = items.map((item) => `<path class="cycle-arc" data-ppt-kind="path" data-ppt-name="cycle-band-${item.index}" fill="${item.color}" d="${svgBandPath(item)}"/>`).join("");
  const arrows = items.map((item) => `<path class="cycle-arrow" data-ppt-kind="path" data-ppt-name="cycle-arrow-${item.index}" fill="${item.color}" d="M ${item.arrow.outer.x.toFixed(2)} ${item.arrow.outer.y.toFixed(2)} L ${item.arrow.tip.x.toFixed(2)} ${item.arrow.tip.y.toFixed(2)} L ${item.arrow.inner.x.toFixed(2)} ${item.arrow.inner.y.toFixed(2)} Z"/>`).join("");
  const labels = items.map((item) => `<text class="cycle-number" data-ppt-kind="text" data-ppt-name="cycle-number-${item.index}" x="${item.number.x.toFixed(2)}" y="${item.number.y.toFixed(2)}">${String(item.index + 1).padStart(2, "0")}</text>
    <text class="cycle-title" data-slot-id="step-${escapeHtml(item.step.key)}-title" data-slot-role="item-title" data-slot-field="steps[${item.index}].title" data-slot-item-id="${escapeHtml(item.step.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${CYCLE_TEXT_LIMITS.title.maxChars}" data-slot-max-lines="${CYCLE_TEXT_LIMITS.title.maxLines}" data-ppt-kind="text" data-ppt-name="cycle-title-${item.index}" x="${item.title.x.toFixed(2)}" y="${item.title.y.toFixed(2)}" transform="rotate(${item.title.rotation} ${item.title.x.toFixed(2)} ${item.title.y.toFixed(2)})">${escapeHtml(item.step.title)}</text>
    ${item.step.english ? `<text class="cycle-english" data-ppt-kind="text" data-ppt-name="cycle-english-${item.index}" x="${item.english.x.toFixed(2)}" y="${item.english.y.toFixed(2)}" transform="rotate(${item.english.rotation} ${item.english.x.toFixed(2)} ${item.english.y.toFixed(2)})">${escapeHtml(item.step.english)}</text>` : ""}`).join("");
  return `<svg class="cycle-diagram" viewBox="0 0 ${RING_FRAME.width} ${RING_FRAME.height}" role="img" aria-label="${model.steps.length} 步循环闭环">
    <circle class="cycle-breath" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="cycle-breath" cx="${RING.center}" cy="${RING.center}" r="${RING.outer + RING.breath}"/>
    ${bands}${arrows}${labels}
    <circle class="cycle-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="cycle-core" cx="${RING.center}" cy="${RING.center}" r="${RING.core}"/>
    <g data-slot-id="cycle-center" data-slot-role="center-title" data-slot-field="center" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${CYCLE_TEXT_LIMITS.center.maxChars}" data-slot-max-lines="${CYCLE_TEXT_LIMITS.center.maxLines}">
      ${model.centerLabel.map((line, index) => `<text class="cycle-core-text" data-ppt-kind="text" data-ppt-name="cycle-core-text-${index}" x="${RING.center}" y="${229 + index * 35}">${escapeHtml(line)}</text>`).join("")}
    </g>
  </svg>`;
}

export const visualComponent = Object.freeze({
  id: "cycle-pdca-ring-p57",
  schemaVersion: 6,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxCenterChars: CYCLE_TEXT_LIMITS.center.maxChars,
    maxCenterLines: CYCLE_TEXT_LIMITS.center.maxLines,
    maxItemTitleChars: CYCLE_TEXT_LIMITS.title.maxChars,
    maxItemTitleLines: CYCLE_TEXT_LIMITS.title.maxLines,
    maxItemBodyChars: CYCLE_TEXT_LIMITS.body.maxChars,
    maxItemBodyLines: CYCLE_TEXT_LIMITS.body.maxLines,
    maxPointsPerItem: 4,
    maxPointChars: CYCLE_TEXT_LIMITS.point.maxChars,
    maxPointLines: CYCLE_TEXT_LIMITS.point.maxLines,
  }),
  renderMarkup(parameters) {
    const model = normalizeCycleParameters(parameters);
    return `<section class="cycle-review" data-ppt-root data-step-count="${model.steps.length}" data-density="${model.density}">
      <div class="cycle-support-layer">${panelItems(model.steps).map((item) => panelMarkup(item, model.density)).join("")}</div>
      <div class="cycle-mask" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="cycle-mask" aria-hidden="true"></div>
      ${ringMarkup(model)}
    </section>`;
  },
});

export function resolveContentSlots(parameters) {
  const model = normalizeCycleParameters(parameters);
  return panelItems(model.steps).map((item) => ({
    id: `step-${item.step.key}-support`,
    bindingPath: `steps[${item.index}]`,
    role: "stage-support",
    frame: item.slotFrame,
    side: item.side,
    alignment: item.side === "left" ? "left" : "right",
    capacity: {
      maxDepth: 1,
      maxItems: 1,
      maxCharsPerItem: CYCLE_TEXT_LIMITS.body.maxChars,
      maxLines: CYCLE_TEXT_LIMITS.body.maxLines,
    },
    allowedContentModes: ["plain-text"],
    fallback: "plain-text",
  }));
}

export const previewParameters = Object.freeze({
  title: "PDCA工作复盘分析框架",
  center: "PDCA 循环",
  steps: [
    { key: "plan", title: "计划", body: "明确本轮改进目标", points: ["分析现状约束", "确定优先问题", "形成行动计划"] },
    { key: "do", title: "执行", body: "推进重点行动", points: ["同步责任分工"] },
    { key: "check", title: "检查", body: "对照目标检查结果", points: [] },
    { key: "act", title: "行动", body: "沉淀有效做法", points: ["修正未达预期", "进入下一循环"] },
    { key: "verify", title: "验证", body: "确认改进效果", points: ["复核关键偏差", "确认结果可复现"] },
    { key: "learn", title: "沉淀", body: "把经验写入标准", points: ["以新基线启动"] },
  ],
});

export function resolvePreviewParameters(base, selection) {
  const result = structuredClone(base);
  result.steps = result.steps.slice(0, selection.stepCount);
  return result;
}
