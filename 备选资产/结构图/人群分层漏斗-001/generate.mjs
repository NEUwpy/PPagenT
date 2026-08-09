import { buildAudienceSegmentationFunnel, runGenerator } from "../../../src/asset-runtime/strategy-model-builders.mjs";

export { buildAudienceSegmentationFunnel };

await runGenerator(import.meta.url, buildAudienceSegmentationFunnel, {
  title: "用户分层运营策略",
  pivot: "核心层",
  upper: [
    { name: "广泛触达", value: "100%" },
    { name: "兴趣用户", value: "35%" },
    { name: "高价值用户", value: "12%" }
  ],
  lower: [
    { name: "核心贡献者", value: "8%" },
    { name: "稳定活跃者", value: "24%" },
    { name: "成长用户", value: "68%" }
  ],
  upperStrategy: { title: "触达与筛选策略", items: ["扩大有效触达并识别兴趣信号", "基于行为深度形成价值分层", "为高价值用户配置专属内容"] },
  lowerStrategy: { title: "活跃与成长策略", items: ["保持核心贡献者的参与和反馈", "引导稳定用户进入高价值行为", "为成长用户设计连续进阶路径"] }
});
