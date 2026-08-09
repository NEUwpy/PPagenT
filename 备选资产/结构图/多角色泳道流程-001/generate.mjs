import { buildSwimlaneProcess, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildSwimlaneProcess };
await runGenerator(import.meta.url, buildSwimlaneProcess, {
  title: "多角色泳道流程",
  lanes: ["角色 A", "角色 B", "角色 C"],
  stages: ["准备", "执行", "交付", "验收"],
  tasks: [
    { lane: 0, stage: 0, label: "提出需求" },
    { lane: 1, stage: 0, label: "审核需求" },
    { lane: 2, stage: 1, label: "执行任务" },
    { lane: 1, stage: 2, label: "复核结果" },
    { lane: 0, stage: 3, label: "完成验收" }
  ]
});
