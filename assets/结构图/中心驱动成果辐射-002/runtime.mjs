import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { previewParameters, resolvePreviewParameters, visualComponent } from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function bodyOf(item) {
  return [item?.body, ...(item?.points ?? []).map((point) => point?.text ?? point)].filter(Boolean).join("；");
}

function connectionMode(intent) {
  if (intent?.relationTraits?.converging) return "inward";
  if (intent?.purposeKey === "explain_impact") return "outward";
  return "none";
}

export function mapPageContent(content, intent, _decision, compositionPage, visualPage) {
  const centerBinding = (compositionPage?.componentText ?? []).find((item) => item.targetRole === "center-title");
  const centerTitle = visualPage?.centerLabel ?? centerBinding?.text ?? content.title;
  const nodes = (content.items ?? []).map((item) => ({
    title: item.title,
    body: bodyOf(item),
  }));
  if (nodes.length < 3 || nodes.length > 6) throw new Error("中心径向关系要求 3–6 个外围节点");
  return renderPayload(intent, "hub-directed-outcomes-002", {
    connectionMode: connectionMode(intent),
    center: { title: centerTitle, body: "" },
    nodes,
  }, nodes.map((_, index) => mapping(content.items[index].id, `nodes[${index}]`)));
}
