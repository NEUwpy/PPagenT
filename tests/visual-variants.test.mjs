import assert from "node:assert/strict";
import test from "node:test";
import {
  computeContainedFrame,
  computeComparisonColumnRows,
  computeSwimlaneLayout,
  comparisonPalette,
  comparisonStatusMarker,
  createPresentation,
  normalizeSequentialSteps,
  sequentialStepBody,
  resolveComparisonEmphasis,
  transformPositionInContainedFrame,
} from "../src/asset-runtime/component-builders.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university.mjs";
import {
  closeHtmlComponentRuntime,
  listStructureAssetBuilders,
  renderStructureAsset,
} from "../src/runtime/assets.mjs";
import {
  loadVisualVariantCatalog,
  listRenderableVisualVariants,
  planVisualVariants,
  queryVisualVariants,
} from "../src/selection/visual-variants.mjs";
import { mapPageContent as mapComparisonPageContent } from "../assets/结构图/双向对比-001/generate.mjs";

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

test("东北大学 Skin 明确正文组件字号层级，核心正文不低于 18 磅", () => {
  const typography = northeasternUniversitySkin.componentTheme.typography;
  const scale = computeContainedFrame(
    northeasternUniversitySkin.componentSourceFrame,
    northeasternUniversitySkin.bodyFrame,
  ).scale;
  assert.equal(typography.componentHeading, 29);
  assert.equal(typography.componentTitle, 26);
  assert.equal(typography.componentItemTitle, 21);
  assert.equal(typography.componentBody, 19);
  assert.equal(typography.componentLabel, 18);
  assert.equal(typography.componentMeta, 17);
  assert.ok(Math.round(typography.componentBody * scale) >= 18);
});

test("泳道标签与泳道底板保留明确间隔，三角色任务卡落在各自单元内", () => {
  const layout = computeSwimlaneLayout({ laneCount: 3, stageCount: 3, hasConclusion: true });
  assert.ok(layout.laneLabelLeft + layout.laneLabelWidth + 12 <= layout.left);
  assert.equal(layout.laneHeight, 112);
  assert.ok(layout.top + layout.laneHeight * 3 < layout.conclusionTop);
  assert.ok(layout.conclusionTop + layout.conclusionHeight <= 628);
});

