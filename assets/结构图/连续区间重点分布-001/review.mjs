const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TITLE_LIMIT = 8;
const BODY_LIMIT = 28;
const AXIS_LIMIT = 14;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function chars(value) {
  return Array.from(value).length;
}

function normalDistributionPoints({ width = 1070, baseline = 382, amplitude = 378, sigma = 255, samples = 90 } = {}) {
  const center = width / 2;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const x = width * index / samples;
    const z = (x - center) / sigma;
    const y = baseline - amplitude * Math.exp(-0.5 * z * z);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  });
}

function normalDistributionAreaPath(options = {}) {
  const { width = 1070, baseline = 382 } = options;
  const points = normalDistributionPoints(options);
  return `M 0 ${baseline} L ${points.join(" L ")} L ${width} ${baseline} Z`;
}

function normalDistributionCurvePath(options = {}) {
  const points = normalDistributionPoints(options);
  return `M ${points.join(" L ")}`;
}

function normalize(parameters) {
  if (!parameters || !Array.isArray(parameters.items)) throw new Error("连续区间重点分布需要 items 数组");
  const itemCount = parameters.items.length;
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 5) throw new Error("连续区间重点分布支持 3–5 个区域");
  const focusIndex = Number(parameters.focusIndex);
  if (!Number.isInteger(focusIndex) || focusIndex < 0 || focusIndex >= itemCount) throw new Error("focusIndex 必须指向一个现有区域");
  const axis = {
    label: text(parameters.dimensionLabel),
    low: text(parameters.axisLow),
    high: text(parameters.axisHigh),
  };
  for (const [key, value] of Object.entries(axis)) {
    if (!value) throw new Error(`axis.${key} 不能为空`);
    if (chars(value) > AXIS_LIMIT) throw new Error(`axis.${key} 超过 ${AXIS_LIMIT} 字`);
  }
  return {
    focusIndex,
    axis,
    items: parameters.items.map((item, index) => {
      const title = text(item?.title);
      const body = text(item?.body);
      if (!title || !body) throw new Error(`items[${index}] 需要 title 与 body`);
      if (chars(title) > TITLE_LIMIT) throw new Error(`items[${index}].title 超过 ${TITLE_LIMIT} 字`);
      if (chars(body) > BODY_LIMIT) throw new Error(`items[${index}].body 超过 ${BODY_LIMIT} 字`);
      return { key: text(item?.key) || `region-${index + 1}`, title, body };
    }),
  };
}

function regionMarkup(item, index, focusIndex) {
  const focused = index === focusIndex;
  return `<article class="spectrum-region${focused ? " is-focus" : ""}" data-index="${index}">
    <div class="spectrum-card-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="spectrum-underlay-${index}"></div>
    <div class="spectrum-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="spectrum-card-${index}"></div>
    <div class="spectrum-order" data-ppt-kind="text" data-ppt-name="spectrum-order-${index}">${String(index + 1).padStart(2, "0")}</div>
    <h3 data-slot-id="${escapeHtml(item.key)}-title" data-slot-role="item-title" data-slot-field="items[${index}].title" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="spectrum-title-${index}">${escapeHtml(item.title)}</h3>
    <p data-slot-id="${escapeHtml(item.key)}-body" data-slot-role="item-body" data-slot-field="items[${index}].body" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${BODY_LIMIT}" data-slot-max-lines="3" data-ppt-kind="text" data-ppt-name="spectrum-body-${index}">${escapeHtml(item.body)}</p>
    ${focused ? '<div class="spectrum-focus-label-bg" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="spectrum-focus-label-bg"></div><div class="spectrum-focus-label" data-ppt-kind="text" data-ppt-name="spectrum-focus-label">重点区域</div>' : ""}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "progression-spectrum-focus",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxItemTitleChars: TITLE_LIMIT,
    maxItemTitleLines: 1,
    maxItemBodyChars: BODY_LIMIT,
    maxItemBodyLines: 3,
    maxAxisLabelChars: AXIS_LIMIT,
  }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="spectrum-review" data-ppt-root data-item-count="${model.items.length}" data-focus-index="${model.focusIndex}">
      <svg class="spectrum-density spectrum-density-fill-layer" viewBox="0 0 1070 400" aria-hidden="true">
        <path class="spectrum-density-fill" d="${normalDistributionAreaPath()}" data-ppt-kind="path" data-ppt-name="spectrum-density-fill"></path>
      </svg>
      <svg class="spectrum-density spectrum-density-curve-layer" viewBox="0 0 1070 400" aria-hidden="true">
        <path class="spectrum-density-curve" d="${normalDistributionCurvePath()}" data-ppt-kind="path" data-ppt-name="spectrum-density-curve"></path>
      </svg>
      <div class="spectrum-grid">${model.items.map((item, index) => regionMarkup(item, index, model.focusIndex)).join("")}</div>
      <div class="spectrum-axis" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="spectrum-axis"></div>
      <svg class="spectrum-axis-arrow" viewBox="0 0 18 17" aria-hidden="true">
        <path d="M 1.5 1.5 L 16 8.5 L 1.5 15.5" data-ppt-kind="path" data-ppt-name="spectrum-axis-arrow"></path>
      </svg>
      <div class="spectrum-axis-low" data-slot-id="axis-low" data-slot-role="axis-low" data-slot-field="axisLow" data-slot-content-type="text" data-slot-required="true" data-slot-max-chars="${AXIS_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="spectrum-axis-low">${escapeHtml(model.axis.low)}</div>
      <div class="spectrum-axis-label" data-slot-id="axis-label" data-slot-role="axis-label" data-slot-field="dimensionLabel" data-slot-content-type="text" data-slot-required="true" data-slot-max-chars="${AXIS_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="spectrum-axis-label">${escapeHtml(model.axis.label)}</div>
      <div class="spectrum-axis-high" data-slot-id="axis-high" data-slot-role="axis-high" data-slot-field="axisHigh" data-slot-content-type="text" data-slot-required="true" data-slot-max-chars="${AXIS_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="spectrum-axis-high">${escapeHtml(model.axis.high)}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  dimensionLabel: "对视觉复杂度与美观度的需求",
  axisLow: "低",
  axisHigh: "高",
  focusIndex: 1,
  items: [
    { key: "low", title: "低要求端", body: "不重视版式，直接堆放文字也能接受" },
    { key: "work", title: "工作型需求", body: "结构清楚、视觉规范、稳定可靠且可修改" },
    { key: "custom", title: "高定制端", body: "发布会、路演和比赛需要高度视觉创意" },
    { key: "advanced", title: "专业表达", body: "需要专门设计与品牌化表达" },
    { key: "showcase", title: "极致展示", body: "以独特视觉体验为首要目标" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount);
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 5) throw new Error("区间数量必须为 3–5");
  const result = structuredClone(base);
  result.items = result.items.slice(0, itemCount);
  const focusPosition = Number(selection?.focusPosition);
  result.focusIndex = itemCount === 4 && (focusPosition === 2 || focusPosition === 3)
    ? focusPosition - 1
    : Math.floor((itemCount - 1) / 2);
  return result;
}
