import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);

const clone = (value) => structuredClone(value);
const text = (value, max, field) => {
  const result = String(value ?? "").trim();
  if (!result || [...result].length > max) throw new Error(`${field} 超出容量`);
  return result;
};
const list = (value, min, max, field) => {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`${field} 需要 ${min}–${max} 项`);
  }
  return value;
};
const slot = (field, value, tag = "span", role = "label") =>
  `<${tag} data-slot-id="${esc(field)}" data-slot-role="${esc(role)}" data-slot-field="${esc(field)}" data-slot-content-type="text">${esc(value)}</${tag}>`;
const point = (index, count, rx, ry, offset = -90) => {
  const angle = (offset + index * 360 / count) * Math.PI / 180;
  return { x: 585 + Math.cos(angle) * rx, y: 246 + Math.sin(angle) * ry, angle };
};
const TONES = Object.freeze(["#28577d", "#35688f", "#477b9f", "#5c8dab", "#78a3bd", "#9ab9cb"]);
const HALOS = Object.freeze(["#d7e5ee", "#dfeaf0", "#e5eef3", "#eaf1f5", "#eef4f7", "#f2f6f8"]);

const STYLE = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;background:transparent;color:#284b67}
.hub-v2,.hub-v3{position:relative;width:1170px;height:492px;overflow:hidden;background:transparent}
.hub-v2 svg,.hub-v3 svg{position:absolute;inset:0;width:1170px;height:492px;overflow:visible}
.hub-v2 h2,.hub-v2 h3,.hub-v2 p,.hub-v3 h2,.hub-v3 h3,.hub-v3 p{margin:0}
.hub-v3 .ppagent-text-region{overflow:hidden}.hub-v3 .ppagent-text-layout{width:100%;height:100%}

