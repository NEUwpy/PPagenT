import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildVisualCandidateSets, resolveVisualPlan } from "../src/agent/visual-resolution.mjs";
import { enrichPageIntent } from "../src/content/page-content.mjs";
import { mapRenderPayload } from "../src/render/render-payload.mjs";

const root = path.resolve(import.meta.dirname, "..");

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

test("正式流程不会把未晋升核心库的实验结构交给视觉导演", async () => {
  const page = content("topics", [
    { id: "a", title: "A", body: "A" },
    { id: "b", title: "B", body: "B" },
    { id: "c", title: "C", body: "C" },
    { id: "d", title: "D", body: "D" },
  ]);
  const intent = enrichPageIntent(intentDraft("topics-intent", "explain_topics", "hub"), page);
  const [set] = await buildVisualCandidateSets({ root, pageContents: [page], pageIntents: [intent] });
  assert.deepEqual(set.candidates.map((candidate) => candidate.assetId), ["northeastern-university-body-001"]);
  assert.ok(set.candidates.every((candidate) => candidate.familyId !== "radial-hub"));
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

  const rejected = await resolveVisualPlan({
    ...common,
    compositionPlan: { pages: [{ ...validPage, textSlots: [validPage.textSlots[0]] }] },
  });
  assert.equal(rejected.status, "needs-director-revision");
  assert.ok(rejected.feedback[0].issues.some((issue) => issue.code === "composition-content-unplaced"));
});
