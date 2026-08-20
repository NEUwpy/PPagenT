import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const COLORS = Object.freeze(["#2F5EA8", "#3F70A9", "#4F82B5", "#6697C5", "#78A8D5", "#8BB9E0"]);
const LIMITS = Object.freeze({ inputLabel: 4, stepTitle: 8 });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
function clean(value) { return String(value ?? "").trim(); }
function chars(value) { return Array.from(value).length; }
function assertText(value, label, limit) {
  const result = clean(value);
  if (!result) throw new Error(`${label} 不能为空`);
  if (chars(result) > limit) throw new Error(`${label} 超过 ${limit} 字`);
  return result;
}
function inputMarkerModel(item, index) {
  const label = assertText(item?.label, `inputs[${index}].label`, LIMITS.inputLabel, false);
  const query = clean(item?.iconQuery);
  const icon = query ? resolveTablerIcon(clean(item?.iconKey) || query) : null;
  if (!icon && !label) throw new Error(`inputs[${index}] 需要 iconQuery 或 label`);
  return { label, query, icon, mode: icon ? "icon" : "text" };
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.inputs) || !Array.isArray(parameters.steps)) throw new Error("简明转化漏斗需要 inputs 与 steps");
  if (parameters.inputs.length > 7) throw new Error("inputs 需要 0–7 项");
  if (parameters.steps.length < 3 || parameters.steps.length > 6) throw new Error("steps 需要 3–6 项");
  return {
    inputs: parameters.inputs.map((input, index) => ({
      key: clean(input?.key) || `input-${index + 1}`,
      ...inputMarkerModel(input, index),
    })),
    steps: parameters.steps.map((step, index) => ({
      key: clean(step?.key) || `step-${index + 1}`,
      title: assertText(step?.title, `steps[${index}].title`, LIMITS.stepTitle),
    })),
  };
}

function funnelGeometry(stepCount) {
  const cx = 585;
  const top = 105;
  const bottom = 422;
  const gap = stepCount >= 6 ? 5 : 8;
  const height = (bottom - top - gap * (stepCount - 1)) / stepCount;
  const topWidth = 370;
  const bottomWidth = 88;
  const steps = [];
  for (let index = 0; index < stepCount; index += 1) {
    const p0 = index / stepCount;
    const p1 = (index + 1) / stepCount;
    const w0 = topWidth - (topWidth - bottomWidth) * Math.pow(p0, .82);
    const w1 = topWidth - (topWidth - bottomWidth) * Math.pow(p1, .82);
    const y0 = top + index * (height + gap);
    const y1 = y0 + height;
    const left0 = cx - w0 / 2;
    const right0 = cx + w0 / 2;
    const left1 = cx - w1 / 2;
    const right1 = cx + w1 / 2;
    const arc = Math.min(11, height * .15);
    steps.push({
      index, cx, y0, y1, w0, w1,
      cap: { cx, cy: y0, rx: w0 / 2, ry: Math.min(13, height * .16) },
      path: `M ${left0.toFixed(2)} ${y0.toFixed(2)} L ${left1.toFixed(2)} ${(y1 - arc).toFixed(2)} C ${left1.toFixed(2)} ${y1.toFixed(2)} ${right1.toFixed(2)} ${y1.toFixed(2)} ${right1.toFixed(2)} ${(y1 - arc).toFixed(2)} L ${right0.toFixed(2)} ${y0.toFixed(2)} C ${right0.toFixed(2)} ${(y0 + arc).toFixed(2)} ${left0.toFixed(2)} ${(y0 + arc).toFixed(2)} ${left0.toFixed(2)} ${y0.toFixed(2)} Z`,
      textTop: y0 + Math.max(11, (height - 28) / 2),
    });
  }
  return { cx, topWidth, bottomWidth, steps };
}

function flowArrowMarkup(geometry) {
  const first = geometry.steps[0];
  const last = geometry.steps[geometry.steps.length - 1];
  const topY = first.y0 - 4;
  const bottomY = last.y1 + 4;
  const shoulderY = bottomY - Math.min(68, (bottomY - topY) * .2);
  const widthAt = (y) => {
    const progress = Math.max(0, Math.min(1, (y - first.y0) / (last.y1 - first.y0)));
    return geometry.topWidth - (geometry.topWidth - geometry.bottomWidth) * Math.pow(progress, .82);
  };
  const guideYs = [topY, ...geometry.steps.flatMap((step) => [step.y0, step.y1])].filter((y, index, values) => y <= shoulderY && (index === 0 || Math.abs(y - values[index - 1]) > 1));
  if (guideYs[guideYs.length - 1] < shoulderY) guideYs.push(shoulderY);
  const left = guideYs.map((y) => `${(geometry.cx - widthAt(y) * .26).toFixed(2)} ${y.toFixed(2)}`);
  const right = [...guideYs].reverse().map((y) => `${(geometry.cx + widthAt(y) * .26).toFixed(2)} ${y.toFixed(2)}`);
  const shaftHalf = widthAt(shoulderY) * .26;
  const headHalf = Math.max(58, shaftHalf + 31);
  const path = `M ${left.join(" L ")} L ${(geometry.cx - headHalf).toFixed(2)} ${shoulderY.toFixed(2)} L ${geometry.cx.toFixed(2)} ${bottomY.toFixed(2)} L ${(geometry.cx + headHalf).toFixed(2)} ${shoulderY.toFixed(2)} L ${right.join(" L ")} Z`;
  return `<defs><linearGradient id="simple-flow-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d9ebfa" stop-opacity="0"/><stop offset="42%" stop-color="#b8d8f2" stop-opacity=".16"/><stop offset="76%" stop-color="#8fc4ee" stop-opacity=".32"/><stop offset="100%" stop-color="#72b3e8" stop-opacity=".52"/></linearGradient></defs><path class="simple-flow-arrow" fill="url(#simple-flow-gradient)" d="${path}" data-ppt-kind="path" data-ppt-name="simple-flow-arrow"/>`;
}

