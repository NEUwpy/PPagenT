import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DirectorProviderError } from "../src/agent/director-provider.mjs";
import { runWorkflowCli } from "../src/agent/run-workflow.mjs";
import {
  DEFAULT_SKIN_ID,
  WorkflowError,
  buildAssetGapReport,
  buildProductionStatistics,
  runDirectorWorkflow,
} from "../src/agent/workflow.mjs";
import { buildVisualCandidateSets, resolveVisualPlan } from "../src/agent/visual-resolution.mjs";
import { computeContentStats } from "../src/content/page-content.mjs";
import { createRuleValidators } from "../src/selection/validation.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rawMarkdown = "# 为什么做 PPagenT\n\n模板有时尽，现状无穷多。";

function contentOutput() {
  return {
    deckPlan: {
      schemaVersion: "1.0",
      deckId: "why-ppagent",
      title: "为什么做 PPagenT",
      communicationJob: "解释为什么需要可靠而可适配的 PPT 生成系统",
      audience: "需要稳定生成演示文稿的人",
      audienceOutcome: "理解 PPagenT 要解决的真实问题",
      centralTakeaway: "模板有限，但表达需求不断变化",
      narrativeArc: ["提出矛盾"],
      pages: [{
        pageId: "problem",
        sequence: 1,
        narrativeJob: "提出模板与真实需求之间的矛盾",
        sourceAnchors: ["模板有时尽，现状无穷多。"],
      }],
    },
    pageContents: [{
      schemaVersion: "1.0",
      pageId: "problem",
      title: "模板有时尽，现状无穷多",
      items: [{ id: "point-1", title: "有限模板", body: "难以覆盖持续变化的表达需求" }],
      notes: "提出核心矛盾",
      sourceText: "模板有时尽，现状无穷多。",
    }],
  };
}

function pageIntent() {
  const page = contentOutput().pageContents[0];
  return {
    schemaVersion: "1.1",
    intentId: "problem-intent",
    purposeKey: "explain_topics",
    purposeText: "突出一个需要解决的核心矛盾",
    baseRelation: "parallel",
    relationTraits: {
      temporal: false,
      cyclic: false,
      converging: false,
      branched: false,
      dimensions: 1,
      secondaryDimension: "none",
    },
    structure: { itemCount: 1, hierarchyDepth: 1, ordered: false, sameLevel: true },
    contentStats: computeContentStats(page),
    density: "low",
    evidenceTypes: ["text"],
    confidence: 0.9,
    assumptions: [],
  };
}

function visualIntentOutput() {
  return { pageIntents: [pageIntent()] };
}

function visualPlanOutput(skinId = DEFAULT_SKIN_ID) {
  return {
    visualPlan: {
      schemaVersion: "1.0",
      deckId: "why-ppagent",
      skinId,
      visualLanguage: "继承学校模板并使用清晰的单页结构",
      rhythmStrategy: "按叙事职责改变页面轮廓",
      pages: [{
        pageId: "problem",
        intentId: "problem-intent",
        familyId: "radial-hub",
        variantId: "orbit",
        silhouette: "center-orbit",
        adaptationStatus: "adaptive",
        reason: "单页只承担一个矛盾陈述",
      }],
    },
    compositionPlan: {
      schemaVersion: "1.0",
      deckId: "why-ppagent",
      skinId,
      pages: [{
        pageId: "problem",
        intentId: "problem-intent",
        compositionId: "component-full",
        componentItemIds: ["point-1"],
        componentContentMode: "full",
        textSlots: [],
        reason: "Use the validated component in the full body frame.",
      }],
    },
  };
}

async function candidateProvider() {
  return [{
    pageId: "problem",
    intentId: "problem-intent",
    candidates: [{
      familyId: "radial-hub",
      assetId: "radial-hub-001",
      variantId: "orbit",
      silhouette: "center-orbit",
      adaptationStatus: "adaptive",
      compositionIds: ["component-full"],
    }],
  }];
}

function review({ type, stage, attempt = 1, verdict = "pass", issues = [] }) {
  return {
    schemaVersion: "1.0",
    reviewId: `${type}-${stage ?? "content"}-${attempt}`,
    deckId: "why-ppagent",
    ...(stage ? { stage } : {}),
    attempt,
    verdict,
    issues,
    summary: verdict === "pass" ? "对抗审查未发现阻断问题" : "存在必须修订的问题",
  };
}

function resolver({ compositionPlan } = {}) {
  return {
    status: "accepted",
    results: [],
    feedback: [],
    layoutDecisions: [{
      schemaVersion: "1.0",
      intentId: "problem-intent",
      decision: "single-match",
      selectedFamilyId: "radial-hub",
      selectedAssetId: "radial-hub-001",
      selectedVariantId: "orbit",
      selectedSilhouette: "center-orbit",
      selectionState: "selected",
      selectionOwner: "program",
      selectionSource: "program-locked",
      candidates: [],
      rejections: [],
      resolutionPlan: null,
    }],
    renderPayloads: [{
      schemaVersion: "1.0",
      intentId: "problem-intent",
      assetId: "radial-hub-001",
      parameters: { title: "模板有时尽，现状无穷多", items: [], visualVariantId: "orbit" },
      mappings: [],
      omissions: [],
    }],
    compositionPlan,
  };
}

async function makeTempDir(t) {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-workflow-"));
  t.after(async () => fs.rm(target, { recursive: true, force: true }));
  return target;
}

