import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { computeContainedFrame } from "../src/asset-runtime/contained-frame.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university-contract.mjs";
import { listStructureAssetBuilders } from "../src/runtime/assets.mjs";
import { discoverCoreAssetPackages } from "../src/runtime/core-asset-packages.mjs";
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
  mapPageContent as mapPhaseGatePageContent,
  visualComponent as phaseGateComponent,
} from "../assets/结构图/阶段门禁流程-004/runtime.mjs";
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
  // 期望集合真源：discoverCoreAssetPackages 从 catalog/logic-map.json 与各资产 asset.json
  // 推导出的核心资产包（同理见 src/selection/visual-variants.mjs 的 loadCoreAssetIds），
  // 剔除 skin 渲染器——皮肤是页面外壳，不是结构候选。这里只固化「集合」，
  // 不固化展示顺序：顺序由 loadVisualVariantCatalog 的 familyId 排序负责。
  const coreStructureAssetIds = (await discoverCoreAssetPackages(root))
    .filter((item) => item.runtime.renderer !== "skin")
    .map((item) => item.assetId);
  const byAssetId = (left, right) => left.localeCompare(right);
  assert.deepEqual(
    structural.map((variant) => variant.assetId).sort(byAssetId),
    coreStructureAssetIds.sort(byAssetId),
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "branching",
      baseRelation: "branching",
      purposeKey: "route_by_condition",
      itemCount: 4,
      structuredDataType: "branching-scenario",
    }).map((variant) => variant.structureGroupId),
    ["branching-scenario-fan"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "cycle",
      structureGroupId: "cycle-pdca-ring-p57",
      // 真源：assets/结构图/循环闭环-001/asset.json 的 runtime.supportedBaseRelations = ["cycle"]，
      // 且 catalog/logic-map.json 把 cycle-loop-001 归在 logicId "cycle" 下（sequence 另有自己的资产）。
      baseRelation: "cycle",
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
    ["containment-consensus-field", "containment-multi-set-intersection"],
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
      itemCount: 2, pointCounts: [3, 3], polarities: ["negative", "positive"],
    }).map((variant) => variant.assetId),
    ["comparison-dual-verdict-001"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "comparison", baseRelation: "comparison", purposeKey: "compare_options",
      itemCount: 2, pointCounts: [3, 3], polarities: ["positive", "neutral"],
    }),
    [],
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
  // 期望集合真源：discoverCoreAssetPackages（catalog/logic-map.json + 各资产 asset.json）。
  // listStructureSkills 的筛选口径是 status==="core" 且 runtime.logicId 存在且 renderer!=="skin"；
  // 当前全部非 skin 核心包都带 logicId，故两者等价，这里以更严格的发现结果为准。
  // listStructureSkills 自身按 assetId 升序返回，故此处同时校验顺序。
  // （原断言重复硬编码了 35 项清单，既有已撤回的 hierarchy-people-tree-001，
  //   又缺 5 个已晋升资产，资产增减时不会自动跟上。）
  const coreStructurePackages = (await discoverCoreAssetPackages(root))
    .filter((item) => item.runtime.renderer !== "skin");
  assert.deepEqual(
    builders.defaultAssetIds,
    coreStructurePackages.map((item) => item.assetId),
  );
  assert.deepEqual(
    builders.variantBuilderKeys,
    coreStructurePackages.map((item) => `${item.assetId}:${item.runtime.variantId}`),
  );
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

test("阶段门禁流程公开通用分点容量并把较长门禁文字放入正文槽", () => {
  assert.equal(phaseGateComponent.textCapacity.maxPointsPerItem, 3);
  assert.equal(phaseGateComponent.textCapacity.maxPointChars, 12);
  const content = {
    pageId: "page-02",
    title: "三代人的青春远征",
    items: [
      { id: "phase-1", title: "马灯守候", body: "门前点灯守望儿子归来", points: ["八个儿子全部参加红军", "请假条写下打完胜仗归来"] },
      { id: "phase-2", title: "青春点灯", body: "在新疆戈壁教书育人", points: ["支教一年教六十个孩子", "学生成长后接力支教"] },
      { id: "phase-3", title: "青春归来", body: "从等我回家变成跟我出发", points: ["青年投身西部", "孩子梦想被点亮"] },
    ],
  };
  const payload = mapPhaseGatePageContent(content, { intentId: "page-02-intent" });
  assert.equal(payload.parameters.gates[0].title, "");
  assert.equal(payload.parameters.gates[0].body, "八个儿子全部参加红军");
  assert.equal(payload.parameters.gates[1].title, "");
  assert.equal(payload.parameters.gates[1].body, "支教一年教六十个孩子");
  assert.doesNotThrow(() => phaseGateComponent.renderMarkup(payload.parameters));
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
  // 真源：assets/结构图/循环闭环-001/asset.json 声明 runtime.supportedBaseRelations = ["cycle"]
  // （commit e614a742 于 2026-08-29 由 "sequence" 显式迁移而来），catalog/logic-map.json 亦把
  // 三个循环资产归在 logicId "cycle" 下、与 "sequence" 分立。旧的 "sequence" 是迁移前遗留。
  const missing = planVisualVariants([
    { pageId: "p1", logicId: "cycle", baseRelation: "cycle", itemCount: 4 },
  ], { variants });
  assert.equal(missing.status, "needs-director-revision");
  // 缺的是导演选择本身，而不是候选：若此处退化成 no-renderable-variant，
  // 上面的 needs-director-revision 会因「没有候选」而假通过。
  assert.equal(missing.results[0].status, "needs-director-decision");
  assert.deepEqual(missing.feedback.map((item) => item.code), ["missing-visual-variant"]);

  const accepted = planVisualVariants([
    {
      pageId: "p1",
      logicId: "cycle",
      baseRelation: "cycle",
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
      polarities: ["positive", "negative"],
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
