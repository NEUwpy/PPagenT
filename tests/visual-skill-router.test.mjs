import assert from "node:assert/strict";
import test from "node:test";
import {
  compactVisualSkillContext,
  expandVisualSkillRouting,
  visualSkillRoutingSchema,
} from "../src/agent/visual-skill-router.mjs";

const page = {
  pageId: "p1",
  title: "这是一个无法直接放进中心圆的页面长标题",
  items: [
    { id: "a", title: "节点甲", body: "第一项" },
    { id: "b", title: "节点乙", body: "第二项" },
    { id: "c", title: "节点丙", body: "第三项" },
  ],
};
const intent = { intentId: "p1-intent", baseRelation: "hub", purposeKey: "explain_topics" };
const core = {
  logicId: "hub",
  structureGroupId: "hub-radial-anchor",
  familyId: "hub-radial",
  variantId: "balanced-orbit-anchor",
  silhouette: "radial",
  adaptationStatus: "adaptive",
  fallbackBody: false,
  contentReadiness: "ready",
  itemCount: { min: 3, preferred: [3, 4, 5], max: 6 },
  mediaContract: { mode: "semantic-icon", requiredPerComponentItem: true },
  slotCapabilities: { textSlots: [{ role: "center-title", maxChars: 8 }] },
  textRegions: [{
    regionKey: "items[].support",
    contentRoles: ["body"],
    defaultLayoutId: "heading-content-flow",
    compatibleLayoutIds: ["statement-flow", "heading-content-flow"],
    frameRange: { minWidth: 240, maxWidth: 280, minHeight: 130, maxHeight: 180 },
  }],
  compositions: [{ id: "component-full", requiresComponent: true, slots: [{ id: "component", role: "component" }] }],
};
const fallback = {
  logicId: "skin",
  structureGroupId: "editorial",
  familyId: "skin-body-editorial",
  variantId: "editorial",
  silhouette: "editorial-page",
  adaptationStatus: "adaptive",
  fallbackBody: true,
  itemCount: { min: 0, preferred: [2, 3, 4], max: 20 },
  mediaContract: { mode: "no-image" },
  compositions: [{
    id: "editorial-list",
    requiresComponent: false,
    slots: [{ id: "lead", role: "text" }, { id: "body", role: "text" }],
  }],
};

test("视觉路由只看紧凑 Skill 摘要并由程序展开正式表单", () => {
  const sets = [{ pageId: "p1", candidates: [core, fallback] }];
  const compact = compactVisualSkillContext([page], [intent], sets);
  assert.deepEqual(Object.keys(compact[0].candidates[0]).sort(), [
    "candidateId", "contentReadiness", "fallbackBody", "iconsRequiredPerItem",
    "itemRange", "logicId", "mediaMode", "structureGroupId", "textRegions",
  ]);
  const schema = visualSkillRoutingSchema([page], sets);
  assert.equal(schema.schema.properties.selections.minItems, 1);

  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "skin-body-editorial::editorial::editorial-page",
    centerLabel: "判断中心",
    iconQueries: [
      { sourceItemId: "a", query: "target" },
      { sourceItemId: "b", query: "route" },
      { sourceItemId: "c", query: "result" },
    ],
    textLayoutChoices: [{ regionKey: "items[].support", layoutId: "statement-flow" }],
    refinementItemIds: [],
    reason: "模型误选 fallback",
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: sets,
  });
  assert.equal(expanded.visualPlan.pages[0].familyId, "hub-radial");
  assert.equal(expanded.visualPlan.pages[0].iconQueries.length, 3);
  assert.deepEqual(expanded.compositionPlan.pages[0].componentItemIds, ["a", "b", "c"]);
  assert.equal(expanded.compositionPlan.pages[0].componentText[0].text, "判断中心");
  assert.deepEqual(expanded.compositionPlan.pages[0].textLayoutChoices, [{
    regionKey: "items[].support",
    layoutId: "statement-flow",
  }]);
});
