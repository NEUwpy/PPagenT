import { buildTheoryIntegrationFramework, runGenerator } from "../../../src/asset-runtime/academic-model-builders.mjs";

export { buildTheoryIntegrationFramework };

await runGenerator(import.meta.url, buildTheoryIntegrationFramework, {
  title: "文献与理论整合框架",
  domains: [
    { name: "传统理论", body: "解释基础关系与经典机制" },
    { name: "数字化视角", body: "补充平台、数据与算法条件" },
    { name: "智能技术", body: "连接自动化能力与决策行为" }
  ],
  criteria: ["可解释性", "可验证性", "可迁移性", "可复现性", "可扩展性"]
});
