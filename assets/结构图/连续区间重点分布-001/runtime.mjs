import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent, _decision, _compositionPage, visualPage) {
  const emphasizedIndex = content.items.findIndex((item) => item.emphasis);
  const centerIndex = Math.floor((content.items.length - 1) / 2);
  const focusIndex = content.items.length === 4 && [1, 2].includes(emphasizedIndex)
    ? emphasizedIndex
    : centerIndex;
  return renderPayload(intent, "progression-spectrum-focus-001", {
    title: content.title,
    dimensionLabel: visualPage?.centerLabel || "程度",
    axisLow: "低",
    axisHigh: "高",
    focusIndex,
    items: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      body: item.body,
    })),
  }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
