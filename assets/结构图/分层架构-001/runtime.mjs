import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "layered-architecture-001", {
    title: content.title,
    layers: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      items: (item.points ?? []).map((point, index) => ({
        key: `${item.id}-item-${index + 1}`,
        title: point?.text ?? point,
      })),
    })),
  }, content.items.map((item, index) => mapping(item.id, `layers[${index}]`)));
}
