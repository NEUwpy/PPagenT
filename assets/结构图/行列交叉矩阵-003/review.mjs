const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const CELL_MODES = Object.freeze(["条目", "标记", "强度"]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) { return String(value ?? "").trim(); }
function clampCount(value, field) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 2 || count > 5) throw new RangeError(`${field} 需要 2–5`);
  return count;
}

function normalize(parameters) {
  const rows = Array.isArray(parameters?.rows) ? parameters.rows : [];
  const columns = Array.isArray(parameters?.columns) ? parameters.columns : [];
  if (rows.length < 2 || rows.length > 5) throw new RangeError("行列交叉矩阵需要 2–5 行");
  if (columns.length < 2 || columns.length > 5) throw new RangeError("行列交叉矩阵需要 2–5 列");
  const cellMode = CELL_MODES.includes(parameters?.cellMode) ? parameters.cellMode : "条目";
  const cells = Array.isArray(parameters?.cells) ? parameters.cells : [];
  const cellByKey = new Map(cells.map((cell) => [`${cell.rowId}|${cell.columnId}`, cell]));
  return {
    cornerLabel: text(parameters?.cornerLabel) || "对象 × 维度",
    cellMode,
    rows: rows.map((row, index) => ({ id: text(row?.id) || `row-${index + 1}`, label: text(row?.label) || `对象 ${index + 1}` })),
    columns: columns.map((column, index) => ({ id: text(column?.id) || `column-${index + 1}`, label: text(column?.label) || `维度 ${index + 1}` })),
    cellByKey,
  };
}

function cellContent(cell, mode, rowIndex, columnIndex) {
  if (mode === "标记") {
    const marker = text(cell?.marker);
    return marker ? `<span class="matrix-marker" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="matrix-marker-${rowIndex}-${columnIndex}"><b data-ppt-kind="text" data-ppt-name="matrix-marker-text-${rowIndex}-${columnIndex}">${escapeHtml(marker)}</b></span>` : "";
  }
  if (mode === "强度") {
    const level = Math.max(0, Math.min(4, Number(cell?.level) || 0));
    const value = text(cell?.value) || String(level);
    return `<span class="matrix-intensity" data-ppt-kind="text" data-ppt-name="matrix-intensity-${rowIndex}-${columnIndex}">${escapeHtml(value)}</span>`;
  }
  const items = Array.isArray(cell?.items) ? cell.items.slice(0, 3).map(text).filter(Boolean) : [];
  return `<div class="matrix-cell-items">${items.map((item, itemIndex) => `<span class="matrix-cell-item" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-item-${rowIndex}-${columnIndex}-${itemIndex}"><b data-ppt-kind="text" data-ppt-name="matrix-item-text-${rowIndex}-${columnIndex}-${itemIndex}">${escapeHtml(item)}</b></span>`).join("")}</div>`;
}

function cellMarkup(model, row, column, rowIndex, columnIndex) {
  const cell = model.cellByKey.get(`${row.id}|${column.id}`) ?? {};
  const level = Math.max(0, Math.min(4, Number(cell?.level) || 0));
  return `<section class="matrix-cell" data-mode="${model.cellMode}" data-level="${level}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-cell-${rowIndex}-${columnIndex}">
    ${cellContent(cell, model.cellMode, rowIndex, columnIndex)}
  </section>`;
}

export const visualComponent = Object.freeze({
  id: "matrix-cross-grid",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="matrix-cross-grid" data-ppt-root data-cell-mode="${model.cellMode}" style="--row-count:${model.rows.length};--column-count:${model.columns.length}">
      <header class="matrix-grid-header">
        <div class="matrix-corner" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-corner"><b data-ppt-kind="text" data-ppt-name="matrix-corner-label">${escapeHtml(model.cornerLabel)}</b></div>
        ${model.columns.map((column, index) => `<div class="matrix-column-header" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-column-${index}"><b data-ppt-kind="text" data-ppt-name="matrix-column-label-${index}">${escapeHtml(column.label)}</b></div>`).join("")}
      </header>
      <main class="matrix-grid-body">
        ${model.rows.map((row, rowIndex) => `<div class="matrix-grid-row">
          <div class="matrix-row-header" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="matrix-row-${rowIndex}"><b data-ppt-kind="text" data-ppt-name="matrix-row-label-${rowIndex}">${escapeHtml(row.label)}</b></div>
          ${model.columns.map((column, columnIndex) => cellMarkup(model, row, column, rowIndex, columnIndex)).join("")}
        </div>`).join("")}
      </main>
    </section>`;
  },
});

const ROWS = Object.freeze([
  Object.freeze({ id: "content", label: "内容拆页" }),
  Object.freeze({ id: "structure", label: "结构选择" }),
  Object.freeze({ id: "html", label: "HTML 布局" }),
  Object.freeze({ id: "native", label: "Native 编译" }),
  Object.freeze({ id: "quality", label: "质量检查" }),
]);
const COLUMNS = Object.freeze([
  Object.freeze({ id: "content-director", label: "内容导演" }),
  Object.freeze({ id: "visual-director", label: "视觉导演" }),
  Object.freeze({ id: "runtime", label: "组件运行时" }),
  Object.freeze({ id: "quality-module", label: "质量模块" }),
  Object.freeze({ id: "delivery", label: "交付模块" }),
]);
const MARKERS = Object.freeze([
  ["R", "A", "C", "I", ""], ["C", "R", "A", "I", ""], ["I", "A", "R", "C", ""], ["I", "A", "R", "C", "I"], ["C", "A", "I", "R", "A"],
]);
const LEVELS = Object.freeze([
  [4, 3, 2, 1, 0], [3, 4, 3, 1, 0], [2, 4, 4, 2, 1], [1, 3, 4, 3, 2], [2, 3, 2, 4, 4],
]);
const ITEM_LABELS = Object.freeze(["主责", "审批", "协作", "知会", "复核"]);

function previewCells() {
  return ROWS.flatMap((row, rowIndex) => COLUMNS.map((column, columnIndex) => ({
    rowId: row.id,
    columnId: column.id,
    marker: MARKERS[rowIndex][columnIndex],
    level: LEVELS[rowIndex][columnIndex],
    value: String(LEVELS[rowIndex][columnIndex]),
    items: LEVELS[rowIndex][columnIndex] > 0 ? [ITEM_LABELS[(rowIndex + columnIndex) % ITEM_LABELS.length]] : [],
  })));
}

export const previewParameters = Object.freeze({
  cornerLabel: "任务 × 角色",
  cellMode: "标记",
  rows: ROWS,
  columns: COLUMNS,
  cells: Object.freeze(previewCells()),
});

export function resolvePreviewParameters(base, selection) {
  const rowCount = clampCount(selection?.rowCount ?? 4, "行数");
  const columnCount = clampCount(selection?.columnCount ?? 4, "列数");
  const cellMode = CELL_MODES.includes(selection?.cellMode) ? selection.cellMode : "标记";
  const rows = base.rows.slice(0, rowCount);
  const columns = base.columns.slice(0, columnCount);
  const rowIds = new Set(rows.map((row) => row.id));
  const columnIds = new Set(columns.map((column) => column.id));
  return {
    ...structuredClone(base),
    cellMode,
    rows,
    columns,
    cells: base.cells.filter((cell) => rowIds.has(cell.rowId) && columnIds.has(cell.columnId)),
  };
}
