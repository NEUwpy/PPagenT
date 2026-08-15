import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("problem-improvement", "problem-improvement-default");
export const previewParameters = Object.freeze({ title: "问题与改进措施", problemTitle: "现状与缺口", improvementTitle: "系统介入与结果", problems: [
  { title: "结果不稳定", body: "相同输入仍可能得到差异较大的页面" }, { title: "经验难沉淀", body: "每次任务都需要重新判断和修正" }, { title: "维护成本高", body: "多套实现造成重复修改与偏差" },
], improvements: [
  { title: "固定能力边界", body: "用已登记 Style Group 承担结构表达" }, { title: "统一参数接口", body: "让 HTML 与 Builder 使用同一输入" }, { title: "建立审查闭环", body: "在入库前完成状态与视觉确认" },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.problems = result.problems.slice(0, selection.problemCount); result.improvements = result.improvements.slice(0, selection.improvementCount); return result; }
