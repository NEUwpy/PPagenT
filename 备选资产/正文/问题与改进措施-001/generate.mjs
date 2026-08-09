import { buildProblemImprovement, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildProblemImprovement };
await runGenerator(import.meta.url, buildProblemImprovement, {
  title: "问题与改进措施",
  problemTitle: "存在问题",
  improvementTitle: "改进措施",
  problems: ["问题一：简要说明现状", "问题二：简要说明现状", "问题三：简要说明现状"],
  improvements: ["措施一：说明对应行动", "措施二：说明对应行动", "措施三：说明对应行动"]
});
