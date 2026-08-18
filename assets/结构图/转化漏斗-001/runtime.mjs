import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function phaseAction(phase, queryById) {
  return {
    key: `${phase.id}-summary`,
    title: phase.title,
    body: phase.body,
    iconQuery: queryById.get(phase.id) ?? "settings action",
  };
}

export function mapPageContent(content, intent, _decision, _compositionPage, visualPage) {
  if (content.structuredData?.type !== "convergence") {
    throw new Error("阶段化输入转化漏斗需要 PageContent.structuredData.type=convergence");
  }
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const queryById = new Map(
    (visualPage?.iconQueries ?? []).map((item) => [item.sourceItemId, item.query]),
  );
  const inputs = content.structuredData.inputs.map((item) => ({
    key: item.id,
    label: item.label,
    iconQuery: queryById.get(item.id) ?? "",
  }));
  const phases = content.structuredData.phases.map((phase) => ({
    key: phase.id,
    label: phase.label,
    title: phase.title,
    body: phase.body,
    steps: phase.stepIds.map((stepId) => {
      const item = itemById.get(stepId);
      if (!item) throw new Error(`阶段 ${phase.id} 引用了不存在的转化节点 ${stepId}`);
      return { key: item.id, title: item.title };
    }),
    content: {
      layout: "icon-title-body-list-example",
      items: [phaseAction(phase, queryById)],
    },
  }));
  return renderPayload(intent, "convergence-funnel-001", {
    inputs,
    phases,
  }, [
    ...inputs.map((item, index) => mapping(item.key, `inputs[${index}]`)),
    ...phases.flatMap((phase, phaseIndex) => (
      phase.steps.map((step, stepIndex) => mapping(step.key, `phases[${phaseIndex}].steps[${stepIndex}]`))
    )),
  ]);
}
