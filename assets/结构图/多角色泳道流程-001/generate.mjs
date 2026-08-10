import { buildSwimlaneProcess, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildSwimlaneProcess };
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
