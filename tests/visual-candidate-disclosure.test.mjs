import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateSetsForVisualDirector,
  createModelDirectorProvider,
} from "../src/agent/model-director-provider.mjs";
import { expandVisualSkillRouting } from "../src/agent/visual-skill-router.mjs";

const structural = { assetId: "structure", structureGroupId: "structure-group", fallbackBody: false };
const fallback = { assetId: "body", structureGroupId: "editorial", fallbackBody: true };

test("已有合法结构时视觉导演看不到正文兜底", () => {
  const [set] = candidateSetsForVisualDirector([{
    pageId: "p1",
    candidates: [structural, fallback],
  }]);
  assert.deepEqual(set.candidates.map((item) => item.assetId), ["structure"]);
  assert.equal(set.selectionMode, "group-locked");
  assert.equal(set.lockedStructureGroupId, "structure-group");
});

test("没有结构或组件已实际溢出时才披露正文兜底", () => {
  const [noStructure] = candidateSetsForVisualDirector([{ pageId: "p1", candidates: [fallback] }]);
  assert.deepEqual(noStructure.candidates.map((item) => item.assetId), ["body"]);

  const [overflow] = candidateSetsForVisualDirector(
    [{ pageId: "p2", candidates: [structural, fallback] }],
    [{ pageId: "p2", code: "component-runtime-overflow" }],
  );
  assert.deepEqual(overflow.candidates.map((item) => item.assetId), ["body"]);

  const [needsRefinement] = candidateSetsForVisualDirector([{
    pageId: "p3",
    candidates: [{ ...structural, contentReadiness: "needs-semantic-refinement" }, fallback],
  }]);
  assert.deepEqual(needsRefinement.candidates, []);
  assert.equal(needsRefinement.gap.type, "content-contract-gap");
  assert.equal(needsRefinement.selectionMode, undefined);
});

test("derivable 是合法结构但旧缺分点状态仍是不兼容", () => {
  const [set] = candidateSetsForVisualDirector([{
    pageId: "p1",
    candidates: [
      {
        ...structural,
        assetId: "derived",
        readiness: "derivable",
        reasons: ["display-label"],
        derivationPolicy: { allowedFields: ["centerLabel"] },
      },
      { ...structural, assetId: "legacy", contentReadiness: "needs-semantic-refinement" },
      fallback,
    ],
  }]);
  assert.deepEqual(set.candidates.map((item) => item.assetId), ["derived"]);
  assert.equal(set.candidates[0].readiness, "derivable");
  assert.deepEqual(set.candidates[0].derivationPolicy, { allowedFields: ["centerLabel"] });
  assert.equal("contentReadiness" in set.candidates[0], false);
  assert.equal(set.selectionMode, "group-locked");
});

test("derivable 必须有合法 derivationPolicy，reasons 不授予权限", () => {
  const candidates = [
    { ...structural, assetId: "missing-policy", readiness: "derivable", reasons: ["centerLabel"] },
    {
      ...structural,
      assetId: "illegal-policy",
      readiness: "derivable",
      derivationPolicy: { allowedFields: ["newNodes"] },
    },
  ];
  const [set] = candidateSetsForVisualDirector([{ pageId: "p1", candidates }]);
  assert.deepEqual(set.candidates, []);
  assert.equal(set.gap.type, "content-contract-gap");
});

test("内容契约或容量缺口不得披露内部 fallbackCandidate", () => {
  for (const type of ["content-contract-gap", "content-capacity-gap"]) {
    const [set] = candidateSetsForVisualDirector([{
      pageId: type,
      candidates: [],
      fallbackCandidate: fallback,
      gap: { type },
    }]);
    assert.deepEqual(set.candidates, []);
    assert.equal(set.selectionMode, undefined);
    assert.equal(set.gap.type, type);
  }
});

