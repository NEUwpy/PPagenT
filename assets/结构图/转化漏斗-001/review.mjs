import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ phaseLabel: 6, phaseTitle: 10, phaseBody: 18, stepTitle: 8, exampleTitle: 10, exampleBody: 20, phaseContent: 120 });
const COLORS = Object.freeze(["#2F5EA8", "#4F7EAC", "#78A8D5", "#8BB9E0"]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function clean(value) { return String(value ?? "").trim(); }
function chars(value) { return Array.from(value).length; }
function assertText(value, label, limit, required = true) {
  const result = clean(value);
  if (required && !result) throw new Error(`${label} 不能为空`);
  if (chars(result) > limit) throw new Error(`${label} 超过 ${limit} 字`);
  return result;
}

function iconModel(item, fallback) {
  const query = clean(item?.iconQuery) || fallback;
  return { query, icon: resolveTablerIcon(clean(item?.iconKey) || query) };
}

function inputMarkerModel(item, index) {
  const label = assertText(item?.label, `inputs[${index}].label`, 4, false);
  const query = clean(item?.iconQuery);
  const icon = query ? resolveTablerIcon(clean(item?.iconKey) || query) : null;
  if (!icon && !label) throw new Error(`inputs[${index}] 需要 iconQuery 或 label`);
  return { label, query, icon, mode: icon ? "icon" : "text" };
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.inputs) || !Array.isArray(parameters.phases)) {
    throw new Error("阶段化输入转化漏斗需要 inputs 与 phases");
  }
  if (parameters.inputs.length > 7) throw new Error("inputs 需要 0–7 项");
  if (parameters.phases.length < 2 || parameters.phases.length > 4) throw new Error("phases 需要 2–4 项");
  const inputs = parameters.inputs.map((item, index) => ({
    key: clean(item?.key) || `input-${index + 1}`,
    ...inputMarkerModel(item, index),
  }));
  const phases = parameters.phases.map((phase, phaseIndex) => {
    if (!Array.isArray(phase?.steps) || phase.steps.length < 1 || phase.steps.length > 3) throw new Error(`phases[${phaseIndex}].steps 需要 1–3 项`);
    const exampleItems = phase?.content?.items ?? phase?.actions;
    if (!Array.isArray(exampleItems) || exampleItems.length < 1 || exampleItems.length > 6) throw new Error(`phases[${phaseIndex}].content.items 示例需要 1–6 项`);
    const key = clean(phase?.key) || `phase-${phaseIndex + 1}`;
    return {
      key,
      label: assertText(phase.label, `phases[${phaseIndex}].label`, LIMITS.phaseLabel),
      title: assertText(phase.title, `phases[${phaseIndex}].title`, LIMITS.phaseTitle),
      body: assertText(phase.body, `phases[${phaseIndex}].body`, LIMITS.phaseBody, false),
      steps: phase.steps.map((step, stepIndex) => ({
        key: clean(step?.key) || `${key}-step-${stepIndex + 1}`,
        title: assertText(step?.title, `phases[${phaseIndex}].steps[${stepIndex}].title`, LIMITS.stepTitle),
      })),
      content: {
        layout: clean(phase?.content?.layout) || "icon-title-body-list-example",
        items: exampleItems.map((action, actionIndex) => ({
        key: clean(action?.key) || `${key}-action-${actionIndex + 1}`,
        title: assertText(action?.title, `phases[${phaseIndex}].content.items[${actionIndex}].title`, LIMITS.exampleTitle),
        body: assertText(action?.body, `phases[${phaseIndex}].content.items[${actionIndex}].body`, LIMITS.exampleBody, false),
        ...iconModel(action, "settings action"),
        })),
      },
    };
  });
  const totalSteps = phases.reduce((sum, phase) => sum + phase.steps.length, 0);
  if (totalSteps < 3 || totalSteps > 6) throw new Error("漏斗层级总数需要 3–6 项");
  return { inputs, phases, totalSteps };
}

