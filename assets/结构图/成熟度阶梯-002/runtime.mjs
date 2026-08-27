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
    throw new Error("成熟度能力阶梯要求 3–6 个有序等级");
  }
  const emphasizedIndex = items.findIndex((item, index) => item.emphasis && index < items.length - 1);
  return renderPayload(intent, "progression-maturity-steps-002", {
    levels: items.map((item) => ({ key: item.id, title: item.title, body: item.body })),
    showStatus: emphasizedIndex >= 0,
    currentIndex: emphasizedIndex >= 0 ? emphasizedIndex : 0,
  }, items.map((item, index) => mapping(item.id, `levels[${index}]`)));
}
