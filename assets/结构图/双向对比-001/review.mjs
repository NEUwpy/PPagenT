import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("comparison", "comparison-dual-column-p55");
export const previewParameters = Object.freeze({ title: "两种路线的差异", centerLabel: "VS", left: { title: "自由生成", items: ["版式质量波动", "结果难以复现", "反复消耗判断", "经验难以沉淀", "维护成本较高"] }, right: { title: "受控生成", items: ["输出稳定可靠", "边界清楚可验", "问题可以回归", "能力持续积累", "维护责任明确"] } });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.left.items = result.left.items.slice(0, selection.itemsPerSide); result.right.items = result.right.items.slice(0, selection.itemsPerSide); return result; }