function completeProvider(overrides = {}) {
  return {
    async contentDirector() { return contentOutput(); },
    async contentReview({ attempt }) { return review({ type: "content", attempt }); },
    async visualDirector({ phase, skinId }) {
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
    async visualReview({ stage, attempt }) { return review({ type: "visual", stage, attempt }); },
    ...overrides,
  };
}

async function renderer({ outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPptx = path.join(outputDir, "deck.pptx");
  const evidence = path.join(outputDir, "slide-1.png");
  await fs.writeFile(outputPptx, "test");
  await fs.writeFile(evidence, "test");
  return { outputPptx, pageEvidence: [evidence], qualityAudit: { status: "passed" } };
}

async function dynamicRenderer({ outputDir, pageContents }) {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPptx = path.join(outputDir, "deck.pptx");
  await fs.writeFile(outputPptx, "test");
  const pageEvidence = await Promise.all(pageContents.map(async (_, index) => {
    const target = path.join(outputDir, `slide-${index + 1}.png`);
    await fs.writeFile(target, "test");
    return target;
  }));
  return { outputPptx, pageEvidence, qualityAudit: { status: "passed" } };
}

test("正式工作流在两位导演均失败时仍以确定性双兜底交付", async (t) => {
  const outputDir = await makeTempDir(t);
  const modelFailure = () => {
    const error = new Error("模型响应不可用");
    error.code = "MODEL_JSON_INVALID";
    throw error;
  };
  const result = await runDirectorWorkflow({
    root,
    input: { rawMarkdown: "# 主题\n\n第一部分说明现状。\n\n第二部分给出行动。", skinId: DEFAULT_SKIN_ID },
    provider: { contentDirector: modelFailure, visualDirector: modelFailure },
    outputDir,
    visualCandidateProvider: buildVisualCandidateSets,
    visualResolver: resolveVisualPlan,
    renderer: dynamicRenderer,
    reviewMode: "production",
    maxContentAttempts: 1,
    maxVisualAttempts: 1,
    guaranteeDelivery: true,
  });
  assert.equal(result.status, "delivered-with-fallback");
  assert.deepEqual(result.resilienceReport.events.map((event) => event.stage), ["content-director", "visual-director"]);
  await fs.access(path.join(outputDir, "resilience-report.json"));
});

test("workflow schemas including CompositionPlan are registered", async () => {
  const validators = await createRuleValidators(root);
  assert.equal(typeof validators.validateDeckPlan, "function");
  assert.equal(typeof validators.validateContentReview, "function");
  assert.equal(typeof validators.validateVisualPlan, "function");
  assert.equal(typeof validators.validateCompositionPlan, "function");
  assert.equal(typeof validators.validateVisualReview, "function");
});

test("LayoutDecision 的机器选择来源与 owner 必须显式配对", async () => {
  const validators = await createRuleValidators(root);
  const base = resolver({ compositionPlan: visualPlanOutput().compositionPlan }).layoutDecisions[0];
  const pairs = [
    ["program-locked", "program"],
    ["visual-director", "visual-director"],
    ["deterministic-ranking", "program"],
    ["deterministic-fallback", "program"],
  ];
  for (const [selectionSource, selectionOwner] of pairs) {
    assert.equal(validators.validateLayoutDecision({ ...base, selectionSource, selectionOwner }), true);
  }
  assert.equal(validators.validateLayoutDecision({
    ...base,
    selectionSource: "program-locked",
    selectionOwner: "visual-director",
  }), false);
});

test("内容导演返回空 structuredData 时按未提供处理", async (t) => {
  const outputDir = await makeTempDir(t);
  const provider = completeProvider({
    async contentDirector() {
      const output = contentOutput();
      output.pageContents[0].structuredData = {};
      return output;
    },
  });
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });
  assert.equal(result.status, "delivered");
});

test("内容导演返回 null structuredData 时按未提供处理", async (t) => {
  const outputDir = await makeTempDir(t);
  const provider = completeProvider({
    async contentDirector() {
      const output = contentOutput();
      output.pageContents[0].structuredData = null;
      return output;
    },
  });
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });
  assert.equal(result.status, "delivered");
});

test("缺少 DirectorProvider 或任一导演调用时失败关闭", async () => {
  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      outputDir: "unused",
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
    }),
    DirectorProviderError,
  );
  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider: { ...completeProvider(), visualReview: undefined },
      outputDir: "unused",
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
    }),
    /visualReview/,
  );
});

test("产品入口拒绝 pages 等人工中间对象", async () => {
  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown, pages: [] },
      provider: completeProvider(),
      outputDir: "unused",
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
    }),
    (error) => error instanceof WorkflowError && error.code === "INTERMEDIATE_INPUT_FORBIDDEN",
  );
});

test("正式 CLI 对尚未实现的 Skin 失败关闭", async () => {
  await assert.rejects(
    runWorkflowCli({
      root,
      input: "missing.md",
      skin: "other-skin",
      output: "x.pptx",
      "run-dir": "x",
      provider: "x.mjs",
    }),
    /当前 renderer 只支持 Skin：northeastern-university-001/,
  );
});

test("产品工作流只调用内容导演和视觉导演，不调用研发审查者", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let visualCalls = 0;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      return contentOutput();
    },
    async visualDirector({ phase, skinId }) {
      visualCalls += 1;
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
  };

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });

  assert.equal(result.status, "delivered");
  assert.equal(result.workflowMode, "production");
  assert.equal(contentCalls, 1);
  assert.equal(visualCalls, 1);
  await assert.rejects(fs.access(path.join(outputDir, "content", "attempt-01", "content-review.json")));
  await assert.rejects(fs.access(path.join(outputDir, "visual", "attempt-01", "visual-review-pre.json")));
  await assert.rejects(fs.access(path.join(outputDir, "visual", "attempt-01", "visual-review-post.json")));
});

test("正式生成先排版暂存 Native PPT 并确认，再交付同一份 PPTX", async (t) => {
  const outputDir = await makeTempDir(t);
  const order = [];
  let approvedStaging = null;
  const stagingRenderer = async ({ outputDir: previewDir, pageContents }) => {
    order.push("stage");
    await fs.mkdir(previewDir, { recursive: true });
    const stagedPptx = path.join(previewDir, "staged-deck.pptx");
    await fs.writeFile(stagedPptx, "test pptx");
    const pageEvidence = await Promise.all(pageContents.map(async (_, index) => {
      const target = path.join(previewDir, `slide-${index + 1}.png`);
      await fs.writeFile(target, "test image");
      return target;
    }));
    return {
      status: "ready-for-approval",
      stagedPptx,
      pageEvidence,
      pageCount: pageContents.length,
      qualityAudit: { status: "passed" },
    };
  };

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider: completeProvider(),
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    stagingRenderer,
    nativePreviewApprover: async (preview) => {
      order.push("approve");
      approvedStaging = { ...preview, approvalStatus: "approved" };
      return approvedStaging;
    },
    renderer: async (args) => {
      order.push("deliver");
      assert.equal(args.stagingResult.stagedPptx, approvedStaging.stagedPptx);
      return renderer(args);
    },
  });

  assert.equal(result.status, "delivered");
  assert.deepEqual(order, ["stage", "approve", "deliver"]);
});

