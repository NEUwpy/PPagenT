import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";
import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

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

function normalizeParameters(parameters) {
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
      if (totalChars > LIMITS[itemCount]) throw new Error(`items[${index}] 超出 ${itemCount} 项状态容量`);
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
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="notes-review" data-ppt-root data-item-count="${model.items.length}">
      <div class="notes-grid">${model.items.map((item, index) => noteMarkup(item, index, model.textLayoutBindings)).join("")}</div>
    </section>`;
  },
});

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
