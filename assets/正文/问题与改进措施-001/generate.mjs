import { buildProblemImprovement, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildProblemImprovement };
await runGenerator(import.meta.url, buildProblemImprovement, {
  title: "让制作能力变成可复用的生产能力",
  problemTitle: "现状与缺口",
  improvementTitle: "系统介入与结果",
  problems: [
    { title: "已有内容", body: "有专业知识，也有真实的汇报任务。" },
    { title: "缺少制作能力", body: "不擅长拆页、选表达方式和视觉排版。" }
  ],
  improvements: [
    { title: "把方法做成系统", body: "以较低成本获得接近专业标准的结果。" },
    { title: "形成生产能力", body: "让少数人的经验被更多人使用。", emphasis: true }
  ]
});
