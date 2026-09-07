import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { resolveStructureSpatialRequirement } from "../../../src/runtime/structure-adaptation.mjs";

export function resolveSpatialRequirement(parameters, targetFrame, options = {}) {
  return resolveStructureSpatialRequirement("cycle-loop-001", parameters, targetFrame, options);
}
import {
  previewParameters,
  renderAdaptiveMarkup,
  resolveContentSlots,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, renderAdaptiveMarkup, resolveContentSlots, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "cycle-loop-001", {
    title: content.title,
    center: content.notes || content.title,
    steps: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      body: item.body ?? "",
      points: item.points ?? [],
    })),
  }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
}
