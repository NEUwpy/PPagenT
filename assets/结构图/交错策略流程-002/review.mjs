const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const BODY_LIMITS = Object.freeze({ 3: 34, 4: 30, 5: 26, 6: 22 });
const TITLE_LIMIT = 8;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
const clean = (value) => String(value ?? "").trim();

function normalize(parameters) {
  if (!Array.isArray(parameters?.items)) throw new Error("交错策略流程需要 items 数组");
  const n = parameters.items.length;
  if (n < 3 || n > 6) throw new Error("交错策略流程支持 3–6 步");
  return parameters.items.map((item, index) => {
    const title = clean(item?.title); const body = clean(item?.body);
    if (!title || !body) throw new Error(`items[${index}] 需要 title 和 body`);
    if (Array.from(title).length > TITLE_LIMIT || Array.from(body).length > BODY_LIMITS[n]) throw new Error(`items[${index}] 超出当前状态容量`);
    return { key: clean(item?.key) || `step-${index + 1}`, title, body };
  });
}

function points(n) {
  const left = 88; const right = 1082; const step = (right - left) / Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => `${left + step * i},${i % 2 ? 292 : 188}`).join(" ");
}

function card(item, index, n) {
  return `<article class="zig-card" style="--i:${index}" data-slot-item-id="${esc(item.key)}">
    <div class="zig-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="zig-surface-${index}"></div>
    <div class="zig-tag" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="zig-tag-${index}"></div>
    <div class="zig-order" data-ppt-kind="text" data-ppt-name="zig-order-${index}">${String(index + 1).padStart(2, "0")}</div>
    <h3 class="zig-title" data-slot-id="${esc(item.key)}-title" data-slot-role="item-title" data-slot-field="items[${index}].title" data-slot-item-id="${esc(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-max-chars="${TITLE_LIMIT}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="zig-title-${index}">${esc(item.title)}</h3>
    <p class="zig-body" data-slot-id="${esc(item.key)}-body" data-slot-role="item-body" data-slot-field="items[${index}].body" data-slot-item-id="${esc(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-max-chars="${BODY_LIMITS[n]}" data-slot-max-lines="3" data-ppt-kind="text" data-ppt-name="zig-body-${index}">${esc(item.body)}</p>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "sequence-zigzag-cards", schemaVersion: 5, designFrame: DESIGN_FRAME, cssFile: "component.css",
  textCapacity: { maxItemTitleChars: TITLE_LIMIT, maxItemBodyCharsByState: BODY_LIMITS, maxItemBodyLines: 3 },
  renderMarkup(parameters) { const items = normalize(parameters); return `<section class="zig-review" data-ppt-root data-item-count="${items.length}"><svg class="zig-track" viewBox="0 0 1170 492" aria-hidden="true"><polyline points="${points(items.length)}" fill="none" stroke="#b9cde0" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" data-ppt-kind="line" data-ppt-name="zig-track"/></svg><div class="zig-grid">${items.map((item, i) => card(item, i, items.length)).join("")}</div></section>`; }
});

export const previewParameters = Object.freeze({ items: [
  { key: "observe", title: "识别情境", body: "确认目标、边界与关键约束" }, { key: "plan", title: "形成方案", body: "围绕目标组织路径与资源" },
  { key: "execute", title: "推进执行", body: "按节奏完成关键动作" }, { key: "review", title: "复盘校正", body: "根据结果调整下一轮行动" },
  { key: "scale", title: "复制扩展", body: "把有效做法转化为稳定能力" }, { key: "renew", title: "持续迭代", body: "在新约束下更新工作方法" }
] });
export function resolvePreviewParameters(base, selection) { const n = Number(selection?.itemCount); if (n < 3 || n > 6) throw new Error("交错策略流程支持 3–6 步"); const result = structuredClone(base); result.items = result.items.slice(0, n); return result; }
