export const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
export const SOURCE_FRAME = Object.freeze({ left: 55, top: 166, width: 1170, height: 492 });
export const RING_FRAME = Object.freeze({ left: 345, top: 6, width: 480, height: 480 });
export const RING = Object.freeze({ center: 240, outer: 226, inner: 148, breath: 12, arrowReach: 78, arrowHalf: 39, core: 76 });
export const COLORS = Object.freeze(["#344e9a", "#4168b2", "#5b91cb", "#63a1d7", "#527fbd", "#385fa4"]);
export const SUPPORT_PANEL = Object.freeze({
  width: 520,
  outerPadding: 28,
  dense: Object.freeze({ height: 220, gap: 52, innerPadding: 205, verticalPadding: 16 }),
  compact: Object.freeze({ height: 156, gap: 12, innerPadding: 190, verticalPadding: 10 }),
});

function text(value) {
  return String(value ?? "").trim();
}

function pointRows(step) {
  return Array.isArray(step?.points)
    ? step.points.map((point) => text(point?.text ?? point)).filter(Boolean)
    : [];
}

export function normalizeCycleParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.steps)) throw new Error("循环闭环需要 steps 数组");
  const count = parameters.steps.length;
  if (count < 3 || count > 6) throw new Error("循环闭环支持 3–6 个步骤");
  const steps = parameters.steps.map((step, index) => {
    const title = text(step?.title || `步骤${index + 1}`);
    const english = text(step?.english);
    const body = text(step?.body);
    const points = pointRows(step);
    if (!title) throw new Error(`steps[${index}].title 不能为空`);
    if (title.length > 8) throw new Error(`steps[${index}].title 超过 8 字`);
    if (body.length > 14) throw new Error(`steps[${index}].body 超过 14 字`);
    if (points.length > 4) throw new Error(`steps[${index}].points 最多 4 条`);
    if (points.some((point) => point.length > 14)) throw new Error(`steps[${index}].points 单条超过 14 字`);
    if (!body && !points.length) throw new Error(`steps[${index}] 至少需要 body 或一条 points`);
    if ((Array.isArray(step?.details) && step.details.length) || (Array.isArray(step?.metrics) && step.metrics.length)) {
      throw new Error(`steps[${index}] 基础循环只接受 body/points；标签、说明和指标属于独立的嵌套 Structure Group`);
    }
    return {
      key: text(step?.key) || `step-${index + 1}`,
      title,
      english,
      body,
      points,
      copyLines: [body, ...points].filter(Boolean),
    };
  });
  const centerText = text(parameters.center ?? parameters.title);
  if (centerText.length > 12) throw new Error("center 超过 12 字");
  const centerTokens = centerText.split(/\s+/u).filter(Boolean);
  if (centerTokens.length > 2 || centerTokens.some((line) => line.length > 6)) throw new Error("center 最多两行且每行不超过 6 字");
  const center = centerTokens.length === 1 && centerTokens[0].length > 6
    ? [centerTokens[0].slice(0, Math.ceil(centerTokens[0].length / 2)), centerTokens[0].slice(Math.ceil(centerTokens[0].length / 2))]
    : centerTokens;
  return {
    title: text(parameters.title) || "循环闭环",
    centerLabel: center.length ? center : ["持续改进", "循环"],
    steps,
    density: count <= 4 ? "dense" : "compact",
  };
}

export function point(radius, degrees) {
  const radians = degrees * Math.PI / 180;
  return { x: RING.center + radius * Math.cos(radians), y: RING.center + radius * Math.sin(radians) };
}

export function readableTangent(degrees) {
  const rotation = degrees + 90;
  return rotation > 90 && rotation < 270 ? rotation + 180 : rotation;
}

