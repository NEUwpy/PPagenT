import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const CENTER = Object.freeze({ x: 280, y: 246 });
const SUPPORT_CONTOUR_GUTTER = 14;
const COLORS = Object.freeze(["#2f62ad", "#4f88dc", "#55a0c2", "#6880c9", "#4d91b4"]);
const LAYOUTS = Object.freeze({
  2: Object.freeze({ size: 330, orbit: 92, core: 170, angles: Object.freeze([180, 0]), sides: Object.freeze(["left", "right"]) }),
  3: Object.freeze({ size: 290, orbit: 88, core: 160, angles: Object.freeze([-90, 150, 30]), sides: Object.freeze(["left", "left", "right"]) }),
  4: Object.freeze({ size: 260, orbit: 102, core: 140, angles: Object.freeze([-90, 0, 90, 180]), sides: Object.freeze(["left", "right", "right", "left"]) }),
  5: Object.freeze({ size: 230, orbit: 100, core: 120, angles: Object.freeze([-90, -18, 54, 126, 198]), sides: Object.freeze(["left", "right", "right", "left", "left"]) }),
});
const PANEL_ROWS = Object.freeze({
  1: Object.freeze([{ top: 171, height: 150 }]),
  2: Object.freeze([{ top: 50, height: 180 }, { top: 262, height: 180 }]),
  3: Object.freeze([{ top: 10, height: 136 }, { top: 178, height: 136 }, { top: 346, height: 136 }]),
});
const TWO_ITEM_PANEL_ROW = Object.freeze({ top: 136, height: 220 });
const THREE_ITEM_PANEL_ROWS = Object.freeze({
  top: Object.freeze({ top: 0, height: 216 }),
  bottom: Object.freeze({ top: 244, height: 232 }),
});

function text(value) { return String(value ?? "").trim(); }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}
function pointRows(value) {
  return Array.isArray(value) ? value.map((item) => text(item?.text ?? item)).filter(Boolean) : [];
}
function normalizeItem(item, index) {
  const title = text(item?.title);
  const body = text(item?.body);
  const points = pointRows(item?.points);
  if (!title) throw new Error(`items[${index}].title 不能为空`);
  if (points.length > 5) throw new Error(`items[${index}].points 最多 5 条`);
  return { key: text(item?.key) || `set-${index + 1}`, title, body, points };
}
function normalize(parameters) {
  const items = Array.isArray(parameters?.items) ? parameters.items.map(normalizeItem) : [];
  if (items.length < 2 || items.length > 5) throw new Error("集合共同交集要求 2–5 个集合");
  const shared = { title: text(parameters?.shared?.title), body: text(parameters?.shared?.body) };
  if (!shared.title && !shared.body) throw new Error("shared 至少需要标题或正文");
  return { items, shared, showSupport: parameters?.showSupport !== false, textLayoutBindings: parameters?.textLayoutBindings ?? {} };
}

function centerFor(itemCount) {
  return { x: CENTER.x, y: CENTER.y + (itemCount === 3 ? 14 : 0) };
}

function geometryFor(items, center) {
  const layout = LAYOUTS[items.length];
  return items.map((item, index) => {
    const angle = layout.angles[index] * Math.PI / 180;
    const centerX = center.x + Math.cos(angle) * layout.orbit;
    const centerY = center.y + Math.sin(angle) * layout.orbit;
    const titleDistance = layout.size * 0.20;
    const titleWidth = items.length >= 4 ? 100 : 130;
    const titleHeight = 62;
    const markerDistance = layout.size * 0.44;
    return {
      item, index, side: layout.sides[index], coreSize: layout.core,
      circle: { left: centerX - layout.size / 2, top: centerY - layout.size / 2, size: layout.size },
      title: { left: centerX + Math.cos(angle) * titleDistance - titleWidth / 2, top: centerY + Math.sin(angle) * titleDistance - titleHeight / 2, width: titleWidth, height: titleHeight },
      marker: { left: centerX + Math.cos(angle) * markerDistance - 16, top: centerY + Math.sin(angle) * markerDistance - 16 },
    };
  });
}

