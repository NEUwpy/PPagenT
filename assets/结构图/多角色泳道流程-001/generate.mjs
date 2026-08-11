import { buildSwimlaneProcess, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
export { buildSwimlaneProcess };

function roleAndStage(title, index) {
  const value = String(title ?? "").trim();
  const responsible = value.match(/^(.+?)负责(.+)$/);
  if (responsible) return { role: responsible[1].trim(), stage: responsible[2].trim() };
  const separated = value.match(/^(.+?)[：:\-—](.+)$/);
  if (separated) return { role: separated[1].trim(), stage: separated[2].trim() };
  return { role: `角色 ${index + 1}`, stage: value || `阶段 ${index + 1}` };
}

export function mapPageContent(content, intent) {
  const conclusion = content.items.find((item) => item.emphasis);
  const roles = content.items.filter((item) => item !== conclusion);
  const parsed = roles.map((item, index) => roleAndStage(item.title, index));
  return renderPayload(intent, "swimlane-process-001", {
    title: content.title,
    lanes: parsed.map((item) => item.role),
    stages: parsed.map((item) => item.stage),
    tasks: roles.map((item, index) => ({ lane: index, stage: index, label: item.body || item.title })),
    conclusion: conclusion ? conclusion.body || conclusion.title : "",
  }, [
    ...roles.map((item, index) => mapping(item.id, `tasks[${index}]`)),
    ...(conclusion ? [mapping(conclusion.id, "conclusion")] : []),
  ]);
}

await runGenerator(import.meta.url, buildSwimlaneProcess, {
  title: "AI、规则与代码如何协同",
  lanes: ["AI", "规则", "代码"],
  stages: ["理解", "决定", "执行"],
  tasks: [
    { lane: 0, stage: 0, label: "读取稿件并判断重点与关系" },
    { lane: 1, stage: 1, label: "判断版式、容量与拆页边界" },
    { lane: 2, stage: 2, label: "稳定生成原生可编辑文件" }
  ],
  conclusion: "AI 读懂稿子，然后调用人已经提前做好的好东西。"
});
