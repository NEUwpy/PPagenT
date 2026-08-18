import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildVisualCandidateSets,
  duplicatedCompositionItemIds,
  normalizeBoundComponentCompositionPage,
  resolveVisualPlan,
  timelineLacksTemporalEvidence,
  validateComponentBindings,
} from "../src/agent/visual-resolution.mjs";
import { enrichPageIntent } from "../src/content/page-content.mjs";
import { mapRenderPayload } from "../src/render/render-payload.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("没有时间证据的职责链不能选择时间轴", () => {
  const candidateSet = { candidates: [
    { assetId: "timeline-roadmap-001" },
    { assetId: "sequential-process-001" },
  ] };
  assert.equal(timelineLacksTemporalEvidence(
    { sourceText: "AI 负责理解，规则负责决定，代码负责执行。" },
    candidateSet.candidates[0],
    candidateSet,
  ), true);
  assert.equal(timelineLacksTemporalEvidence(
    { sourceText: "2026 年启动，2027 年形成里程碑。" },
    candidateSet.candidates[0],
    candidateSet,
  ), false);
});

test("同一内容项不能同时完整进入组件和侧栏文字", () => {
  assert.deepEqual(duplicatedCompositionItemIds({
    componentItemIds: ["a", "b"],
    textSlots: [{ slotId: "aside", sourceItemIds: ["b"] }],
  }), ["b"]);
});

test("Logic 的重复内容绑定由视觉导演适配并由程序校验", () => {
  const page = content("comparison", [
    { id: "random", title: "随机 95 分", body: "偶尔惊艳但质量波动" },
    { id: "stable", title: "稳定 80 分", body: "结构清楚而且第二天仍可修改" },
  ]);
  page.sourceText = "随机作品偶尔惊艳但质量波动。稳定初稿结构清楚，而且第二天仍可修改。";
  const candidate = { contentContract: { bindings: [{
    id: "group-items",
    scope: "per-component-item",
    minItems: 2,
    maxItems: 5,
    maxChars: 18,
    balancedAcrossItems: true,
  }] } };
  const valid = {
    componentItemIds: ["random", "stable"],
    componentBindings: [
      { bindingId: "group-items", sourceItemId: "random", entries: [
        { text: "偶尔惊艳", sourceFragment: "偶尔惊艳" },
        { text: "质量波动", sourceFragment: "质量波动" },
      ] },
      { bindingId: "group-items", sourceItemId: "stable", entries: [
        { text: "结构清楚", sourceFragment: "结构清楚" },
        { text: "第二天仍可修改", sourceFragment: "第二天仍可修改" },
      ] },
    ],
  };
  assert.deepEqual(validateComponentBindings(page, candidate, valid), []);
  const invalid = structuredClone(valid);
  invalid.componentBindings[0].entries = [{ text: "把整段正文直接塞进去会太长太难看", sourceFragment: "偶尔惊艳" }];
  const issues = validateComponentBindings(page, candidate, invalid);
  assert.ok(issues.some((issue) => issue.code === "component-binding-item-count-invalid"));
  assert.ok(issues.some((issue) => issue.code === "component-binding-count-unbalanced"));
});

test("只有组件槽的绑定型 Logic 会规范化为组件完整承载", () => {
  const page = {
    componentItemIds: ["random", "stable"],
    componentContentMode: "titles-only",
    textSlots: [{ slotId: "body", sourceItemIds: ["random", "stable"], contentMode: "body" }],
    componentBindings: [{ bindingId: "group-items", sourceItemId: "random", entries: [] }],
  };
  const normalized = normalizeBoundComponentCompositionPage(
    page,
    { contentContract: { bindings: [{ id: "group-items" }] } },
    { requiresComponent: true, slots: [{ id: "component", role: "component" }] },
  );
  assert.equal(normalized.componentContentMode, "full");
  assert.deepEqual(normalized.textSlots, []);
  assert.deepEqual(normalized.componentBindings, page.componentBindings);
});

function content(pageId, items) {
  return { schemaVersion: "1.0", pageId, title: pageId, items, sourceText: pageId };
}

function intentDraft(intentId, purposeKey, baseRelation, structure = {}) {
  return {
    intentId,
    purposeKey,
    purposeText: purposeKey,
    baseRelation,
    relationTraits: {
      temporal: false,
      cyclic: false,
      converging: false,
      branched: false,
      dimensions: 1,
      secondaryDimension: "none",
    },
    structure: { ordered: false, sameLevel: true, ...structure },
    density: "low",
    evidenceTypes: ["text"],
    confidence: 0.9,
    assumptions: [],
  };
}

