import { buildFishboneAnalysis, runGenerator } from "../../../src/asset-runtime/analysis-model-builders.mjs";

export { buildFishboneAnalysis };

await runGenerator(import.meta.url, buildFishboneAnalysis, {
  title: "项目延期原因拆解",
  effect: "交付延期",
  branches: [
    { category: "人员", items: ["关键岗位不足", "协同边界不清", "经验不匹配"] },
    { category: "流程", items: ["审批链路过长", "交接标准缺失", "变更响应迟缓"] },
    { category: "技术", items: ["系统稳定性不足", "接口依赖复杂", "测试覆盖不足"] },
    { category: "资源", items: ["预算受限", "设备交付延迟", "外部支持不足"] },
    { category: "需求", items: ["目标多次调整", "验收口径模糊", "优先级冲突"] },
    { category: "环境", items: ["供应链波动", "政策窗口变化", "跨区域协作困难"] }
  ]
});
