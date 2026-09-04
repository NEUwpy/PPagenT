import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPageIntentFromContent,
  enrichPageIntent,
  validateStructuredDataReferences,
} from "../content/page-content.mjs";
import { createRuleValidators, validationMessage } from "../selection/validation.mjs";
import { buildDeterministicContentFallback } from "../content/deterministic-content-fallback.mjs";
import { assertDirectorProvider } from "./director-provider.mjs";
import {
  applySemanticRefinements,
  normalizeSemanticRefinementRequests,
} from "./semantic-refinement.mjs";
import { buildShellIntent, isShellPage, shellRoleForPage, shellVisualSelection } from "./shell-scaffold.mjs";
import { candidateReadiness } from "./visual-resolution.mjs";
import { expandVisualSkillRouting } from "./visual-skill-router.mjs";
import { auditDeckRhythm, summarizeRhythmPages } from "./deck-rhythm.mjs";

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

function normalizeContentOutput(output) {
  if (!output || typeof output !== "object" || !Array.isArray(output.pageContents)) return output;
  const normalized = structuredClone(output);
  normalized.pageContents = normalized.pageContents.map((page) => {
    const items = Array.isArray(page?.items)
      ? page.items.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)
          || !Object.hasOwn(item, "points") || Array.isArray(item.points)) return item;
        if (item.points !== null && String(item.points).trim()) return item;
        const cleanItem = { ...item };
        delete cleanItem.points;
        return cleanItem;
      })
      : page?.items;
    const pointsChanged = Array.isArray(page?.items)
      && items.some((item, index) => item !== page.items[index]);
    const evidenceFragments = page?.logicIntent?.evidenceFragments;
    const groundedEvidenceFragments = Array.isArray(evidenceFragments)
      ? evidenceFragments.filter((fragment) => typeof fragment === "string" && page.sourceText?.includes(fragment))
      : [];
    const validEvidenceFragments = groundedEvidenceFragments.length
      ? groundedEvidenceFragments.slice(0, 3)
      : evidenceFragments;
    const evidenceChanged = Array.isArray(evidenceFragments)
      && (validEvidenceFragments.length !== evidenceFragments.length
        || validEvidenceFragments.some((fragment, index) => fragment !== evidenceFragments[index]));
    const normalizedPage = evidenceChanged || pointsChanged
      ? {
        ...page,
        ...(pointsChanged ? { items } : {}),
        ...(evidenceChanged ? {
          logicIntent: {
            ...page.logicIntent,
            evidenceFragments: validEvidenceFragments,
          },
        } : {}),
      }
      : page;
    const structured = normalizedPage?.structuredData;
    if (structured === undefined) return normalizedPage;
    if (structured !== null && (typeof structured !== "object" || Array.isArray(structured))) return normalizedPage;
    if (structured !== null && Object.keys(structured).length) return normalizedPage;
    const clean = { ...normalizedPage };
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
    const sourceFragments = typeof page.sourceText === "string"
      ? page.sourceText.split(/\n\s*\n/).map((fragment) => fragment.trim()).filter(Boolean)
      : [];
    if (!sourceFragments.length || sourceFragments.some((fragment) => !rawMarkdown.includes(fragment))) {
      throw new WorkflowError(
        "SOURCE_GROUNDING_FAILED",
        "content-director",
        `${page.pageId} 的 sourceText 含有无法在原稿中核对的文本片段`,
        { pageId: page.pageId },
      );
    }
    const evidenceFragments = page.logicIntent?.evidenceFragments ?? [];
    if (evidenceFragments.some((fragment) => !page.sourceText.includes(fragment))) {
      throw new WorkflowError(
        "SOURCE_GROUNDING_FAILED",
        "content-director",
        `${page.pageId} 的 Logic 判断证据不是该页原文中的连续片段`,
        { pageId: page.pageId, field: "logicIntent.evidenceFragments" },
      );
    }
    if (page.logicIntent?.logicId === "problem-solution"
      && !new Set(["problem-solution", "problem-method-result"]).has(page.structuredData?.type)) {
      throw new WorkflowError(
        "CONTENT_LOGIC_MISMATCH",
        "content-director",
        `${page.pageId} 选择了问题方案结果 Logic，却没有提供可调用资产所需的问题—方案结构化关系`,
        {
          pageId: page.pageId,
          logicId: page.logicIntent.logicId,
          requiredStructuredDataTypes: ["problem-solution", "problem-method-result"],
        },
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
  });

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

function visualCandidateId(candidate) {
  return [candidate.familyId, candidate.variantId, candidate.silhouette].join("::");
}

function fallbackCenterLabel(title) {
  const clean = String(title ?? "").replace(/[\s，。！？；：、“”‘’（）()【】《》]/g, "");
  const clipped = Array.from(clean).slice(0, 8).join("");
  if (Array.from(clipped).length >= 2) return clipped;
  return clipped ? `${clipped}主题` : "本页主题";
}

function lockCandidateSetsToBodyFallback(candidateSets, pageIds) {
  const targets = new Set(pageIds);
  return candidateSets.map((set) => {
    if (!targets.has(set.pageId)) return set;
    const fallback = set.fallbackCandidate ?? set.candidates?.find((candidate) => candidate.fallbackBody);
    if (!fallback) return set;
    return {
      ...set,
      candidates: [{ ...fallback, readiness: "fallback" }],
      selectionMode: "fallback-locked",
      fallback: set.fallback ?? {
        type: set.gap?.type ?? "workflow-fallback",
        assetId: fallback.assetId,
        reason: "内容修订预算耗尽，程序使用主题正文兜底",
      },
    };
  });
}

function recordNativePreviewFallbacks(fallbackEvents, stagingResult) {
  for (const fallback of stagingResult?.renderFallbacks ?? []) {
    const event = {
      stage: "native-preview",
      code: fallback.code ?? "render-fallback",
      trigger: fallback.from ?? "resolved-layout",
      message: `页面组合从 ${fallback.from ?? "unknown"} 降级为 ${fallback.to ?? "unknown"}`,
      pageIds: fallback.pageId ? [fallback.pageId] : [],
      from: fallback.from,
      to: fallback.to,
    };
    const key = JSON.stringify([event.stage, event.code, event.pageIds, event.from, event.to]);
    const duplicated = fallbackEvents.some((existing) => (
      JSON.stringify([existing.stage, existing.code, existing.pageIds, existing.from, existing.to]) === key
    ));
    if (!duplicated) fallbackEvents.push(event);
  }
}