function iconSvg(item, name) {
  return item.icon ? tablerIconSvgMarkup(item.icon, { name, className: "simple-icon-svg" }) : `<i class="simple-icon-fallback" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="${name}-fallback"></i>`;
}

function inputMarkup(input, index, count) {
  const spans = [0, 0, 150, 220, 250, 280, 300, 315];
  const yPatterns = {
    1: [18],
    2: [28, 8],
    3: [28, 6, 24],
    4: [31, 10, 5, 26],
    5: [31, 11, 3, 14, 29],
    6: [31, 13, 3, 7, 20, 30],
    7: [31, 15, 5, 2, 8, 22, 31],
  };
  const span = spans[count];
  const spread = count <= 1 ? 0 : span / (count - 1);
  const x = count === 1 ? 585 : 585 - span / 2 + spread * index;
  const yPattern = yPatterns[count];
  const size = index % 2 === 0 ? 46 : 40;
  const marker = input.mode === "icon"
    ? `<span class="simple-input-marker simple-input-marker-icon" data-slot-id="${escapeHtml(input.key)}-marker" data-slot-role="input-marker" data-slot-field="inputs[${index}].iconQuery" data-slot-item-id="${escapeHtml(input.key)}" data-slot-content-type="icon" data-slot-provider="tabler-icons" data-slot-required="false">${iconSvg(input, `simple-input-icon-${index}`)}</span>`
    : `<span class="simple-input-marker simple-input-marker-text" data-slot-id="${escapeHtml(input.key)}-marker" data-slot-role="input-marker" data-slot-field="inputs[${index}].label" data-slot-item-id="${escapeHtml(input.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.inputLabel}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="simple-input-text-${index}">${escapeHtml(input.label)}</span>`;
  return `<div class="simple-input" style="--x:${x}px;--y:${yPattern[index]}px;--size:${size}px">
    <div class="simple-input-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="simple-input-core-${index}">${marker}</div>
  </div>`;
}

export const visualComponent = Object.freeze({
  id: "convergence-simple-funnel",
  schemaVersion: 2,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({ maxInputLabelChars: LIMITS.inputLabel, maxItemTitleChars: LIMITS.stepTitle }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    const geometry = funnelGeometry(model.steps.length);
    return `<section class="simple-funnel" data-ppt-root data-step-count="${model.steps.length}">
      <svg class="simple-funnel-orbit" viewBox="0 0 1170 492" aria-hidden="true"><ellipse cx="585" cy="244.5" rx="285" ry="202.5" transform="rotate(-7 585 244.5)" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="simple-funnel-orbit"></ellipse></svg>
      <div class="simple-input-layer">${model.inputs.map((input, index) => inputMarkup(input, index, model.inputs.length)).join("")}</div>
      <svg class="simple-funnel-diagram" viewBox="0 0 ${DESIGN_FRAME.width} ${DESIGN_FRAME.height}" preserveAspectRatio="none" aria-hidden="true">
        ${geometry.steps.map((step) => `<g><path class="simple-funnel-step-body" fill="${COLORS[step.index]}" d="${step.path}" data-ppt-kind="path" data-ppt-name="simple-step-body-${step.index}"/><ellipse class="simple-funnel-step-cap" fill="${COLORS[step.index]}" cx="${step.cap.cx}" cy="${step.cap.cy}" rx="${step.cap.rx}" ry="${step.cap.ry}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="simple-step-cap-${step.index}"/></g>`).join("")}
        ${flowArrowMarkup(geometry)}
      </svg>
      ${geometry.steps.map((step, index) => `<h3 class="simple-step-title" style="--top:${step.textTop}px;--width:${Math.max(88, step.w1 - 16)}px" data-slot-id="${escapeHtml(model.steps[index].key)}-title" data-slot-role="item-title" data-slot-field="steps[${index}].title" data-slot-item-id="${escapeHtml(model.steps[index].key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.stepTitle}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="simple-step-title-${index}">${escapeHtml(model.steps[index].title)}</h3>`).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  inputs: [
    { key: "audience", label: "目标用户", iconQuery: "users audience" },
    { key: "content", label: "内容线索", iconQuery: "file content" },
    { key: "channel", label: "渠道触点", iconQuery: "speakerphone advertising" },
    { key: "event", label: "活动事件", iconQuery: "calendar event" },
    { key: "search", label: "搜索行为", iconQuery: "search discovery" },
    { key: "feedback", label: "用户反馈", iconQuery: "message feedback" },
    { key: "signal", label: "行为信号", iconQuery: "activity signal" }
  ],
  steps: [
    { key: "reach", title: "广泛触达" }, { key: "identify", title: "兴趣识别" }, { key: "cultivate", title: "意向培育" },
    { key: "convert", title: "行动转化" }, { key: "retain", title: "持续留存" }, { key: "grow", title: "价值增长" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const stepCount = Number(selection?.stepCount);
  const inputCount = Number(selection?.inputCount ?? 4);
  if (!Number.isInteger(stepCount) || stepCount < 3 || stepCount > 6) throw new Error("简明转化漏斗支持 3–6 个漏斗层级");
  if (!Number.isInteger(inputCount) || inputCount < 0 || inputCount > 7) throw new Error("简明转化漏斗支持 0–7 个输入图标");
  const result = structuredClone(base);
  result.steps = result.steps.slice(0, stepCount);
  result.inputs = result.inputs.slice(0, inputCount);
  return result;
}
