export const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
export const SOURCE_FRAME = Object.freeze({ left: 55, top: 166, width: 1170, height: 492 });
export const RING_FRAME = Object.freeze({ left: 345, top: 6, width: 480, height: 480 });
export const RING = Object.freeze({ center: 240, outer: 226, inner: 148, breath: 12, arrowReach: 78, arrowHalf: 39, core: 76 });
export const COLORS = Object.freeze(["#344e9a", "#4168b2", "#5b91cb", "#63a1d7", "#527fbd", "#385fa4"]);
export const CYCLE_TEXT_LIMITS = Object.freeze({
  center: Object.freeze({ maxChars: 12, maxLines: 2 }),
  title: Object.freeze({ maxChars: 8, maxLines: 1 }),
  body: Object.freeze({ maxChars: 64, maxLines: 5 }),
  point: Object.freeze({ maxChars: 14, maxLines: 1 }),
});
export const SUPPORT_PANEL = Object.freeze({
  width: 520,
  outerPadding: 28,
  dense: Object.freeze({ height: 220, gap: 52, innerPadding: 205, verticalPadding: 16 }),
  compact: Object.freeze({ height: 156, gap: 12, innerPadding: 190, verticalPadding: 10 }),
});

/**
 * Solve the cycle's own spatial layout. The default frame deliberately keeps
 * the approved geometry byte-for-byte compatible; smaller frames get a
 * narrower support panel and a recomputed ring rather than an affine crop.
 */
export function resolveCycleLayout(frame = DESIGN_FRAME) {
  const width = Number(frame?.width ?? DESIGN_FRAME.width);
  const height = Number(frame?.height ?? DESIGN_FRAME.height);
  if (width === DESIGN_FRAME.width && height === DESIGN_FRAME.height) {
    return {
      frame: { width, height },
      ringFrame: RING_FRAME,
      ring: RING,
      supportPanel: SUPPORT_PANEL,
      adaptive: false,
    };
  }
  const gap = Math.max(10, Math.min(24, width * 0.022));
  const ringSize = Math.max(220, Math.min(height - 20, width * 0.46));
  const ringFrame = {
    left: (width - ringSize) / 2,
    top: (height - ringSize) / 2,
    width: ringSize,
    height: ringSize,
  };
  const outer = ringSize / 2 - Math.max(8, ringSize * 0.018);
  const inner = Math.max(outer * 0.56, outer - Math.min(78, ringSize * 0.2));
  const supportWidth = Math.max(160, Math.min(300, (width - ringSize - gap * 2) / 2));
  const outerPadding = Math.max(10, Math.min(28, supportWidth * 0.055));
  const innerPadding = Math.max(54, Math.min(supportWidth * 0.42, ringSize * 0.36));
  const compactHeight = Math.max(64, Math.min(112, (height - gap * 2) / 3));
  const denseHeight = Math.max(82, Math.min(156, (height - gap) / 2));
  const ring = {
    center: ringSize / 2,
    outer,
    inner,
    breath: Math.max(8, ringSize * 0.025),
    arrowReach: Math.min(outer * 0.42, 66),
    arrowHalf: Math.min(outer * 0.22, 34),
    core: Math.max(54, Math.min(outer * 0.34, 78)),
  };
  return {
    frame: { width, height },
    ringFrame,
    ring,
    supportPanel: {
      width: supportWidth,
      outerPadding,
      dense: { height: denseHeight, gap, innerPadding, verticalPadding: Math.max(8, height * 0.028) },
      compact: { height: compactHeight, gap: Math.max(8, gap * 0.7), innerPadding, verticalPadding: Math.max(7, height * 0.022) },
    },
    adaptive: true,
  };
}

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
    const title = text(step?.title);
    const english = text(step?.english);
    const body = text(step?.body);
    const points = pointRows(step);
    if (title.length > CYCLE_TEXT_LIMITS.title.maxChars) throw new Error(`steps[${index}].title 超过 ${CYCLE_TEXT_LIMITS.title.maxChars} 字`);
    if (!body && !points.length) throw new Error(`steps[${index}] 至少需要 body 或一条 points`);
    const supportText = [body, ...points.map((point) => `• ${point}`)].filter(Boolean).join("\n");
    if ((Array.isArray(step?.details) && step.details.length) || (Array.isArray(step?.metrics) && step.metrics.length)) {
      throw new Error(`steps[${index}] 基础循环只接受 body/points；标签、说明和指标属于独立的嵌套 Structure Group`);
    }
    return {
      key: text(step?.key) || `step-${index + 1}`,
      title,
      english,
      body,
      points,
      supportText,
      copyLines: [body, ...points].filter(Boolean),
    };
  });
  const centerText = text(parameters.center ?? parameters.title);
  if (centerText.length > CYCLE_TEXT_LIMITS.center.maxChars) throw new Error(`center 超过 ${CYCLE_TEXT_LIMITS.center.maxChars} 字`);
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
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

