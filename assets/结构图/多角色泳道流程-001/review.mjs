import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("swimlane", "swimlane-process-default");
export const previewParameters = Object.freeze({ title: "跨角色协同流程", lanes: ["内容团队", "视觉团队", "工程团队"], stages: ["理解", "设计", "交付"], tasks: [
  { lane: 0, stage: 0, label: "拆解稿件" }, { lane: 0, stage: 1, label: "确认页面内容" }, { lane: 0, stage: 2, label: "内容验收" },
  { lane: 1, stage: 0, label: "判断视觉关系" }, { lane: 1, stage: 1, label: "选择 Style Group" }, { lane: 1, stage: 2, label: "视觉验收" },
  { lane: 2, stage: 0, label: "准备运行参数" }, { lane: 2, stage: 1, label: "生成原生 PPT" }, { lane: 2, stage: 2, label: "交付文件" },
], conclusion: "角色边界清楚，信息能够回流" });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.lanes = result.lanes.slice(0, selection.laneCount); result.stages = result.stages.slice(0, selection.stageCount); result.tasks = result.tasks.filter((task) => task.lane < selection.laneCount && task.stage < selection.stageCount); return result; }
