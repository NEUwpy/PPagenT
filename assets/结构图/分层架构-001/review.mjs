const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LAYER_TITLE_LIMIT = 8;
const ITEM_TITLE_LIMIT = 8;
const MIN_LAYERS = 3;
const MAX_LAYERS = 5;
const MIN_ITEMS = 2;
const MAX_ITEMS = 4;
const PALETTE = Object.freeze(["#63BEC7", "#55B1C7", "#4DA2C5", "#518DBD", "#5875A9"]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(value).length;
}

function colorFor(index, count) {
  if (count === 1) return PALETTE[2];
  return PALETTE[Math.round(index / (count - 1) * (PALETTE.length - 1))];
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.layers)) throw new Error("悬浮分层架构需要 layers 数组");
  const layerCount = parameters.layers.length;
  if (!Number.isInteger(layerCount) || layerCount < MIN_LAYERS || layerCount > MAX_LAYERS) {
    throw new Error("悬浮分层架构支持 3–5 层");
  }
  return {
    layers: parameters.layers.map((layer, layerIndex) => {
      const title = text(layer?.title);
      if (!title) throw new Error(`layers[${layerIndex}].title 不能为空`);
      if (charCount(title) > LAYER_TITLE_LIMIT) throw new Error(`layers[${layerIndex}].title 超过 ${LAYER_TITLE_LIMIT} 字`);
      if (!Array.isArray(layer?.items) || layer.items.length < MIN_ITEMS || layer.items.length > MAX_ITEMS) {
        throw new Error(`layers[${layerIndex}].items 需要 2–4 项`);
      }
      const key = text(layer?.key) || `layer-${layerIndex + 1}`;
      const items = layer.items.map((item, itemIndex) => {
        const itemTitle = text(item?.title ?? item);
        if (!itemTitle) throw new Error(`layers[${layerIndex}].items[${itemIndex}] 不能为空`);
        if (charCount(itemTitle) > ITEM_TITLE_LIMIT) throw new Error(`layers[${layerIndex}].items[${itemIndex}] 超过 ${ITEM_TITLE_LIMIT} 字`);
        return { key: text(item?.key) || `${key}-item-${itemIndex + 1}`, title: itemTitle };
      });
      return { key, title, items };
    }),
  };
}

function layerFrames(count) {
  const top = 12;
  const totalHeight = 468;
  const gap = count === 3 ? 18 : count === 4 ? 12 : 7;
  const height = (totalHeight - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 1 : index / (count - 1);
    const width = 820 + 270 * progress;
    return {
      left: (DESIGN_FRAME.width - width) / 2,
      top: top + index * (height + gap),
      width,
      height,
    };
  });
}

function layerMarkup(layer, layerIndex, frame, layerCount) {
  const color = colorFor(layerIndex, layerCount);
  const style = `--left:${frame.left.toFixed(2)}px;--top:${frame.top.toFixed(2)}px;--width:${frame.width.toFixed(2)}px;--height:${frame.height.toFixed(2)}px;--layer-color:${color}`;
  const items = layer.items.map((item, itemIndex) => `<div class="architecture-item" data-item-count="${layer.items.length}">
      <span data-slot-id="${escapeHtml(item.key)}-title" data-slot-role="item-title" data-slot-field="layers[${layerIndex}].items[${itemIndex}].title" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${ITEM_TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="layer-${layerIndex}-item-${itemIndex}-title">${escapeHtml(item.title)}</span>
    </div>`).join("");
  return `<article class="architecture-layer" data-layer-index="${layerIndex}" style="${style}">
    <svg class="architecture-layer-shell" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <ellipse class="architecture-layer-shadow" cx="500" cy="89" rx="480" ry="10" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="layer-${layerIndex}-shadow"/>
      <path class="architecture-layer-body" data-ppt-kind="path" data-ppt-name="layer-${layerIndex}-body" data-ppt-shadow="shadow-sm" d="M 42 22 C 42 9 958 9 958 22 L 1000 72 C 1000 93 0 93 0 72 Z"/>
      <path class="architecture-layer-front" data-ppt-kind="path" data-ppt-name="layer-${layerIndex}-front" d="M 0 72 C 0 94 1000 94 1000 72 C 975 103 25 103 0 72 Z"/>
      <ellipse class="architecture-layer-cap" cx="500" cy="22" rx="458" ry="18" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="layer-${layerIndex}-cap"/>
      <path class="architecture-layer-cap-highlight" data-ppt-kind="path" data-ppt-name="layer-${layerIndex}-cap-highlight" d="M 74 18 C 235 4 765 4 926 18 C 754 11 246 11 74 18 Z"/>
    </svg>
    <div class="architecture-layer-content">
      <h3 class="architecture-layer-title" data-slot-id="${escapeHtml(layer.key)}-title" data-slot-role="layer-title" data-slot-field="layers[${layerIndex}].title" data-slot-item-id="${escapeHtml(layer.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LAYER_TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="layer-${layerIndex}-title">${escapeHtml(layer.title)}</h3>
      <div class="architecture-layer-items" data-item-count="${layer.items.length}">${items}</div>
    </div>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "layered-curved-frustums",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    minLayers: MIN_LAYERS,
    maxLayers: MAX_LAYERS,
    minItemsPerLayer: MIN_ITEMS,
    maxItemsPerLayer: MAX_ITEMS,
    maxLayerTitleChars: LAYER_TITLE_LIMIT,
    maxLayerTitleLines: 1,
    maxItemTitleChars: ITEM_TITLE_LIMIT,
    maxItemTitleLines: 1,
    maxPointsPerItem: MAX_ITEMS,
    maxPointChars: ITEM_TITLE_LIMIT,
    maxPointLines: 1,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    const frames = layerFrames(model.layers.length);
    return `<section class="architecture-review" data-ppt-root data-layer-count="${model.layers.length}">
      ${model.layers.map((layer, index) => layerMarkup(layer, index, frames[index], model.layers.length)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  layers: [
    { key: "experience", title: "体验层", items: ["用户门户", "运营工作台", "决策看板"] },
    { key: "application", title: "应用层", items: ["智能分析", "流程协同", "任务管理", "成果服务"] },
    { key: "capability", title: "能力层", items: ["数据服务", "模型服务", "规则引擎", "消息中心"] },
    { key: "data", title: "数据层", items: ["业务数据", "实验数据", "知识资源"] },
    { key: "foundation", title: "基础层", items: ["计算资源", "存储资源", "网络环境", "安全体系"] }
  ]
});

const PREVIEW_LAYER_INDEXES = Object.freeze({
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
});

export function resolvePreviewParameters(base, selection) {
  const layerCount = Number(selection?.layerCount);
  if (!PREVIEW_LAYER_INDEXES[layerCount]) throw new Error("悬浮分层架构支持 3–5 层");
  const result = structuredClone(base);
  result.layers = PREVIEW_LAYER_INDEXES[layerCount].map((index) => result.layers[index]);
  return result;
}
