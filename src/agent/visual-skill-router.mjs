import { canonicalTextLayoutId } from "../visual-runtime/text-layout-library.mjs";
import { candidateReadiness, normalizeDerivationPolicy } from "./visual-resolution.mjs";
import {
  COMPOSITION_FAMILIES,
  DENSITY_TARGETS,
  PAGE_ROLES,
  VISUAL_WEIGHTS,
  compositionFamilyFor,
  deriveDensityTarget,
  derivePageRole,
  deriveVisualWeight,
  summarizeRhythmPages,
} from "./deck-rhythm.mjs";

function candidateId(candidate) {
  return [
    candidate.familyId,
    candidate.variantId,
    candidate.silhouette,
    ...(candidate.expressionSource?.sourceItemId ? [candidate.expressionSource.sourceItemId] : []),
  ].join("::");
}

function mediaSourceItemIds(page, candidate) {
  if (candidate.mediaContract?.mode !== "semantic-icon") return [];
  if (candidate.expressionSource?.projectedItemIds?.length) {
    return candidate.expressionSource.projectedItemIds;
  }
  if (candidate.mediaContract.source === "structuredData.inputs") {
    return (page.structuredData?.inputs ?? []).map((item) => item.id);
  }
  return page.items.map((item) => item.id);
}

export function compactVisualSkillContext(pageContents, pageIntents, candidateSets) {
  return pageContents.map((page, index) => ({
    pageId: page.pageId,
    intentId: pageIntents[index].intentId,
    title: page.title,
    relation: pageIntents[index].baseRelation,
    purposeKey: pageIntents[index].purposeKey,
    contentDensity: pageIntents[index].density,
    evidenceTypes: pageIntents[index].evidenceTypes ?? [],
    selectionMode: candidateSets[index].selectionMode ?? "visual-selectable",
    ...(candidateSets[index].lockedStructureGroupId
      ? { lockedStructureGroupId: candidateSets[index].lockedStructureGroupId }
      : {}),
    items: page.items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      pointCount: item.points?.length ?? 0,
      ...(item.points?.length ? { points: item.points.map((point) => String(point?.text ?? point)) } : {}),
    })),
    // Mixed output is disclosed only when the program has found a registered
    // structure whose measured natural footprint fits a legal subregion.
    expressionStrategies: candidateSets[index].candidates.some((candidate) => candidate.expressionSource)
      ? ["registered-structure", "text-plus-structure"]
      : ["registered-structure"],
    blockStructureOptions: page.items.map((item) => ({
      sourceItemId: item.id,
      allowedPatterns: (item.points?.length ?? 0) === 3
        ? ["auto", "chain", "rail", "support-grid"]
        : ["auto", "support-grid"],
    })),
    candidates: candidateSets[index].candidates.map((candidate) => {
      const readiness = candidateReadiness(candidate);
      const derivation = normalizeDerivationPolicy(
        candidate.derivationPolicy ?? candidate.contentContract?.derivationPolicy,
      );
      return {
      candidateId: candidateId(candidate),
      logicId: candidate.logicId,
      structureGroupId: candidate.structureGroupId,
      itemRange: candidate.itemCount,
      readiness,
      reasons: candidate.reasons ?? [],
      selectionMode: candidate.selectionMode ?? candidateSets[index].selectionMode ?? "visual-selectable",
      ...(readiness === "derivable" && derivation.valid ? { derivationPolicy: derivation.policy } : {}),
      mediaMode: candidate.mediaContract?.mode ?? "no-image",
      iconsRequiredPerItem: Boolean(candidate.mediaContract?.requiredPerComponentItem),
      iconSourceItemIds: mediaSourceItemIds(page, candidate),
      fallbackBody: Boolean(candidate.fallbackBody),
      ...(candidate.expressionSource ? {
        expressionSource: candidate.expressionSource,
        expressionStrategy: "text-plus-structure",
        independentTextItemIds: page.items
          .filter((item) => item.id !== candidate.expressionSource.sourceItemId)
          .map((item) => item.id),
      } : {}),
      compositionOptions: (candidate.compositions ?? []).map((composition) => ({
        compositionId: composition.id,
        compositionFamily: compositionFamilyFor({
          composition,
          candidate,
          intent: pageIntents[index],
          page,
        }),
      })),
      textRegions: (candidate.textRegions ?? []).map((region) => ({
        regionKey: region.regionKey,
        contentRoles: region.contentRoles,
        defaultLayoutId: region.defaultLayoutId,
        compatibleLayoutIds: region.compatibleLayoutIds,
        frameRange: region.frameRange,
      })),
      };
    }),
  }));
}

