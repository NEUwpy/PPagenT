import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export const matrixQuadrantVisualComponent = new URL(import.meta.url).searchParams.has("dashboard")
  ? undefined
  : visualComponent;

function selectedIds(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? ids : new Set(content.items.map((item) => item.id));
}

function normalizedFocus(value) {
  if (Number.isInteger(value) && value >= -1 && value <= 3) return value;
  return 0;
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "matrix") {
    throw new Error("二维定位象限要求 PageContent.structuredData.type=matrix");
  }
  if (!Array.isArray(structured.quadrants) || structured.quadrants.length !== 4) {
    throw new Error("二维定位象限固定需要四个象限");
  }

  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const selected = selectedIds(content, compositionPage);
  const assigned = new Set();
  const mappings = [];
  const quadrants = structured.quadrants.map((quadrant, quadrantIndex) => {
    if (!Array.isArray(quadrant.itemIds) || quadrant.itemIds.length < 1 || quadrant.itemIds.length > 3) {
      throw new Error(`二维定位象限的 quadrants[${quadrantIndex}].itemIds 需要 1–3 项`);
    }
    const items = quadrant.itemIds.map((itemId, itemIndex) => {
      if (assigned.has(itemId)) throw new Error(`二维定位象限对象重复归属：${itemId}`);
      const item = itemById.get(itemId);
      if (!item || !selected.has(itemId)) throw new Error(`二维定位象限对象未进入当前组件：${itemId}`);
      assigned.add(itemId);
      mappings.push(mapping(itemId, `quadrants[${quadrantIndex}].items[${itemIndex}]`));
      return { key: itemId, title: item.title };
    });
    return {
      title: quadrant.title,
      detail: structuredClone(quadrant.detail),
      items,
    };
  });

  const unassigned = [...selected].filter((itemId) => !assigned.has(itemId));
  if (unassigned.length) throw new Error(`二维定位象限存在未归属对象：${unassigned.join(", ")}`);

  return renderPayload(intent, "matrix-quadrant-priority-001", {
    axes: structuredClone(structured.axes),
    focusQuadrant: normalizedFocus(structured.focusQuadrant),
    showDefinitionRail: structured.showDefinitionRail !== false,
    quadrants,
  }, mappings);
}