function funnelGeometry(model) {
  const cx = model.inputs.length === 0 ? 405 : 430;
  const top = model.inputs.length === 0 ? 28 : 98;
  const bottom = model.inputs.length === 0 ? 468 : 472;
  const gap = model.totalSteps >= 6 ? 5 : 8;
  const height = (bottom - top - gap * (model.totalSteps - 1)) / model.totalSteps;
  const topWidth = 350;
  const bottomWidth = 92;
  const steps = [];
  let flatIndex = 0;
  for (let phaseIndex = 0; phaseIndex < model.phases.length; phaseIndex += 1) {
    for (const [phaseStepIndex, step] of model.phases[phaseIndex].steps.entries()) {
      const progress0 = flatIndex / model.totalSteps;
      const progress1 = (flatIndex + 1) / model.totalSteps;
      const w0 = topWidth - (topWidth - bottomWidth) * Math.pow(progress0, .82);
      const w1 = topWidth - (topWidth - bottomWidth) * Math.pow(progress1, .82);
      const y0 = top + flatIndex * (height + gap);
      const y1 = y0 + height;
      const left0 = cx - w0 / 2;
      const right0 = cx + w0 / 2;
      const left1 = cx - w1 / 2;
      const right1 = cx + w1 / 2;
      const arc = Math.min(11, height * .15);
      steps.push({
        ...step, phaseIndex, phaseStepIndex, flatIndex, cx, y0, y1, w0, w1,
        cap: { cx, cy: y0, rx: w0 / 2, ry: Math.min(13, height * .16) },
        path: `M ${left0.toFixed(2)} ${y0.toFixed(2)} L ${left1.toFixed(2)} ${(y1 - arc).toFixed(2)} C ${left1.toFixed(2)} ${y1.toFixed(2)} ${right1.toFixed(2)} ${y1.toFixed(2)} ${right1.toFixed(2)} ${(y1 - arc).toFixed(2)} L ${right0.toFixed(2)} ${y0.toFixed(2)} C ${right0.toFixed(2)} ${(y0 + arc).toFixed(2)} ${left0.toFixed(2)} ${(y0 + arc).toFixed(2)} ${left0.toFixed(2)} ${y0.toFixed(2)} Z`,
        textTop: y0 + Math.max(12, (height - 29) / 2),
      });
      flatIndex += 1;
    }
  }
  const phaseFrames = model.phases.map((phase, phaseIndex) => {
    const owned = steps.filter((step) => step.phaseIndex === phaseIndex);
    const first = owned[0];
    const last = owned[owned.length - 1];
    return {
      key: phase.key,
      top: phaseIndex === 0 ? 6 : first.y0 - gap / 2,
      bottom: phaseIndex === model.phases.length - 1 ? 486 : last.y1 + gap / 2,
    };
  }).map((frame) => ({ ...frame, height: frame.bottom - frame.top }));
  return { steps, phaseFrames, cx };
}

function iconSvg(item, name) {
  return item.icon
    ? tablerIconSvgMarkup(item.icon, { name, className: "funnel-icon-svg" })
    : `<i class="funnel-icon-fallback" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="${name}-fallback"></i>`;
}

function inputMarkup(input, index, count) {
  const spans = [0, 0, 150, 220, 250, 280, 300, 315];
  const yPatterns = {
    1: [55],
    2: [58, 38],
    3: [58, 34, 52],
    4: [62, 38, 31, 55],
    5: [62, 38, 29, 42, 59],
    6: [62, 40, 29, 34, 48, 60],
    7: [62, 42, 30, 26, 35, 50, 61],
  };
  const span = spans[count];
  const spread = count <= 1 ? 0 : span / (count - 1);
  const x = count === 1 ? 430 : 430 - span / 2 + spread * index;
  const ys = yPatterns[count];
  const size = index % 2 === 0 ? 48 : 42;
  const marker = input.mode === "icon"
    ? `<span class="funnel-input-marker funnel-input-icon" data-slot-id="${escapeHtml(input.key)}-marker" data-slot-role="input-marker" data-slot-field="inputs[${index}].iconQuery" data-slot-item-id="${escapeHtml(input.key)}" data-slot-content-type="icon" data-slot-provider="tabler-icons" data-slot-required="false">${iconSvg(input, `input-icon-${index}`)}</span>`
    : `<span class="funnel-input-marker funnel-input-text" data-slot-id="${escapeHtml(input.key)}-marker" data-slot-role="input-marker" data-slot-field="inputs[${index}].label" data-slot-item-id="${escapeHtml(input.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="4" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="input-text-${index}">${escapeHtml(input.label)}</span>`;
  return `<div class="funnel-input" style="--x:${x}px;--y:${ys[index]}px;--size:${size}px">
    <div class="funnel-input-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="input-core-${index}"></div>
    ${marker}
  </div>`;
}