export function visualSkillRoutingSchema(pageContents, candidateSets) {
  const pageSchemas = pageContents.map((page, index) => {
    const set = candidateSets[index];
    const lockedCandidates = set.lockedStructureGroupId
      ? set.candidates.filter((candidate) => candidate.structureGroupId === set.lockedStructureGroupId)
      : set.candidates;
    const candidateIds = [...new Set(lockedCandidates.map((candidate) => candidateId(candidate)))];
    const itemIds = [...new Set(lockedCandidates.flatMap((candidate) => (
      mediaSourceItemIds(page, candidate)
    )))];
    const regionKeys = [...new Set(lockedCandidates.flatMap((candidate) => (
      (candidate.textRegions ?? []).map((region) => region.regionKey)
    )))];
    const textLayoutIds = [...new Set(lockedCandidates.flatMap((candidate) => (
      (candidate.textRegions ?? []).flatMap((region) => region.compatibleLayoutIds ?? [])
    )))];
    const expressionStrategies = set.candidates.some((candidate) => candidate.expressionSource)
      ? ["registered-structure", "text-plus-structure"]
      : ["registered-structure"];
    const compositionIds = [...new Set(lockedCandidates.flatMap((candidate) => (
      (candidate.compositions ?? []).map((composition) => composition.id)
    )))];
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "pageId", "candidateId", "centerLabel", "pageRole", "densityTarget",
        "visualWeight", "compositionId", "compositionFamily",
      ],
      properties: {
        pageId: { const: page.pageId },
        candidateId: candidateIds.length === 1
          ? { const: candidateIds[0] }
          : candidateIds.length > 1
            ? { type: "string", enum: candidateIds }
            : { const: "__no-legal-candidate__" },
        centerLabel: { type: "string", minLength: 2, maxLength: 8 },
        expressionStrategy: {
          enum: expressionStrategies,
        },
        pageRole: { enum: PAGE_ROLES },
        densityTarget: { enum: DENSITY_TARGETS },
        visualWeight: { enum: VISUAL_WEIGHTS },
        compositionId: compositionIds.length
          ? { type: "string", enum: compositionIds }
          : { type: "string", minLength: 1 },
        compositionFamily: { enum: COMPOSITION_FAMILIES },
        continuityGroup: { type: "string", minLength: 1, maxLength: 40 },
        contrastBreakBefore: { type: "boolean" },
        blockStructureModes: {
          type: "array",
          maxItems: page.items.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["sourceItemId", "pattern"],
            properties: {
              sourceItemId: { type: "string", enum: page.items.map((item) => item.id) },
              pattern: { enum: ["auto", "chain", "rail", "support-grid"] },
            },
          },
        },
        iconQueries: {
          type: "array",
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["sourceItemId", "query"],
            properties: {
              sourceItemId: itemIds.length
                ? { type: "string", enum: itemIds }
                : { const: "__no-source-item__" },
              query: { type: "string", minLength: 1, maxLength: 40 },
            },
          },
        },
        textLayoutChoices: {
          type: "array",
          maxItems: 16,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["regionKey", "layoutId"],
            properties: {
              regionKey: regionKeys.length
                ? { type: "string", enum: regionKeys }
                : { type: "string", minLength: 1 },
              layoutId: textLayoutIds.length
                ? { type: "string", enum: textLayoutIds }
                : { type: "string", minLength: 1 },
            },
          },
        },
        reason: { type: "string", minLength: 1, maxLength: 120 },
      },
    };
  });
  return {
    name: "ppagent_visual_skill_routing",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["selections"],
      properties: {
        selections: {
          type: "array",
          minItems: pageContents.length,
          maxItems: pageContents.length,
          items: { anyOf: pageSchemas },
        },
      },
    },
  };
}

