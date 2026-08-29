import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

const CELL_MODE_LABEL = Object.freeze({
  items: "条目",
  marker: "标记",
  intensity: "强度",
});

export function mapPageContent(content, intent) {
  const structured = content?.structuredData;
  if (structured?.type !== "matrix-grid") {
    throw new Error("行列交叉矩阵要求 PageContent.structuredData.type=matrix-grid");
  }

  const itemById = new Map((content.items ?? []).map((item) => [item.id, item]));
  const cells = structured.cells.map((cell) => ({
    rowId: cell.rowId,
    columnId: cell.columnId,
    marker: cell.marker ?? "",
    level: cell.intensity ?? 0,
    value: cell.value ?? "",
    items: (cell.itemIds ?? []).map((id) => {
      const item = itemById.get(id);
      if (!item) throw new Error(`行列交叉矩阵缺少 items 引用：${id}`);
      return item.title;
    }),
  }));
  const mappings = [
    ...structured.rows.flatMap((row, index) => row.itemId
      ? [mapping(row.itemId, `rows[${index}]`)]
      : []),
    ...structured.cells.flatMap((cell, cellIndex) => (cell.itemIds ?? []).map((id, itemIndex) => (
      mapping(id, `cells[${cellIndex}].items[${itemIndex}]`)
    ))),
  ];

  return renderPayload(intent, "matrix-cross-grid-003", {
    cornerLabel: structured.cornerLabel ?? "对象 × 维度",
    cellMode: CELL_MODE_LABEL[structured.cellMode],
    rows: structured.rows,
    columns: structured.columns,
    cells,
  }, mappings);
}
