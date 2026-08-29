import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function text(value) {
  return String(value ?? "").trim();
}

export function mapPageContent(content, intent, _decision, _compositionPage, visualPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "problem-method-result") {
    throw new Error("因果机制链要求 PageContent.structuredData.type=problem-method-result");
  }
  if (!Array.isArray(structured.methodIds) || structured.methodIds.length < 2 || structured.methodIds.length > 4) {
    throw new Error("因果机制链要求 structuredData.methodIds 包含 2–4 个有序中介机制");
  }
  const itemById = new Map((content.items ?? []).map((item) => [item.id, item]));
  const iconQueryByItemId = new Map(
    (visualPage?.iconQueries ?? []).map((item) => [item.sourceItemId, item.query]),
  );
  const mediators = structured.methodIds.map((itemId, index) => {
    const item = itemById.get(itemId);
    if (!item) throw new Error(`因果机制链找不到中介机制条目：${itemId}`);
    return {
      key: itemId,
      title: text(item.title),
      body: text(item.body),
      iconQuery: iconQueryByItemId.get(itemId) ?? text(item.title),
    };
  });
  const parameters = {
    trigger: {
      title: text(structured.problem?.title),
      body: text(structured.problem?.body),
    },
    mediators,
    outcome: {
      title: text(structured.result?.title),
      body: text(structured.result?.body),
    },
  };
  const mappings = [
    ...structured.methodIds.map((itemId, index) => mapping(itemId, `mediators[${index}]`)),
  ];
  return renderPayload(intent, "causal-mediator-chain-003", parameters, mappings);
}
