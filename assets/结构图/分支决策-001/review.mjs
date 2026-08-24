import { textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({
  branchMin: 2,
  branchMax: 4,
  contextTitle: 24,
  contextTitleOnly: 36,
  contextBody: 36,
  decisionTitle: 18,
  condition: 8,
  actionTitle: 10,
  outcome: 10,
});
const STATE_LAYOUT = Object.freeze({
  2: Object.freeze({ left: 180, width: 810, gap: 110, body: 36 }),
  3: Object.freeze({ left: 110, width: 950, gap: 40, body: 28 }),
  4: Object.freeze({ left: 65, width: 1040, gap: 24, body: 20 }),
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

function requiredText(value, limit, field) {
  const result = text(value);
  if (!result || charCount(result) > limit) throw new RangeError(`${field} 必须为 1–${limit} 字`);
  return result;
}

function optionalText(value, limit, field) {
  const result = text(value);
  if (charCount(result) > limit) throw new RangeError(`${field} 不得超过 ${limit} 字`);
  return result;
}

function normalize(parameters) {
  if (!parameters?.context || !parameters?.decision || !Array.isArray(parameters?.branches)) {
    throw new TypeError("分支决策需要 context、decision 和 branches");
  }
  const branchCount = parameters.branches.length;
  if (branchCount < LIMITS.branchMin || branchCount > LIMITS.branchMax) {
    throw new RangeError("分支决策支持 2–4 条路径");
  }
  const layout = STATE_LAYOUT[branchCount];
  const contextBody = optionalText(parameters.context.body, LIMITS.contextBody, "context.body");
  return {
    branchCount,
    layout,
    context: {
      title: requiredText(parameters.context.title, contextBody ? LIMITS.contextTitle : LIMITS.contextTitleOnly, "context.title"),
      body: contextBody,
    },
    decision: {
      title: requiredText(parameters.decision.title, LIMITS.decisionTitle, "decision.title"),
    },
    branches: parameters.branches.map((item, index) => ({
      key: text(item?.key) || `branch-${index + 1}`,
      condition: requiredText(item?.condition, LIMITS.condition, `branches[${index}].condition`),
      title: requiredText(item?.title, LIMITS.actionTitle, `branches[${index}].title`),
      body: optionalText(item?.body, layout.body, `branches[${index}].body`),
      outcome: optionalText(item?.outcome, LIMITS.outcome, `branches[${index}].outcome`),
    })),
  };
}

function slotAttributes({ id, role, field, itemId, maxChars, maxLines, required = true }) {
  return `data-slot-id="${id}" data-slot-role="${role}" data-slot-field="${field}" data-slot-item-id="${itemId}" data-slot-content-type="text" data-slot-required="${required}" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}"`;
}

function geometryMarkup(model) {
  const cardWidth = (model.layout.width - ((model.branchCount - 1) * model.layout.gap)) / model.branchCount;
  const centers = Array.from({ length: model.branchCount }, (_, index) => model.layout.left + (index * (cardWidth + model.layout.gap)) + (cardWidth / 2));
  const first = centers[0];
  const last = centers.at(-1);
  const branches = centers.map((x, index) => {
    const outcome = model.branches[index].outcome;
    return `<line class="branch-link" x1="${x}" y1="238" x2="${x}" y2="272" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="decision-branch-link-${index}"></line>
      <circle class="branch-anchor" cx="${x}" cy="238" r="4" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="decision-branch-anchor-${index}"></circle>
      ${outcome ? `<line class="outcome-link" x1="${x}" y1="412" x2="${x}" y2="442" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="branch-outcome-link-${index}"></line>` : ""}`;
  }).join("");
  return `<svg class="decision-geometry" viewBox="0 0 1170 492" aria-hidden="true">
    <line class="decision-link" x1="585" y1="82" x2="585" y2="104" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="context-decision-link"></line>
    <line class="decision-link" x1="585" y1="214" x2="585" y2="238" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="decision-bus-link"></line>
    <line class="branch-bus" x1="${first}" y1="238" x2="${last}" y2="238" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="decision-branch-bus"></line>
    ${branches}
  </svg>`;
}

function contextMarkup(context) {
  return `<article class="context-wrap">
    <div class="context-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="decision-context-underlay"></div>
    <section class="context-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="decision-context-card">
      ${textFlowMarkup({ id: "context-content", field: "context", itemId: "context", title: context.title, body: context.body, className: "context-copy", align: "center", valign: "middle", tone: "dark", names: { title: "decision-context-title", body: "decision-context-body" } })}
    </section>
  </article>`;
}

function decisionMarkup(decision) {
  return `<div class="decision-wrap"><div class="decision-node" ${slotAttributes({ id: "decision-title", role: "decision-title", field: "decision.title", itemId: "decision", maxChars: LIMITS.decisionTitle, maxLines: 3 })} data-ppt-kind="shape-text" data-ppt-shape="diamond" data-ppt-shadow="shadow-sm" data-ppt-name="decision-node">${escapeHtml(decision.title)}</div></div>`;
}

function branchMarkup(item, index, bodyLimit) {
  return `<article class="branch-column" data-key="${escapeHtml(item.key)}">
    <span class="condition-label" ${slotAttributes({ id: `${item.key}-condition`, role: "branch-condition", field: `branches[${index}].condition`, itemId: item.key, maxChars: LIMITS.condition, maxLines: 1 })} data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="branch-condition-${index}">${escapeHtml(item.condition)}</span>
    <div class="route-wrap">
      <section class="route-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="branch-route-card-${index}"></section>
      <span class="route-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="branch-route-accent-${index}"></span>
      ${textFlowMarkup({ id: `${item.key}-content`, field: `branches[${index}]`, itemId: item.key, regionId: "route", title: item.title, body: item.body, className: "route-copy", align: "center", valign: "middle", names: { title: `branch-title-${index}`, body: `branch-body-${index}` } })}
    </div>
    ${item.outcome ? `<span class="outcome-label" ${slotAttributes({ id: `${item.key}-outcome`, role: "branch-outcome", field: `branches[${index}].outcome`, itemId: item.key, maxChars: LIMITS.outcome, maxLines: 1, required: false })} data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="branch-outcome-${index}">${escapeHtml(item.outcome)}</span>` : ""}
  </article>`;
}

export const branchingDecisionVisualComponent = Object.freeze({
  id: "branching-decision-routes",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "standard", scope: "per-contiguous-region" }),
  textCapacity: Object.freeze({
    maxContextTitleChars: LIMITS.contextTitleOnly,
    maxContextTitleLines: 2,
    maxDecisionTitleChars: LIMITS.decisionTitle,
    maxDecisionTitleLines: 3,
    maxItemTitleChars: LIMITS.actionTitle,
    maxItemTitleLines: 2,
    maxItemBodyChars: STATE_LAYOUT[4].body,
    maxItemBodyLines: 3,
  }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const cardWidth = (model.layout.width - ((model.branchCount - 1) * model.layout.gap)) / model.branchCount;
    return `<section class="branching-decision-review" data-ppt-root data-branch-count="${model.branchCount}" style="--branch-count:${model.branchCount};--branch-left:${model.layout.left}px;--branch-width:${model.layout.width}px;--branch-gap:${model.layout.gap}px;--branch-card-width:${cardWidth}px">
      ${geometryMarkup(model)}
      ${contextMarkup(model.context)}
      ${decisionMarkup(model.decision)}
      <section class="branch-grid">${model.branches.map((item, index) => branchMarkup(item, index, model.layout.body)).join("")}</section>
    </section>`;
  },
});

const previewBranches = Object.freeze([
  Object.freeze({ key: "full", condition: "完全满足", title: "自动执行", body: "按既定规则直接进入处理", outcome: "进入生产" }),
  Object.freeze({ key: "basic", condition: "基本满足", title: "补充确认", body: "核对少量缺失信息后继续", outcome: "确认后执行" }),
  Object.freeze({ key: "missing", condition: "信息不足", title: "返回补充", body: "明确缺失项并保留当前进度", outcome: "等待补充" }),
  Object.freeze({ key: "risk", condition: "触发风险", title: "人工复核", body: "由责任人判断是否继续处理", outcome: "进入审核" }),
]);

export const previewParameters = Object.freeze({
  context: Object.freeze({ title: "新需求进入处理队列", body: "系统先核对资料完整性、规则匹配度与风险状态" }),
  decision: Object.freeze({ title: "当前条件评估结果" }),
  branches: Object.freeze([previewBranches[0], previewBranches[2], previewBranches[3]]),
});

export function resolvePreviewParameters(base, selection) {
  const branchCount = Number(selection?.branchCount);
  if (!Number.isInteger(branchCount) || branchCount < LIMITS.branchMin || branchCount > LIMITS.branchMax) {
    throw new RangeError("分支决策支持 2–4 条路径");
  }
  const contextTextMode = text(selection?.contextTextMode) || "标题+说明";
  const outcomeMode = text(selection?.outcomeMode) || "显示结果";
  if (!["标题+说明", "仅标题"].includes(contextTextMode)) throw new RangeError("不支持的输入文字模式");
  if (!["显示结果", "不显示结果"].includes(outcomeMode)) throw new RangeError("不支持的结果显示模式");
  const result = structuredClone(base);
  result.branches = branchCount === 2
    ? [structuredClone(previewBranches[0]), structuredClone(previewBranches[3])]
    : branchCount === 3
      ? [structuredClone(previewBranches[0]), structuredClone(previewBranches[2]), structuredClone(previewBranches[3])]
      : previewBranches.map((item) => structuredClone(item));
  if (contextTextMode === "仅标题") {
    result.context.body = "";
    result.context.title = "系统依据资料完整性、规则匹配度与风险状态决定需求进入哪一条后续处理路径";
  }
  if (outcomeMode === "不显示结果") {
    result.branches.forEach((item) => { item.outcome = ""; });
  }
  return result;
}
