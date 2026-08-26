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
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("；");
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const items = selectedItems(content, compositionPage);
  if (items.length < 2 || items.length > 5) {
    throw new Error("集合交集共识区要求选择 2–5 个独立主体");
  }
  const sharedBody = (compositionPage?.componentText ?? [])
    .find((item) => item.targetRole === "shared-body")?.text ?? "";
  return renderPayload(intent, "convergence-consensus-field-005", {
    sets: items.map((item) => ({
      key: item.id,
      title: item.title,
      body: bodyOf(item),
      iconQuery: item.title,
    })),
    shared: { title: content.title, body: sharedBody },
  }, items.map((item, index) => mapping(item.id, `sets[${index}]`)));
}
