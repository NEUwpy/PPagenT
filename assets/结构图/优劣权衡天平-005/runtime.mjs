import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function endpointText(endpoint) {
  return [endpoint?.title, endpoint?.body].map((value) => String(value ?? "").trim()).filter(Boolean).join("：");
}

export function mapPageContent(content, intent) {
  const structured = content?.structuredData;
  if (structured?.type !== "decision-tradeoff") {
    throw new Error("优劣权衡天平要求 PageContent.structuredData.type=decision-tradeoff");
  }
  const itemById = new Map((content.items ?? []).map((item) => [item.id, item]));
  const pros = structured.benefitIds.map((id) => itemById.get(id)?.title).filter(Boolean);
  const cons = structured.riskIds.map((id) => itemById.get(id)?.title).filter(Boolean);
  if (pros.length < 2 || pros.length > 4) throw new Error("优劣权衡天平要求 2–4 条收益");
  if (cons.length < 2 || cons.length > 4) throw new Error("优劣权衡天平要求 2–4 条代价或风险");
  const verdict = endpointText(structured.verdict);
  if (!verdict) throw new Error("优劣权衡天平要求原稿提供综合判断");
  return renderPayload(intent, "comparison-pros-cons-balance-005", {
    topic: content.title,
    pros,
    cons,
    verdict,
    balanceState: structured.balanceState,
  }, [
    ...structured.benefitIds.map((id, index) => mapping(id, `pros[${index}]`)),
    ...structured.riskIds.map((id, index) => mapping(id, `cons[${index}]`)),
  ]);
}
