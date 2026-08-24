import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";
import { textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function pointRows(item) {
  return Array.isArray(item?.points)
    ? item.points.map((point) => text(point?.text ?? point)).filter(Boolean)
    : [];
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.items)) throw new Error("等权并列卡片需要 items 数组");
  const itemCount = parameters.items.length;
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 5) {
    throw new Error("等权并列卡片支持 3–5 个并列项目");
  }
  return {
    items: parameters.items.map((item, index) => {
      const title = text(item?.title);
      const body = text(item?.body);
      const points = pointRows(item);
      if (!title && !body && !points.length) throw new Error(`items[${index}] 至少需要 title 或正文内容`);
      const key = text(item?.key) || `item-${index + 1}`;
      const iconQuery = text(item?.iconQuery);
      const icon = resolveTablerIcon(text(item?.iconKey) || iconQuery);
      return { key, title, body, points, iconQuery, icon };
    }),
  };
}

function markerMarkup(item, index) {
  const iconMarkup = item.icon
    ? tablerIconSvgMarkup(item.icon, { name: `parallel-icon-${index}`, className: "parallel-icon-svg" })
    : `<div class="parallel-marker-orbit" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="parallel-marker-orbit-${index}"></div>
      <div class="parallel-marker-dot parallel-marker-dot-center" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="parallel-marker-dot-center-${index}"></div>
      <div class="parallel-marker-dot parallel-marker-dot-left" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="parallel-marker-dot-left-${index}"></div>
      <div class="parallel-marker-dot parallel-marker-dot-right" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="parallel-marker-dot-right-${index}"></div>`;
  return `<div class="parallel-marker-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="parallel-marker-halo-${index}"></div>
    <div class="parallel-marker-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="parallel-marker-core-${index}"></div>
    <div class="parallel-icon-slot" data-slot-id="${escapeHtml(item.key)}-icon" data-slot-role="icon" data-slot-field="items[${index}].iconKey" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="icon" data-slot-provider="tabler-icons" data-slot-required="true">${iconMarkup}</div>`;
}

function cardMarkup(item, index) {
  return `<article class="parallel-card" data-key="${escapeHtml(item.key)}">
    <div class="parallel-card-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="parallel-card-underlay-${index}"></div>
    <div class="parallel-card-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="parallel-card-surface-${index}"></div>
    <div class="parallel-card-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="parallel-card-accent-${index}"></div>
    <div class="parallel-marker">${markerMarkup(item, index)}</div>
    ${textFlowMarkup({
      id: `${item.key}-content`,
      field: `items[${index}]`,
      itemId: item.key,
      title: item.title,
      body: item.body,
      points: item.points,
      className: "parallel-content",
      align: "center",
      valign: "middle",
      separator: true,
      bodyField: "support",
      names: {
        title: `parallel-title-${index}`,
        body: `parallel-body-${index}`,
        separator: `parallel-rule-${index}`,
      },
    })}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "parallel-equal-cards",
  schemaVersion: 5,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "standard", scope: "per-item" }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="parallel-review" data-ppt-root data-item-count="${model.items.length}">
      <div class="parallel-grid">${model.items.map((item, index) => cardMarkup(item, index)).join("")}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  items: [
    { key: "professional", title: "专业能力", body: "以可靠的方法与扎实知识解决复杂任务", iconQuery: "professional tools" },
    { key: "collaboration", title: "协同能力", body: "围绕共同目标整合人员、平台与资源", iconQuery: "team collaboration" },
    { key: "innovation", title: "创新能力", body: "从真实约束中提出新的思路与解决路径", iconQuery: "innovation idea" },
    { key: "execution", title: "执行能力", body: "把明确方案稳定转化为可交付的结果", iconQuery: "delivery execution" },
    { key: "learning", title: "学习能力", body: "持续吸收经验并转化为新的工作方法", iconQuery: "learning study" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount);
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 5) {
    throw new Error("等权并列卡片支持 3–5 项");
  }
  const result = structuredClone(base);
  result.items = result.items.slice(0, itemCount);
  return result;
}
