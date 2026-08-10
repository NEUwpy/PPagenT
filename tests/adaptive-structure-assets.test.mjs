import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCycleLoop,
  buildFunnelConversion,
  buildHierarchyPyramid,
  buildRadialHub,
  buildTimelineRoadmap,
  createPresentation,
} from "../src/asset-runtime/component-builders.mjs";

const items = (count) => Array.from({ length: count }, (_, index) => ({ title: `方向${index + 1}`, body: "简短说明" }));
const steps = (count) => Array.from({ length: count }, (_, index) => ({ title: `步骤${index + 1}`, body: "简短说明" }));
const milestones = (count) => Array.from({ length: count }, (_, index) => ({ period: `${2025 + index}`, title: `阶段${index + 1}`, body: "简短说明" }));
const levels = (count) => Array.from({ length: count }, (_, index) => ({ title: `层级${index + 1}`, share: `${index + 1}`, body: "简短说明" }));
const stages = (count) => Array.from({ length: count }, (_, index) => ({ rate: `${100 - index * 10}%`, label: `阶段${index + 1}`, note: "简短说明" }));

test("第一批参数化结构能真实创建最小与最大数量页面", () => {
  const deck = createPresentation();
  buildRadialHub(deck, { title: "radial-min", center: "中心", items: items(3) });
  buildRadialHub(deck, { title: "radial-max", center: "中心", items: items(8) });
  buildCycleLoop(deck, { title: "cycle-min", center: "中心", steps: steps(3) });
  buildCycleLoop(deck, { title: "cycle-max", center: "中心", steps: steps(6) });
  buildTimelineRoadmap(deck, { title: "timeline-min", milestones: milestones(3) });
  buildTimelineRoadmap(deck, { title: "timeline-max", milestones: milestones(6) });
  buildHierarchyPyramid(deck, { title: "hierarchy-min", levels: levels(3) });
  buildHierarchyPyramid(deck, { title: "hierarchy-max", levels: levels(5) });
  buildFunnelConversion(deck, { title: "funnel-min", stages: stages(3) });
  buildFunnelConversion(deck, { title: "funnel-max", stages: stages(6) });
  assert.equal(deck.slides.items.length, 10);
});

test("第一批参数化结构对超出适用范围的数量失败关闭", () => {
  assert.throws(() => buildRadialHub(createPresentation(), { title: "x", center: "x", items: items(2) }), /3–8/);
  assert.throws(() => buildCycleLoop(createPresentation(), { title: "x", center: "x", steps: steps(7) }), /3–6/);
  assert.throws(() => buildTimelineRoadmap(createPresentation(), { title: "x", milestones: milestones(2) }), /3–6/);
  assert.throws(() => buildHierarchyPyramid(createPresentation(), { title: "x", levels: levels(6) }), /3–5/);
  assert.throws(() => buildFunnelConversion(createPresentation(), { title: "x", stages: stages(7) }), /3–6/);
});
