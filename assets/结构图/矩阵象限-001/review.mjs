import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ itemMin: 1, itemMax: 3, quadrantTitle: 8, itemTitle: 8, axisLabel: 8, detailTitle: 10, detailBody: 30, metricLabel: 8, metricValue: 8 });
const FOCUS_MAP = Object.freeze({ 左上: 0, 右上: 1, 无: -1 });
const POSITIONS = Object.freeze({
  1: Object.freeze({
    left: Object.freeze([{ x: 400, y: 118, size: 116 }]),
    right: Object.freeze([{ x: 115, y: 118, size: 116 }]),
  }),
  2: Object.freeze({
    left: Object.freeze([{ x: 355, y: 112, size: 94 }, { x: 445, y: 88, size: 122 }]),
    right: Object.freeze([{ x: 160, y: 112, size: 94 }, { x: 70, y: 88, size: 122 }]),
  }),
  3: Object.freeze({
    left: Object.freeze([{ x: 340, y: 120, size: 82 }, { x: 400, y: 84, size: 112 }, { x: 460, y: 118, size: 88 }]),
    right: Object.freeze([{ x: 175, y: 120, size: 82 }, { x: 115, y: 84, size: 112 }, { x: 55, y: 118, size: 88 }]),
  }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) { return String(value ?? "").trim(); }
function count(value) { return Array.from(String(value ?? "")).length; }
function required(value, max, field) {
  const result = text(value);
  if (!result || count(result) > max) throw new RangeError(`${field} 必须为 1–${max} 字`);
  return result;
}
function normalize(parameters) {
  if (!Array.isArray(parameters?.quadrants) || parameters.quadrants.length !== 4) {
    throw new RangeError("二维定位象限固定需要四个象限");
  }
  const quadrants = parameters.quadrants.map((quadrant, quadrantIndex) => {
    if (!Array.isArray(quadrant?.items) || quadrant.items.length < LIMITS.itemMin || quadrant.items.length > LIMITS.itemMax) {
      throw new RangeError(`quadrants[${quadrantIndex}].items 需要 1–3 个对象`);
    }
    return {
      title: required(quadrant.title, LIMITS.quadrantTitle, `quadrants[${quadrantIndex}].title`),
      detail: {
        title: text(quadrant?.detail?.title),
        body: text(quadrant?.detail?.body),
        metrics: Array.isArray(quadrant?.detail?.metrics)
          ? quadrant.detail.metrics.slice(0, 4).map((metric) => ({ label: text(metric?.label), value: text(metric?.value), annotation: text(metric?.annotation) })).filter((metric) => metric.label || metric.value)
          : [],
      },
      items: quadrant.items.map((item, itemIndex) => ({
        key: text(item?.key) || `q${quadrantIndex}-item${itemIndex}`,
        title: required(item?.title, LIMITS.itemTitle, `quadrants[${quadrantIndex}].items[${itemIndex}].title`),
      })),
    };
  });
  const itemCounts = quadrants.map((quadrant) => quadrant.items.length);
  const uniformItemCount = itemCounts.every((value) => value === itemCounts[0]) ? itemCounts[0] : null;
  const focusQuadrant = Number.isInteger(parameters.focusQuadrant) ? parameters.focusQuadrant : -1;
  if (focusQuadrant < -1 || focusQuadrant > 3) throw new RangeError("focusQuadrant 必须为 -1 或 0–3");
  const axes = {
    xLow: required(parameters?.axes?.xLow, LIMITS.axisLabel, "axes.xLow"),
    xHigh: required(parameters?.axes?.xHigh, LIMITS.axisLabel, "axes.xHigh"),
    yLow: required(parameters?.axes?.yLow, LIMITS.axisLabel, "axes.yLow"),
    yHigh: required(parameters?.axes?.yHigh, LIMITS.axisLabel, "axes.yHigh"),
  };
  return {
    quadrants,
    axes,
    itemCounts,
    uniformItemCount,
    focusQuadrant,
    showDefinitionRail: parameters?.showDefinitionRail !== false,
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function slotAttributes({ id, role, field, itemId, maxChars, maxLines = 1, requiredSlot = true }) {
  return `data-slot-id="${id}" data-slot-role="${role}" data-slot-field="${field}" data-slot-item-id="${itemId}" data-slot-content-type="text" data-slot-required="${requiredSlot}" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}"`;
}

function itemMarkup(item, quadrantIndex, itemIndex, itemCount) {
  const side = quadrantIndex % 2 === 0 ? "left" : "right";
  const position = POSITIONS[itemCount][side][itemIndex];
  const style = `--bubble-x:${position.x}px;--bubble-y:${position.y}px;--bubble-size:${position.size}px`;
  return `<article class="matrix-item item-${itemIndex}" style="${style}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="matrix-item-${quadrantIndex}-${itemIndex}">
    <h4 ${slotAttributes({ id: `${item.key}-title`, role: "item-title", field: `quadrants[${quadrantIndex}].items[${itemIndex}].title`, itemId: item.key, maxChars: LIMITS.itemTitle, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="matrix-item-title-${quadrantIndex}-${itemIndex}">${escapeHtml(item.title)}</h4>
  </article>`;
}

function quadrantMarkup(quadrant, quadrantIndex, model) {
  return `<section class="matrix-quadrant q${quadrantIndex}${model.focusQuadrant === quadrantIndex ? " is-focus" : ""}" data-quadrant="${quadrantIndex}">
    <div class="quadrant-field" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="quadrant-field-${quadrantIndex}"></div>
    <h3 ${slotAttributes({ id: `quadrant-${quadrantIndex}-title`, role: "quadrant-title", field: `quadrants[${quadrantIndex}].title`, itemId: `quadrant-${quadrantIndex}`, maxChars: LIMITS.quadrantTitle })} data-ppt-kind="text" data-ppt-name="quadrant-title-${quadrantIndex}">${escapeHtml(quadrant.title)}</h3>
    <div class="bubble-layer">${quadrant.items.map((item, itemIndex) => itemMarkup(item, quadrantIndex, itemIndex, quadrant.items.length)).join("")}</div>
  </section>`;
}

function detailMarkup(quadrant, quadrantIndex, textLayoutBindings) {
  const itemId = `quadrant-${quadrantIndex}-detail`;
  const slotId = `${itemId}-region`;
  return textRegionMarkup({
    id: slotId,
    field: `quadrants[${quadrantIndex}].detail`,
    itemId,
    regionId: "detail",
    layoutId: text(textLayoutBindings?.[slotId]) || "heading-metric-content-flow",
    compatibleLayoutIds: ["heading-content-flow", "metric-content-flow", "metric-set-flow", "heading-metric-content-flow", "summary-information-flow"],
    content: quadrant.detail,
    className: `quadrant-detail detail-${quadrantIndex}`,
    align: "left",
    valign: "top",
    density: "compact",
    required: false,
    names: { heading: `matrix-detail-title-${quadrantIndex}`, body: `matrix-detail-body-${quadrantIndex}` },
  });
}

function axesMarkup(axes) {
  return `<svg class="matrix-axes" viewBox="0 0 1170 492" aria-hidden="true">
    <line class="axis-line" x1="158" y1="246" x2="1012" y2="246" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="matrix-x-axis"></line>
    <path class="axis-arrow" d="M 158 246 L 171 239 L 171 253 Z" data-ppt-kind="path" data-ppt-name="matrix-x-low-arrow"></path>
    <path class="axis-arrow" d="M 1012 246 L 999 239 L 999 253 Z" data-ppt-kind="path" data-ppt-name="matrix-x-high-arrow"></path>
    <line class="axis-line" x1="585" y1="40" x2="585" y2="452" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="matrix-y-axis"></line>
    <path class="axis-arrow" d="M 585 40 L 578 53 L 592 53 Z" data-ppt-kind="path" data-ppt-name="matrix-y-high-arrow"></path>
    <path class="axis-arrow" d="M 585 452 L 578 439 L 592 439 Z" data-ppt-kind="path" data-ppt-name="matrix-y-low-arrow"></path>
  </svg>
  <span class="axis-label x-low" data-ppt-kind="text" data-ppt-name="axis-x-low">${escapeHtml(axes.xLow)}</span>
  <span class="axis-label x-high" data-ppt-kind="text" data-ppt-name="axis-x-high">${escapeHtml(axes.xHigh)}</span>
  <span class="axis-label y-high" data-ppt-kind="text" data-ppt-name="axis-y-high">${escapeHtml(axes.yHigh)}</span>
  <span class="axis-label y-low" data-ppt-kind="text" data-ppt-name="axis-y-low">${escapeHtml(axes.yLow)}</span>`;
}

function bandIconMarkup(kind) {
  if (kind === "high") {
    return `<svg class="band-icon" viewBox="0 0 64 64" aria-hidden="true" data-ppt-kind="image" data-ppt-name="matrix-high-band-icon">
      <defs><linearGradient id="band-high-gradient" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".82"/></linearGradient></defs>
      <path d="M14 45 L31 28 L40 37 L52 24" fill="none" stroke="url(#band-high-gradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M42 24 H52 V34" fill="none" stroke="url(#band-high-gradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  return `<svg class="band-icon" viewBox="0 0 64 64" aria-hidden="true" data-ppt-kind="image" data-ppt-name="matrix-low-band-icon">
    <defs><radialGradient id="band-low-gradient"><stop offset="0" stop-color="#fff" stop-opacity=".82"/><stop offset="1" stop-color="#fff" stop-opacity=".10"/></radialGradient></defs>
    <circle cx="32" cy="32" r="21" fill="none" stroke="url(#band-low-gradient)" stroke-width="4"/>
    <circle cx="32" cy="32" r="10" fill="none" stroke="url(#band-low-gradient)" stroke-width="4"/>
    <circle cx="32" cy="32" r="3.5" fill="url(#band-low-gradient)"/>
  </svg>`;
}

function bandDefinitionsMarkup(axes) {
  return `<aside class="band-definitions" aria-label="上下象限定义">
    <section class="band-definition band-high" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-high-band">
      <strong data-ppt-kind="text" data-ppt-name="matrix-high-band-title">${escapeHtml(axes.yHigh)}</strong>
      ${bandIconMarkup("high")}
    </section>
    <section class="band-definition band-low" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-low-band">
      <strong data-ppt-kind="text" data-ppt-name="matrix-low-band-title">${escapeHtml(axes.yLow)}</strong>
      ${bandIconMarkup("low")}
    </section>
  </aside>`;
}

export const visualComponent = Object.freeze({
  id: "matrix-quadrant-priority",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  textCapacity: Object.freeze({
    maxItemTitleChars: LIMITS.itemTitle,
    maxItemTitleLines: 2,
  }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="matrix-review" data-ppt-root data-items-per-quadrant="${model.uniformItemCount ?? "mixed"}" data-quadrant-counts="${model.itemCounts.join(",")}" data-items-q0="${model.itemCounts[0]}" data-items-q1="${model.itemCounts[1]}" data-items-q2="${model.itemCounts[2]}" data-items-q3="${model.itemCounts[3]}" data-focus-quadrant="${model.focusQuadrant}" data-definition-rail="${model.showDefinitionRail ? "on" : "off"}">
      ${model.quadrants.map((quadrant, index) => quadrantMarkup(quadrant, index, model)).join("")}
      ${model.quadrants.map((quadrant, index) => detailMarkup(quadrant, index, model.textLayoutBindings)).join("")}
      ${model.showDefinitionRail ? bandDefinitionsMarkup(model.axes) : ""}
      ${axesMarkup(model.axes)}
      <div class="axis-origin" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="matrix-origin"></div>
    </section>`;
  },
});

export const matrixQuadrantVisualComponent = visualComponent;

export const previewParameters = Object.freeze({
  axes: Object.freeze({ xLow: "实施难度低", xHigh: "实施难度高", yLow: "业务价值低", yHigh: "业务价值高" }),
  focusQuadrant: 0,
  showDefinitionRail: true,
  quadrants: Object.freeze([
    Object.freeze({ title: "优先推进", detail: Object.freeze({
      title: "快速落地方案",
      body: "优先配置低难度、高价值项目",
      metrics: Object.freeze([Object.freeze({ label: "落地周期", value: "2周" }), Object.freeze({ label: "协同团队", value: "2组" })]),
    }), items: Object.freeze([
      Object.freeze({ key: "alert", title: "异常预警" }),
      Object.freeze({ key: "portal", title: "统一入口" }),
      Object.freeze({ key: "template", title: "规则模板" }),
    ]) }),
    Object.freeze({ title: "战略投入", detail: Object.freeze({
      title: "重点投入方案",
      body: "围绕高价值项目集中资源建设",
      metrics: Object.freeze([Object.freeze({ label: "建设周期", value: "3月" }), Object.freeze({ label: "资源投入", value: "重点" })]),
    }), items: Object.freeze([
      Object.freeze({ key: "platform", title: "数据平台" }),
      Object.freeze({ key: "automation", title: "流程自动化" }),
      Object.freeze({ key: "forecast", title: "智能预测" }),
    ]) }),
    Object.freeze({ title: "择机优化", detail: Object.freeze({
      title: "常规优化方案",
      body: "以低成本方式择机改善体验",
      metrics: Object.freeze([Object.freeze({ label: "优化频率", value: "季度" }), Object.freeze({ label: "投入等级", value: "常规" })]),
    }), items: Object.freeze([
      Object.freeze({ key: "report", title: "报表美化" }),
      Object.freeze({ key: "archive", title: "资料归档" }),
      Object.freeze({ key: "notice", title: "通知整合" }),
    ]) }),
    Object.freeze({ title: "谨慎评估", detail: Object.freeze({
      title: "审慎评估方案",
      body: "投入前验证收益与复用边界",
      metrics: Object.freeze([Object.freeze({ label: "评估周期", value: "1月" }), Object.freeze({ label: "风险等级", value: "较高" })]),
    }), items: Object.freeze([
      Object.freeze({ key: "rewrite", title: "系统重构" }),
      Object.freeze({ key: "migration", title: "全量迁移" }),
      Object.freeze({ key: "custom", title: "深度定制" }),
    ]) }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const legacyCount = Number(selection?.itemsPerQuadrant);
  const fallbackCount = Number.isInteger(legacyCount) ? legacyCount : 2;
  const itemCounts = [0, 1, 2, 3].map((quadrantIndex) => Number(selection?.[`q${quadrantIndex}Count`] ?? fallbackCount));
  if (itemCounts.some((value) => !Number.isInteger(value) || value < LIMITS.itemMin || value > LIMITS.itemMax)) {
    throw new RangeError("二维定位象限的四个象限分别支持 1–3 个对象");
  }
  const focusLabel = text(selection?.focusQuadrant) || "左上";
  if (!(focusLabel in FOCUS_MAP)) throw new RangeError("重点象限支持左上、右上或无");
  const definitionRailLabel = text(selection?.definitionRail) || "有";
  if (!["有", "无"].includes(definitionRailLabel)) throw new RangeError("纵向定义区支持有或无");
  const result = structuredClone(base);
  result.focusQuadrant = FOCUS_MAP[focusLabel];
  result.showDefinitionRail = definitionRailLabel === "有";
  result.quadrants = result.quadrants.map((quadrant, quadrantIndex) => ({ ...quadrant, items: quadrant.items.slice(0, itemCounts[quadrantIndex]) }));
  return result;
}
