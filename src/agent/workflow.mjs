import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPageIntentFromContent,
  computeContentStats,
  enrichPageIntent,
  validateStructuredDataReferences,
} from "../content/page-content.mjs";
import { createRuleValidators, validationMessage } from "../selection/validation.mjs";
import { assertDirectorProvider } from "./director-provider.mjs";
import {
  applySemanticRefinements,
  normalizeSemanticRefinementRequests,
} from "./semantic-refinement.mjs";
import { buildShellIntent, isShellPage, shellVisualSelection } from "./shell-scaffold.mjs";

export const DEFAULT_SKIN_ID = "northeastern-university-001";

export class WorkflowError extends Error {
  constructor(code, stage, message, details = {}) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.stage = stage;
    this.details = details;
  }
}

async function writeJson(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateBusinessInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WorkflowError("INVALID_INPUT", "input", "业务输入必须是 rawMarkdown 与 skinId 组成的对象");
  }
  const allowed = new Set(["rawMarkdown", "skinId"]);
  const forbidden = Object.keys(input).filter((key) => !allowed.has(key));
  if (forbidden.length) {
    throw new WorkflowError(
      "INTERMEDIATE_INPUT_FORBIDDEN",
      "input",
      `产品入口不接受中间对象：${forbidden.join(", ")}`,
      { forbidden },
    );
  }
  if (typeof input.rawMarkdown !== "string" || !input.rawMarkdown.trim()) {
    throw new WorkflowError("INVALID_RAW_MARKDOWN", "input", "rawMarkdown 不能为空");
  }
  const skinId = input.skinId ?? DEFAULT_SKIN_ID;
  if (typeof skinId !== "string" || !skinId.trim()) {
    throw new WorkflowError("INVALID_SKIN", "input", "skinId 必须是非空字符串");
  }
  return { rawMarkdown: input.rawMarkdown, skinId };
}

function assertOperationalDependency(value, label) {
  if (typeof value !== "function") {
    throw new WorkflowError("WORKFLOW_DEPENDENCY_UNAVAILABLE", "bootstrap", `缺少 ${label}；工作流失败关闭`);
  }
}

function normalizeEmptyOptionalStructures(output) {
  if (!output || typeof output !== "object" || !Array.isArray(output.pageContents)) return output;
  const normalized = structuredClone(output);
  normalized.pageContents = normalized.pageContents.map((page) => {
    const structured = page?.structuredData;
    if (!structured || typeof structured !== "object" || Array.isArray(structured)) return page;
    if (Object.keys(structured).length) return page;
    const clean = { ...page };
    delete clean.structuredData;
    return clean;
  });
  return normalized;
}

function assertSchema(validators, validator, value, label, stage) {
  if (!validator(value)) {
    throw new WorkflowError(
      "SCHEMA_VALIDATION_FAILED",
      stage,
      `${label} 校验失败：${validationMessage(validators.ajv, validator)}`,
      { label, errors: validator.errors },
    );
  }
}

function unique(values, label, stage) {
  if (new Set(values).size !== values.length) {
    throw new WorkflowError("CROSS_OBJECT_INVARIANT_FAILED", stage, `${label} 存在重复值`, { values });
  }
}

function assertSameOrder(actual, expected, label, stage) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new WorkflowError(
      "CROSS_OBJECT_INVARIANT_FAILED",
      stage,
      `${label} 与 DeckPlan 的页面顺序不一致`,
      { actual, expected },
    );
  }
}