function legalTextLayoutChoices(selection, candidate) {
  const regions = new Map((candidate.textRegions ?? []).map((region) => [region.regionKey, region]));
  const seen = new Set();
  const choices = [];
  for (const choice of selection.textLayoutChoices ?? []) {
    const region = regions.get(choice.regionKey);
    if (!region || seen.has(choice.regionKey)) continue;
    const layoutId = canonicalTextLayoutId(choice.layoutId);
    if (!(region.compatibleLayoutIds ?? []).map(canonicalTextLayoutId).includes(layoutId)) continue;
    seen.add(choice.regionKey);
    choices.push({ regionKey: choice.regionKey, layoutId });
  }
  return choices;
}

function chooseComposition(candidate, page, requestedCompositionId) {
  const compositions = candidate.compositions ?? [];
  const requested = compositions.find((item) => item.id === requestedCompositionId);
  if (requested) return requested;
  if (candidate.expressionSource) {
    const mixed = compositions.find((item) => (
      item.requiresComponent && item.slots.some((slot) => slot.role === "text")
    ));
    if (mixed) return mixed;
  }
  const component = compositions.find((item) => item.requiresComponent);
  if (component) return component;
  const preferredId = page.items.length <= 1
    ? "editorial-single-focus"
    : page.items.length === 2
      ? "editorial-dual-statement"
      : "editorial-list";
  return compositions.find((item) => item.id === preferredId) ?? compositions[0];
}

function distributeTextSlots(page, composition) {
  const slots = (composition.slots ?? []).filter((slot) => slot.role === "text");
  if (!slots.length || !page.items.length) return [];
  if (slots.length === 1) {
    return [{ slotId: slots[0].id, sourceItemIds: page.items.map((item) => item.id), contentMode: "full" }];
  }
  // Editorial multi-slot layouts use the early regions as lead/support slots.
  // Keep one source item in each of them and let the final body region carry
  // the remaining items; an even split can illegally place two items in lead.
  const groups = slots.map((_, index) => (
    index < slots.length - 1
      ? [page.items[index]?.id].filter(Boolean)
      : page.items.slice(index).map((item) => item.id)
  ));
  return slots.flatMap((slot, index) => (
    groups[index].length
      ? [{ slotId: slot.id, sourceItemIds: groups[index], contentMode: "full" }]
      : []
  ));
}

function buildComponentBindings(candidate, page) {
  const contracts = candidate.contentContract?.bindings ?? [];
  const bindings = [];
  for (const contract of contracts.filter((item) => item.scope === "per-component-item")) {
    for (const item of page.items) {
      const points = (item.points ?? []).map((point) => String(point?.text ?? point).trim()).filter(Boolean);
      if (points.length < contract.minItems) continue;
      bindings.push({
        bindingId: contract.id,
        sourceItemId: item.id,
        entries: points.slice(0, contract.maxItems).map((point) => ({ text: point, sourceFragment: point })),
      });
    }
  }
  return bindings.length ? bindings : undefined;
}

function routingError(message, details = {}) {
  const error = new Error(message);
  error.code = "MODEL_JSON_INVALID";
  error.details = details;
  return error;
}

function automaticExpressionStrategy(_selection, candidate) {
  // Mixed output is only enabled for a bounded block candidate that binds a
  // real catalog asset and has passed natural-size spatial filtering.
  return candidate.expressionSource ? "text-plus-structure" : "registered-structure";
}

