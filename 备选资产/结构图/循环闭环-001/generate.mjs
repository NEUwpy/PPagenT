import { buildCycleLoop, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildCycleLoop };
await runGenerator(import.meta.url, buildCycleLoop, {
  title: "循环闭环",
  center: "持续改进",
  steps: [
    { title: "观察", body: "收集真实使用中的问题" },
    { title: "判断", body: "确认问题属于内容还是视觉" },
    { title: "修正", body: "更新规则、资产或渲染代码" },
    { title: "验证", body: "使用新稿件重新检查" }
  ]
});
