import { buildComparison, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildComparison };
await runGenerator(import.meta.url, buildComparison, {
  title: "两种生成路线",
  left: { title: "自由生成", items: ["结果难以复现", "版式质量波动", "反复消耗判断", "经验难以沉淀"] },
  right: { title: "受控生成", items: ["输出稳定可靠", "版式边界明确", "问题可以回归", "能力持续积累"], emphasis: true },
  centerLabel: "VS"
});