test("PPT 暂存排版降级进入鲁棒性报告并标记为 delivered-with-fallback", async (t) => {
  const outputDir = await makeTempDir(t);
  const stagingRenderer = async ({ outputDir: previewDir, pageContents }) => {
    await fs.mkdir(previewDir, { recursive: true });
    const stagedPptx = path.join(previewDir, "staged-deck.pptx");
    await fs.writeFile(stagedPptx, "test pptx");
    const pageEvidence = await Promise.all(pageContents.map(async (_, index) => {
      const target = path.join(previewDir, `slide-${index + 1}.png`);
      await fs.writeFile(target, "test image");
      return target;
    }));
    return {
      status: "ready-for-approval",
      stagedPptx,
      pageEvidence,
      pageCount: pageContents.length,
      qualityAudit: { status: "passed" },
      renderFallbacks: [{
        pageId: "page-01",
        code: "multi-expression-overflow",
        from: "multi-structure",
        to: "text-plus-structure",
      }],
    };
  };

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider: completeProvider(),
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    stagingRenderer,
    renderer,
  });

  assert.equal(result.status, "delivered-with-fallback");
  assert.deepEqual(result.resilienceReport.events[0], {
    stage: "native-preview",
    code: "multi-expression-overflow",
    trigger: "multi-structure",
    message: "页面组合从 multi-structure 降级为 text-plus-structure",
    pageIds: ["page-01"],
    from: "multi-structure",
    to: "text-plus-structure",
  });
  await fs.access(path.join(outputDir, "resilience-report.json"));
});

test("视觉导演可用一次小请求补齐节点内分点且不重跑整篇内容或视觉编排", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let visualCalls = 0;
  let refinementCalls = 0;
  let candidateCalls = 0;
  let resolvedPage = null;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      return contentOutput();
    },
    async refineContent({ requests, pages }) {
      refinementCalls += 1;
      assert.equal(requests.length, 1);
      assert.deepEqual(requests[0].itemIds, ["point-1"]);
      assert.equal(pages.length, 1);
      return {
        refinements: [{
          pageId: "problem",
          items: [{
            itemId: "point-1",
            points: [{ text: "模板有限", sourceFragment: "模板有时尽" }],
          }],
        }],
      };
    },
    async visualDirector({ phase, skinId }) {
      visualCalls += 1;
      if (phase === "intent") return visualIntentOutput();
      return {
        ...visualPlanOutput(skinId),
        semanticRefinementRequests: [{
          pageId: "problem",
          familyId: "radial-hub",
          variantId: "orbit",
          itemIds: ["point-1"],
          reason: "原文含有尚未进入节点的支撑信息",
        }],
      };
    },
  };
  const visualCandidateProvider = async () => {
    candidateCalls += 1;
    const sets = await candidateProvider();
    sets[0].candidates[0].contentContract = { itemRole: "semantic-node", points: "optional" };
    sets[0].candidates[0].textCapacity = { maxPointsPerItem: 3, maxPointChars: 8 };
    return sets;
  };

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider,
    visualResolver: (args) => {
      resolvedPage = args.pageContents[0];
      return resolver(args);
    },
    renderer,
    allowSemanticRefinement: true,
  });

  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 1);
  assert.equal(visualCalls, 1);
  assert.equal(refinementCalls, 1);
  assert.equal(candidateCalls, 2);
  assert.deepEqual(resolvedPage.items[0].points, ["模板有限"]);
  const saved = JSON.parse(await fs.readFile(path.join(outputDir, "content", "semantic-refinement.json"), "utf8"));
  assert.equal(saved.report[0].status, "refined");
});

test("正式流程不再调用视觉意图阶段，内部 PageIntent 由 PageContent 的 Logic 确定生成", async (t) => {
  const outputDir = await makeTempDir(t);
  let compositionCalls = 0;
  const provider = {
    async contentDirector() {
      const output = contentOutput();
      output.pageContents[0].logicIntent = { logicId: "hub", reason: "一个中心支撑多个同级方向" };
      return output;
    },
    async visualDirector({ phase, skinId, pageIntents }) {
      assert.equal(phase, "composition");
      compositionCalls += 1;
      assert.equal(pageIntents[0].baseRelation, "hub");
      assert.equal(pageIntents[0].purposeKey, "explain_topics");
      return visualPlanOutput(skinId);
    },
  };
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });
  assert.equal(result.status, "delivered");
  assert.equal(compositionCalls, 1);
});

test("编译后的内容来源错误失败关闭且不消耗兜底调用", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      const output = contentOutput();
      output.pageContents[0].sourceText = "改写后的非原文";
      return output;
    },
    async visualDirector({ phase, skinId }) {
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
  };
  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider,
      outputDir,
      reviewMode: "production",
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
      maxContentAttempts: 2,
    }),
    (error) => error instanceof WorkflowError && error.code === "SOURCE_GROUNDING_FAILED",
  );
  assert.equal(contentCalls, 1);
});

test("内容导演把可选 points 留空时在 schema 校验前按未提供处理", async (t) => {
  const outputDir = await makeTempDir(t);
  const provider = completeProvider({
    async contentDirector() {
      const output = contentOutput();
      output.pageContents[0].items[0].points = null;
      output.pageContents[0].items.push({
        id: "point-2",
        title: "空分点",
        body: "仍然只有正文",
        points: "",
      });
      return output;
    },
  });

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });

  assert.equal(Object.hasOwn(result.pageContents[0].items[0], "points"), false);
  assert.equal(Object.hasOwn(result.pageContents[0].items[1], "points"), false);
});

test("内容尝试同时保存 Markdown 事实源、机器元数据和旧编译表单", async (t) => {
  const outputDir = await makeTempDir(t);
  const provider = completeProvider({
    async contentDirector() {
      return {
        ...contentOutput(),
        contentDraftMarkdown: "# 测试内容稿\n\n> 核心结论。\n\n## 正文\n\n### 问题\n\n> 解释问题。\n\n#### 约束\n\n正文。",
        contentMetadata: {
          schemaVersion: "0.1",
          deckMetadata: { deckId: "test-deck" },
          pageMetadata: [{ pageId: "problem" }],
        },
      };
    },
  });
  await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });
  const attemptDir = path.join(outputDir, "content", "attempt-01");
  assert.match(await fs.readFile(path.join(attemptDir, "content-draft.md"), "utf8"), /### 问题/);
  assert.equal(JSON.parse(await fs.readFile(path.join(attemptDir, "content-metadata.json"), "utf8")).schemaVersion, "0.1");
  await fs.access(path.join(attemptDir, "deck-plan.json"));
  await fs.access(path.join(attemptDir, "page-contents.json"));
});

test("Logic 判断证据必须是该页原文中的连续片段", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      const output = contentOutput();
      output.pageContents[0].logicIntent = {
        logicId: "comparison",
        reason: "原稿提出模板与现状的矛盾",
        evidenceFragments: ["模型补写的证据"],
        confidence: "high",
      };
      return output;
    },
    async visualDirector({ phase, skinId }) {
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
  };
  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider,
      outputDir,
      reviewMode: "production",
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
      maxContentAttempts: 2,
    }),
    (error) => error instanceof WorkflowError
      && error.code === "SOURCE_GROUNDING_FAILED"
      && error.details.field === "logicIntent.evidenceFragments",
  );
  assert.equal(contentCalls, 1);
});

