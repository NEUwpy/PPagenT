import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TONES = Object.freeze(["#28577d", "#3f7398", "#6795b2", "#90b2c7", "#b3ccd9"]);

function text(value) { return String(value ?? "").trim(); }
function flatten(node) { return [node, ...node.children.flatMap(flatten)]; }

function normalizeNode(node, path, depth = 1) {
  const title = text(node?.title ?? node?.label);
  if (!title) throw new Error(`${path}.title 不能为空`);
  const children = Array.isArray(node?.children)
    ? node.children.map((child, index) => normalizeNode(child, `${path}.children[${index}]`, depth + 1))
    : [];
  return { key: text(node?.key ?? node?.id) || path.replace(/[^a-z0-9]+/gi, "-"), title, children, depth };
}

function nestedTreeToTopology(root) {
  const layers = [];
  const queue = [{ node: root, depth: 0 }];
  while (queue.length) {
    const { node, depth } = queue.shift();
    layers[depth] ??= [];
    layers[depth].push(node);
    node.children.forEach((child) => queue.push({ node: child, depth: depth + 1 }));
  }
  const adjacency = layers.slice(0, -1).map((parents, depth) => {
    const children = layers[depth + 1];
    return parents.map((parent) => children.map((child) => parent.children.includes(child) ? 1 : 0));
  });
  return {
    layers: layers.map((nodes) => nodes.map(({ key, title }) => ({ key, title }))),
    adjacency,
  };
}

function normalizeTopology(topology) {
  if (!Array.isArray(topology?.layers)) throw new Error("topology.layers 必须是分层节点表");
  if (topology.layers.length < 2 || topology.layers.length > 5) throw new Error("深层归属树支持 2–5 层");
  const layers = topology.layers.map((layer, depth) => {
    if (!Array.isArray(layer) || layer.length < 1 || layer.length > 10) throw new Error(`第 ${depth + 1} 层支持 1–10 个节点`);
    return layer.map((node, index) => normalizeNode({ ...node, children: [] }, `topology.layers[${depth}][${index}]`, depth + 1));
  });
  if (layers[0].length !== 1) throw new Error("第 1 层必须且只能有一个根节点");
  if (!Array.isArray(topology.adjacency) || topology.adjacency.length !== layers.length - 1) throw new Error("相邻层关系矩阵数量必须等于层数减一");
  topology.adjacency.forEach((matrix, depth) => {
    const parents = layers[depth];
    const children = layers[depth + 1];
    if (!Array.isArray(matrix) || matrix.length !== parents.length) throw new Error(`第 ${depth + 1}→${depth + 2} 层关系矩阵行数错误`);
    matrix.forEach((row) => {
      if (!Array.isArray(row) || row.length !== children.length || row.some((value) => value !== 0 && value !== 1)) {
        throw new Error(`第 ${depth + 1}→${depth + 2} 层关系矩阵必须是 ${parents.length}×${children.length} 的 0/1 矩阵`);
      }
    });
    children.forEach((child, childIndex) => {
      const parentIndexes = parents.map((_, parentIndex) => parentIndex).filter((parentIndex) => matrix[parentIndex][childIndex] === 1);
      if (parentIndexes.length !== 1) throw new Error(`节点 ${child.key} 必须且只能归属一个直接父节点`);
      parents[parentIndexes[0]].children.push(child);
    });
  });
  return { root: layers[0][0], layers, adjacency: topology.adjacency.map((matrix) => matrix.map((row) => [...row])) };
}