export function buildDeterministicVisualFallback({
  deckPlan,
  pageContents,
  pageIntents,
  candidateSets,
  skinId,
  forceFallbackPageIds = [],
}) {
  const forced = new Set(forceFallbackPageIds);
  const usage = new Map();
  const normalizedSets = candidateSets.map((set, index) => {
    const forceFallback = forced.has(set.pageId) || !(set.candidates?.length);
    if (forceFallback) {
      const fallback = set.fallbackCandidate ?? set.candidates?.find((candidate) => candidate.fallbackBody);
      if (!fallback) {
        throw new WorkflowError(
          "DETERMINISTIC_VISUAL_FALLBACK_UNAVAILABLE",
          "visual-fallback",
          `${set.pageId} 没有正文兜底候选`,
          { pageId: set.pageId },
        );
      }
      return {
        ...set,
        candidates: [{ ...fallback, readiness: "fallback" }],
        selectionMode: "fallback-locked",
      };
    }
    const legal = set.candidates.filter((candidate) => (
      new Set(["ready", "derivable"]).has(candidateReadiness(candidate))
    ));
    const pool = set.lockedStructureGroupId
      ? legal.filter((candidate) => candidate.structureGroupId === set.lockedStructureGroupId)
      : legal;
    if (!pool.length) {
      const fallback = set.fallbackCandidate ?? set.candidates.find((candidate) => candidate.fallbackBody);
      if (!fallback) {
        throw new WorkflowError(
          "DETERMINISTIC_VISUAL_FALLBACK_UNAVAILABLE",
          "visual-fallback",
          `${set.pageId} 没有可用候选`,
          { pageId: set.pageId, candidateCount: set.candidates.length },
        );
      }
      return {
        ...set,
        candidates: [{ ...fallback, readiness: "fallback" }],
        selectionMode: "fallback-locked",
      };
    }
    const ranked = [...pool].sort((left, right) => {
      const leftUses = usage.get(left.structureGroupId ?? left.assetId) ?? 0;
      const rightUses = usage.get(right.structureGroupId ?? right.assetId) ?? 0;
      return leftUses - rightUses || visualCandidateId(left).localeCompare(visualCandidateId(right));
    });
    const selected = ranked[0];
    const key = selected.structureGroupId ?? selected.assetId;
    usage.set(key, (usage.get(key) ?? 0) + 1);
    return { ...set, selectionMode: "deterministic-ranking", deterministicSelectedCandidateId: visualCandidateId(selected) };
  });
  const selections = normalizedSets.map((set, index) => {
    const candidate = set.selectionMode === "fallback-locked"
      ? set.candidates[0]
      : set.candidates.find((item) => visualCandidateId(item) === set.deterministicSelectedCandidateId)
        ?? set.candidates[0];
    return {
      pageId: pageContents[index].pageId,
      candidateId: visualCandidateId(candidate),
      centerLabel: fallbackCenterLabel(pageContents[index].title),
      reason: candidate.fallbackBody
        ? "视觉导演不可用或候选不合法，程序使用主题正文兜底"
        : "视觉导演不可用，程序按语义适配、合法性与重复次数确定候选",
    };
  });
  return {
    candidateSets: normalizedSets.map(({ deterministicSelectedCandidateId, ...set }) => set),
    plans: expandVisualSkillRouting({ selections }, {
      deckPlan,
      pageContents,
      pageIntents,
      candidateSets: normalizedSets,
      skinId,
    }),
  };
}

function mergeShellAndBodyPlans({
  bodyPlans,
  presentationOutput,
  pageIntents,
  candidateSets,
  skinId,
}) {
  const bodyVisualByPageId = new Map(bodyPlans.visualPlan.pages.map((page) => [page.pageId, page]));
  const bodyCompositionByPageId = new Map(bodyPlans.compositionPlan.pages.map((page) => [page.pageId, page]));
  const shellSelections = new Map();
  presentationOutput.pageContents.forEach((page, index) => {
    if (!isShellPage(page)) return;
    shellSelections.set(page.pageId, shellVisualSelection({
      deckId: presentationOutput.deckPlan.deckId,
      skinId,
      page,
      intent: pageIntents[index],
      candidateSet: candidateSets[index],
    }));
  });
  const visualPages = presentationOutput.pageContents.map((page) => {
    if (!isShellPage(page)) return bodyVisualByPageId.get(page.pageId);
    const role = shellRoleForPage(page);
    const shellPage = shellSelections.get(page.pageId).visualPage;
    return {
      ...shellPage,
      pageRole: role === "cover" ? "opening" : role === "closing" ? "closing" : "orientation",
      densityTarget: "quiet",
      visualWeight: role === "cover" ? "peak" : role === "closing" ? "anchor" : "quiet",
      compositionFamily: role,
      ...(role === "agenda" ? { contrastBreakBefore: true } : {}),
    };
  });
  return {
    visualPlan: {
      ...bodyPlans.visualPlan,
      rhythmPlan: summarizeRhythmPages(visualPages),
      pages: visualPages,
    },
    compositionPlan: {
      ...bodyPlans.compositionPlan,
      pages: presentationOutput.pageContents.map((page) => (
        isShellPage(page) ? shellSelections.get(page.pageId).compositionPage : bodyCompositionByPageId.get(page.pageId)
      )),
    },
  };
}

const logicLabels = {
  comparison: "对比与选择",
  sequence: "顺序流程",
  progression: "递进与成熟度",
  parallel: "并列与枚举",
  hierarchy: "层级与组织",
  convergence: "汇聚、分流与转化",
  "problem-solution": "问题、方案与结果",
};

export function buildAssetGapReport(candidateSets, pageContents) {
  const pageById = new Map(pageContents.map((page) => [page.pageId, page]));
  const fallbackPages = candidateSets
    .filter((set) => set.gap?.type === "asset-gap" && set.candidates?.some((item) => item.fallbackBody))
    .map((set) => {
      const page = pageById.get(set.pageId);
      return {
        pageId: set.pageId,
        title: page?.title ?? set.pageId,
        logicId: set.gap.logicId ?? page?.logicIntent?.logicId ?? null,
        baseRelation: set.gap.baseRelation ?? null,
        itemCount: set.gap.itemCount ?? page?.items?.length ?? 0,
        reason: set.gap.reason,
        fallbackAssetId: set.candidates.find((item) => item.fallbackBody)?.assetId ?? null,
      };
    });
  const grouped = new Map();
  for (const page of fallbackPages) {
    const key = `${page.logicId ?? "unknown"}:${page.baseRelation ?? "unknown"}`;
    const entry = grouped.get(key) ?? {
      logicId: page.logicId,
      logicLabel: logicLabels[page.logicId] ?? page.logicId ?? "待确认 Logic",
      baseRelation: page.baseRelation,
      affectedPageIds: [],
      itemCounts: new Set(),
    };
    entry.affectedPageIds.push(page.pageId);
    entry.itemCounts.add(page.itemCount);
    grouped.set(key, entry);
  }
  const recommendedStructureSupplements = [...grouped.values()].map((entry) => {
    const itemCounts = [...entry.itemCounts].sort((a, b) => a - b);
    return {
      logicId: entry.logicId,
      logicLabel: entry.logicLabel,
      baseRelation: entry.baseRelation,
      itemCounts,
      affectedPageIds: entry.affectedPageIds,
      assessment: "necessary-existing-logic-supplement",
      recommendation: `为“${entry.logicLabel}”补充可承载 ${itemCounts.join("/")} 项标题与正文的通用 Structure Group`,
      reason: "原稿关系已明确属于该 Logic，但当前核心资产没有语义与容量均兼容的表达方式",
    };
  });
  return {
    schemaVersion: "1.0",
    status: fallbackPages.length ? "fallback-used" : "no-gap",
    fallbackPageCount: fallbackPages.length,
    fallbackPages,
    recommendedStructureSupplements,
  };
}