test("content evidence overage is normalized without another director call", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      const output = contentOutput();
      const source = output.pageContents[0].sourceText;
      output.pageContents[0].logicIntent = {
        logicId: "comparison",
        reason: "The source contrasts a finite template with changing needs.",
        evidenceFragments: [source.slice(0, 1), "paraphrased", source.slice(1, 2), source.slice(2, 3)],
        confidence: "high",
      };
      return output;
    },
    async visualDirector({ phase, skinId }) {
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
  };
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });
  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 1);
  assert.deepEqual(
    result.pageContents[0].logicIntent.evidenceFragments,
    contentOutput().pageContents[0].sourceText.slice(0, 3).split(""),
  );
});

test("内容阶段不使用通用字数估算误判具体版式容量", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      const output = contentOutput();
      output.pageContents[0].items = [1, 2, 3].map((index) => ({
        id: `point-${index}`,
        title: `要点${index}`,
        body: "长".repeat(90),
      }));
      return output;
    },
    async visualDirector({ phase, skinId }) {
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
  };
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });
  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 1);
});

test("轻微超过旧通用估算线的内容不会触发第二次 API 或整篇机械保底", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  const provider = {
    async contentDirector() {
      contentCalls += 1;
      const output = contentOutput();
      output.pageContents[0].items = [
        { id: "point-1", title: "核心要点", body: "长".repeat(77) },
        { id: "point-2", title: "补充说明", body: "短内容" },
      ];
      return output;
    },
    async visualDirector({ skinId }) {
      const output = visualPlanOutput(skinId);
      output.compositionPlan.pages[0].componentItemIds = ["point-1", "point-2"];
      return output;
    },
  };

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
    guaranteeDelivery: true,
  });

  assert.equal(contentCalls, 1);
  assert.equal(result.pageContents[0].pageId, "problem");
  assert.equal(result.status, "delivered");
  assert.equal(result.resilienceReport.events.length, 0);
});

test("内容编译失败时把原始导演草稿交回唯一修订轮", async (t) => {
  const outputDir = await makeTempDir(t);
  const failedDraft = {
    schemaVersion: "0.1",
    contentMarkdown: "# 旧稿\n\n> 核心结论\n\n## 章节\n\n### 页面\n\n> 页面职责\n\n#### 节点\n\n正文",
    deckMetadata: { deckId: "failed-draft" },
    pageMetadata: [{ pageId: "problem", sourceAnchors: ["不存在的锚点"] }],
  };
  let contentCalls = 0;
  let receivedPrevious = null;
  let receivedReview = null;
  const provider = completeProvider({
    async contentDirector({ previous, previousReview }) {
      contentCalls += 1;
      if (contentCalls === 1) {
        const error = new Error("来源锚点不存在");
        error.code = "CONTENT_METADATA_MISMATCH";
        error.details = { pageId: "problem", anchor: "不存在的锚点" };
        error.contentDirectorDraft = failedDraft;
        throw error;
      }
      receivedPrevious = previous;
      receivedReview = previousReview;
      return contentOutput();
    },
  });

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });

  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 2);
  assert.equal(receivedPrevious.contentDraftMarkdown, failedDraft.contentMarkdown);
  assert.deepEqual(receivedPrevious.contentMetadata.pageMetadata, failedDraft.pageMetadata);
  assert.equal(receivedReview.issues[0].errorCode, "CONTENT_METADATA_MISMATCH");
});

test("可选关系元数据编译失败时使用唯一内容恢复", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let receivedPrevious = null;
  let receivedReview = null;
  const provider = completeProvider({
    async contentDirector({ previous, previousReview }) {
      contentCalls += 1;
      if (contentCalls === 1) {
        const error = new Error("relationBindings 不允许机器字段 /comparisonOrientation");
        error.code = "CONTENT_RELATION_COMPILE_FAILED";
        error.contentDirectorDraft = {
          schemaVersion: "0.1",
          contentMarkdown: "# 旧稿",
          deckMetadata: { deckId: "failed-relation" },
          pageMetadata: [{ pageId: "problem", relationBindings: { type: "comparison" } }],
        };
        throw error;
      }
      receivedPrevious = previous;
      receivedReview = previousReview;
      return contentOutput();
    },
  });

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });

  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 2);
  assert.equal(receivedPrevious.contentMetadata.pageMetadata[0].pageId, "problem");
  assert.equal(receivedReview.issues[0].errorCode, "CONTENT_RELATION_COMPILE_FAILED");
});

test("模型 JSON 失败与内容修订共享同一次恢复预算", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let receivedReview = null;
  const provider = completeProvider({
    async contentDirector({ previousReview }) {
      contentCalls += 1;
      if (contentCalls === 1) {
        const error = new Error("模型没有返回可解析 JSON");
        error.code = "MODEL_JSON_INVALID";
        throw error;
      }
      receivedReview = previousReview;
      return contentOutput();
    },
  });

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });

  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 2);
  assert.equal(receivedReview.issues[0].errorCode, "MODEL_JSON_INVALID");
});

test("候选阶段只有文字容量超限时定向退回内容导演而不误报资产缺口", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let receivedReview = null;
  const provider = completeProvider({
    async contentDirector({ previousReview }) {
      contentCalls += 1;
      if (contentCalls === 2) receivedReview = previousReview;
      const output = contentOutput();
      if (contentCalls === 1) output.pageContents[0].items[0].title = "判断观点属于哪一种逻辑";
      return output;
    },
  });
  const capacityAwareCandidates = async ({ pageContents }) => {
    if (Array.from(pageContents[0].items[0].title).length <= 8) return candidateProvider();
    const capacityRejections = [{
      assetId: "radial-hub-001",
      variantId: "orbit",
      issues: [{
        role: "item-title",
        sourceItemId: "point-1",
        sourceField: "title",
        actualChars: 11,
        actualLines: 1,
        maxChars: 8,
        maxLines: 1,
      }],
    }];
    return [{
      pageId: "problem",
      intentId: "problem-intent",
      candidates: [],
      gap: {
        type: "content-capacity-gap",
        reason: "存在语义兼容结构，但标题超出容量",
        capacityRejections,
      },
      capacityRejections,
    }];
  };
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: capacityAwareCandidates,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });
  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 2);
  assert.equal(receivedReview.issues[0].errorCode, "CONTENT_CAPACITY_EXCEEDED");
  assert.equal(receivedReview.issues[0].details.issues[0].sourceItemId, "point-1");
});

