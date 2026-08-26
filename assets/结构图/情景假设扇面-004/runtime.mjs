import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function selectedIds(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? ids : new Set(content.items.map((item) => item.id));
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "branching-scenario") {
    throw new Error("情景假设扇面要求 PageContent.structuredData.type=branching-scenario");
  }
  const ids = selectedIds(content, compositionPage);
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const scenarios = structured.scenarios
    .filter((scenario) => ids.has(scenario.id))
    .map((scenario) => {
      const item = itemById.get(scenario.id);
      if (!item) throw new Error(`情景假设扇面缺少 items 引用：${scenario.id}`);
      return {
        key: scenario.id,
        title: item.title,
        trigger: scenario.trigger,
        outcome: scenario.outcome,
      };
    });
  if (scenarios.length < 3 || scenarios.length > 5) {
    throw new Error("情景假设扇面要求选择 3–5 个情景");
  }
  return renderPayload(intent, "branching-scenario-fan-004", {
    assumption: structured.assumption,
    scenarios,
  }, scenarios.map((scenario, index) => mapping(scenario.key, `scenarios[${index}]`)));
}
