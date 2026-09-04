import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const PHASE_COLORS = Object.freeze(["#eef4fa", "#e7f0f8", "#dce9f5", "#d1e1f0", "#c5d8eb"]);
const PHASE_TITLE_LIMIT = 8;
const PHASE_BODY_LIMITS = Object.freeze({ 3: 38, 4: 30, 5: 24 });
const GATE_TITLE_LIMIT = 6;
const GATE_BODY_LIMIT = 16;
const MAX_POINTS = 3;
const POINT_LIMIT = 12;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) { return String(value ?? "").trim(); }
function chars(value) { return Array.from(text(value)).length; }
function round(value) { return Math.round(value * 10) / 10; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function normalizePoints(value, field) {
  const points = Array.isArray(value) ? value.map((item) => text(item?.text ?? item)).filter(Boolean) : [];
  if (points.length > MAX_POINTS) throw new Error(`${field} 最多 ${MAX_POINTS} 条`);
  if (points.some((point) => chars(point) > POINT_LIMIT)) throw new Error(`${field} 单条超过 ${POINT_LIMIT} 字`);
  return points;
}

function normalize(parameters) {
  if (!Array.isArray(parameters?.phases) || parameters.phases.length < 3 || parameters.phases.length > 5) {
    throw new Error("阶段门禁流程支持 3–5 个阶段");
  }
  const count = parameters.phases.length;
  if (!Array.isArray(parameters?.gates) || parameters.gates.length !== count - 1) {
    throw new Error("每两个相邻阶段之间必须且只能有一个门禁");
  }
  const phaseBodyLimit = PHASE_BODY_LIMITS[count];
  const phases = parameters.phases.map((phase, index) => {
    const title = text(phase?.title);
    const body = text(phase?.body);
    const points = normalizePoints(phase?.points, `phases[${index}].points`);
    if (!title && !body && !points.length) throw new Error(`phases[${index}] 至少需要一种文字内容`);
    if (chars(title) > PHASE_TITLE_LIMIT) throw new Error(`phases[${index}].title 超过 ${PHASE_TITLE_LIMIT} 字`);
    if (chars(body) > phaseBodyLimit) throw new Error(`phases[${index}].body 超过 ${phaseBodyLimit} 字`);
    return { key: text(phase?.key) || `phase-${index + 1}`, title, body, points };
  });
  const gates = parameters.gates.map((gate, index) => {
    const title = text(gate?.title);
    const body = text(gate?.body);
    if (!title && !body) throw new Error(`gates[${index}] 至少需要 title 或 body`);
    if (chars(title) > GATE_TITLE_LIMIT) throw new Error(`gates[${index}].title 超过 ${GATE_TITLE_LIMIT} 字`);
    if (chars(body) > GATE_BODY_LIMIT) throw new Error(`gates[${index}].body 超过 ${GATE_BODY_LIMIT} 字`);
    return { key: text(gate?.key) || `gate-${index + 1}`, title, body };
  });
  return {
    phases,
    gates,
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function cubicPoint(points, t) {
  const [p0, p1, p2, p3] = points;
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function cubicTangent(points, t) {
  const [p0, p1, p2, p3] = points;
  const u = 1 - t;
  return {
    x: 3 * u ** 2 * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t ** 2 * (p3.x - p2.x),
    y: 3 * u ** 2 * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t ** 2 * (p3.y - p2.y),
  };
}

const CURVE_A = Object.freeze([
  Object.freeze({ x: 72, y: 374 }),
  Object.freeze({ x: 245, y: 438 }),
  Object.freeze({ x: 330, y: 263 }),
  Object.freeze({ x: 520, y: 270 }),
]);
const CURVE_B = Object.freeze([
  Object.freeze({ x: 520, y: 270 }),
  Object.freeze({ x: 718, y: 277 }),
  Object.freeze({ x: 770, y: 125 }),
  Object.freeze({ x: 1060, y: 112 }),
]);
const CURVE_SPLIT = 0.52;

function flowPoint(progress) {
  const t = clamp(progress, 0, 1);
  if (t <= CURVE_SPLIT) return cubicPoint(CURVE_A, t / CURVE_SPLIT);
  return cubicPoint(CURVE_B, (t - CURVE_SPLIT) / (1 - CURVE_SPLIT));
}

function flowFrame(progress) {
  const t = clamp(progress, 0, 1);
  const tangentRaw = t <= CURVE_SPLIT
    ? cubicTangent(CURVE_A, t / CURVE_SPLIT)
    : cubicTangent(CURVE_B, (t - CURVE_SPLIT) / (1 - CURVE_SPLIT));
  const length = Math.hypot(tangentRaw.x, tangentRaw.y) || 1;
  const tangent = { x: tangentRaw.x / length, y: tangentRaw.y / length };
  return {
    center: flowPoint(t),
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    halfWidth: 70 - 33 * t,
  };
}

function offset(point, vector, distance) {
  return { x: point.x + vector.x * distance, y: point.y + vector.y * distance };
}

function pointString(point) { return `${round(point.x)} ${round(point.y)}`; }

function ribbonPath(start, end, { extraWidth = 0, arrow = false } = {}) {
  const steps = Math.max(5, Math.ceil((end - start) * 28));
  const left = [];
  const right = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = start + ((end - start) * index) / steps;
    const frame = flowFrame(t);
    const width = frame.halfWidth + extraWidth;
    left.push(offset(frame.center, frame.normal, width));
    right.push(offset(frame.center, frame.normal, -width));
  }
  const commands = [`M ${pointString(left[0])}`, ...left.slice(1).map((point) => `L ${pointString(point)}`)];
  if (arrow) {
    const frame = flowFrame(end);
    const baseWidth = frame.halfWidth + extraWidth + 13;
    const arrowBaseLeft = offset(frame.center, frame.normal, baseWidth);
    const arrowBaseRight = offset(frame.center, frame.normal, -baseWidth);
    const tip = offset(frame.center, frame.tangent, 72 + extraWidth * 0.6);
    commands.push(`L ${pointString(arrowBaseLeft)}`, `L ${pointString(tip)}`, `L ${pointString(arrowBaseRight)}`);
  }
  commands.push(...right.reverse().map((point) => `L ${pointString(point)}`), "Z");
  return commands.join(" ");
}

function geometry(count) {
  const phaseTextWidth = count === 3 ? 232 : count === 4 ? 202 : 174;
  const phaseTextHeight = count === 5 ? 82 : 92;
  const gateTextWidth = count === 5 ? 154 : 174;
  const phases = Array.from({ length: count }, (_, index) => {
    const start = index / count;
    const end = (index + 1) / count;
    const mid = (start + end) / 2;
    const frame = flowFrame(mid);
    const bias = count === 5 && index === count - 1 ? { x: -10, y: -3 } : { x: 0, y: 0 };
    return {
      start,
      end,
      mid,
      center: frame.center,
      textLeft: clamp(frame.center.x - phaseTextWidth / 2 + bias.x, 12, DESIGN_FRAME.width - phaseTextWidth - 12),
      textTop: clamp(frame.center.y - phaseTextHeight / 2 + bias.y, 12, DESIGN_FRAME.height - phaseTextHeight - 12),
      textWidth: phaseTextWidth,
      textHeight: phaseTextHeight,
    };
  });
  const gates = Array.from({ length: count - 1 }, (_, index) => {
    const progress = (index + 1) / count;
    const frame = flowFrame(progress);
    const side = index % 2 === 0 ? -1 : 1;
    const labelCenter = offset(frame.center, frame.normal, side * (frame.halfWidth + 92));
    const labelTopNudge = side < 0 ? -12 : 6;
    return {
      progress,
      ...frame,
      gateDepth: 28 - 8 * progress,
      labelLeft: clamp(labelCenter.x - gateTextWidth / 2, 8, DESIGN_FRAME.width - gateTextWidth - 8),
      labelTop: clamp(labelCenter.y - 40 + labelTopNudge, 8, DESIGN_FRAME.height - 78),
      labelWidth: gateTextWidth,
      labelHeight: 74,
      side,
    };
  });
  return { phases, gates };
}

function phaseMarkup(phase, index, model, g) {
  const frame = g.phases[index];
  const slotId = `phase-${phase.key}-content`;
  const layoutId = text(model.textLayoutBindings?.[slotId]) || "heading-content-flow";
  const region = textRegionMarkup({
    id: slotId,
    field: `phases[${index}]`,
    itemId: phase.key,
    regionId: "phase-content",
    layoutId,
    compatibleLayoutIds: ["heading-content-flow", "statement-flow", "structured-list-flow"],
    content: { title: phase.title, body: phase.body, points: phase.points },
    className: "phase-content",
    align: "center",
    valign: "middle",
    density: "compact",
    required: true,
    names: { heading: `phase-title-${index + 1}`, body: `phase-body-${index + 1}`, list: `phase-points-${index + 1}` },
  }).replace(
    'class="ppagent-text-region phase-content"',
    `class="ppagent-text-region phase-content" style="left:${round(frame.textLeft)}px;top:${round(frame.textTop)}px;width:${frame.textWidth}px;height:${frame.textHeight}px"`,
  );
  return `<article class="phase-segment" data-phase-key="${escapeHtml(phase.key)}">
    <div class="phase-index" style="left:${round(frame.textLeft)}px;top:${round(frame.textTop - 21)}px;width:${frame.textWidth}px" data-ppt-kind="text" data-ppt-name="phase-${index + 1}-index">${String(index + 1).padStart(2, "0")}</div>
    ${region}
  </article>`;
}

function gateShapeMarkup(frame, index) {
  const span = frame.halfWidth + 3;
  const baseA = offset(frame.center, frame.normal, span);
  const baseB = offset(frame.center, frame.normal, -span);
  const backA = offset(baseA, frame.tangent, -frame.gateDepth / 2);
  const frontA = offset(baseA, frame.tangent, frame.gateDepth / 2);
  const backB = offset(baseB, frame.tangent, -frame.gateDepth / 2);
  const frontB = offset(baseB, frame.tangent, frame.gateDepth / 2);
  const topCenter = offset(frame.center, frame.normal, frame.side * 3);
  const plateWidth = 42 - frame.progress * 7;
  const plateHeight = 29 - frame.progress * 4;
  const capHalf = frame.gateDepth / 2 + 3;
  const capThickness = 7;
  const stemHalf = 3.2;
  const localPoint = (u, v) => offset(offset(frame.center, frame.tangent, u), frame.normal, v);
  const iBeam = [
    localPoint(-capHalf, span),
    localPoint(capHalf, span),
    localPoint(capHalf, span - capThickness),
    localPoint(stemHalf, span - capThickness),
    localPoint(stemHalf, -span + capThickness),
    localPoint(capHalf, -span + capThickness),
    localPoint(capHalf, -span),
    localPoint(-capHalf, -span),
    localPoint(-capHalf, -span + capThickness),
    localPoint(-stemHalf, -span + capThickness),
    localPoint(-stemHalf, span - capThickness),
    localPoint(-capHalf, span - capThickness),
  ];
  const lineEnd = frame.side < 0
    ? { x: frame.labelLeft + frame.labelWidth * 0.5, y: frame.labelTop + frame.labelHeight }
    : { x: frame.labelLeft + frame.labelWidth * 0.5, y: frame.labelTop };
  return `<svg class="gate-geometry" viewBox="0 0 ${DESIGN_FRAME.width} ${DESIGN_FRAME.height}" preserveAspectRatio="none" aria-hidden="true">
    <path class="gate-plane" data-ppt-kind="path" data-ppt-name="gate-${index + 1}-plane" d="M ${pointString(backA)} L ${pointString(backB)} L ${pointString(frontB)} L ${pointString(frontA)} Z"></path>
    <path class="gate-i-beam" data-ppt-kind="path" data-ppt-name="gate-${index + 1}-i-beam" d="M ${iBeam.map(pointString).join(" L ")} Z"></path>
    <path class="gate-label-link" data-ppt-kind="path" data-ppt-name="gate-${index + 1}-label-link" d="M ${pointString(topCenter)} L ${pointString(lineEnd)}"></path>
  </svg>
  <div class="gate-check" style="left:${round(topCenter.x - plateWidth / 2)}px;top:${round(topCenter.y - plateHeight / 2)}px;width:${round(plateWidth)}px;height:${round(plateHeight)}px" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="gate-${index + 1}-check">✓</div>`;
}

function gateMarkup(gate, index, model, g) {
  const frame = g.gates[index];
  const slotId = `gate-${gate.key}-content`;
  const layoutId = text(model.textLayoutBindings?.[slotId]) || "heading-content-flow";
  const region = textRegionMarkup({
    id: slotId,
    field: `gates[${index}]`,
    itemId: gate.key,
    regionId: "gate-criterion",
    layoutId,
    compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
    content: { title: gate.title, body: gate.body },
    className: "gate-content",
    align: "center",
    valign: "middle",
    density: "compact",
    required: true,
    names: { heading: `gate-title-${index + 1}`, body: `gate-body-${index + 1}` },
  }).replace(
    'class="ppagent-text-region gate-content"',
    `class="ppagent-text-region gate-content" style="left:${round(frame.labelLeft)}px;top:${round(frame.labelTop)}px;width:${frame.labelWidth}px;height:${frame.labelHeight}px"`,
  );
  return `<article class="gate" data-gate-key="${escapeHtml(gate.key)}">
    ${gateShapeMarkup(frame, index)}
    <div class="gate-tag" style="left:${round(frame.labelLeft)}px;top:${round(frame.labelTop - 19)}px;width:${frame.labelWidth}px" data-ppt-kind="text" data-ppt-name="gate-${index + 1}-tag">门禁 ${String(index + 1).padStart(2, "0")}</div>
    <div class="gate-content-surface" style="left:${round(frame.labelLeft)}px;top:${round(frame.labelTop)}px;width:${frame.labelWidth}px;height:${frame.labelHeight}px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="gate-${index + 1}-content-surface"></div>
    ${region}
  </article>`;
}

function flowMarkup(count, g) {
  const halo = ribbonPath(0, 1, { extraWidth: 9, arrow: true });
  const centerLinePoints = Array.from({ length: 33 }, (_, index) => flowPoint(index / 32));
  const centerLine = centerLinePoints.map((point, index) => `${index ? "L" : "M"} ${pointString(point)}`).join(" ");
  return `<svg class="flow-geometry" viewBox="0 0 ${DESIGN_FRAME.width} ${DESIGN_FRAME.height}" preserveAspectRatio="none" aria-hidden="true">
    <path class="flow-bank" data-ppt-kind="path" data-ppt-name="flow-bank" d="${halo}"></path>
    ${g.phases.map((phase, index) => `<path class="flow-phase" style="fill:${PHASE_COLORS[index]}" data-ppt-kind="path" data-ppt-name="flow-phase-${index + 1}" d="${ribbonPath(phase.start, phase.end, { arrow: index === count - 1 })}"></path>`).join("")}
    <path class="flow-centerline" data-ppt-kind="path" data-ppt-name="flow-centerline" d="${centerLine}"></path>
  </svg>`;
}

export const visualComponent = Object.freeze({
  id: "sequence-phase-gates",
  schemaVersion: 2,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  textCapacity: Object.freeze({
    maxItemTitleChars: PHASE_TITLE_LIMIT,
    maxItemBodyChars: PHASE_BODY_LIMITS,
    maxPointsPerItem: MAX_POINTS,
    maxPointChars: POINT_LIMIT,
    phaseTitleChars: PHASE_TITLE_LIMIT,
    phaseBodyCharsByState: PHASE_BODY_LIMITS,
    phasePoints: `${MAX_POINTS} 条，每条 ${POINT_LIMIT} 字`,
    gateTitleChars: GATE_TITLE_LIMIT,
    gateBodyChars: GATE_BODY_LIMIT,
  }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const g = geometry(model.phases.length);
    return `<section class="phase-gates-review" data-ppt-root data-phase-count="${model.phases.length}">
      ${flowMarkup(model.phases.length, g)}
      ${model.phases.map((phase, index) => phaseMarkup(phase, index, model, g)).join("")}
      ${model.gates.map((gate, index) => gateMarkup(gate, index, model, g)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  phases: Object.freeze([
    Object.freeze({ key: "define", title: "目标定义", body: "明确范围、对象与预期成果" }),
    Object.freeze({ key: "design", title: "方案设计", body: "形成路径并完成关键论证" }),
    Object.freeze({ key: "pilot", title: "试点验证", body: "在真实场景中检验可行性" }),
    Object.freeze({ key: "deliver", title: "推广交付", body: "按统一标准扩大应用范围" }),
    Object.freeze({ key: "operate", title: "持续运营", body: "跟踪效果并迭代优化机制" }),
  ]),
  gates: Object.freeze([
    Object.freeze({ key: "scope-review", title: "范围评审", body: "目标与边界已确认" }),
    Object.freeze({ key: "plan-review", title: "方案评审", body: "资源与路径可执行" }),
    Object.freeze({ key: "pilot-review", title: "试点评审", body: "结果达到推广门槛" }),
    Object.freeze({ key: "release-review", title: "交付评审", body: "质量与责任已闭环" }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const phaseCount = Number(selection?.phaseCount ?? 4);
  if (!Number.isInteger(phaseCount) || phaseCount < 3 || phaseCount > 5) throw new Error("阶段数支持 3–5");
  const result = structuredClone(base);
  result.phases = result.phases.slice(0, phaseCount);
  result.gates = result.gates.slice(0, phaseCount - 1);
  return result;
}
