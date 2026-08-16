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

test("Visual Skill 的重复内容绑定由视觉导演适配并由程序校验", () => {
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

test("只有组件槽的绑定型 Skill 会规范化为组件完整承载", () => {
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

test("正式流程只暴露已晋升核心库的结构变体", async () => {
  const page = content("topics", [
    { id: "a", title: "A", body: "A" },
    { id: "b", title: "B", body: "B" },
    { id: "c", title: "C", body: "C" },
    { id: "d", title: "D", body: "D" },
  ]);
  const intent = enrichPageIntent(intentDraft("topics-intent", "explain_topics", "hub"), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), ["radial-hub-001", "northeastern-university-body-001"]);
  assert.equal(set.candidates.find((candidate) => candidate.assetId === "radial-hub-001")?.variantId, "orbit");
  assert.equal(set.capacityDensity, "low");
});

test("正式流程只把核心库中的蒸馏变体交给视觉导演", async () => {
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
    { assetId: "sequential-process-001", variantId: "horizontal-cards" },
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
  assert.equal("slotBindings" in cycle, false);
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
  const comparisonRejection = set.semanticRejections.find((entry) => entry.assetId === "comparison-structure-001");
  assert.ok(comparisonRejection.reasons.includes("base-relation:parallel"));
});

test("真实三角色内容优先获得核心泳道资产并保留独立总结", async () => {
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
  assert.equal(set.candidates[0].assetId, "swimlane-process-001");
  const payload = mapRenderPayload(page, intent, { selectedAssetId: "swimlane-process-001" });
  assert.deepEqual(payload.parameters.lanes, ["AI", "规则", "代码"]);
  assert.deepEqual(payload.parameters.stages, ["理解", "决定", "执行"]);
  assert.equal(payload.parameters.conclusion, page.items[3].body);
});

test("四段因果内容使用核心问题改进资产而不是临时因果链", async () => {
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
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), [
    "problem-improvement-001",
    "northeastern-university-body-001",
  ]);
  const payload = mapRenderPayload(page, intent, { selectedAssetId: "problem-improvement-001" });
  assert.equal(payload.parameters.problems.length, 2);
  assert.equal(payload.parameters.improvements.length, 2);
  assert.equal(payload.parameters.improvements[1].emphasis, true);
});

test("层级语义可以确定性映射到核心三层组织树", async () => {
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
  assert.equal(set.candidates[0].assetId, "organization-tree-001");
  const payload = mapRenderPayload(page, intent, { selectedAssetId: "organization-tree-001" });
  assert.deepEqual(payload.parameters.leader, { name: "李明", role: "总负责人" });
  assert.equal(payload.parameters.departments.length, 2);
  assert.deepEqual(payload.parameters.departments[1].members, [
    { name: "周楠", role: "前端开发" },
    { name: "叶琳", role: "后端开发" },
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

test("分层架构使用 PageIntent 分组，不要求内容写组件专属 ID", () => {
  const page = content("system", [
    { id: "input-a", title: "材料", body: "原稿" },
    { id: "input-b", title: "规范", body: "Skin" },
    { id: "core", title: "PPagenT", body: "生成系统" },
    { id: "output-a", title: "演示", body: "可编辑 PPT" },
    { id: "output-b", title: "证据", body: "逐页 QA" },
  ]);
  const intent = enrichPageIntent(intentDraft("system-intent", "explain_architecture", "layered", {
    dimensions: { sourceCount: 2, applicationCount: 2 },
  }), page);
  const decision = {
    selectedAssetId: "layered-architecture-001",
    selectedVariantId: "default",
  };
  const payload = mapRenderPayload(page, intent, decision);
  assert.deepEqual(payload.parameters.sources, ["材料", "规范"]);
  assert.equal(payload.parameters.platform, "PPagenT");
  assert.deepEqual(payload.parameters.apps, ["演示", "证据"]);
  assert.ok(page.items.every((item) => !/^(source-|app-)|^platform$/i.test(item.id)));
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
  const page = content("parallel", [
    { id: "a", title: "A", body: "A body" },
    { id: "b", title: "B", body: "B body" },
    { id: "c", title: "C", body: "C body" },
  ]);
  const intent = enrichPageIntent(intentDraft("parallel-intent", "present_parallel_points", "parallel"), page);
  const [candidateSet] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  const candidate = candidateSet.candidates.find((item) => item.assetId === "parallel-cards-001");
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