test("双栏对比由 polarity 决定背景语义，emphasis 不会把正向内容变灰", () => {
  const positive = comparisonPalette({ polarity: "positive", focused: false, side: "left" });
  const negative = comparisonPalette({ polarity: "negative", focused: true, side: "right" });
  assert.match(positive.cardFill, /#2F5EA8|#379BEF/u);
  assert.doesNotMatch(positive.cardFill, /#6E7987|#98A3B1/u);
  assert.match(negative.cardFill, /#6E7987|#98A3B1/u);
  assert.equal(negative.markerFill, "#5E6977");
  assert.equal(positive.textColor, "#FFFFFF");
});

test("双栏对比把褒贬方向与视觉重点分开", () => {
  assert.equal(comparisonStatusMarker({ polarity: "positive", emphasis: false }), "✓");
  assert.equal(comparisonStatusMarker({ polarity: "negative", emphasis: true }), "×");
  assert.equal(comparisonStatusMarker({ polarity: "neutral", emphasis: true }), "•");
});

test("双栏对比 1–5 行都保持在面板内且互不重叠", () => {
  for (let count = 1; count <= 5; count += 1) {
    const rows = computeComparisonColumnRows(count);
    assert.equal(rows.length, count);
    rows.forEach((row, index) => {
      assert.ok(row.top >= 242);
      assert.ok(row.top + row.height <= 618);
      if (index > 0) assert.ok(rows[index - 1].top + rows[index - 1].height < row.top);
    });
  }
});

test("正式候选只暴露已进入核心资产库的蒸馏变体", async () => {
  const variants = await listRenderableVisualVariants({ root });
  const radial = queryVisualVariants(variants, { familyId: "radial-hub", itemCount: 4 });
  const sequential = queryVisualVariants(variants, { familyId: "sequential-process", baseRelation: "sequence", itemCount: 4 });
  const parallel = queryVisualVariants(variants, { skillId: "parallel", itemCount: 4 });
  assert.deepEqual(radial.map((variant) => variant.variantId), ["orbit"]);
  assert.deepEqual(sequential.map((variant) => variant.variantId), ["horizontal-cards"]);
  assert.equal(sequential[0].contentContract.itemRole, "semantic-node");
  assert.deepEqual(
    queryVisualVariants(variants, {
      familyId: "sequential-process",
      baseRelation: "sequence",
      itemCount: 3,
      requiredItemRole: "semantic-node",
      maxPointsPerItem: 4,
      maxPointChars: 8,
    }).map((variant) => variant.variantId),
    ["horizontal-cards"],
  );
  assert.deepEqual(
    queryVisualVariants(variants, {
      familyId: "sequential-process",
      baseRelation: "sequence",
      itemCount: 3,
      requiredItemRole: "semantic-node",
      maxPointsPerItem: 5,
      maxPointChars: 8,
    }),
    [],
  );
  assert.deepEqual(parallel.map((variant) => variant.styleGroupId), ["parallel-cards-p135"]);
  assert.deepEqual(parallel[0].stateContract.states, [3, 4, 5, 6, 7]);
  assert.equal(parallel[0].mediaContract.mode, "no-image");
  assert.deepEqual(
    queryVisualVariants(variants, { familyId: "cycle-loop", baseRelation: "sequence", itemCount: 4 })
      .map((variant) => variant.variantId),
    ["default"],
  );
  assert.deepEqual(
    queryVisualVariants(variants, { familyId: "layered-architecture", baseRelation: "layered", itemCount: 9 })
      .map((variant) => variant.variantId),
    ["default"],
  );
  assert.deepEqual(
    queryVisualVariants(variants, { familyId: "comparison-structure" }).map((variant) => variant.variantId),
    ["default"],
  );
  const comparison = queryVisualVariants(variants, { familyId: "comparison-structure" })[0];
  assert.equal(comparison.contentContract.adaptationOwner, "visual-director");
  assert.deepEqual(comparison.contentContract.bindings[0].preferredItems, [3]);
  assert.deepEqual(
    queryVisualVariants(variants, {
      familyId: "organization-tree",
      baseRelation: "hierarchy",
      purposeKey: "explain_organization",
      itemCount: 3,
    })
      .map((variant) => variant.variantId),
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

test("自动候选会排除缺少 mapper 或可调用 renderer 的变体", async () => {
  const noMapper = await listRenderableVisualVariants({ root, mapperAssetIds: [] });
  assert.deepEqual(noMapper, []);

  const builders = listStructureAssetBuilders();
  assert.deepEqual(builders.variantBuilderKeys, [
    "comparison-structure-001:default",
    "cycle-loop-001:default",
    "fishbone-analysis-001:default",
    "framework-matrix-001:default",
    "funnel-conversion-001:default",
    "hierarchy-pyramid-001:default",
    "layered-architecture-001:default",
    "organization-tree-001:default",
    "parallel-cards-001:parallel-cards-p135",
    "problem-improvement-001:default",
    "radial-hub-001:orbit",
    "radial-hub-001:split-wing",
    "sequential-process-001:causal-chain",
    "sequential-process-001:horizontal-cards",
    "sequential-process-001:ribbon",
    "sequential-process-001:role-handoff",
    "sequential-process-001:staircase",
    "swimlane-process-001:default",
    "timeline-roadmap-001:default",
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

test("顺序流程的中间强调只改变视觉权重，不得把节点重排到终点", () => {
  const steps = [
    { title: "作品" },
    { title: "规律", emphasis: true },
    { title: "能力" },
  ];
  const normalized = normalizeSequentialSteps(steps);
  assert.deepEqual(normalized.displaySteps.map((step) => step.title), ["作品", "规律", "能力"]);
  assert.equal(normalized.emphasisStep.title, "规律");
});

test("所有登记变体都能经过统一运行时真实创建幻灯片对象", async () => {
  const presentation = createPresentation();
  const skin = {
    componentSourceFrame: { left: 40, top: 135, width: 1200, height: 520 },
    bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
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
      parameters: { visualVariantId: "default", title: "闭环", center: "持续改进", steps: ["计划", "执行", "检查", "改进"].map((title) => ({ title, body: `${title}本轮动作` })) },
    },
    {
      assetId: "layered-architecture-001",
      parameters: {
        visualVariantId: "default",
        title: "架构",
        sources: ["数据一", "数据二", "数据三"],
        platform: "平台",
        apps: ["应用一", "应用二", "应用三"],
      },
    },
    {
      assetId: "fishbone-analysis-001",
      parameters: {
        visualVariantId: "default",
        title: "原因分析",
        effect: "结果问题",
        branches: ["人员", "流程", "技术", "资源"].map((category) => ({ category, items: ["因素一", "因素二"] })),
      },
    },
    {
      assetId: "framework-matrix-001",
      parameters: {
        visualVariantId: "default",
        title: "四象限",
        quadrants: ["一", "二", "三", "四"].map((title) => ({ title: `象限${title}`, body: "判断依据与行动建议" })),
      },
    },
    {
      assetId: "funnel-conversion-001",
      parameters: {
        visualVariantId: "default",
        title: "转化漏斗",
        stages: [
          { rate: "100%", label: "触达", note: "进入范围" },
          { rate: "70%", label: "理解", note: "形成认知" },
          { rate: "40%", label: "行动", note: "完成转化" },
        ],
      },
    },
    {
      assetId: "hierarchy-pyramid-001",
      parameters: {
        visualVariantId: "default",
        title: "层级金字塔",
        levels: [
          { title: "方向层", share: "WHY", body: "明确方向" },
          { title: "能力层", share: "WHAT", body: "沉淀能力" },
          { title: "执行层", share: "DO", body: "稳定执行" },
        ],
      },
    },
    {
      assetId: "timeline-roadmap-001",
      parameters: {
        visualVariantId: "default",
        title: "发展历程",
        milestones: [
          { period: "2025", title: "验证", body: "确认方向" },
          { period: "2026", title: "沉淀", body: "形成能力" },
          { period: "2027", title: "扩展", body: "复制场景" },
        ],
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
      assetId: "parallel-cards-001",
      parameters: {
        visualVariantId: "parallel-cards-p135",
        title: "同级能力",
        items: ["数据", "模型", "验证", "交付"].map((title) => ({ title, body: `${title}能力说明` })),
      },
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
    {
      assetId: "swimlane-process-001",
      parameters: {
        visualVariantId: "default",
        title: "角色协同",
        lanes: ["AI", "规则", "代码"],
        stages: ["理解", "决定", "执行"],
        tasks: [
          { lane: 0, stage: 0, label: "读取稿件" },
          { lane: 1, stage: 1, label: "判断边界" },
          { lane: 2, stage: 2, label: "稳定生成" },
        ],
        conclusion: "调用已确认的核心资产。",
      },
    },
    {
      assetId: "problem-improvement-001",
      parameters: {
        visualVariantId: "default",
        title: "问题与改进",
        problemTitle: "现状与缺口",
        improvementTitle: "介入与结果",
        problems: [{ title: "已有内容", body: "缺少制作能力" }, { title: "真实任务", body: "时间有限" }],
        improvements: [{ title: "方法系统化", body: "降低制作成本" }, { title: "生产能力", body: "更多人可用", emphasis: true }],
      },
    },
    {
      assetId: "organization-tree-001",
      parameters: {
        visualVariantId: "default",
        title: "项目组织",
        leader: { name: "李明", role: "总负责人" },
        departments: [
          { name: "产品组", head: "吴飞", members: [{ name: "苏芳", role: "需求" }] },
          { name: "技术组", head: "徐阳", members: [{ name: "周楠", role: "前端" }, { name: "叶琳", role: "后端" }] },
        ],
      },
    },
  ];

  try {
    for (const payload of payloads) {
      const slide = presentation.slides.add();
      await renderStructureAsset(slide, payload, skin);
    }
  } finally {
    await closeHtmlComponentRuntime();
  }
  assert.equal(presentation.slides.items.length, payloads.length);
});

test("并列 Native Builder 用同一函数生成 3、5、7 项", async () => {
  const presentation = createPresentation();
  const skin = {
    componentSourceFrame: { left: 55, top: 166, width: 1170, height: 492 },
    bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
    componentTheme: {},
  };
  try {
    for (const count of [3, 5, 7]) {
      const slide = presentation.slides.add();
      await renderStructureAsset(slide, {
        assetId: "parallel-cards-001",
        parameters: {
          visualVariantId: "parallel-cards-p135",
          items: Array.from({ length: count }, (_, index) => ({
            title: `能力${index + 1}`,
            body: `第${index + 1}项说明`,
          })),
        },
      }, skin);
    }
    const inspection = await presentation.inspect({ kind: "slide,textbox,shape", maxChars: 100000 });
    const rows = inspection.ndjson.split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const slideRows = rows.filter((row) => row.kind === "slide");
    assert.deepEqual(slideRows.map((row) => row.textShapes), [9, 15, 21]);
    assert.equal(rows.filter((row) => row.name?.includes("role=title")).length, 15);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("顺序流程把节点内分点渲染为两行而不是新步骤", () => {
  assert.equal(
    sequentialStepBody({ body: "提炼规律", points: ["表达", "容量", "变化", "禁忌"] }),
    "• 表达   • 容量\n• 变化   • 禁忌",
  );
});

test("双向对比 Mapper 使用视觉导演按 Skill 契约生成的组件绑定", () => {
  const content = {
    pageId: "p1",
    title: "稳定与随机",
    notes: "对比",
    items: [
      { id: "random", title: "随机 95 分", body: "未拆分正文" },
      { id: "stable", title: "稳定 80 分", body: "未拆分正文" },
    ],
  };
  const composition = { componentBindings: [
    { bindingId: "group-items", sourceItemId: "random", entries: [
      { text: "偶尔惊艳", sourceFragment: "偶尔惊艳" },
      { text: "质量波动", sourceFragment: "质量波动" },
      { text: "难以复现", sourceFragment: "难以复现" },
    ] },
    { bindingId: "group-items", sourceItemId: "stable", entries: [
      { text: "结构清楚", sourceFragment: "结构清楚" },
      { text: "符合组织风格", sourceFragment: "符合组织风格" },
      { text: "第二天仍可修改", sourceFragment: "第二天仍可修改" },
    ] },
  ] };
  const payload = mapComparisonPageContent(content, { intentId: "p1-intent" }, null, composition);
  assert.deepEqual(payload.parameters.left.items, ["偶尔惊艳", "质量波动", "难以复现"]);
  assert.deepEqual(payload.parameters.right.items, ["结构清楚", "符合组织风格", "第二天仍可修改"]);
});
