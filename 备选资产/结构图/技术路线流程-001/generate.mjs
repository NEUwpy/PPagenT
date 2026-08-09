import { buildTechnicalRouteFlow, runGenerator } from "../../../src/asset-runtime/academic-model-builders.mjs";

export { buildTechnicalRouteFlow };

await runGenerator(import.meta.url, buildTechnicalRouteFlow, {
  title: "研究技术路线",
  startLabel: "研究启动",
  question: "明确核心研究问题",
  objective: "确定整体优化目标",
  branches: ["性能目标", "生态目标", "可靠性目标"],
  core: "构建多目标分析与决策模型",
  inputs: ["实验数据", "现场观测", "专家知识"],
  analysis: "分析变量关系并验证模型稳健性",
  result: "形成结论"
});
