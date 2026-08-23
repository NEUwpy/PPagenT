import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  branchingDecisionVisualComponent,
  previewParameters,
  resolvePreviewParameters,
} from "./review.mjs";

export { branchingDecisionVisualComponent, previewParameters, resolvePreviewParameters };

function selectedIds(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? ids : new Set(content.items.map((item) => item.id));
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "branching-decision") {
    throw new Error("分支决策路径要求 PageContent.structuredData.type=branching-decision");
  }
  const ids = selectedIds(content, compositionPage);
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const branches = structured.branches
    .filter((branch) => ids.has(branch.id))
    .map((branch) => {
      const item = itemById.get(branch.id);
      if (!item) throw new Error(`分支决策路径缺少 items 引用：${branch.id}`);
      return {
        key: branch.id,
        condition: branch.condition,
        title: item.title,
        body: item.body || "",
        outcome: branch.outcome || "",
      };
    });
  if (branches.length < 2 || branches.length > 4) {
    throw new Error("分支决策路径要求选择 2–4 条路径");
  }
  return renderPayload(intent, "branching-decision-routes-001", {
    context: structured.context,
    decision: structured.decision,
    branches,
  }, branches.map((branch, index) => mapping(branch.key, `branches[${index}]`)));
}