export function ringItems(steps) {
  const sweep = 360 / steps.length;
  return steps.map((step, index) => {
    const start = 180 + index * sweep;
    const end = start + sweep;
    const middle = start + sweep / 2;
    const numberAngle = end - sweep * 0.18;
    const base = point(RING.outer - (RING.outer - RING.inner) / 2, end);
    const radians = end * Math.PI / 180;
    const radial = { x: Math.cos(radians), y: Math.sin(radians) };
    const tangent = { x: -Math.sin(radians), y: Math.cos(radians) };
    return {
      step,
      index,
      color: COLORS[index],
      start,
      end,
      middle,
      number: { ...point(RING.outer - (RING.outer - RING.inner) * 0.62, numberAngle), rotation: 0 },
      title: { ...point(RING.outer - (RING.outer - RING.inner) * 0.5, middle), rotation: readableTangent(middle) },
      english: { ...point(RING.inner * 0.58, middle), rotation: readableTangent(middle) },
      arrow: {
        outer: { x: base.x + radial.x * RING.arrowHalf, y: base.y + radial.y * RING.arrowHalf },
        tip: { x: base.x + tangent.x * RING.arrowReach, y: base.y + tangent.y * RING.arrowReach },
        inner: { x: base.x - radial.x * RING.arrowHalf, y: base.y - radial.y * RING.arrowHalf },
      },
    };
  });
}

export function svgBandPath(item) {
  const outerStart = point(RING.outer, item.start);
  const outerEnd = point(RING.outer, item.end);
  const innerEnd = point(RING.inner, item.end);
  const innerStart = point(RING.inner, item.start);
  const large = item.end - item.start > 180 ? 1 : 0;
  return `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)} A ${RING.outer} ${RING.outer} 0 ${large} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)} L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)} A ${RING.inner} ${RING.inner} 0 ${large} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)} Z`;
}

export function customBandPath(item) {
  const sweep = item.end - item.start;
  const segments = Math.max(16, Math.ceil(sweep / 4));
  const outer = Array.from({ length: segments + 1 }, (_, index) => point(RING.outer, item.start + sweep * index / segments));
  const inner = Array.from({ length: segments + 1 }, (_, index) => point(RING.inner, item.end - sweep * index / segments));
  return [{
    width: RING_FRAME.width,
    height: RING_FRAME.height,
    commands: [
      { moveTo: outer[0] },
      ...outer.slice(1).map((lineTo) => ({ lineTo })),
      ...inner.map((lineTo) => ({ lineTo })),
      { close: {} },
    ],
  }];
}

export function customArrowPath(item) {
  return [{
    width: RING_FRAME.width,
    height: RING_FRAME.height,
    commands: [
      { moveTo: item.arrow.outer },
      { lineTo: item.arrow.tip },
      { lineTo: item.arrow.inner },
      { close: {} },
    ],
  }];
}

export function panelItems(steps) {
  const sweep = 360 / steps.length;
  const bySide = { left: [], right: [] };
  steps.forEach((step, index) => {
    const middle = 180 + (index + 0.5) * sweep;
    const radians = middle * Math.PI / 180;
    const side = Math.cos(radians) < 0 ? "left" : "right";
    bySide[side].push({ step, index, side, vertical: Math.sin(radians) });
  });
  const result = [];
  for (const side of ["left", "right"]) {
    const items = bySide[side].sort((left, right) => left.vertical - right.vertical);
    const compact = items.length >= 3;
    const profile = compact ? SUPPORT_PANEL.compact : SUPPORT_PANEL.dense;
    items.forEach((item, row) => {
      const frame = {
        left: side === "left" ? 0 : DESIGN_FRAME.width - SUPPORT_PANEL.width,
        top: row * (profile.height + profile.gap),
        width: SUPPORT_PANEL.width,
        height: profile.height,
      };
      result.push({
        ...item,
        frame,
        slotFrame: {
          left: frame.left + (side === "left" ? SUPPORT_PANEL.outerPadding : profile.innerPadding),
          top: frame.top + profile.verticalPadding,
          width: frame.width - profile.innerPadding - SUPPORT_PANEL.outerPadding,
          height: frame.height - profile.verticalPadding * 2,
        },
        compact,
      });
    });
  }
  return result;
}

export function componentToSlide(frame) {
  return {
    left: SOURCE_FRAME.left + frame.left,
    top: SOURCE_FRAME.top + frame.top,
    width: frame.width,
    height: frame.height,
  };
}