test("旧 contentReadiness 正文按页面上下文区分 editorial 与 fallback", () => {
  const legacyBody = { ...fallback, contentReadiness: "ready" };
  const [editorial] = candidateSetsForVisualDirector([{ pageId: "editorial", candidates: [legacyBody] }]);
  assert.equal(editorial.candidates[0].readiness, "ready");
  assert.equal(editorial.selectionMode, "group-locked");

  const [assetGap] = candidateSetsForVisualDirector([{
    pageId: "gap",
    gap: { type: "asset-gap" },
    candidates: [legacyBody],
  }]);
  assert.equal(assetGap.candidates[0].readiness, "fallback");
  assert.equal(assetGap.selectionMode, "fallback-locked");

  const [overflow] = candidateSetsForVisualDirector(
    [{ pageId: "overflow", candidates: [structural], fallbackCandidate: legacyBody }],
    [{ pageId: "overflow", code: "component-runtime-overflow" }],
  );
  assert.equal(overflow.candidates[0].readiness, "fallback");
  assert.equal(overflow.selectionMode, "fallback-locked");
});

test("组件实际溢出后后续路由不能把正文兜底改回结构组件", async () => {
  const readyCandidate = {
    ...structural,
    familyId: "sequence-process",
    variantId: "ready",
    silhouette: "continuous-rail",
    contentReadiness: "ready",
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [] },
    compositions: [{ id: "component-full", requiresComponent: true, slots: [{ id: "component", role: "component" }] }],
  };
  const fallbackCandidate = {
    ...fallback,
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    contentReadiness: "ready",
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [] },
    compositions: [{ id: "editorial-single-focus", requiresComponent: false, slots: [{ id: "primary", role: "text" }] }],
  };
  const model = {
    identity: "fake:model",
    async generateJson() {
      return {
        selections: [{
          pageId: "p1",
          candidateId: "skin-body-editorial::editorial::editorial-page",
          centerLabel: "正文内容",
          iconQueries: [],
          textLayoutChoices: [],
          refinementItemIds: [],
          reason: "组件实际溢出后使用正文兜底",
        }],
      };
    },
  };
  const schemas = Object.fromEntries(
    ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"]
      .map((name) => [name, { name, schema: { type: "object" } }]),
  );
  const provider = createModelDirectorProvider({
    contentModel: model,
    visualModel: model,
    reviewerModel: model,
    schemas,
    guidelines: {},
  });
  const result = await provider.visualDirector({
    phase: "composition",
    deckPlan: { deckId: "deck" },
    skinId: "skin",
    pageContents: [{ pageId: "p1", title: "页面", items: [{ id: "i1", title: "要点", body: "正文" }] }],
    pageIntents: [{ intentId: "intent-p1", baseRelation: "sequence", purposeKey: "explain_process" }],
    candidateSets: [{
      pageId: "p1",
      candidates: [readyCandidate],
      fallbackCandidate,
    }],
    previousResolution: { feedback: [{ pageId: "p1", code: "component-runtime-overflow" }] },
  });

  assert.equal(result.visualPlan.pages[0].familyId, "skin-body-editorial");
  assert.equal(result.compositionPlan.pages[0].compositionId, "editorial-single-focus");
});

test("临时结构尚未补齐语义时不再向视觉导演披露正文兜底", () => {
  const provisional = {
    familyId: "sequence",
    variantId: "needs-points",
    silhouette: "phase-gates",
    contentReadiness: "needs-semantic-refinement",
    fallbackBody: false,
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [] },
    compositions: [{ id: "component-full", requiresComponent: true, slots: [{ id: "component", role: "component" }] }],
  };
  const body = {
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    contentReadiness: "ready",
    fallbackBody: true,
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [] },
    compositions: [{ id: "editorial-single-focus", requiresComponent: false, slots: [{ id: "primary", role: "text" }] }],
  };
  const [result] = candidateSetsForVisualDirector([{
    pageId: "p1",
    candidates: [provisional, body],
  }]);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.gap.type, "content-contract-gap");
});
