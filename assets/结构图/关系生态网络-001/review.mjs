import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const CORE = Object.freeze({ x: 585, y: 246, radius: 76 });
const NODE_RADIUS = 61;
const GROUP_GEOMETRY = Object.freeze({
  internal: Object.freeze({ x: 430, y: 246, radiusX: 214, radiusY: 150 }),
  external: Object.freeze({ x: 740, y: 246, radiusX: 214, radiusY: 150 }),
});
const ANGLES = Object.freeze({
  internal: Object.freeze({
    2: Object.freeze([210, 150]),
    3: Object.freeze([220, 180, 140]),
    4: Object.freeze([230, 195, 165, 130]),
  }),
  external: Object.freeze({
    2: Object.freeze([-30, 30]),
    3: Object.freeze([-40, 0, 40]),
    4: Object.freeze([-50, -15, 15, 50]),
  }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeNode(node, group, index) {
  const title = text(node?.title);
  const body = text(node?.body);
  if (!title && !body) throw new Error(`${group}.nodes[${index}] 至少需要 title 或 body`);
  return {
    key: text(node?.key) || `${group}-${index + 1}`,
    title,
    body,
    group,
    index,
  };
}

function normalizeGroup(group, name) {
  const title = text(group?.title);
  const nodes = Array.isArray(group?.nodes)
    ? group.nodes.map((node, index) => normalizeNode(node, name, index))
    : [];
  if (!title) throw new Error(`${name}.title 不能为空`);
  if (nodes.length < 2 || nodes.length > 4) throw new Error(`${name}.nodes 支持 2–4 个主体`);
  return { title, nodes, name };
}

function normalize(parameters) {
  const internal = normalizeGroup(parameters?.internal, "internal");
  const external = normalizeGroup(parameters?.external, "external");
  const core = { title: text(parameters?.core?.title), body: text(parameters?.core?.body) };
  if (!core.title) throw new Error("core.title 不能为空");
  const nodes = [...internal.nodes, ...external.nodes];
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  if (nodeByKey.size !== nodes.length) throw new Error("关系网络节点 key 必须唯一");
  const links = [];
  const seen = new Set();
  for (const [index, link] of (Array.isArray(parameters?.links) ? parameters.links : []).entries()) {
    const from = text(link?.from);
    const to = text(link?.to);
    if (!nodeByKey.has(from) || !nodeByKey.has(to) || from === to) {
      throw new Error(`links[${index}] 必须引用两个不同的已有节点`);
    }
    const signature = [from, to].sort().join("::");
    if (seen.has(signature)) continue;
    seen.add(signature);
    const fromNode = nodeByKey.get(from);
    const toNode = nodeByKey.get(to);
    links.push({
      from,
      to,
      kind: fromNode.group === toNode.group ? fromNode.group : "cross",
    });
  }
  if (links.length < 3 || links.length > 12) throw new Error("关系生态网络需要 3–12 条明确关系");
  if (!links.some((link) => link.kind === "internal")) throw new Error("至少需要一条内部同域关系");
  if (!links.some((link) => link.kind === "external")) throw new Error("至少需要一条外部同域关系");
  if (!links.some((link) => link.kind === "cross")) throw new Error("至少需要一条内外跨域关系");
  return {
    core,
    internal,
    external,
    links,
    nodeByKey,
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function nodeGeometry(group) {
  const geometry = GROUP_GEOMETRY[group.name];
  const angles = ANGLES[group.name][group.nodes.length];
  return group.nodes.map((node, index) => {
    const radians = angles[index] * Math.PI / 180;
    return {
      ...node,
      x: geometry.x + Math.cos(radians) * geometry.radiusX,
      y: geometry.y + Math.sin(radians) * geometry.radiusY,
      radius: NODE_RADIUS,
    };
  });
}

function anchoredSegment(from, to, fromRadius, toRadius) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) throw new Error("关系连线的两个节点不能重合");
  const ux = dx / distance;
  const uy = dy / distance;
  return {
    x1: from.x + ux * fromRadius,
    y1: from.y + uy * fromRadius,
    x2: to.x - ux * toRadius,
    y2: to.y - uy * toRadius,
  };
}

function lineMarkup(line, name, className) {
  return `<line class="${className}" x1="${line.x1.toFixed(2)}" y1="${line.y1.toFixed(2)}" x2="${line.x2.toFixed(2)}" y2="${line.y2.toFixed(2)}" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="${name}"></line>`;
}

function linksMarkup(model, geometry) {
  const byKey = new Map(geometry.map((node) => [node.key, node]));
  const relationLines = model.links.map((link, index) => lineMarkup(
    anchoredSegment(byKey.get(link.from), byKey.get(link.to), NODE_RADIUS - 4, NODE_RADIUS - 4),
    `network-relation-${index}`,
    `network-relation network-relation-${link.kind}`,
  ));
  const spokeLines = geometry.map((node, index) => lineMarkup(
    anchoredSegment(node, CORE, NODE_RADIUS - 4, CORE.radius - 4),
    `network-core-link-${index}`,
    `network-core-link network-core-link-${node.group}`,
  ));
  return `<svg class="network-links" viewBox="0 0 ${DESIGN_FRAME.width} ${DESIGN_FRAME.height}" aria-hidden="true">${relationLines.join("")}${spokeLines.join("")}</svg>`;
}

function groupLabelMarkup(group, textLayoutBindings) {
  const isInternal = group.name === "internal";
  const slotId = `${group.name}-group-label`;
  return textRegionMarkup({
    id: slotId,
    field: `${group.name}.title`,
    itemId: group.name,
    regionId: "group-label",
    layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
    compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
    content: { title: group.title },
    className: `network-group-label network-group-label-${group.name}`,
    align: isInternal ? "left" : "right",
    valign: "middle",
    density: "compact",
    required: true,
    names: { heading: `${group.name}-group-title` },
  });
}

function nodeMarkup(node, textLayoutBindings) {
  const left = node.x - NODE_RADIUS;
  const top = node.y - NODE_RADIUS;
  const slotId = `${node.key}-content-region`;
  const globalIndex = node.group === "internal" ? node.index : `external-${node.index}`;
  return `<article class="network-node network-node-${node.group}" style="left:${left}px;top:${top}px" data-node-key="${escapeHtml(node.key)}">
    <div class="network-node-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-node-halo-${globalIndex}"></div>
    <div class="network-node-surface" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="network-node-surface-${globalIndex}"></div>
    ${textRegionMarkup({
      id: slotId,
      field: `${node.group}.nodes[${node.index}]`,
      itemId: node.key,
      regionId: "content",
      layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
      content: { title: node.title, body: node.body },
      className: "network-node-content",
      align: "center",
      valign: "middle",
      density: "compact",
      required: true,
      names: { heading: `network-node-title-${globalIndex}`, body: `network-node-body-${globalIndex}` },
    })}
  </article>`;
}

function coreMarkup(core, textLayoutBindings) {
  const slotId = "core-content-region";
  return `<div class="network-core-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-core-halo"></div>
    <div class="network-core-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-core-ring"></div>
    <div class="network-core-surface" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="network-core-surface"></div>
    ${textRegionMarkup({
      id: slotId,
      field: "core",
      itemId: "core",
      regionId: "core",
      layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
      content: core,
      className: "network-core-content",
      align: "center",
      valign: "middle",
      density: "compact",
      required: true,
      names: { heading: "network-core-title", body: "network-core-body" },
    })}`;
}

export const visualComponent = Object.freeze({
  id: "network-internal-external-ecosystem",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const geometry = [...nodeGeometry(model.internal), ...nodeGeometry(model.external)];
    return `<section class="network-review" data-ppt-root data-internal-count="${model.internal.nodes.length}" data-external-count="${model.external.nodes.length}">
      <div class="network-zone network-zone-internal" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-zone-internal"></div>
      <div class="network-zone network-zone-external" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-zone-external"></div>
      <div class="network-zone-ring network-zone-ring-internal" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-zone-ring-internal"></div>
      <div class="network-zone-ring network-zone-ring-external" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="network-zone-ring-external"></div>
      <div class="network-bridge" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="network-shared-bridge"></div>
      ${linksMarkup(model, geometry)}
      ${groupLabelMarkup(model.internal, model.textLayoutBindings)}
      ${groupLabelMarkup(model.external, model.textLayoutBindings)}
      ${geometry.map((node) => nodeMarkup(node, model.textLayoutBindings)).join("")}
      ${coreMarkup(model.core, model.textLayoutBindings)}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  core: Object.freeze({ title: "共建共享", body: "资源 · 能力 · 价值" }),
  internal: Object.freeze({
    title: "内部协同",
    nodes: Object.freeze([
      Object.freeze({ key: "governance", title: "组织治理" }),
      Object.freeze({ key: "data", title: "数据能力" }),
      Object.freeze({ key: "team", title: "专业团队" }),
      Object.freeze({ key: "operation", title: "运营机制" }),
    ]),
  }),
  external: Object.freeze({
    title: "外部生态",
    nodes: Object.freeze([
      Object.freeze({ key: "university", title: "高校伙伴" }),
      Object.freeze({ key: "industry", title: "行业企业" }),
      Object.freeze({ key: "service", title: "服务机构" }),
      Object.freeze({ key: "community", title: "社区公众" }),
    ]),
  }),
  links: Object.freeze([]),
});

function cycleLinks(nodes) {
  if (nodes.length === 2) return [{ from: nodes[0].key, to: nodes[1].key }];
  return nodes.map((node, index) => ({ from: node.key, to: nodes[(index + 1) % nodes.length].key }));
}

function crossLinks(internalNodes, externalNodes) {
  const count = Math.min(internalNodes.length, externalNodes.length);
  return Array.from({ length: count }, (_, index) => ({
    from: internalNodes[index].key,
    to: externalNodes[(index * 2) % externalNodes.length].key,
  }));
}

export function resolvePreviewParameters(base, selection) {
  const internalCount = Number(selection?.internalCount ?? 3);
  const externalCount = Number(selection?.externalCount ?? 3);
  if (!Number.isInteger(internalCount) || internalCount < 2 || internalCount > 4) throw new Error("内部主体数支持 2–4");
  if (!Number.isInteger(externalCount) || externalCount < 2 || externalCount > 4) throw new Error("外部伙伴数支持 2–4");
  const resolved = structuredClone(base);
  resolved.internal.nodes = resolved.internal.nodes.slice(0, internalCount);
  resolved.external.nodes = resolved.external.nodes.slice(0, externalCount);
  resolved.links = [
    ...cycleLinks(resolved.internal.nodes),
    ...cycleLinks(resolved.external.nodes),
    ...crossLinks(resolved.internal.nodes, resolved.external.nodes),
  ];
  return resolved;
}
