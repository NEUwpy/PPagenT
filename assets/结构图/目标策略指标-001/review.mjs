import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });

function text(value) {
  return String(value ?? "").trim();
}

function requireText(value, field) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${field} 不能为空`);
  return normalized;
}

function optionalText(value) {
  return text(value);
}

function normalize(parameters) {
  const goal = {
    title: requireText(parameters?.goal?.title, "goal.title"),
    body: optionalText(parameters?.goal?.body),
  };
  if (!Array.isArray(parameters?.strategies)) throw new Error("目标策略指标对齐需要 strategies 数组");
  if (parameters.strategies.length < 2 || parameters.strategies.length > 4) throw new Error("目标策略指标对齐支持 2–4 项策略");
  const metricCounts = new Set(parameters.strategies.map((strategy) => strategy?.metrics?.length));
  if (metricCounts.size !== 1 || ![1, 2].includes([...metricCounts][0])) throw new Error("每项策略必须统一包含 1 或 2 个指标");
  const metricCount = [...metricCounts][0];
  const strategies = parameters.strategies.map((strategy, strategyIndex) => ({
    key: text(strategy?.key) || `strategy-${strategyIndex + 1}`,
    title: optionalText(strategy?.title),
    body: optionalText(strategy?.body),
    metrics: strategy.metrics.map((metric, metricIndex) => ({
      label: requireText(metric?.label, `strategies[${strategyIndex}].metrics[${metricIndex}].label`),
      value: requireText(metric?.value, `strategies[${strategyIndex}].metrics[${metricIndex}].value`),
    })),
  })).map((strategy, strategyIndex) => {
    if (!strategy.title && !strategy.body) throw new Error(`strategies[${strategyIndex}] 至少需要 title 或 body`);
    return strategy;
  });
  const textLayoutBindings = parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
    ? { ...parameters.textLayoutBindings }
    : {};
  return { goal, strategies, metricCount, textLayoutBindings };
}

function selectedLayout(bindings, regionId, fallback) {
  return text(bindings?.[regionId]) || fallback;
}

function goalMarkup(goal, textLayoutBindings) {
  return textRegionMarkup({
    id: "goal-content",
    field: "goal",
    itemId: "goal",
    layoutId: selectedLayout(textLayoutBindings, "goal-content", "heading-content-flow"),
    compatibleLayoutIds: ["statement-flow", "heading-content-flow"],
    content: goal,
    className: "goal-content",
    align: "center",
    valign: "middle",
    names: { title: "goal-title", body: "goal-body" },
  });
}

function metricMarkup(metric, strategyIndex, metricIndex, textLayoutBindings) {
  const regionId = `strategy-${strategyIndex + 1}-metric-${metricIndex + 1}`;
  return `<div class="metric-cell" data-metric-index="${metricIndex}">
    ${metricIndex > 0 ? `<div class="metric-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="strategy-${strategyIndex + 1}-metric-divider"></div>` : ""}
    ${textRegionMarkup({
      id: regionId,
      field: `strategies[${strategyIndex}].metrics[${metricIndex}]`,
      itemId: `strategy-${strategyIndex + 1}`,
      regionId: `metric-${metricIndex + 1}`,
      layoutId: selectedLayout(textLayoutBindings, regionId, "metric-content-flow"),
      compatibleLayoutIds: ["metric-content-flow"],
      content: metric,
      className: "metric-content",
      names: {
        value: `strategy-${strategyIndex + 1}-metric-${metricIndex + 1}-value`,
        label: `strategy-${strategyIndex + 1}-metric-${metricIndex + 1}-label`,
      },
    })}
  </div>`;
}

function strategyMarkup(strategy, strategyIndex, textLayoutBindings) {
  const regionId = `strategy-${strategyIndex + 1}-content`;
  return `<article class="strategy-bay" data-strategy-index="${strategyIndex}">
    ${strategyIndex > 0 ? `<div class="strategy-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="strategy-${strategyIndex + 1}-divider"></div>` : ""}
    <div class="strategy-order-disc" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="strategy-${strategyIndex + 1}-order-disc"></div>
    <div class="strategy-order-core" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="strategy-${strategyIndex + 1}-order-core"></div>
    <div class="strategy-order" data-ppt-kind="text" data-ppt-name="strategy-${strategyIndex + 1}-order">${String(strategyIndex + 1).padStart(2, "0")}</div>
    ${textRegionMarkup({
      id: regionId,
      field: `strategies[${strategyIndex}]`,
      itemId: `strategy-${strategyIndex + 1}`,
      layoutId: selectedLayout(textLayoutBindings, regionId, "heading-content-flow"),
      compatibleLayoutIds: ["statement-flow", "heading-content-flow"],
      content: strategy,
      className: "strategy-content",
      align: "center",
      valign: "middle",
      names: { title: `strategy-${strategyIndex + 1}-title`, body: `strategy-${strategyIndex + 1}-body` },
    })}
  </article>`;
}

function metricBayMarkup(strategy, strategyIndex, textLayoutBindings) {
  return `<article class="metric-bay" data-strategy-index="${strategyIndex}">
    ${strategyIndex > 0 ? `<div class="foundation-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="strategy-${strategyIndex + 1}-foundation-divider"></div>` : ""}
    <div class="metric-grid" data-metric-count="${strategy.metrics.length}">${strategy.metrics.map((metric, metricIndex) => metricMarkup(metric, strategyIndex, metricIndex, textLayoutBindings)).join("")}</div>
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
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const geometry = houseGeometry(model.strategies.length);
    return `<section class="goal-alignment-review" data-ppt-root data-strategy-count="${model.strategies.length}" data-metric-count="${model.metricCount}" data-goal-body="${model.goal.body ? "true" : "false"}" style="--strategy-count:${model.strategies.length};--house-left:${geometry.left}px;--house-width:${geometry.width}px;">
      ${goalMarkup(model.goal, model.textLayoutBindings)}
      <div class="alignment-field-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="alignment-field-underlay"></div>
      <div class="alignment-field" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="alignment-field"></div>
      <div class="alignment-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="alignment-accent"></div>
      <div class="strategy-grid">${model.strategies.map((strategy, index) => strategyMarkup(strategy, index, model.textLayoutBindings)).join("")}</div>
      <div class="metric-band-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="metric-band-underlay"></div>
      <div class="metric-band" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="metric-band"></div>
      <div class="metric-band-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="metric-band-accent"></div>
      <div class="foundation-grid">${model.strategies.map((strategy, index) => metricBayMarkup(strategy, index, model.textLayoutBindings)).join("")}</div>
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
