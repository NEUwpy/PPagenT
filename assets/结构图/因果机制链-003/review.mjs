import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });
const SHAFT = Object.freeze({
  front: { near: { x: 150.09, y: 489.34 }, far: { x: 839.27, y: 190.2 } },
  rear: { near: { x: 538.06, y: 487.91 }, far: { x: 934.71, y: 190.2 } },
});
const GROUND_AXIS = Object.freeze({
  near: {
    x: (SHAFT.front.near.x + SHAFT.rear.near.x) / 2,
    y: (SHAFT.front.near.y + SHAFT.rear.near.y) / 2,
  },
  far: {
    x: (SHAFT.front.far.x + SHAFT.rear.far.x) / 2,
    y: (SHAFT.front.far.y + SHAFT.rear.far.y) / 2,
  },
});
const PEDESTAL_CENTER_OFFSET = 0.44;
const NODE_TO_SECTION_RATIO = 0.6;
const NODE_PERSPECTIVE_STRENGTH = 0.5;
const CONNECTOR_DIRECTION = Object.freeze({ x: 0.82, y: 0.5724 });
const CONNECTOR_DIAGONAL_LENGTH = 28;
const NOTE_SIZE = Object.freeze({ width: 280, height: 62 });
const NOTE_GAP = 6;
const NOTE_STEP = Object.freeze({ x: 150, y: -(NOTE_SIZE.height + NOTE_GAP) });

const LAYOUTS = Object.freeze({
  2: {
    depthRange: [0.38, 0.72],
    noteOrigin: { x: 165, y: 194 },
  },
  3: {
    depthRange: [0.28, 0.92],
    noteOrigin: { x: 104, y: 210 },
  },
  4: {
    depthRange: [0.1, 0.9],
    noteOrigin: { x: 12, y: 274 },
  },
});

