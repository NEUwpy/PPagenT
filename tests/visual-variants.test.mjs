import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { computeContainedFrame } from "../src/asset-runtime/contained-frame.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university-contract.mjs";
import { listStructureAssetBuilders } from "../src/runtime/assets.mjs";
import {
  mapPageContent as mapSimpleFunnelPageContent,
  visualComponent as simpleFunnelComponent,
} from "../assets/结构图/简明转化漏斗-001/runtime.mjs";
import {
  mapPageContent as mapStagedFunnelPageContent,
  visualComponent as stagedFunnelComponent,
} from "../assets/结构图/转化漏斗-001/runtime.mjs";
import { mapPageContent as mapComparisonPageContent } from "../assets/结构图/双向对比-001/runtime.mjs";
import { mapPageContent as mapTradeoffPageContent } from "../assets/结构图/优劣权衡天平-005/runtime.mjs";
import {
  listRenderableVisualVariants,
  planVisualVariants,
  queryVisualVariants,
} from "../src/selection/visual-variants.mjs";

const root = process.cwd();

test("东北大学主题以等比例 contain 承载正文组件", () => {
  const source = northeasternUniversitySkin.componentSourceFrame;
  const target = northeasternUniversitySkin.bodyFrame;
  const fitted = computeContainedFrame(source, target);
  assert.ok(fitted.width <= target.width);
  assert.ok(fitted.height <= target.height);
  assert.equal(fitted.scale, Math.min(target.width / source.width, target.height / source.height));
});

test("正式结构候选来自当前核心 HTML 资产包", async () => {
  const variants = await listRenderableVisualVariants({ root });
  const structural = variants.filter((variant) => variant.renderer !== "skin");
  assert.deepEqual(structural.map((variant) => variant.assetId), [
    "argument-evidence-conclusion-001",
    "branching-decision-routes-001",
    "causal-fishbone-attribution-001",
    "comparison-pros-cons-balance-005",
    "comparison-dual-verdict-001",
    "containment-multi-set-intersection-001",
    "convergence-many-to-one-003",
    "convergence-funnel-001",
    "convergence-simple-funnel-001",
    "cycle-racetrack-loop-005",
    "cycle-single-chain-feedback-002",
    "cycle-loop-001",
    "goal-alignment-strategy-metrics-001",
    "hierarchy-people-tree-001",
    "hub-radial-001",
    "layered-iceberg-depth-006",
    "layered-architecture-001",
    "matrix-quadrant-priority-001",
    "network-internal-external-ecosystem-001",
    "parallel-equal-cards-001",
    "problem-method-result-001",
    "problem-solution-outcome-001",
    "progression-spectrum-focus-001",
    "role-stage-collaboration-001",
    "sequence-flow-001",
  ]);
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "cycle",
      structureGroupId: "cycle-pdca-ring-p57",
      baseRelation: "sequence",
      itemCount: 4,
    }).map((variant) => variant.variantId),
    ["default"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, { logicId: "cycle", itemCount: 7 }),
    [],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "convergence",
      baseRelation: "convergence",
      purposeKey: "explain_conversion",
      itemCount: 4,
      structuredDataType: "convergence",
    }).map((variant) => variant.structureGroupId),
    ["convergence-many-to-one", "convergence-staged-funnel", "convergence-simple-funnel"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "convergence",
      baseRelation: "convergence",
      purposeKey: "explain_conversion",
      itemCount: 4,
      structuredDataType: undefined,
    }).map((variant) => variant.structureGroupId),
    ["convergence-many-to-one", "convergence-simple-funnel"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "problem-solution",
      baseRelation: "composite",
      purposeKey: "connect_problems_and_solutions",
      itemCount: 3,
      structuredDataType: "problem-solution",
    }).map((variant) => variant.structureGroupId),
    ["problem-solution-outcome"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "matrix",
      baseRelation: "matrix",
      purposeKey: "organize_matrix",
      itemCount: 7,
      structuredDataType: "matrix",
    }).map((variant) => variant.structureGroupId),
    ["matrix-quadrant-priority"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "containment",
      baseRelation: "intersection",
      purposeKey: "explain_shared_scope",
      itemCount: 3,
      structuredDataType: "multi-set-common-intersection",
    }).map((variant) => variant.structureGroupId),
    ["containment-multi-set-intersection"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "network",
      baseRelation: "network",
      purposeKey: "explain_internal_external_ecosystem",
      itemCount: 6,
      structuredDataType: "internal-external-ecosystem",
    }).map((variant) => variant.structureGroupId),
    ["network-internal-external-ecosystem"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "comparison", baseRelation: "comparison", purposeKey: "compare_options",
      itemCount: 2, pointCounts: [0, 0],
    }),
    [],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "comparison", baseRelation: "comparison", purposeKey: "compare_options",
      itemCount: 2, pointCounts: [3, 3],
    }).map((variant) => variant.assetId),
    ["comparison-dual-verdict-001"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "comparison", baseRelation: "comparison", purposeKey: "compare_options",
      itemCount: 6, structuredDataType: "decision-tradeoff",
    }).map((variant) => variant.assetId),
    ["comparison-pros-cons-balance-005"],
  );
});

