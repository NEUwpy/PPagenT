import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";
import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";
import { fitPreservedDesign, preservedTypography } from "../../../src/visual-runtime/preserved-design-layout.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ 4: 52, 5: 46, 6: 42, 7: 34, 8: 32 });

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function pointRows(item) {
  return Array.isArray(item?.points)
    ? item.points.map((point) => text(point?.text ?? point)).filter(Boolean)
    : [];
}

function selectedLayout(bindings, regionId, fallback) {
  return text(bindings?.[regionId]) || fallback;
}

function noteIconMarkup(item, index) {
  return `<div class="note-icon-area">
    <div class="note-icon-panel" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="note-icon-panel-${index}"></div>
    <div class="note-icon-slot" data-slot-id="${escapeHtml(item.key)}-icon" data-slot-role="icon" data-slot-field="items[${index}].iconKey" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="icon" data-slot-provider="tabler-icons" data-slot-required="true">${tablerIconSvgMarkup(item.icon, { name: `note-icon-${index}`, className: "note-icon-svg" })}</div>
  </div>`;
}

function noteSheetMarkup(index, hasTitle) {
  return `<svg class="note-sheet" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <path class="note-sheet-shadow" d="M 1000 735 C 1000 735 1019 980 761 998 C 727 1001 47 1003 2 997 L 0 846 C 261 824 876 917 868 812 C 868 812 932 795 1000 735 Z" data-ppt-kind="path" data-ppt-name="note-sheet-shadow-${index}"></path>
    <path class="note-sheet-paper" d="M 0 1000 L 664 1000 L 788 978 L 1000 758 L 1000 0 L 0 0 Z" data-ppt-kind="path" data-ppt-name="note-sheet-paper-${index}"></path>
    ${hasTitle ? `<rect class="note-sheet-header" x="0" y="0" width="1000" height="172" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="note-sheet-header-${index}"></rect>` : ""}
    <path class="note-sheet-fold" d="M 1000 758 C 1000 758 982 1008 630 1000 C 630 1000 855 1001 842 835 C 842 835 933 818 1000 758 Z" data-ppt-kind="path" data-ppt-name="note-sheet-fold-${index}"></path>
  </svg>`;
}

function normalizeParameters(parameters, adaptive = false) {
  if (!parameters || !Array.isArray(parameters.items)) throw new Error("双排折角便签阵列需要 items 数组");
  const itemCount = parameters.items.length;
  if (!Number.isInteger(itemCount) || itemCount < 4 || itemCount > 8) {
    throw new Error("双排折角便签阵列支持 4–8 个并列项目");
  }
  return {
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
    items: parameters.items.map((item, index) => {
      const title = text(item?.title);
      const body = text(item?.body);
      const points = pointRows(item);
      if (!title) throw new Error(`items[${index}].title 为必填项，便签不能缺少标题头`);
      const totalChars = [...title, ...body, ...points].join("").length;
      if (!adaptive && totalChars > LIMITS[itemCount]) throw new Error(`items[${index}] 超出 ${itemCount} 项状态容量`);
      const iconQuery = text(item?.iconQuery);
      const icon = resolveTablerIcon(text(item?.iconKey) || iconQuery);
      if (!icon) throw new Error(`items[${index}] 需要可解析的 iconKey 或 iconQuery`);
      return {
        key: text(item?.key) || `item-${index + 1}`,
        title,
        body,
        points,
        iconQuery,
        icon,
      };
    }),
  };
}

function noteMarkup(item, index, textLayoutBindings) {
  const regionId = `${item.key}-content-region`;
  const hasTitle = Boolean(item.title);
  return `<article class="note-card" data-has-title="${hasTitle}" data-slot-item-id="${escapeHtml(item.key)}">
    ${noteSheetMarkup(index, hasTitle)}
    ${noteIconMarkup(item, index)}
    ${textRegionMarkup({
      id: regionId,
      field: `items[${index}]`,
      itemId: item.key,
      regionId: "content",
      layoutId: selectedLayout(textLayoutBindings, regionId, "heading-content-flow"),
      compatibleLayoutIds: ["heading-content-flow", "statement-flow", "structured-list-flow", "metric-content-flow"],
      content: { title: item.title, body: item.body, points: item.points },
      className: "note-text-region",
      align: "left",
      valign: "middle",
      density: "compact",
      required: true,
      names: {
        heading: `note-heading-${index}`,
        body: `note-body-${index}`,
        list: `note-point-${index}`,
      },
    })}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "parallel-folded-notes-grid",
  schemaVersion: 5,
  designFrame: FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  textCapacity: Object.freeze({ maxCombinedCharsByState: LIMITS, maxPointsPerItem: 2 }),
  renderAdaptiveMarkup,
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="notes-review" data-ppt-root data-item-count="${model.items.length}">
      <div class="notes-grid">${model.items.map((item, index) => noteMarkup(item, index, model.textLayoutBindings)).join("")}</div>
    </section>`;
  },
});