function supportPanels(geometry) {
  if (geometry.length === 3) {
    const [top, bottomLeft, bottomRight] = geometry;
    return [
      {
        ...top,
        side: "left",
        slotSuffix: "support-left",
        field: `items[${top.index}].body`,
        content: { body: top.item.body, points: [] },
        frame: { left: 0, top: THREE_ITEM_PANEL_ROWS.top.top, width: 500, height: THREE_ITEM_PANEL_ROWS.top.height },
      },
      {
        ...top,
        side: "right",
        slotSuffix: "support-right",
        field: `items[${top.index}].points`,
        content: { body: "", points: top.item.points },
        frame: { left: 670, top: THREE_ITEM_PANEL_ROWS.top.top, width: 500, height: THREE_ITEM_PANEL_ROWS.top.height },
      },
      {
        ...bottomLeft,
        side: "left",
        frame: { left: 0, top: THREE_ITEM_PANEL_ROWS.bottom.top, width: 500, height: THREE_ITEM_PANEL_ROWS.bottom.height },
      },
      {
        ...bottomRight,
        side: "right",
        frame: { left: 670, top: THREE_ITEM_PANEL_ROWS.bottom.top, width: 500, height: THREE_ITEM_PANEL_ROWS.bottom.height },
      },
    ];
  }
  const groups = { left: [], right: [] };
  for (const item of geometry) groups[item.side].push(item);
  return ["left", "right"].flatMap((side) => {
    const rows = geometry.length === 2 ? [TWO_ITEM_PANEL_ROW] : PANEL_ROWS[groups[side].length];
    return groups[side].map((item, row) => ({ ...item, frame: { left: side === "left" ? 0 : 670, top: rows[row].top, width: 500, height: rows[row].height } }));
  });
}

