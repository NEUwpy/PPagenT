import { buildTimelineRoadmap, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
export { buildTimelineRoadmap };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "timeline-roadmap-001", {
    title: content.title,
    milestones: content.items.map((item, index) => ({
      period: String(index + 1).padStart(2, "0"),
      title: item.title,
      body: item.body,
    })),
  }, content.items.map((item, index) => mapping(item.id, `milestones[${index}]`)));
}

await runGenerator(import.meta.url, buildTimelineRoadmap, {
  title: "时间轴与发展历程",
  milestones: [
    { period: "2025", title: "验证方向", body: "用一个真实场景确认需求、边界与最小闭环" },
    { period: "2026", title: "沉淀能力", body: "把稳定经验整理为规则、资产和可调用代码" },
    { period: "2027", title: "扩展场景", body: "在统一内核上逐步适配更多组织和用途" },
    { period: "2028", title: "形成系统", body: "让稿件、视觉规范与可靠交付形成完整链路" }
  ]
});
