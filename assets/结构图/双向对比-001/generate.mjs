import { buildComparison, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";

export { buildComparison };
await runGenerator(import.meta.url, buildComparison, {
  title: "双向对比",
  left: { title: "方案 A", items: ["优势一", "优势二", "优势三"] },
  right: { title: "方案 B", items: ["优势一", "优势二", "优势三"] },
  centerLabel: "共同目标",
});
