import { buildInternalExternalEcosystem, runGenerator } from "../../../src/asset-runtime/operating-model-builders.mjs";

export { buildInternalExternalEcosystem };

await runGenerator(import.meta.url, buildInternalExternalEcosystem, {
  title: "企业内外部决策生态",
  bridge: "数据交换与协同",
  internal: {
    center: "内部经营",
    ringLabel: "内部职能与消费行为数据",
    items: ["人资", "财务", "法务", "行政", "研发", "营销"]
  },
  external: {
    center: "外部信息",
    ringLabel: "外部数据与合作伙伴",
    items: ["市场", "技术", "服务", "金融", "物流", "咨询"]
  },
  insights: ["内部数据支撑经营判断", "打通内外部生态形成闭环", "外部信息帮助识别趋势与风险"]
});
