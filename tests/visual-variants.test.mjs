import assert from "node:assert/strict";
import test from "node:test";
import {
  computeContainedFrame,
  createPresentation,
  normalizeSequentialSteps,
  resolveComparisonEmphasis,
  transformPositionInContainedFrame,
} from "../src/asset-runtime/component-builders.mjs";
import {
  listStructureAssetBuilders,
  renderStructureAsset,
} from "../src/runtime/assets.mjs";
import {
  loadVisualVariantCatalog,
  listRenderableVisualVariants,
  planVisualVariants,
  queryVisualVariants,
} from "../src/selection/visual-variants.mjs";

const root = process.cwd();

async function listDevelopmentVariants() {
  const catalog = await loadVisualVariantCatalog(root);
  return listRenderableVisualVariants({
    root,
    allowedVariantStatuses: ["core", "experimental"],
    coreAssetIds: [...new Set(catalog.map((variant) => variant.assetId))],
  });
}

test("结构组件嵌入 Skin 时使用等比例 contain 并在安全区居中", () => {
  const source = { left: 40, top: 135, width: 1200, height: 520 };
  const target = { left: 100, top: 160, width: 1040, height: 400 };
  const fitted = computeContainedFrame(source, target);
  assert.equal(fitted.scale, 400 / 520);
  assert.equal(fitted.top, target.top);
  assert.equal(fitted.left, target.left + (target.width - fitted.width) / 2);

  const circle = transformPositionInContainedFrame(
    { left: 515, top: 260, width: 250, height: 250 },
    source,
    target,
  );
  assert.equal(circle.width, circle.height);
  assert.ok(circle.left >= target.left && circle.top >= target.top);
  assert.ok(circle.left + circle.width <= target.left + target.width);
  assert.ok(circle.top + circle.height <= target.top + target.height);
});

test("正式候选只暴露已进入核心资产库的蒸馏变体", async () => {
  const variants = await listRenderableVisualVariants({ root });
  const radial = queryVisualVariants(variants, { familyId: "radial-hub", itemCount: 4 });
  const sequential = queryVisualVariants(variants, { familyId: "sequential-process", baseRelation: "sequence", itemCount: 4 });
  assert.equal(radial.length, 0);
  assert.deepEqual(sequential.map((variant) => variant.variantId), ["horizontal-cards"]);
  assert.deepEqual(
    queryVisualVariants(variants, { familyId: "comparison-structure" }).map((variant) => variant.variantId),
    ["default"],
  );
  assert.equal(queryVisualVariants(variants, { familyId: "role-handoff" }).length, 0);
  assert.equal(queryVisualVariants(variants, { familyId: "causal-chain" }).length, 0);
  for (const variant of variants) {
    assert.equal(variant.contractAvailable, true);
    assert.equal(variant.coreAssetAvailable, true);
    assert.equal(variant.callableStatus, true);
    assert.equal(variant.mapperAvailable, true);
    assert.equal(variant.builderAvailable, true);
    assert.equal(variant.status, "core");
    assert.ok(variant.silhouette);
  }
});

test("自动候选会排除缺少 mapper 或 builder 的变体", async () => {
  const noMapper = await listRenderableVisualVariants({ root, mapperAssetIds: [] });
  assert.deepEqual(noMapper, []);

  const builders = listStructureAssetBuilders();
  assert.deepEqual(builders.variantBuilderKeys, [
    "comparison-structure-001:default",
    "cycle-loop-001:default",
    "layered-architecture-001:default",
    "radial-hub-001:orbit",
    "radial-hub-001:split-wing",
    "sequential-process-001:causal-chain",
    "sequential-process-001:horizontal-cards",
    "sequential-process-001:ribbon",
    "sequential-process-001:role-handoff",
    "sequential-process-001:staircase",
  ]);
});

