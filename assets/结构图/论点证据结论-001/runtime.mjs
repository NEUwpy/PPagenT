import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  argumentEvidenceVisualComponent,
  previewParameters,
  resolvePreviewParameters,
} from "./review.mjs";

export { argumentEvidenceVisualComponent, previewParameters, resolvePreviewParameters };

function selectedItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "argument-evidence") {
    throw new Error("论点证据结论要求 PageContent.structuredData.type=argument-evidence");
  }
  const allowedIds = new Set(structured.evidenceIds);
  const evidences = selectedItems(content, compositionPage)
    .filter((item) => allowedIds.has(item.id))
    .map((item) => ({ key: item.id, type: "", title: item.title, body: item.body }));
  if (evidences.length < 2 || evidences.length > 5) {
    throw new Error("论点证据结论要求选择 2–5 条证据");
  }
  return renderPayload(intent, "argument-evidence-conclusion-001", {
    claim: structured.claim,
    evidences,
    conclusion: structured.conclusion,
  }, evidences.map((item, index) => mapping(item.key, `evidences[${index}]`)));
}
