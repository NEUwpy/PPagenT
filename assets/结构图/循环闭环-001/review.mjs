import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("cycle", "cycle-pdca-ring-p57");
export const previewParameters = Object.freeze({ title: "持续改进", center: "持续改进", steps: [
  { title: "观察", body: "收集真实使用中的问题" }, { title: "判断", body: "识别内容或视觉原因" },
  { title: "设计", body: "选择合适的修正方案" }, { title: "修正", body: "更新规则、资产或代码" },
  { title: "验证", body: "用新稿件重新检查" }, { title: "沉淀", body: "把有效经验写回能力库" },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.steps = result.steps.slice(0, selection.stepCount); return result; }