function normalize(parameters) {
  const topology = parameters?.topology
    ? normalizeTopology(parameters.topology)
    : normalizeTopology(nestedTreeToTopology(normalizeNode(parameters?.root, "root")));
  const { root, layers } = topology;
  const depth = layers.length;
  const nodes = layers.flat();
  if (nodes.some((node) => node.children.length > 10)) throw new Error("单个父节点最多支持 10 个直接子节点");
  const terminalCount = nodes.filter((node) => !node.children.length).length;
  return {
    root,
    layers,
    adjacency: topology.adjacency,
    depth,
    terminalCount,
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function selectedLayout(bindings, regionId) { return text(bindings?.[regionId]) || "statement-flow"; }

function assignRows(layers) {
  layers.forEach((nodes) => {
    const height = nodeHeight(nodes[0], layers.length, nodes.length);
    const safeTop = height / 2 + 4;
    const safeBottom = DESIGN_FRAME.height - height / 2 - 4;
    const top = nodes.length <= 4 ? Math.max(72, safeTop) : safeTop;
    const bottom = nodes.length <= 4 ? Math.min(420, safeBottom) : safeBottom;
    const span = bottom - top;
    nodes.forEach((node, index) => {
      node.rowY = nodes.length === 1 ? 246 : top + index * (span / (nodes.length - 1));
    });
  });
}

function levelGeometry(depth) {
  if (depth === 2) return [{ x: 36, width: 235 }, { x: 620, width: 500 }];
  if (depth === 3) return [{ x: 18, width: 208 }, { x: 332, width: 220 }, { x: 715, width: 408 }];
  if (depth === 4) return [{ x: 12, width: 205 }, { x: 264, width: 188 }, { x: 532, width: 196 }, { x: 816, width: 327 }];
  return [
    { x: 8, width: 162 },
    { x: 212, width: 168 },
    { x: 428, width: 176 },
    { x: 652, width: 198 },
    { x: 900, width: 250 },
  ];
}

function nodeHeight(node, depth, levelSize) {
  if (node.depth === 1) return 104;
  if (levelSize >= 9) return 42;
  if (levelSize >= 7) return 48;
  if (levelSize >= 5) return node.depth === depth ? 52 : 56;
  if (node.depth === depth) return depth >= 4 ? 54 : 62;
  return depth >= 4 ? 60 : 70;
}

function connectorMarkup(root, geometry) {
  const paths = [];
  for (const parent of flatten(root)) {
    for (const child of parent.children) {
      const from = geometry[parent.depth - 1];
      const to = geometry[child.depth - 1];
      const x1 = from.x + from.width - 5;
      const x2 = to.x + 5;
      const bend = x1 + (x2 - x1) * .48;
      const tone = TONES[Math.min(child.depth - 1, TONES.length - 1)];
      paths.push(`<path d="M ${x1} ${parent.rowY} C ${bend} ${parent.rowY}, ${bend} ${child.rowY}, ${x2} ${child.rowY}" fill="none" stroke="${tone}" stroke-width="${child.depth === 2 ? 7 : 4}" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="hierarchy-link-${parent.key}-${child.key}"></path>`);
      paths.push(`<circle cx="${x2}" cy="${child.rowY}" r="${child.depth === 2 ? 6 : 4.5}" fill="${tone}" stroke="#fff" stroke-width="3" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hierarchy-joint-${child.key}"></circle>`);
    }
  }
  return paths.join("");
}

function shapeMarkup(node, width, height, tone) {
  if (node.depth === 1) {
    return `<svg class="node-shape" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="M 7 16 L ${width - 36} 4 L ${width - 5} ${height / 2} L ${width - 36} ${height - 4} L 7 ${height - 16} Z" fill="${tone}" data-ppt-kind="path" data-ppt-name="hierarchy-root-surface"></path><path d="M 12 ${height - 17} L ${width - 38} ${height - 5} L ${width - 6} ${height / 2} L ${width - 18} ${height - 22} L 22 ${height - 30} Z" fill="#1f496b" opacity=".34" data-ppt-kind="path" data-ppt-name="hierarchy-root-fold"></path></svg>`;
  }
  if (node.depth === 2) {
    return `<svg class="node-shape" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="M 5 10 L ${width - 28} 2 L ${width - 4} ${height / 2} L ${width - 28} ${height - 2} L 5 ${height - 10} Z" fill="${tone}" data-ppt-kind="path" data-ppt-name="hierarchy-branch-surface-${node.key}"></path><path d="M 5 10 L 22 ${height / 2} L 5 ${height - 10} Z" fill="#fff" opacity=".22" data-ppt-kind="path" data-ppt-name="hierarchy-branch-notch-${node.key}"></path></svg>`;
  }
  return `<svg class="node-shape" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="M 4 4 L ${width - 18} 4 L ${width - 4} ${height / 2} L ${width - 18} ${height - 4} L 4 ${height - 4} Z" fill="${node.depth === 3 ? "#edf3f6" : "#f5f7f8"}" stroke="${tone}" stroke-width="1.6" data-ppt-kind="path" data-ppt-name="hierarchy-node-surface-${node.key}"></path><path d="M 4 4 L 14 4 L 14 ${height - 4} L 4 ${height - 4} Z" fill="${tone}" data-ppt-kind="path" data-ppt-name="hierarchy-node-accent-${node.key}"></path></svg>`;
}

function nodeMarkup(node, geometry, depth, levelSize, bindings, depthIndex) {
  const frame = geometry[node.depth - 1];
  const height = nodeHeight(node, depth, levelSize);
  const top = node.rowY - height / 2;
  const tone = TONES[Math.min(node.depth - 1, TONES.length - 1)];
  const regionId = `node-${node.key}`;
  const lightNode = node.depth >= 3;
  const marker = node.depth === 2
    ? `<span class="node-index" data-ppt-kind="text" data-ppt-name="hierarchy-index-${node.key}">${String(depthIndex).padStart(2, "0")}</span>`
    : node.depth >= 3
      ? `<i class="node-marker" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hierarchy-marker-${node.key}"></i>`
      : "";
  return `<article class="hierarchy-node level-${node.depth}${lightNode ? " light-node" : ""}" style="--left:${frame.x}px;--top:${top}px;--width:${frame.width}px;--height:${height}px;--tone:${tone}" data-node-depth="${node.depth}">${shapeMarkup(node, frame.width, height, tone)}${marker}${textRegionMarkup({ id: regionId, field: node.key, itemId: node.key, regionId: "content", layoutId: selectedLayout(bindings, regionId), compatibleLayoutIds: ["statement-flow", "heading-content-flow"], content: { title: node.title }, className: "node-text", align: lightNode ? "left" : "center", valign: "middle", density: "compact", required: true, names: { heading: `hierarchy-node-text-${node.key}` } })}</article>`;
}

export const visualComponent = Object.freeze({
  id: "hierarchy-deep-cascade",
  schemaVersion: 6,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    assignRows(model.layers);
    const geometry = levelGeometry(model.depth);
    const nodes = model.layers.flat();
    const maxLevelSize = Math.max(...model.layers.map((layer) => layer.length));
    const depthCounters = {};
    return `<section class="deep-hierarchy" data-ppt-root data-level-count="${model.depth}" data-terminal-count="${model.terminalCount}" data-max-level-size="${maxLevelSize}"><svg class="hierarchy-links" viewBox="0 0 1170 492" aria-hidden="true">${connectorMarkup(model.root, geometry)}</svg>${nodes.map((node) => {
      depthCounters[node.depth] = (depthCounters[node.depth] ?? 0) + 1;
      return nodeMarkup(node, geometry, model.depth, model.layers[node.depth - 1].length, model.textLayoutBindings, depthCounters[node.depth]);
    }).join("")}</section>`;
  },
});

const PREVIEW_LABELS = Object.freeze({
  2: Object.freeze(["内容组织", "视觉组织", "稳定交付", "运行反馈"]),
  3: Object.freeze(["稿件理解", "叙事编排", "Logic 判断", "内容绑定", "原生编译", "质量校准", "资产回流", "运行监测"]),
  4: Object.freeze(["事实边界", "主题提炼", "页面节奏", "结构选择", "文字排版", "媒体匹配", "对象编辑", "结果核对", "缺口登记", "持续优化"]),
  5: Object.freeze(["来源片段", "核心判断", "页面意图", "合法候选", "结构参数", "文本区域", "图标语义", "可编辑对象", "用户反馈", "能力更新"]),
});

function buildPreviewTopology(layerCounts) {
  const layers = [[{ key: "system", title: "可靠生成体系" }]];
  const adjacency = [];
  for (let depth = 2; depth <= layerCounts.length; depth += 1) {
    const count = layerCounts[depth - 1];
    const labels = PREVIEW_LABELS[depth];
    const nodes = Array.from({ length: count }, (_, index) => ({
      key: `level-${depth}-node-${index + 1}`,
      title: labels[index] ?? `第 ${depth} 层节点 ${index + 1}`,
    }));
    const parents = layers[depth - 2];
    const matrix = parents.map(() => Array(count).fill(0));
    nodes.forEach((node, index) => {
      const parentIndex = Math.min(parents.length - 1, Math.floor(index * parents.length / nodes.length));
      matrix[parentIndex][index] = 1;
    });
    layers.push(nodes);
    adjacency.push(matrix);
  }
  return { layers, adjacency };
}

export const previewParameters = Object.freeze({
  topology: buildPreviewTopology([1, 3, 6, 8]),
});

export function resolvePreviewParameters(base, selection) {
  const levelCount = Number(selection?.levelCount ?? 4);
  if (![2, 3, 4, 5].includes(levelCount)) throw new Error("深层归属树支持 2–5 层");
  const available = {
    2: [1, 2, 3, 4],
    3: [1, 2, 3, 4, 5, 6, 7, 8],
    4: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    5: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  };
  const defaults = { 2: 3, 3: 6, 4: 8, 5: 9 };
  const layerCounts = [1];
  for (let depth = 2; depth <= levelCount; depth += 1) {
    const count = Number(selection?.[`level${depth}Count`] ?? defaults[depth]);
    if (!available[depth].includes(count)) throw new Error(`第 ${depth} 层节点数不在支持范围内`);
    layerCounts.push(count);
  }
  const result = structuredClone(base);
  result.topology = buildPreviewTopology(layerCounts);
  return result;
}
