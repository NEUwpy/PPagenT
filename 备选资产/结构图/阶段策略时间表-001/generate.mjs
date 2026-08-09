import { buildPhaseStrategyTimeline, runGenerator } from "../../../src/asset-runtime/strategy-model-builders.mjs";

export { buildPhaseStrategyTimeline };

await runGenerator(import.meta.url, buildPhaseStrategyTimeline, {
  title: "新品上市阶段传播策略",
  periods: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  phases: [
    { name: "预热期", start: 0, end: 4, objective: "建立认知并积累关注", tasks: ["明确核心话题", "启动种子内容", "沉淀首批用户"] },
    { name: "上市期", start: 4, end: 8, objective: "集中曝光并建立价值", tasks: ["发布核心内容", "形成媒体联动", "验证转化路径"] },
    { name: "增长期", start: 8, end: 12, objective: "强化体验并形成口碑", tasks: ["复用优质素材", "扩大用户案例", "优化持续运营"] }
  ],
  actionLanes: [
    { name: "内容", actions: [{ label: "概念预热", start: 0, end: 3 }, { label: "集中发布", start: 4, end: 7 }, { label: "案例扩散", start: 8, end: 12 }] },
    { name: "活动", actions: [{ label: "种子体验", start: 1, end: 4 }, { label: "上市活动", start: 5, end: 8 }, { label: "社群运营", start: 9, end: 12 }] },
    { name: "渠道", actions: [{ label: "渠道准备", start: 0, end: 4 }, { label: "联合推广", start: 4, end: 9 }, { label: "长期投放", start: 9, end: 12 }] }
  ]
});
