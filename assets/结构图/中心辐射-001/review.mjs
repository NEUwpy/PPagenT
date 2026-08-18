import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const BODY_LIMITS = Object.freeze({ 3: 30, 4: 28, 5: 26, 6: 24, 7: 22, 8: 20 });
const CENTER_TITLE_LIMIT = 10;
const CENTER_BODY_LIMIT = 18;
const ITEM_TITLE_LIMIT = 8;

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

function normalizeParameters(parameters) {
  if (!parameters || !parameters.center || !Array.isArray(parameters.items)) {
    throw new Error("中心锚点辐射需要 center 与 items");
  }
  const itemCount = parameters.items.length;
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 8) {
    throw new Error("中心锚点辐射支持 3–8 个外围项目");
  }
  const center = {
    title: text(parameters.center.title),
    body: text(parameters.center.body),
  };
  if (!center.title) throw new Error("center.title 不能为空");
  if (charCount(center.title) > CENTER_TITLE_LIMIT) throw new Error(`center.title 超过 ${CENTER_TITLE_LIMIT} 字`);
  if (charCount(center.body) > CENTER_BODY_LIMIT) throw new Error(`center.body 超过 ${CENTER_BODY_LIMIT} 字`);
  return {
    center,
    items: parameters.items.map((item, index) => {
      const title = text(item?.title);
      const body = text(item?.body);
      if (!title) throw new Error(`items[${index}].title 不能为空`);
      if (charCount(title) > ITEM_TITLE_LIMIT) throw new Error(`items[${index}].title 超过 ${ITEM_TITLE_LIMIT} 字`);
      if (charCount(body) > BODY_LIMITS[itemCount]) throw new Error(`items[${index}].body 超过 ${BODY_LIMITS[itemCount]} 字`);
      const key = text(item?.key) || `item-${index + 1}`;
      const iconQuery = text(item?.iconQuery);
      const icon = resolveTablerIcon(text(item?.iconKey) || iconQuery);
      return { key, title, body, iconQuery, icon };
    }),
  };
}

function evenlySpaced(count, top, bottom) {
  if (count === 1) return [(top + bottom) / 2];
  return Array.from({ length: count }, (_, index) => top + (bottom - top) * index / (count - 1));
}

function placements(itemCount) {
  const odd = itemCount % 2 === 1;
  const sideCount = Math.floor(itemCount / 2);
  const sideCenters = evenlySpaced(sideCount, odd ? 176 : itemCount === 4 ? 152 : itemCount === 6 ? 108 : 58, odd ? 420 : itemCount === 4 ? 340 : itemCount === 6 ? 384 : 434);
  const result = [];
  let index = 0;
  if (odd) {
    result.push({ index, side: "top", left: 397, top: 4, width: 376, height: 86 });
    index += 1;
  }
  for (let row = 0; row < sideCount; row += 1) {
    result.push({ index, side: "left", left: 12, top: sideCenters[row] - 43, width: 382, height: 86 });
    index += 1;
  }
  for (let row = 0; row < sideCount; row += 1) {
    result.push({ index, side: "right", left: 776, top: sideCenters[row] - 43, width: 382, height: 86 });
    index += 1;
  }
  return result;
}

function orbitDots() {
  return [
    { count: 28, radius: 132, size: 5, opacity: .34 },
    { count: 36, radius: 150, size: 4, opacity: .23 },
    { count: 44, radius: 168, size: 3, opacity: .14 },
  ].flatMap((ring, ringIndex) => Array.from({ length: ring.count }, (_, index) => (
    `<i class="hub-orbit-dot" style="--angle:${(360 / ring.count * index).toFixed(3)}deg;--radius:${ring.radius}px;--dot-size:${ring.size}px;--dot-opacity:${ring.opacity}" data-ring="${ringIndex}" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hub-orbit-dot-${ringIndex}-${index}"></i>`
  ))).join("");
}

function iconMarkup(item, index) {
  return item.icon
    ? tablerIconSvgMarkup(item.icon, { name: `hub-icon-${index}`, className: "hub-icon-svg" })
    : `<i class="hub-icon-fallback" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hub-icon-fallback-${index}"></i>`;
}

