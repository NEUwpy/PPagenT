import { buildFrameworkMatrix, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildFrameworkMatrix };
await runGenerator(import.meta.url, buildFrameworkMatrix, {
  title: "四象限分析框架",
  quadrants: [
    { title: "象限一", body: "填写本象限的判断依据、现状或行动建议。" },
    { title: "象限二", body: "填写本象限的判断依据、现状或行动建议。" },
    { title: "象限三", body: "填写本象限的判断依据、现状或行动建议。" },
    { title: "象限四", body: "填写本象限的判断依据、现状或行动建议。" }
  ]
});
