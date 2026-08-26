import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TONES = Object.freeze(["#28577d", "#35688f", "#477b9f", "#5c8dab", "#78a3bd", "#9ab9cb"]);
const HALOS = Object.freeze(["#d7e5ee", "#dfeaf0", "#e5eef3", "#eaf1f5", "#eef4f7", "#f2f6f8"]);

function text(value, max, field) {
  const result = String(value ?? "").trim();
  if (!result || [...result].length > max) throw new Error(`${field} 超出容量`);
  return result;
}

function normalize(parameters) {
  const center = {
    title: text(parameters?.center?.title, 10, "center.title"),
    body: parameters?.center?.body ? text(parameters.center.body, 28, "center.body") : "",
  };
  if (!Array.isArray(parameters?.nodes) || parameters.nodes.length < 3 || parameters.nodes.length > 6) throw new Error("nodes 需要 3–6 项");
  const nodes = parameters.nodes.map((node, index) => ({
    title: text(node?.title, 9, `nodes[${index}].title`),
    body: node?.body ? text(node.body, 28, `nodes[${index}].body`) : "",
  }));
  const connectionMode = ["none", "inward", "outward"].includes(parameters?.connectionMode) ? parameters.connectionMode : "none";
  return { center, nodes, connectionMode };
}

function ellipseBoundaryDistance(ux, uy, rx, ry) {
  return 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry));
}

function spokeGeometry(index, count) {
  const angle = (-90 + index * 360 / count) * Math.PI / 180;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nodeCenter = { x: 585 + ux * 440, y: 246 + uy * 198 };
  const side = ux > .34 ? "right" : ux < -.34 ? "left" : uy < 0 ? "top" : "bottom";
  const inset = side === "left" || side === "right" ? 132 : 62;
  const distance = Math.hypot(nodeCenter.x - 585, nodeCenter.y - 246);
  const anchorDistance = distance - inset;
  const anchor = { x: 585 + ux * anchorDistance, y: 246 + uy * anchorDistance };
  const innerDistance = ellipseBoundaryDistance(ux, uy, 106, 79) + 5;
  const inner = { x: 585 + ux * innerDistance, y: 246 + uy * innerDistance };
  const node = side === "right"
    ? { left: anchor.x + 22, top: anchor.y - 41 }
    : side === "left"
      ? { left: anchor.x - 254, top: anchor.y - 41 }
      : side === "top"
        ? { left: anchor.x - 121, top: anchor.y - 90 }
        : { left: anchor.x - 121, top: anchor.y + 16 };
  return { ux, uy, side, anchor, inner, node };
}

function spokeMarkup(geometry, index, mode) {
  const paint = TONES[index];
  const { ux, uy, inner, anchor } = geometry;
  const nx = -uy;
  const ny = ux;
  const curve = Math.abs(ux) < .34 ? 4 : 14;
  if (mode === "none") {
    const cx = (inner.x + anchor.x) / 2 + nx * curve;
    const cy = (inner.y + anchor.y) / 2 + ny * curve;
    return `<path class="radial-spoke" d="M${inner.x.toFixed(1)} ${inner.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}" fill="none" stroke="${paint}" stroke-width="16" opacity=".96" data-ppt-kind="path" data-ppt-name="radial-spoke-${index + 1}"></path><circle cx="${anchor.x.toFixed(1)}" cy="${anchor.y.toFixed(1)}" r="19" fill="${HALOS[index]}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-joint-halo-${index + 1}"></circle><circle class="radial-joint" cx="${anchor.x.toFixed(1)}" cy="${anchor.y.toFixed(1)}" r="13" fill="${TONES[index]}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-joint-${index + 1}"></circle>`;
  }
  const start = mode === "outward" ? inner : anchor;
  const end = mode === "outward" ? anchor : inner;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const direction = { x: dx / length, y: dy / length };
  const normal = { x: -direction.y, y: direction.x };
  const control = { x: (start.x + end.x) / 2 + normal.x * curve, y: (start.y + end.y) / 2 + normal.y * curve };
  const t = .84;
  const mt = 1 - t;
  const base = { x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x, y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y };
  const tangent = { x: 2 * mt * (control.x - start.x) + 2 * t * (end.x - control.x), y: 2 * mt * (control.y - start.y) + 2 * t * (end.y - control.y) };
  const tangentLength = Math.hypot(tangent.x, tangent.y);
  const endNormal = { x: -tangent.y / tangentLength, y: tangent.x / tangentLength };
  const startTangent = { x: control.x - start.x, y: control.y - start.y };
  const startLength = Math.hypot(startTangent.x, startTangent.y);
  const startNormal = { x: -startTangent.y / startLength, y: startTangent.x / startLength };
  const width = 8;
  const arrowHalf = 18;
  const path = `M${(start.x + startNormal.x * width).toFixed(1)} ${(start.y + startNormal.y * width).toFixed(1)} Q${(control.x + normal.x * width).toFixed(1)} ${(control.y + normal.y * width).toFixed(1)} ${(base.x + endNormal.x * width).toFixed(1)} ${(base.y + endNormal.y * width).toFixed(1)} L${(base.x + endNormal.x * arrowHalf).toFixed(1)} ${(base.y + endNormal.y * arrowHalf).toFixed(1)} L${end.x.toFixed(1)} ${end.y.toFixed(1)} L${(base.x - endNormal.x * arrowHalf).toFixed(1)} ${(base.y - endNormal.y * arrowHalf).toFixed(1)} L${(base.x - endNormal.x * width).toFixed(1)} ${(base.y - endNormal.y * width).toFixed(1)} Q${(control.x - normal.x * width).toFixed(1)} ${(control.y - normal.y * width).toFixed(1)} ${(start.x - startNormal.x * width).toFixed(1)} ${(start.y - startNormal.y * width).toFixed(1)} Z`;
  return `<path class="radial-spoke" d="${path}" fill="${paint}" data-ppt-kind="path" data-ppt-name="radial-${mode}-spoke-${index + 1}"></path>`;
}

