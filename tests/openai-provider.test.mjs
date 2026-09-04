import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  candidateSetsForVisualDirector,
  createModelDirectorProvider,
  normalizeVisualCompositionOutput,
} from "../src/agent/model-director-provider.mjs";
import { OpenAIJsonModel } from "../src/agent/openai-director-provider.mjs";
import { loadDirectorGuidelines } from "../src/agent/director-guidelines.mjs";
import { loadDirectorOutputSchemas } from "../src/agent/director-output-schemas.mjs";

test("不兼容结构候选转为内容契约缺口时不会在视觉导演前崩溃", () => {
  const [result] = candidateSetsForVisualDirector([{
    pageId: "p1",
    intentId: "i1",
    candidates: [{
      assetId: "incompatible-001",
      structureGroupId: "parallel",
      familyId: "parallel-cards",
      variantId: "equal",
      silhouette: "cards",
      readiness: "incompatible",
      reasons: ["content-contract-mismatch"],
      fallbackBody: false,
    }],
  }]);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.gap.type, "content-contract-gap");
});

test("模型 DirectorProvider 为两位导演和研发审查调用传入明确输出 schema 与渲染图片", async () => {
  const calls = [];
  const model = {
    identity: "fake:model",
    async generateJson(input) {
      calls.push(input);
      if (input.outputSchema.name === "visualIntent") return { pageIntents: [] };
      if (input.outputSchema.name === "contentDirector") {
        return {
          schemaVersion: "0.1",
          deckMetadata: {
            deckId: "test-deck",
            title: "测试稿",
            communicationJob: "说明原稿",
            audience: "测试者",
            audienceOutcome: "理解原稿",
            centralTakeaway: "说明原稿。",
            narrativeArc: ["说明"],
          },
          contentMarkdown: "# 原稿\n\n> 说明唯一内容。\n\n## 内容\n\n原稿。",
          pageMetadata: [{
            logicIntent: {
              logicId: "editorial", reason: "原稿只有一个陈述", evidenceFragments: ["原稿"], confidence: "high",
            },
            sourceAnchors: ["原稿"],
          }],
        };
      }
      return {};
    },
  };
  const schemas = Object.fromEntries(
    ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"]
      .map((name) => [name, { name, schema: { type: "object" } }]),
  );
  schemas.visualIntent.schema = {
    type: "object",
    properties: {
      pageIntents: { items: { properties: { purposeKey: { type: "string" } } } },
    },
  };
  const provider = createModelDirectorProvider({
    contentModel: model, visualModel: model, reviewerModel: model, schemas,
    guidelines: {
      content: "内容准则",
      visual: "视觉准则",
      structureCapabilities: [{
        logicId: "parallel",
        contentShapes: [{ contentShape: "两个同级要点" }],
      }],
      purposeVocabulary: [{ key: "explain_topics", description: "说明主题" }],
    },
  });
  await provider.contentDirector({ rawMarkdown: "原稿", attempt: 1 });
  await provider.contentReview({ rawMarkdown: "原稿", attempt: 1, deckPlan: {}, pageContents: [] });
  await provider.refineContent({
    requests: [{ pageId: "p1", itemIds: ["i1"], maxPointsPerItem: 3, maxPointChars: 8 }],
    pages: [{ pageId: "p1", sourceText: "原稿", items: [] }],
  });
  await provider.visualDirector({ phase: "composition", attempt: 1, deckPlan: {}, pageContents: [], candidateSets: [] });
  await provider.visualReview({ stage: "post-render", pageEvidence: ["a.png"], attempt: 1 });
  assert.deepEqual(calls.map((call) => call.outputSchema.name), [
    "contentDirector", "contentReview", "ppagent_content_refinement", "ppagent_visual_skill_routing", "visualReview",
  ]);
  assert.deepEqual(calls.at(-1).imagePaths, ["a.png"]);
  assert.equal(calls[0].context.executionGuidelines, "内容准则");
  assert.equal(calls[0].context.structureCapabilities[0].logicId, "parallel");
  assert.match(calls[0].role, /判断优先级/);
  assert.match(calls[0].task, /一次完成 contentMarkdown/);
  assert.match(calls[0].task, /每个 H1 就是一页/);
  assert.match(calls[0].task, /requiredFields/);
  assert.equal(calls[0].maxJsonAttempts, 1);
  assert.doesNotMatch(calls[0].task, /comparison-dual-verdict/);
  assert.deepEqual(Object.keys(calls[2].context).sort(), ["pages", "requests"]);
  assert.deepEqual(calls[3].context.pages, []);
  assert.match(calls[3].task, /Skills/);
  assert.equal(calls[3].maxJsonAttempts, 2);
  assert.equal(provider.metadata.providerKind, "live-schema-aware-model-provider");
});

