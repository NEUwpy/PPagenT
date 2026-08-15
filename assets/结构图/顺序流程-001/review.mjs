import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("sequence", "sequence-arrow-cards-p27");
export const previewParameters = Object.freeze({ title: "从问题到交付", steps: [
  { title: "需求澄清", body: "明确目标、边界与输入" }, { title: "资料整理", body: "形成统一可靠的信息底座" },
  { title: "方案设计", body: "建立结构和执行规则" }, { title: "实施生成", body: "按规则完成确定性输出" },
  { title: "质量验证", body: "检查关键约束和画面结果" }, { title: "交付复盘", body: "记录问题并持续改进" },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.steps = result.steps.slice(0, selection.stepCount); return result; }
