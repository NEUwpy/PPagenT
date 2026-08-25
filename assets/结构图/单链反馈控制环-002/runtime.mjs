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

function selectedItems(content, compositionPage) {
  const selectedIds = new Set(compositionPage?.componentItemIds ?? []);
  return selectedIds.size
    ? content.items.filter((item) => selectedIds.has(item.id))
    : content.items;
}

function feedbackTitle(content, compositionPage, visualPage) {
  const binding = (compositionPage?.componentText ?? []).find((item) => (
    item.sourceField === "page-title" && item.targetRole === "center-title"
  ));
  return visualPage?.centerLabel ?? binding?.text ?? content.title;
}

export function mapPageContent(content, intent, _decision, compositionPage, visualPage) {
  const items = selectedItems(content, compositionPage);
  if (items.length < 3 || items.length > 6) {
    throw new Error("单链反馈控制环要求选择 3–6 个前向阶段");
  }
  return renderPayload(intent, "cycle-single-chain-feedback-002", {
    feedbackTargetIndex: 0,
    feedback: {
      title: feedbackTitle(content, compositionPage, visualPage),
      body: "",
    },
    items: items.map((item) => ({
      key: item.id,
      title: item.title,
      body: bodyOf(item),
    })),
  }, items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
