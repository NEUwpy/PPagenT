const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TITLE_LIMIT = 10;
const ITEM_LIMIT = 16;
const LABEL_LIMIT = 4;
const MIN_ITEMS = 3;
const MAX_ITEMS = 5;

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

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.sides) || parameters.sides.length !== 2) {
    throw new Error("双向结论对比需要且只需要两个 sides");
  }
  const comparisonLabel = text(parameters.comparisonLabel) || "VS";
  if (charCount(comparisonLabel) > LABEL_LIMIT) throw new Error(`comparisonLabel 超过 ${LABEL_LIMIT} 字`);

  const sides = parameters.sides.map((side, sideIndex) => {
    const title = text(side?.title);
    const tone = text(side?.tone);
    const items = Array.isArray(side?.items) ? side.items.map((item) => text(item)).filter(Boolean) : [];
    if (!title || charCount(title) > TITLE_LIMIT) throw new Error(`sides[${sideIndex}].title 需要 1–${TITLE_LIMIT} 字`);
    if (!['positive', 'negative'].includes(tone)) throw new Error(`sides[${sideIndex}].tone 必须是 positive 或 negative`);
    if (items.length < MIN_ITEMS || items.length > MAX_ITEMS) throw new Error(`sides[${sideIndex}].items 支持 ${MIN_ITEMS}–${MAX_ITEMS} 条`);
    if (items.some((item) => charCount(item) > ITEM_LIMIT)) throw new Error(`sides[${sideIndex}].items 单条超过 ${ITEM_LIMIT} 字`);
    return { title, tone, items };
  });

  if (sides[0].tone === sides[1].tone) throw new Error("双向结论对比必须一侧 positive、一侧 negative");
  if (sides[0].items.length !== sides[1].items.length) throw new Error("双向结论对比两侧要点数必须相同");
  return { comparisonLabel, sides, itemCount: sides[0].items.length };
}

function statusMarker(tone, sideIndex, rowIndex) {
  const symbol = tone === "positive" ? "✓" : "×";
  const label = tone === "positive" ? "推荐" : "不推荐";
  return `<div class="comparison-row-marker" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-marker-${sideIndex}-${rowIndex}">
    <span class="comparison-row-symbol" data-ppt-kind="text" data-ppt-name="comparison-symbol-${sideIndex}-${rowIndex}" aria-label="${label}">${symbol}</span>
  </div>`;
}

function rowMarkup(item, tone, sideIndex, rowIndex) {
  return `<div class="comparison-row" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="comparison-row-${sideIndex}-${rowIndex}">
    ${statusMarker(tone, sideIndex, rowIndex)}
    <div class="comparison-row-text" data-slot-id="side-${sideIndex}-item-${rowIndex}" data-slot-role="item-body" data-slot-field="sides[${sideIndex}].items[${rowIndex}]" data-slot-item-id="side-${sideIndex}-item-${rowIndex}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${ITEM_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="comparison-row-text-${sideIndex}-${rowIndex}">${escapeHtml(item)}</div>
  </div>`;
}

function sideMarkup(side, sideIndex) {
  return `<article class="comparison-side comparison-side-${sideIndex}" data-tone="${side.tone}">
    <div class="comparison-side-shadow" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="comparison-shadow-${sideIndex}"></div>
    <div class="comparison-side-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="comparison-surface-${sideIndex}"></div>
    <div class="comparison-side-cap" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="comparison-cap-${sideIndex}"></div>
    <h3 class="comparison-side-title" data-slot-id="side-${sideIndex}-title" data-slot-role="item-title" data-slot-field="sides[${sideIndex}].title" data-slot-item-id="side-${sideIndex}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="comparison-title-${sideIndex}">${escapeHtml(side.title)}</h3>
    <div class="comparison-list">${side.items.map((item, rowIndex) => rowMarkup(item, side.tone, sideIndex, rowIndex)).join("")}</div>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "comparison-dual-verdict",
  schemaVersion: 5,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxSideTitleChars: TITLE_LIMIT,
    maxSideTitleLines: 1,
    maxItemChars: ITEM_LIMIT,
    maxItemLines: 1,
    maxComparisonLabelChars: LABEL_LIMIT,
    maxComparisonLabelLines: 1,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="comparison-review" data-ppt-root data-item-count="${model.itemCount}">
      <div class="comparison-stage-outer" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-stage-outer"></div>
      <div class="comparison-stage-inner" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-stage-inner"></div>
      ${model.sides.map((side, sideIndex) => sideMarkup(side, sideIndex)).join("")}
      <div class="comparison-knot-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-knot-ring"></div>
      <div class="comparison-knot-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-knot-halo"></div>
      <div class="comparison-knot-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="comparison-knot-core"></div>
      <div class="comparison-knot-label" data-slot-id="comparison-label" data-slot-role="label" data-slot-field="comparisonLabel" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LABEL_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="comparison-label">${escapeHtml(model.comparisonLabel)}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  comparisonLabel: "VS",
  sides: [
    {
      title: "传统工作方式",
      tone: "negative",
      items: ["每页重新设计", "规范依赖记忆", "稿件反复压缩", "质量波动明显", "修改难以复用"],
    },
    {
      title: "受控生成系统",
      tone: "positive",
      items: ["复用成熟结构", "规则统一执行", "容量提前判断", "输出稳定可改", "经验持续积累"],
    },
  ],
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount);
  if (!Number.isInteger(itemCount) || itemCount < MIN_ITEMS || itemCount > MAX_ITEMS) {
    throw new Error(`双向结论对比支持 ${MIN_ITEMS}–${MAX_ITEMS} 条对应要点`);
  }
  const result = structuredClone(base);
  result.sides = result.sides.map((side) => ({ ...side, items: side.items.slice(0, itemCount) }));
  if (selection?.positiveSide === "左侧") result.sides.reverse();
  return result;
}