function stepShapeMarkup(step) {
  const color = COLORS[Math.min(step.phaseIndex, COLORS.length - 1)];
  return `<g>
    <path class="funnel-step-body" fill="${color}" d="${step.path}" data-ppt-kind="path" data-ppt-name="funnel-step-body-${step.flatIndex}"/>
    <ellipse class="funnel-step-cap" fill="${color}" cx="${step.cap.cx}" cy="${step.cap.cy}" rx="${step.cap.rx}" ry="${step.cap.ry}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="funnel-step-cap-${step.flatIndex}"/>
  </g>`;
}

function flowArrowMarkup(geometry) {
  const first = geometry.steps[0];
  const last = geometry.steps[geometry.steps.length - 1];
  const topY = first.y0 - 5;
  const bottomY = last.y1 + 3;
  const shoulderY = bottomY - Math.min(72, (bottomY - topY) * .2);
  const widthAt = (y) => {
    const progress = Math.max(0, Math.min(1, (y - first.y0) / (last.y1 - first.y0)));
    return 350 - (350 - 92) * Math.pow(progress, .82);
  };
  const guideYs = [topY, ...geometry.steps.flatMap((step) => [step.y0, step.y1])]
    .filter((y, index, values) => y <= shoulderY && (index === 0 || Math.abs(y - values[index - 1]) > 1));
  if (guideYs[guideYs.length - 1] < shoulderY) guideYs.push(shoulderY);
  const left = guideYs.map((y) => `${(geometry.cx - widthAt(y) * .26).toFixed(2)} ${y.toFixed(2)}`);
  const right = [...guideYs].reverse().map((y) => `${(geometry.cx + widthAt(y) * .26).toFixed(2)} ${y.toFixed(2)}`);
  const shaftHalf = widthAt(shoulderY) * .26;
  const headHalf = Math.max(62, shaftHalf + 34);
  const path = `M ${left.join(" L ")} L ${(geometry.cx - headHalf).toFixed(2)} ${shoulderY.toFixed(2)} L ${geometry.cx.toFixed(2)} ${bottomY.toFixed(2)} L ${(geometry.cx + headHalf).toFixed(2)} ${shoulderY.toFixed(2)} L ${right.join(" L ")} Z`;
  return `<defs>
      <linearGradient id="funnel-flow-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d9ebfa" stop-opacity="0"/>
        <stop offset="42%" stop-color="#b8d8f2" stop-opacity=".16"/>
        <stop offset="76%" stop-color="#8fc4ee" stop-opacity=".32"/>
        <stop offset="100%" stop-color="#72b3e8" stop-opacity=".52"/>
      </linearGradient>
    </defs>
    <path class="funnel-flow-arrow" fill="url(#funnel-flow-gradient)" d="${path}" data-ppt-kind="path" data-ppt-name="funnel-flow-arrow"/>`;
}

function stepTextMarkup(step) {
  return `<h3 class="funnel-step-title" style="--top:${step.textTop}px;--width:${Math.max(88, step.w1 - 16)}px" data-slot-id="${escapeHtml(step.key)}-title" data-slot-role="item-title" data-slot-field="phases[${step.phaseIndex}].steps[${step.phaseStepIndex}].title" data-slot-item-id="${escapeHtml(step.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.stepTitle}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="funnel-step-title-${step.flatIndex}">${escapeHtml(step.title)}</h3>`;
}

function phaseRailPath(frame, index) {
  const width = 54;
  const height = frame.height;
  const notch = Math.min(15, height * .14);
  return index === 0
    ? `M 0 0 L ${width} 0 L ${width} ${height - notch} L ${width / 2} ${height} L 0 ${height - notch} Z`
    : `M 0 0 L ${width / 2} ${notch} L ${width} 0 L ${width} ${height - notch} L ${width / 2} ${height} L 0 ${height - notch} Z`;
}

function actionMarkup(action, phaseIndex, actionIndex) {
  return `<div class="funnel-action" data-action-index="${actionIndex}">
    <div class="funnel-action-icon" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="action-icon-shell-${phaseIndex}-${actionIndex}">
      ${iconSvg(action, `action-icon-${phaseIndex}-${actionIndex}`)}
    </div>
    <div class="funnel-action-copy">
      <h4 data-ppt-kind="text" data-ppt-name="action-title-${phaseIndex}-${actionIndex}">${escapeHtml(action.title)}</h4>
      <p data-ppt-kind="text" data-ppt-name="action-body-${phaseIndex}-${actionIndex}">${escapeHtml(action.body)}</p>
    </div>
  </div>`;
}