test("整套节奏解析尊重视觉导演决策，并拒绝存在替代项时的相邻同轮廓", async () => {
  const variants = await listDevelopmentVariants();
  const accepted = planVisualVariants([
    { pageId: "p1", familyId: "radial-hub", itemCount: 4, visualVariantId: "orbit" },
    { pageId: "p2", familyId: "radial-hub", itemCount: 4, visualVariantId: "split-wing" },
    { pageId: "p3", familyId: "radial-hub", itemCount: 4, visualVariantId: "orbit" },
    { pageId: "p4", familyId: "radial-hub", itemCount: 4, visualVariantId: "split-wing" },
  ], { variants });
  assert.equal(accepted.status, "accepted");
  assert.deepEqual(accepted.results.map((item) => item.variantId), ["orbit", "split-wing", "orbit", "split-wing"]);

  const conflict = planVisualVariants([
    { pageId: "p1", familyId: "radial-hub", itemCount: 4, visualVariantId: "orbit" },
    { pageId: "p2", familyId: "radial-hub", itemCount: 4, visualVariantId: "orbit" },
  ], { variants });
  assert.equal(conflict.status, "needs-director-revision");
  assert.equal(conflict.results[1].status, "rhythm-conflict");
  assert.deepEqual(conflict.feedback[0].candidateVariantIds, ["split-wing", "orbit"]);
});

test("节奏解析器不会在视觉导演缺失决策时自行选一个变体", async () => {
  const variants = await listDevelopmentVariants();
  const plan = planVisualVariants([
    { pageId: "p1", familyId: "sequential-process", baseRelation: "sequence", itemCount: 4 },
  ], { variants });
  assert.equal(plan.status, "needs-director-revision");
  assert.equal(plan.results[0].status, "needs-director-decision");
  assert.equal(plan.results[0].variantId, undefined);
  assert.deepEqual(plan.feedback[0].candidateVariantIds, ["horizontal-cards", "ribbon", "staircase"]);
});

test("连续五页顺序流程可由视觉导演用三种轮廓形成合法节奏", async () => {
  const variants = await listDevelopmentVariants();
  const plan = planVisualVariants([
    { pageId: "p02", familyId: "sequential-process", baseRelation: "sequence", itemCount: 4, visualVariantId: "horizontal-cards" },
    { pageId: "p04", familyId: "sequential-process", baseRelation: "sequence", itemCount: 4, visualVariantId: "ribbon" },
    { pageId: "p05", familyId: "sequential-process", baseRelation: "sequence", itemCount: 4, visualVariantId: "staircase" },
    { pageId: "p06", familyId: "sequential-process", baseRelation: "sequence", itemCount: 5, visualVariantId: "horizontal-cards" },
    { pageId: "p07", familyId: "sequential-process", baseRelation: "sequence", itemCount: 3, visualVariantId: "ribbon" },
  ], { variants });
  assert.equal(plan.status, "accepted");
  assert.deepEqual(plan.results.map((item) => item.silhouette), [
    "horizontal-card-chain",
    "alternating-ribbon",
    "ascending-step-path",
    "horizontal-card-chain",
    "alternating-ribbon",
  ]);
});

test("变体语义过滤会把角色接力、因果链和普通顺序流程分开", async () => {
  const variants = await listDevelopmentVariants();
  assert.deepEqual(
    queryVisualVariants(variants, { familyId: "sequential-process", baseRelation: "sequence", itemCount: 4 })
      .map((item) => item.variantId),
    ["horizontal-cards", "ribbon", "staircase"],
  );
  assert.deepEqual(
    queryVisualVariants(variants, {
      familyId: "role-handoff",
      baseRelation: "sequence",
      purposeKey: "explain_cross_role_process",
      itemCount: 4,
    }).map((item) => item.variantId),
    ["role-handoff"],
  );
  assert.deepEqual(
    queryVisualVariants(variants, { familyId: "causal-chain", baseRelation: "causal", itemCount: 4 })
      .map((item) => item.variantId),
    ["causal-chain"],
  );
});

