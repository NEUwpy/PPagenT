import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DirectorProviderError } from "../src/agent/director-provider.mjs";
import { runWorkflowCli } from "../src/agent/run-workflow.mjs";
import { DEFAULT_SKIN_ID, WorkflowError, runDirectorWorkflow } from "../src/agent/workflow.mjs";
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
      selectionOwner: "visual-director",
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

test("workflow schemas including CompositionPlan are registered", async () => {
  const validators = await createRuleValidators(root);
  assert.equal(typeof validators.validateDeckPlan, "function");
  assert.equal(typeof validators.validateContentReview, "function");
  assert.equal(typeof validators.validateVisualPlan, "function");
  assert.equal(typeof validators.validateCompositionPlan, "function");
  assert.equal(typeof validators.validateVisualReview, "function");
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
  assert.equal(visualCalls, 2);
  await assert.rejects(fs.access(path.join(outputDir, "content", "attempt-01", "content-review.json")));
  await assert.rejects(fs.access(path.join(outputDir, "visual", "attempt-01", "visual-review-pre.json")));
  await assert.rejects(fs.access(path.join(outputDir, "visual", "attempt-01", "visual-review-post.json")));
});

test("视觉意图枚举错误会在受控次数内反馈重试", async (t) => {
  const outputDir = await makeTempDir(t);
  let intentCalls = 0;
  let receivedFeedback = null;
  const provider = {
    async contentDirector() { return contentOutput(); },
    async visualDirector({ phase, skinId, previousResolution }) {
      if (phase === "composition") return visualPlanOutput(skinId);
      intentCalls += 1;
      if (intentCalls === 2) receivedFeedback = previousResolution;
      if (intentCalls === 1) {
        const invalid = visualIntentOutput();
        invalid.pageIntents[0].relationTraits.secondaryDimension = "invented";
        return invalid;
      }
      return visualIntentOutput();
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
    maxVisualAttempts: 2,
  });
  assert.equal(result.status, "delivered");
  assert.equal(intentCalls, 2);
  assert.equal(receivedFeedback.feedback[0].code, "visual-intent-invalid");
  assert.equal(receivedFeedback.feedback[0].errorCode, "SCHEMA_VALIDATION_FAILED");
});

test("内容来源溯源错误会在受控次数内反馈重试", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let receivedReview = null;
  const provider = {
    async contentDirector({ previousReview }) {
      contentCalls += 1;
      if (contentCalls === 2) receivedReview = previousReview;
      const output = contentOutput();
      if (contentCalls === 1) output.pageContents[0].sourceText = "改写后的非原文";
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
  assert.equal(contentCalls, 2);
  assert.equal(receivedReview.issues[0].errorCode, "SOURCE_GROUNDING_FAILED");
});

test("多项内容超过正式容量时退回内容导演压缩而不是进入渲染", async (t) => {
  const outputDir = await makeTempDir(t);
  let contentCalls = 0;
  let receivedReview = null;
  const provider = {
    async contentDirector({ previousReview }) {
      contentCalls += 1;
      if (contentCalls === 2) receivedReview = previousReview;
      const output = contentOutput();
      if (contentCalls === 1) {
        output.pageContents[0].items = [1, 2, 3].map((index) => ({
          id: `point-${index}`,
          title: `要点${index}`,
          body: "长".repeat(90),
        }));
      }
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
  assert.equal(contentCalls, 2);
  assert.equal(receivedReview.issues[0].errorCode, "CONTENT_CAPACITY_EXCEEDED");
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

test("没有语义兼容候选时把容量反馈退回内容导演再审查", async (t) => {
  const outputDir = await makeTempDir(t);
  let receivedFeedback = null;
  let candidateCalls = 0;
  const provider = completeProvider({
    async contentDirector({ attempt, visualFeedback }) {
      if (attempt === 2) receivedFeedback = visualFeedback;
      return contentOutput();
    },
  });
  const result = await runDirectorWorkflow({
    input: { rawMarkdown },
    provider,
    outputDir,
    visualCandidateProvider: async () => {
      candidateCalls += 1;
      if (candidateCalls === 1) return [{ pageId: "problem", intentId: "problem-intent", candidates: [] }];
      return candidateProvider();
    },
    visualResolver: resolver,
    renderer,
  });
  assert.equal(result.status, "internally-approved-awaiting-user-review");
  assert.equal(receivedFeedback.reason, "no-renderable-visual-candidates");
  assert.equal(receivedFeedback.emptyCandidateSets[0].pageId, "problem");
  await fs.access(path.join(outputDir, "content", "attempt-02", "content-review.json"));
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
  assert.equal(intentCalls, 1);
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
