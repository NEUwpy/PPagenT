import { buildOmnichannelDomainModel, runGenerator } from "../../../src/asset-runtime/operating-model-builders.mjs";

export { buildOmnichannelDomainModel };

await runGenerator(import.meta.url, buildOmnichannelDomainModel, {
  title: "用户全域运营双域模型",
  publicGate: "公域入口",
  privateGate: "私域承接",
  center: "用户全域经营",
  publicDomain: "公域流量",
  privateDomain: "私域流量",
  publicChannels: ["内容平台", "搜索渠道", "线下场景", "开放合作"],
  privateChannels: ["社群", "会员", "自有应用", "一对一服务"],
  metrics: [
    { label: "公域触达", value: "10 万次" },
    { label: "沉淀用户", value: "2,000 人" },
    { label: "私域转化", value: "17%" }
  ]
});
