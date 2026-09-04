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
  assetId: "hub-radial-001",
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

test("锁定 Structure Group 的页面仍向视觉导演披露展示适配字段", () => {
  const sets = [{
    pageId: "p1",
    candidates: [{ ...core, readiness: "ready", reasons: ["semantic-contract-compatible"], selectionMode: "group-locked" }],
    fallbackCandidate: { ...fallback, readiness: "fallback" },
    selectionMode: "group-locked",
    lockedStructureGroupId: "hub-radial-anchor",
  }];
  const compact = compactVisualSkillContext([page], [intent], sets);
  assert.equal(compact[0].selectionMode, "group-locked");
  assert.equal(compact[0].lockedStructureGroupId, "hub-radial-anchor");
  assert.deepEqual(compact[0].expressionStrategies, ["registered-structure"]);
  assert.deepEqual(Object.keys(compact[0].candidates[0]).sort(), [
    "candidateId", "compositionOptions", "fallbackBody", "iconSourceItemIds", "iconsRequiredPerItem", "itemRange", "logicId",
    "mediaMode", "readiness", "reasons", "selectionMode", "structureGroupId", "textRegions",
  ]);
  const schema = visualSkillRoutingSchema([page], sets);
  assert.equal(schema.schema.properties.selections.minItems, 1);
  const pageSchema = schema.schema.properties.selections.items.anyOf[0];
  assert.deepEqual(pageSchema.required, [
    "pageId", "candidateId", "centerLabel", "pageRole", "densityTarget",
    "visualWeight", "compositionId", "compositionFamily",
  ]);
  assert.equal(pageSchema.properties.pageId.const, "p1");
  assert.equal(pageSchema.properties.candidateId.const, "hub-radial::balanced-orbit-anchor::radial");
  assert.deepEqual(pageSchema.properties.expressionStrategy.enum, ["registered-structure"]);

  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "hub-radial::balanced-orbit-anchor::radial",
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
  assert.equal(expanded.visualPlan.pages[0].expressionStrategy, "registered-structure");
  assert.equal(expanded.visualPlan.pages[0].iconQueries.length, 3);
  assert.deepEqual(expanded.compositionPlan.pages[0].componentItemIds, ["a", "b", "c"]);
  assert.equal(expanded.compositionPlan.pages[0].componentText[0].text, "判断中心");
  assert.deepEqual(expanded.compositionPlan.pages[0].textLayoutChoices, [{
    regionKey: "items[].support",
    layoutId: "statement-flow",
  }]);
});

test("视觉路由可省略空数组和理由并由程序补默认值", () => {
  const sets = [{ pageId: "p1", candidates: [fallback] }];
  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "skin-body-editorial::editorial::editorial-page",
    centerLabel: "判断中心",
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: sets,
  });
  assert.match(expanded.visualPlan.pages[0].reason, /视觉导演选择/);
  assert.equal(expanded.visualPlan.pages[0].expressionStrategy, "registered-structure");
  assert.deepEqual(expanded.compositionPlan.pages[0].textLayoutChoices, []);
});

test("视觉导演可在合法正文 Composition 内重排内容槽位", () => {
  const sets = [{ pageId: "p1", candidates: [fallback] }];
  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "skin-body-editorial::editorial::editorial-page",
    centerLabel: "判断中心",
    compositionId: "editorial-list",
    textSlotAssignments: [
      { slotId: "lead", sourceItemIds: ["b"], contentMode: "full" },
      { slotId: "body", sourceItemIds: ["a", "c"], contentMode: "full" },
    ],
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: sets,
  });
  assert.deepEqual(expanded.compositionPlan.pages[0].textSlots, [
    { slotId: "lead", sourceItemIds: ["b"], contentMode: "full" },
    { slotId: "body", sourceItemIds: ["a", "c"], contentMode: "full" },
  ]);
});

test("未验收的2+3表达不能进入自动正式生成", () => {
  const set = {
    pageId: "p1",
    candidates: [core],
    selectionMode: "group-locked",
    lockedStructureGroupId: core.structureGroupId,
  };
  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "hub-radial::balanced-orbit-anchor::radial",
    centerLabel: "判断中心",
    expressionStrategy: "multi-structure",
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: [set],
  });
  assert.equal(expanded.visualPlan.pages[0].expressionStrategy, "registered-structure");
  assert.match(expanded.visualPlan.pages[0].reason, /尚未通过视觉验收/);
  assert.equal(expanded.routingDiagnostics[0].code, "automatic-unapproved-expression-demoted");
});

test("结构化输入图标契约不会把普通 items 当作图标来源", () => {
  const candidate = {
    ...core,
    mediaContract: {
      mode: "semantic-icon",
      source: "structuredData.inputs",
      requiredPerInput: false,
    },
  };
  const sets = [{
    pageId: "p1",
    candidates: [candidate],
    selectionMode: "group-locked",
    lockedStructureGroupId: candidate.structureGroupId,
  }];
  const compact = compactVisualSkillContext([page], [intent], sets);
  assert.deepEqual(compact[0].candidates[0].iconSourceItemIds, []);
  const pageSchema = visualSkillRoutingSchema([page], sets)
    .schema.properties.selections.items.anyOf[0];
  assert.equal(pageSchema.properties.iconQueries.items.properties.sourceItemId.const, "__no-source-item__");

  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "hub-radial::balanced-orbit-anchor::radial",
    centerLabel: "共同目标",
    iconQueries: page.items.map((item) => ({ sourceItemId: item.id, query: "target" })),
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: sets,
  });
  assert.deepEqual(expanded.visualPlan.pages[0].iconQueries, []);
});

