import { buildEndToEndOperations, runGenerator } from "../../../src/asset-runtime/operating-model-builders.mjs";

export { buildEndToEndOperations };

await runGenerator(import.meta.url, buildEndToEndOperations, {
  title: "智慧供应链全链路运营框架",
  stages: ["采购", "制造", "仓储"],
  centerLabel: "一站式全链路运营平台",
  nodes: ["需求", "采购", "生产", "仓储", "物流", "金融"],
  leftFlow: "计划",
  rightFlow: "运营",
  pillars: [
    { title: "决策智能化", items: ["采购决策", "配送决策", "运营决策"] },
    { title: "运营可视化", items: ["过程可视", "仓储可视", "风险可视"] },
    { title: "组织生态化", items: ["协同关系", "资源共通", "信息共享"] },
    { title: "要素集成化", items: ["价值管理", "生产管理", "风险管理"] }
  ]
});