function contourMaskMarkup(geometry) {
  return `<div class="intersection-contour-mask">${geometry.map((item) => {
    const left = 305 + item.circle.left - SUPPORT_CONTOUR_GUTTER;
    const top = item.circle.top - SUPPORT_CONTOUR_GUTTER;
    const size = item.circle.size + SUPPORT_CONTOUR_GUTTER * 2;
    return `<i data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="support-arc-mask-${item.index}" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px"></i>`;
  }).join("")}</div>`;
}

function supportMarkup(item, textLayoutBindings) {
  const slotSuffix = item.slotSuffix ?? "support";
  const slotId = `set-${item.item.key}-${slotSuffix}`;
  const frame = item.frame;
  return `<article class="intersection-note" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="intersection-panel-${item.index}-${slotSuffix}" data-side="${item.side}" style="--left:${frame.left}px;--top:${frame.top}px;--width:${frame.width}px;--height:${frame.height}px">
    ${textRegionMarkup({
      id: slotId, field: item.field ?? `items[${item.index}].support`, itemId: item.item.key, regionId: slotSuffix,
      layoutId: String(textLayoutBindings?.[slotId] ?? "heading-content-flow"),
      compatibleLayoutIds: ["statement-flow", "heading-content-flow", "structured-list-flow", "metric-content-flow"],
      content: item.content ?? { body: item.item.body, points: item.item.points }, className: "intersection-copy-region",
      align: item.side, valign: "middle", density: "compact", required: false,
      names: { body: `intersection-${item.index}-${slotSuffix}`, list: `intersection-${item.index}-${slotSuffix}-point` },
    })}
  </article>`;
}

function setMarkup(item, itemCount) {
  const circle = item.circle;
  const ringInset = 12;
  return `<div class="set-shadow" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="set-shadow-${item.index}" style="left:${circle.left}px;top:${circle.top + 8}px;width:${circle.size}px;height:${circle.size}px"></div>
    <div class="set-circle" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="set-circle-${item.index}" style="left:${circle.left}px;top:${circle.top}px;width:${circle.size}px;height:${circle.size}px;background:${COLORS[item.index]}"></div>
    <div class="set-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="set-ring-${item.index}" style="left:${circle.left + ringInset}px;top:${circle.top + ringInset}px;width:${circle.size - ringInset * 2}px;height:${circle.size - ringInset * 2}px"></div>
    <div class="set-marker" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="set-marker-${item.index}" style="left:${item.marker.left}px;top:${item.marker.top}px">${String.fromCharCode(65 + item.index)}</div>
    <div class="set-title" data-slot-id="set-${escapeHtml(item.item.key)}-title" data-slot-role="item-title" data-slot-field="items[${item.index}].title" data-slot-item-id="${escapeHtml(item.item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${itemCount >= 4 ? 8 : 10}" data-slot-max-lines="2" data-ppt-kind="text" data-ppt-name="set-title-${item.index}" style="left:${item.title.left}px;top:${item.title.top}px;width:${item.title.width}px;height:${item.title.height}px">${escapeHtml(item.item.title)}</div>`;
}

function sharedMarkup(shared, coreSize, textLayoutBindings, center) {
  const left = center.x - coreSize / 2;
  const top = center.y - coreSize / 2;
  const ringInset = Math.max(10, Math.round(coreSize * 0.08));
  const contentInset = Math.max(12, Math.round(coreSize * 0.11));
  const slotId = "shared-content";
  const content = textRegionMarkup({
    id: slotId, field: "shared", itemId: "shared", regionId: "shared",
    layoutId: String(textLayoutBindings?.[slotId] ?? "heading-content-flow"),
    compatibleLayoutIds: ["statement-flow", "heading-content-flow", "metric-content-flow"],
    content: shared, className: "shared-content", align: "center", valign: "middle", density: "compact",
    names: { heading: "shared-title", body: "shared-body" },
  }).replace('class="ppagent-text-region shared-content"', `class="ppagent-text-region shared-content" style="left:${left + contentInset}px;top:${top + contentInset}px;width:${coreSize - contentInset * 2}px;height:${coreSize - contentInset * 2}px"`);
  return `<div class="shared-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="shared-halo" style="left:${left - 12}px;top:${top - 12}px;width:${coreSize + 24}px;height:${coreSize + 24}px"></div>
    <div class="shared-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="shared-core" style="left:${left}px;top:${top}px;width:${coreSize}px;height:${coreSize}px"></div>
    <div class="shared-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="shared-ring" style="left:${left + ringInset}px;top:${top + ringInset}px;width:${coreSize - ringInset * 2}px;height:${coreSize - ringInset * 2}px"></div>
    ${content}`;
}

export const visualComponent = Object.freeze({
  id: "containment-multi-set-intersection", schemaVersion: 2, designFrame: DESIGN_FRAME, cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const center = centerFor(model.items.length);
    const geometry = geometryFor(model.items, center);
    const threeItemTopFrame = geometry.length === 3
      ? `<div class="intersection-three-top-frame" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="intersection-three-top-frame"></div>`
      : "";
    const support = model.showSupport
      ? `<div class="intersection-support-layer">${threeItemTopFrame}${supportPanels(geometry).map((item) => supportMarkup(item, model.textLayoutBindings)).join("")}</div>${contourMaskMarkup(geometry)}`
      : `<div class="intersection-support-layer"><div class="intersection-native-base" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="intersection-native-base"></div></div>`;
    return `<section class="intersection-review" data-ppt-root data-item-count="${model.items.length}" data-support-mode="${model.showSupport ? "shown" : "hidden"}">
      ${support}
      <div class="intersection-diagram">
        ${geometry.map((item) => setMarkup(item, model.items.length)).join("")}
        ${sharedMarkup(model.shared, geometry[0].coreSize, model.textLayoutBindings, center)}
      </div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  items: Object.freeze([
    Object.freeze({ key: "need", title: "用户需要", body: "真实场景中的核心诉求", points: Object.freeze(["高频需求", "稳定交付"]) }),
    Object.freeze({ key: "standard", title: "组织规范", body: "统一标准与可靠边界", points: Object.freeze(["主题一致", "格式规范"]) }),
    Object.freeze({ key: "expression", title: "表达能力", body: "清晰呈现与灵活适配", points: Object.freeze(["逻辑清楚", "版式恰当"]) }),
    Object.freeze({ key: "asset", title: "资产能力", body: "结构与文字排版可复用", points: Object.freeze(["结构可选", "代码可调"]) }),
    Object.freeze({ key: "feedback", title: "反馈校准", body: "持续吸收真实使用问题", points: Object.freeze(["发现缺口", "优化资产"]) }),
  ]),
  shared: Object.freeze({ title: "可靠生成", body: "共同价值" }),
  showSupport: true,
});

export function resolvePreviewParameters(base, selection) {
  const resolved = structuredClone(base);
  resolved.items = resolved.items.slice(0, Number(selection?.itemCount ?? 3));
  resolved.showSupport = selection?.supportMode !== "关闭";
  return resolved;
}
