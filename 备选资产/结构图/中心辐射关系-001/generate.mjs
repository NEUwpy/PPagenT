import { buildRadialHub, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildRadialHub };
await runGenerator(import.meta.url, buildRadialHub, {
  title: "中心辐射关系",
  center: "协同能力",
  items: [
    { title: "统一标准", body: "将共同原则转成稳定、可执行的规则" },
    { title: "快速响应", body: "减少重复判断，让常见需求直接复用" },
    { title: "质量可控", body: "在交付之前识别容量和几何风险" },
    { title: "持续积累", body: "把一次作品沉淀为下一次可调用能力" }
  ]
});
