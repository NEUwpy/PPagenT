import { textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({
  categoryMin: 4,
  categoryMax: 6,
  factorMin: 1,
  factorMax: 3,
  causeTitle: 8,
  factor: 10,
  factorTotal: 30,
  effectTitle: 10,
  effectBody: 8,
});
const GEOMETRY = Object.freeze({
  4: Object.freeze({ top: Object.freeze([430, 790]), bottom: Object.freeze([430, 790]) }),
  5: Object.freeze({ top: Object.freeze([330, 630, 930]), bottom: Object.freeze([470, 810]) }),
  6: Object.freeze({ top: Object.freeze([330, 630, 930]), bottom: Object.freeze([330, 630, 930]) }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(String(value ?? "")).length;
}

function normalizeParameters(parameters) {
  if (!parameters?.effect || !Array.isArray(parameters.causes)) {
    throw new TypeError("鱼骨归因需要 effect 和 causes");
  }
  const categoryCount = parameters.causes.length;
  if (!Number.isInteger(categoryCount) || categoryCount < LIMITS.categoryMin || categoryCount > LIMITS.categoryMax) {
    throw new RangeError("鱼骨归因支持 4–6 类原因");
  }
  const effect = { title: text(parameters.effect.title), body: text(parameters.effect.body) };
  if (!effect.title || charCount(effect.title) > LIMITS.effectTitle) throw new RangeError(`结果标题必须为 1–${LIMITS.effectTitle} 字`);
  if (charCount(effect.body) > LIMITS.effectBody) throw new RangeError(`结果说明不得超过 ${LIMITS.effectBody} 字`);

  let factorCount = null;
  const causes = parameters.causes.map((cause, index) => {
    const title = text(cause?.title);
    const factors = Array.isArray(cause?.factors) ? cause.factors.map(text).filter(Boolean) : [];
    if (!title || charCount(title) > LIMITS.causeTitle) throw new RangeError(`causes[${index}].title 必须为 1–${LIMITS.causeTitle} 字`);
    if (factors.length < LIMITS.factorMin || factors.length > LIMITS.factorMax) throw new RangeError(`causes[${index}] 支持 1–3 个因素`);
    if (factorCount === null) factorCount = factors.length;
    if (factors.length !== factorCount) throw new RangeError("同一 State 中各原因类别的因素数量必须一致");
    if (factors.some((factor) => charCount(factor) > LIMITS.factor)) throw new RangeError(`causes[${index}] 存在超过 ${LIMITS.factor} 字的因素`);
    if (charCount(factors.join("")) > LIMITS.factorTotal) throw new RangeError(`causes[${index}] 因素总字数超过 ${LIMITS.factorTotal} 字`);
    return { key: text(cause?.key) || `cause-${index + 1}`, title, factors };
  });
  return { categoryCount, factorCount, effect, causes };
}

function distribute(model) {
  const geometry = GEOMETRY[model.categoryCount];
  const topCount = Math.ceil(model.categoryCount / 2);
  return model.causes.map((cause, index) => {
    const side = index < topCount ? "top" : "bottom";
    const sideIndex = side === "top" ? index : index - topCount;
    return { ...cause, index, side, x: geometry[side][sideIndex] };
  });
}

function branchEndpoint(item) {
  const edgeReduction = Math.min(23, Math.abs(item.x - 630) * 0.08);
  const reach = 192 - edgeReduction;
  return {
    x: item.x - (item.side === "top" ? 40 : 58),
    y: item.side === "top" ? 246 - reach : 246 + reach,
  };
}

function branchPath(item) {
  const endpoint = branchEndpoint(item);
  return `M ${item.x} 246 L ${endpoint.x} ${endpoint.y}`;
}

function geometryMarkup(items) {
  const branches = items.map((item) => {
    const path = branchPath(item);
    return `<path class="causal-branch" d="${path}" data-ppt-kind="path" data-ppt-name="cause-branch-${item.index}"></path>`;
  }).join("");
  const anchors = [...new Set(items.map((item) => item.x))].map((x, index) =>
    `<circle class="causal-spine-anchor" cx="${x}" cy="246" r="16" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="causal-anchor-${index}"></circle>`,
  ).join("");
  return `<svg class="causal-geometry" viewBox="0 0 1170 492" aria-hidden="true">
    <path class="causal-tail" d="M 10 190 C 45 194 66 218 66 246 C 66 274 45 298 10 302 Z" data-ppt-kind="path" data-ppt-name="causal-tail"></path>
    <line class="causal-spine" x1="48" y1="246" x2="1076" y2="246" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="causal-spine"></line>
    ${branches}
    ${anchors}
    <path class="causal-effect-shape" d="M 1014 126 C 1089 138 1140 183 1164 246 C 1140 309 1089 354 1014 366 Z" data-ppt-kind="path" data-ppt-name="causal-effect-head"></path>
  </svg>`;
}

function causeDecorMarkup(item, factorCount) {
  const headingPath = item.side === "top"
    ? "M 0 0 H 217 L 230 46 H 0 Z"
    : "M 0 152 H 230 L 217 198 H 0 Z";
  const factorTop = item.side === "top" ? 61 : 0;
  const guides = Array.from({ length: factorCount }, (_, index) => {
    const y = factorTop + ((index + 1) * 39) - 1;
    return `<line class="factor-guide-line" x1="16" y1="${y}" x2="216" y2="${y}" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="factor-guide-${item.index}-${index}"></line>
      <path class="factor-guide-arrow" d="M 8 ${y} L 16 ${y - 4} L 16 ${y + 4} Z" data-ppt-kind="path" data-ppt-name="factor-arrow-${item.index}-${index}"></path>`;
  }).join("");
  return `<svg class="cause-decor" viewBox="0 0 230 198" aria-hidden="true">
    <path class="cause-heading-fill" d="${headingPath}" data-ppt-kind="path" data-ppt-name="cause-heading-${item.index}"></path>
    ${guides}
  </svg>`;
}

function causeMarkup(item, factorCount) {
  const endpoint = branchEndpoint(item);
  const left = endpoint.x - 230;
  const top = item.side === "top" ? endpoint.y - 46 : endpoint.y - 152;
  return `<article class="cause-group" data-side="${item.side}" data-key="${escapeHtml(item.key)}" style="left:${left}px;top:${top}px">
    ${causeDecorMarkup(item, factorCount)}
    <h3 class="cause-heading">
      <span class="cause-index" aria-hidden="true" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="cause-index-${item.index}">${String(item.index + 1).padStart(2, "0")}</span>
      <span class="cause-title" data-slot-id="${escapeHtml(item.key)}-title" data-slot-role="item-title" data-slot-field="causes[${item.index}].title" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.causeTitle}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="cause-title-${item.index}">${escapeHtml(item.title)}</span>
    </h3>
    <ul class="cause-factors" data-slot-id="${escapeHtml(item.key)}-body" data-slot-role="item-body" data-slot-field="causes[${item.index}].factors" data-slot-item-id="${escapeHtml(item.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="inline" data-slot-max-chars="${LIMITS.factorTotal}" data-slot-max-lines="${factorCount}" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="cause-body-${item.index}">
      ${item.factors.map((factor) => `<li>${escapeHtml(factor)}</li>`).join("")}
    </ul>
  </article>`;
}

function effectMarkup(effect) {
  return `<article class="effect-copy">
    <span class="effect-label" data-ppt-kind="text" data-ppt-name="effect-label">结果</span>
    ${textFlowMarkup({ id: "effect-content", field: "effect", itemId: "effect", regionId: "summary", title: effect.title, body: effect.body, className: "effect-content", align: "center", valign: "middle", tone: "dark", names: { title: "effect-title", body: "effect-body" } })}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "causal-fishbone-attribution",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "standard", scope: "per-contiguous-region" }),
  textCapacity: Object.freeze({
    maxCenterChars: LIMITS.effectTitle,
    maxCenterLines: 2,
    maxEffectTitleChars: LIMITS.effectTitle,
    maxEffectTitleLines: 2,
    maxEffectBodyChars: LIMITS.effectBody,
    maxEffectBodyLines: 2,
    maxItemTitleChars: LIMITS.causeTitle,
    maxItemTitleLines: 1,
    maxItemBodyChars: LIMITS.factorTotal,
    maxItemBodyLines: LIMITS.factorMax,
    maxPointsPerItem: LIMITS.factorMax,
    maxPointChars: LIMITS.factor,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    const items = distribute(model);
    return `<section class="causal-review" data-ppt-root data-category-count="${model.categoryCount}" data-factor-count="${model.factorCount}">
      ${geometryMarkup(items)}
      <div class="cause-layer">${items.map((item) => causeMarkup(item, model.factorCount)).join("")}</div>
      ${effectMarkup(model.effect)}
    </section>`;
  },
});

// Stable asset-specific export lets a long-running dashboard bypass an older
// cached generic visualComponent module after the asset is promoted to core.
export const fishboneVisualComponent = visualComponent;

export const previewParameters = Object.freeze({
  effect: Object.freeze({ title: "交付延期", body: "" }),
  causes: Object.freeze([
    Object.freeze({ key: "requirements", title: "需求定义", factors: Object.freeze(["目标频繁调整", "验收口径不清", "范围持续扩张"]) }),
    Object.freeze({ key: "planning", title: "计划协同", factors: Object.freeze(["排期依赖遗漏", "资源承诺不稳", "里程碑失真"]) }),
    Object.freeze({ key: "technology", title: "技术实现", factors: Object.freeze(["接口复杂耦合", "自动化覆盖不足", "技术债务累积"]) }),
    Object.freeze({ key: "testing", title: "测试验证", factors: Object.freeze(["用例覆盖不足", "测试环境不稳", "缺陷回归滞后"]) }),
    Object.freeze({ key: "people", title: "人员机制", factors: Object.freeze(["关键岗位缺口", "职责边界模糊", "反馈链路过长"]) }),
    Object.freeze({ key: "external", title: "外部依赖", factors: Object.freeze(["供应交付延迟", "审批周期过长", "政策要求变化"]) }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const categoryCount = Number(selection?.categoryCount);
  const factorCount = Number(selection?.factorCount);
  if (!Number.isInteger(categoryCount) || categoryCount < LIMITS.categoryMin || categoryCount > LIMITS.categoryMax) {
    throw new RangeError("鱼骨归因支持 4–6 类原因");
  }
  if (!Number.isInteger(factorCount) || factorCount < LIMITS.factorMin || factorCount > LIMITS.factorMax) {
    throw new RangeError("每类原因支持 1–3 个因素");
  }
  const result = structuredClone(base);
  result.causes = result.causes.slice(0, categoryCount).map((cause) => ({ ...cause, factors: cause.factors.slice(0, factorCount) }));
  return result;
}
