import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("funnel", "funnel-conversion-default");
export const previewParameters = Object.freeze({ title: "转化漏斗", stages: [
  { rate: "100%", label: "收到稿件", note: "原始信息完整进入流程" }, { rate: "82%", label: "形成页面", note: "完成叙事拆页与职责判断" },
  { rate: "68%", label: "匹配资产", note: "选择合法结构与样式组" }, { rate: "54%", label: "完成生成", note: "输出原生可编辑页面" },
  { rate: "43%", label: "质量通过", note: "容量与几何检查通过" }, { rate: "36%", label: "可靠交付", note: "形成可复用交付结果" },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.stages = result.stages.slice(0, selection.stageCount); return result; }
