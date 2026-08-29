import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateSetsForVisualDirector,
  createModelDirectorProvider,
} from "../src/agent/model-director-provider.mjs";
import { expandVisualSkillRouting } from "../src/agent/visual-skill-router.mjs";

const structural = { assetId: "structure", fallbackBody: false };
const fallback = { assetId: "body", fallbackBody: true };

test("已有合法结构时视觉导演看不到正文兜底", () => {
  const [set] = candidateSetsForVisualDirector([{
    pageId: "p1",
    candidates: [structural, fallback],
  }]);
  assert.deepEqual(set.candidates.map((item) => item.assetId), ["structure"]);
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
  assert.equal(needsRefinement.gap.type, "asset-gap");
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
    candidateSets: [{ pageId: "p1", candidates: [readyCandidate, fallbackCandidate] }],
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
  assert.equal(result.gap.type, "asset-gap");
});
