import { buildResearchMethodSummary, runGenerator } from "../../../src/asset-runtime/academic-model-builders.mjs";

export { buildResearchMethodSummary };

await runGenerator(import.meta.url, buildResearchMethodSummary, {
  title: "研究方法与样本说明",
  sectionTitle: "样本及数据收集",
  summary: "采用分层抽样与结构化问卷相结合的方法，覆盖不同规模、行业和发展阶段的研究对象，并对有效样本进行一致性和偏差检查。",
  sample: { value: "5830", label: "发放样本" },
  response: { value: "4280", label: "有效回收" },
  dimensions: [
    { name: "研究对象", body: "明确纳入标准、覆盖范围与样本单位。" },
    { name: "成立年限", body: "区分早期、成长和成熟阶段。" },
    { name: "收入来源", body: "识别主要业务结构和交易特征。" },
    { name: "偏差检验", body: "比较早晚期样本并检验非应答偏差。" }
  ]
});
