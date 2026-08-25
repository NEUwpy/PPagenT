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
  if (structured?.type !== "multi-set-common-intersection") {
    throw new Error("多集合共同交集要求 PageContent.structuredData.type=multi-set-common-intersection");
  }
  const allowedIds = new Set(structured.setIds);
  const items = selectedItems(content, compositionPage)
    .filter((item) => allowedIds.has(item.id))
    .map((item) => ({
      key: item.id,
      title: item.title,
      body: item.body,
      points: item.points ?? [],
    }));
  if (items.length < 2 || items.length > 5) {
    throw new Error("多集合共同交集要求选择 2–5 个集合");
  }
  const shared = structured.shared ?? {};
  if (!String(shared.title ?? "").trim() && !String(shared.body ?? "").trim()) {
    throw new Error("多集合共同交集要求明确共同部分");
  }
  return renderPayload(intent, "containment-multi-set-intersection-001", {
    items,
    shared,
    showSupport: items.some((item) => item.body || item.points.length),
  }, items.map((item, index) => mapping(item.key, `items[${index}]`)));
}
