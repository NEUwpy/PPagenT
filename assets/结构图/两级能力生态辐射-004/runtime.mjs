import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function selectedItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "hub-tiered-ecosystem") {
    throw new Error("行星环要求 PageContent.structuredData.type=hub-tiered-ecosystem");
  }
  const selected = new Map(selectedItems(content, compositionPage).map((item) => [item.id, item]));
  const innerItems = structured.innerIds.map((id) => selected.get(id)).filter(Boolean);
  const outerItems = structured.outerIds.map((id) => selected.get(id)).filter(Boolean);
  if (innerItems.length < 3 || innerItems.length > 5) {
    throw new Error("行星环要求选择 3–5 个直接能力");
  }
  if (outerItems.length !== 0 && (outerItems.length < 3 || outerItems.length > 8)) {
    throw new Error("行星环要求共同结果为空或包含 3–8 项");
  }
  const allItems = [...innerItems, ...outerItems];
  return renderPayload(intent, "hub-two-tier-capabilities-004", {
    title: content.title,
    center: structured.center.title,
    inner: innerItems.map((item) => item.title),
    outer: outerItems.map((item) => item.title),
  }, allItems.map((item, index) => mapping(
    item.id,
    index < innerItems.length ? `inner[${index}]` : `outer[${index - innerItems.length}]`,
  )));
}
