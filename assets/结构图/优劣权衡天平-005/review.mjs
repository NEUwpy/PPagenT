import { textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const MIN_ITEMS = 2;
const MAX_ITEMS = 4;
const TOPIC_LIMIT = 24;
const ITEM_LIMIT = 16;
const VERDICT_LIMIT = 36;

const BALANCE_STATES = Object.freeze({
  "收益侧更重": Object.freeze({ key: "benefit", leftBeamY: 151, rightBeamY: 129, leftPanTop: 222, rightPanTop: 194 }),
  "基本平衡": Object.freeze({ key: "balanced", leftBeamY: 140, rightBeamY: 140, leftPanTop: 208, rightPanTop: 208 }),
  "风险侧更重": Object.freeze({ key: "risk", leftBeamY: 129, rightBeamY: 151, leftPanTop: 194, rightPanTop: 222 }),
});

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(value).length;
}

function requireText(value, maxChars, field) {
  const resolved = text(value);
  if (!resolved || charCount(resolved) > maxChars) {
    throw new Error(`${field} 需要 1–${maxChars} 字`);
  }
  return resolved;
}

function requireItems(value, field) {
  if (!Array.isArray(value) || value.length < MIN_ITEMS || value.length > MAX_ITEMS) {
    throw new Error(`${field} 需要 ${MIN_ITEMS}–${MAX_ITEMS} 项`);
  }
  return value.map((item, index) => requireText(item, ITEM_LIMIT, `${field}[${index}]`));
}

function normalizeParameters(parameters) {
  const stateLabel = text(parameters?.balanceState) || "基本平衡";
  const geometry = BALANCE_STATES[stateLabel];
  if (!geometry) throw new Error(`balanceState 不支持：${stateLabel}`);
  return {
    topic: requireText(parameters?.topic, TOPIC_LIMIT, "topic"),
    pros: requireItems(parameters?.pros, "pros"),
    cons: requireItems(parameters?.cons, "cons"),
    verdict: requireText(parameters?.verdict, VERDICT_LIMIT, "verdict"),
    stateLabel,
    geometry,
  };
}

function pointOnBeam(x, geometry) {
  const startX = 168;
  const endX = 1002;
  const ratio = (x - startX) / (endX - startX);
  return geometry.leftBeamY + (geometry.rightBeamY - geometry.leftBeamY) * ratio;
}

function beamPath(geometry) {
  const x1 = 168;
  const x2 = 1002;
  const y1 = geometry.leftBeamY;
  const y2 = geometry.rightBeamY;
  return `M ${x1} ${y1 - 5} L ${x2} ${y2 - 5} L ${x2} ${y2 + 5} L ${x1} ${y1 + 5} Z`;
}

function panPath(left, top) {
  const right = left + 410;
  const center = left + 205;
  const bottom = top + 207;
  return `M ${left} ${top} L ${right} ${top} C ${right - 8} ${top + 118} ${right - 82} ${bottom} ${center} ${bottom} C ${left + 82} ${bottom} ${left + 8} ${top + 118} ${left} ${top} Z`;
}

function hangerPaths(anchorX, panLeft, panTop, geometry) {
  const anchorY = pointOnBeam(anchorX, geometry);
  return [
    `M ${anchorX} ${anchorY + 2} L ${panLeft + 42} ${panTop + 2}`,
    `M ${anchorX} ${anchorY + 2} L ${panLeft + 368} ${panTop + 2}`,
  ];
}

function sideFlow(field, title, points, side) {
  return textFlowMarkup({
    id: `${side}-content`,
    field,
    regionId: `${side}-pan`,
    title,
    body: points.join("\n"),
    className: `balance-side-flow balance-side-flow--${side}`,
    align: "center",
    valign: "middle",
    separator: true,
    names: {
      title: `${side}-heading`,
      body: `${side}-points`,
      separator: `${side}-separator`,
    },
  });
}

function topicFlow(topic) {
  return textFlowMarkup({
    id: "balance-topic",
    field: "topic",
    regionId: "topic",
    title: topic,
    className: "balance-topic-flow",
    align: "center",
    valign: "middle",
  });
}

function verdictFlow(verdict) {
  return textFlowMarkup({
    id: "balance-verdict",
    field: "verdict",
    regionId: "fulcrum",
    title: "综合判断",
    body: verdict,
    className: "balance-verdict-flow",
    align: "center",
    valign: "middle",
    separator: true,
  });
}

