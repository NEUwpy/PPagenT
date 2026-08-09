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
  assert.deepEqual(set.candidates, []);
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
  })), [{ assetId: "sequential-process-001", variantId: "horizontal-cards" }]);
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