test("视觉导演超过八页时按原页序分批并携带此前选择", async () => {
  const calls = [];
  const model = {
    identity: "batch-test",
    supportsImages: true,
    async generateJson(request) {
      calls.push(request);
      return {
        selections: request.context.pages.map((page) => ({
          pageId: page.pageId,
          candidateId: page.candidates[0].candidateId,
          centerLabel: "核心判断",
        })),
      };
    },
  };
  const schemas = Object.fromEntries(
    ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"]
      .map((name) => [name, { name, schema: { type: "object" } }]),
  );
  const provider = createModelDirectorProvider({
    root: path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1")),
    contentModel: model, visualModel: model, reviewerModel: model, schemas,
  });
  const pageContents = Array.from({ length: 10 }, (_, index) => ({
    pageId: `page-${index + 1}`,
    title: `页面${index + 1}`,
    items: [{ id: `item-${index + 1}`, title: "要点", body: "正文" }],
  }));
  const pageIntents = pageContents.map((page) => ({
    intentId: `${page.pageId}-intent`,
    baseRelation: "editorial",
    purposeKey: "explain_topics",
  }));
  const candidateSets = pageContents.map((page) => ({
    pageId: page.pageId,
    candidates: [{
      assetId: "hub-directed-outcomes-002",
      logicId: "editorial",
      structureGroupId: "editorial-body",
      familyId: "skin-body-editorial",
      variantId: "editorial",
      silhouette: "editorial-page",
      readiness: "ready",
      mediaContract: { mode: "no-image" },
      slotCapabilities: { textSlots: [] },
      compositions: [{
        id: "editorial-single-focus",
        requiresComponent: false,
        slots: [{ id: "primary", role: "text" }],
      }],
    }],
  }));
  const output = await provider.visualDirector({
    phase: "composition",
    deckPlan: { deckId: "deck" },
    skinId: "skin",
    pageContents,
    pageIntents,
    candidateSets,
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.context.pages.length), [8, 2]);
  assert.equal(calls[0].context.batch.count, 2);
  assert.equal(calls[0].imagePaths.length, 1);
  assert.equal(calls[0].context.visualEvidence[0].assetId, "hub-directed-outcomes-002");
  assert.equal(calls[0].context.priorSelections.length, 0);
  assert.equal(calls[1].context.priorSelections.length, 8);
  assert.deepEqual(output.visualPlan.pages.map((page) => page.pageId), pageContents.map((page) => page.pageId));
});

test("API 运行时直接读取正式生成工作流中的两份导演提示词", async () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
  const guidelines = await loadDirectorGuidelines(root);
  assert.match(guidelines.content, /单次调用中的工作顺序/);
  assert.match(guidelines.visual, /不得现场自创结构/);
  assert.match(guidelines.visual, /整页信息构成/);
  assert.ok(guidelines.logicSkillIndex.length >= 8);
  assert.ok(guidelines.logicSkillIndex.some((logic) => (
    logic.logicId === "parallel" && logic.availableStructureGroupCount > 0
  )));
  assert.ok(guidelines.logicSkillIndex.every((logic) => !("structureGroups" in logic)));
  assert.ok(guidelines.structureCapabilities.length >= 12);
  assert.ok(guidelines.structureCapabilities.some((capability) => (
    capability.logicId === "sequence"
    && capability.contentShapes.some((shape) => shape.requiredFields.includes("items[].points"))
  )));
  const disclosed = JSON.stringify(guidelines.structureCapabilities);
  assert.doesNotMatch(disclosed, /assetId|familyId|variantId|silhouette/);
});

