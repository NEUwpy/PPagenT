import { buildTimelineRoadmap, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildTimelineRoadmap };
await runGenerator(import.meta.url, buildTimelineRoadmap, {
  title: "时间轴与发展历程",
  milestones: [
    { period: "2025", title: "验证方向", body: "用一个真实场景确认需求、边界与最小闭环" },
    { period: "2026", title: "沉淀能力", body: "把稳定经验整理为规则、资产和可调用代码" },
    { period: "2027", title: "扩展场景", body: "在统一内核上逐步适配更多组织和用途" },
    { period: "2028", title: "形成系统", body: "让稿件、视觉规范与可靠交付形成完整链路" }
  ]
});
