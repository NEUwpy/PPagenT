import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { visualComponent, previewParameters, resolvePreviewParameters } from "./review.mjs";

export { visualComponent, previewParameters, resolvePreviewParameters };

function selectedIds(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? ids : new Set(content.items.map((item) => item.id));
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "role-stage") throw new Error("阶段角色协同要求 PageContent.structuredData.type=role-stage");
  const ids = selectedIds(content, compositionPage);
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const stageOrder = new Map(structured.stages.map((stage, index) => [stage.id, index]));
  const tasks = structured.assignments
    .filter((assignment) => ids.has(assignment.id))
    .map((assignment) => {
      const item = itemById.get(assignment.id);
      if (!item) throw new Error(`阶段角色协同缺少 items 引用：${assignment.id}`);
      return {
        key: assignment.id,
        stageKey: assignment.stageId,
        roleKey: assignment.roleId,
        title: item.title,
        body: item.body,
      };
    })
    .sort((left, right) => stageOrder.get(left.stageKey) - stageOrder.get(right.stageKey));
  if (tasks.length < 3 || tasks.length > 8) throw new Error("阶段角色协同要求选择 3–8 项任务");
  return renderPayload(intent, "role-stage-collaboration-001", {
    stages: structured.stages.map(({ id, title }) => ({ key: id, title })),
    roles: structured.roles.map(({ id, name }) => ({ key: id, name })),
    tasks,
  }, tasks.map((task, index) => mapping(task.key, `tasks[${index}]`)));
}