test("正式流程不会暴露缺少视觉意图和用户确认的 HTML 资产", async () => {
  const page = content("topics", [
    { id: "a", title: "A", body: "A" },
    { id: "b", title: "B", body: "B" },
    { id: "c", title: "C", body: "C" },
    { id: "d", title: "D", body: "D" },
  ]);
  const intent = enrichPageIntent(intentDraft("topics-intent", "explain_topics", "hub"), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), ["hub-radial-001", "northeastern-university-body-001"]);
  assert.equal(set.capacityDensity, "low");
});

test("正式候选包含重新蒸馏的顺序流程与正文兜底", async () => {
  const page = content("process", [
    { id: "a", title: "A", body: "A" },
    { id: "b", title: "B", body: "B" },
    { id: "c", title: "C", body: "C" },
  ]);
  const intent = enrichPageIntent(intentDraft("process-intent", "explain_process", "sequence", {
    ordered: true,
    sameLevel: false,
  }), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => ({
    assetId: candidate.assetId,
    variantId: candidate.variantId,
  })), [
    { assetId: "sequence-flow-001", variantId: "continuous-numbered-rail" },
    { assetId: "northeastern-university-body-001", variantId: "editorial" },
  ]);
});

test("循环父候选向视觉导演暴露 Slot 契约但不开放子结构绑定", async () => {
  const page = content("cycle", [
    { id: "plan", title: "计划", body: "明确目标" },
    { id: "do", title: "执行", body: "推进任务" },
    { id: "check", title: "检查", body: "核对结果" },
    { id: "act", title: "改进", body: "进入下一轮" },
  ]);
  const draft = intentDraft("cycle-intent", "explain_cycle", "sequence", {
    ordered: true,
    sameLevel: true,
  });
  draft.relationTraits.cyclic = true;
  const intent = enrichPageIntent(draft, page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  const cycle = set.candidates.find((candidate) => candidate.assetId === "cycle-loop-001");
  assert.equal(cycle?.slotContract?.resolverExport, "resolveContentSlots");
  assert.equal(cycle?.slotContract?.maxDepth, 1);
  assert.equal(cycle?.slotContract?.fallback, "plain-text");
  assert.deepEqual(cycle?.slotCapabilities?.textSlots.map((slot) => ({ role: slot.role, maxChars: slot.maxChars, maxLines: slot.maxLines })), [
    { role: "center-title", maxChars: 12, maxLines: 2 },
    { role: "item-title", maxChars: 8, maxLines: 1 },
    { role: "item-body", maxChars: 64, maxLines: 5 },
  ]);
  assert.deepEqual(cycle?.slotCapabilities?.mediaSlots, []);
  assert.deepEqual(cycle?.slotCapabilities?.container, {
    pointRendering: "merged-body",
    bodyContainerMode: "single-flow",
    itemTitleRequired: false,
    itemBodyRequired: false,
    itemBodySourceField: "support",
    itemBodyTextMode: "flow",
    itemBodyListPolicy: "inline",
  });
  assert.equal(cycle?.slotCapabilities?.textSlots.some((slot) => slot.role === "item-point"), false);
  assert.equal(cycle?.slotCapabilities?.textSlots.find((slot) => slot.role === "item-body")?.sourceField, "support");
  assert.equal("slotBindings" in cycle, false);
});

test("视觉导演按 Slot Contract 精炼组件文字后才允许进入渲染", async () => {
  const page = content("cycle-adaptation", [
    { id: "plan", title: "计划阶段目标设定说明", body: "先识别当前约束条件并明确本轮改进目标" },
    { id: "do", title: "执行阶段任务推进说明", body: "围绕重点任务同步责任分工并推进实施" },
    { id: "check", title: "检查阶段结果核对说明", body: "对照既定目标核对执行结果和关键偏差" },
  ]);
  page.title = "面向复杂任务的持续改进循环机制";
  const draft = intentDraft("cycle-adaptation-intent", "explain_cycle", "sequence", {
    ordered: true,
    sameLevel: true,
  });
  draft.relationTraits.cyclic = true;
  const intent = enrichPageIntent(draft, page);
  const [candidateSet] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  const candidate = candidateSet.candidates.find((item) => item.assetId === "cycle-loop-001");
  assert.ok(candidate, "原文超过组件容量时仍应把容量合同交给视觉导演，而不是提前隐藏候选");
  const componentText = [
    { sourceField: "page-title", targetRole: "center-title", text: "持续改进", sourceFragment: "持续改进" },
    { sourceItemId: "plan", sourceField: "title", targetRole: "item-title", text: "设定目标", sourceFragment: "目标设定" },
    { sourceItemId: "plan", sourceField: "support", targetRole: "item-body", text: "识别约束并明确目标", sourceFragment: "识别当前约束条件" },
    { sourceItemId: "do", sourceField: "title", targetRole: "item-title", text: "推进执行", sourceFragment: "执行阶段" },
    { sourceItemId: "do", sourceField: "support", targetRole: "item-body", text: "同步分工推进实施", sourceFragment: "同步责任分工" },
    { sourceItemId: "check", sourceField: "title", targetRole: "item-title", text: "检查结果", sourceFragment: "检查阶段" },
    { sourceItemId: "check", sourceField: "support", targetRole: "item-body", text: "核对结果与关键偏差", sourceFragment: "核对执行结果和关键偏差" },
  ];
  const common = {
    root,
    pageContents: [page],
    pageIntents: [intent],
    candidateSets: [{ ...candidateSet, candidates: [candidate] }],
    visualPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
    }] },
  };
  const compositionPage = {
    pageId: page.pageId,
    intentId: intent.intentId,
    compositionId: "component-full",
    componentItemIds: page.items.map((item) => item.id),
    componentContentMode: "full",
    textSlots: [],
    componentText,
    reason: "按当前三项 State 的 Slot Contract 精炼",
  };
  const accepted = await resolveVisualPlan({ ...common, compositionPlan: { pages: [compositionPage] } });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.renderPayloads[0].parameters.center, "持续改进");
  assert.deepEqual(accepted.renderPayloads[0].parameters.steps.map((item) => [item.title, item.body]), [
    ["设定目标", "识别约束并明确目标"],
    ["推进执行", "同步分工推进实施"],
    ["检查结果", "核对结果与关键偏差"],
  ]);

  const missing = await resolveVisualPlan({
    ...common,
    compositionPlan: { pages: [{ ...compositionPage, componentText: [] }] },
  });
  assert.equal(missing.status, "needs-director-revision");
  assert.ok(missing.feedback[0].issues.some((issue) => issue.code === "component-text-required"));

  const overflow = await resolveVisualPlan({
    ...common,
    compositionPlan: { pages: [{
      ...compositionPage,
      componentText: componentText.map((item) => item.sourceItemId === "plan" && item.sourceField === "title"
        ? { ...item, text: "超过八个汉字的计划阶段标题" }
        : item),
    }] },
  });
  assert.equal(overflow.status, "needs-director-revision");
  assert.ok(overflow.feedback[0].issues.some((issue) => issue.code === "component-text-too-long"));
});

