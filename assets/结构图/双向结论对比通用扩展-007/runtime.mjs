import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function text(value) {
  return String(value ?? "").trim();
}

export function mapPageContent(content, intent) {
  if (!Array.isArray(content?.items) || content.items.length !== 2) {
    throw new Error("二对象概括对比要求 PageContent.items 恰好包含两个比较对象");
  }
  const items = content.items.map((item, index) => {
    const title = text(item?.title);
    const body = text(item?.body);
    if (!title && !body) {
      throw new Error(`二对象概括对比要求 items[${index}] 至少包含标题或正文`);
    }
    return {
      key: text(item?.id) || `item-${index + 1}`,
      title,
      body,
    };
  });
  return renderPayload(intent, "comparison-two-object-summary-007", {
    title: content.title,
    relationLabel: text(content?.relationLabel) || "对照",
    items,
  }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
}