export function point(radius, degrees, ring = RING) {
  const radians = degrees * Math.PI / 180;
  return { x: ring.center + radius * Math.cos(radians), y: ring.center + radius * Math.sin(radians) };
}

export function readableTangent(degrees) {
  const rotation = degrees + 90;
  return rotation > 90 && rotation < 270 ? rotation + 180 : rotation;
}

export function ringItems(steps, ring = RING) {
  const sweep = 360 / steps.length;
  return steps.map((step, index) => {
    const start = 180 + index * sweep;
    const end = start + sweep;
    const middle = start + sweep / 2;
    const numberAngle = end - sweep * 0.18;
    const base = point(ring.outer - (ring.outer - ring.inner) / 2, end, ring);
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
      number: { ...point(ring.outer - (ring.outer - ring.inner) * 0.62, numberAngle, ring), rotation: 0 },
      title: { ...point(ring.outer - (ring.outer - ring.inner) * 0.5, middle, ring), rotation: readableTangent(middle) },
      english: { ...point(ring.inner * 0.58, middle, ring), rotation: readableTangent(middle) },
      arrow: {
        outer: { x: base.x + radial.x * ring.arrowHalf, y: base.y + radial.y * ring.arrowHalf },
        tip: { x: base.x + tangent.x * ring.arrowReach, y: base.y + tangent.y * ring.arrowReach },
        inner: { x: base.x - radial.x * ring.arrowHalf, y: base.y - radial.y * ring.arrowHalf },
      },
    };
  });
}

export function svgBandPath(item, ring = RING) {
  const outerStart = point(ring.outer, item.start, ring);
  const outerEnd = point(ring.outer, item.end, ring);
  const innerEnd = point(ring.inner, item.end, ring);
  const innerStart = point(ring.inner, item.start, ring);
  const large = item.end - item.start > 180 ? 1 : 0;
  return `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)} A ${ring.outer} ${ring.outer} 0 ${large} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)} L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)} A ${ring.inner} ${ring.inner} 0 ${large} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)} Z`;
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

export function panelItems(steps, frame = DESIGN_FRAME) {
  const layout = resolveCycleLayout(frame);
  const ring = layout.ring;
  const supportPanel = layout.supportPanel;
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
    const profile = compact ? supportPanel.compact : supportPanel.dense;
    const rowCount = items.length;
    const totalHeight = rowCount * profile.height + Math.max(0, rowCount - 1) * profile.gap;
    const topOffset = layout.adaptive ? Math.max(0, (layout.frame.height - totalHeight) / 2) : 0;
    items.forEach((item, row) => {
      const frame = {
        left: side === "left" ? 0 : layout.frame.width - supportPanel.width,
        top: topOffset + row * (profile.height + profile.gap),
        width: supportPanel.width,
        height: profile.height,
      };
      const inner = Math.min(profile.innerPadding, Math.max(36, frame.width * 0.42));
      result.push({
        ...item,
        frame,
        slotFrame: {
          left: frame.left + (side === "left" ? supportPanel.outerPadding : inner),
          top: frame.top + profile.verticalPadding,
          width: frame.width - inner - supportPanel.outerPadding,
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