test("两个互补事实不会因为恰好有两项就获得比较资产", async () => {
  const page = content("scope", [
    { id: "skin", title: "视觉规范可以替换", body: "学校视觉规范是可替换的组织视觉系统。" },
    { id: "capability", title: "经验能力可以复用", body: "内容理解和表达规则可以服务多个场景。", emphasis: true },
  ]);
  const intent = enrichPageIntent(intentDraft(
    "scope-intent",
    "present_parallel_points",
    "parallel",
    { ordered: false, sameLevel: true },
  ), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), [
    "northeastern-university-body-001",
  ]);
  assert.equal(set.candidates.some((candidate) => candidate.assetId === "comparison-structure-001"), false);
});

test("未重新蒸馏的泳道资产不会进入三角色候选", async () => {
  const page = content("roles", [
    { id: "role-01", title: "AI 负责理解", body: "读取稿件，判断重点、关系、拆页和表达目的。" },
    { id: "role-02", title: "规则负责决定", body: "判断哪些版式可以使用、内容是否装得下、什么时候应该换版式或拆页。" },
    { id: "role-03", title: "代码负责执行", body: "稳定生成原生可编辑的 PowerPoint。" },
    { id: "summary-01", title: "", body: "AI 读懂稿子，然后调用人已经提前做好的好东西。", emphasis: true },
  ]);
  const draft = intentDraft("roles-intent", "explain_cross_role_process", "sequence", {
    ordered: true,
    sameLevel: false,
    dimensions: { roleCount: 3, stageCount: 3 },
  });
  draft.relationTraits = { ...draft.relationTraits, dimensions: 2, secondaryDimension: "role" };
  const intent = enrichPageIntent(draft, page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), ["northeastern-university-body-001"]);
});

