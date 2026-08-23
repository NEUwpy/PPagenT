import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  problemMethodVisualComponent,
  resolvePreviewParameters,
} from "./review.mjs";

export { previewParameters, problemMethodVisualComponent, resolvePreviewParameters };

function selectedItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "problem-method-result") {
    throw new Error("问题方法结果要求 PageContent.structuredData.type=problem-method-result");
  }
  const allowedIds = new Set(structured.methodIds);
  const methods = selectedItems(content, compositionPage)
    .filter((item) => allowedIds.has(item.id))
    .map((item) => ({ key: item.id, type: "", title: item.title, body: item.body }));
  if (methods.length < 2 || methods.length > 5) {
    throw new Error("问题方法结果要求选择 2–5 项方法");
  }
  return renderPayload(intent, "problem-method-result-001", {
    problem: structured.problem,
    methods,
    result: structured.result,
  }, methods.map((item, index) => mapping(item.key, `methods[${index}]`)));
}