function phaseMarkup(phase, frame, phaseIndex, hasInputs) {
  const color = COLORS[Math.min(phaseIndex, COLORS.length - 1)];
  const indexLabel = String(phaseIndex + 1).padStart(2, "0");
  const summaryMarkup = hasInputs ? `<div class="funnel-phase-summary" style="--top:${frame.top}px;--height:${frame.height}px">
      <h3 data-slot-id="${escapeHtml(phase.key)}-title" data-slot-role="phase-title" data-slot-field="phases[${phaseIndex}].title" data-slot-item-id="${escapeHtml(phase.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.phaseTitle}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="phase-title-${phaseIndex}">${escapeHtml(phase.title)}</h3>
      <p data-slot-id="${escapeHtml(phase.key)}-body" data-slot-role="phase-body" data-slot-field="phases[${phaseIndex}].body" data-slot-item-id="${escapeHtml(phase.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.phaseBody}" data-slot-max-lines="2" data-ppt-kind="text" data-ppt-name="phase-body-${phaseIndex}">${escapeHtml(phase.body)}</p>
    </div>` : "";
  const contentMarkup = hasInputs ? `<div class="funnel-actions" style="--top:${frame.top}px;--height:${frame.height}px" data-action-count="${phase.content.items.length}" data-slot-id="${escapeHtml(phase.key)}-content" data-slot-role="phase-content" data-slot-field="phases[${phaseIndex}].content" data-slot-item-id="${escapeHtml(phase.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="inline" data-slot-max-chars="${LIMITS.phaseContent}" data-slot-max-lines="6">
      ${phase.content.items.map((action, actionIndex) => actionMarkup(action, phaseIndex, actionIndex)).join("")}
    </div>` : `<div class="funnel-no-input-content" style="--top:${frame.top}px;--height:${frame.height}px;--color:${color}" data-slot-id="${escapeHtml(phase.key)}-content" data-slot-role="phase-content" data-slot-field="phases[${phaseIndex}].content" data-slot-item-id="${escapeHtml(phase.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="inline" data-slot-max-chars="${LIMITS.phaseTitle + LIMITS.phaseBody}" data-slot-max-lines="3">
      <div class="funnel-no-input-index" data-ppt-kind="text" data-ppt-name="phase-index-${phaseIndex}">${indexLabel}</div>
      <div class="funnel-no-input-copy"><h3 data-ppt-kind="text" data-ppt-name="phase-content-title-${phaseIndex}">${escapeHtml(phase.title)}</h3><p data-ppt-kind="text" data-ppt-name="phase-content-body-${phaseIndex}">${escapeHtml(phase.body)}</p></div>
    </div>`;
  return `<div class="funnel-phase-band" style="--top:${frame.top}px;--height:${frame.height}px" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="phase-band-${phaseIndex}"></div>
    <svg class="funnel-phase-rail" style="--top:${frame.top}px;--height:${frame.height}px" viewBox="0 0 54 ${frame.height}" preserveAspectRatio="none" aria-hidden="true">
      <path fill="${color}" d="${phaseRailPath(frame, phaseIndex)}" data-ppt-kind="path" data-ppt-name="phase-rail-${phaseIndex}"/>
    </svg>
    <span class="funnel-phase-label" style="--top:${frame.top}px;--height:${frame.height}px" data-slot-id="${escapeHtml(phase.key)}-label" data-slot-role="phase-label" data-slot-field="phases[${phaseIndex}].label" data-slot-item-id="${escapeHtml(phase.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.phaseLabel}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="phase-label-${phaseIndex}">${escapeHtml(phase.label)}</span>
    ${summaryMarkup}
    ${contentMarkup}`;
}

