import { buildLayeredArchitectureAdaptive, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildLayeredArchitectureAdaptive };
await runGenerator(import.meta.url, buildLayeredArchitectureAdaptive, {
  title: "分层架构与生态关系",
  sources: ["来源一", "来源二", "来源三", "来源四", "来源五", "来源六"],
  platform: "核心平台 / 中间层",
  apps: ["应用一", "应用二", "应用三", "应用四"]
});
