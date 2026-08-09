import { buildProblemSolutionBowtie, runGenerator } from "../../../src/asset-runtime/strategy-model-builders.mjs";

export { buildProblemSolutionBowtie };

await runGenerator(import.meta.url, buildProblemSolutionBowtie, {
  title: "常见问题与解决路径",
  problemLabel: "常见问题",
  solutionLabel: "解决方案",
  problems: ["数据来源混乱，口径不统一", "资源数量不足，关键环节缺位", "处理响应不及时，信息回流缓慢", "过程管控不足，风险暴露较晚"],
  solutions: ["统一标准并建立完整数据链路", "按优先级配置资源和责任人", "建立周期分析和反馈机制", "设置过程检查点与风险预警"],
  footerLabel: "持续改进动作",
  futureActions: ["完善制度", "强化协同", "监测反馈", "能力建设"]
});