function assertContentOutput(validators, output, rawMarkdown) {
  if (!output || typeof output !== "object" || !Array.isArray(output.pageContents)) {
    throw new WorkflowError("DIRECTOR_OUTPUT_INVALID", "content-director", "内容导演必须输出 deckPlan 和 pageContents");
  }
  assertSchema(validators, validators.validateDeckPlan, output.deckPlan, "DeckPlan", "content-director");
  const capacityIssues = [];
  output.pageContents.forEach((page, index) => {
    assertSchema(validators, validators.validatePageContent, page, `PageContent[${index}]`, "content-director");
    const structuredReferenceIssues = validateStructuredDataReferences(page);
    if (structuredReferenceIssues.length) {
      throw new WorkflowError(
        "STRUCTURED_DATA_REFERENCE_FAILED",
        "content-director",
        `${page.pageId} 的结构化数据引用不完整或不一致`,
        { pageId: page.pageId, issues: structuredReferenceIssues },
      );
    }
    if (typeof page.sourceText !== "string" || !page.sourceText.trim() || !rawMarkdown.includes(page.sourceText)) {
      throw new WorkflowError(
        "SOURCE_GROUNDING_FAILED",
        "content-director",
        `${page.pageId} 的 sourceText 不是原稿中的可核对文本`,
        { pageId: page.pageId },
      );
    }
    const componentSpecificIds = page.items
      .map((item) => item.id)
      .filter((id) => /^(source-|app-)|^platform$/i.test(id));
    if (componentSpecificIds.length) {
      throw new WorkflowError(
        "LAYOUT_SPECIFIC_CONTENT_ID",
        "content-director",
        `${page.pageId} 使用了组件专属内容 ID：${componentSpecificIds.join(", ")}`,
        { pageId: page.pageId, componentSpecificIds },
      );
    }
    const stats = computeContentStats(page);
    const estimatedTotal = stats.avgItemChars * stats.itemCount;
    if (stats.itemCount > 1 && (
      stats.itemCount > 13 || estimatedTotal > 240 || stats.maxItemChars > 80
    )) {
      capacityIssues.push({
        pageId: page.pageId,
        itemCount: stats.itemCount,
        estimatedTotalChars: estimatedTotal,
        maxItemChars: stats.maxItemChars,
        required: { maxItems: 13, maxTotalChars: 240, maxItemChars: 80 },
        guidance: "压缩每项正文与分点、删除重复表达，或按叙事职责拆成两页；不得缩小字号硬塞",
      });
    }
  });

  if (capacityIssues.length) {
    throw new WorkflowError(
      "CONTENT_CAPACITY_EXCEEDED",
      "content-director",
      `${capacityIssues.length} 个页面的多项内容密度超过正式字号与已登记版式的通用容量`,
      { ...capacityIssues[0], issues: capacityIssues },
    );
  }

  const planIds = output.deckPlan.pages.map((page) => page.pageId);
  const contentIds = output.pageContents.map((page) => page.pageId);
  unique(planIds, "DeckPlan.pageId", "content-director");
  unique(contentIds, "PageContent.pageId", "content-director");
  assertSameOrder(contentIds, planIds, "PageContent", "content-director");
  output.deckPlan.pages.forEach((page, index) => {
    if (page.sequence !== index + 1) {
      throw new WorkflowError(
        "CROSS_OBJECT_INVARIANT_FAILED",
        "content-director",
        `${page.pageId} 的 sequence 必须连续且从 1 开始`,
      );
    }
    const missingAnchors = page.sourceAnchors.filter((anchor) => !rawMarkdown.includes(anchor));
    if (missingAnchors.length) {
      throw new WorkflowError(
        "SOURCE_GROUNDING_FAILED",
        "content-director",
        `${page.pageId} 的 sourceAnchors 无法在原稿中定位`,
        { pageId: page.pageId, missingAnchors },
      );
    }
  });
}

function unresolvedErrors(review) {
  return review.issues.filter((issue) => issue.severity === "error" && issue.status !== "closed");
}

function reviewPasses(review) {
  return review.verdict === "pass" && unresolvedErrors(review).length === 0;
}

function assertReviewIdentity(review, { deckId, attempt, stage }) {
  if (review.deckId !== deckId || review.attempt !== attempt || (stage && review.stage !== stage)) {
    throw new WorkflowError(
      "REVIEW_IDENTITY_MISMATCH",
      stage ?? "content-review",
      "审查记录与被审查的 deck、轮次或阶段不一致",
      { deckId, attempt, expectedStage: stage, actual: review },
    );
  }
}

function normalizeVisualIntents(validators, output, pageContents) {
  if (!output || typeof output !== "object" || !Array.isArray(output.pageIntents)) {
    throw new WorkflowError("DIRECTOR_OUTPUT_INVALID", "visual-intent", "视觉导演的意图阶段必须输出 pageIntents");
  }
  if (output.pageIntents.length !== pageContents.length) {
    throw new WorkflowError("CROSS_OBJECT_INVARIANT_FAILED", "visual-director", "PageIntent 数量与 PageContent 不一致");
  }
  const pageIntents = output.pageIntents.map((intent, index) => {
    const enriched = enrichPageIntent(intent, pageContents[index]);
    assertSchema(validators, validators.validatePageIntent, enriched, `PageIntent[${index}]`, "visual-director");
    if (!validators.purposeKeys.has(enriched.purposeKey)) {
      throw new WorkflowError("UNKNOWN_PURPOSE_KEY", "visual-director", `未知 purposeKey：${enriched.purposeKey}`);
    }
    return enriched;
  });

  const intentIds = pageIntents.map((intent) => intent.intentId);
  unique(intentIds, "PageIntent.intentId", "visual-director");
  return pageIntents;
}