test("多候选重复选择只记录而不再被程序静默改选", () => {
  const alternate = {
    ...core,
    assetId: "hub-directed-outcomes-002",
    structureGroupId: "hub-directed-outcomes",
    familyId: "hub-directed-outcomes",
    variantId: "directed-outcomes",
    silhouette: "directed-radial",
    mediaContract: { mode: "no-image" },
  };
  const pages = [
    page,
    { ...page, pageId: "p2", title: "第二个中心主题" },
  ];
  const intents = [
    intent,
    { ...intent, intentId: "p2-intent" },
  ];
  const candidateSets = pages.map((item) => ({ pageId: item.pageId, candidates: [core, alternate] }));
  const routing = { selections: pages.map((item) => ({
    pageId: item.pageId,
    candidateId: "hub-radial::balanced-orbit-anchor::radial",
    centerLabel: "中心",
    iconQueries: [],
    textLayoutChoices: [],
    refinementItemIds: [],
    reason: "模型连续选择同一结构",
  })) };
  const expanded = expandVisualSkillRouting(routing, {
    deckPlan: { deckId: "deck" },
    skinId: "skin",
    pageContents: pages,
    pageIntents: intents,
    candidateSets,
  });
  assert.deepEqual(expanded.visualPlan.pages.map((item) => item.familyId), [
    "hub-radial",
    "hub-radial",
  ]);
  assert.match(expanded.visualPlan.pages[1].reason, /保留视觉导演选择并记录重复/);
});

test("逐页 schema 不允许把另一页候选填到锁定页", () => {
  const second = {
    ...core,
    assetId: "sequence-flow-001",
    structureGroupId: "sequence-flow",
    familyId: "sequence-process",
    variantId: "flow",
    silhouette: "rail",
  };
  const pages = [page, { ...page, pageId: "p2" }];
  const intents = [intent, { ...intent, intentId: "p2-intent" }];
  const sets = [
    {
      pageId: "p1", candidates: [core], selectionMode: "group-locked", lockedStructureGroupId: core.structureGroupId,
    },
    {
      pageId: "p2", candidates: [second], selectionMode: "group-locked", lockedStructureGroupId: second.structureGroupId,
    },
  ];
  const schema = visualSkillRoutingSchema(pages, sets).schema.properties.selections.items.anyOf;
  assert.equal(schema[0].properties.candidateId.const, "hub-radial::balanced-orbit-anchor::radial");
  assert.equal(schema[1].properties.candidateId.const, "sequence-process::flow::rail");
  assert.notEqual(schema[0].properties.candidateId.const, schema[1].properties.candidateId.const);
});

test("锁定页忽略越权 candidateId 并继续应用实际候选的展示字段", () => {
  const alternate = {
    ...core,
    assetId: "hub-directed-outcomes-002",
    structureGroupId: "hub-directed-outcomes",
    familyId: "hub-directed-outcomes",
    variantId: "directed-outcomes",
    silhouette: "directed-radial",
  };
  const set = {
    pageId: "p1",
    candidates: [core, alternate],
    selectionMode: "group-locked",
    lockedStructureGroupId: core.structureGroupId,
  };
  const expanded = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "hub-directed-outcomes::directed-outcomes::directed-radial",
    centerLabel: "锁定中心",
    textLayoutChoices: [{ regionKey: "items[].support", layoutId: "statement-flow" }],
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: [set],
  });
  assert.equal(expanded.visualPlan.pages[0].familyId, core.familyId);
  assert.equal(expanded.compositionPlan.pages[0].componentText[0].text, "锁定中心");
  assert.deepEqual(expanded.routingDiagnostics, [{
    pageId: "p1",
    lockedStructureGroupId: core.structureGroupId,
    ignoredRequestedCandidateId: "hub-directed-outcomes::directed-outcomes::directed-radial",
    appliedCandidateId: "hub-radial::balanced-orbit-anchor::radial",
  }]);
});

test("fallback 锁定页忽略越权 candidateId 并保持正文兜底", () => {
  const set = {
    pageId: "p1",
    candidates: [{ ...fallback, readiness: "fallback", reasons: ["asset-gap"] }],
    selectionMode: "fallback-locked",
  };
  const result = expandVisualSkillRouting({ selections: [{
    pageId: "p1",
    candidateId: "unrelated::candidate::id",
    centerLabel: "正文兜底",
  }] }, {
    deckPlan: { deckId: "deck" }, skinId: "skin", pageContents: [page], pageIntents: [intent], candidateSets: [set],
  });
  assert.equal(result.visualPlan.pages[0].familyId, fallback.familyId);
  assert.equal(result.compositionPlan.pages[0].compositionId, "editorial-list");
  assert.equal(result.routingDiagnostics[0].selectionMode, "fallback-locked");
  assert.equal(result.routingDiagnostics[0].ignoredRequestedCandidateId, "unrelated::candidate::id");
});

test("能力卡只向合法 derivable 候选披露白名单 derivationPolicy", () => {
  const candidate = {
    ...core,
    readiness: "derivable",
    derivationPolicy: { allowedFields: ["centerLabel", "compressedBody"] },
  };
  const compact = compactVisualSkillContext([page], [intent], [{
    pageId: "p1", candidates: [candidate], selectionMode: "group-locked", lockedStructureGroupId: candidate.structureGroupId,
  }]);
  assert.deepEqual(compact[0].candidates[0].derivationPolicy, {
    allowedFields: ["centerLabel", "compressedBody"],
  });
});
