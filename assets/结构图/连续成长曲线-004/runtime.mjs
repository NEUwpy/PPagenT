import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  const items = content.items ?? [];
  if (items.length < 3 || items.length > 6) {
    throw new Error("山路递进要求 3–6 个有序里程点");
  }
  return renderPayload(intent, "progression-growth-curve-004", {
    points: items.map((item) => ({ key: item.id, title: item.title, body: item.body })),
  }, items.map((item, index) => mapping(item.id, `points[${index}]`)));
}