function normalizeVisualPlan(validators, output, deckPlan, pageContents, pageIntents, skinId) {
  if (!output || typeof output !== "object" || !output.visualPlan || !output.compositionPlan) {
    throw new WorkflowError("DIRECTOR_OUTPUT_INVALID", "visual-composition", "视觉导演的整套编排阶段必须输出 visualPlan 和 compositionPlan");
  }
  assertSchema(validators, validators.validateVisualPlan, output.visualPlan, "VisualPlan", "visual-director");
  if (output.visualPlan.deckId !== deckPlan.deckId || output.visualPlan.skinId !== skinId) {
    throw new WorkflowError("CROSS_OBJECT_INVARIANT_FAILED", "visual-director", "VisualPlan 的 deckId 或 skinId 不一致");
  }
  const expectedPageIds = pageContents.map((page) => page.pageId);
  const visualPageIds = output.visualPlan.pages.map((page) => page.pageId);
  assertSameOrder(visualPageIds, expectedPageIds, "VisualPlan", "visual-director");
  const intentIds = pageIntents.map((intent) => intent.intentId);
  const visualIntentIds = output.visualPlan.pages.map((page) => page.intentId);
  assertSameOrder(visualIntentIds, intentIds, "VisualPlan.intentId", "visual-director");
  assertSchema(validators, validators.validateCompositionPlan, output.compositionPlan, "CompositionPlan", "visual-director");
  if (output.compositionPlan.deckId !== deckPlan.deckId || output.compositionPlan.skinId !== skinId) {
    throw new WorkflowError("CROSS_OBJECT_INVARIANT_FAILED", "visual-director", "CompositionPlan 的 deckId 或 skinId 不一致");
  }
  assertSameOrder(output.compositionPlan.pages.map((page) => page.pageId), expectedPageIds, "CompositionPlan", "visual-director");
  assertSameOrder(output.compositionPlan.pages.map((page) => page.intentId), intentIds, "CompositionPlan.intentId", "visual-director");
  return { visualPlan: output.visualPlan, compositionPlan: output.compositionPlan };
}

function assertResolvedVisual(validators, resolved, pageIntents, visualPlan, compositionPlan) {
  if (!resolved || resolved.status !== "accepted"
    || !Array.isArray(resolved.layoutDecisions) || !Array.isArray(resolved.renderPayloads)) {
    throw new WorkflowError(
      "VISUAL_RESOLUTION_INVALID",
      "visual-resolution",
      "visualResolver 必须输出 layoutDecisions 和 renderPayloads",
    );
  }
  if (resolved.layoutDecisions.length !== pageIntents.length || resolved.renderPayloads.length !== pageIntents.length) {
    throw new WorkflowError("CROSS_OBJECT_INVARIANT_FAILED", "visual-resolution", "视觉解析结果的页数不一致");
  }
  if (resolved.compositionPlan !== compositionPlan) {
    throw new WorkflowError(
      "COMPOSITION_PLAN_DECISION_MISMATCH",
      "visual-resolution",
      "visualResolver changed or dropped the visual director CompositionPlan",
    );
  }
  resolved.layoutDecisions.forEach((decision, index) => {
    assertSchema(validators, validators.validateLayoutDecision, decision, `LayoutDecision[${index}]`, "visual-resolution");
    if (decision.intentId !== pageIntents[index].intentId || !decision.selectedAssetId) {
      throw new WorkflowError(
        "UNRENDERABLE_LAYOUT_DECISION",
        "visual-resolution",
        `${pageIntents[index].intentId} 没有形成可渲染且对应的 LayoutDecision`,
      );
    }
    if (decision.selectionOwner !== "visual-director" || decision.selectionState !== "selected"
      || !decision.selectedFamilyId || !decision.selectedVariantId || !decision.selectedSilhouette) {
      throw new WorkflowError(
        "VISUAL_DECISION_OWNERSHIP_FAILED",
        "visual-resolution",
        `${pageIntents[index].intentId} 的 LayoutDecision 没有保留视觉导演的家族与变体决策`,
      );
    }
    const planned = visualPlan.pages[index];
    if (decision.selectedFamilyId !== planned.familyId
      || decision.selectedVariantId !== planned.variantId
      || decision.selectedSilhouette !== planned.silhouette) {
      throw new WorkflowError(
        "VISUAL_PLAN_DECISION_MISMATCH",
        "visual-resolution",
        `${pageIntents[index].intentId} 的 LayoutDecision 改写了视觉导演的家族或变体选择`,
      );
    }
  });
  resolved.renderPayloads.forEach((payload, index) => {
    assertSchema(validators, validators.validateRenderPayload, payload, `RenderPayload[${index}]`, "visual-resolution");
    const decision = resolved.layoutDecisions[index];
    if (payload.intentId !== pageIntents[index].intentId || payload.assetId !== decision.selectedAssetId) {
      throw new WorkflowError(
        "CROSS_OBJECT_INVARIANT_FAILED",
        "visual-resolution",
        `${pageIntents[index].intentId} 的 RenderPayload 与 LayoutDecision 不一致`,
      );
    }
    if (!decision.selectedAssetId.startsWith("northeastern-university-")
      && payload.parameters.visualVariantId !== decision.selectedVariantId) {
      throw new WorkflowError(
        "CROSS_OBJECT_INVARIANT_FAILED",
        "visual-resolution",
        `${pageIntents[index].intentId} 的 RenderPayload 丢失了视觉变体`,
      );
    }
  });
}

