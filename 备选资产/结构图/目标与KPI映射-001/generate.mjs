import { buildGoalKpiMap, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildGoalKpiMap };
await runGenerator(import.meta.url, buildGoalKpiMap, {
  title: "目标与 KPI 映射",
  goal: "目标完成情况",
  rows: [
    { title: "目标一", body: "说明目标及其完成情况", metrics: [{ value: "10", label: "指标 A" }, { value: "20%", label: "指标 B" }] },
    { title: "目标二", body: "说明目标及其完成情况", metrics: [{ value: "5K", label: "指标 A" }, { value: "15%", label: "指标 B" }] },
    { title: "目标三", body: "说明目标及其完成情况", metrics: [{ value: "45天", label: "指标 A" }, { value: "25%", label: "指标 B" }] }
  ],
  summary: "总结\n持续改进"
});