test("候选阶段少量核心字段缺失时消耗唯一内容恢复而不是误报资产缺口", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let receivedReview = null;
  const provider = completeProvider({
    async contentDirector({ previousReview }) {
      contentCalls += 1;
      if (contentCalls === 2) receivedReview = previousReview;
      const output = contentOutput();
      if (contentCalls === 2) output.pageContents[0].items[0].points = ["原稿已有支撑点"];
      return output;
    },
  });
  const contractAwareCandidates = async ({ pageContents }) => {
    if (pageContents[0].items[0].points?.length) return candidateProvider();
    return [{
      pageId: "problem",
      intentId: "problem-intent",
      candidates: [],
      gap: {
        type: "content-contract-gap",
        logicId: "parallel",
        reason: "现有结构要求节点内支撑点",
      },
      candidateDiagnostics: {
        rejected: [{
          assetId: "radial-hub-001",
          readiness: "incompatible",
          stage: "semantic-contract",
          reasons: ["points:required-per-item"],
        }],
      },
    }];
  };

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: contractAwareCandidates,
    visualResolver: resolver,
    renderer,
    maxContentAttempts: 2,
  });

  assert.equal(result.status, "delivered");
  assert.equal(contentCalls, 2);
  assert.equal(receivedReview.issues[0].errorCode, "CONTENT_CONTRACT_GAP");
  assert.equal(receivedReview.issues[0].details.gaps[0].rejected[0].reasons[0], "points:required-per-item");
});

test("candidate-stage content recovery exhaustion preserves the last validated content draft", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  const provider = completeProvider({
    async contentDirector() {
      contentCalls += 1;
      if (contentCalls === 2) {
        const error = new Error("duplicate source range after candidate-stage revision");
        error.code = "CONTENT_METADATA_MISMATCH";
        throw error;
      }
      return contentOutput();
    },
    async visualDirector() {
      const error = new Error("visual director unavailable in fallback regression");
      error.code = "MODEL_JSON_INVALID";
      throw error;
    },
  });
  let candidateCalls = 0;
  const capacityThenRealCandidates = async (args) => {
    candidateCalls += 1;
    if (candidateCalls > 1) return buildVisualCandidateSets(args);
    const capacityRejections = [{
      assetId: "radial-hub-001",
      variantId: "orbit",
      issues: [{ role: "item-title", sourceItemId: "point-1", actualChars: 20, maxChars: 8 }],
    }];
    return [{
      pageId: "problem",
      intentId: "problem-intent",
      candidates: [],
      gap: { type: "content-capacity-gap", reason: "test capacity gap", capacityRejections },
      capacityRejections,
    }];
  };

  const result = await runDirectorWorkflow({
    root,
    input: { rawMarkdown, skinId: DEFAULT_SKIN_ID },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: capacityThenRealCandidates,
    visualResolver: resolveVisualPlan,
    renderer: dynamicRenderer,
    maxContentAttempts: 2,
    maxVisualAttempts: 1,
    guaranteeDelivery: true,
  });

  assert.equal(contentCalls, 2);
  assert.equal(result.status, "delivered-with-fallback");
  assert.equal(result.pageContents[0].pageId, "problem");
  assert.ok(result.resilienceReport.events.some((event) => event.code === "content-revision-exhausted-preserved-valid-draft"));
});

test("每次正式生成都必须带通过的确定性质量审计，否则不得交付", async (t) => {
  const outputDir = await makeTempDir(t);
  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider: {
        async contentDirector() { return contentOutput(); },
        async visualDirector({ phase, skinId }) {
          return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
        },
      },
      outputDir,
      reviewMode: "production",
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer: async (args) => {
        const result = await renderer(args);
        delete result.qualityAudit;
        return result;
      },
    }),
    (error) => error instanceof WorkflowError && error.code === "RENDER_QUALITY_GATE_MISSING",
  );
  await assert.rejects(fs.access(path.join(outputDir, "workflow-result.json")));
});

test("内容 error 未关闭时不调用视觉导演", async (t) => {
  const outputDir = await makeTempDir(t);
  let visualCalls = 0;
  const provider = completeProvider({
    async contentReview({ attempt }) {
      return review({
        type: "content",
        attempt,
        verdict: "revise",
        issues: [{
          issueId: "missing-source",
          severity: "error",
          category: "source-omission",
          evidence: "原稿中的核心限定没有进入页面",
          targets: ["problem"],
          status: "open",
        }],
      });
    },
    async visualDirector() {
      visualCalls += 1;
      return visualIntentOutput();
    },
  });

  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider,
      outputDir,
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
      maxContentAttempts: 1,
    }),
    (error) => error instanceof WorkflowError && error.code === "CONTENT_REVIEW_NOT_CLOSED",
  );
  assert.equal(visualCalls, 0);
  const saved = JSON.parse(await fs.readFile(path.join(outputDir, "content", "attempt-01", "content-review.json"), "utf8"));
  assert.equal(saved.issues[0].status, "open");
});

test("内容审查要求修订时把上一轮产物和审查交回内容导演", async (t) => {
  const outputDir = await makeTempDir(t);
  let receivedPrevious = null;
  let receivedReview = null;
  const provider = completeProvider({
    async contentDirector({ attempt, previous, previousReview }) {
      if (attempt === 2) {
        receivedPrevious = previous;
        receivedReview = previousReview;
      }
      return contentOutput();
    },
    async contentReview({ attempt }) {
      if (attempt === 1) {
        return review({
          type: "content",
          attempt,
          verdict: "revise",
          issues: [{
            issueId: "narrative-gap",
            severity: "error",
            category: "narrative-break",
            evidence: "开场与结论之间缺少逻辑承接",
            targets: ["problem"],
            status: "open",
          }],
        });
      }
      return review({ type: "content", attempt });
    },
  });

  await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });
  assert.equal(receivedPrevious.deckPlan.deckId, "why-ppagent");
  assert.equal(receivedReview.verdict, "revise");
  await fs.access(path.join(outputDir, "content", "attempt-02", "content-review.json"));
});

test("没有语义兼容候选时直接报告资产缺口，不要求内容导演改写语义", async (t) => {
  const outputDir = await makeTempDir(t);
  let candidateCalls = 0;
  await assert.rejects(runDirectorWorkflow({
    input: { rawMarkdown },
    provider: completeProvider(),
    outputDir,
    visualCandidateProvider: async () => {
      candidateCalls += 1;
      return [{
        pageId: "problem",
        intentId: "problem-intent",
        candidates: [],
        gap: { type: "asset-gap", logicId: "progression" },
      }];
    },
    visualResolver: resolver,
    renderer,
  }), (error) => (
    error instanceof WorkflowError
    && error.code === "ASSET_GAP"
    && error.details.gaps[0].logicId === "progression"
  ));
  assert.equal(candidateCalls, 1);
});