function clean(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function requireText(value, field, maxLength) {
  const result = clean(value);
  if (!result) throw new Error(`${field} 不能为空`);
  if (result.length > maxLength) throw new Error(`${field} 最多 ${maxLength} 字`);
  return result;
}

function normalizeEndpoint(value, field) {
  return {
    title: requireText(value?.title, `${field}.title`, 10),
    body: requireText(value?.body, `${field}.body`, 24),
  };
}

function normalize(payload) {
  const mediators = Array.isArray(payload?.mediators) ? payload.mediators : [];
  if (mediators.length < 2 || mediators.length > 4) throw new Error("因果机制链支持 2–4 个中介机制");
  return {
    trigger: normalizeEndpoint(payload?.trigger, "trigger"),
    outcome: normalizeEndpoint(payload?.outcome, "outcome"),
    mediators: mediators.map((item, index) => {
      const key = clean(item?.key) || `mediator-${index + 1}`;
      const icon = resolveTablerIcon(clean(item?.iconKey) || clean(item?.iconQuery));
      if (!icon) throw new Error(`mediators[${index}].iconKey 未匹配到 Tabler 图标`);
      return {
        key,
        title: requireText(item?.title, `mediators[${index}].title`, 8),
        body: requireText(item?.body, `mediators[${index}].body`, 24),
        icon,
      };
    }),
  };
}

function intersectEdgeAtY(edge, y) {
  const ratio = (y - edge.near.y) / (edge.far.y - edge.near.y);
  return { x: edge.near.x + (edge.far.x - edge.near.x) * ratio, y };
}

function interpolatePoint(edge, t) {
  return {
    x: edge.near.x + (edge.far.x - edge.near.x) * t,
    y: edge.near.y + (edge.far.y - edge.near.y) * t,
  };
}

function projectEqualDepth(worldT, scaleRatio) {
  return (scaleRatio * worldT) / (1 + (scaleRatio - 1) * worldT);
}

function sectionAt(screenT) {
  const ground = interpolatePoint(GROUND_AXIS, screenT);
  const left = intersectEdgeAtY(SHAFT.front, ground.y);
  const right = intersectEdgeAtY(SHAFT.rear, ground.y);
  return {
    ground,
    left,
    right,
    localBandWidth: right.x - left.x,
  };
}

function perspectiveNode(screenT, worldT, size) {
  const section = sectionAt(screenT);
  return {
    t: screenT,
    worldT,
    leftX: section.left.x,
    rightX: section.right.x,
    localBandWidth: section.localBandWidth,
    groundX: section.ground.x,
    groundY: section.ground.y,
    // The pedestal is the contact point with the ribbon and therefore sits on
    // the trapezoid axis. The upright disc shares its x-axis and rises above it.
    x: section.ground.x,
    y: section.ground.y - size * PEDESTAL_CENTER_OFFSET,
    size,
  };
}

function connectorTarget({ x, y, size }) {
  const radius = size / 2 + 1;
  const endX = x - CONNECTOR_DIRECTION.x * radius;
  const endY = y - CONNECTOR_DIRECTION.y * radius;
  return {
    endX,
    endY,
    elbowX: endX - CONNECTOR_DIRECTION.x * CONNECTOR_DIAGONAL_LENGTH,
    elbowY: endY - CONNECTOR_DIRECTION.y * CONNECTOR_DIAGONAL_LENGTH,
  };
}

function layoutFor(count) {
  const state = LAYOUTS[count];
  const [nearT, farT] = state.depthRange;
  const nodeScale = count === 4 ? 0.78 : 1;
  const nearSection = sectionAt(nearT);
  const farSection = sectionAt(farT);
  const nearSize = nearSection.localBandWidth * NODE_TO_SECTION_RATIO * nodeScale;
  const rawScaleRatio = nearSection.localBandWidth / farSection.localBandWidth;
  const scaleRatio = rawScaleRatio ** NODE_PERSPECTIVE_STRENGTH;
  const layout = Array.from({ length: count }, (_, index) => {
    const worldT = count === 1 ? 0 : index / (count - 1);
    const projectedT = projectEqualDepth(worldT, scaleRatio);
    const screenT = nearT + (farT - nearT) * projectedT;
    const size = nearSize / (1 + (scaleRatio - 1) * worldT);
    const node = perspectiveNode(screenT, worldT, size);
    return {
      ...node,
      note: {
        worldT,
        x: state.noteOrigin.x + NOTE_STEP.x * index,
        y: state.noteOrigin.y + NOTE_STEP.y * index,
        width: NOTE_SIZE.width,
        height: NOTE_SIZE.height,
      },
    };
  });
  for (let index = 0; index < layout.length; index += 1) {
    const node = layout[index];
    const expectedGround = interpolatePoint(GROUND_AXIS, node.t);
    if (Math.hypot(node.groundX - expectedGround.x, node.groundY - expectedGround.y) > 0.01) {
      throw new Error(`机制节点 ${index + 1} 的椭圆中心未落在梯形中轴`);
    }
    if (Math.abs(node.x - node.groundX) > 0.01
      || Math.abs(node.y + node.size * PEDESTAL_CENTER_OFFSET - node.groundY) > 0.01) {
      throw new Error(`机制节点 ${index + 1} 的圆盘与椭圆未共享竖直中心线`);
    }
    if (index > 0 && layout[index - 1].size <= node.size) {
      throw new Error("机制节点必须随箭带透视由近到远严格缩小");
    }
    if (index > 1) {
      const previousGap = Math.hypot(
        layout[index - 1].groundX - layout[index - 2].groundX,
        layout[index - 1].groundY - layout[index - 2].groundY,
      );
      const currentGap = Math.hypot(
        node.groundX - layout[index - 1].groundX,
        node.groundY - layout[index - 1].groundY,
      );
      if (currentGap >= previousGap) throw new Error("等距节点投影后的画面间距必须向远端压缩");
    }
  }
  return layout;
}

function slotAttributes({ id, role, field, itemId, type = "text" }) {
  return `data-slot-id="${id}" data-slot-role="${role}" data-slot-field="${field}"${itemId ? ` data-slot-item-id="${itemId}"` : ""} data-slot-content-type="${type}" data-slot-required="true"`;
}

function arrowMarkup() {
  return `<svg class="perspective-arrow" viewBox="0 0 1170 492" aria-label="从左下近景向右上远景收缩的斜向透视箭头">
    <defs>
      <linearGradient id="arrow-shaft-fill" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#c8d9ec"/>
        <stop offset="38%" stop-color="#8fb2d8"/>
        <stop offset="100%" stop-color="#5b8cc8"/>
      </linearGradient>
      <linearGradient id="arrow-head-fill" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4266b0"/>
        <stop offset="100%" stop-color="#364583"/>
      </linearGradient>
    </defs>
    <g class="perspective-arrow__body">
      <polygon class="perspective-arrow__shaft" data-ppt-kind="path" data-ppt-name="perspective-arrow-shaft" points="150.09,489.34 839.27,190.20 934.71,190.20 538.06,487.91"/>
      <polygon class="perspective-arrow__head" data-ppt-kind="path" data-ppt-name="perspective-arrow-head" points="1018.52,5.02 948.12,44.54 971.58,45.76 839.27,190.20 934.71,190.20 1019.75,48.25 1045.69,48.25"/>
    </g>
  </svg>`;
}

function connectorMarkup(layout) {
  const paths = layout.map(({ x, y, size, note }) => {
    const { endX, endY, elbowX, elbowY } = connectorTarget({ x, y, size });
    const startX = note.x + note.width;
    if (elbowY < note.y || elbowY > note.y + note.height) {
      throw new Error("机制说明块未与统一阶梯网格对齐");
    }
    if (startX >= elbowX) throw new Error("机制说明块与圆盘之间没有水平引线空间");
    return `<path data-ppt-kind="path" data-ppt-name="mechanism-connector-${note.worldT}" d="M ${startX.toFixed(2)} ${elbowY.toFixed(2)} H ${elbowX.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)}"/>`;
  }).join("");
  return `<svg class="connector-layer" viewBox="0 0 1170 492" aria-hidden="true">${paths}</svg>`;
}

function mediatorMarkup(item, index, geometry, count) {
  const nodeLayer = count === 3 ? 6 - index : 4;
  const nodeStyle = `--node-x:${geometry.x.toFixed(2)}px;--node-y:${geometry.y.toFixed(2)}px;--node-size:${geometry.size.toFixed(2)}px;--node-layer:${nodeLayer}`;
  const note = geometry.note;
  const noteStyle = `--note-x:${note.x}px;--note-y:${note.y}px;--note-width:${note.width}px;--note-height:${note.height}px`;
  const iconMarkup = tablerIconSvgMarkup(item.icon, {
    name: `机制图标-${item.key}`,
    className: "mediator__icon-svg",
  });
  return `<article class="mechanism-note" style="${noteStyle}" ${slotAttributes({ id: `mediator-${item.key}-body`, role: "mediator-body", field: `mediators[${index}].body`, itemId: item.key })} data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="机制说明-${item.key}">
      <span class="mechanism-note__accent" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="机制说明强调线-${item.key}" aria-hidden="true"></span>
      <p class="mechanism-note__body" data-ppt-kind="text" data-ppt-name="机制说明文字-${item.key}">${escapeHtml(item.body)}</p>
    </article>
    <div class="mediator-anchor" style="${nodeStyle}" data-ppt-name="机制节点-${item.key}" data-perspective-t="${geometry.t}" data-world-t="${geometry.worldT}" data-ground-x="${geometry.groundX.toFixed(2)}" data-ground-y="${geometry.groundY.toFixed(2)}" data-cross-section-left="${geometry.leftX.toFixed(2)}" data-cross-section-right="${geometry.rightX.toFixed(2)}" data-local-band-width="${geometry.localBandWidth.toFixed(2)}">
      <div class="mediator__pedestal" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="机制托底-${item.key}" aria-hidden="true"></div>
      <article class="mediator" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="机制圆盘-${item.key}">
        <div class="mediator__inner-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="机制内环-${item.key}" aria-hidden="true"></div>
        <div class="mediator__icon" ${slotAttributes({ id: `mediator-${item.key}-icon`, role: "icon", field: `mediators[${index}].iconKey`, itemId: item.key, type: "icon" })} data-slot-provider="tabler-icons">${iconMarkup}</div>
        <h3 class="mediator__title" ${slotAttributes({ id: `mediator-${item.key}-title`, role: "mediator-title", field: `mediators[${index}].title`, itemId: item.key })} data-ppt-kind="text" data-ppt-name="机制标题-${item.key}">${escapeHtml(item.title)}</h3>
      </article>
    </div>`;
}

export const visualComponent = Object.freeze({
  id: "causal-mediator-chain",
  schemaVersion: 28,
  designFrame: FRAME,
  cssFile: "component.css",
  renderMarkup(payload) {
    const data = normalize(payload);
    const layout = layoutFor(data.mediators.length);
    return `<section class="mechanism" data-ppt-root data-mediator-count="${data.mediators.length}">
      ${arrowMarkup()}
      ${connectorMarkup(layout)}
      ${data.mediators.map((item, index) => mediatorMarkup(item, index, layout[index], data.mediators.length)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  trigger: { title: "开放数据机制", body: "持续释放可复用的数据与接口" },
  mediators: [
    { key: "visible", title: "信息可见", body: "降低信息搜寻与识别成本", iconKey: "eye" },
    { key: "coordination", title: "协同形成", body: "推动主体围绕共同目标协作", iconKey: "users-group" },
    { key: "diffusion", title: "能力扩散", body: "让方法与资源跨边界流动", iconKey: "broadcast" },
    { key: "standard", title: "规则沉淀", body: "把有效协作固化为通用规范", iconKey: "clipboard-check" },
  ],
  outcome: { title: "创新绩效提升", body: "形成可持续、可复制的增长结果" },
});

export function resolvePreviewParameters(base, selection) {
  const result = structuredClone(base);
  const count = Number(selection?.mediatorCount);
  if (!Number.isInteger(count) || count < 2 || count > 4) throw new Error("因果机制链支持 2–4 个中介机制");
  result.mediators = result.mediators.slice(0, count);
  return result;
}
