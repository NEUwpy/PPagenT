import { buildDataSummary, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildDataSummary };
await runGenerator(import.meta.url, buildDataSummary, {
  title: "数据摘要",
  metrics: [{ label: "指标 A", value: "72%" }, { label: "指标 B", value: "1,280" }, { label: "指标 C", value: "+18%" }, { label: "指标 D", value: "86" }],
  chartTitle: "阶段数据对比",
  categories: ["阶段一", "阶段二", "阶段三", "阶段四"],
  seriesName: "指标值",
  values: [42, 58, 71, 86],
  summaryTitle: "结论摘要",
  summary: "用两到三条简短结论解释数据变化、主要贡献和后续关注点。"
});
