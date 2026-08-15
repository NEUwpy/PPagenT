import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("timeline", "timeline-roadmap-default");
export const previewParameters = Object.freeze({ title: "发展历程", milestones: [
  { period: "2024", title: "识别问题", body: "明确场景与主要约束" }, { period: "2025", title: "验证方向", body: "用真实任务确认最小闭环" },
  { period: "2026", title: "沉淀能力", body: "把经验整理为规则与资产" }, { period: "2027", title: "扩展场景", body: "适配更多组织和用途" },
  { period: "2028", title: "形成系统", body: "让生成与可靠交付形成链路" }, { period: "2029", title: "持续演进", body: "用反馈推动能力更新" },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.milestones = result.milestones.slice(0, selection.milestoneCount); return result; }