function visualResolutionAccepted(resolved) {
  return resolved?.status === "accepted";
}

async function assertRenderResult(result, pageCount) {
  if (!result || typeof result.outputPptx !== "string" || !result.outputPptx.trim()) {
    throw new WorkflowError("RENDER_RESULT_INVALID", "render", "renderer 必须返回 outputPptx");
  }
  if (!Array.isArray(result.pageEvidence) || result.pageEvidence.length !== pageCount
    || result.pageEvidence.some((item) => typeof item !== "string" || !item.trim())) {
    throw new WorkflowError(
      "RENDER_EVIDENCE_MISSING",
      "render",
      "renderer 必须为每一页返回可供渲染后审查的证据路径",
      { pageCount, pageEvidence: result.pageEvidence },
    );
  }
  const targets = [result.outputPptx, ...result.pageEvidence];
  const missing = [];
  for (const target of targets) {
    try {
      await fs.access(path.resolve(target));
    } catch {
      missing.push(target);
    }
  }
  if (missing.length) {
    throw new WorkflowError(
      "RENDER_EVIDENCE_MISSING",
      "render",
      "renderer 返回的 PPT 或逐页证据路径不存在",
      { missing },
    );
  }
  if (!result.qualityAudit || result.qualityAudit.status !== "passed") {
    throw new WorkflowError(
      "RENDER_QUALITY_GATE_MISSING",
      "render",
      "renderer 必须返回通过的确定性质量审计；工作流不能把未检查的 PPT 标记为交付",
      { qualityAudit: result.qualityAudit ?? null },
    );
  }
}

async function persistContentAttempt(outputDir, attempt, output, review) {
  const attemptDir = path.join(outputDir, "content", `attempt-${String(attempt).padStart(2, "0")}`);
  await writeJson(path.join(attemptDir, "deck-plan.json"), output.deckPlan);
  await writeJson(path.join(attemptDir, "page-contents.json"), output.pageContents);
  if (review) await writeJson(path.join(attemptDir, "content-review.json"), review);
}

async function persistVisualAttempt(outputDir, attempt, visual, resolved, name, value) {
  const attemptDir = path.join(outputDir, "visual", `attempt-${String(attempt).padStart(2, "0")}`);
  if (visual) {
    await writeJson(path.join(attemptDir, "visual-plan.json"), visual.visualPlan);
    if (visual.compositionPlan) await writeJson(path.join(attemptDir, "composition-plan.json"), visual.compositionPlan);
    await writeJson(path.join(attemptDir, "page-intents.json"), visual.pageIntents);
    if (visual.candidateSets) await writeJson(path.join(attemptDir, "candidate-sets.json"), visual.candidateSets);
  }
  if (resolved) {
    await writeJson(path.join(attemptDir, "layout-decisions.json"), resolved.layoutDecisions);
    await writeJson(path.join(attemptDir, "render-payloads.json"), resolved.renderPayloads);
  }
  if (name) await writeJson(path.join(attemptDir, name), value);
  return attemptDir;
}