export function buildProductionStatistics({
  candidateSets,
  pageContents,
  layoutDecisions,
  compositionPlan = null,
  visualPlan = null,
  assetGapReport,
}) {
  const decisionsByIntent = new Map((layoutDecisions ?? []).map((decision) => [decision.intentId, decision]));
  const compositionByIntent = new Map((compositionPlan?.pages ?? []).map((page) => [page.intentId, page]));
  const pageById = new Map(pageContents.map((page) => [page.pageId, page]));
  const usageByAsset = new Map();
  const logicById = new Map();
  const pageCandidateDiagnostics = [];
  let editorialPageCount = 0;
  let structurePageCount = 0;
  const bodyPages = pageContents.filter((page) => !isShellPage(page));

  for (const set of candidateSets.filter((item) => bodyPages.some((page) => page.pageId === item.pageId))) {
    const decision = decisionsByIntent.get(set.intentId);
    const candidatePool = [...(set.candidates ?? []), ...(set.fallbackCandidate ? [set.fallbackCandidate] : [])];
    const hasSelectedVariantTuple = Boolean(
      decision?.selectedFamilyId && decision?.selectedVariantId && decision?.selectedSilhouette,
    );
    const selected = candidatePool.find((candidate) => (
      candidate.assetId === decision?.selectedAssetId
      && (!hasSelectedVariantTuple || (candidate.familyId === decision.selectedFamilyId
        && candidate.variantId === decision?.selectedVariantId
        && candidate.silhouette === decision?.selectedSilhouette))
      && (!decision?.structureSourceItemId
        || candidate.expressionSource?.sourceItemId === decision.structureSourceItemId)
    ));
    const page = pageById.get(set.pageId);
    const eligibleCandidates = set.candidateDiagnostics
      ? set.candidateDiagnostics.eligible
        .map((candidate) => ({
          ...candidate,
          variants: candidate.variants.filter((variant) => (
            new Set(["ready", "derivable"]).has(variant.readiness ?? variant.contentReadiness)
          )),
        }))
        .filter((candidate) => candidate.variants.length > 0)
      : set.candidates
        .filter((candidate) => !candidate.fallbackBody)
        .map((candidate) => ({
          assetId: candidate.assetId,
          structureGroupId: candidate.structureGroupId,
          variants: [{
            variantId: candidate.variantId,
            readiness: candidateReadiness(candidate),
          }],
        }));
    const retainedCandidates = (set.candidates ?? []).map((candidate) => ({
      assetId: candidate.assetId,
      structureGroupId: candidate.structureGroupId ?? null,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
      readiness: candidateReadiness(candidate, { assetGap: set.gap?.type === "asset-gap" }),
      reasons: candidate.reasons ?? [],
    }));
    const excludedCandidates = (set.candidateDiagnostics?.rejected ?? [])
      .filter((candidate) => candidate.readiness === "incompatible")
      .map((candidate) => ({
        assetId: candidate.assetId,
        readiness: "incompatible",
        stage: candidate.stage,
        reasons: candidate.reasons ?? [],
      }));
    const selectedReadiness = selected
      ? candidateReadiness(selected, {
        assetGap: set.gap?.type === "asset-gap",
        runtimeOverflow: decision?.selectionSource === "deterministic-fallback" && set.gap?.type !== "asset-gap",
      })
      : null;
    const fallbackUsed = decision?.selectionSource === "deterministic-fallback" || selectedReadiness === "fallback";
    const fallbackReason = !fallbackUsed
      ? null
      : set.gap?.type === "asset-gap"
        ? { code: "asset-gap", detail: set.gap.reason ?? null }
        : selected && !(set.candidates ?? []).includes(selected) && set.fallbackCandidate
          ? { code: "component-runtime-overflow", detail: null }
          : { code: "deterministic-fallback", detail: null };
    const selectedComposition = compositionByIntent.get(set.intentId);
    const legalCandidateCount = eligibleCandidates.length;
    const editorial = page?.logicIntent?.logicId === "editorial"
      || (selected?.fallbackBody && !fallbackUsed);
    pageCandidateDiagnostics.push({
      pageId: set.pageId,
      title: page?.title ?? set.pageId,
      logicId: set.candidateDiagnostics?.query?.logicId ?? page?.logicIntent?.logicId ?? null,
      candidateCount: legalCandidateCount,
      diagnosis: editorial
        ? "editorial"
        : legalCandidateCount === 0
        ? (set.gap?.type ?? "no-structure-candidate")
        : legalCandidateCount === 1
          ? "single-legal-candidate"
          : "multiple-legal-candidates",
      selectedAssetId: selected?.assetId ?? decision?.selectedAssetId ?? null,
      selectedStructureAssetId: selected?.fallbackBody ? null : selected?.assetId ?? null,
      selectedCompositionId: selectedComposition?.compositionId ?? null,
      expressionStrategy: decision?.expressionStrategy ?? "registered-structure",
      componentProjection: selectedComposition?.componentProjection ?? null,
      selectedReadiness,
      selectionSource: decision?.selectionSource ?? null,
      selectionOwner: decision?.selectionOwner ?? null,
      selected: selected || decision ? {
        assetId: selected?.assetId ?? decision?.selectedAssetId ?? null,
        structureAssetId: selected?.fallbackBody ? null : selected?.assetId ?? null,
        structureGroupId: selected?.structureGroupId ?? null,
        familyId: selected?.familyId ?? decision?.selectedFamilyId ?? null,
        variantId: selected?.variantId ?? decision?.selectedVariantId ?? null,
        silhouette: selected?.silhouette ?? decision?.selectedSilhouette ?? null,
        compositionId: selectedComposition?.compositionId ?? null,
        readiness: selectedReadiness,
        source: decision?.selectionSource ?? null,
        owner: decision?.selectionOwner ?? null,
      } : null,
      fallback: { used: fallbackUsed, reason: fallbackReason },
      retainedCandidates,
      excludedCandidates,
      eligibleCandidates,
      rejectedCandidates: set.candidateDiagnostics?.rejected ?? [],
    });
    if (!selected) continue;
    const logicId = set.gap?.logicId ?? selected.logicId ?? page?.logicIntent?.logicId ?? "unknown";
    const logic = logicById.get(logicId) ?? {
      logicId,
      logicLabel: logicLabels[logicId] ?? logicId,
      pageIds: [],
      structurePageIds: [],
      fallbackPageIds: [],
      editorialPageIds: [],
      assetIds: new Set(),
    };
    logic.pageIds.push(set.pageId);
    if (selected.fallbackBody) {
      if (fallbackUsed) logic.fallbackPageIds.push(set.pageId);
      else {
        editorialPageCount += 1;
        logic.editorialPageIds.push(set.pageId);
      }
    } else {
      structurePageCount += 1;
      logic.structurePageIds.push(set.pageId);
      logic.assetIds.add(selected.assetId);
      const usageKey = [
        selected.assetId,
        selected.familyId,
        selected.variantId,
        selected.silhouette,
      ].join("::");
      const usage = usageByAsset.get(usageKey) ?? {
        assetId: selected.assetId,
        logicId,
        structureGroupId: selected.structureGroupId ?? null,
        familyId: selected.familyId,
        variantId: selected.variantId,
        silhouette: selected.silhouette,
        pageIds: [],
      };
      usage.pageIds.push(set.pageId);
      usageByAsset.set(usageKey, usage);
    }
    logicById.set(logicId, logic);
  }

  const structureUsage = [...usageByAsset.values()]
    .map((usage) => ({ ...usage, useCount: usage.pageIds.length }))
    .sort((a, b) => b.useCount - a.useCount || a.assetId.localeCompare(b.assetId));
  const repeatedStructures = structureUsage
    .filter((usage) => usage.useCount > 1)
    .map((usage) => ({ ...usage, repeatedUseCount: usage.useCount - 1 }));
  const logicUsage = [...logicById.values()].map((logic) => ({
    ...logic,
    pageCount: logic.pageIds.length,
    structurePageCount: logic.structurePageIds.length,
    fallbackPageCount: logic.fallbackPageIds.length,
    editorialPageCount: logic.editorialPageIds.length,
    assetIds: [...logic.assetIds],
  }));
  const fallbackPageCount = pageCandidateDiagnostics.filter((item) => item.fallback.used).length;
  const mixedPages = pageCandidateDiagnostics
    .filter((item) => item.expressionStrategy === "text-plus-structure")
    .map((item) => ({
      pageId: item.pageId,
      assetId: item.selectedStructureAssetId,
      compositionId: item.selectedCompositionId,
      componentProjection: item.componentProjection,
    }));
  const structuralDiagnostics = pageCandidateDiagnostics.filter((item) => item.diagnosis !== "editorial");
  const candidateAvailability = {
    zeroCandidatePageCount: structuralDiagnostics.filter((item) => item.candidateCount === 0).length,
    singleCandidatePageCount: structuralDiagnostics.filter((item) => item.candidateCount === 1).length,
    multipleCandidatePageCount: structuralDiagnostics.filter((item) => item.candidateCount > 1).length,
  };
  const availabilityByLogic = new Map();
  for (const item of structuralDiagnostics) {
    const entry = availabilityByLogic.get(item.logicId) ?? {
      logicId: item.logicId,
      logicLabel: logicLabels[item.logicId] ?? item.logicId,
      pageCount: 0,
      zeroCandidatePageCount: 0,
      singleCandidatePageCount: 0,
      multipleCandidatePageCount: 0,
      eligibleAssetIds: new Set(),
    };
    entry.pageCount += 1;
    if (item.candidateCount === 0) entry.zeroCandidatePageCount += 1;
    else if (item.candidateCount === 1) entry.singleCandidatePageCount += 1;
    else entry.multipleCandidatePageCount += 1;
    item.eligibleCandidates.forEach((candidate) => entry.eligibleAssetIds.add(candidate.assetId));
    availabilityByLogic.set(item.logicId, entry);
  }
  const candidateAvailabilityByLogic = [...availabilityByLogic.values()].map((entry) => ({
    ...entry,
    eligibleAssetIds: [...entry.eligibleAssetIds],
  }));
  const diversityGaps = candidateAvailabilityByLogic
    .filter((entry) => (
      entry.pageCount >= 2
      && entry.singleCandidatePageCount === entry.pageCount
      && entry.eligibleAssetIds.length === 1
    ))
    .map((entry) => ({
      logicId: entry.logicId,
      logicLabel: entry.logicLabel,
      affectedPageCount: entry.pageCount,
      onlyEligibleAssetId: entry.eligibleAssetIds[0],
      type: "single-generic-candidate",
      recommendation: "该 Logic 的高频普通内容只有一个合法候选；下一次独立入库任务应补充一组通用 Structure Group，或为现有组增加经审批的等价视觉变体。",
    }));
  const selectionSourceCounts = Object.fromEntries([
    "program-locked",
    "visual-director",
    "deterministic-ranking",
    "deterministic-fallback",
  ].map((source) => [
    source,
    pageCandidateDiagnostics.filter((item) => item.selectionSource === source).length,
  ]));
  const rhythmAudit = auditDeckRhythm({
    visualPlan,
    candidateSets,
    pageContents,
    pageIntents: pageContents.map((page) => buildPageIntentFromContent(page)),
  });
  return {
    schemaVersion: "1.0",
    bodyPageCount: bodyPages.length,
    structurePageCount,
    editorialPageCount,
    fallbackPageCount,
    mixedPageCount: mixedPages.length,
    mixedPages,
    selectionSourceCounts,
    structureCoverageRate: bodyPages.length ? Number((structurePageCount / bodyPages.length).toFixed(4)) : 0,
    uniqueStructureCount: structureUsage.length,
    repeatedStructureCount: repeatedStructures.length,
    repeatedUseCount: repeatedStructures.reduce((sum, item) => sum + item.repeatedUseCount, 0),
    structureUsage,
    repeatedStructures,
    logicUsage,
    candidateAvailability,
    candidateAvailabilityByLogic,
    diversityGaps,
    rhythmAudit,
    compositionFamilyUsage: Object.fromEntries(
      [...new Set((visualPlan?.pages ?? []).map((page) => page.compositionFamily).filter(Boolean))]
        .map((family) => [family, visualPlan.pages.filter((page) => page.compositionFamily === family).length]),
    ),
    pageCandidateDiagnostics,
    recommendedStructureSupplements: assetGapReport?.recommendedStructureSupplements ?? [],
  };
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
    const expectedOwner = decision.selectionSource ? {
      "program-locked": "program",
      "visual-director": "visual-director",
      "deterministic-ranking": "program",
      "deterministic-fallback": "program",
    }[decision.selectionSource] : "visual-director";
    const expectedState = decision.selectionSource === "deterministic-fallback" ? "fallback" : "selected";
    if (!expectedOwner || decision.selectionOwner !== expectedOwner || decision.selectionState !== expectedState
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

function replacePlanPage(plan, replacement) {
  return {
    ...plan,
    pages: plan.pages.map((page) => page.pageId === replacement.pageId ? replacement : page),
  };
}

function firstLegalCompositionAlternative(resolved, pageId, intentId) {
  const feedback = resolved?.feedback?.find((item) => item.pageId === pageId);
  const alternative = feedback?.legalAlternatives?.[0];
  if (!alternative) return null;
  return {
    pageId,
    intentId,
    ...alternative,
  };
}

function applyLegalCompositionAlternatives({ resolved, compositionPlan, visualPlan }) {
  let nextPlan = compositionPlan;
  const changedPageIds = [];
  for (const feedback of resolved?.feedback ?? []) {
    if (!feedback?.pageId) continue;
    const intentId = visualPlan?.pages?.find((item) => item.pageId === feedback.pageId)?.intentId;
    const alternative = firstLegalCompositionAlternative(resolved, feedback.pageId, intentId);
    if (!alternative) continue;
    nextPlan = replacePlanPage(nextPlan, alternative);
    changedPageIds.push(feedback.pageId);
  }
  return { compositionPlan: nextPlan, changedPageIds };
}

function capacityIssuesFromCandidateSets(candidateSets) {
  return candidateSets.flatMap((set) => (
    set.gap?.type === "content-capacity-gap"
      ? (set.gap.capacityRejections ?? set.capacityRejections ?? []).flatMap((rejection) => (
        (rejection.issues ?? []).map((issue) => ({
          pageId: set.pageId,
          assetId: rejection.assetId,
          variantId: rejection.variantId,
          ...issue,
        }))
      ))
      : []
  ));
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

async function assertNativePreviewResult(result, pageCount) {
  if (!result || result.status !== "ready-for-approval"
    || typeof result.stagedPptx !== "string" || !Array.isArray(result.pageEvidence)
    || result.pageEvidence.length !== pageCount
    || result.pageCount !== pageCount) {
    throw new WorkflowError(
      "NATIVE_PREVIEW_INVALID",
      "native-preview",
      "Native PPT 暂存阶段必须返回完整 PPTX 和逐页渲染证据",
      { pageCount, result },
    );
  }
  for (const target of [result.stagedPptx, ...result.pageEvidence]) await fs.access(path.resolve(target));
  if (!result.qualityAudit || result.qualityAudit.status !== "passed") {
    throw new WorkflowError(
      "NATIVE_PREVIEW_QUALITY_GATE_MISSING",
      "native-preview",
      "Native PPT 暂存结果未通过确定性质量门禁",
      { qualityAudit: result.qualityAudit ?? null },
    );
  }
}

async function persistContentAttempt(outputDir, attempt, output, review) {
  const attemptDir = path.join(outputDir, "content", `attempt-${String(attempt).padStart(2, "0")}`);
  if (typeof output.contentDraftMarkdown === "string") {
    await fs.mkdir(attemptDir, { recursive: true });
    await fs.writeFile(path.join(attemptDir, "content-draft.md"), `${output.contentDraftMarkdown.trim()}\n`, "utf8");
  }
  if (output.contentMetadata) await writeJson(path.join(attemptDir, "content-metadata.json"), output.contentMetadata);
  if (output.contentRepairReport?.actions?.length) {
    await writeJson(path.join(attemptDir, "content-local-repair.json"), output.contentRepairReport);
  }
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
  const maxContentAttempts = options.maxContentAttempts ?? 6;
  const maxVisualAttempts = options.maxVisualAttempts ?? 3;
  const semanticRefinementEnabled = options.allowSemanticRefinement === true;
  const guaranteeDelivery = options.guaranteeDelivery === true;
  const fallbackEvents = [];
  if (!Number.isInteger(maxContentAttempts) || maxContentAttempts < 1
    || !Number.isInteger(maxVisualAttempts) || maxVisualAttempts < 1) {
    throw new WorkflowError("INVALID_ATTEMPT_LIMIT", "bootstrap", "工作流循环次数必须是正整数");
  }
  const validators = await createRuleValidators(root);
  await fs.mkdir(outputDir, { recursive: true });

  let contentOutput = null;
  let lastValidContentOutput = null;
  let previousContentDraft = null;
  let contentReview = null;
  let contentAttempt = 0;
  const recoverableContentError = (error) => new Set([
    "MODEL_JSON_INVALID",
    "MODEL_REQUEST_TIMEOUT",
    "MODEL_REQUEST_FAILED",
    "MODEL_CONTENT_EMPTY",
    "DIRECTOR_PROVIDER_UNAVAILABLE",
    "CONTENT_MARKDOWN_INVALID",
    "CONTENT_METADATA_MISMATCH",
    "CONTENT_RELATION_COMPILE_FAILED",
    "CONTENT_HIERARCHY_COVERAGE_FAILED",
    "CONTENT_CAPACITY_EXCEEDED",
    "SCHEMA_VALIDATION_FAILED",
  ]).has(error?.code) || error?.name === "TypeError" || error?.name === "AbortError";
  const contentRevisionReview = (error) => ({
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
  });
  async function applyDeterministicContentFallback(error) {
    contentOutput = normalizeContentOutput(buildDeterministicContentFallback(input.rawMarkdown, {
      reason: `${error?.code ?? error?.name ?? "CONTENT_FAILURE"}: ${error?.message ?? String(error)}`,
    }));
    assertContentOutput(validators, contentOutput, input.rawMarkdown);
    fallbackEvents.push({
      stage: "content-director",
      code: "deterministic-content-fallback",
      trigger: error?.code ?? error?.name ?? "unknown",
      message: error?.message ?? String(error),
      pageIds: contentOutput.pageContents.map((page) => page.pageId),
    });
    await persistContentAttempt(outputDir, contentAttempt + 1, contentOutput, null);
  }
  async function executeContentAttempt(extra = {}) {
    contentAttempt += 1;
    try {
      contentOutput = normalizeContentOutput(await provider.contentDirector({
        ...input,
        attempt: contentAttempt,
        previous: previousContentDraft ?? contentOutput,
        previousReview: contentReview,
        ...extra,
      }));
      previousContentDraft = contentOutput;
    } catch (error) {
      const draft = error?.contentDirectorDraft;
      if (draft && typeof draft === "object" && !Array.isArray(draft)) {
        previousContentDraft = {
          contentDraftMarkdown: draft.contentMarkdown,
          contentMetadata: {
            schemaVersion: draft.schemaVersion,
            deckMetadata: draft.deckMetadata,
            pageMetadata: draft.pageMetadata,
          },
        };
      }
      throw error;
    }
    assertContentOutput(validators, contentOutput, input.rawMarkdown);
    lastValidContentOutput = structuredClone(contentOutput);
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
  async function executeContentRecovery(extra = {}) {
    while (contentAttempt < maxContentAttempts) {
      try {
        return await executeContentAttempt(extra);
      } catch (error) {
        if (!recoverableContentError(error)) throw error;
        if (contentAttempt === maxContentAttempts) {
          if (!guaranteeDelivery) throw error;
          if (lastValidContentOutput && (extra.capacityFeedback || extra.contractFeedback)) {
            contentOutput = structuredClone(lastValidContentOutput);
            fallbackEvents.push({
              stage: "content-director",
              code: "content-revision-exhausted-preserved-valid-draft",
              trigger: error?.code ?? error?.name ?? "unknown",
              message: "候选阶段的定向内容修订未能收口，保留上一份已通过语义、来源和结构校验的内容稿，后续仅对装不下的页面使用排版兜底",
              pageIds: contentOutput.pageContents.map((page) => page.pageId),
            });
            return true;
          }
          await applyDeterministicContentFallback(error);
          return true;
        }
        contentReview = contentRevisionReview(error);
      }
    }
    return false;
  }
  while (contentAttempt < maxContentAttempts) {
    try {
      if (await executeContentAttempt()) break;
    } catch (error) {
      if (error?.code === "CONTENT_CAPACITY_EXCEEDED"
        && contentOutput && contentAttempt === maxContentAttempts && guaranteeDelivery) {
        await persistContentAttempt(outputDir, contentAttempt, contentOutput, null);
        fallbackEvents.push({
          stage: "content-director",
          code: "content-capacity-deferred-to-layout",
          trigger: error.code,
          message: "内容恢复结果只剩通用容量问题；保留已通过语义与来源校验的内容稿，交由精确候选容量和正文兜底继续收口",
          pageIds: [...new Set((error.details?.issues ?? []).map((issue) => issue.pageId).filter(Boolean))],
        });
        break;
      }
      if (recoverableContentError(error) && contentAttempt === maxContentAttempts && guaranteeDelivery) {
        await applyDeterministicContentFallback(error);
        break;
      }
      if (!recoverableContentError(error) || contentAttempt === maxContentAttempts) throw error;
      contentReview = contentRevisionReview(error);
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
  let assetGapReport = buildAssetGapReport([], []);
  let productionStatistics = null;
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
      const capacityOnly = !invalidCandidateSets
        && gaps.length > 0
        && gaps.every((gap) => gap.type === "content-capacity-gap");
      const contentContractOnly = !invalidCandidateSets
        && gaps.length > 0
        && gaps.every((gap) => gap.type === "content-contract-gap");
      const capacityIssues = capacityIssuesFromCandidateSets(emptyCandidateSets);
      if (!invalidCandidateSets && capacityIssues.length && contentAttempt < maxContentAttempts) {
        contentReview = {
          verdict: "revise",
          summary: gaps.some((gap) => gap.type === "asset-gap")
            ? "部分页面存在资产缺口，但另有页面只是文字超容量；先修复可修的容量问题，再重新判断剩余缺口"
            : "结构语义已经命中，但部分文字超过资产容量；只定向压缩报错字段",
          issues: [{
            severity: "error",
            category: "content-capacity",
            status: "open",
            evidence: "候选生成阶段存在只由文字容量造成的空候选集",
            targets: [...new Set(capacityIssues.map((issue) => issue.pageId))],
            errorCode: "CONTENT_CAPACITY_EXCEEDED",
            details: { issues: capacityIssues },
          }],
        };
        await executeContentRecovery({ capacityFeedback: capacityIssues });
        attempt -= 1;
        continue;
      }
      if (contentContractOnly && contentAttempt < maxContentAttempts) {
        const contractGaps = emptyCandidateSets.map((set) => ({
          pageId: set.pageId,
          logicId: set.gap?.logicId,
          reason: set.gap?.reason,
          rejected: (set.candidateDiagnostics?.rejected ?? []).map((candidate) => ({
            assetId: candidate.assetId,
            reasons: candidate.reasons ?? [],
          })),
        }));
        contentReview = {
          verdict: "revise",
          summary: "页面 Logic 已匹配现有结构，但原稿支持的少量核心字段尚未提取；只定向补齐报错字段",
          issues: [{
            severity: "error",
            category: "content-contract",
            status: "open",
            evidence: "候选生成阶段存在可由原稿忠实补齐的内容契约缺口",
            targets: contractGaps.map((gap) => gap.pageId),
            errorCode: "CONTENT_CONTRACT_GAP",
            details: { gaps: contractGaps },
          }],
        };
        await executeContentRecovery({ contractFeedback: contractGaps });
        attempt -= 1;
        continue;
      }
      if (guaranteeDelivery && !invalidCandidateSets) {
        const fallbackPageIds = emptyCandidateSets.map((set) => set.pageId);
        candidateSets = lockCandidateSetsToBodyFallback(candidateSets, fallbackPageIds);
        const stillEmpty = candidateSets.filter((set) => !Array.isArray(set.candidates) || set.candidates.length === 0);
        if (stillEmpty.length) {
          throw new WorkflowError(
            "DETERMINISTIC_VISUAL_FALLBACK_UNAVAILABLE",
            "visual-candidates",
            "部分页面没有可用的正文兜底候选",
            { pageIds: stillEmpty.map((set) => set.pageId) },
          );
        }
        fallbackEvents.push({
          stage: "visual-candidates",
          code: "content-gap-body-fallback",
          trigger: gaps.map((gap) => gap.type),
          pageIds: fallbackPageIds,
          message: "内容修订预算耗尽，页面退回主题正文排版",
        });
      } else if (capacityOnly) {
        throw new WorkflowError(
          "CONTENT_CAPACITY_EXCEEDED",
          "visual-candidates",
          "页面关系已有匹配资产，但文字在定向修订后仍超过已登记容量",
          { candidateSets, gaps, capacityIssues, contentAttempt },
        );
      } else if (contentContractOnly) {
        throw new WorkflowError(
          "CONTENT_CONTRACT_GAP",
          "visual-candidates",
          "页面 Logic 已匹配结构，但唯一内容修订后仍缺少原稿可支持的核心字段",
          { candidateSets, gaps, contentAttempt },
        );
      } else {
        throw new WorkflowError(
        "ASSET_GAP",
        "visual-candidates",
        gaps.some((gap) => gap.type === "content-capacity-gap")
          ? "原稿同时存在真实资产缺口和可压缩的容量问题；因资产缺口流程已停止"
          : "原稿需要的结构尚未被核心资产库覆盖；流程已停止，未改写语义或退回正文兜底",
          { candidateSets, gaps, capacityIssues, contentAttempt },
        );
      }
    }
    assetGapReport = buildAssetGapReport(candidateSets, presentationOutput.pageContents);
    await writeJson(path.join(outputDir, "asset-gap-report.json"), assetGapReport);
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
        semanticRefinementAllowed: semanticRefinementEnabled
          && !semanticRefinementUsed
          && typeof provider.refineContent === "function",
      });
      const refinementRequests = !semanticRefinementEnabled || semanticRefinementUsed ? [] : normalizeSemanticRefinementRequests(
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
      normalizedPlans = mergeShellAndBodyPlans({
        bodyPlans: normalizedBodyPlans,
        presentationOutput,
        pageIntents,
        candidateSets,
        skinId: input.skinId,
      });
    } catch (error) {
      const recoverableCompositionError = (error instanceof WorkflowError
        && error.code === "SCHEMA_VALIDATION_FAILED")
        || new Set([
          "MODEL_JSON_INVALID", "MODEL_REQUEST_TIMEOUT", "MODEL_REQUEST_FAILED",
          "MODEL_CONTENT_EMPTY", "DIRECTOR_PROVIDER_UNAVAILABLE",
        ]).has(error?.code)
        || error?.name === "TypeError" || error?.name === "AbortError";
      if (guaranteeDelivery && recoverableCompositionError) {
        const bodyIndexes = presentationOutput.pageContents
          .map((page, index) => (!isShellPage(page) ? index : -1))
          .filter((index) => index >= 0);
        const deterministic = buildDeterministicVisualFallback({
          deckPlan: bodyDeckPlan,
          pageContents: bodyPageContents,
          pageIntents: bodyIndexes.map((index) => pageIntents[index]),
          candidateSets: bodyIndexes.map((index) => candidateSets[index]),
          skinId: input.skinId,
        });
        bodyIndexes.forEach((sourceIndex, bodyIndex) => {
          candidateSets[sourceIndex] = deterministic.candidateSets[bodyIndex];
        });
        normalizedPlans = mergeShellAndBodyPlans({
          bodyPlans: deterministic.plans,
          presentationOutput,
          pageIntents,
          candidateSets,
          skinId: input.skinId,
        });
        fallbackEvents.push({
          stage: "visual-director",
          code: "deterministic-visual-routing",
          trigger: error?.code ?? error?.name ?? "unknown",
          message: error?.message ?? String(error),
          pageIds: bodyPageContents.map((page) => page.pageId),
        });
      } else {
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
    }
    visual = { ...normalizedPlans, pageIntents, candidateSets };
    await persistVisualAttempt(outputDir, attempt, visual, null);

    let resolved = await options.visualResolver({
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
    if (!visualResolutionAccepted(resolved) && guaranteeDelivery) {
      await persistVisualAttempt(outputDir, attempt, visual, null, "visual-resolution-primary-failed.json", resolved);
      if (attempt < maxVisualAttempts) {
        // Preserve the original deterministic feedback for the next model
        // call. Falling back early can create a new overflow and obscure the
        // actual page-level problem that the visual director should repair.
        continue;
      }
      const failedPageIds = new Set((resolved?.feedback ?? [])
        .map((item) => item?.pageId)
        .filter((pageId) => bodyPageIds.has(pageId)));
      const fallbackAllBodyPages = failedPageIds.size === 0;
      const fallbackEntries = presentationOutput.pageContents
        .map((page, sourceIndex) => ({
          page,
          sourceIndex,
          bodyIndex: bodyPageContents.findIndex((bodyPage) => bodyPage.pageId === page.pageId),
        }))
        .filter((entry) => entry.bodyIndex >= 0
          && (fallbackAllBodyPages || failedPageIds.has(entry.page.pageId)));
      const fallbackPageIds = fallbackEntries.map((entry) => entry.page.pageId);
      const deterministic = buildDeterministicVisualFallback({
        deckPlan: {
          ...bodyDeckPlan,
          pages: bodyDeckPlan.pages.filter((page) => fallbackPageIds.includes(page.pageId)),
        },
        pageContents: fallbackEntries.map((entry) => bodyPageContents[entry.bodyIndex]),
        pageIntents: fallbackEntries.map((entry) => pageIntents[entry.sourceIndex]),
        candidateSets: fallbackEntries.map((entry) => candidateSets[entry.sourceIndex]),
        skinId: input.skinId,
        forceFallbackPageIds: fallbackPageIds,
      });
      fallbackEntries.forEach((entry, fallbackIndex) => {
        candidateSets[entry.sourceIndex] = deterministic.candidateSets[fallbackIndex];
      });
      let fallbackVisualPlan = visual.visualPlan;
      let fallbackCompositionPlan = visual.compositionPlan;
      deterministic.plans.visualPlan.pages.forEach((page) => {
        fallbackVisualPlan = replacePlanPage(fallbackVisualPlan, page);
      });
      deterministic.plans.compositionPlan.pages.forEach((page) => {
        fallbackCompositionPlan = replacePlanPage(fallbackCompositionPlan, page);
      });
      fallbackVisualPlan = {
        ...fallbackVisualPlan,
        rhythmPlan: summarizeRhythmPages(fallbackVisualPlan.pages),
      };
      visual = {
        visualPlan: fallbackVisualPlan,
        compositionPlan: fallbackCompositionPlan,
        pageIntents,
        candidateSets,
      };
      resolved = await options.visualResolver({
        root,
        skinId: input.skinId,
        deckPlan: presentationOutput.deckPlan,
        pageContents: presentationOutput.pageContents,
        visualPlan: visual.visualPlan,
        compositionPlan: visual.compositionPlan,
        pageIntents: visual.pageIntents,
        candidateSets: visual.candidateSets,
        previousResolution: resolved,
      });
      visualResolution = resolved;
      if (!visualResolutionAccepted(resolved)) {
        const alternativeResult = applyLegalCompositionAlternatives({
          resolved,
          compositionPlan: visual.compositionPlan,
          visualPlan: visual.visualPlan,
        });
        if (alternativeResult.changedPageIds.length) {
          visual = { ...visual, compositionPlan: alternativeResult.compositionPlan };
          resolved = await options.visualResolver({
            root,
            skinId: input.skinId,
            deckPlan: presentationOutput.deckPlan,
            pageContents: presentationOutput.pageContents,
            visualPlan: visual.visualPlan,
            compositionPlan: visual.compositionPlan,
            pageIntents: visual.pageIntents,
            candidateSets: visual.candidateSets,
            previousResolution: resolved,
          });
          visualResolution = resolved;
          fallbackEvents.push({
            stage: "visual-resolution",
            code: "legal-composition-fallback",
            trigger: "deterministic-body-composition-not-accepted",
            message: "正文兜底的默认文字组合仍无法承载内容，程序采用复核器返回的合法文字组合后重新复核",
            pageIds: alternativeResult.changedPageIds,
          });
        }
      }
      fallbackEvents.push({
        stage: "visual-resolution",
        code: "deterministic-body-fallback",
        trigger: "visual-resolution-not-accepted",
        message: "视觉选择未通过确定性复核，程序只将失败页切换为主题正文兜底",
        pageIds: fallbackPageIds,
      });
    }
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
    productionStatistics = buildProductionStatistics({
      candidateSets: visual.candidateSets,
      pageContents: presentationOutput.pageContents,
      layoutDecisions: resolved.layoutDecisions,
      compositionPlan: visual.compositionPlan,
      visualPlan: visual.visualPlan,
      assetGapReport,
    });
    await writeJson(path.join(outputDir, "production-statistics.json"), productionStatistics);

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
    let stagingResult = null;
    try {
      if (options.stagingRenderer) {
        stagingResult = await options.stagingRenderer({
          root,
          skinId: input.skinId,
          outputDir: path.join(attemptDir, "native-preview"),
          deckPlan: presentationOutput.deckPlan,
          pageContents: presentationOutput.pageContents,
          visualPlan: visual.visualPlan,
          compositionPlan: visual.compositionPlan,
          pageIntents: visual.pageIntents,
          layoutDecisions: resolved.layoutDecisions,
          renderPayloads: resolved.renderPayloads,
        });
        await assertNativePreviewResult(stagingResult, presentationOutput.pageContents.length);
        recordNativePreviewFallbacks(fallbackEvents, stagingResult);
        if (options.nativePreviewApprover) {
          stagingResult = await options.nativePreviewApprover(stagingResult);
          if (stagingResult?.approvalStatus !== "approved") {
            throw new WorkflowError("NATIVE_PREVIEW_NOT_APPROVED", "native-preview", "Native PPT 预览尚未确认，不能交付");
          }
        }
      }
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
        stagingResult,
      });
    } catch (error) {
      if (error?.code === "COMPONENT_RUNTIME_OVERFLOW" && guaranteeDelivery) {
        const overflowPageIds = [...new Set(
          (Array.isArray(error.pageIds) && error.pageIds.length ? error.pageIds : [error.pageId]).filter(Boolean),
        )];
        const overflowEntries = overflowPageIds.map((pageId) => ({
          pageId,
          sourceIndex: presentationOutput.pageContents.findIndex((page) => page.pageId === pageId),
          bodyIndex: bodyPageContents.findIndex((page) => page.pageId === pageId),
          deckPage: bodyDeckPlan.pages.find((page) => page.pageId === pageId),
        }));
        if (!overflowEntries.length || overflowEntries.some((entry) => entry.sourceIndex < 0 || entry.bodyIndex < 0)) throw error;
        const deterministic = buildDeterministicVisualFallback({
          deckPlan: { ...bodyDeckPlan, pages: overflowEntries.map((entry) => entry.deckPage).filter(Boolean) },
          pageContents: overflowEntries.map((entry) => bodyPageContents[entry.bodyIndex]),
          pageIntents: overflowEntries.map((entry) => pageIntents[entry.sourceIndex]),
          candidateSets: overflowEntries.map((entry) => candidateSets[entry.sourceIndex]),
          skinId: input.skinId,
          forceFallbackPageIds: overflowPageIds,
        });
        overflowEntries.forEach((entry, index) => {
          candidateSets[entry.sourceIndex] = deterministic.candidateSets[index];
        });
        let fallbackVisualPlan = visual.visualPlan;
        let fallbackCompositionPlan = visual.compositionPlan;
        deterministic.plans.visualPlan.pages.forEach((page) => {
          fallbackVisualPlan = replacePlanPage(fallbackVisualPlan, page);
        });
        deterministic.plans.compositionPlan.pages.forEach((page) => {
          fallbackCompositionPlan = replacePlanPage(fallbackCompositionPlan, page);
        });
        visual = {
          ...visual,
          visualPlan: fallbackVisualPlan,
          compositionPlan: fallbackCompositionPlan,
          pageIntents,
          candidateSets,
        };
        resolved = await options.visualResolver({
          root,
          skinId: input.skinId,
          deckPlan: presentationOutput.deckPlan,
          pageContents: presentationOutput.pageContents,
          visualPlan: visual.visualPlan,
          compositionPlan: visual.compositionPlan,
          pageIntents: visual.pageIntents,
          candidateSets: visual.candidateSets,
          previousResolution: {
            status: "needs-director-revision",
            feedback: overflowEntries.map((entry) => ({
              pageId: entry.pageId,
              assetId: error.overflows?.find((item) => item.pageId === entry.pageId)?.assetId ?? error.assetId,
              code: "component-runtime-overflow",
            })),
          },
        });
        if (!visualResolutionAccepted(resolved)) {
          let alternativeCompositionPlan = visual.compositionPlan;
          let alternativeFound = false;
          for (const entry of overflowEntries) {
            const alternative = firstLegalCompositionAlternative(
              resolved,
              entry.pageId,
              pageIntents[entry.sourceIndex].intentId,
            );
            if (!alternative) continue;
            alternativeCompositionPlan = replacePlanPage(alternativeCompositionPlan, alternative);
            alternativeFound = true;
          }
          if (alternativeFound) {
            visual = {
              ...visual,
              compositionPlan: alternativeCompositionPlan,
            };
            resolved = await options.visualResolver({
              root,
              skinId: input.skinId,
              deckPlan: presentationOutput.deckPlan,
              pageContents: presentationOutput.pageContents,
              visualPlan: visual.visualPlan,
              compositionPlan: visual.compositionPlan,
              pageIntents: visual.pageIntents,
              candidateSets: visual.candidateSets,
              previousResolution: resolved,
            });
          }
        }
        if (!visualResolutionAccepted(resolved)) {
          throw new WorkflowError(
            "VISUAL_RESOLUTION_NOT_ACCEPTED",
            "visual-resolution",
            "运行时溢出后的正文兜底仍未通过确定性复核",
            { pageIds: overflowPageIds, feedback: resolved?.feedback ?? [] },
          );
        }
        if (resolved.visualPlan) visual.visualPlan = resolved.visualPlan;
        if (resolved.compositionPlan) visual.compositionPlan = resolved.compositionPlan;
        visualResolution = resolved;
        assertResolvedVisual(validators, resolved, visual.pageIntents, visual.visualPlan, visual.compositionPlan);
        await persistVisualAttempt(outputDir, attempt, visual, resolved, "render-runtime-fallback.json", {
          status: "accepted",
          trigger: { pageIds: overflowPageIds, overflows: error.overflows ?? [], code: error.code },
        });
        productionStatistics = buildProductionStatistics({
          candidateSets: visual.candidateSets,
          pageContents: presentationOutput.pageContents,
          layoutDecisions: resolved.layoutDecisions,
          compositionPlan: visual.compositionPlan,
          visualPlan: visual.visualPlan,
          assetGapReport,
        });
        await writeJson(path.join(outputDir, "production-statistics.json"), productionStatistics);
        if (options.stagingRenderer) {
          stagingResult = await options.stagingRenderer({
            root,
            skinId: input.skinId,
            outputDir: path.join(attemptDir, "native-preview-fallback"),
            deckPlan: presentationOutput.deckPlan,
            pageContents: presentationOutput.pageContents,
            visualPlan: visual.visualPlan,
            compositionPlan: visual.compositionPlan,
            pageIntents: visual.pageIntents,
            layoutDecisions: resolved.layoutDecisions,
            renderPayloads: resolved.renderPayloads,
          });
          await assertNativePreviewResult(stagingResult, presentationOutput.pageContents.length);
          recordNativePreviewFallbacks(fallbackEvents, stagingResult);
          if (options.nativePreviewApprover) {
            stagingResult = await options.nativePreviewApprover(stagingResult);
            if (stagingResult?.approvalStatus !== "approved") {
              throw new WorkflowError("NATIVE_PREVIEW_NOT_APPROVED", "native-preview", "Native PPT 兜底预览尚未确认，不能交付");
            }
          }
        }
        renderResult = await options.renderer({
          root,
          skinId: input.skinId,
          outputDir: path.join(attemptDir, "render-fallback"),
          deckPlan: presentationOutput.deckPlan,
          pageContents: presentationOutput.pageContents,
          visualPlan: visual.visualPlan,
          compositionPlan: visual.compositionPlan,
          pageIntents: visual.pageIntents,
          layoutDecisions: resolved.layoutDecisions,
          renderPayloads: resolved.renderPayloads,
          stagingResult,
        });
        fallbackEvents.push({
          stage: "render",
          code: "component-overflow-body-fallback",
          trigger: error.code,
          message: "结构组件运行时溢出，程序改用主题正文版式并重新渲染",
          pageIds: overflowPageIds,
        });
      } else {
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
      const resilienceReport = {
        schemaVersion: "1.0",
        status: fallbackEvents.length ? "fallback-used" : "primary-path",
        events: fallbackEvents,
      };
      if (fallbackEvents.length) await writeJson(path.join(outputDir, "resilience-report.json"), resilienceReport);
      const deliveryStatus = productionStatistics?.fallbackPageCount > 0 || fallbackEvents.length
        ? "delivered-with-fallback"
        : "delivered";
      const delivery = {
        schemaVersion: "1.0",
        status: deliveryStatus,
        deliveryStatus,
        workflowMode: "production",
        deckId: presentationOutput.deckPlan.deckId,
        skinId: input.skinId,
        pageCount: presentationOutput.pageContents.length,
        outputPptx: renderResult.outputPptx,
        deterministicQualityAudit: renderResult.qualityAudit,
        assetGapReport,
        productionStatistics,
        resilienceReport,
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
      const resilienceReport = {
        schemaVersion: "1.0",
        status: fallbackEvents.length ? "fallback-used" : "primary-path",
        events: fallbackEvents,
      };
      if (fallbackEvents.length) await writeJson(path.join(outputDir, "resilience-report.json"), resilienceReport);
      const deliveryStatus = productionStatistics?.fallbackPageCount > 0 || fallbackEvents.length
        ? "delivered-with-fallback"
        : "delivered";
      const audit = {
        schemaVersion: "1.0",
        status: "internally-approved-awaiting-user-review",
        workflowMode: "development",
        deliveryStatus,
        deckId: presentationOutput.deckPlan.deckId,
        skinId: input.skinId,
        pageCount: presentationOutput.pageContents.length,
        outputPptx: renderResult.outputPptx,
        contentReviewId: contentReview.reviewId,
        visualReviewId: visualReview.reviewId,
        assetGapReport,
        productionStatistics,
        resilienceReport,
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