test("未重新蒸馏的问题改进资产不会进入因果候选", async () => {
  const page = content("value", [
    { id: "audience-01", title: "更多人并不缺内容", body: "他们有内容、有专业知识，也有真实的汇报任务。" },
    { id: "barrier-01", title: "缺的是制作能力", body: "只是不擅长拆页、选择表达方式和完成视觉排版。" },
    { id: "value-01", title: "把方法做成系统", body: "让更多人以较低成本获得接近专业标准的结果。" },
    { id: "outcome-01", title: "", body: "把少数人的能力变成更多人可以使用的生产能力。", emphasis: true },
  ]);
  const intent = enrichPageIntent(intentDraft("value-intent", "connect_problems_and_solutions", "causal", {
    ordered: true,
    sameLevel: false,
  }), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), ["northeastern-university-body-001"]);
});

test("三层组织树命中已登记的组织层级资产", async () => {
  const page = {
    ...content("organization", [
      { id: "product", title: "产品组", body: "需求与研究" },
      { id: "technology", title: "技术组", body: "开发与测试" },
    ]),
    structuredData: {
      type: "hierarchy",
      root: {
        id: "leader",
        label: "李明",
        role: "总负责人",
        children: [
          {
            id: "product",
            label: "产品组",
            role: "吴飞",
            children: [{ id: "researcher", label: "苏芳", role: "需求研究" }],
          },
          {
            id: "technology",
            label: "技术组",
            role: "徐阳",
            children: [
              { id: "frontend", label: "周楠", role: "前端开发" },
              { id: "backend", label: "叶琳", role: "后端开发" },
            ],
          },
        ],
      },
    },
  };
  const intent = enrichPageIntent(intentDraft(
    "organization-intent",
    "explain_organization",
    "hierarchy",
    { ordered: false, sameLevel: false },
  ), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), [
    "hierarchy-people-tree-001",
    "northeastern-university-body-001",
  ]);
});

test("resolver 不允许把视觉导演的家族或变体换成另一资产", async () => {
  const page = content("topics", [
    { id: "a", title: "A", body: "A" },
    { id: "b", title: "B", body: "B" },
    { id: "c", title: "C", body: "C" },
  ]);
  const intent = enrichPageIntent(intentDraft("topics-intent", "explain_topics", "hub"), page);
  const result = await resolveVisualPlan({
    root,
    pageContents: [page],
    pageIntents: [intent],
    candidateSets: [{
      pageId: "topics",
      intentId: "topics-intent",
      candidates: [{
        familyId: "radial-hub",
        assetId: "radial-hub-001",
        variantId: "orbit",
        silhouette: "center-orbit",
        adaptationStatus: "adaptive",
        compositionIds: ["component-full"],
      }],
    }],
    visualPlan: {
      pages: [{
        pageId: "topics",
        intentId: "topics-intent",
        familyId: "sequential-process",
        variantId: "ribbon",
        silhouette: "alternating-ribbon",
      }],
    },
    compositionPlan: {
      pages: [{
        pageId: "topics",
        intentId: "topics-intent",
        compositionId: "component-full",
        componentItemIds: ["a", "b", "c"],
        componentContentMode: "full",
        textSlots: [],
        reason: "test",
      }],
    },
  });
  assert.equal(result.status, "needs-director-revision");
  assert.equal(result.feedback[0].code, "choice-not-in-semantic-candidates");
});

test("唯一家族与变体确定后由候选回填冗余 silhouette", async () => {
  const page = content("opening", [
    { id: "greeting", title: "问候", body: "大家好" },
    { id: "topic", title: "主题", body: "分享创新实践" },
  ]);
  const intent = enrichPageIntent(intentDraft("opening-intent", "present_parallel_points", "parallel"), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  const candidate = set.candidates.find((item) => item.fallbackBody);
  const result = await resolveVisualPlan({
    root,
    pageContents: [page],
    pageIntents: [intent],
    candidateSets: [{ ...set, candidates: [candidate] }],
    visualPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: "balanced-dual-statement",
    }] },
    compositionPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      compositionId: "editorial-dual-statement",
      componentItemIds: [],
      componentContentMode: "none",
      textSlots: [
        { slotId: "left", sourceItemIds: ["greeting"], contentMode: "full" },
        { slotId: "right", sourceItemIds: ["topic"], contentMode: "full" },
      ],
      reason: "test",
    }] },
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.visualPlan.pages[0].silhouette, candidate.silhouette);
  assert.equal(result.layoutDecisions[0].selectedSilhouette, candidate.silhouette);
});