export async function runDirectorWorkflow(options) {
  const input = validateBusinessInput(options?.input);
  const developmentReview = !new Set(["production", "none"]).has(options?.reviewMode);
  const provider = assertDirectorProvider(options?.provider, { requireReview: developmentReview });
  assertOperationalDependency(options?.visualCandidateProvider, "visualCandidateProvider");
  assertOperationalDependency(options?.visualResolver, "visualResolver");
  assertOperationalDependency(options?.renderer, "renderer");
  const outputDir = path.resolve(options?.outputDir ?? "");
  if (!options?.outputDir) {
    throw new WorkflowError("OUTPUT_DIR_REQUIRED", "bootstrap", "缺少工作流输出目录");
  }
  const root = path.resolve(options.root ?? process.cwd());
  const maxContentAttempts = options.maxContentAttempts ?? 3;
  const maxVisualAttempts = options.maxVisualAttempts ?? 3;
  if (!Number.isInteger(maxContentAttempts) || maxContentAttempts < 1
    || !Number.isInteger(maxVisualAttempts) || maxVisualAttempts < 1) {
    throw new WorkflowError("INVALID_ATTEMPT_LIMIT", "bootstrap", "工作流循环次数必须是正整数");
  }
  const validators = await createRuleValidators(root);
  await fs.mkdir(outputDir, { recursive: true });

  let contentOutput = null;
  let contentReview = null;
  let contentAttempt = 0;
  async function executeContentAttempt(extra = {}) {
    contentAttempt += 1;
    contentOutput = normalizeEmptyOptionalStructures(await provider.contentDirector({
      ...input,
      attempt: contentAttempt,
      previous: contentOutput,
      previousReview: contentReview,
      ...extra,
    }));
    assertContentOutput(validators, contentOutput, input.rawMarkdown);
    await persistContentAttempt(outputDir, contentAttempt, contentOutput, null);

    if (!developmentReview) return true;
    contentReview = await provider.contentReview({
      ...input,
      attempt: contentAttempt,
      deckPlan: contentOutput.deckPlan,
      pageContents: contentOutput.pageContents,
      ...extra,
    });
    assertSchema(validators, validators.validateContentReview, contentReview, "ContentReview", "content-review");
    assertReviewIdentity(contentReview, { deckId: contentOutput.deckPlan.deckId, attempt: contentAttempt });
    await persistContentAttempt(outputDir, contentAttempt, contentOutput, contentReview);
    return reviewPasses(contentReview);
  }
  while (contentAttempt < maxContentAttempts) {
    try {
      if (await executeContentAttempt()) break;
    } catch (error) {
      const recoverableContentError = (error instanceof WorkflowError
        && new Set(["SOURCE_GROUNDING_FAILED", "SCHEMA_VALIDATION_FAILED", "CONTENT_CAPACITY_EXCEEDED"]).has(error.code))
        || new Set(["SECTION_COVERAGE_FAILED", "CONTENT_LOGIC_MISMATCH"]).has(error?.code);
      if (!recoverableContentError || contentAttempt === maxContentAttempts) throw error;
      contentReview = {
        verdict: "revise",
        summary: error.message,
        issues: [{
          severity: "error",
          category: "content-output-invalid",
          status: "open",
          evidence: error.message,
          targets: error.details?.pageId ? [error.details.pageId] : [],
          errorCode: error.code,
          details: error.details ?? {},
        }],
      };
      continue;
    }
    if (contentAttempt === maxContentAttempts) {
      throw new WorkflowError(
        "CONTENT_REVIEW_NOT_CLOSED",
        "content-review",
        "内容审查未通过；工作流不会进入视觉阶段",
        { unresolvedErrors: unresolvedErrors(contentReview), verdict: contentReview.verdict },
      );
    }
  }

  let visual = null;
  let visualReview = null;
  let visualResolution = null;
  let renderResult = null;
  let semanticRefinementUsed = false;
  for (let attempt = 1; attempt <= maxVisualAttempts; attempt += 1) {
    let presentationOutput = options.shellScaffolder
      ? await options.shellScaffolder(contentOutput)
      : contentOutput;
    let bodyPageContents = presentationOutput.pageContents.filter((page) => !isShellPage(page));
    const bodyPageIds = new Set(bodyPageContents.map((page) => page.pageId));
    const bodyDeckPlan = {
      ...presentationOutput.deckPlan,
      pages: presentationOutput.deckPlan.pages.filter((page) => bodyPageIds.has(page.pageId)),
    };
    let pageIntents = presentationOutput.pageContents.map((page) => (
      isShellPage(page) ? buildShellIntent(page) : buildPageIntentFromContent(page)
    ));
    let candidateSets = await options.visualCandidateProvider({
      root,
      skinId: input.skinId,
      deckPlan: presentationOutput.deckPlan,
      pageContents: presentationOutput.pageContents,
      pageIntents,
    });
    const invalidCandidateSets = !Array.isArray(candidateSets) || candidateSets.length !== pageIntents.length;
    const emptyCandidateSets = invalidCandidateSets
      ? []
      : candidateSets.filter((set) => !Array.isArray(set.candidates) || set.candidates.length === 0);
    if (invalidCandidateSets || emptyCandidateSets.length) {
      const gaps = emptyCandidateSets.map((set) => set.gap ?? {
        type: "asset-gap",
        reason: "候选集为空",
      });
      throw new WorkflowError(
        "ASSET_GAP",
        "visual-candidates",
        "原稿需要的结构尚未被核心资产库覆盖；流程已停止，未改写语义或退回正文兜底",
        { candidateSets, gaps, contentAttempt },
      );
    }
    let normalizedPlans;
    try {
      const compositionOutput = await provider.visualDirector({
        ...input,
        phase: "composition",
        attempt,
        deckPlan: bodyDeckPlan,
        pageContents: bodyPageContents,
        pageIntents: pageIntents.filter((_, index) => !isShellPage(presentationOutput.pageContents[index])),
        candidateSets: candidateSets.filter((_, index) => !isShellPage(presentationOutput.pageContents[index])),
        previous: visual,
        previousReview: visualReview,
        previousResolution: visualResolution,
        previousRenderResult: renderResult,
        semanticRefinementAllowed: !semanticRefinementUsed && typeof provider.refineContent === "function",
      });
      const refinementRequests = semanticRefinementUsed ? [] : normalizeSemanticRefinementRequests(
        compositionOutput.semanticRefinementRequests,
        bodyPageContents,
        candidateSets.filter((_, index) => !isShellPage(presentationOutput.pageContents[index])),
      );
      if (refinementRequests.length) {
        semanticRefinementUsed = true;
        const requestedPageIds = new Set(refinementRequests.map((request) => request.pageId));
        let refinementError = null;
        let refinementOutput = { refinements: [] };
        try {
          refinementOutput = await provider.refineContent({
            attempt: 1,
            requests: refinementRequests,
            pages: bodyPageContents.filter((page) => requestedPageIds.has(page.pageId)),
          });
        } catch (error) {
          if (!new Set(["MODEL_JSON_INVALID", "MODEL_REQUEST_TIMEOUT"]).has(error?.code)) throw error;
          refinementError = { code: error.code, message: error.message };
        }
        const refined = applySemanticRefinements(bodyPageContents, refinementRequests, refinementOutput);
        await writeJson(path.join(outputDir, "content", "semantic-refinement.json"), {
          schemaVersion: "1.0",
          requests: refinementRequests,
          report: refined.report,
          ...(refinementError ? { error: refinementError } : {}),
        });
        if (refined.changed) {
          const refinedById = new Map(refined.pageContents.map((page) => [page.pageId, page]));
          contentOutput = {
            ...contentOutput,
            pageContents: contentOutput.pageContents.map((page) => refinedById.get(page.pageId) ?? page),
          };
          presentationOutput = {
            ...presentationOutput,
            pageContents: presentationOutput.pageContents.map((page) => refinedById.get(page.pageId) ?? page),
          };
          bodyPageContents = presentationOutput.pageContents.filter((page) => !isShellPage(page));
          pageIntents = presentationOutput.pageContents.map((page) => (
            isShellPage(page) ? buildShellIntent(page) : buildPageIntentFromContent(page)
          ));
          assertContentOutput(validators, contentOutput, input.rawMarkdown);
          candidateSets = await options.visualCandidateProvider({
            root,
            skinId: input.skinId,
            deckPlan: presentationOutput.deckPlan,
            pageContents: presentationOutput.pageContents,
            pageIntents,
          });
          if (!Array.isArray(candidateSets) || candidateSets.length !== pageIntents.length
            || candidateSets.some((set) => !Array.isArray(set.candidates) || set.candidates.length === 0)) {
            throw new WorkflowError(
              "NO_RENDERABLE_VISUAL_CANDIDATES",
              "semantic-refinement",
              "局部语义细化后没有形成可渲染候选",
              { candidateSets },
            );
          }
        }
      }
      const normalizedBodyPlans = normalizeVisualPlan(
        validators,
        compositionOutput,
        bodyDeckPlan,
        bodyPageContents,
        pageIntents.filter((_, index) => !isShellPage(presentationOutput.pageContents[index])),
        input.skinId,
      );
      const bodyVisualByPageId = new Map(normalizedBodyPlans.visualPlan.pages.map((page) => [page.pageId, page]));
      const bodyCompositionByPageId = new Map(normalizedBodyPlans.compositionPlan.pages.map((page) => [page.pageId, page]));
      const shellSelections = new Map();
      presentationOutput.pageContents.forEach((page, index) => {
        if (!isShellPage(page)) return;
        shellSelections.set(page.pageId, shellVisualSelection({
          deckId: presentationOutput.deckPlan.deckId,
          skinId: input.skinId,
          page,
          intent: pageIntents[index],
          candidateSet: candidateSets[index],
        }));
      });
      normalizedPlans = {
        visualPlan: {
          ...normalizedBodyPlans.visualPlan,
          pages: presentationOutput.pageContents.map((page) => (
            isShellPage(page)
              ? shellSelections.get(page.pageId).visualPage
              : bodyVisualByPageId.get(page.pageId)
          )),
        },
        compositionPlan: {
          ...normalizedBodyPlans.compositionPlan,
          pages: presentationOutput.pageContents.map((page) => (
            isShellPage(page)
              ? shellSelections.get(page.pageId).compositionPage
              : bodyCompositionByPageId.get(page.pageId)
          )),
        },
      };
    } catch (error) {
      const recoverableCompositionError = (error instanceof WorkflowError
        && error.code === "SCHEMA_VALIDATION_FAILED")
        || new Set(["MODEL_JSON_INVALID", "MODEL_REQUEST_TIMEOUT"]).has(error?.code);
      if (!recoverableCompositionError || attempt === maxVisualAttempts) throw error;
      visualResolution = {
        status: "needs-director-revision",
        feedback: [{
          code: "visual-composition-invalid",
          errorCode: error.code,
          message: error.message,
          details: error.details ?? {},
        }],
      };
      continue;
    }
    visual = { ...normalizedPlans, pageIntents, candidateSets };
    await persistVisualAttempt(outputDir, attempt, visual, null);

    const resolved = await options.visualResolver({
      root,
      skinId: input.skinId,
      deckPlan: presentationOutput.deckPlan,
      pageContents: presentationOutput.pageContents,
      visualPlan: visual.visualPlan,
      compositionPlan: visual.compositionPlan,
      pageIntents: visual.pageIntents,
      candidateSets: visual.candidateSets,
      previousResolution: visualResolution,
    });
    visualResolution = resolved;
    if (!visualResolutionAccepted(resolved)) {
      await persistVisualAttempt(outputDir, attempt, visual, null, "visual-resolution.json", resolved);
      if (attempt === maxVisualAttempts) {
        throw new WorkflowError(
          "VISUAL_RESOLUTION_NOT_ACCEPTED",
          "visual-resolution",
          "视觉导演的家族或变体选择未通过确定性复核",
          { status: resolved?.status, feedback: resolved?.feedback ?? [], results: resolved?.results ?? [] },
        );
      }
      continue;
    }
    if (resolved.visualPlan) visual.visualPlan = resolved.visualPlan;
    if (resolved.compositionPlan) visual.compositionPlan = resolved.compositionPlan;
    assertResolvedVisual(validators, resolved, visual.pageIntents, visual.visualPlan, visual.compositionPlan);
    await persistVisualAttempt(outputDir, attempt, visual, resolved, "visual-resolution.json", {
      status: resolved.status ?? "accepted",
      results: resolved.results ?? [],
      feedback: resolved.feedback ?? [],
      warnings: resolved.warnings ?? [],
    });

    if (developmentReview) visualReview = await provider.visualReview({
      ...input,
      stage: "pre-render",
      attempt,
      deckPlan: presentationOutput.deckPlan,
      pageContents: presentationOutput.pageContents,
      visualPlan: visual.visualPlan,
      compositionPlan: visual.compositionPlan,
      pageIntents: visual.pageIntents,
      layoutDecisions: resolved.layoutDecisions,
      renderPayloads: resolved.renderPayloads,
    });
    if (developmentReview) {
      assertSchema(validators, validators.validateVisualReview, visualReview, "VisualReview(pre-render)", "visual-review-pre");
      assertReviewIdentity(visualReview, { deckId: presentationOutput.deckPlan.deckId, attempt, stage: "pre-render" });
      await persistVisualAttempt(outputDir, attempt, visual, resolved, "visual-review-pre.json", visualReview);
    }
    if (developmentReview && !reviewPasses(visualReview)) {
      if (attempt === maxVisualAttempts) {
        throw new WorkflowError(
          "VISUAL_REVIEW_NOT_CLOSED",
          "visual-review-pre",
          "渲染前视觉审查未通过；工作流不会渲染",
          { unresolvedErrors: unresolvedErrors(visualReview), verdict: visualReview.verdict },
        );
      }
      continue;
    }

    const attemptDir = path.join(outputDir, "visual", `attempt-${String(attempt).padStart(2, "0")}`);
    try {
      renderResult = await options.renderer({
        root,
        skinId: input.skinId,
        outputDir: path.join(attemptDir, "render"),
        deckPlan: presentationOutput.deckPlan,
        pageContents: presentationOutput.pageContents,
        visualPlan: visual.visualPlan,
        compositionPlan: visual.compositionPlan,
        pageIntents: visual.pageIntents,
        layoutDecisions: resolved.layoutDecisions,
        renderPayloads: resolved.renderPayloads,
      });
    } catch (error) {
      if (error?.code !== "COMPONENT_RUNTIME_OVERFLOW" || attempt === maxVisualAttempts) throw error;
      visualResolution = {
        status: "needs-director-revision",
        feedback: [{
          pageId: error.pageId,
          assetId: error.assetId,
          code: "component-runtime-overflow",
          message: "所选 Structure Group 在真实 HTML→PPT 编译时无法以规范字号完整承载；请改选该页的正文兜底候选",
        }],
      };
      await persistVisualAttempt(outputDir, attempt, visual, resolved, "render-runtime-overflow.json", visualResolution);
      continue;
    }
    await assertRenderResult(renderResult, presentationOutput.pageContents.length);
    const persistedRenderResult = {
      ...renderResult,
      outputPptx: path.relative(outputDir, path.resolve(renderResult.outputPptx)).replaceAll("\\", "/"),
      pageEvidence: renderResult.pageEvidence.map((item) => path.relative(outputDir, path.resolve(item)).replaceAll("\\", "/")),
      ...(renderResult.montage
        ? { montage: path.relative(outputDir, path.resolve(renderResult.montage)).replaceAll("\\", "/") }
        : {}),
    };
    await persistVisualAttempt(outputDir, attempt, visual, resolved, "render-result.json", persistedRenderResult);

    if (!developmentReview) {
      const delivery = {
        schemaVersion: "1.0",
        status: "delivered",
        workflowMode: "production",
        deckId: presentationOutput.deckPlan.deckId,
        skinId: input.skinId,
        pageCount: presentationOutput.pageContents.length,
        outputPptx: renderResult.outputPptx,
        deterministicQualityAudit: renderResult.qualityAudit,
      };
      await writeJson(path.join(outputDir, "workflow-result.json"), delivery);
      return { ...delivery, deckPlan: presentationOutput.deckPlan, pageContents: presentationOutput.pageContents, renderResult };
    }

    visualReview = await provider.visualReview({
      ...input,
      stage: "post-render",
      attempt,
      deckPlan: presentationOutput.deckPlan,
      pageContents: presentationOutput.pageContents,
      visualPlan: visual.visualPlan,
      compositionPlan: visual.compositionPlan,
      pageIntents: visual.pageIntents,
      layoutDecisions: resolved.layoutDecisions,
      renderPayloads: resolved.renderPayloads,
      renderResult,
      pageEvidence: renderResult.pageEvidence,
    });
    assertSchema(validators, validators.validateVisualReview, visualReview, "VisualReview(post-render)", "visual-review-post");
    assertReviewIdentity(visualReview, { deckId: presentationOutput.deckPlan.deckId, attempt, stage: "post-render" });
    await persistVisualAttempt(outputDir, attempt, visual, resolved, "visual-review-post.json", visualReview);
    if (reviewPasses(visualReview)) {
      const audit = {
        schemaVersion: "1.0",
        status: "internally-approved-awaiting-user-review",
        workflowMode: "development",
        deckId: presentationOutput.deckPlan.deckId,
        skinId: input.skinId,
        pageCount: presentationOutput.pageContents.length,
        outputPptx: renderResult.outputPptx,
        contentReviewId: contentReview.reviewId,
        visualReviewId: visualReview.reviewId,
      };
      await writeJson(path.join(outputDir, "workflow-result.json"), audit);
      return { ...audit, deckPlan: presentationOutput.deckPlan, pageContents: presentationOutput.pageContents, renderResult };
    }
    if (attempt === maxVisualAttempts) {
      throw new WorkflowError(
        "POST_RENDER_REVIEW_NOT_CLOSED",
        "visual-review-post",
        "渲染后视觉审查未通过；工作流不会把 PPT 标记为内部通过",
        { unresolvedErrors: unresolvedErrors(visualReview), verdict: visualReview.verdict },
      );
    }
  }

  throw new WorkflowError("WORKFLOW_INCOMPLETE", "workflow", "工作流未形成可交付结果");
}
