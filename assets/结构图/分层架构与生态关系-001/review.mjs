import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("layered", "layered-platform-p20");
export const previewParameters = Object.freeze({ title: "平台生态", platform: "统一研究与能力平台", sources: ["业务数据", "实验数据", "文献资料", "外部接口", "设备数据", "用户反馈"], apps: ["智能分析", "方案设计", "辅助决策", "成果服务", "风险预警", "持续评估"] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.sources = result.sources.slice(0, selection.sourceCount); result.apps = result.apps.slice(0, selection.applicationCount); return result; }
