import assert from "node:assert/strict";
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
    "comparison-dual-verdict-001",
    "convergence-funnel-001",
    "convergence-simple-funnel-001",
    "cycle-loop-001",
    "hierarchy-people-tree-001",
    "hub-radial-001",
    "layered-architecture-001",
    "parallel-equal-cards-001",
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
    ["convergence-staged-funnel", "convergence-simple-funnel"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "convergence",
      baseRelation: "convergence",
      purposeKey: "explain_conversion",
      itemCount: 4,
      structuredDataType: undefined,
    }).map((variant) => variant.structureGroupId),
    ["convergence-simple-funnel"],
  );
});

test("运行时登记当前核心结构资产", async () => {
  const builders = await listStructureAssetBuilders();
  assert.deepEqual(builders.defaultAssetIds, [
    "comparison-dual-verdict-001",
    "convergence-funnel-001",
    "convergence-simple-funnel-001",
    "cycle-loop-001",
    "hierarchy-people-tree-001",
    "hub-radial-001",
    "layered-architecture-001",
    "parallel-equal-cards-001",
    "sequence-flow-001",
  ]);
  assert.deepEqual(builders.variantBuilderKeys, [
    "comparison-dual-verdict-001:dual-verdict-mirror",
    "convergence-funnel-001:staged-input-content-funnel",
    "convergence-simple-funnel-001:input-steps-only",
    "cycle-loop-001:default",
    "hierarchy-people-tree-001:three-level-portraits",
    "hub-radial-001:balanced-orbit-anchor",
    "layered-architecture-001:curved-frustum-stack",
    "parallel-equal-cards-001:equal-floating-cards",
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
});
