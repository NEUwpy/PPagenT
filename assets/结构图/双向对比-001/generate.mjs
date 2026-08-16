import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { previewParameters, resolvePreviewParameters, visualComponent } from "./review.mjs";
export { previewParameters, resolvePreviewParameters, visualComponent };

function splitPoints(value) { return String(value ?? "").split(/\r?\n|[;；]/).map((item) => item.trim()).filter(Boolean); }
function compactCenterLabel(value) { const label = String(value ?? "").trim(); return label && Array.from(label).length <= 6 ? label : "对比"; }
function boundItems(compositionPage, sourceItemId, fallbackBody) {
  const binding = (compositionPage?.componentBindings ?? []).find((item) => item.bindingId === "group-items" && item.sourceItemId === sourceItemId);
  return binding?.entries?.length ? binding.entries.map((entry) => entry.text) : splitPoints(fallbackBody);
}
export function mapPageContent(content, intent, _decision = null, compositionPage = null) {
  const [left, right] = content.items;
  if (!left || !right) throw new Error(`${content.pageId} 的双向对比需要两个内容组`);
  return renderPayload(intent, "comparison-structure-001", {
    title: content.title,
    left: { title: left.title, items: boundItems(compositionPage, left.id, left.body), emphasis: Boolean(left.emphasis), polarity: left.polarity ?? "neutral" },
    right: { title: right.title, items: boundItems(compositionPage, right.id, right.body), emphasis: Boolean(right.emphasis), polarity: right.polarity ?? "neutral" },
    centerLabel: compactCenterLabel(content.notes),
  }, [mapping(left.id, "left"), mapping(right.id, "right")]);
}
await runHtmlComponentGenerator(import.meta.url, visualComponent, resolvePreviewParameters(previewParameters, { itemsPerSide: 4 }));