test("正式生成遇到资产缺口时用正文候选完成交付并暴露必要结构补充", async (t) => {
  const outputDir = await makeTempDir(t);
  const fallbackProvider = async () => [{
    pageId: "problem",
    intentId: "problem-intent",
    candidates: [{
      familyId: "skin-body-editorial",
      assetId: "northeastern-university-body-001",
      variantId: "editorial",
      silhouette: "editorial-page",
      adaptationStatus: "adaptive",
      fallbackBody: true,
      compositionIds: ["body-copy"],
    }],
    gap: {
      type: "asset-gap",
      logicId: "comparison",
      baseRelation: "comparison",
      itemCount: 2,
      reason: "当前核心资产库没有语义与容量均兼容的 Structure Group",
    },
  }];
  const provider = completeProvider({
    async visualDirector({ phase, skinId }) {
      if (phase === "intent") return visualIntentOutput();
      const output = visualPlanOutput(skinId);
      output.visualPlan.pages[0] = {
        ...output.visualPlan.pages[0],
        familyId: "skin-body-editorial",
        variantId: "editorial",
        silhouette: "editorial-page",
      };
      output.compositionPlan.pages[0] = {
        ...output.compositionPlan.pages[0],
        compositionId: "body-copy",
      };
      return output;
    },
  });
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    reviewMode: "production",
    visualCandidateProvider: fallbackProvider,
    visualResolver: ({ compositionPlan }) => ({
      status: "accepted",
      results: [],
      feedback: [],
      layoutDecisions: [{
        schemaVersion: "1.0",
        intentId: "problem-intent",
        decision: "fallback",
        selectedFamilyId: "skin-body-editorial",
        selectedAssetId: "northeastern-university-body-001",
        selectedVariantId: "editorial",
        selectedSilhouette: "editorial-page",
        selectionState: "fallback",
        selectionOwner: "program",
        selectionSource: "deterministic-fallback",
        candidates: [],
        rejections: [],
        resolutionPlan: null,
      }],
      renderPayloads: [{
        schemaVersion: "1.0",
        intentId: "problem-intent",
        assetId: "northeastern-university-body-001",
        parameters: { title: "模板有时尽，现状无穷多", items: [], visualVariantId: "editorial" },
        mappings: [],
        omissions: [],
      }],
      compositionPlan,
    }),
    renderer,
  });
  assert.equal(result.status, "delivered-with-fallback");
  assert.equal(result.deliveryStatus, "delivered-with-fallback");
  assert.equal(result.assetGapReport.fallbackPageCount, 1);
  assert.equal(result.assetGapReport.fallbackPages[0].pageId, "problem");
  assert.equal(result.assetGapReport.recommendedStructureSupplements[0].assessment, "necessary-existing-logic-supplement");
  await fs.access(path.join(outputDir, "asset-gap-report.json"));
});

test("资产缺口报告按既有 Logic 聚合，而不是把退回页改成 editorial", () => {
  const report = buildAssetGapReport([{
    pageId: "problem",
    candidates: [{ assetId: "body", fallbackBody: true }],
    gap: { type: "asset-gap", logicId: "comparison", baseRelation: "comparison", itemCount: 2, reason: "缺结构" },
  }], [{ pageId: "problem", title: "两端需求", items: [{}, {}], logicIntent: { logicId: "comparison" } }]);
  assert.equal(report.fallbackPages[0].logicId, "comparison");
  assert.equal(report.recommendedStructureSupplements[0].logicLabel, "对比与选择");
  assert.match(report.recommendedStructureSupplements[0].recommendation, /通用 Structure Group/);
});

test("生产统计记录结构使用、重复次数和退回数量", () => {
  const pageContents = [
    { pageId: "p1", title: "一", items: [], logicIntent: { logicId: "parallel" } },
    { pageId: "p2", title: "二", items: [], logicIntent: { logicId: "parallel" } },
    { pageId: "p3", title: "三", items: [], logicIntent: { logicId: "comparison" } },
  ];
  const structure = {
    assetId: "parallel-equal-cards-001",
    logicId: "parallel",
    structureGroupId: "parallel-equal-cards",
    familyId: "parallel-cards",
    variantId: "equal",
    silhouette: "cards",
    fallbackBody: false,
  };
  const fallback = {
    assetId: "northeastern-university-body-001",
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    fallbackBody: true,
  };
  const candidateSets = [
    { pageId: "p1", intentId: "i1", candidates: [structure] },
    { pageId: "p2", intentId: "i2", candidates: [structure] },
    { pageId: "p3", intentId: "i3", candidates: [fallback], gap: { type: "asset-gap", logicId: "comparison" } },
  ];
  const layoutDecisions = [
    { intentId: "i1", selectedAssetId: structure.assetId },
    { intentId: "i2", selectedAssetId: structure.assetId },
    { intentId: "i3", selectedAssetId: fallback.assetId },
  ];
  const assetGapReport = buildAssetGapReport(candidateSets, pageContents);
  const statistics = buildProductionStatistics({ candidateSets, pageContents, layoutDecisions, assetGapReport });
  assert.equal(statistics.bodyPageCount, 3);
  assert.equal(statistics.structurePageCount, 2);
  assert.equal(statistics.fallbackPageCount, 1);
  assert.equal(statistics.uniqueStructureCount, 1);
  assert.equal(statistics.repeatedStructureCount, 1);
  assert.equal(statistics.repeatedUseCount, 1);
  assert.deepEqual(statistics.structureUsage[0].pageIds, ["p1", "p2"]);
  assert.deepEqual(statistics.candidateAvailability, {
    zeroCandidatePageCount: 1,
    singleCandidatePageCount: 2,
    multipleCandidatePageCount: 0,
  });
  assert.deepEqual(statistics.candidateAvailabilityByLogic, [
    {
      logicId: "parallel",
      logicLabel: "并列与枚举",
      pageCount: 2,
      zeroCandidatePageCount: 0,
      singleCandidatePageCount: 2,
      multipleCandidatePageCount: 0,
      eligibleAssetIds: ["parallel-equal-cards-001"],
    },
    {
      logicId: "comparison",
      logicLabel: "对比与选择",
      pageCount: 1,
      zeroCandidatePageCount: 1,
      singleCandidatePageCount: 0,
      multipleCandidatePageCount: 0,
      eligibleAssetIds: [],
    },
  ]);
  assert.deepEqual(statistics.diversityGaps, [{
    logicId: "parallel",
    logicLabel: "并列与枚举",
    affectedPageCount: 2,
    onlyEligibleAssetId: "parallel-equal-cards-001",
    type: "single-generic-candidate",
    recommendation: "该 Logic 的高频普通内容只有一个合法候选；下一次独立入库任务应补充一组通用 Structure Group，或为现有组增加经审批的等价视觉变体。",
  }]);
  assert.equal(statistics.pageCandidateDiagnostics.find((item) => item.pageId === "p1").diagnosis, "single-legal-candidate");
  assert.equal(statistics.pageCandidateDiagnostics.find((item) => item.pageId === "p3").diagnosis, "asset-gap");
});

