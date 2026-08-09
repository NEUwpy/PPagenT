import { buildExperienceLayerModel, runGenerator } from "../../../src/asset-runtime/operating-model-builders.mjs";

export { buildExperienceLayerModel };

await runGenerator(import.meta.url, buildExperienceLayerModel, {
  title: "服务体验三层模型",
  center: "整体体验",
  domains: [
    { name: "认知层", items: ["对象", "关系", "角色", "权限"], description: "用户如何理解对象、关系和规则，以及是否形成稳定认知。", metric: "认知准确率 85%" },
    { name: "行为层", items: ["操作", "链路", "场景", "反馈"], description: "用户在不同场景中完成任务时的步骤、成本和反馈。", metric: "关键任务完成率 92%" },
    { name: "感知层", items: ["状态", "趋势", "速度", "稳定"], description: "用户对速度、稳定性和结果状态形成的主观感受。", metric: "体验满意度 90%" }
  ]
});
