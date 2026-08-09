import { buildCycleLoop, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildCycleLoop };
await runGenerator(import.meta.url, buildCycleLoop, {
  title: "循环闭环",
  center: "持续改进",
  steps: ["计划", "执行", "检查", "改进"]
});
