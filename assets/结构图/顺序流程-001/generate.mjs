import { buildSequentialProcess, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export { buildSequentialProcess };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "sequential-process-001", {
    title: content.title,
    steps: content.items.map((item, index) => ({
      title: item.title,
      body: item.body,
      points: item.points ?? [],
      emphasis: Boolean(item.emphasis),
      ...(item.emphasis ? {
        emphasisLabel: index === content.items.length - 1 ? "结论 / 结果" : "关键节点",
      } : {}),
    })),
  }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
}

await runGenerator(import.meta.url, buildSequentialProcess, {
  title: "顺序流程",
  steps: [
    { title: "需求确认", body: "明确目标、范围与输入" },
    { title: "方案设计", body: "形成结构和执行方案" },
    { title: "实施验证", body: "完成执行并检查结果" },
    { title: "复盘改进", body: "总结问题并持续优化" },
  ],
});
