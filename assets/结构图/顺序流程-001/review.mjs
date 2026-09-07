const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const BODY_LIMITS = Object.freeze({ 3: 56, 4: 44, 5: 34, 6: 26 });
const TITLE_LIMIT = 8;
const MAX_POINTS = 4;
const POINT_LIMIT = 14;
const LAYOUTS = Object.freeze({
  3: Object.freeze({ left: 120, width: 930 }),
  4: Object.freeze({ left: 55, width: 1060 }),
  5: Object.freeze({ left: 20, width: 1130 }),
  6: Object.freeze({ left: 10, width: 1150 }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(value).length;
}

function pointRows(item) {
  return Array.isArray(item?.points)
    ? item.points.map((point) => text(point?.text ?? point)).filter(Boolean)
    : [];
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.items)) throw new Error("顺序流程需要 items 数组");
  const itemCount = parameters.items.length;
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 6) {
    throw new Error("顺序流程支持 3–6 个步骤");
  }
  const maxBodyChars = BODY_LIMITS[itemCount];
  return {
    itemCount,
    layout: LAYOUTS[itemCount],
    items: parameters.items.map((item, index) => {
      const title = text(item?.title);
      const body = text(item?.body);
      const points = pointRows(item);
      if (points.length > MAX_POINTS) throw new Error(`items[${index}].points 最多 ${MAX_POINTS} 条`);
      if (points.some((point) => charCount(point) > POINT_LIMIT)) throw new Error(`items[${index}].points 单条超过 ${POINT_LIMIT} 字`);
      const supportText = [body, ...points.map((point) => `• ${point}`)].filter(Boolean).join("\n");
      if (!title && !supportText) throw new Error(`items[${index}] 至少需要 title 或正文内容`);
      if (charCount(title) > TITLE_LIMIT) throw new Error(`items[${index}].title 超过 ${TITLE_LIMIT} 字`);
      if (charCount(supportText.replaceAll("\n", "")) > maxBodyChars) throw new Error(`items[${index}] 的完整正文超过 ${maxBodyChars} 字`);
      if (supportText.split(/\r?\n/).length > 4) throw new Error(`items[${index}] 的完整正文超过 4 行`);
      return {
        key: text(item?.key) || `step-${index + 1}`,
        title,
        body: supportText,
        order: String(index + 1).padStart(2, "0"),
      };
    }),
  };
}

export function resolveSequenceLayout(frame = DESIGN_FRAME, itemCount = 4) {
  const width = Number(frame?.width ?? DESIGN_FRAME.width);
  const height = Number(frame?.height ?? DESIGN_FRAME.height);
  if (width === DESIGN_FRAME.width && height === DESIGN_FRAME.height) {
    return {
      frame: { width, height },
      left: LAYOUTS[itemCount].left,
      width: LAYOUTS[itemCount].width,
      titleTop: 66,
      titleHeight: 40,
      haloTop: 134,
      haloSize: 88,
      nodeTop: 146,
      nodeSize: 64,
      connectorTop: 216,
      connectorHeight: 32,
      bodyTop: 246,
      bodyHeight: 150,
      bodyTextTop: 277,
      bodyTextHeight: 88,
      railTop: 160,
      railHeight: 36,
      highlightTop: 177,
      adaptive: false,
    };
  }
  const left = Math.max(12, width * 0.025);
  const innerWidth = width - left * 2;
  const nodeSize = Math.max(48, Math.min(64, height * 0.16));
  const haloSize = nodeSize + Math.max(14, nodeSize * 0.28);
  const titleTop = Math.max(20, height * 0.1);
  const haloTop = Math.max(titleTop + 34, height * 0.27);
  const nodeTop = haloTop + (haloSize - nodeSize) / 2;
  const connectorTop = nodeTop + nodeSize + 8;
  const bodyTop = Math.min(height - 112, connectorTop + Math.max(22, height * 0.085));
  const bodyHeight = Math.max(92, height - bodyTop - 18);
  return {
    frame: { width, height },
    left,
    width: innerWidth,
    titleTop,
    titleHeight: Math.max(28, Math.min(40, height * 0.1)),
    haloTop,
    haloSize,
    nodeTop,
    nodeSize,
    connectorTop,
    connectorHeight: Math.max(16, bodyTop - connectorTop - 8),
    bodyTop,
    bodyHeight,
    bodyTextTop: bodyTop + Math.max(22, bodyHeight * 0.18),
    bodyTextHeight: Math.max(58, bodyHeight - Math.max(30, bodyHeight * 0.3)),
    railTop: nodeTop + nodeSize / 2 - 18,
    railHeight: 36,
    highlightTop: nodeTop + nodeSize / 2 - 1,
    adaptive: true,
  };
}

