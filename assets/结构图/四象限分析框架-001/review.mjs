import { cloneParameters, escapeHtml, requireCount, text } from "../../../src/visual-runtime/component-authoring.mjs";

function normalize(parameters) {
  const quadrants = requireCount(parameters?.quadrants, 4, 4, "四象限").map((item, index) => ({ title: text(item?.title) || `象限${index + 1}`, body: text(item?.body) }));
  return { quadrants };
}
function callout(item, index) {
  return `<article class="matrix-callout q${index}" data-side="${index % 2 ? "right" : "left"}">
    <div class="matrix-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-card-${index}"></div>
    <h3 data-ppt-kind="text" data-ppt-name="matrix-title-${index}">${escapeHtml(item.title)}</h3>
    <div class="matrix-rule" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="matrix-rule-${index}"></div>
    <p data-ppt-kind="text" data-ppt-name="matrix-body-${index}" data-ppt-valign="top">${escapeHtml(item.body)}</p>
  </article>`;
}
export const visualComponent = Object.freeze({
  id: "matrix-pest-p69", schemaVersion: 4, designFrame: { width: 1170, height: 492 }, cssFile: "component.css",
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const connectors = model.quadrants.map((_, index) => `<div class="matrix-connector c${index}" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="matrix-connector-${index}"></div>`).join("");
    const petals = model.quadrants.map((item, index) => `<div class="matrix-petal p${index}" data-ppt-kind="shape" data-ppt-shape="teardrop" data-ppt-rotation="${[90,180,0,270][index]}" data-ppt-name="matrix-petal-${index}"></div><div class="matrix-initial i${index}" data-ppt-kind="text" data-ppt-name="matrix-initial-${index}">${escapeHtml(Array.from(item.title)[0] ?? "•")}</div><div class="matrix-petal-title t${index}" data-ppt-kind="text" data-ppt-name="matrix-petal-title-${index}">${escapeHtml(item.title)}</div>`).join("");
    return `<section class="matrix-root" data-ppt-root data-text-density="${model.quadrants.some((item) => item.body.length > 18) ? "long" : "short"}">${connectors}${model.quadrants.map(callout).join("")}<div class="matrix-center">${petals}</div></section>`;
  },
});
const shortQuadrants = [{ title:"政策环境",body:"政策窗口与行业规则"},{ title:"经济环境",body:"成本与市场规模"},{ title:"社会环境",body:"用户需求与接受度"},{ title:"技术环境",body:"技术成熟度与工具链"}];
const longQuadrants = [{ title:"政策环境",body:"关注政策窗口、行业规则以及监管环境的阶段性变化"},{ title:"经济环境",body:"分析成本水平、资金条件和市场规模对项目推进的影响"},{ title:"社会环境",body:"判断用户需求、组织协同和社会接受度是否形成支撑"},{ title:"技术环境",body:"评估技术成熟度、基础设施和工具链能否稳定承载"}];
export const previewParameters = Object.freeze({ title:"外部环境分析", quadrants:longQuadrants });
export function resolvePreviewParameters(base, selection) { const result=cloneParameters(base); result.quadrants=cloneParameters(selection.textDensity === "short" ? shortQuadrants : longQuadrants); return result; }