test("已审批的分层架构由正式发现按层与层内能力映射", async () => {
  const page = content("system", [
    { id: "experience", title: "体验层", body: "", points: ["用户门户", "运营工作台"] },
    { id: "capability", title: "能力层", body: "", points: ["数据服务", "规则引擎"] },
    { id: "foundation", title: "基础层", body: "", points: ["计算资源", "安全体系"] },
  ]);
  const intent = enrichPageIntent(intentDraft("system-intent", "explain_layers", "layered", {
    itemCount: 3,
    ordered: true,
    sameLevel: false,
  }), page);
  const decision = {
    selectedAssetId: "layered-architecture-001",
    selectedVariantId: "curved-frustum-stack",
  };
  const payload = await mapRenderPayload(page, intent, decision);
  assert.equal(payload.assetId, "layered-architecture-001");
  assert.equal(payload.parameters.layers.length, 3);
  assert.deepEqual(payload.parameters.layers[1].items.map((item) => item.title), ["数据服务", "规则引擎"]);
});

test("CompositionPlan must place every source item in a legal page slot", async () => {
  const page = content("editorial", [
    { id: "lead", title: "Lead", body: "Lead body" },
    { id: "support", title: "Support", body: "Support body" },
  ]);
  const intent = enrichPageIntent(intentDraft("editorial-intent", "explain_topics", "parallel"), page);
  const candidate = {
    familyId: "skin-body-editorial",
    assetId: "northeastern-university-body-001",
    variantId: "editorial",
    silhouette: "editorial-page",
    adaptationStatus: "adaptive",
    compositionIds: ["editorial-focus"],
  };
  const common = {
    root,
    pageContents: [page],
    pageIntents: [intent],
    candidateSets: [{ pageId: "editorial", intentId: intent.intentId, candidates: [candidate] }],
    visualPlan: { pages: [{
      pageId: "editorial",
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
    }] },
  };
  const validPage = {
    pageId: "editorial",
    intentId: intent.intentId,
    compositionId: "editorial-focus",
    componentItemIds: [],
    componentContentMode: "none",
    textSlots: [
      { slotId: "primary", sourceItemIds: ["lead"], contentMode: "full" },
      { slotId: "support", sourceItemIds: ["support"], contentMode: "full" },
    ],
    reason: "test",
  };
  const accepted = await resolveVisualPlan({ ...common, compositionPlan: { pages: [validPage] } });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.renderPayloads[0].assetId, "northeastern-university-body-001");

  const normalized = await resolveVisualPlan({
    ...common,
    compositionPlan: { pages: [{
      ...validPage,
      componentItemIds: ["lead", "support"],
      componentContentMode: "full",
    }] },
  });
  assert.equal(normalized.status, "accepted");
  assert.deepEqual(normalized.compositionPlan.pages[0].componentItemIds, []);
  assert.equal(normalized.compositionPlan.pages[0].componentContentMode, "none");

  const rejected = await resolveVisualPlan({
    ...common,
    compositionPlan: { pages: [{ ...validPage, textSlots: [validPage.textSlots[0]] }] },
  });
  assert.equal(rejected.status, "needs-director-revision");
  assert.ok(rejected.feedback[0].issues.some((issue) => issue.code === "composition-content-unplaced"));

  const fieldRejected = await resolveVisualPlan({
    ...common,
    compositionPlan: { pages: [{
      ...validPage,
      textSlots: validPage.textSlots.map((slot) => ({ ...slot, contentMode: "title" })),
    }] },
  });
  assert.equal(fieldRejected.status, "needs-director-revision");
  assert.ok(fieldRejected.feedback[0].issues.some((issue) => issue.code === "composition-item-field-unplaced"));
});