test("运行时登记当前核心结构资产", async () => {
  const builders = await listStructureAssetBuilders();
  assert.deepEqual(builders.defaultAssetIds, [
    "argument-evidence-conclusion-001",
    "branching-decision-routes-001",
    "causal-fishbone-attribution-001",
    "comparison-dual-verdict-001",
    "comparison-pros-cons-balance-005",
    "containment-multi-set-intersection-001",
    "convergence-funnel-001",
    "convergence-many-to-one-003",
    "convergence-simple-funnel-001",
    "cycle-loop-001",
    "cycle-racetrack-loop-005",
    "cycle-single-chain-feedback-002",
    "goal-alignment-strategy-metrics-001",
    "hierarchy-people-tree-001",
    "hub-radial-001",
    "layered-architecture-001",
    "layered-iceberg-depth-006",
    "matrix-quadrant-priority-001",
    "network-internal-external-ecosystem-001",
    "parallel-equal-cards-001",
    "problem-method-result-001",
    "problem-solution-outcome-001",
    "progression-spectrum-focus-001",
    "role-stage-collaboration-001",
    "sequence-flow-001",
  ]);
  assert.deepEqual(builders.variantBuilderKeys, [
    "argument-evidence-conclusion-001:proof-stack-1n1",
    "branching-decision-routes-001:single-decision-fanout",
    "causal-fishbone-attribution-001:fishbone-attribution",
    "comparison-dual-verdict-001:dual-verdict-mirror",
    "comparison-pros-cons-balance-005:geometric-balance-with-verdict",
    "containment-multi-set-intersection-001:multi-set-common-core",
    "convergence-funnel-001:staged-input-content-funnel",
    "convergence-many-to-one-003:multiple-lanes-merge-to-output",
    "convergence-simple-funnel-001:input-steps-only",
    "cycle-loop-001:default",
    "cycle-racetrack-loop-005:racetrack-loop",
    "cycle-single-chain-feedback-002:single-chain-return-control",
    "goal-alignment-strategy-metrics-001:typographic-goal-strategy-field-with-metric-band",
    "hierarchy-people-tree-001:three-level-portraits",
    "hub-radial-001:balanced-orbit-anchor",
    "layered-architecture-001:curved-frustum-stack",
    "layered-iceberg-depth-006:faceted-geometric-iceberg",
    "matrix-quadrant-priority-001:axis-bubble-quadrant",
    "network-internal-external-ecosystem-001:dual-domain-network-with-shared-core",
    "parallel-equal-cards-001:equal-floating-cards",
    "problem-method-result-001:research-1n1",
    "problem-solution-outcome-001:paired-convergence",
    "progression-spectrum-focus-001:ordered-regions-with-focus",
    "role-stage-collaboration-001:continuous-stage-role-swimlane",
    "sequence-flow-001:continuous-numbered-rail",
  ]);
});

test("漏斗输入使用单一圆内标记槽，图标可选且文字可回退", () => {
  const content = {
    pageId: "p1",
    title: "输入转化",
    items: [
      { id: "s1", title: "触达", body: "接触对象" },
      { id: "s2", title: "识别", body: "识别意向" },
      { id: "s3", title: "转化", body: "形成行动" },
    ],
    structuredData: {
      type: "convergence",
      inputs: [{ id: "i1", label: "客户" }],
      phases: [
        { id: "p1", label: "阶段一", title: "获取识别", body: "对象进入体系", stepIds: ["s1", "s2"] },
        { id: "p2", label: "阶段二", title: "行动转化", body: "意向形成行动", stepIds: ["s3"] },
      ],
    },
  };
  const intent = { intentId: "intent-1" };
  const visualPage = { iconQueries: [] };
  const simple = mapSimpleFunnelPageContent(content, intent, null, null, visualPage);
  const staged = mapStagedFunnelPageContent(content, intent, null, null, visualPage);
  assert.equal(simple.parameters.inputs[0].label, "客户");
  assert.equal(simple.parameters.inputs[0].iconQuery, "");
  assert.equal(staged.parameters.inputs[0].label, "客户");
  assert.equal(staged.parameters.inputs[0].iconQuery, "");

  const simpleHtml = simpleFunnelComponent.renderMarkup(simple.parameters);
  const stagedHtml = stagedFunnelComponent.renderMarkup(staged.parameters);
  assert.match(simpleHtml, /simple-input-marker-text/);
  assert.doesNotMatch(simpleHtml, /simple-input-label/);
  assert.match(stagedHtml, /funnel-input-text/);
});

