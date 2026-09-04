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

function pointText(point) {
  return String(point?.text ?? point ?? "").trim();
}

function charCount(value) {
  return Array.from(String(value ?? "")).length;
}

function phaseBody(item) {
  return String(item?.body ?? "").trim();
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const items = selectedItems(content, compositionPage);
  if (items.length < 3 || items.length > 5) {
    throw new Error("阶段门禁流程要求选择 3–5 个连续阶段");
  }
  const missingGateEvidence = items.slice(0, -1).filter((item) => !pointText(item.points?.[0]));
  if (missingGateEvidence.length) {
    throw new Error(`阶段门禁流程缺少进入下一阶段的明确门禁条件：${missingGateEvidence.map((item) => item.id).join("、")}`);
  }
  const phases = items.map((item, index) => ({
    key: item.id,
    title: item.title,
    body: phaseBody(item),
    points: (index === items.length - 1 ? item.points ?? [] : (item.points ?? []).slice(1))
      .map(pointText)
      .filter(Boolean),
  }));
  const gates = items.slice(0, -1).map((item, index) => ({
    key: `gate-${item.id}-${items[index + 1].id}`,
    ...(charCount(pointText(item.points[0])) <= 6
      ? { title: pointText(item.points[0]), body: "" }
      : { title: "", body: pointText(item.points[0]) }),
  }));
  return renderPayload(
    intent,
    "sequence-phase-gates-004",
    { phases, gates },
    items.map((item, index) => mapping(item.id, `phases[${index}]`)),
  );
}
