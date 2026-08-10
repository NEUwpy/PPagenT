import { buildDualTrackRoadmap, runGenerator } from "../../../src/asset-runtime/history-organization-builders.mjs";

export { buildDualTrackRoadmap };

await runGenerator(import.meta.url, buildDualTrackRoadmap, {
  title: "业务与技术双轨演进",
  start: "共同起点",
  trackA: "业务主线",
  trackB: "技术主线",
  stages: [
    { period: "2025", trackA: { title: "验证场景", body: "完成首个真实业务闭环" }, trackB: { title: "搭建基础", body: "形成稳定生成与检查能力" } },
    { period: "2026", trackA: { title: "标准流程", body: "明确交付标准和协作边界" }, trackB: { title: "沉淀组件", body: "积累规则、资产和运行代码" } },
    { period: "2027", trackA: { title: "扩展场景", body: "支持更多组织与汇报用途" }, trackB: { title: "统一内核", body: "复用共同契约与质量门禁" } },
    { period: "2028", trackA: { title: "规模运营", body: "让生产流程持续稳定运行" }, trackB: { title: "智能协同", body: "双导演与资产运行时协同" } }
  ]
});
