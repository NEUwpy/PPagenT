import { buildLifecycleCurve, runGenerator } from "../../../src/asset-runtime/strategy-model-builders.mjs";

export { buildLifecycleCurve };

await runGenerator(import.meta.url, buildLifecycleCurve, {
  title: "用户生命周期管理",
  phases: [
    { name: "导入期", duration: "0–7天", description: "完成首次接触和基础认知。", level: 0.1, signals: ["完成注册", "首次访问", "形成兴趣"] },
    { name: "成长期", duration: "7–30天", description: "逐步形成稳定使用习惯。", level: 0.55, signals: ["频次提升", "功能探索", "持续互动"] },
    { name: "成熟期", duration: "30–90天", description: "价值达到阶段高点。", level: 0.92, signals: ["稳定使用", "主动推荐", "高价值行为"] },
    { name: "休眠期", duration: "90–120天", description: "活跃下降，需要重新激活。", level: 0.5, signals: ["访问下降", "响应降低", "需求转移"] },
    { name: "流失期", duration: "120天以上", description: "关系中断或停止使用。", level: 0.12, signals: ["长期未访", "停止消费", "负面反馈"] }
  ],
  footer: "不同阶段采用不同的触达、培育、激活和挽回策略"
});
