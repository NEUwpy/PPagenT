import { buildFunnelConversion, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildFunnelConversion };
await runGenerator(import.meta.url, buildFunnelConversion, {
  title: "转化漏斗",
  stages: [
    { rate: "100%", label: "触达", note: "第一阶段说明与关键观察" },
    { rate: "72%", label: "兴趣", note: "第二阶段说明与关键观察" },
    { rate: "45%", label: "行动", note: "第三阶段说明与关键观察" },
    { rate: "28%", label: "完成", note: "第四阶段说明与关键观察" }
  ]
});