function railMarkup(layout, itemCount) {
  const cellWidth = layout.width / itemCount;
  const left = layout.left + cellWidth / 2 - 44;
  const width = cellWidth * (itemCount - 1) + 114;
  const tip = Math.max(36, Math.min(46, width * 0.055));
  const path = `M 0 8 Q 0 4 4 4 L ${width - tip} 4 L ${width - tip} 0 L ${width} 18 L ${width - tip} 36 L ${width - tip} 32 L 4 32 Q 0 32 0 28 Z`;
  return `<svg class="sequence-rail" style="left:${left}px;width:${width}px;top:${layout.railTop}px;height:${layout.railHeight}px" viewBox="0 0 ${width} 36" preserveAspectRatio="none" aria-hidden="true">
    <path data-ppt-kind="path" data-ppt-name="sequence-direction-rail" fill="#dcecff" d="${path}"/>
  </svg>
  <div class="sequence-rail-highlight" style="left:${left + 10}px;width:${width - tip - 18}px;top:${layout.highlightTop}px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="sequence-direction-highlight"></div>`;
}

function stepMarkup(item, index, itemCount) {
  return `<article class="sequence-step" data-key="${escapeHtml(item.key)}">
    <h3 class="sequence-title" data-slot-id="${escapeHtml(item.key)}-title" data-slot-role="item-title" data-slot-field="items[${index}].title" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="sequence-title-${index}">${escapeHtml(item.title)}</h3>
    <div class="sequence-node-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="sequence-node-halo-${index}"></div>
    <div class="sequence-node" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="sequence-node-${index}"></div>
    <div class="sequence-order" data-ppt-kind="text" data-ppt-name="sequence-order-${index}">${item.order}</div>
    <div class="sequence-connector" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="sequence-connector-${index}"></div>
    <div class="sequence-body-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="sequence-body-underlay-${index}"></div>
    <div class="sequence-body-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="sequence-body-surface-${index}"></div>
    <div class="sequence-body-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="sequence-body-accent-${index}"></div>
    <p class="sequence-body" data-slot-id="${escapeHtml(item.key)}-body" data-slot-role="item-body" data-slot-field="items[${index}].support" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="inline" data-slot-max-chars="${BODY_LIMITS[itemCount]}" data-slot-max-lines="4" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="sequence-body-${index}">${escapeHtml(item.body)}</p>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "sequence-flow",
  schemaVersion: 5,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxItemTitleChars: TITLE_LIMIT,
    maxItemTitleLines: 1,
    maxItemBodyCharsByState: BODY_LIMITS,
    maxItemBodyLines: 4,
    maxPointsPerItem: MAX_POINTS,
    maxPointChars: POINT_LIMIT,
    maxPointLines: 1,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="sequence-review" data-ppt-root data-item-count="${model.itemCount}">
      ${railMarkup(model.layout, model.itemCount)}
      <div class="sequence-grid" style="left:${model.layout.left}px;width:${model.layout.width}px;grid-template-columns:repeat(${model.itemCount},1fr)">
        ${model.items.map((item, index) => stepMarkup(item, index, model.itemCount)).join("")}
      </div>
    </section>`;
  },
});

export function renderAdaptiveMarkup(parameters, { frame } = {}) {
  const model = normalizeParameters(parameters);
  const layout = resolveSequenceLayout(frame ?? DESIGN_FRAME, model.itemCount);
  const style = [
    `width:${layout.frame.width}px`,
    `height:${layout.frame.height}px`,
    `--sequence-frame-width:${layout.frame.width}px`,
    `--sequence-frame-height:${layout.frame.height}px`,
    `--sequence-title-top:${layout.titleTop}px`,
    `--sequence-title-height:${layout.titleHeight}px`,
    `--sequence-halo-top:${layout.haloTop}px`,
    `--sequence-halo-size:${layout.haloSize}px`,
    `--sequence-node-top:${layout.nodeTop}px`,
    `--sequence-node-size:${layout.nodeSize}px`,
    `--sequence-connector-top:${layout.connectorTop}px`,
    `--sequence-connector-height:${layout.connectorHeight}px`,
    `--sequence-body-top:${layout.bodyTop}px`,
    `--sequence-body-height:${layout.bodyHeight}px`,
    `--sequence-body-text-top:${layout.bodyTextTop}px`,
    `--sequence-body-text-height:${layout.bodyTextHeight}px`,
    `--sequence-font-scale:${layout.adaptive ? Math.max(0.86, Math.min(1, layout.frame.width / DESIGN_FRAME.width)) : 1}`,
  ].join(";");
  return `<section class="sequence-review" style="${style}" data-ppt-root data-item-count="${model.itemCount}" data-adaptive-profile="rail">
    ${railMarkup(layout, model.itemCount)}
    <div class="sequence-grid" style="left:${layout.left}px;width:${layout.width}px;grid-template-columns:repeat(${model.itemCount},1fr)">
      ${model.items.map((item, index) => stepMarkup(item, index, model.itemCount)).join("")}
    </div>
  </section>`;
}

export const previewParameters = Object.freeze({
  items: [
    { key: "discover", title: "需求识别", body: "明确对象、目标与真实约束" },
    { key: "analyze", title: "问题分析", body: "梳理信息并确认关键矛盾" },
    { key: "design", title: "方案设计", body: "形成可执行的解决路径" },
    { key: "implement", title: "组织实施", body: "分配任务并推进计划落地" },
    { key: "evaluate", title: "效果评估", body: "核对结果与预期目标" },
    { key: "improve", title: "持续改进", body: "沉淀经验并优化下一轮行动" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount);
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 6) {
    throw new Error("顺序流程支持 3–6 步");
  }
  const result = structuredClone(base);
  result.items = result.items.slice(0, itemCount);
  return result;
}
