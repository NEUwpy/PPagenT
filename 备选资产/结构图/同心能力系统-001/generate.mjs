import { buildConcentricCapabilitySystem, runGenerator } from "../../../src/asset-runtime/academic-model-builders.mjs";

export { buildConcentricCapabilitySystem };

await runGenerator(import.meta.url, buildConcentricCapabilitySystem, {
  title: "智能财务能力系统",
  center: "财务智能\n处理系统",
  capabilities: ["自动核算", "智能稽核", "资金管控", "报账终端", "流程管理", "自助报账"]
});
