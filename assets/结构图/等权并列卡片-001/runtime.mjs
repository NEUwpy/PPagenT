import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent, _decision, _compositionPage, visualPage) {
  const iconQueryByItemId = new Map(
    (visualPage?.iconQueries ?? []).map((item) => [item.sourceItemId, item.query]),
  );
  return renderPayload(intent, "parallel-equal-cards-001", {
    title: content.title,
    items: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      body: item.body,
      points: item.points,
      iconQuery: iconQueryByItemId.get(item.id) ?? "",
    })),
  }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
