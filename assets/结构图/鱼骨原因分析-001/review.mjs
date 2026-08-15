import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("fishbone", "causal-fishbone-p94");
export const previewParameters = Object.freeze({ title: "项目延期原因拆解", effect: "交付延期", branches: [
  { category: "人员", items: ["岗位不足", "边界不清", "经验不匹配", "协同不及时"] }, { category: "流程", items: ["审批过长", "交接缺失", "变更迟缓", "反馈滞后"] },
  { category: "技术", items: ["接口复杂", "测试不足", "工具不稳", "数据异常"] }, { category: "资源", items: ["预算受限", "设备延迟", "排期冲突", "环境不足"] },
  { category: "需求", items: ["目标调整", "口径模糊", "范围扩张", "优先级变化"] }, { category: "环境", items: ["外部波动", "协作困难", "政策变化", "供应延误"] },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.branches = result.branches.slice(0, selection.categoryCount).map((branch) => ({ ...branch, items: branch.items.slice(0, selection.factorsPerCategory) })); return result; }