export function renderAdaptiveMarkup(parameters, { frame = FRAME, theme = {} } = {}) {
  const model = normalizeParameters(parameters, true);
  const count = model.items.length;
  const fit = fitPreservedDesign(frame);
  const s = fit.scale;
  const type = preservedTypography(s, theme);
  const iconScale = Math.min(1, Math.max(s, type.sizes.componentItemTitle / type.base.componentItemTitle));
  const columns = Math.ceil(count / 2);
  const cardWidth = (count === 4 ? 330 : count <= 6 ? 300 : 274) * s;
  const cardHeight = 208 * s;
  const gapX = (count === 4 ? 48 : count <= 6 ? 32 : 14) * s;
  const gapY = (count <= 6 ? 20 : 18) * s;
  const gridWidth = columns * cardWidth + (columns - 1) * gapX;
  const gridHeight = 2 * cardHeight + gapY;
  return `<section class="notes-review notes-adapted" data-ppt-root data-item-count="${count}" style="width:${frame.width}px;height:${frame.height}px;${type.css};--note-header:${35*s}px;--note-icon-panel:${44*iconScale}px;--note-icon:${20*iconScale}px;--note-inset:${16*s}px">
    <style>.notes-adapted .note-icon-area{width:var(--note-icon-panel);height:var(--note-header)}.notes-adapted .note-icon-slot{left:${10*iconScale}px;top:${(35*s-22*iconScale)/2-0.5*s}px;width:${22*iconScale}px;height:${22*iconScale}px}.notes-adapted .note-icon-svg{width:var(--note-icon);height:var(--note-icon)}.notes-adapted .note-card[data-has-title="true"] .note-text-region .ppagent-text-primitive--heading{flex-basis:var(--note-header);min-height:var(--note-header);margin-left:var(--note-icon-panel);padding:0 var(--note-inset) 0 ${10*s}px}.notes-adapted .note-card[data-has-title="true"] .note-text-region .ppagent-text-primitive--body,.notes-adapted .note-card[data-has-title="true"] .note-text-region .ppagent-text-primitive--list{margin:${14*s}px var(--note-inset) 0}</style>
    <div class="notes-grid" style="inset:auto;left:${(frame.width-gridWidth)/2}px;top:${(frame.height-gridHeight)/2}px;width:${gridWidth}px;height:${gridHeight}px;gap:${gapY}px ${gapX}px">${model.items.map((item,index)=>noteMarkup(item,index,model.textLayoutBindings).replace('class="note-card"', `class="note-card" style="flex:0 0 ${cardWidth}px;height:${cardHeight}px"`)).join('')}</div>
  </section>`;
}

export const previewParameters = Object.freeze({
  items: [
    { key: "clarity", title: "结构清楚", body: "关系明确，阅读路径稳定", iconKey: "layout-grid" },
    { key: "reliable", title: "输出可靠", body: "结果保持一致，减少随机波动", iconKey: "shield-check" },
    { key: "editable", title: "原生可编辑", body: "文字与形状均可继续修改", iconKey: "edit" },
    { key: "responsive", title: "响应布局", points: ["数量变化时重新求解", "末行始终保持居中"], iconKey: "arrows-shuffle" },
    { key: "economy", title: "成本可控", body: "把高成本设计前移到建设期", iconKey: "currency-yuan" },
    { key: "reuse", title: "持续复用", body: "已登记能力可以反复调用", iconKey: "refresh" },
    { key: "boundary", title: "适用边界", body: "不适配时换组、拆页或退回简洁排版", iconKey: "route-off" },
    { key: "audit", title: "统一审核", body: "来源、HTML 与结果保持同一条链", iconKey: "clipboard-check" },
  ],
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount);
  if (!Number.isInteger(itemCount) || itemCount < 4 || itemCount > 8) {
    throw new Error("双排折角便签阵列支持 4–8 个并列项目");
  }
  const result = structuredClone(base);
  result.items = result.items.slice(0, itemCount);
  return result;
}
