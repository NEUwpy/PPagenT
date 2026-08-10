import assert from "node:assert/strict";
import test from "node:test";
import { createPresentation, buildGoalKpiMap, renderComponentIntoSlide } from "../src/asset-runtime/component-builders.mjs";
import { buildOrganizationTree, buildDualTrackRoadmap } from "../src/asset-runtime/history-organization-builders.mjs";
import { buildFishboneAnalysis, computeFishboneBranchStack } from "../src/asset-runtime/analysis-model-builders.mjs";
import { buildResearchMethodSummary } from "../src/asset-runtime/academic-model-builders.mjs";

const departments = (count, members) => Array.from({ length: count }, (_, index) => ({
  name: `部门${index + 1}`,
  head: `负责人${index + 1}`,
  members: Array.from({ length: members }, (_, memberIndex) => ({
    name: `成员${memberIndex + 1}`,
    role: `职责${memberIndex + 1}`,
  })),
}));
const kpiRows = (count, metrics) => Array.from({ length: count }, (_, index) => ({
  title: `单元${index + 1}`,
  body: "责任说明",
  metrics: Array.from({ length: metrics }, (_, metricIndex) => ({ value: `${metricIndex + 1}%`, label: "达成率" })),
  outcome: "结果贡献",
}));
const branches = (count, items) => Array.from({ length: count }, (_, index) => ({
  category: `原因${index + 1}`,
  items: Array.from({ length: items }, (_, itemIndex) => `因素${itemIndex + 1}`),
}));
const stages = (count) => Array.from({ length: count }, (_, index) => ({
  period: `${2025 + index}`,
  trackA: { title: `业务${index + 1}`, body: "业务变化" },
  trackB: { title: `技术${index + 1}`, body: "能力变化" },
}));
const dimensions = (count) => Array.from({ length: count }, (_, index) => ({
  name: `维度${index + 1}`,
  body: "方法说明",
}));
const researchParams = (count) => ({
  title: "研究方法",
  sectionTitle: "样本及数据收集",
  summary: "研究方法说明",
  sample: { value: "100", label: "发放样本" },
  response: { value: "80", label: "有效回收" },
  dimensions: dimensions(count),
});

test("batch 2 adaptive structure builders support declared minimum and maximum counts", () => {
  const deck = createPresentation();
  buildOrganizationTree(deck, { title: "org-min", leader: { name: "甲", role: "负责人" }, departments: departments(2, 1) });
  buildOrganizationTree(deck, { title: "org-max", leader: { name: "甲", role: "负责人" }, departments: departments(4, 3) });
  buildGoalKpiMap(deck, { title: "kpi-min", goal: "总目标", rows: kpiRows(3, 1), summary: "总结" });
  buildGoalKpiMap(deck, { title: "kpi-max", goal: "总目标", rows: kpiRows(5, 3), summary: "总结" });
  buildFishboneAnalysis(deck, { title: "fishbone-min", effect: "结果", branches: branches(4, 1) });
  buildFishboneAnalysis(deck, { title: "fishbone-max", effect: "结果", branches: branches(6, 4) });
  buildDualTrackRoadmap(deck, { title: "dual-min", trackA: "业务", trackB: "技术", stages: stages(3) });
  buildDualTrackRoadmap(deck, { title: "dual-max", trackA: "业务", trackB: "技术", stages: stages(5) });
  buildResearchMethodSummary(deck, researchParams(3));
  buildResearchMethodSummary(deck, researchParams(5));
  assert.equal(deck.slides.items.length, 10);
});

test("batch 2 adaptive structure builders fail closed outside declared ranges", () => {
  assert.throws(() => buildOrganizationTree(createPresentation(), {
    title: "x", leader: { name: "甲", role: "负责人" }, departments: departments(1, 1),
  }), /2–4/);
  assert.throws(() => buildOrganizationTree(createPresentation(), {
    title: "x", leader: { name: "甲", role: "负责人" }, departments: departments(2, 4),
  }), /1–3/);
  assert.throws(() => buildGoalKpiMap(createPresentation(), {
    title: "x", goal: "目标", rows: kpiRows(2, 1), summary: "总结",
  }), /3–5/);
  assert.throws(() => buildFishboneAnalysis(createPresentation(), {
    title: "x", effect: "结果", branches: branches(7, 1),
  }), /4–6/);
  assert.throws(() => buildDualTrackRoadmap(createPresentation(), {
    title: "x", trackA: "业务", trackB: "技术", stages: stages(2),
  }), /3–5/);
  assert.throws(() => buildResearchMethodSummary(createPresentation(), researchParams(6)), /3–5/);
});

test("dual-track roadmap requires both semantic tracks for every stage", () => {
  const invalidStages = stages(3);
  delete invalidStages[1].trackB;
  assert.throws(() => buildDualTrackRoadmap(createPresentation(), {
    title: "x", trackA: "业务", trackB: "技术", stages: invalidStages,
  }), /同时提供两条主线内容/);
});

test("fishbone upper and lower stacks mirror around the backbone", () => {
  for (const itemCount of [1, 4]) {
    const upper = computeFishboneBranchStack({ baseX: 410, itemCount, isUpper: true });
    const lower = computeFishboneBranchStack({ baseX: 410, itemCount, isUpper: false });
    upper.itemFrames.forEach((frame, index) => {
      const mirrored = lower.itemFrames[itemCount - 1 - index];
      assert.equal(frame.left, mirrored.left);
      assert.equal(2 * 374 - (frame.top + frame.height), mirrored.top);
    });
    assert.equal(upper.categoryFrame.left, lower.categoryFrame.left);
    assert.equal(
      2 * 374 - (upper.categoryFrame.top + upper.categoryFrame.height),
      lower.categoryFrame.top,
    );
  }
});

test("embedded candidates keep the Skin background and suppress standalone headings", async () => {
  const deck = createPresentation();
  const slide = deck.slides.add();
  slide.background.fill = "#FAFAFA";
  renderComponentIntoSlide(buildOrganizationTree, slide, {
    title: "不应重复出现的组件标题",
    leader: { name: "甲", role: "负责人" },
    departments: departments(2, 1),
  }, {
    sourceFrame: { left: 40, top: 135, width: 1200, height: 520 },
    targetFrame: { left: 55, top: 166, width: 1170, height: 492 },
    theme: { background: "#FFFFFF" },
  });
  const layout = await slide.export({ format: "layout" });
  const layoutText = await layout.text();
  const layoutJson = JSON.parse(layoutText);
  assert.equal(layoutJson.slide.backgroundColor, "#FAFAFA");
  assert.equal(layoutText.includes("不应重复出现的组件标题"), false);
  assert.equal(layoutText.includes("负责人"), true);
});
