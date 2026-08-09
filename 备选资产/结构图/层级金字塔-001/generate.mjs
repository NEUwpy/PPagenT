import { buildHierarchyPyramid, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildHierarchyPyramid };
await runGenerator(import.meta.url, buildHierarchyPyramid, {
  title: "层级金字塔",
  levels: [
    { title: "核心层", share: "10%", body: "负责定义方向与核心策略" },
    { title: "关键层", share: "20%", body: "负责关键任务与资源配置" },
    { title: "支撑层", share: "30%", body: "负责协作、保障和能力建设" },
    { title: "基础层", share: "40%", body: "负责日常执行与广泛覆盖" }
  ]
});
