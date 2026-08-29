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

export function mapPageContent(content, intent, _decision, _compositionPage, visualPage) {
  if (!Array.isArray(content?.items) || content.items.length < 4 || content.items.length > 8) {
    throw new Error("双排折角便签阵列要求 PageContent.items 包含 4–8 个同级项目");
  }
  const iconQueryByItemId = new Map(
    (visualPage?.iconQueries ?? []).map((item) => [item.sourceItemId, item.query]),
  );
  const items = content.items.map((item, index) => {
    const title = text(item?.title);
    if (!title) throw new Error(`双排折角便签阵列要求 items[${index}].title 非空`);
    return {
      key: text(item?.id) || `item-${index + 1}`,
      title,
      body: text(item?.body),
      points: Array.isArray(item?.points) ? item.points : [],
      iconQuery: iconQueryByItemId.get(item.id) ?? "",
    };
  });
  return renderPayload(
    intent,
    "parallel-folded-notes-grid-002",
    { title: content.title, items },
    content.items.map((item, index) => mapping(item.id, `items[${index}]`)),
  );
}