test("生产统计记录候选 readiness、排除原因、实际选择和四类来源", () => {
  const pageContents = ["p1", "p2", "p3", "p4"].map((pageId) => ({
    pageId,
    title: pageId,
    items: [],
    logicIntent: { logicId: pageId === "p4" ? "comparison" : "parallel" },
  }));
  const structure = {
    assetId: "parallel-equal-cards-001",
    logicId: "parallel",
    structureGroupId: "parallel-equal-cards",
    familyId: "parallel-cards",
    variantId: "equal",
    silhouette: "cards",
    readiness: "ready",
    reasons: ["semantic-contract-compatible"],
    fallbackBody: false,
  };
  const fallback = {
    assetId: "northeastern-university-body-001",
    structureGroupId: "editorial",
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    readiness: "fallback",
    reasons: ["deterministic-body-fallback"],
    fallbackBody: true,
  };
  const candidateDiagnostics = {
    query: { logicId: "parallel" },
    eligible: [{
      assetId: structure.assetId,
      structureGroupId: structure.structureGroupId,
      variants: [{ variantId: structure.variantId, readiness: "ready" }],
    }],
    rejected: [{
      assetId: "parallel-unsupported-002",
      readiness: "incompatible",
      stage: "capacity",
      reasons: ["item-body:90>60"],
    }],
  };
  const candidateSets = [
    { pageId: "p1", intentId: "i1", candidates: [structure], candidateDiagnostics },
    { pageId: "p2", intentId: "i2", candidates: [structure], candidateDiagnostics },
    { pageId: "p3", intentId: "i3", candidates: [structure], candidateDiagnostics },
    {
      pageId: "p4",
      intentId: "i4",
      candidates: [fallback],
      gap: { type: "asset-gap", logicId: "comparison", reason: "missing structure" },
      candidateDiagnostics: { query: { logicId: "comparison" }, eligible: [], rejected: [] },
    },
  ];
  const sources = ["program-locked", "visual-director", "deterministic-ranking", "deterministic-fallback"];
  const layoutDecisions = sources.map((selectionSource, index) => ({
    intentId: `i${index + 1}`,
    selectedAssetId: index === 3 ? fallback.assetId : structure.assetId,
    selectedFamilyId: index === 3 ? fallback.familyId : structure.familyId,
    selectedVariantId: index === 3 ? fallback.variantId : structure.variantId,
    selectedSilhouette: index === 3 ? fallback.silhouette : structure.silhouette,
    selectionSource,
    selectionOwner: selectionSource === "visual-director" ? "visual-director" : "program",
  }));
  const compositionPlan = {
    pages: sources.map((_, index) => ({ intentId: `i${index + 1}`, compositionId: `composition-${index + 1}` })),
  };
  const assetGapReport = buildAssetGapReport(candidateSets, pageContents);
  const statistics = buildProductionStatistics({
    candidateSets, pageContents, layoutDecisions, compositionPlan, assetGapReport,
  });
  assert.deepEqual(statistics.selectionSourceCounts, {
    "program-locked": 1,
    "visual-director": 1,
    "deterministic-ranking": 1,
    "deterministic-fallback": 1,
  });
  const retained = statistics.pageCandidateDiagnostics.find((item) => item.pageId === "p1");
  assert.equal(retained.retainedCandidates[0].readiness, "ready");
  assert.deepEqual(retained.excludedCandidates[0], {
    assetId: "parallel-unsupported-002",
    readiness: "incompatible",
    stage: "capacity",
    reasons: ["item-body:90>60"],
  });
  assert.equal(retained.selected.assetId, structure.assetId);
  assert.equal(retained.selected.structureAssetId, structure.assetId);
  assert.equal(retained.selected.compositionId, "composition-1");
  assert.equal(retained.selected.readiness, "ready");
  assert.equal(retained.selected.source, "program-locked");
  const fallbackLog = statistics.pageCandidateDiagnostics.find((item) => item.pageId === "p4");
  assert.equal(fallbackLog.selected.assetId, fallback.assetId);
  assert.equal(fallbackLog.selected.structureAssetId, null);
  assert.equal(fallbackLog.fallback.used, true);
  assert.equal(fallbackLog.fallback.reason.code, "asset-gap");
  assert.equal(statistics.fallbackPageCount, 1);
});

test("生产统计按完整变体元组记录同一资产的实际选择", () => {
  const base = {
    assetId: "shared-asset",
    logicId: "parallel",
    structureGroupId: "shared-group",
    familyId: "shared-family",
    readiness: "ready",
    fallbackBody: false,
  };
  const candidates = [
    { ...base, variantId: "v1", silhouette: "first" },
    { ...base, variantId: "v2", silhouette: "second" },
  ];
  const pageContents = ["p1", "p2"].map((pageId) => ({
    pageId, title: "同资产多变体", items: [], logicIntent: { logicId: "parallel" },
  }));
  const candidateSets = [
    { pageId: "p1", intentId: "i1", candidates },
    { pageId: "p2", intentId: "i2", candidates },
  ];
  const layoutDecisions = ["v2", "v1"].map((variantId, index) => ({
    intentId: `i${index + 1}`,
    selectedAssetId: "shared-asset",
    selectedFamilyId: "shared-family",
    selectedVariantId: variantId,
    selectedSilhouette: variantId === "v2" ? "second" : "first",
    selectionSource: "visual-director",
    selectionOwner: "visual-director",
  }));
  const statistics = buildProductionStatistics({
    candidateSets,
    pageContents,
    layoutDecisions,
    assetGapReport: buildAssetGapReport(candidateSets, pageContents),
  });
  const selected = statistics.pageCandidateDiagnostics[0].selected;
  assert.equal(selected.variantId, "v2");
  assert.equal(selected.silhouette, "second");
  assert.equal(statistics.uniqueStructureCount, 2);
  assert.equal(statistics.repeatedStructureCount, 0);
  assert.deepEqual(statistics.structureUsage.map((item) => item.variantId).sort(), ["v1", "v2"]);
});

