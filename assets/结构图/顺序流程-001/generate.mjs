import { buildSequentialProcess, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";

export { buildSequentialProcess };
await runGenerator(import.meta.url, buildSequentialProcess, {
  title: "顺序流程",
  steps: [
    { title: "需求确认", body: "明确目标、范围与输入" },
    { title: "方案设计", body: "形成结构和执行方案" },
    { title: "实施验证", body: "完成执行并检查结果" },
    { title: "复盘改进", body: "总结问题并持续优化" },
  ],
});