test("component titles-only cannot silently drop item bodies", async () => {
  const page = content("cycle-titles-only", [
    { id: "a", title: "A", body: "A body" },
    { id: "b", title: "B", body: "B body" },
    { id: "c", title: "C", body: "C body" },
  ]);
  const draft = intentDraft("cycle-titles-only-intent", "explain_cycle", "sequence", {
    ordered: true,
    sameLevel: true,
  });
  draft.relationTraits.cyclic = true;
  const intent = enrichPageIntent(draft, page);
  const [candidateSet] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  const candidate = candidateSet.candidates.find((item) => item.assetId === "cycle-loop-001");
  assert.ok(candidate);
  const result = await resolveVisualPlan({
    root,
    pageContents: [page],
    pageIntents: [intent],
    candidateSets: [{ ...candidateSet, candidates: [candidate] }],
    visualPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
    }] },
    compositionPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      compositionId: "component-full",
      componentItemIds: ["a", "b", "c"],
      componentContentMode: "titles-only",
      textSlots: [],
      reason: "test",
    }] },
  });
  assert.equal(result.status, "needs-director-revision");
  assert.ok(result.feedback[0].issues.some((issue) => issue.code === "component-body-content-unplaced"));
});

test("文字槽放不下时 resolver 返回经过真实字号预演的合法重排", async () => {
  const page = content("conclusion", [
    { id: "quote", title: "总书记嘱托", body: "讲好党的故事，把红色基因传承下去。" },
    { id: "summary", title: "五年实践总结", body: "用研学链、任务单、VR基地、宣讲团、育人机制，熔铸信念。", points: ["十年探路、五年深耕", "贯通红色血脉", "激发实干担当"] },
    { id: "closing", title: "最终底色", body: "六地红成为最鲜亮的青春底色。" },
  ]);
  const intent = enrichPageIntent(intentDraft("conclusion-intent", "present_parallel_points", "parallel"), page);
  const [candidateSet] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  const candidate = candidateSet.candidates.find((item) => item.fallbackBody);
  const result = await resolveVisualPlan({
    root,
    pageContents: [page],
    pageIntents: [intent],
    candidateSets: [{ ...candidateSet, candidates: [candidate] }],
    visualPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
    }] },
    compositionPlan: { pages: [{
      pageId: page.pageId,
      intentId: intent.intentId,
      compositionId: "editorial-focus",
      componentItemIds: [],
      componentContentMode: "none",
      textSlots: [
        { slotId: "primary", sourceItemIds: ["closing"], contentMode: "full" },
        { slotId: "support", sourceItemIds: ["quote", "summary"], contentMode: "full" },
      ],
      reason: "test",
    }] },
  });
  assert.equal(result.status, "needs-director-revision");
  const feedback = result.feedback.find((item) => item.pageId === page.pageId);
  assert.ok(feedback.issues.some((issue) => issue.code === "composition-text-fit-failed"));
  assert.ok(feedback.legalAlternatives.some((item) => (
    item.compositionId === "editorial-focus"
      && item.textSlots.find((slot) => slot.slotId === "primary")?.sourceItemIds[0] === "summary"
  )));
});

test("closing purpose cannot bypass fixed closing capacity", async () => {
  const page = content("closing-like", [
    { id: "a", title: "A", body: "A body" },
    { id: "b", title: "B", body: "B body" },
    { id: "c", title: "C", body: "C body" },
    { id: "d", title: "D", body: "D body" },
  ]);
  const intent = enrichPageIntent(intentDraft("closing-like-intent", "present_closing", "parallel"), page);
  const [candidateSet] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.ok(candidateSet.candidates.length > 0);
  assert.ok(candidateSet.candidates.every((item) => item.assetId !== "northeastern-university-closing-001"));
});

test("component text capacity removes a long-copy structure before rendering", async () => {
  const page = content("long-sequence", [
    { id: "a", title: "步骤一", body: "甲".repeat(20) },
    { id: "b", title: "步骤二", body: "乙".repeat(20) },
    { id: "c", title: "步骤三", body: "丙".repeat(20) },
    { id: "d", title: "步骤四", body: "丁".repeat(63) },
  ]);
  const intent = enrichPageIntent(intentDraft("long-sequence-intent", "explain_process", "sequence", {
    ordered: true,
  }), page);
  const [candidateSet] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.ok(candidateSet.candidates.length > 0);
  assert.ok(candidateSet.candidates.every((item) => item.assetId !== "sequential-process-001"));
  assert.ok(candidateSet.candidates.some((item) => item.fallbackBody));
});
