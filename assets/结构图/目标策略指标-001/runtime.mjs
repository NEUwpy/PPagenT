import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { visualComponent, previewParameters, resolvePreviewParameters } from "./review.mjs";

export { visualComponent, previewParameters, resolvePreviewParameters };

function selectedIds(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? ids : new Set(content.items.map((item) => item.id));
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "goal-strategy-metrics") {
    throw new Error("目标策略指标对齐要求 PageContent.structuredData.type=goal-strategy-metrics");
  }
  const ids = selectedIds(content, compositionPage);
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const strategies = structured.strategies
    .filter((strategy) => ids.has(strategy.id))
    .map((strategy) => {
      const item = itemById.get(strategy.id);
      if (!item) throw new Error(`目标策略指标对齐缺少 items 引用：${strategy.id}`);
      return {
        key: strategy.id,
        title: item.title,
        body: item.body,
        metrics: strategy.metrics,
      };
    });
  if (strategies.length < 2 || strategies.length > 4) throw new Error("目标策略指标对齐要求选择 2–4 项策略");
  return renderPayload(intent, "goal-alignment-strategy-metrics-001", {
    goal: structured.goal,
    strategies,
  }, strategies.map((strategy, index) => mapping(strategy.key, `strategies[${index}]`)));
}