.hub-directional .radial-guide{fill:none;stroke:#dce8ef;stroke-width:2;stroke-dasharray:3 11}
.hub-directional .radial-spoke{stroke-linecap:round;stroke-linejoin:round}
.hub-directional .radial-joint{stroke:#fff;stroke-width:5;filter:drop-shadow(0 4px 7px rgba(34,72,100,.12))}
.hub-directional .core-halo,.hub-directional .core-ring,.hub-directional .core-disc{position:absolute;left:585px;top:246px;transform:translate(-50%,-50%);border-radius:50%}
.hub-directional .core-halo{z-index:2;width:222px;height:180px;background:#e5eff4;border:1px solid #d0e0e9}
.hub-directional .core-ring{z-index:3;width:202px;height:160px;background:#fff;border:2px solid #9bb6c7}
.hub-directional .core-disc{z-index:4;width:184px;height:142px;background:linear-gradient(145deg,#2d638a,#234b6d);box-shadow:0 12px 24px rgba(31,70,100,.2)}
.hub-directional .core-region{position:absolute;z-index:5;left:503px;top:195px;width:164px;height:102px;--ppagent-heading-color:#fff;--ppagent-text-color:#dce9f0;--ppagent-text-layout-gap:5px}
.hub-directional .core-region .ppagent-text-primitive--heading{font-size:var(--ppagent-component-lead-size,19pt);line-height:1.16}
.hub-directional .core-region .ppagent-text-primitive--body{font-size:var(--ppagent-component-meta-size,15pt);line-height:1.25}
.hub-directional .radial-node{position:absolute;z-index:6;width:232px;height:82px;padding:7px 9px 7px 15px;background:linear-gradient(90deg,var(--wash),rgba(255,255,255,0) 86%);border-left:4px solid var(--tone)}
.hub-directional .radial-node[data-side="left"]{padding:7px 15px 7px 9px;background:linear-gradient(270deg,var(--wash),rgba(255,255,255,0) 86%);border-left:0;border-right:4px solid var(--tone)}
.hub-directional .radial-node[data-side="top"],.hub-directional .radial-node[data-side="bottom"]{width:242px;padding:7px 14px;background:linear-gradient(90deg,rgba(255,255,255,0),var(--wash) 25%,var(--wash) 75%,rgba(255,255,255,0));border-left:0;border-top:3px solid var(--tone)}
.hub-directional .node-region{position:absolute;inset:0;--ppagent-heading-color:var(--tone);--ppagent-text-color:#5a6f7e;--ppagent-text-layout-gap:3px}
.hub-directional .node-region .ppagent-text-primitive--heading{font-size:var(--ppagent-component-label-size,17pt);line-height:1.14}
.hub-directional .node-region .ppagent-text-primitive--body{font-size:var(--ppagent-component-meta-size,15pt);line-height:1.22}

.hub-two-tier .outer-orbit-halo{fill:none;stroke:#dfebf1;stroke-width:15;opacity:.7}
.hub-two-tier .outer-orbit-line{fill:none;stroke:#91afc1;stroke-width:2;stroke-dasharray:4 10;opacity:.8}
.hub-two-tier .inner-orbit-line{fill:none;stroke:#d2e1e9;stroke-width:2}
.hub-two-tier .capability-link{stroke:#d6e5ed;stroke-width:12;stroke-linecap:round}
.hub-two-tier .capability-pod{stroke:#fff;stroke-width:4;filter:drop-shadow(0 7px 8px rgba(35,74,101,.12))}
.hub-two-tier .core-halo,.hub-two-tier .core-ring,.hub-two-tier .core-disc{position:absolute;left:585px;top:246px;transform:translate(-50%,-50%);border-radius:50%}
.hub-two-tier .core-halo{z-index:2;width:194px;height:194px;background:#e6f0f5;border:1px solid #d0e1ea}
.hub-two-tier .core-ring{z-index:3;width:174px;height:174px;background:#fff;border:2px solid #9eb9ca}
.hub-two-tier .core-disc{z-index:4;width:156px;height:156px;background:linear-gradient(145deg,#2d638a,#244d70);box-shadow:0 12px 24px rgba(31,70,100,.18)}
.hub-two-tier .core-region{position:absolute;z-index:5;left:516px;top:198px;width:138px;height:96px;--ppagent-heading-color:#fff;--ppagent-text-layout-gap:0}
.hub-two-tier .core-region .ppagent-text-primitive--heading{font-size:var(--ppagent-component-lead-size,19pt);line-height:1.18}
.hub-two-tier .inner-region{position:absolute;z-index:6;width:142px;height:60px;transform:translate(-50%,-50%);--ppagent-heading-color:#fff;--ppagent-text-layout-gap:0}
.hub-two-tier .inner-region .ppagent-text-primitive--heading{font-size:var(--ppagent-component-meta-size,15pt);line-height:1.15}
.hub-two-tier .outer-node{position:absolute;z-index:6;width:176px;height:50px;transform:translateX(-50%);color:#425f73}
.hub-two-tier .outer-node:before{content:"";position:absolute;left:81px;width:14px;height:14px;border-radius:50%;background:var(--tone);box-shadow:0 0 0 6px var(--halo)}
.hub-two-tier .outer-node[data-row="top"]:before{bottom:-7px}.hub-two-tier .outer-node[data-row="bottom"]:before{top:-7px}
.hub-two-tier .outer-node:after{content:"";position:absolute;left:18px;right:18px;height:1px;background:linear-gradient(90deg,transparent,var(--tone),transparent)}
.hub-two-tier .outer-node[data-row="top"]:after{bottom:0}.hub-two-tier .outer-node[data-row="bottom"]:after{top:0}
.hub-two-tier .outer-region{position:absolute;inset:0;--ppagent-heading-color:#466477;--ppagent-text-layout-gap:0}
.hub-two-tier .outer-region .ppagent-text-primitive--heading{font-size:var(--ppagent-component-meta-size,15pt);font-weight:600;line-height:1.12}
.hub-two-tier .tier-caption{position:absolute;z-index:7;left:26px;width:100px;color:#7891a2;font-size:var(--ppagent-component-meta-size,15pt);font-weight:600;letter-spacing:.04em;text-align:right}
.hub-two-tier .tier-caption:after{content:"";position:absolute;left:110px;top:9px;width:34px;height:1px;background:#afc4d1}
.hub-two-tier .tier-caption.outer{top:28px}.hub-two-tier .tier-caption.inner{top:224px}

.hub-v2 .core{position:absolute;z-index:4;left:466px;top:171px;width:238px;height:150px;padding:26px 24px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;background:linear-gradient(145deg,#2c638c,#244f73);border:9px solid #e3edf3;box-shadow:0 12px 26px rgba(36,78,111,.17)}
.hub-v2 .core h2{font-size:var(--ppagent-component-lead-size,19pt);line-height:1.2}
.hub-orbit .band{fill:none}.hub-orbit .axis-note{position:absolute;z-index:2;left:22px;width:74px;text-align:right;color:#8195a4;font-size:10pt}.hub-orbit .axis-note:after{content:"";position:absolute;left:82px;top:8px;width:28px;height:1px;background:#bacbd5}
.hub-orbit .axis-note.near{top:180px}.hub-orbit .axis-note.middle{top:119px}.hub-orbit .axis-note.far{top:55px}
.hub-orbit .orbit-node{position:absolute;z-index:4;transform:translate(-50%,-50%);width:152px;height:42px;padding:0 11px 0 28px;border-radius:21px;display:flex;align-items:center;background:rgba(255,255,255,.97);border:1px solid #d8e4eb;color:#3f6077;font-size:10.8pt;font-weight:600;line-height:1.15;box-shadow:0 5px 12px rgba(37,72,99,.07)}
.hub-orbit .orbit-node:before{content:"";position:absolute;left:8px;top:10px;width:20px;height:20px;border-radius:50%;background:var(--tone);box-shadow:0 0 0 5px var(--halo)}
`;

function component(id, render, preview, resolve) {
  return Object.freeze({
    visualComponent: Object.freeze({
      id,
      schemaVersion: 7,
      designFrame: FRAME,
      cssFile: "component.css",
      renderMarkup(parameters) { return `<style>${STYLE}</style>${render(parameters)}`; },
    }),
    previewParameters: Object.freeze(preview),
    resolvePreviewParameters: resolve,
  });
}

function normalizeCenter(center) {
  return {
    title: text(center?.title, 10, "center.title"),
    body: center?.body ? text(center.body, 28, "center.body") : "",
  };
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
  return { angle, ux, uy, side, anchor, inner, node };
}

function spokeMarkup(geometry, index, mode) {
  const tone = TONES[index];
  const paint = `url(#radial-arm-${index})`;
  const { ux, uy, inner, anchor } = geometry;
  const nx = -uy;
  const ny = ux;
  const curve = Math.abs(ux) < .34 ? 4 : 14;
  if (mode === "none") {
    const cx = (inner.x + anchor.x) / 2 + nx * curve;
    const cy = (inner.y + anchor.y) / 2 + ny * curve;
    return `<path class="radial-spoke" d="M${inner.x.toFixed(1)} ${inner.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}" fill="none" stroke="${paint}" stroke-width="16" opacity=".96"/><circle class="radial-joint" cx="${anchor.x.toFixed(1)}" cy="${anchor.y.toFixed(1)}" r="13" fill="${tone}"/>`;
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
  const base = {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
  const tangent = {
    x: 2 * mt * (control.x - start.x) + 2 * t * (end.x - control.x),
    y: 2 * mt * (control.y - start.y) + 2 * t * (end.y - control.y),
  };
  const tangentLength = Math.hypot(tangent.x, tangent.y);
  const endNormal = { x: -tangent.y / tangentLength, y: tangent.x / tangentLength };
  const startTangent = { x: control.x - start.x, y: control.y - start.y };
  const startLength = Math.hypot(startTangent.x, startTangent.y);
  const startNormal = { x: -startTangent.y / startLength, y: startTangent.x / startLength };
  const width = 8;
  const arrowHalf = 18;
  return `<path class="radial-spoke" d="M${(start.x + startNormal.x * width).toFixed(1)} ${(start.y + startNormal.y * width).toFixed(1)} Q${(control.x + normal.x * width).toFixed(1)} ${(control.y + normal.y * width).toFixed(1)} ${(base.x + endNormal.x * width).toFixed(1)} ${(base.y + endNormal.y * width).toFixed(1)} L${(base.x + endNormal.x * arrowHalf).toFixed(1)} ${(base.y + endNormal.y * arrowHalf).toFixed(1)} L${end.x.toFixed(1)} ${end.y.toFixed(1)} L${(base.x - endNormal.x * arrowHalf).toFixed(1)} ${(base.y - endNormal.y * arrowHalf).toFixed(1)} L${(base.x - endNormal.x * width).toFixed(1)} ${(base.y - endNormal.y * width).toFixed(1)} Q${(control.x - normal.x * width).toFixed(1)} ${(control.y - normal.y * width).toFixed(1)} ${(start.x - startNormal.x * width).toFixed(1)} ${(start.y - startNormal.y * width).toFixed(1)} Z" fill="${paint}"/>`;
}

function renderDirectional(parameters) {
  const center = normalizeCenter(parameters.center);
  const nodes = list(parameters.nodes, 3, 6, "nodes").map((node, index) => ({
    title: text(node?.title, 9, `nodes[${index}].title`),
    body: node?.body ? text(node.body, 28, `nodes[${index}].body`) : "",
  }));
  const connectionMode = ["none", "inward", "outward"].includes(parameters.connectionMode) ? parameters.connectionMode : "outward";
  const geometries = nodes.map((_, index) => spokeGeometry(index, nodes.length));
  const gradients = geometries.map((geometry, index) => `<linearGradient id="radial-arm-${index}" gradientUnits="userSpaceOnUse" x1="${geometry.inner.x.toFixed(1)}" y1="${geometry.inner.y.toFixed(1)}" x2="${geometry.anchor.x.toFixed(1)}" y2="${geometry.anchor.y.toFixed(1)}"><stop stop-color="#244f72"/><stop offset="1" stop-color="${TONES[index]}"/></linearGradient>`).join("");
  const paths = geometries.map((geometry, index) => spokeMarkup(geometry, index, connectionMode)).join("");
  return `<section class="hub-v3 hub-directional" data-ppt-root data-connection-mode="${connectionMode}" data-node-count="${nodes.length}">
    <svg viewBox="0 0 1170 492" aria-hidden="true"><defs>${gradients}</defs><ellipse class="radial-guide" cx="585" cy="246" rx="342" ry="158"/>${paths}</svg>
    <div class="core-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-core-halo"></div>
    <div class="core-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="radial-core-ring"></div>
    <div class="core-disc" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="radial-core-disc"></div>
    ${textRegionMarkup({ id: "radial-center", field: "center", itemId: "center", regionId: "core", layoutId: "heading-content-flow", compatibleLayoutIds: ["heading-content-flow", "statement-flow"], content: center, className: "core-region", align: "center", valign: "middle", density: "compact", names: { heading: "radial-center-title", body: "radial-center-body" } })}
    ${nodes.map((node, index) => {
      const geometry = geometries[index];
      const align = geometry.side === "left" ? "right" : geometry.side === "right" ? "left" : "center";
      return `<article class="radial-node" data-side="${geometry.side}" style="left:${geometry.node.left.toFixed(1)}px;top:${geometry.node.top.toFixed(1)}px;--tone:${TONES[index]};--wash:${HALOS[index]}">${textRegionMarkup({ id: `radial-node-${index}`, field: `nodes[${index}]`, itemId: `node-${index}`, regionId: "content", layoutId: "heading-content-flow", compatibleLayoutIds: ["heading-content-flow", "statement-flow"], content: node, className: "node-region", align, valign: "middle", density: "compact", names: { heading: `radial-node-${index}-title`, body: `radial-node-${index}-body` } })}</article>`;
    }).join("")}
  </section>`;
}

function renderTwoTier(parameters) {
  const center = text(parameters.center, 18, "center");
  const inner = list(parameters.inner, 3, 4, "inner").map((value, index) => text(value, 9, `inner[${index}]`));
  const outer = list(parameters.outer, 4, 8, "outer").map((value, index) => text(value, 10, `outer[${index}]`));
  const offset = inner.length === 4 ? -45 : -90;
  const capabilities = inner.map((_, index) => {
    const angle = offset + index * 360 / inner.length;
    const radians = angle * Math.PI / 180;
    return { angle, x: 585 + Math.cos(radians) * 225, y: 246 + Math.sin(radians) * 126 };
  });
  const topCount = Math.ceil(outer.length / 2);
  const bottomCount = outer.length - topCount;
  const spread = (count) => count === 1 ? [585] : Array.from({ length: count }, (_, index) => 230 + index * (710 / (count - 1)));
  const topXs = spread(topCount);
  const bottomXs = spread(bottomCount);
  const outerPositions = outer.map((_, index) => index < topCount
    ? { x: topXs[index], top: 2, row: "top" }
    : { x: bottomXs[index - topCount], top: 440, row: "bottom" });
  const defs = capabilities.map((_, index) => `<linearGradient id="capability-pod-${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${TONES[index]}"/><stop offset="1" stop-color="${TONES[Math.min(index + 2, TONES.length - 1)]}"/></linearGradient>`).join("");
  const links = capabilities.map((capability) => `<path class="capability-link" d="M585 246 L${capability.x.toFixed(1)} ${capability.y.toFixed(1)}"/>`).join("");
  const pods = capabilities.map((capability, index) => `<g transform="translate(${capability.x.toFixed(1)} ${capability.y.toFixed(1)}) rotate(${(capability.angle + 90).toFixed(1)})"><path class="capability-pod" d="M-82 0 C-58-35 58-35 82 0 C58 35-58 35-82 0Z" fill="url(#capability-pod-${index})"/></g>`).join("");
  const outerTrack = "M230 55 H940 C1040 55 1040 437 940 437 H230 C130 437 130 55 230 55 Z";
  return `<section class="hub-v3 hub-two-tier" data-ppt-root data-inner-count="${inner.length}" data-outer-count="${outer.length}">
    <svg viewBox="0 0 1170 492" aria-hidden="true"><defs>${defs}</defs><path class="outer-orbit-halo" d="${outerTrack}"/><path class="outer-orbit-line" d="${outerTrack}"/><ellipse class="inner-orbit-line" cx="585" cy="246" rx="264" ry="150"/>${links}${pods}</svg>
    <div class="tier-caption outer">共同结果层</div><div class="tier-caption inner">直接能力层</div>
    <div class="core-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-halo"></div>
    <div class="core-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="ecology-core-ring"></div>
    <div class="core-disc" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="ecology-core-disc"></div>
    ${textRegionMarkup({ id: "ecology-center", field: "center", itemId: "center", regionId: "core", layoutId: "statement-flow", compatibleLayoutIds: ["statement-flow"], content: { title: center }, className: "core-region", align: "center", valign: "middle", density: "compact", names: { heading: "ecology-center-title" } })}
    ${inner.map((value, index) => textRegionMarkup({ id: `ecology-inner-${index}`, field: `inner[${index}]`, itemId: `inner-${index}`, regionId: "capability", layoutId: "statement-flow", compatibleLayoutIds: ["statement-flow"], content: { title: value }, className: "inner-region", align: "center", valign: "middle", density: "compact", names: { heading: `ecology-inner-${index}-title` } }).replace('class="ppagent-text-region inner-region"', `class="ppagent-text-region inner-region" style="left:${capabilities[index].x.toFixed(1)}px;top:${capabilities[index].y.toFixed(1)}px"`)).join("")}
    ${outer.map((value, index) => `<div class="outer-node" data-row="${outerPositions[index].row}" style="left:${outerPositions[index].x.toFixed(1)}px;top:${outerPositions[index].top}px;--tone:${TONES[Math.min(index, TONES.length - 1)]};--halo:${HALOS[Math.min(index, HALOS.length - 1)]}">${textRegionMarkup({ id: `ecology-outer-${index}`, field: `outer[${index}]`, itemId: `outer-${index}`, regionId: "outcome", layoutId: "statement-flow", compatibleLayoutIds: ["statement-flow"], content: { title: value }, className: "outer-region", align: "center", valign: "middle", density: "compact", names: { heading: `ecology-outer-${index}-title` } })}</div>`).join("")}
  </section>`;
}

const TIER_INDEX = Object.freeze({ near: 0, middle: 1, far: 2 });
function renderOrbit(parameters) {
  const center = text(parameters.center, 18, "center");
  const nodes = list(parameters.nodes, 6, 10, "nodes").map((node, index) => {
    const tier = TIER_INDEX[node?.tier] === undefined ? Number(node?.ring) : TIER_INDEX[node.tier];
    if (![0, 1, 2].includes(tier)) throw new Error(`nodes[${index}].tier 需要 near、middle 或 far`);
    return { title: text(node?.title, 10, `nodes[${index}].title`), tier };
  });
  const radii = [{ x: 205, y: 92 }, { x: 330, y: 148 }, { x: 465, y: 207 }];
  const rings = radii.map((radius, index) => `<ellipse class="band" cx="585" cy="246" rx="${radius.x}" ry="${radius.y}" stroke="${TONES[4 - index]}" stroke-width="${index === 0 ? 22 : 16}" opacity="${index === 0 ? .18 : .12}"/>`).join("");
  const renderedNodes = nodes.map((node, index) => {
    const siblings = nodes.filter((candidate) => candidate.tier === node.tier); const siblingIndex = siblings.indexOf(node);
    const position = point(siblingIndex, siblings.length, radii[node.tier].x, radii[node.tier].y);
    const tone = TONES[2 + node.tier]; const halo = node.tier === 0 ? "#d9e7ef" : node.tier === 1 ? "#e6eef3" : "#f0f4f6";
    return `<div class="orbit-node" style="left:${position.x}px;top:${position.y}px;--tone:${tone};--halo:${halo}">${slot(`nodes[${index}].title`, node.title, "span", "orbit-node")}</div>`;
  }).join("");
  return `<section class="hub-v2 hub-orbit" data-ppt-root data-node-count="${nodes.length}"><svg viewBox="0 0 1170 492">${rings}</svg><div class="axis-note far">远 · 关注</div><div class="axis-note middle">中 · 协同</div><div class="axis-note near">近 · 核心</div><article class="core">${slot("center", center, "h2", "center-title")}</article>${renderedNodes}</section>`;
}

const definitions = Object.freeze({
  "hub-directed-outcomes-002": component("hub-directed-outcomes-002", renderDirectional, {
    connectionMode: "none",
    center: { title: "响应式引擎", body: "统一求解结构、容量与内容边界" },
    nodes: [
      { title: "输出可靠", body: "减少随机排版与结构误用" },
      { title: "原生可编", body: "形状和文字均可继续编辑" },
      { title: "生成高效", body: "运行期只做选择与参数填写" },
      { title: "数量适配", body: "按真实内容重新求解布局" },
      { title: "风格一致", body: "共享同一 Shell 与视觉语言" },
      { title: "过程可审", body: "来源、组件和结果统一查看" },
    ],
  }, (base, selection) => {
    const result = clone(base); const count = Number(selection?.nodeCount ?? 6);
    if (count < 3 || count > 6) throw new Error("节点数需要 3–6 项");
    result.nodes = result.nodes.slice(0, count);
    result.connectionMode = selection?.connectionMode === "无箭头" ? "none" : selection?.connectionMode === "向内" ? "inward" : "outward";
    if (result.connectionMode === "inward") {
      result.center = { title: "统一页面决策", body: "综合多类真实输入后形成可执行方案" };
      result.nodes = [
        { title: "稿件内容", body: "事实、论点与段落关系" },
        { title: "页面目的", body: "解释、比较或推动决策" },
        { title: "逻辑关系", body: "顺序、因果、层级与汇聚" },
        { title: "容量边界", body: "项目数、字数和媒体条件" },
        { title: "上下文", body: "前后页关系与全局节奏" },
        { title: "视觉规范", body: "Shell、字体和内容区域" },
      ].slice(0, count);
    }
    return result;
  }),
  "hub-two-tier-capabilities-004": component("hub-two-tier-capabilities-004", renderTwoTier, {
    center: "可靠 PPTX 生成",
    inner: ["内容理解", "结构选择", "响应布局", "原生编译"],
    outer: ["稿件适配", "叙事连贯", "逻辑清晰", "数量扩散", "风格一致", "对象可编辑", "失败可诊断", "资产可演进"],
  }, (base, selection) => {
    const result = clone(base); result.inner = result.inner.slice(0, Number(selection?.innerCount ?? 4)); result.outer = result.outer.slice(0, Number(selection?.outerCount ?? 6)); return result;
  }),
  "hub-orbit-priority-006": component("hub-orbit-priority-006", renderOrbit, {
    center: "项目利益相关者",
    nodes: [
      { title: "核心用户", tier: "near" }, { title: "产品负责人", tier: "near" },
      { title: "内容团队", tier: "middle" }, { title: "设计团队", tier: "middle" }, { title: "开发团队", tier: "middle" },
      { title: "合作机构", tier: "far" }, { title: "比赛评委", tier: "far" }, { title: "潜在客户", tier: "far" }, { title: "生态伙伴", tier: "far" }, { title: "高校联盟", tier: "far" },
    ],
  }, (base, selection) => { const result = clone(base); result.nodes = result.nodes.slice(0, Number(selection?.nodeCount ?? 8)); return result; }),
});

export function getHubCandidate(id) {
  const candidate = definitions[id];
  if (!candidate) throw new Error(`未知中心与辐射候选 ${id}`);
  return candidate;
}