function region({ id, field, itemId, content, className, align, names }) {
  return textRegionMarkup({ id, field, itemId, regionId: "content", layoutId: "heading-content-flow", compatibleLayoutIds: ["heading-content-flow", "statement-flow"], content, className, align, valign: "middle", density: "compact", required: true, names });
}

export const visualComponent = Object.freeze({
  id: "hub-directed-outcomes-002",
  schemaVersion: 7,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const geometries = model.nodes.map((_, index) => spokeGeometry(index, model.nodes.length));
    return `<section class="radial-review" data-ppt-root data-connection-mode="${model.connectionMode}" data-node-count="${model.nodes.length}">
      <svg viewBox="0 0 1170 492" aria-hidden="true"><ellipse class="radial-guide" cx="585" cy="246" rx="342" ry="158" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-guide"></ellipse>${geometries.map((geometry, index) => spokeMarkup(geometry, index, model.connectionMode)).join("")}</svg>
      <div class="core-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-core-halo"></div><div class="core-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-core-ring"></div><div class="core-disc" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-core-disc"></div>
      ${region({ id: "radial-center", field: "center", itemId: "center", content: model.center, className: "core-region", align: "center", names: { heading: "radial-center-title", body: "radial-center-body" } })}
      ${model.nodes.map((node, index) => { const geometry = geometries[index]; const align = geometry.side === "left" ? "right" : geometry.side === "right" ? "left" : "center"; return `<article class="radial-node" data-side="${geometry.side}" style="left:${geometry.node.left.toFixed(1)}px;top:${geometry.node.top.toFixed(1)}px;--tone:${TONES[index]};--wash:${HALOS[index]}"><div class="node-surface" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="radial-node-surface-${index + 1}"></div><div class="node-accent" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="radial-node-accent-${index + 1}"></div>${region({ id: `radial-node-${index}`, field: `nodes[${index}]`, itemId: `node-${index}`, content: node, className: "node-region", align, names: { heading: `radial-node-${index}-title`, body: `radial-node-${index}-body` } })}</article>`; }).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  connectionMode: "none",
  center: Object.freeze({ title: "响应式引擎", body: "统一求解结构、容量与内容边界" }),
  nodes: Object.freeze([
    Object.freeze({ title: "输出可靠", body: "减少随机排版与结构误用" }), Object.freeze({ title: "原生可编", body: "形状和文字均可继续编辑" }),
    Object.freeze({ title: "生成高效", body: "运行期只做选择与参数填写" }), Object.freeze({ title: "数量适配", body: "按真实内容重新求解布局" }),
    Object.freeze({ title: "风格一致", body: "共享同一 Shell 与视觉语言" }), Object.freeze({ title: "过程可审", body: "来源、组件和结果统一查看" }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const count = Number(selection?.nodeCount ?? 6);
  if (count < 3 || count > 6) throw new Error("节点数需要 3–6 项");
  const result = structuredClone(base);
  result.nodes = result.nodes.slice(0, count);
  result.connectionMode = selection?.connectionMode === "向内" ? "inward" : selection?.connectionMode === "向外" ? "outward" : "none";
  if (result.connectionMode === "inward") {
    result.center = { title: "统一页面决策", body: "综合多类真实输入后形成可执行方案" };
    result.nodes = [
      { title: "稿件内容", body: "事实、论点与段落关系" }, { title: "页面目的", body: "解释、比较或推动决策" },
      { title: "逻辑关系", body: "顺序、因果、层级与汇聚" }, { title: "容量边界", body: "项目数、字数和媒体条件" },
      { title: "上下文", body: "前后页关系与全局节奏" }, { title: "视觉规范", body: "Shell、字体和内容区域" },
    ].slice(0, count);
  }
  return result;
}
