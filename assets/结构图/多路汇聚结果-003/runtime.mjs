import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function selectedItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

function bodyOf(item) {
  return [item.body, ...(item.points ?? [])].map((value) => String(value ?? "").trim()).filter(Boolean).join("；");
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const items = selectedItems(content, compositionPage);
  if (items.length < 3 || items.length > 6) {
    throw new Error("多路汇聚结果要求选择 3–6 个同级输入节点");
  }
  const resultBody = (compositionPage?.componentText ?? []).find((item) => item.targetRole === "result-body")?.text ?? "";
  return renderPayload(intent, "convergence-many-to-one-003", {
    inputs: items.map((item) => ({ key: item.id, title: item.title, body: bodyOf(item) })),
    result: { title: content.title, body: resultBody },
  }, items.map((item, index) => mapping(item.id, `inputs[${index}]`)));
}
