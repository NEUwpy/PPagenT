import { buildDualTrackRoadmap, runGenerator } from "../../../src/asset-runtime/history-organization-builders.mjs";

export { buildDualTrackRoadmap };

await runGenerator(import.meta.url, buildDualTrackRoadmap, {
  title: "业务与技术双轨演进",
  trackA: "业务主线",
  trackB: "技术主线",
  stages: [
    { period: "2021", name: "能力起步", body: "建立基础服务并完成首个场景" },
    { period: "2022", name: "流程标准化", body: "形成稳定流程和统一数据口径" },
    { period: "2023", name: "平台化扩展", body: "沉淀公共能力并支持多场景复用" },
    { period: "2024", name: "智能化运营", body: "业务策略与自动化能力协同演进" }
  ]
});
