import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function bodyOf(item) {
  return [
    item.body,
    ...(item.points ?? []).map((point) => point?.text ?? point),
  ].filter(Boolean).join("；");
}

export function mapPageContent(content, intent, _decision, compositionPage, visualPage) {
  const selectedIds = new Set(compositionPage?.componentItemIds ?? []);
  const items = selectedIds.size
    ? content.items.filter((item) => selectedIds.has(item.id))
    : content.items;
  if (items.length < 3 || items.length > 6) {
    throw new Error("回环轨道循环要求选择 3–6 个循环阶段");
  }
  const centerTitleBinding = (compositionPage?.componentText ?? []).find((item) => (
    item.sourceField === "page-title" && item.targetRole === "center-title"
  ));
  return renderPayload(intent, "cycle-racetrack-loop-005", {
    center: {
      title: visualPage?.centerLabel ?? centerTitleBinding?.text ?? "",
      body: "",
    },
    items: items.map((item) => ({
      key: item.id,
      title: item.title,
      body: bodyOf(item),
    })),
  }, items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
