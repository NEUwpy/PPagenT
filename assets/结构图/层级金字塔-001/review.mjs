import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("hierarchy", "hierarchy-pyramid-p35");
export const previewParameters = Object.freeze({ title: "能力体系", levels: [
  { title: "愿景层", body: "确定长期价值和目标方向" }, { title: "方向层", body: "明确问题范围与判断边界" },
  { title: "规则层", body: "把经验沉淀为稳定规则" }, { title: "能力层", body: "提供可复用组件和工具" },
  { title: "执行层", body: "面向真实稿件稳定交付" },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.levels = result.levels.slice(-selection.levelCount); return result; }
