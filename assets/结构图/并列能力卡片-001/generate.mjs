import { buildParallelCards, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export { buildParallelCards };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "parallel-cards-001", {
    title: content.title,
    items: content.items.map((item) => ({
      title: item.title,
      body: item.body ?? "",
    })),
  }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
}

await runGenerator(import.meta.url, buildParallelCards, {
  title: "同级能力建设",
  items: [
    { title: "数据基础", body: "统一数据标准与治理口径" },
    { title: "模型能力", body: "沉淀可复用的建模方法" },
    { title: "验证体系", body: "形成稳定实验与评估流程" },
    { title: "工程交付", body: "把研究能力转化为可用系统" }
  ]
});