test("内容导演真实输出 Schema 接受 Markdown 元数据和三维邻接矩阵", async () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
  const schemas = await loadDirectorOutputSchemas(root);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schemas.contentDirector.schema);
  const value = {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "deck",
      title: "标题",
      communicationJob: "说明层级",
      audience: "团队",
      audienceOutcome: "理解关系",
      centralTakeaway: "说明上下归属。",
      narrativeArc: ["解释层级"],
    },
    contentMarkdown: "# 页面\n\n> 职责\n\n## 上层\n正文\n\n## 下层\n正文",
    pageMetadata: [{
      logicIntent: {
        logicId: "hierarchy", reason: "存在上下归属", evidenceFragments: ["层级"], confidence: "high",
      },
      itemMetadata: [{ emphasis: true }, { polarity: "neutral" }],
      sourceBlockIds: ["source-001"],
      relationBindings: {
        type: "hierarchy",
        literals: [{ path: "/adjacency", value: [[[1, 0], [0, 1]]] }],
        references: [{ path: "/layers/0/0/label", ref: "item:1.title" }],
      },
    }],
  };
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
});

test("内容导演 Schema 允许一页引用超过两个必要来源段落", async () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
  const schemas = await loadDirectorOutputSchemas(root);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schemas.contentDirector.schema);
  const value = {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "deck", title: "标题", communicationJob: "汇总事实", audience: "团队",
      audienceOutcome: "理解事实", centralTakeaway: "事实共同成立", narrativeArc: ["汇总"],
    },
    contentMarkdown: "# 页面\n\n> 汇总事实\n\n## 事实\n正文",
    pageMetadata: [{
      logicIntent: {
        logicId: "parallel", reason: "多项事实同级", evidenceFragments: ["事实"], confidence: "high",
      },
      sourceBlockIds: [
        "source-001", "source-002", "source-003", "source-004", "source-005",
      ],
    }],
  };
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
});

test("视觉编排只重做失败页并把组件文字合同编译为合法字段", () => {
  const pageContents = [{
    pageId: "p1",
    title: "作品变能力",
    items: [
      { id: "work", title: "作品", body: "形成漂亮页面" },
      { id: "rule", title: "规律", body: "提炼内在机制" },
    ],
  }, {
    pageId: "p2",
    title: "保持已通过页面",
    items: [{ id: "stable", title: "稳定", body: "不应在重试中退化" }],
  }];
  const componentCandidate = {
    familyId: "sequence-process",
    variantId: "continuous-numbered-rail",
    silhouette: "continuous-arrow-rail",
    contentContract: { points: "optional" },
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [
      { role: "item-title", sourceField: "title", maxChars: 8, maxLines: 1 },
      { role: "item-body", sourceField: "support", maxChars: 20, maxLines: 2 },
    ] },
    compositions: [{ id: "component-full", requiresComponent: true, slots: [{ id: "component", role: "component" }] }],
  };
  const fallbackCandidate = {
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    contentContract: null,
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [] },
    compositions: [{ id: "editorial-single-focus", requiresComponent: false, slots: [{ id: "primary", role: "text" }] }],
  };
  const output = {
    visualPlan: { pages: [
      { pageId: "shell-cover", familyId: "skin-cover", variantId: "default", silhouette: "cover" },
      { pageId: "p1", familyId: componentCandidate.familyId, variantId: componentCandidate.variantId, silhouette: componentCandidate.silhouette },
      { pageId: "p2", familyId: "bad", variantId: "bad", silhouette: "bad" },
    ] },
    compositionPlan: { pages: [
      { pageId: "shell-cover", compositionId: "fixed-cover", componentItemIds: [], componentContentMode: "none", textSlots: [] },
      {
        pageId: "p1",
        compositionId: "component-full",
        componentItemIds: ["work", "rule"],
        componentContentMode: "full",
        textSlots: [
          { slotId: "item-title", sourceItemIds: ["work"], contentMode: "title" },
          { slotId: "item-title", sourceItemIds: ["rule"], contentMode: "title" },
        ],
        componentText: [{ sourceItemId: "work", sourceField: "title", targetRole: "item-title", text: "作品", sourceFragment: "作品" }],
      },
      { pageId: "p2", compositionId: "bad", componentItemIds: [], componentContentMode: "none", textSlots: [] },
    ] },
  };
  const previousP2Visual = {
    pageId: "p2", familyId: fallbackCandidate.familyId, variantId: fallbackCandidate.variantId,
    silhouette: fallbackCandidate.silhouette,
  };
  const previousP2Composition = {
    pageId: "p2", compositionId: "editorial-single-focus", componentItemIds: [],
    componentContentMode: "none", textSlots: [{ slotId: "primary", sourceItemIds: ["stable"], contentMode: "full" }],
  };
  const normalized = normalizeVisualCompositionOutput(output, {
    pageContents,
    candidateSets: [
      { pageId: "p1", candidates: [componentCandidate] },
      { pageId: "p2", candidates: [fallbackCandidate] },
    ],
    previousResolution: { feedback: [{ pageId: "p1" }] },
    previous: {
      visualPlan: { pages: [previousP2Visual] },
      compositionPlan: { pages: [previousP2Composition] },
    },
  });
  assert.deepEqual(normalized.visualPlan.pages[1], previousP2Visual);
  assert.deepEqual(normalized.compositionPlan.pages[1], previousP2Composition);
  assert.deepEqual(normalized.compositionPlan.pages[0].textSlots, []);
  assert.deepEqual(
    normalized.compositionPlan.pages[0].componentText.map((entry) => [entry.sourceItemId, entry.sourceField, entry.text]),
    [
      ["work", "title", "作品"],
      ["work", "support", "形成漂亮页面"],
      ["rule", "title", "规律"],
      ["rule", "support", "提炼内在机制"],
    ],
  );
});

