import { buildEvolutionStaircase, runGenerator } from "../../../src/asset-runtime/history-organization-builders.mjs";

export { buildEvolutionStaircase };

await runGenerator(import.meta.url, buildEvolutionStaircase, {
  title: "组织能力演进路径",
  stages: [
    { period: "2022", name: "起步建设", marker: "初创", body: "明确目标和职责边界\n完成基础流程搭建" },
    { period: "2023", name: "规模增长", marker: "成长", body: "形成标准协作机制\n扩充关键岗位能力" },
    { period: "2024", name: "结构转型", marker: "转型", body: "从项目驱动转向平台化\n建立跨部门治理" },
    { period: "2025", name: "全面发展", marker: "发展", body: "实现能力复用\n形成持续改进闭环" }
  ]
});
