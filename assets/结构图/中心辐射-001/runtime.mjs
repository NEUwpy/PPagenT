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
  const iconQueryByItemId = new Map(
    (visualPage?.iconQueries ?? []).map((item) => [item.sourceItemId, item.query]),
  );
  const centerTitleBinding = (compositionPage?.componentText ?? []).find((item) => (
    item.sourceField === "page-title" && item.targetRole === "center-title"
  ));
  return renderPayload(intent, "hub-radial-001", {
    title: content.title,
    center: {
      title: visualPage?.centerLabel ?? centerTitleBinding?.text ?? content.title,
      body: "",
    },
    items: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      body: bodyOf(item),
      iconQuery: iconQueryByItemId.get(item.id) ?? "",
    })),
  }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
