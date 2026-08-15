import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export { buildParallelCards } from "./builder.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function normalizedItems(parameters) {
  const items = parameters?.items ?? [];
  if (!Array.isArray(items) || items.length < 3 || items.length > 7) {
    throw new Error("并列能力卡片支持 3–7 项");
  }
  return items.map((item, index) => {
    const title = String(item?.title ?? "").trim();
    const body = String(item?.body ?? "").trim();
    if (!title) throw new Error(`items[${index}].title 不能为空`);
    return { title, body };
  });
}

export const visualComponent = Object.freeze({
  id: "parallel-cards-p135",
  schemaVersion: 1,
  designFrame: { width: 1170, height: 492 },
  cssFile: "component.css",
  renderMarkup(parameters) {
    const items = normalizedItems(parameters);
    return `<section class="parallel-cards" style="--count:${items.length}" data-ppt-root>${items.map((item, index) => {
      const alternate = index % 2 === 1 ? " is-alt" : "";
      const cardId = `parallel-card-${index}`;
      return `<article class="parallel-card${alternate}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="${cardId}">
        <span class="accent-rail" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${cardId}-accent"></span>
        <span class="index-disc" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="${cardId}-index-disc"></span>
        <span class="index-text" data-ppt-kind="text" data-ppt-name="${cardId}-index">${String(index + 1).padStart(2, "0")}</span>
        <h3 class="item-title" data-ppt-kind="text" data-ppt-name="${cardId}-title">${escapeHtml(item.title)}</h3>
        <p class="item-body" data-ppt-kind="text" data-ppt-valign="top" data-ppt-name="${cardId}-body">${escapeHtml(item.body)}</p>
      </article>`;
    }).join("")}</section>`;
  },
});

export const previewParameters = Object.freeze({
  title: "同级能力建设",
  items: [
    { title: "数据基础", body: "统一数据标准与治理口径" },
    { title: "模型能力", body: "沉淀可复用的建模方法" },
    { title: "验证体系", body: "形成稳定实验与评估流程" },
    { title: "工程交付", body: "把研究能力转化为可用系统" },
    { title: "协同机制", body: "让角色分工和信息接口清晰可见" },
    { title: "质量控制", body: "在交付前识别容量与几何风险" },
    { title: "持续迭代", body: "把一次成果沉淀为下一次可调用能力" },
  ],
});

export function mapPageContent(content, intent) {
  return renderPayload(intent, "parallel-cards-001", {
    title: content.title,
    items: content.items.map((item) => ({ title: item.title, body: item.body ?? "" })),
  }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
