import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TONES = Object.freeze([
  Object.freeze({ dark: "#28557a", light: "#4d80a7" }),
  Object.freeze({ dark: "#35688f", light: "#699abb" }),
  Object.freeze({ dark: "#4d80a7", light: "#8bb2ca" }),
  Object.freeze({ dark: "#699abb", light: "#abc8da" }),
  Object.freeze({ dark: "#82a9c1", light: "#bfd3df" }),
]);

function text(value) { return String(value ?? "").trim(); }

function requireText(value, field, maxChars) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${field} 不能为空`);
  if ([...normalized].length > maxChars) throw new Error(`${field} 不得超过 ${maxChars} 字`);
  return normalized;
}

function normalize(parameters) {
  const root = requireText(parameters?.root, "root", 14);
  if (!Array.isArray(parameters?.items) || parameters.items.length < 2 || parameters.items.length > 5) {
    throw new Error("分组展开结构支持 2–5 个分组");
  }
  const maxPoints = parameters.items.length === 5 ? 3 : 4;
  const items = parameters.items.map((item, itemIndex) => {
    const title = requireText(item?.title, `items[${itemIndex}].title`, 6);
    if (!Array.isArray(item?.points) || item.points.length < 1 || item.points.length > maxPoints) {
      throw new Error(`items[${itemIndex}].points 必须包含 1–${maxPoints} 个来源分点`);
    }
    const points = item.points.map((point, pointIndex) => requireText(point, `items[${itemIndex}].points[${pointIndex}]`, 12));
    return { key: text(item?.key) || `group-${itemIndex + 1}`, title, points };
  });
  const textLayoutBindings = parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object" ? { ...parameters.textLayoutBindings } : {};
  return { root, items, textLayoutBindings };
}

function selectedLayout(bindings, regionId, fallback) { return text(bindings?.[regionId]) || fallback; }

function layoutForCount(count) {
  if (count === 2) return { top: 61, height: 174, gap: 22 };
  if (count === 3) return { top: 23, height: 140, gap: 13 };
  if (count === 4) return { top: 13, height: 107, gap: 12 };
  return { top: 5, height: 90, gap: 8 };
}

function connectorMarkup(centerY, index) {
  const tone = TONES[index];
  const bendX = 244 + index * 6;
  return `<path d="M 190 246 C ${bendX} 246, ${bendX} ${centerY}, 326 ${centerY}" fill="none" stroke="${tone.light}" stroke-width="8" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="grouped-branch-${index + 1}"></path>`;
}

function rootMarkup(root, textLayoutBindings) {
  const regionId = "root-content";
  return `<article class="root-anchor">
    <div class="root-ribbon" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="grouped-root">
      ${textRegionMarkup({ id: regionId, field: "root", itemId: "root", regionId: "root", layoutId: selectedLayout(textLayoutBindings, regionId, "statement-flow"), compatibleLayoutIds: ["statement-flow"], content: { title: root }, className: "root-content", align: "center", valign: "middle", density: "compact", required: true, names: { heading: "grouped-root-title" } })}
    </div>
  </article>`;
}

function ribbonMarkup(item, index, textLayoutBindings) {
  const tone = TONES[index];
  const regionId = `group-${index + 1}-title`;
  return `<div class="group-ribbon" style="--tone:${tone.dark}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="grouped-title-${index + 1}">
    ${textRegionMarkup({ id: regionId, field: `items[${index}].title`, itemId: item.key, regionId: "title", layoutId: selectedLayout(textLayoutBindings, regionId, "statement-flow"), compatibleLayoutIds: ["statement-flow"], content: { title: item.title }, className: "group-title-region", align: "center", valign: "middle", density: "compact", required: true, names: { heading: `grouped-title-${index + 1}-text` } })}
  </div>`;
}

function pointsMarkup(item, index, textLayoutBindings) {
  const regionId = `group-${index + 1}-points`;
  return `<div class="point-surface" data-point-count="${item.points.length}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="grouped-point-surface-${index + 1}">
    <div class="point-rule" style="--tone:${TONES[index].light}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="grouped-point-rule-${index + 1}"></div>
    ${textRegionMarkup({ id: regionId, field: `items[${index}].points`, itemId: item.key, regionId: "points", layoutId: selectedLayout(textLayoutBindings, regionId, "heading-content-flow"), compatibleLayoutIds: ["heading-content-flow"], content: { points: item.points, listMarker: "bullet" }, className: "point-region", align: "left", valign: "middle", density: "compact", required: true, names: { list: `grouped-point-${index + 1}` } })}
  </div>`;
}

function groupMarkup(item, index, geometry, textLayoutBindings) {
  const top = geometry.top + index * (geometry.height + geometry.gap);
  return `<article class="group-row" style="--top:${top}px;--row-height:${geometry.height}px" data-group-index="${index}" data-point-count="${item.points.length}">${pointsMarkup(item, index, textLayoutBindings)}${ribbonMarkup(item, index, textLayoutBindings)}</article>`;
}

export const visualComponent = Object.freeze({
  id: "hierarchy-grouped-breakdown",
  schemaVersion: 6,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const geometry = layoutForCount(model.items.length);
    const centers = model.items.map((_, index) => geometry.top + index * (geometry.height + geometry.gap) + geometry.height / 2);
    return `<section class="grouped-review" data-ppt-root data-group-count="${model.items.length}"><svg class="connector-field" viewBox="0 0 1170 492" aria-hidden="true">${centers.map((centerY, index) => connectorMarkup(centerY, index)).join("")}</svg>${rootMarkup(model.root, model.textLayoutBindings)}${model.items.map((item, index) => groupMarkup(item, index, geometry, model.textLayoutBindings)).join("")}</section>`;
  },
});

export const previewParameters = Object.freeze({
  root: "建立可靠的工作型 PPT",
  items: Object.freeze([
    Object.freeze({ key: "understand", title: "内容理解", points: Object.freeze(["识别核心主题", "保留事实边界", "提取组内分点"]) }),
    Object.freeze({ key: "narrative", title: "叙事编排", points: Object.freeze(["形成页面主线", "控制信息密度"]) }),
    Object.freeze({ key: "visual", title: "视觉表达", points: Object.freeze(["选择合法结构", "匹配数量状态", "遵守容量契约"]) }),
    Object.freeze({ key: "delivery", title: "原生交付", points: Object.freeze(["统一编译", "保持对象可编辑", "嵌入固定 Shell"]) }),
    Object.freeze({ key: "feedback", title: "运行反馈", points: Object.freeze(["记录真实缺口", "回流资产建设"]) }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const groupCount = Number(selection?.groupCount ?? 3);
  if (![2, 3, 4, 5].includes(groupCount)) throw new Error("分组展开结构支持 2、3、4 或 5 个分组");
  const result = structuredClone(base);
  result.items = result.items.slice(0, groupCount);
  return result;
}