test("强调终点从普通编号步骤中分离，比较页只允许单侧成为重点", () => {
  const normalized = normalizeSequentialSteps([
    { title: "条件", body: "说明" },
    { title: "动作", body: "说明" },
    { title: "稳定结果", body: "说明", emphasis: "result" },
  ]);
  assert.equal(normalized.regularSteps.length, 2);
  assert.equal(normalized.emphasisStep.title, "稳定结果");
  assert.equal(normalized.displaySteps.at(-1).emphasis, "result");
  assert.equal(resolveComparisonEmphasis({ emphasis: true }, {}), "left");
  assert.equal(resolveComparisonEmphasis({}, { emphasis: true }), "right");
  assert.equal(resolveComparisonEmphasis({ emphasis: true }, { emphasis: true }), null);
});

test("所有登记变体都能经过统一运行时真实创建幻灯片对象", () => {
  const presentation = createPresentation();
  const skin = {
    componentSourceFrame: { left: 40, top: 135, width: 1200, height: 520 },
    bodyFrame: { left: 92, top: 150, width: 1096, height: 430 },
    componentTheme: {},
  };
  const payloads = [
    {
      assetId: "comparison-structure-001",
      parameters: {
        visualVariantId: "default",
        title: "对比",
        left: { title: "过去", items: ["慢", "散"] },
        right: { title: "现在", items: ["快", "稳"], emphasis: true, emphasisLabel: "受控路线" },
        centerLabel: "转变",
      },
    },
    {
      assetId: "cycle-loop-001",
      parameters: { visualVariantId: "default", title: "闭环", center: "持续改进", steps: ["计划", "执行", "检查", "改进"] },
    },
    {
      assetId: "layered-architecture-001",
      parameters: {
        visualVariantId: "default",
        title: "架构",
        sources: ["数据一", "数据二", "数据三"],
        platform: "平台",
        apps: ["应用一", "应用二"],
      },
    },
    {
      assetId: "radial-hub-001",
      parameters: { visualVariantId: "orbit", title: "主题", center: "中心", items: ["一", "二", "三", "四"] },
    },
    {
      assetId: "radial-hub-001",
      parameters: { visualVariantId: "split-wing", title: "主题", center: "中心", items: ["一", "二", "三", "四"] },
    },
    {
      assetId: "sequential-process-001",
      parameters: {
        visualVariantId: "horizontal-cards",
        title: "流程",
        steps: ["一", "二", "三", "四"].map((title, index) => ({ title, body: `${title}的说明`, emphasis: index === 3 })),
      },
    },
    {
      assetId: "sequential-process-001",
      parameters: {
        visualVariantId: "ribbon",
        title: "流程",
        steps: ["一", "二", "三", "四"].map((title) => ({ title, body: `${title}的说明` })),
      },
    },
    {
      assetId: "sequential-process-001",
      parameters: {
        visualVariantId: "role-handoff",
        title: "跨角色流程",
        steps: [
          { role: "内容导演", title: "形成叙事", body: "明确主线" },
          { role: "视觉导演", title: "选择句法", body: "规划节奏" },
          { role: "运行时", title: "确定绘制", body: "输出页面" },
        ],
      },
    },
    {
      assetId: "sequential-process-001",
      parameters: {
        visualVariantId: "causal-chain",
        title: "因果链",
        steps: [
          { title: "输入波动", body: "条件变化" },
          { title: "能力缺口", body: "现有路径不足" },
          { title: "规则介入", body: "加入约束" },
          { title: "稳定输出", body: "结果可控", emphasis: "result" },
        ],
      },
    },
    {
      assetId: "sequential-process-001",
      parameters: {
        visualVariantId: "staircase",
        title: "流程",
        steps: ["一", "二", "三", "四", "五", "六"].map((title) => ({ title, body: `${title}的说明` })),
      },
    },
  ];

  for (const payload of payloads) {
    const slide = presentation.slides.add();
    renderStructureAsset(slide, payload, skin);
  }
  assert.equal(presentation.slides.items.length, 10);
});
