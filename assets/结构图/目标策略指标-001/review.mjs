const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({
  goalTitle: 24,
  goalBody: 36,
});

const STATE_LIMITS = Object.freeze({
  2: Object.freeze({ strategyTitle: 10, strategyBody: 42, metricLabel: Object.freeze({ 1: 8, 2: 7 }), metricValue: Object.freeze({ 1: 10, 2: 6 }) }),
  3: Object.freeze({ strategyTitle: 8, strategyBody: 33, metricLabel: Object.freeze({ 1: 7, 2: 6 }), metricValue: Object.freeze({ 1: 9, 2: 4 }) }),
  4: Object.freeze({ strategyTitle: 6, strategyBody: 27, metricLabel: Object.freeze({ 1: 6, 2: 6 }), metricValue: Object.freeze({ 1: 8, 2: 4 }) }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function chars(value) {
  return Array.from(value).length;
}

function requireText(value, field, limit) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${field} 不能为空`);
  if (chars(normalized) > limit) throw new Error(`${field} 超过 ${limit} 字`);
  return normalized;
}

function optionalText(value, field, limit) {
  const normalized = text(value);
  if (chars(normalized) > limit) throw new Error(`${field} 超过 ${limit} 字`);
  return normalized;
}

function normalize(parameters) {
  const goal = {
    title: requireText(parameters?.goal?.title, "goal.title", LIMITS.goalTitle),
    body: optionalText(parameters?.goal?.body, "goal.body", LIMITS.goalBody),
  };
  if (!Array.isArray(parameters?.strategies)) throw new Error("目标策略指标对齐需要 strategies 数组");
  if (parameters.strategies.length < 2 || parameters.strategies.length > 4) throw new Error("目标策略指标对齐支持 2–4 项策略");
  const metricCounts = new Set(parameters.strategies.map((strategy) => strategy?.metrics?.length));
  if (metricCounts.size !== 1 || ![1, 2].includes([...metricCounts][0])) throw new Error("每项策略必须统一包含 1 或 2 个指标");
  const metricCount = [...metricCounts][0];
  const stateLimits = STATE_LIMITS[parameters.strategies.length];
  const limits = {
    strategyTitle: stateLimits.strategyTitle,
    strategyBody: stateLimits.strategyBody,
    metricLabel: stateLimits.metricLabel[metricCount],
    metricValue: stateLimits.metricValue[metricCount],
  };
  const strategies = parameters.strategies.map((strategy, strategyIndex) => ({
    key: text(strategy?.key) || `strategy-${strategyIndex + 1}`,
    title: requireText(strategy?.title, `strategies[${strategyIndex}].title`, limits.strategyTitle),
    body: requireText(strategy?.body, `strategies[${strategyIndex}].body`, limits.strategyBody),
    metrics: strategy.metrics.map((metric, metricIndex) => ({
      label: requireText(metric?.label, `strategies[${strategyIndex}].metrics[${metricIndex}].label`, limits.metricLabel),
      value: requireText(metric?.value, `strategies[${strategyIndex}].metrics[${metricIndex}].value`, limits.metricValue),
    })),
  }));
  return { goal, strategies, metricCount, limits };
}

function goalMarkup(goal) {
  return `<div class="goal-title" data-slot-id="goal-title" data-slot-role="goal-title" data-slot-field="goal.title" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.goalTitle}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="goal-title">${escapeHtml(goal.title)}</div>
    ${goal.body ? `<div class="goal-body" data-slot-id="goal-body" data-slot-role="goal-body" data-slot-field="goal.body" data-slot-content-type="text" data-slot-required="false" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.goalBody}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="goal-body">${escapeHtml(goal.body)}</div>` : ""}
    `;
}

function metricMarkup(metric, strategyIndex, metricIndex, limits) {
  return `<div class="metric-cell" data-metric-index="${metricIndex}">
    ${metricIndex > 0 ? `<div class="metric-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="strategy-${strategyIndex + 1}-metric-divider"></div>` : ""}
    <div class="metric-value" data-slot-id="strategy-${strategyIndex + 1}-metric-${metricIndex + 1}-value" data-slot-role="metric-value" data-slot-field="strategies[${strategyIndex}].metrics[${metricIndex}].value" data-slot-item-id="strategy-${strategyIndex + 1}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${limits.metricValue}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="strategy-${strategyIndex + 1}-metric-${metricIndex + 1}-value">${escapeHtml(metric.value)}</div>
    <div class="metric-label" data-slot-id="strategy-${strategyIndex + 1}-metric-${metricIndex + 1}-label" data-slot-role="metric-label" data-slot-field="strategies[${strategyIndex}].metrics[${metricIndex}].label" data-slot-item-id="strategy-${strategyIndex + 1}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${limits.metricLabel}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="strategy-${strategyIndex + 1}-metric-${metricIndex + 1}-label">${escapeHtml(metric.label)}</div>
  </div>`;
}

function strategyMarkup(strategy, strategyIndex, _strategies, limits) {
  return `<article class="strategy-bay" data-strategy-index="${strategyIndex}">
    ${strategyIndex > 0 ? `<div class="strategy-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="strategy-${strategyIndex + 1}-divider"></div>` : ""}
    <div class="strategy-order-disc" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="strategy-${strategyIndex + 1}-order-disc"></div>
    <div class="strategy-order-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="strategy-${strategyIndex + 1}-order-core"></div>
    <div class="strategy-order" data-ppt-kind="text" data-ppt-name="strategy-${strategyIndex + 1}-order">${String(strategyIndex + 1).padStart(2, "0")}</div>
    <h3 data-slot-id="strategy-${strategyIndex + 1}-title" data-slot-role="item-title" data-slot-field="strategies[${strategyIndex}].title" data-slot-item-id="strategy-${strategyIndex + 1}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${limits.strategyTitle}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="strategy-${strategyIndex + 1}-title">${escapeHtml(strategy.title)}</h3>
    <p data-slot-id="strategy-${strategyIndex + 1}-body" data-slot-role="item-body" data-slot-field="strategies[${strategyIndex}].body" data-slot-item-id="strategy-${strategyIndex + 1}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${limits.strategyBody}" data-slot-max-lines="3" data-ppt-kind="text" data-ppt-name="strategy-${strategyIndex + 1}-body">${escapeHtml(strategy.body)}</p>
  </article>`;
}

function metricBayMarkup(strategy, strategyIndex, limits) {
  return `<article class="metric-bay" data-strategy-index="${strategyIndex}">
    ${strategyIndex > 0 ? `<div class="foundation-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="strategy-${strategyIndex + 1}-foundation-divider"></div>` : ""}
    <div class="metric-grid" data-metric-count="${strategy.metrics.length}">${strategy.metrics.map((metric, metricIndex) => metricMarkup(metric, strategyIndex, metricIndex, limits)).join("")}</div>
  </article>`;
}

function houseGeometry(strategyCount) {
  if (strategyCount === 2) return { left: 145, width: 880 };
  if (strategyCount === 3) return { left: 95, width: 980 };
  return { left: 55, width: 1060 };
}

export const visualComponent = Object.freeze({
  id: "goal-alignment-strategy-metrics",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxGoalTitleChars: LIMITS.goalTitle,
    maxGoalBodyChars: LIMITS.goalBody,
    strategyTitleCharsByCount: Object.freeze({ 2: 10, 3: 8, 4: 6 }),
    strategyBodyCharsByCount: Object.freeze({ 2: 42, 3: 33, 4: 27 }),
    metricLabelCharsByState: Object.freeze({ "2x1": 8, "2x2": 7, "3x1": 7, "3x2": 6, "4x1": 6, "4x2": 6 }),
    metricValueCharsByState: Object.freeze({ "2x1": 10, "2x2": 6, "3x1": 9, "3x2": 4, "4x1": 8, "4x2": 4 }),
  }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const geometry = houseGeometry(model.strategies.length);
    return `<section class="goal-alignment-review" data-ppt-root data-strategy-count="${model.strategies.length}" data-metric-count="${model.metricCount}" data-goal-body="${model.goal.body ? "true" : "false"}" style="--strategy-count:${model.strategies.length};--house-left:${geometry.left}px;--house-width:${geometry.width}px;">
      ${goalMarkup(model.goal)}
      <div class="alignment-field-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="alignment-field-underlay"></div>
      <div class="alignment-field" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="alignment-field"></div>
      <div class="alignment-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="alignment-accent"></div>
      <div class="strategy-grid">${model.strategies.map((strategy, index, strategies) => strategyMarkup(strategy, index, strategies, model.limits)).join("")}</div>
      <div class="metric-band-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="metric-band-underlay"></div>
      <div class="metric-band" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="metric-band"></div>
      <div class="metric-band-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="metric-band-accent"></div>
      <div class="foundation-grid">${model.strategies.map((strategy, index) => metricBayMarkup(strategy, index, model.limits)).join("")}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  goal: {
    title: "建设稳定、可复用的智能汇报生产体系",
    body: "让固定场景中的演示文稿更可靠、更高效、更易维护",
  },
  strategies: [
    {
      key: "content",
      title: "内容标准化",
      body: "把原稿拆成稳定字段，保留真实逻辑并控制每页信息密度。",
      metrics: [
        { label: "结构化通过率", value: "≥95%" },
        { label: "信息遗漏", value: "0 项" },
      ],
    },
    {
      key: "asset",
      title: "视觉资产化",
      body: "把常用逻辑固化为组件，统一字号、版心与连接语法。",
      metrics: [
        { label: "核心逻辑覆盖", value: "≥80%" },
        { label: "人工返修", value: "≤1 轮" },
      ],
    },
    {
      key: "engineering",
      title: "生成工程化",
      body: "确定性排版交付，保证结果稳定、可编辑、可重复。",
      metrics: [
        { label: "单稿生成", value: "10分钟" },
        { label: "对象可编辑率", value: "100%" },
      ],
    },
    {
      key: "operation",
      title: "反馈闭环化",
      body: "用真实稿件暴露能力缺口，再把可复用解法补回资产与规则。",
      metrics: [
        { label: "问题闭环率", value: "100%" },
        { label: "重复事故", value: "0 次" },
      ],
    },
  ],
});

export function resolvePreviewParameters(base, selection) {
  const strategyCount = Number(selection?.strategyCount);
  const metricCount = Number(selection?.metricCount);
  if (![2, 3, 4].includes(strategyCount)) throw new Error("策略数量必须为 2、3 或 4");
  if (![1, 2].includes(metricCount)) throw new Error("每项策略指标数必须为 1 或 2");
  const result = structuredClone(base);
  result.strategies = result.strategies.slice(0, strategyCount).map((strategy) => ({
    ...strategy,
    metrics: strategy.metrics.slice(0, metricCount),
  }));
  return result;
}