test("运行时溢出 fallback 保留结构候选诊断而不误记 editorial", () => {
  const structure = {
    assetId: "progression-001",
    logicId: "progression",
    structureGroupId: "progression-path",
    familyId: "progression",
    variantId: "path",
    silhouette: "ascending-path",
    readiness: "ready",
    fallbackBody: false,
  };
  const fallback = {
    assetId: "northeastern-university-body-001",
    structureGroupId: "editorial",
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    readiness: "fallback",
    fallbackBody: true,
  };
  const pageContents = [{
    pageId: "p1", title: "运行时溢出", items: [], logicIntent: { logicId: "progression" },
  }];
  const candidateSets = [{
    pageId: "p1", intentId: "i1", candidates: [structure], fallbackCandidate: fallback,
  }];
  const statistics = buildProductionStatistics({
    candidateSets,
    pageContents,
    layoutDecisions: [{
      intentId: "i1",
      selectedAssetId: fallback.assetId,
      selectedFamilyId: fallback.familyId,
      selectedVariantId: fallback.variantId,
      selectedSilhouette: fallback.silhouette,
      selectionSource: "deterministic-fallback",
      selectionOwner: "program",
    }],
    assetGapReport: buildAssetGapReport(candidateSets, pageContents),
  });
  const diagnostic = statistics.pageCandidateDiagnostics[0];
  assert.equal(diagnostic.fallback.used, true);
  assert.equal(diagnostic.fallback.reason.code, "component-runtime-overflow");
  assert.equal(diagnostic.diagnosis, "single-legal-candidate");
  assert.equal(statistics.editorialPageCount, 0);
  assert.equal(statistics.fallbackPageCount, 1);
  assert.deepEqual(statistics.candidateAvailability, {
    zeroCandidatePageCount: 0,
    singleCandidatePageCount: 1,
    multipleCandidatePageCount: 0,
  });
});

test("渲染前视觉 error 未关闭时绝不调用 renderer", async (t) => {
  const outputDir = await makeTempDir(t);
  let renderCalls = 0;
  const provider = completeProvider({
    async visualReview({ stage, attempt }) {
      assert.equal(stage, "pre-render");
      return review({
        type: "visual",
        stage,
        attempt,
        verdict: "revise",
        issues: [{
          issueId: "repeat-shape",
          severity: "error",
          category: "rhythm-monotony",
          evidence: "相邻页面轮廓重复",
          targets: ["problem"],
          status: "open",
        }],
      });
    },
  });

  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider,
      outputDir,
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer: async (args) => {
        renderCalls += 1;
        return renderer(args);
      },
      maxVisualAttempts: 1,
    }),
    (error) => error instanceof WorkflowError && error.code === "VISUAL_REVIEW_NOT_CLOSED",
  );
  assert.equal(renderCalls, 0);
});

test("变体确定性复核未接受时把反馈送回视觉导演且不进入审查或渲染", async (t) => {
  const outputDir = await makeTempDir(t);
  let reviewCalls = 0;
  let renderCalls = 0;
  let receivedResolution = null;
  let intentCalls = 0;
  const provider = completeProvider({
    async visualDirector({ attempt, phase, skinId, previousResolution }) {
      if (attempt === 2) receivedResolution = previousResolution;
      if (phase === "intent") intentCalls += 1;
      return phase === "intent" ? visualIntentOutput() : visualPlanOutput(skinId);
    },
    async visualReview({ stage, attempt }) {
      reviewCalls += 1;
      return review({ type: "visual", stage, attempt });
    },
  });
  let resolverCalls = 0;
  const visualResolver = async (args) => {
    resolverCalls += 1;
    if (resolverCalls === 1) {
      return {
        status: "needs-director-revision",
        results: [{ pageId: "problem", status: "rhythm-conflict", issues: [{ code: "repeat", message: "轮廓重复" }] }],
        feedback: [{ pageId: "problem", message: "选择另一种轮廓" }],
      };
    }
    return resolver(args);
  };

  await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    visualCandidateProvider: candidateProvider,
    visualResolver,
    renderer: async (args) => {
      renderCalls += 1;
      return renderer(args);
    },
  });
  assert.equal(receivedResolution.status, "needs-director-revision");
  assert.equal(intentCalls, 0);
  assert.equal(reviewCalls, 2);
  assert.equal(renderCalls, 1);
  const saved = JSON.parse(await fs.readFile(path.join(outputDir, "visual", "attempt-01", "visual-resolution.json"), "utf8"));
  assert.equal(saved.status, "needs-director-revision");
});

test("完整链路保存中间 JSON，并把逐页证据交给渲染后审查", async (t) => {
  const outputDir = await makeTempDir(t);
  const stages = [];
  const provider = completeProvider({
    async visualReview({ stage, attempt, pageEvidence }) {
      stages.push(stage);
      if (stage === "post-render") {
        assert.equal(pageEvidence.length, 1);
        await fs.access(pageEvidence[0]);
      } else {
        assert.equal(pageEvidence, undefined);
      }
      return review({ type: "visual", stage, attempt });
    },
  });

  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    visualCandidateProvider: candidateProvider,
    visualResolver: resolver,
    renderer,
  });

  assert.equal(result.status, "internally-approved-awaiting-user-review");
  assert.equal(result.skinId, DEFAULT_SKIN_ID);
  assert.deepEqual(stages, ["pre-render", "post-render"]);
  for (const relative of [
    "content/attempt-01/deck-plan.json",
    "content/attempt-01/page-contents.json",
    "content/attempt-01/content-review.json",
    "visual/attempt-01/visual-plan.json",
    "visual/attempt-01/composition-plan.json",
    "visual/attempt-01/page-intents.json",
    "visual/attempt-01/layout-decisions.json",
    "visual/attempt-01/render-payloads.json",
    "visual/attempt-01/visual-resolution.json",
    "visual/attempt-01/visual-review-pre.json",
    "visual/attempt-01/render-result.json",
    "visual/attempt-01/visual-review-post.json",
    "workflow-result.json",
  ]) await fs.access(path.join(outputDir, relative));
});

test("渲染后视觉 error 未关闭时不会写入内部通过结果", async (t) => {
  const outputDir = await makeTempDir(t);
  const provider = completeProvider({
    async visualReview({ stage, attempt }) {
      if (stage === "pre-render") return review({ type: "visual", stage, attempt });
      return review({
        type: "visual",
        stage,
        attempt,
        verdict: "revise",
        issues: [{
          issueId: "distorted-shape",
          severity: "error",
          category: "geometry-distortion",
          evidence: "逐页渲染证据显示圆形被压扁",
          targets: ["problem"],
          status: "open",
        }],
      });
    },
  });

  await assert.rejects(
    runDirectorWorkflow({
      input: { rawMarkdown },
      provider,
      outputDir,
      visualCandidateProvider: candidateProvider,
      visualResolver: resolver,
      renderer,
      maxVisualAttempts: 1,
    }),
    (error) => error instanceof WorkflowError && error.code === "POST_RENDER_REVIEW_NOT_CLOSED",
  );
  await assert.rejects(fs.access(path.join(outputDir, "workflow-result.json")));
  await fs.access(path.join(outputDir, "visual", "attempt-01", "visual-review-post.json"));
});
