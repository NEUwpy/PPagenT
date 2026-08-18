import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function inputParameters(content, visualPage) {
  if (content.structuredData?.type !== "convergence") return [];
  const queryById = new Map(
    (visualPage?.iconQueries ?? []).map((item) => [item.sourceItemId, item.query]),
  );
  return content.structuredData.inputs.map((item) => ({
    key: item.id,
    label: item.label,
    iconQuery: queryById.get(item.id) ?? "",
  }));
}

export function mapPageContent(content, intent, _decision, _compositionPage, visualPage) {
  const inputs = inputParameters(content, visualPage);
  const steps = content.items.map((item) => ({ key: item.id, title: item.title }));
  return renderPayload(intent, "convergence-simple-funnel-001", {
    inputs,
    steps,
  }, [
    ...inputs.map((item, index) => mapping(item.key, `inputs[${index}]`)),
    ...steps.map((item, index) => mapping(item.key, `steps[${index}]`)),
  ]);
}
