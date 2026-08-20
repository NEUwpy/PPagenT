import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export const problemSolutionVisualComponent = new URL(import.meta.url).searchParams.has("dashboard")
  ? undefined
  : visualComponent;

function selectedIds(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? ids : new Set(content.items.map((item) => item.id));
}

function centerTitle(content, compositionPage, fallback) {
  return (compositionPage?.componentText ?? [])
    .find((entry) => entry.sourceField === "page-title" && entry.targetRole === "center-title")
    ?.text ?? fallback ?? content.title;
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "problem-solution") {
    throw new Error("问题方案结果要求 PageContent.structuredData.type=problem-solution");
  }
  const ids = selectedIds(content, compositionPage);
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const pairs = structured.pairs
    .filter((pair) => ids.has(pair.id))
    .map((pair) => {
      const item = itemById.get(pair.id);
      return {
        key: pair.id,
        problem: {
          title: item?.title || pair.problem.title,
          body: item?.body || pair.problem.body || "",
        },
        solution: {
          title: pair.solution.title,
          body: pair.solution.body || "",
        },
      };
    });
  if (pairs.length < 2 || pairs.length > 4) {
    throw new Error("问题方案结果要求选择 2–4 组问题方案");
  }
  return renderPayload(intent, "problem-solution-outcome-001", {
    pairs,
    outcome: {
      title: centerTitle(content, compositionPage, structured.outcome.title),
      highlight: structured.outcome.highlight || "",
      body: structured.outcome.body || "",
    },
  }, pairs.map((pair, index) => mapping(pair.key, `pairs[${index}]`)));
}