test("两个漏斗的同级阶段标题使用统一字号", async () => {
  const styles = await Promise.all([
    fs.readFile(new URL("../assets/结构图/简明转化漏斗-001/component.css", import.meta.url), "utf8"),
    fs.readFile(new URL("../assets/结构图/转化漏斗-001/component.css", import.meta.url), "utf8"),
  ]);
  for (const css of styles) {
    assert.match(css, /font-size:\s*var\(--ppagent-funnel-step-title-size,\s*15pt\)/);
    assert.doesNotMatch(css, /data-step-count="6"[^}]*step-title/);
  }
});

test("视觉导演仍需明确选择循环闭环 Structure Group", async () => {
  const variants = (await listRenderableVisualVariants({ root }))
    .filter((variant) => variant.renderer !== "skin");
  const missing = planVisualVariants([
    { pageId: "p1", logicId: "cycle", baseRelation: "sequence", itemCount: 4 },
  ], { variants });
  assert.equal(missing.status, "needs-director-revision");

  const accepted = planVisualVariants([
    {
      pageId: "p1",
      logicId: "cycle",
      baseRelation: "sequence",
      itemCount: 4,
      visualStructureGroupId: "cycle-pdca-ring-p57",
    },
  ], { variants });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.results[0].assetId, "cycle-loop-001");

  const pointBased = planVisualVariants([
    {
      pageId: "comparison",
      logicId: "comparison",
      baseRelation: "comparison",
      purposeKey: "compare_options",
      itemCount: 2,
      pointCounts: [3, 3],
      visualStructureGroupId: "comparison-dual-verdict",
    },
    {
      pageId: "layered",
      logicId: "layered",
      baseRelation: "layered",
      purposeKey: "explain_layers",
      itemCount: 3,
      pointCounts: [4, 2, 4],
      visualStructureGroupId: "layered-curved-frustums",
    },
  ], { variants });
  assert.equal(pointBased.status, "accepted");
  assert.deepEqual(pointBased.results.map((result) => result.assetId), [
    "comparison-dual-verdict-001",
    "layered-architecture-001",
  ]);
});

test("双向对比的一侧标为重点时另一侧自动成为负向", () => {
  const payload = mapComparisonPageContent({
    title: "稳定与偶然",
    items: [
      { id: "stable", title: "稳定可用", emphasis: true, points: ["可靠", "可改", "可复用"] },
      { id: "random", title: "偶然惊艳", points: ["随机", "昂贵", "难复用"] },
    ],
  }, { intentId: "comparison-intent" });
  assert.deepEqual(payload.parameters.sides.map((side) => side.tone), ["positive", "negative"]);
});

test("优劣权衡天平只映射原稿明确分组和结论", () => {
  const payload = mapTradeoffPageContent({
    title: "是否采用 HTML 作为单一布局源",
    items: [
      { id: "b1", title: "结果可审核" }, { id: "b2", title: "布局可编译" }, { id: "b3", title: "运行期更稳定" },
      { id: "r1", title: "样式需约束" }, { id: "r2", title: "依赖需声明" }, { id: "r3", title: "边界需完善" },
    ],
    structuredData: {
      type: "decision-tradeoff",
      benefitIds: ["b1", "b2", "b3"],
      riskIds: ["r1", "r2", "r3"],
      verdict: { title: "收益更具长期价值", body: "但必须保留明确失败边界" },
      balanceState: "收益侧更重",
    },
  }, { intentId: "tradeoff-intent" });
  assert.deepEqual(payload.parameters.pros, ["结果可审核", "布局可编译", "运行期更稳定"]);
  assert.deepEqual(payload.parameters.cons, ["样式需约束", "依赖需声明", "边界需完善"]);
  assert.equal(payload.parameters.balanceState, "收益侧更重");
});