export const visualComponent = Object.freeze({
  id: "convergence-staged-funnel",
  schemaVersion: 2,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxItemTitleChars: LIMITS.stepTitle,
    maxItemTitleLines: 1,
    maxPhaseTitleChars: LIMITS.phaseTitle,
    maxPhaseBodyChars: LIMITS.phaseBody,
    maxPhaseContentChars: LIMITS.phaseContent,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    const geometry = funnelGeometry(model);
    return `<section class="funnel-review" data-ppt-root data-step-count="${model.totalSteps}" data-phase-count="${model.phases.length}">
      ${model.phases.map((phase, index) => phaseMarkup(phase, geometry.phaseFrames[index], index, model.inputs.length > 0)).join("")}
      <div class="funnel-input-layer">${model.inputs.map((input, index) => inputMarkup(input, index, model.inputs.length)).join("")}</div>
      <svg class="funnel-diagram" viewBox="0 0 ${DESIGN_FRAME.width} ${DESIGN_FRAME.height}" preserveAspectRatio="none" aria-hidden="true">
        ${geometry.steps.map(stepShapeMarkup).join("")}
        ${flowArrowMarkup(geometry)}
      </svg>
      ${geometry.steps.map(stepTextMarkup).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  inputs: [
    { key: "visitor", iconQuery: "user audience" },
    { key: "channel", iconQuery: "speakerphone advertising" },
    { key: "content", iconQuery: "file content" },
    { key: "event", iconQuery: "calendar event" },
    { key: "search", iconQuery: "search discovery" },
    { key: "feedback", iconQuery: "message feedback" },
    { key: "signal", iconQuery: "activity signal" }
  ],
  phases: [
    {
      key: "attract", label: "阶段一", title: "精准触达", body: "让目标对象进入体系",
      steps: [{ key: "reach", title: "广泛触达" }, { key: "interest", title: "兴趣识别" }],
      content: { layout: "icon-title-body-list-example", items: [
        { key: "tag", title: "标签体系", body: "形成可识别对象", iconQuery: "tags" },
        { key: "channel", title: "渠道连接", body: "连接主要触点", iconQuery: "plug connected" },
        { key: "optimize", title: "内容优化", body: "提高触达质量", iconQuery: "adjustments" },
        { key: "track", title: "行为追踪", body: "记录关键反馈", iconQuery: "search analytics" }
      ] }
    },
    {
      key: "cultivate", label: "阶段二", title: "意向培育", body: "让有效关注形成意向",
      steps: [{ key: "intent", title: "意向培育" }, { key: "action", title: "行动转化" }],
      content: { layout: "icon-title-body-list-example", items: [
        { key: "rules", title: "规则触发", body: "自动下发任务", iconQuery: "settings automation" },
        { key: "score", title: "热度评估", body: "识别优先对象", iconQuery: "flame score" }
      ] }
    },
    {
      key: "convert", label: "阶段三", title: "持续转化", body: "让行动沉淀为长期价值",
      steps: [{ key: "retain", title: "持续留存" }, { key: "value", title: "价值增长" }],
      content: { layout: "icon-title-body-list-example", items: [
        { key: "data", title: "数据打通", body: "统一分析对象", iconQuery: "database connected" },
        { key: "group", title: "自动分群", body: "指导持续运营", iconQuery: "users group" }
      ] }
    }
  ]
});

const STEP_DISTRIBUTIONS = Object.freeze({
  2: Object.freeze({ 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3] }),
  3: Object.freeze({ 3: [1, 1, 1], 4: [1, 1, 2], 5: [1, 2, 2], 6: [2, 2, 2] }),
});

export function resolvePreviewParameters(base, selection) {
  const stepCount = Number(selection?.stepCount);
  const phaseCount = Number(selection?.phaseCount ?? 3);
  const inputCount = Number(selection?.inputCount ?? 5);
  const distribution = STEP_DISTRIBUTIONS[phaseCount]?.[stepCount];
  if (!distribution) throw new Error("阶段化输入转化漏斗当前支持 3–6 个漏斗层级与 2–3 个宏观阶段");
  if (!Number.isInteger(inputCount) || inputCount < 0 || inputCount > 7) throw new Error("阶段化输入转化漏斗支持 0–7 个输入图标");
  const result = structuredClone(base);
  result.inputs = result.inputs.slice(0, inputCount);
  const stepPool = result.phases.flatMap((phase) => phase.steps);
  const phaseTemplates = phaseCount === 2
    ? [
        { ...result.phases[0], title: "获取与识别", body: "让目标对象进入并形成意向" },
        { ...result.phases[2], label: "阶段二", title: "培育与转化", body: "让有效意向沉淀为长期价值" },
      ]
    : result.phases;
  let offset = 0;
  result.phases = phaseTemplates.map((phase, index) => {
    const count = distribution[index];
    const steps = stepPool.slice(offset, offset + count);
    offset += count;
    return { ...phase, steps };
  });
  return result;
}