function geometryMarkup(model) {
  const { geometry } = model;
  const leftPan = { left: 28, top: geometry.leftPanTop };
  const rightPan = { left: 732, top: geometry.rightPanTop };
  const leftHangers = hangerPaths(264, leftPan.left, leftPan.top, geometry);
  const rightHangers = hangerPaths(906, rightPan.left, rightPan.top, geometry);
  const jointY = (geometry.leftBeamY + geometry.rightBeamY) / 2;
  return `<svg class="balance-geometry" viewBox="0 0 1170 492" aria-hidden="true">
    <path d="${panPath(leftPan.left + 7, leftPan.top + 9)}" fill="#cbd8e0" opacity="0.38" data-ppt-kind="path" data-ppt-name="benefit-pan-shadow" />
    <path d="${panPath(rightPan.left + 7, rightPan.top + 9)}" fill="#cbd8e0" opacity="0.38" data-ppt-kind="path" data-ppt-name="risk-pan-shadow" />
    ${[...leftHangers, ...rightHangers].map((path, index) => `<path d="${path}" fill="none" stroke="#7f9aac" stroke-width="3" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="balance-hanger-${index + 1}" />`).join("")}
    <path d="${panPath(leftPan.left, leftPan.top)}" fill="#dbe9f0" stroke="#789db4" stroke-width="3" data-ppt-kind="path" data-ppt-name="benefit-pan" />
    <path d="${panPath(rightPan.left, rightPan.top)}" fill="#e5ebef" stroke="#94a8b5" stroke-width="3" data-ppt-kind="path" data-ppt-name="risk-pan" />
    <path d="M ${leftPan.left + 18} ${leftPan.top + 7} L ${leftPan.left + 392} ${leftPan.top + 7}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="benefit-rim-highlight" />
    <path d="M ${rightPan.left + 18} ${rightPan.top + 7} L ${rightPan.left + 392} ${rightPan.top + 7}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="risk-rim-highlight" />
    <path d="M 558 ${jointY + 16} L 612 ${jointY + 16} L 785 466 L 385 466 Z" fill="#d9e6ed" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" data-ppt-kind="path" data-ppt-name="balance-fulcrum" />
    <path d="M 558 ${jointY + 16} L 585 ${jointY + 16} L 585 466 L 385 466 Z" fill="#c4d7e2" stroke="none" data-ppt-kind="path" data-ppt-name="balance-fulcrum-facet" />
    <path d="${beamPath(geometry)}" fill="#486f8b" data-ppt-kind="path" data-ppt-name="balance-beam" />
    <circle cx="585" cy="${jointY}" r="24" fill="#ffffff" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="balance-joint-ring" />
    <circle cx="585" cy="${jointY}" r="17" fill="#527d99" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="balance-joint-core" />
  </svg>`;
}

export const visualComponent = Object.freeze({
  id: "comparison-pros-cons-balance",
  schemaVersion: 5,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxTopicChars: TOPIC_LIMIT,
    maxItemChars: ITEM_LIMIT,
    maxVerdictChars: VERDICT_LIMIT,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="balance-review" data-ppt-root data-balance-state="${model.geometry.key}" data-pros-count="${model.pros.length}" data-cons-count="${model.cons.length}">
      ${geometryMarkup(model)}
      <div class="balance-topic-kicker" data-ppt-kind="text" data-ppt-name="balance-topic-kicker">决策权衡</div>
      <div class="balance-topic-region">${topicFlow(model.topic)}</div>
      <div class="balance-side-region balance-side-region--left" style="--pan-top:${model.geometry.leftPanTop}px">${sideFlow("pros", "收益", model.pros, "benefit")}</div>
      <div class="balance-side-region balance-side-region--right" style="--pan-top:${model.geometry.rightPanTop}px">${sideFlow("cons", "代价与风险", model.cons, "risk")}</div>
      <div class="balance-verdict-region">${verdictFlow(model.verdict)}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  topic: "是否采用 HTML 作为单一布局源",
  pros: ["数量状态可以响应扩散", "审美结果可直接审核", "布局能够机械编译", "运行期无需重新设计"],
  cons: ["复杂样式需要限制", "媒体依赖必须声明", "编译边界仍需完善", "候选资产需要人工确认"],
  verdict: "收益更具长期价值，但必须以审核组件和明确失败边界为前提",
  balanceState: "收益侧更重",
});

export function resolvePreviewParameters(base, selection) {
  const result = structuredClone(base);
  const legacyCount = Number(selection?.itemCount);
  const prosCount = Number(selection?.prosCount ?? (Number.isInteger(legacyCount) ? legacyCount : 3));
  const consCount = Number(selection?.consCount ?? (Number.isInteger(legacyCount) ? legacyCount : 3));
  if (!Number.isInteger(prosCount) || prosCount < MIN_ITEMS || prosCount > MAX_ITEMS) throw new Error(`收益要点支持 ${MIN_ITEMS}–${MAX_ITEMS} 项`);
  if (!Number.isInteger(consCount) || consCount < MIN_ITEMS || consCount > MAX_ITEMS) throw new Error(`风险要点支持 ${MIN_ITEMS}–${MAX_ITEMS} 项`);
  const balanceState = text(selection?.balanceState) || result.balanceState;
  if (!BALANCE_STATES[balanceState]) throw new Error(`不支持的结论倾向：${balanceState}`);
  result.pros = result.pros.slice(0, prosCount);
  result.cons = result.cons.slice(0, consCount);
  result.balanceState = balanceState;
  return result;
}
