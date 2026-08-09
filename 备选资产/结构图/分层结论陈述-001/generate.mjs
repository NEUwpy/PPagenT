import { buildConclusionBands, runGenerator } from "../../../src/asset-runtime/academic-model-builders.mjs";

export { buildConclusionBands };

await runGenerator(import.meta.url, buildConclusionBands, {
  title: "主要研究结论",
  sections: [
    { name: "基础发现", points: ["关键变量之间存在稳定关联", "不同情境下作用强度存在差异", "主要结果通过稳健性检验"] },
    { name: "机制解释", points: ["中介路径得到数据支持", "边界条件改变部分作用方向", "理论模型与观测结果保持一致"] },
    { name: "实践启示", points: ["优先干预高影响环节", "采用分层策略匹配不同对象", "建立持续监测和反馈机制"] }
  ]
});
