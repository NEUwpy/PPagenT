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

function bodyOf(item) {
  return [item.body, ...(item.points ?? [])]
    .map((value) => String(value?.text ?? value ?? "").trim())
    .filter(Boolean)
    .join("；");
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "multi-set-common-intersection") {
    throw new Error("集合交集共识区要求 PageContent.structuredData.type=multi-set-common-intersection");
  }
  const allowedIds = new Set(structured.setIds);
  const items = selectedItems(content, compositionPage).filter((item) => allowedIds.has(item.id));
  if (items.length < 2 || items.length > 5) {
    throw new Error("集合交集共识区要求选择 2–5 个独立主体");
  }
  const shared = structured.shared ?? {};
  if (![shared.title, shared.body, ...(shared.points ?? [])].some((value) => String(value?.text ?? value ?? "").trim())) {
    throw new Error("集合交集共识区要求原稿明确提供共同部分");
  }
  return renderPayload(intent, "containment-consensus-field-005", {
    sets: items.map((item) => ({
      key: item.id,
      title: item.title,
      body: bodyOf(item),
      iconQuery: item.title,
    })),
    shared,
  }, items.map((item, index) => mapping(item.id, `sets[${index}]`)));
}
