import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function requiredPointText(point, field) {
  const value = typeof point === "string" ? point : point?.text;
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${field} 不能为空`);
  return normalized;
}

export function mapPageContent(content, intent) {
  if (!Array.isArray(content?.items) || content.items.length < 2 || content.items.length > 5) {
    throw new Error("分组展开结构要求 2–5 个具名分组");
  }

  const maxPoints = content.items.length === 5 ? 3 : 4;
  const items = content.items.map((item, itemIndex) => {
    if (!Array.isArray(item?.points) || item.points.length < 1 || item.points.length > maxPoints) {
      throw new Error(`items[${itemIndex}].points 必须包含 1–${maxPoints} 个来源分点`);
    }
    return {
      key: item.id,
      title: item.title,
      points: item.points.map((point, pointIndex) => requiredPointText(
        point,
        `items[${itemIndex}].points[${pointIndex}]`,
      )),
    };
  });

  return renderPayload(
    intent,
    "hierarchy-grouped-breakdown-005",
    { root: content.title, items },
    content.items.map((item, index) => mapping(item.id, `items[${index}]`)),
  );
}