test("视觉重试采用解析器给出的同候选合法 Composition", () => {
  const candidate = {
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    compositionIds: ["editorial-focus", "editorial-single-focus"],
    mediaContract: { mode: "no-image" },
    slotCapabilities: { textSlots: [] },
    compositions: [
      { id: "editorial-focus", requiresComponent: false, slots: [{ id: "primary", role: "text" }, { id: "support", role: "text" }] },
      { id: "editorial-single-focus", requiresComponent: false, slots: [{ id: "primary", role: "text" }] },
    ],
  };
  const visualPage = {
    pageId: "p1", familyId: candidate.familyId, variantId: candidate.variantId, silhouette: candidate.silhouette,
  };
  const normalized = normalizeVisualCompositionOutput({
    visualPlan: { pages: [visualPage] },
    compositionPlan: { pages: [{
      pageId: "p1", intentId: "p1-intent", compositionId: "editorial-focus",
      componentItemIds: [], componentContentMode: "none",
      textSlots: [{ slotId: "primary", sourceItemIds: ["thesis"], contentMode: "full" }],
      reason: "突出核心判断",
    }] },
  }, {
    pageContents: [{ pageId: "p1", title: "核心判断", items: [{ id: "thesis", title: "判断", body: "正文" }] }],
    candidateSets: [{ pageId: "p1", candidates: [candidate] }],
    previous: { visualPlan: { pages: [visualPage] }, compositionPlan: { pages: [] } },
    previousResolution: { feedback: [{
      pageId: "p1",
      issues: [{ code: "composition-required-text-slot-unfilled" }],
      legalAlternatives: [{
        compositionId: "editorial-single-focus", componentItemIds: [], componentContentMode: "none",
        textSlots: [{ slotId: "primary", sourceItemIds: ["thesis"], contentMode: "full" }],
      }],
    }] },
  });
  assert.equal(normalized.compositionPlan.pages[0].compositionId, "editorial-single-focus");
  assert.deepEqual(normalized.compositionPlan.pages[0].textSlots, [
    { slotId: "primary", sourceItemIds: ["thesis"], contentMode: "full" },
  ]);
});

test("OpenAI Responses 客户端发送 JSON Schema 并把逐页 PNG 作为视觉输入", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-openai-provider-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  const imagePath = path.join(tempDir, "page.png");
  await fs.writeFile(imagePath, Buffer.from([137, 80, 78, 71]));
  let requestBody = null;
  const model = new OpenAIJsonModel({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }] }; } };
    },
  });
  const output = await model.generateJson({
    role: "审查者",
    task: "逐页审查",
    context: { stage: "post-render" },
    outputSchema: { name: "review", schema: { type: "object", properties: { ok: { type: "boolean" } } } },
    imagePaths: [imagePath],
  });
  assert.deepEqual(output, { ok: true });
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.name, "review");
  assert.equal(requestBody.input[1].content[1].type, "input_image");
  assert.match(requestBody.input[1].content[1].image_url, /^data:image\/png;base64,/);
});