function itemMarkup(item, placement, itemCount) {
  const { index, side, left, top, width, height } = placement;
  return `<article class="hub-item hub-item-${side}" style="--left:${left}px;--top:${top}px;--width:${width}px;--height:${height}px" data-item-index="${index}">
    <div class="hub-item-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="hub-item-underlay-${index}"></div>
    <div class="hub-item-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="hub-item-surface-${index}"></div>
    <div class="hub-icon-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hub-icon-halo-${index}"></div>
    <div class="hub-icon-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hub-icon-core-${index}"></div>
    <div class="hub-icon-slot" data-slot-id="${escapeHtml(item.key)}-icon" data-slot-role="icon" data-slot-field="items[${index}].iconKey" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="icon" data-slot-provider="tabler-icons" data-slot-required="true">${iconMarkup(item, index)}</div>
    <h3 class="hub-item-title" data-slot-id="${escapeHtml(item.key)}-title" data-slot-role="item-title" data-slot-field="items[${index}].title" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${ITEM_TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="hub-item-title-${index}">${escapeHtml(item.title)}</h3>
    <p class="hub-item-body" data-slot-id="${escapeHtml(item.key)}-body" data-slot-role="item-body" data-slot-field="items[${index}].body" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="inline" data-slot-max-chars="${BODY_LIMITS[itemCount]}" data-slot-max-lines="2" data-ppt-kind="text" data-ppt-name="hub-item-body-${index}">${escapeHtml(item.body)}</p>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "hub-radial-anchor",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxCenterChars: CENTER_TITLE_LIMIT,
    maxCenterLines: 1,
    maxCenterBodyChars: CENTER_BODY_LIMIT,
    maxCenterBodyLines: 2,
    maxItemTitleChars: ITEM_TITLE_LIMIT,
    maxItemTitleLines: 1,
    maxItemBodyCharsByState: BODY_LIMITS,
    maxItemBodyLines: 2,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    const itemCount = model.items.length;
    const odd = itemCount % 2 === 1;
    const positions = placements(itemCount);
    return `<section class="hub-review" data-ppt-root data-item-count="${itemCount}" data-odd="${odd}">
      <div class="hub-orbit" aria-hidden="true">${orbitDots()}</div>
      <div class="hub-center-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hub-center-halo"></div>
      <div class="hub-center-ring" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="hub-center-ring"></div>
      <div class="hub-center-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="hub-center-core"></div>
      <h2 class="hub-center-title" data-slot-id="center-title" data-slot-role="center-title" data-slot-field="center.title" data-slot-item-id="center" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${CENTER_TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="hub-center-title">${escapeHtml(model.center.title)}</h2>
      <p class="hub-center-body" data-slot-id="center-body" data-slot-role="center-body" data-slot-field="center.body" data-slot-item-id="center" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${CENTER_BODY_LIMIT}" data-slot-max-lines="2" data-ppt-kind="text" data-ppt-name="hub-center-body">${escapeHtml(model.center.body)}</p>
      ${positions.map((position) => itemMarkup(model.items[position.index], position, itemCount)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  center: { title: "核心能力", body: "统一目标 · 协同资源" },
  items: [
    { key: "strategy", title: "战略牵引", body: "明确方向并形成共同目标", iconQuery: "target strategy" },
    { key: "data", title: "数据支撑", body: "汇集信息并提供可靠依据", iconQuery: "database analytics" },
    { key: "platform", title: "平台赋能", body: "连接资源并提升协同效率", iconQuery: "platform network" },
    { key: "governance", title: "机制保障", body: "以规则保障稳定有序运行", iconQuery: "shield governance" },
    { key: "service", title: "服务触达", body: "把能力转化为实际体验", iconQuery: "heart service" },
    { key: "talent", title: "人才协同", body: "汇聚多元角色共同参与", iconQuery: "users teamwork" },
    { key: "innovation", title: "创新驱动", body: "持续探索新的解决路径", iconQuery: "bulb innovation" },
    { key: "security", title: "安全底座", body: "守住系统与数据安全边界", iconQuery: "lock security" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const itemCount = Number(selection?.itemCount);
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 8) {
    throw new Error("中心锚点辐射支持 3–8 项");
  }
  const result = structuredClone(base);
  result.items = result.items.slice(0, itemCount);
  return result;
}
