import { buildHierarchyPyramid, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
export { buildHierarchyPyramid };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "hierarchy-pyramid-001", {
    title: content.title,
    levels: content.items.map((item) => ({ title: item.title, body: item.body })),
  }, content.items.map((item, index) => mapping(item.id, `levels[${index}]`)));
}

await runGenerator(import.meta.url, buildHierarchyPyramid, {
  title: "层级金字塔",
  levels: [
    { title: "方向层", share: "WHY", body: "明确要解决的问题、价值判断和长期边界" },
    { title: "规则层", share: "HOW", body: "把经验变成可选择、可验证的工作规则" },
    { title: "能力层", share: "WHAT", body: "提供可复用组件、版式和稳定的渲染能力" },
    { title: "执行层", share: "DO", body: "根据真实稿件完成生成、检查与最终交付" }
  ]
});
