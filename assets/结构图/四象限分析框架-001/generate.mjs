import { buildFrameworkMatrix, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
export { buildFrameworkMatrix };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "framework-matrix-001", {
    title: content.title,
    quadrants: content.items.map((item) => ({ title: item.title, body: item.body })),
  }, content.items.map((item, index) => mapping(item.id, `quadrants[${index}]`)));
}

await runGenerator(import.meta.url, buildFrameworkMatrix, {
  title: "四象限分析框架",
  quadrants: [
    { title: "象限一", body: "填写本象限的判断依据、现状或行动建议。" },
    { title: "象限二", body: "填写本象限的判断依据、现状或行动建议。" },
    { title: "象限三", body: "填写本象限的判断依据、现状或行动建议。" },
    { title: "象限四", body: "填写本象限的判断依据、现状或行动建议。" }
  ]
});
