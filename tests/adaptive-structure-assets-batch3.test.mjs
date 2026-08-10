import assert from "node:assert/strict";
import test from "node:test";
import { createPresentation } from "../src/asset-runtime/component-builders.mjs";
import {
  buildConclusionBands,
  buildConcentricCapabilitySystem,
  buildTechnicalRouteFlow,
  buildTheoryIntegrationFramework,
} from "../src/asset-runtime/academic-model-builders.mjs";
import { buildEndToEndOperations } from "../src/asset-runtime/operating-model-builders.mjs";

const technical = (branches, inputs) => ({
  title: "技术路线", startLabel: "开始", question: "问题", objective: "目标",
  branches: Array.from({ length: branches }, (_, index) => `分支${index + 1}`),
  core: "共同模型", inputs: Array.from({ length: inputs }, (_, index) => `输入${index + 1}`),
  analysis: "分析", result: "结果",
});
const sections = (count, points) => Array.from({ length: count }, (_, index) => ({
  name: `结论${index + 1}`,
  points: Array.from({ length: points }, (_, pointIndex) => `要点${pointIndex + 1}`),
}));
const domains = (count) => Array.from({ length: count }, (_, index) => ({ name: `理论${index + 1}`, body: "理论说明" }));
const operations = (stageCount, nodeCount, pillarCount, tagCount) => ({
  title: "全链路运营",
  stages: Array.from({ length: stageCount }, (_, index) => `阶段${index + 1}`),
  centerLabel: "运营平台",
  nodes: Array.from({ length: nodeCount }, (_, index) => `节点${index + 1}`),
  leftFlow: "计划",
  rightFlow: "运营",
  pillars: Array.from({ length: pillarCount }, (_, index) => ({
    title: `支柱${index + 1}`,
    body: "支柱说明",
    items: Array.from({ length: tagCount }, (_, tagIndex) => `标签${tagIndex + 1}`),
  })),
});

test("batch 3 adaptive structure builders support declared minimum and maximum counts", () => {
  const deck = createPresentation();
  buildTechnicalRouteFlow(deck, technical(2, 1));
  buildTechnicalRouteFlow(deck, technical(4, 3));
  buildConclusionBands(deck, { title: "min", sections: sections(2, 1) });
  buildConclusionBands(deck, { title: "max", sections: sections(4, 4) });
  buildConcentricCapabilitySystem(deck, { title: "min", center: "核心", capabilities: ["一", "二", "三", "四"] });
  buildConcentricCapabilitySystem(deck, { title: "max", center: "核心", capabilities: ["一", "二", "三", "四", "五", "六", "七", "八"] });
  buildTheoryIntegrationFramework(deck, { title: "min", domains: domains(3), criteria: ["一", "二", "三"] });
  buildTheoryIntegrationFramework(deck, { title: "max", domains: domains(4), criteria: ["一", "二", "三", "四", "五"] });
  buildEndToEndOperations(deck, operations(3, 4, 3, 2));
  buildEndToEndOperations(deck, operations(4, 7, 5, 4));
  assert.equal(deck.slides.items.length, 10);
});

test("batch 3 adaptive structure builders fail closed outside declared ranges", () => {
  assert.throws(() => buildTechnicalRouteFlow(createPresentation(), technical(1, 1)), /2–4/);
  assert.throws(() => buildTechnicalRouteFlow(createPresentation(), technical(2, 4)), /1–3/);
  assert.throws(() => buildConclusionBands(createPresentation(), { title: "x", sections: sections(5, 1) }), /2–4/);
  assert.throws(() => buildConclusionBands(createPresentation(), { title: "x", sections: sections(2, 5) }), /1–4/);
  assert.throws(() => buildConcentricCapabilitySystem(createPresentation(), { title: "x", center: "x", capabilities: ["一", "二", "三"] }), /4–8/);
  assert.throws(() => buildTheoryIntegrationFramework(createPresentation(), { title: "x", domains: domains(2), criteria: ["一", "二", "三"] }), /3–4/);
  assert.throws(() => buildTheoryIntegrationFramework(createPresentation(), { title: "x", domains: domains(3), criteria: ["一", "二"] }), /3–5/);
  assert.throws(() => buildEndToEndOperations(createPresentation(), operations(2, 4, 3, 2)), /3–4/);
  assert.throws(() => buildEndToEndOperations(createPresentation(), operations(3, 8, 3, 2)), /4–7/);
  assert.throws(() => buildEndToEndOperations(createPresentation(), operations(3, 4, 6, 2)), /3–5/);
  assert.throws(() => buildEndToEndOperations(createPresentation(), operations(3, 4, 3, 5)), /2–4/);
});