export function expandVisualSkillRouting(routing, input) {
  const byPage = new Map();
  for (const selection of routing?.selections ?? []) {
    if (byPage.has(selection.pageId)) throw routingError("视觉路由重复返回页面", { pageId: selection.pageId });
    byPage.set(selection.pageId, selection);
  }
  const visualPages = [];
  const compositionPages = [];
  const semanticRefinementRequests = [];
  const routingDiagnostics = [];
  const structureUsage = new Map();

  input.pageContents.forEach((page, index) => {
    const intent = input.pageIntents[index];
    const selection = byPage.get(page.pageId);
    if (!selection) throw routingError("视觉路由遗漏页面", { pageId: page.pageId });
    const candidateSet = input.candidateSets[index];
    const requestedCandidate = candidateSet.candidates.find((item) => (
      candidateId(item) === selection.candidateId
    ));
    const lockedStructureGroupId = candidateSet.lockedStructureGroupId;
    const lockedCandidates = lockedStructureGroupId
      ? candidateSet.candidates.filter((item) => item.structureGroupId === lockedStructureGroupId)
      : [];
    const fallbackLockedCandidates = candidateSet.selectionMode === "fallback-locked"
      ? candidateSet.candidates.filter((item) => candidateReadiness(item, {
        assetGap: true,
      }) === "fallback")
      : [];
    if (lockedStructureGroupId && !lockedCandidates.length) {
      throw routingError("程序锁定的 Structure Group 没有可用候选", {
        pageId: page.pageId,
        lockedStructureGroupId,
      });
    }
    const candidate = fallbackLockedCandidates.length
      ? (requestedCandidate && fallbackLockedCandidates.includes(requestedCandidate)
        ? requestedCandidate
        : fallbackLockedCandidates[0])
      : lockedStructureGroupId
      ? (requestedCandidate?.structureGroupId === lockedStructureGroupId
        ? requestedCandidate
        : lockedCandidates[0])
      : requestedCandidate;
    if (!candidate) throw routingError("视觉路由选择了该页不存在的 Structure Group", {
      pageId: page.pageId, candidateId: selection.candidateId,
    });
    if ((lockedStructureGroupId || fallbackLockedCandidates.length) && candidateId(candidate) !== selection.candidateId) {
      routingDiagnostics.push({
        pageId: page.pageId,
        ...(lockedStructureGroupId ? { lockedStructureGroupId } : { selectionMode: "fallback-locked" }),
        ignoredRequestedCandidateId: selection.candidateId,
        appliedCandidateId: candidateId(candidate),
      });
    }
    const validItemIds = new Set(mediaSourceItemIds(page, candidate));
    const previousUses = structureUsage.get(candidate.assetId) ?? 0;
    const hasAlternativeStructure = new Set(candidateSet.candidates.map((item) => item.structureGroupId)).size > 1;
    if (!candidate.fallbackBody) {
      structureUsage.set(candidate.assetId, (structureUsage.get(candidate.assetId) ?? 0) + 1);
    }
    const requestedCompositionIsLegal = (candidate.compositions ?? [])
      .some((item) => item.id === selection.compositionId);
    const composition = chooseComposition(candidate, page, selection.compositionId);
    if (!composition) throw routingError("Structure Group 没有可用 Composition", { pageId: page.pageId });
    if (selection.compositionId && !requestedCompositionIsLegal) {
      routingDiagnostics.push({
        pageId: page.pageId,
        code: "composition-normalized-to-selected-candidate",
        requestedCompositionId: selection.compositionId,
        appliedCompositionId: composition.id,
      });
    }
    const deckPage = input.deckPlan?.pages?.find((item) => item.pageId === page.pageId);
    const pageRole = PAGE_ROLES.includes(selection.pageRole)
      ? selection.pageRole
      : derivePageRole({
        page,
        deckPage,
        intent,
        index,
        pageCount: input.pageContents.length,
      });
    const densityTarget = DENSITY_TARGETS.includes(selection.densityTarget)
      ? selection.densityTarget
      : deriveDensityTarget(intent);
    const visualWeight = VISUAL_WEIGHTS.includes(selection.visualWeight)
      ? selection.visualWeight
      : deriveVisualWeight(pageRole, densityTarget);
    const compositionFamily = compositionFamilyFor({ composition, candidate, intent, page });
    if (selection.compositionFamily && selection.compositionFamily !== compositionFamily) {
      routingDiagnostics.push({
        pageId: page.pageId,
        code: "composition-family-normalized",
        requestedCompositionFamily: selection.compositionFamily,
        appliedCompositionFamily: compositionFamily,
      });
    }
    const iconQueries = (selection.iconQueries ?? []).filter((item) => validItemIds.has(item.sourceItemId));
    const expressionStrategy = automaticExpressionStrategy(selection, candidate);
    if (selection.expressionStrategy && selection.expressionStrategy !== expressionStrategy) {
      routingDiagnostics.push({
        pageId: page.pageId,
        code: "automatic-unapproved-expression-demoted",
        requestedExpressionStrategy: selection.expressionStrategy,
        appliedExpressionStrategy: expressionStrategy,
      });
    }
    visualPages.push({
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
      adaptationStatus: candidate.adaptationStatus,
      pageRole,
      densityTarget,
      visualWeight,
      compositionFamily,
      ...(selection.continuityGroup ? { continuityGroup: selection.continuityGroup } : {}),
      ...(selection.contrastBreakBefore ? { contrastBreakBefore: true } : {}),
      expressionStrategy,
      ...(candidate.expressionSource?.sourceItemId
        ? { structureSourceItemId: candidate.expressionSource.sourceItemId }
        : {}),
      ...(selection.blockStructureModes?.length ? {
        blockStructureModes: selection.blockStructureModes.filter((choice) => (
          page.items.some((item) => item.id === choice.sourceItemId)
        )),
      } : {}),
      ...(candidate.mediaContract?.mode === "semantic-icon" ? { iconQueries } : {}),
      reason: [
        selection.reason ?? (lockedStructureGroupId
          ? "程序锁定唯一合法 Structure Group，视觉导演完成展示适配"
          : "视觉导演选择该页语义与容量均适配的 Structure Group"),
        previousUses > 0 && hasAlternativeStructure
          ? `该 Structure Group 此前已使用 ${previousUses} 次，保留视觉导演选择并记录重复`
          : "",
        selection.expressionStrategy && selection.expressionStrategy !== expressionStrategy
          ? "2+3组合原型尚未通过视觉验收，自动生产回到已登记资产"
          : "",
      ].filter(Boolean).join("；"),
    });
    const requiresComponent = Boolean(composition.requiresComponent);
    const componentPage = candidate.expressionSource
      ? {
        ...page,
        items: (page.items.find((item) => item.id === candidate.expressionSource.sourceItemId)?.points ?? [])
          .map((point, pointIndex) => ({
            id: candidate.expressionSource.projectedItemIds[pointIndex],
            title: String(point?.text ?? point ?? "").trim(),
            body: "",
            points: [],
          })),
      }
      : page;
    const bindings = requiresComponent ? buildComponentBindings(candidate, componentPage) : undefined;
    const supportsCenterLabel = (candidate.slotCapabilities?.textSlots ?? [])
      .some((slot) => slot.role === "center-title");
    const textLayoutChoices = requiresComponent ? legalTextLayoutChoices(selection, candidate) : [];
    compositionPages.push({
      pageId: page.pageId,
      intentId: intent.intentId,
      compositionId: composition.id,
      componentItemIds: requiresComponent
        ? (candidate.expressionSource ? [candidate.expressionSource.sourceItemId] : page.items.map((item) => item.id))
        : [],
      componentContentMode: requiresComponent ? "full" : "none",
      textSlots: requiresComponent
        ? (candidate.expressionSource
          ? distributeTextSlots({
            ...page,
            items: page.items.filter((item) => item.id !== candidate.expressionSource.sourceItemId),
          }, composition)
          : [])
        : distributeTextSlots(page, composition),
      textLayoutChoices,
      ...(candidate.expressionSource ? { componentProjection: candidate.expressionSource } : {}),
      ...(bindings ? { componentBindings: bindings } : {}),
      ...(supportsCenterLabel ? {
        componentText: [{
          sourceField: "page-title",
          targetRole: "center-title",
          text: selection.centerLabel,
          sourceFragment: page.title,
        }],
      } : {}),
      reason: candidateReadiness(candidate) === "fallback"
        ? "当前 Logic 无适配结构或结构运行时溢出，使用主题正文 Composition 兜底"
        : candidate.expressionSource
          ? "来源内容块的明确分点进入登记 Structure Group，其余来源内容保留为独立文字"
        : requiresComponent
          ? "Structure Group 承担完整页面内容，字段由正式 Slot Contract 确定性绑定"
          : "正文页面使用主题 Composition 承载内容",
    });
  });

  const rhythmPlan = summarizeRhythmPages(visualPages);
  return {
    visualPlan: {
      schemaVersion: "1.0",
      deckId: input.deckPlan.deckId,
      skinId: input.skinId,
      visualLanguage: "遵循所选主题与已确认 Structure Group 的统一设计语言",
      rhythmStrategy: "先按页面职责分配疏密与视觉重心，再在合法候选中改变构图家族；连续复用必须显式归入 continuityGroup",
      rhythmPlan,
      pages: visualPages,
    },
    compositionPlan: {
      schemaVersion: "1.0",
      deckId: input.deckPlan.deckId,
      skinId: input.skinId,
      pages: compositionPages,
    },
    semanticRefinementRequests,
    routingDiagnostics,
  };
}
