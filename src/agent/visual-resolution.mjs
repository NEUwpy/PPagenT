import { mapRenderPayload } from "../render/render-payload.mjs";
import { loadContractCatalog, matchPageIntent } from "../selection/contracts.mjs";
import {
  assetKind,
  assertSpatialFit,
  compositionCandidatesForAsset,
  loadCompositionLayouts,
  loadCoreAssetMetadata,
} from "../composition/layouts.mjs";
import {
  listRenderableVisualVariants,
  loadCoreAssetIds,
  planVisualVariants,
  queryVisualVariants,
} from "../selection/visual-variants.mjs";
import { northeasternUniversitySkin } from "../runtime/skins/northeastern-university.mjs";
import { validatePageCompositionTextFit } from "../render/page-composition.mjs";

function publicComposition(layout) {
  return {
    id: layout.id,
    silhouette: layout.silhouette,
    requiresComponent: Boolean(layout.requiresComponent),
    requiresMedia: Boolean(layout.requiresMedia),
    slots: layout.slots.map((slot) => ({ id: slot.id, role: slot.role })),
  };
}

function publicVariant(variant, contract, compositions) {
  return {
    logicId: variant.logicId,
    structureGroupId: variant.structureGroupId,
    familyId: variant.familyId,
    assetId: variant.assetId,
    variantId: variant.variantId,
    silhouette: variant.silhouette,
    adaptationStatus: contract.adaptationStatus,
    itemCount: variant.itemCount,
    textCapacity: variant.textCapacity ?? null,
    contentContract: variant.contentContract ?? null,
    mediaContract: variant.mediaContract ?? null,
    slotContract: variant.slotContract ?? null,
    renderer: variant.renderer,
    fallbackBody: variant.fallbackBody,
    compositionIds: compositions.map((layout) => layout.id),
    compositions: compositions.map(publicComposition),
  };
}

export function computeCapacityDensity(stats) {
  const estimatedTotal = stats.avgItemChars * stats.itemCount;
  if (stats.itemCount <= 4 && estimatedTotal <= 70 && stats.maxItemChars <= 32) return "low";
  if (stats.itemCount <= 13 && estimatedTotal <= 180 && stats.maxItemChars <= 72) return "medium";
  return "high";
}

export async function buildVisualCandidateSets({ root = process.cwd(), pageContents, pageIntents }) {
  const [contracts, variants, coreAssetIds, layouts, metadataById] = await Promise.all([
    loadContractCatalog(root),
    listRenderableVisualVariants({ root }),
    loadCoreAssetIds(root),
    loadCompositionLayouts(root),
    loadCoreAssetMetadata(root),
  ]);
  const variantsByAsset = new Map();
  for (const variant of variants) {
    const bucket = variantsByAsset.get(variant.assetId) ?? [];
    bucket.push(variant);
    variantsByAsset.set(variant.assetId, bucket);
  }
  const renderableContracts = contracts.filter((contract) => variantsByAsset.has(contract.assetId));

  return pageIntents.map((intent, index) => {
    const pageId = pageContents[index].pageId;
    const contractsById = new Map(renderableContracts.map((contract) => [contract.assetId, contract]));
    const skinVariant = variants.find((variant) => (
      variant.renderer === "skin"
      && !variant.fallbackBody
      && variant.supportedPurposeKeys?.includes(intent.purposeKey)
    ));
    const compatibleSkinVariant = skinVariant && queryVisualVariants([skinVariant], {
      itemCount: intent.structure.itemCount,
      baseRelation: intent.baseRelation,
      purposeKey: intent.purposeKey,
    })[0];
    if (compatibleSkinVariant) {
      return {
        pageId,
        intentId: intent.intentId,
        candidates: coreAssetIds.has(compatibleSkinVariant.assetId)
          ? [publicVariant(
            compatibleSkinVariant,
            contractsById.get(compatibleSkinVariant.assetId),
            compatibleSkinVariant.compositionIds.map((id) => layouts.get(id)).filter(Boolean),
          )]
          : [],
      };
    }

    const capacityDensity = computeCapacityDensity(intent.contentStats);
    const requiredItemRole = /PPagenT节点接口=semantic-node\+points/.test(pageContents[index].notes ?? "")
      ? "semantic-node"
      : undefined;
    const semantic = matchPageIntent({ ...intent, density: capacityDensity }, renderableContracts, {
      includeComposite: true,
      includeDeferred: false,
      enableFallback: false,
    });
    const structuralCandidates = semantic.candidates.flatMap((candidate) => {
      const compatible = queryVisualVariants(variantsByAsset.get(candidate.assetId) ?? [], {
        itemCount: intent.structure.itemCount,
        baseRelation: intent.baseRelation,
        purposeKey: intent.purposeKey,
        requiredItemRole,
        maxItemTitleChars: intent.contentStats.maxItemTitleChars,
        maxItemBodyChars: intent.contentStats.maxItemBodyChars,
        maxPointsPerItem: intent.structure.dimensions?.maxPointsPerItem ?? 0,
        maxPointChars: intent.structure.dimensions?.maxPointChars ?? 0,
      });
      const metadata = metadataById.get(candidate.assetId);
      const compositions = compositionCandidatesForAsset(layouts, candidate.assetId, metadata);
      return compatible.map((variant) => publicVariant(
        variant,
        contractsById.get(candidate.assetId),
        compositions,
      ));
    });
    const bodyVariant = variants.find((variant) => variant.renderer === "skin" && variant.fallbackBody);
    if (!bodyVariant) throw new Error("核心资产包缺少正文兜底页");
    const bodyMetadata = metadataById.get(bodyVariant.assetId);
    const bodyCandidate = publicVariant(
      bodyVariant,
      contractsById.get(bodyVariant.assetId),
      compositionCandidatesForAsset(layouts, bodyVariant.assetId, bodyMetadata),
    );
    return {
      pageId,
      intentId: intent.intentId,
      candidates: [...structuralCandidates, bodyCandidate],
      capacityDensity,
      semanticRejections: semantic.rejections,
    };
  });
}

function selectedCandidate(planPage, candidateSet) {
  return candidateSet.candidates.find((candidate) => (
    candidate.familyId === planPage.familyId
    && candidate.variantId === planPage.variantId
    && candidate.silhouette === planPage.silhouette
  ));
}

function validateIconQueries(planPage, candidate, compositionPage) {
  const queries = planPage.iconQueries ?? [];
  const contract = candidate.mediaContract;
  if (contract?.mode !== "semantic-icon") {
    return queries.length ? [{ code: "icon-queries-not-supported" }] : [];
  }
  const selectedIds = new Set(compositionPage.componentItemIds ?? []);
  const seen = new Set();
  const issues = [];
  for (const item of queries) {
    if (!selectedIds.has(item.sourceItemId)) {
      issues.push({ code: "icon-query-source-item-invalid", sourceItemId: item.sourceItemId });
    }
    if (seen.has(item.sourceItemId)) {
      issues.push({ code: "icon-query-duplicated", sourceItemId: item.sourceItemId });
    }
    seen.add(item.sourceItemId);
  }
  const missing = [...selectedIds].filter((id) => !seen.has(id));
  if (missing.length) issues.push({ code: "icon-query-required", sourceItemIds: missing });
  return issues;
}

export function timelineLacksTemporalEvidence(content, candidate, candidateSet) {
  if (candidate?.assetId !== "timeline-roadmap-001") return false;
  const hasSequentialAlternative = candidateSet.candidates.some((item) => item.assetId === "sequential-process-001");
  if (!hasSequentialAlternative) return false;
  const source = String(content?.sourceText ?? "");
  return !/(?:\d{4}\s*年|第[一二三四五六七八九十\d]+阶段|时间轴|里程碑|路线图|历史|演进|年度|季度|月份|未来\s*\d+)/.test(source);
}

function idsForPage(content) {
  return new Set(content.items.map((item) => item.id));
}

export function duplicatedCompositionItemIds(compositionPage) {
  const componentIds = new Set(compositionPage.componentItemIds ?? []);
  return [...new Set(
    (compositionPage.textSlots ?? [])
      .flatMap((slot) => slot.sourceItemIds ?? [])
      .filter((itemId) => componentIds.has(itemId)),
  )];
}

function normalizedGroundingText(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

export function validateComponentBindings(content, candidate, compositionPage) {
  const contracts = candidate.contentContract?.bindings ?? [];
  const supplied = compositionPage.componentBindings ?? [];
  const issues = [];
  if (!contracts.length) {
    if (supplied.length) issues.push({ code: "component-bindings-not-supported" });
    return issues;
  }

  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const selectedIds = new Set(compositionPage.componentItemIds ?? []);
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const seen = new Set();
  for (const binding of supplied) {
    const contract = contractById.get(binding.bindingId);
    if (!contract) {
      issues.push({ code: "component-binding-id-unknown", bindingId: binding.bindingId });
      continue;
    }
    if (!selectedIds.has(binding.sourceItemId) || !itemById.has(binding.sourceItemId)) {
      issues.push({ code: "component-binding-source-item-invalid", sourceItemId: binding.sourceItemId });
      continue;
    }
    const key = `${binding.bindingId}:${binding.sourceItemId}`;
    if (seen.has(key)) issues.push({ code: "component-binding-duplicated", bindingId: binding.bindingId, sourceItemId: binding.sourceItemId });
    seen.add(key);
    if (binding.entries.length < contract.minItems || binding.entries.length > contract.maxItems) {
      issues.push({
        code: "component-binding-item-count-invalid",
        bindingId: binding.bindingId,
        sourceItemId: binding.sourceItemId,
        actual: binding.entries.length,
        min: contract.minItems,
        max: contract.maxItems,
      });
    }
    const item = itemById.get(binding.sourceItemId);
    const source = normalizedGroundingText([
      content.title,
      content.sourceText,
      item.title,
      item.body,
      ...(item.points ?? []),
    ].filter(Boolean).join("\n"));
    binding.entries.forEach((entry, index) => {
      if (Array.from(entry.text).length > contract.maxChars) {
        issues.push({ code: "component-binding-text-too-long", bindingId: binding.bindingId, sourceItemId: binding.sourceItemId, index, maxChars: contract.maxChars });
      }
      const fragment = normalizedGroundingText(entry.sourceFragment);
      if (!fragment || !source.includes(fragment)) {
        issues.push({ code: "component-binding-source-fragment-missing", bindingId: binding.bindingId, sourceItemId: binding.sourceItemId, index });
      }
    });
  }

  for (const contract of contracts.filter((item) => item.scope === "per-component-item")) {
    for (const sourceItemId of selectedIds) {
      if (!seen.has(`${contract.id}:${sourceItemId}`)) {
        issues.push({ code: "component-binding-required", bindingId: contract.id, sourceItemId });
      }
    }
    if (contract.balancedAcrossItems) {
      const counts = supplied
        .filter((binding) => binding.bindingId === contract.id && selectedIds.has(binding.sourceItemId))
        .map((binding) => binding.entries.length);
      if (counts.length === selectedIds.size && new Set(counts).size > 1) {
        issues.push({ code: "component-binding-count-unbalanced", bindingId: contract.id, counts });
      }
    }
  }
  return issues;
}

function filterComponentContent(content, compositionPage) {
  const selected = new Set(compositionPage.componentItemIds);
  const expandedInText = new Set(compositionPage.textSlots.flatMap((slot) => slot.sourceItemIds));
  return {
    ...content,
    items: content.items
      .filter((item) => selected.has(item.id))
      .map((item) => compositionPage.componentContentMode === "titles-only"
        ? { ...item, body: "", points: [], ...(expandedInText.has(item.id) ? { emphasis: false } : {}) }
        : item),
  };
}

function textSlotItemLimit(layout, slotId) {
  if (layout.id === "editorial-list") return slotId === "lead" ? 1 : Infinity;
  if (["editorial-focus", "editorial-focus-reverse"].includes(layout.id)) return slotId === "primary" ? 1 : Infinity;
  if (layout.id === "editorial-single-focus") return Infinity;
  if (layout.id === "editorial-dual-statement") return 1;
  if (slotId === "aside") return 1;
  return Infinity;
}

function legalTextCompositionAlternatives(content, candidate, layouts) {
  if (!candidate.fallbackBody) return [];
  const itemIds = content.items.map((item) => item.id);
  const alternatives = [];
  for (const compositionId of candidate.compositionIds ?? []) {
    const layout = layouts.get(compositionId);
    if (!layout || layout.requiresComponent || layout.requiresMedia) continue;
    const textSlots = layout.slots.filter((slot) => slot.role === "text");
    const plans = [];
    if (compositionId === "editorial-single-focus" && textSlots.length === 1) {
      plans.push([{ slotId: textSlots[0].id, sourceItemIds: itemIds, contentMode: "full" }]);
    } else if (compositionId === "editorial-dual-statement" && itemIds.length === 2) {
      plans.push(
        [
          { slotId: "left", sourceItemIds: [itemIds[0]], contentMode: "full" },
          { slotId: "right", sourceItemIds: [itemIds[1]], contentMode: "full" },
        ],
        [
          { slotId: "left", sourceItemIds: [itemIds[1]], contentMode: "full" },
          { slotId: "right", sourceItemIds: [itemIds[0]], contentMode: "full" },
        ],
      );
    } else if (textSlots.length === 2 && itemIds.length >= 2) {
      const lead = textSlots.find((slot) => textSlotItemLimit(layout, slot.id) === 1);
      const rest = textSlots.find((slot) => slot.id !== lead?.id);
      if (lead && rest) {
        for (const leadId of itemIds) {
          plans.push([
            { slotId: lead.id, sourceItemIds: [leadId], contentMode: "full" },
            { slotId: rest.id, sourceItemIds: itemIds.filter((id) => id !== leadId), contentMode: "full" },
          ]);
        }
      }
    }
    for (const textPlan of plans) {
      const page = {
        pageId: content.pageId,
        compositionId,
        componentItemIds: [],
        componentContentMode: "none",
        textSlots: textPlan,
      };
      if (!validatePageCompositionTextFit(
        content,
        layout,
        page,
        northeasternUniversitySkin.bodyFrame,
        northeasternUniversitySkin.typographyRoles,
      ).length) {
        alternatives.push({
          compositionId,
          componentItemIds: [],
          componentContentMode: "none",
          textSlots: textPlan,
        });
      }
    }
  }
  return alternatives.slice(0, 6);
}

export function normalizeBoundComponentCompositionPage(compositionPage, candidate, layout) {
  const hasBindings = Boolean(candidate.contentContract?.bindings?.length);
  const hasTextSlots = Boolean(layout?.slots?.some((slot) => slot.role === "text"));
  if (!hasBindings || !layout?.requiresComponent || hasTextSlots
    || !(compositionPage.componentItemIds?.length)) {
    return compositionPage;
  }
  if (compositionPage.componentContentMode === "full" && !(compositionPage.textSlots?.length)) {
    return compositionPage;
  }
  return {
    ...compositionPage,
    componentContentMode: "full",
    textSlots: [],
  };
}

function validateCompositionPage({ content, candidate, compositionPage, layouts, metadataById }) {
  const issues = [];
  const layout = layouts.get(compositionPage.compositionId);
  if (!layout) return [{ code: "unknown-composition", compositionId: compositionPage.compositionId }];
  if (!candidate.compositionIds?.includes(layout.id)) {
    issues.push({
      code: "composition-not-legal-for-selected-asset",
      compositionId: layout.id,
      legalCompositionIds: candidate.compositionIds ?? [],
    });
  }
  const metadata = metadataById.get(candidate.assetId);
  if (!metadata) issues.push({ code: "asset-metadata-missing", assetId: candidate.assetId });
  if (metadata && !layout.allowedAssetKinds.includes(assetKind(candidate.assetId, metadata))) {
    issues.push({ code: "composition-asset-kind-mismatch", compositionId: layout.id, assetId: candidate.assetId });
  }
  try {
    if (metadata) assertSpatialFit(metadata, layout, northeasternUniversitySkin.bodyFrame);
  } catch (error) {
    issues.push({ code: "spatial-contract-failed", message: error.message });
  }

  const sourceIds = idsForPage(content);
  const referencedIds = [
    ...compositionPage.componentItemIds,
    ...compositionPage.textSlots.flatMap((slot) => slot.sourceItemIds),
  ];
  const expandedInText = new Set(compositionPage.textSlots.flatMap((slot) => slot.sourceItemIds));
  const unknownIds = [...new Set(referencedIds.filter((id) => !sourceIds.has(id)))];
  if (unknownIds.length) issues.push({ code: "composition-source-item-missing", sourceItemIds: unknownIds });
  const omittedIds = [...sourceIds].filter((id) => !referencedIds.includes(id));
  const fixedPage = ["cover", "agenda", "closing"].includes(assetKind(candidate.assetId, metadata));
  if (!fixedPage && omittedIds.length) issues.push({ code: "composition-content-unplaced", sourceItemIds: omittedIds });
  const duplicatedIds = duplicatedCompositionItemIds(compositionPage);
  if (!fixedPage && duplicatedIds.length) {
    issues.push({ code: "composition-content-duplicated", sourceItemIds: duplicatedIds });
  }
  if (!fixedPage) {
    issues.push(...validateComponentBindings(content, candidate, compositionPage));
    const coveredFields = new Map(content.items.map((item) => [item.id, new Set()]));
    for (const itemId of compositionPage.componentItemIds) {
      const fields = coveredFields.get(itemId);
      if (!fields) continue;
      if (compositionPage.componentContentMode === "full") {
        fields.add("title");
        fields.add("body");
        fields.add("points");
      } else if (compositionPage.componentContentMode === "titles-only") {
        fields.add("title");
      }
    }
    for (const slot of compositionPage.textSlots) {
      for (const itemId of slot.sourceItemIds) {
        const fields = coveredFields.get(itemId);
        if (!fields) continue;
        if (slot.contentMode === "full") {
          fields.add("title");
          fields.add("body");
          fields.add("points");
        } else {
          fields.add(slot.contentMode);
          if (slot.contentMode === "body") fields.add("points");
        }
      }
    }
    const fieldOmissions = content.items.flatMap((item) => {
      const fields = coveredFields.get(item.id);
      return [
        ...(item.title?.trim() && !fields.has("title") ? [{ itemId: item.id, field: "title" }] : []),
        ...(item.body?.trim() && !fields.has("body") ? [{ itemId: item.id, field: "body" }] : []),
        ...(item.points?.length && !fields.has("points") ? [{ itemId: item.id, field: "points" }] : []),
      ];
    });
    if (fieldOmissions.length) issues.push({ code: "composition-item-field-unplaced", omissions: fieldOmissions });
  }

  const legalTextSlots = new Set(layout.slots.filter((slot) => slot.role === "text").map((slot) => slot.id));
  const plannedTextSlotIds = compositionPage.textSlots.map((slot) => slot.slotId);
  const illegalTextSlots = compositionPage.textSlots
    .map((slot) => slot.slotId)
    .filter((slotId) => !legalTextSlots.has(slotId));
  if (illegalTextSlots.length) issues.push({ code: "composition-text-slot-missing", slotIds: illegalTextSlots });
  const duplicateTextSlots = plannedTextSlotIds.filter((slotId, index) => plannedTextSlotIds.indexOf(slotId) !== index);
  if (duplicateTextSlots.length) issues.push({ code: "composition-text-slot-duplicated", slotIds: [...new Set(duplicateTextSlots)] });
  const missingTextSlots = [...legalTextSlots].filter((slotId) => !plannedTextSlotIds.includes(slotId));
  if (missingTextSlots.length) issues.push({ code: "composition-required-text-slot-unfilled", slotIds: missingTextSlots });
  const overloadedTextSlots = compositionPage.textSlots
    .map((slot) => ({
      slotId: slot.slotId,
      actual: slot.sourceItemIds.length,
      max: textSlotItemLimit(layout, slot.slotId),
    }))
    .filter((slot) => Number.isFinite(slot.max) && slot.actual > slot.max);
  if (overloadedTextSlots.length) issues.push({ code: "composition-text-slot-item-count-exceeded", slots: overloadedTextSlots });
  if (!fixedPage && !illegalTextSlots.length && !duplicateTextSlots.length && !missingTextSlots.length) {
    issues.push(...validatePageCompositionTextFit(
      content,
      layout,
      compositionPage,
      northeasternUniversitySkin.bodyFrame,
      northeasternUniversitySkin.typographyRoles,
    ));
  }

  if (layout.requiresComponent) {
    if (!compositionPage.componentItemIds.length || compositionPage.componentContentMode === "none") {
      issues.push({ code: "component-composition-without-content" });
    }
    if (compositionPage.componentContentMode === "titles-only") {
      const omittedBodies = content.items
        .filter((item) => compositionPage.componentItemIds.includes(item.id))
        .filter((item) => (item.body?.trim() || item.points?.length) && !expandedInText.has(item.id))
        .map((item) => item.id);
      if (omittedBodies.length) {
        issues.push({ code: "component-body-content-unplaced", itemIds: omittedBodies });
      }
    }
    if (compositionPage.componentContentMode === "full" && candidate.textCapacity) {
      const selectedItems = content.items.filter((item) => compositionPage.componentItemIds.includes(item.id));
      const titleOverflow = selectedItems
        .filter((item) => Array.from(item.title ?? "").length > candidate.textCapacity.maxItemTitleChars)
        .map((item) => item.id);
      const bodyOverflow = selectedItems
        .filter((item) => Array.from(item.body ?? "").length > candidate.textCapacity.maxItemBodyChars)
        .map((item) => item.id);
      const pointCountOverflow = selectedItems
        .filter((item) => candidate.textCapacity.maxPointsPerItem !== undefined
          && (item.points?.length ?? 0) > candidate.textCapacity.maxPointsPerItem)
        .map((item) => item.id);
      const pointTextOverflow = selectedItems
        .filter((item) => candidate.textCapacity.maxPointChars !== undefined
          && (item.points ?? []).some((point) => Array.from(point).length > candidate.textCapacity.maxPointChars))
        .map((item) => item.id);
      if (titleOverflow.length || bodyOverflow.length || pointCountOverflow.length || pointTextOverflow.length) {
        issues.push({
          code: "component-text-capacity-exceeded",
          titleItemIds: titleOverflow,
          bodyItemIds: bodyOverflow,
          pointCountItemIds: pointCountOverflow,
          pointTextItemIds: pointTextOverflow,
          textCapacity: candidate.textCapacity,
        });
      }
    }
  } else if (compositionPage.componentItemIds.length || compositionPage.componentContentMode !== "none") {
    issues.push({ code: "non-component-composition-has-component-content" });
  }
  if (layout.requiresMedia) issues.push({ code: "media-composition-not-supported-by-page-content-v1" });
  return issues;
}

export async function resolveVisualPlan({
  root = process.cwd(),
  pageContents,
  pageIntents,
  visualPlan,
  compositionPlan,
  candidateSets,
}) {
  if (!Array.isArray(candidateSets) || candidateSets.length !== pageIntents.length) {
    return { status: "needs-director-revision", feedback: [{ code: "candidate-set-mismatch" }] };
  }
  if (!compositionPlan || !Array.isArray(compositionPlan.pages)
    || compositionPlan.pages.length !== pageIntents.length) {
    return { status: "needs-director-revision", feedback: [{ code: "composition-plan-mismatch" }] };
  }

  const [layouts, metadataById] = await Promise.all([
    loadCompositionLayouts(root),
    loadCoreAssetMetadata(root),
  ]);
  const normalizedVisualPlan = {
    ...visualPlan,
    pages: visualPlan.pages.map((page, index) => {
      const matches = (candidateSets[index]?.candidates ?? []).filter((candidate) => (
        candidate.familyId === page.familyId && candidate.variantId === page.variantId
      ));
      return matches.length === 1 && page.silhouette !== matches[0].silhouette
        ? { ...page, silhouette: matches[0].silhouette }
        : page;
    }),
  };
  const normalizedCompositionPlan = {
    ...compositionPlan,
    pages: compositionPlan.pages.map((page) => {
      const layout = layouts.get(page.compositionId);
      if (!layout || layout.requiresComponent) return page;
      return { ...page, componentItemIds: [], componentContentMode: "none" };
    }),
  };
  const structuralRequests = [];
  const selections = [];
  const feedback = [];
  const warnings = [];
  normalizedVisualPlan.pages.forEach((planPage, index) => {
    const candidateSet = candidateSets[index];
    const candidate = selectedCandidate(planPage, candidateSet);
    if (!candidate) {
      feedback.push({
        pageId: planPage.pageId,
        code: "choice-not-in-semantic-candidates",
        candidateVariantIds: candidateSet.candidates.map((item) => `${item.familyId}:${item.variantId}`),
      });
      selections.push(null);
      return;
    }
    const normalizedCompositionPage = normalizeBoundComponentCompositionPage(
      normalizedCompositionPlan.pages[index],
      candidate,
      layouts.get(normalizedCompositionPlan.pages[index].compositionId),
    );
    normalizedCompositionPlan.pages[index] = normalizedCompositionPage;
    const structuralAlternatives = candidateSet.candidates.filter((item) => !item.fallbackBody);
    if (candidate.fallbackBody && structuralAlternatives.length) {
      feedback.push({
        pageId: planPage.pageId,
        code: "structural-candidate-skipped",
        message: "已有通过语义与容量过滤的结构候选，不得无理由退回正文兜底",
        legalAlternatives: structuralAlternatives.map((item) => ({
          familyId: item.familyId,
          variantId: item.variantId,
          silhouette: item.silhouette,
          compositionIds: item.compositionIds,
        })),
      });
    }
    if (timelineLacksTemporalEvidence(pageContents[index], candidate, candidateSet)) {
      const sequentialAlternatives = candidateSet.candidates.filter((item) => item.assetId === "sequential-process-001");
      feedback.push({
        pageId: planPage.pageId,
        code: "timeline-without-temporal-evidence",
        message: "原稿没有时间、里程碑或历史演进证据，应使用普通顺序流程而不是时间轴",
        legalAlternatives: sequentialAlternatives.map((item) => ({
          familyId: item.familyId,
          variantId: item.variantId,
          silhouette: item.silhouette,
          compositionIds: item.compositionIds,
        })),
      });
    }
    const compositionIssues = validateCompositionPage({
      content: pageContents[index],
      candidate,
      compositionPage: normalizedCompositionPage,
      layouts,
      metadataById,
    });
    compositionIssues.push(...validateIconQueries(planPage, candidate, normalizedCompositionPage));
    if (compositionIssues.length) {
      feedback.push({
        pageId: planPage.pageId,
        code: "composition-invalid",
        issues: compositionIssues,
        legalAlternatives: legalTextCompositionAlternatives(pageContents[index], candidate, layouts),
      });
    }
    selections.push(candidate);
    if (metadataById.get(candidate.assetId)?.kind === "component") {
      structuralRequests.push({
        pageId: planPage.pageId,
        logicId: candidate.logicId,
        structureGroupId: candidate.structureGroupId,
        familyId: candidate.familyId,
        assetId: candidate.assetId,
        itemCount: normalizedCompositionPage.componentItemIds.length,
        baseRelation: pageIntents[index].baseRelation,
        purposeKey: pageIntents[index].purposeKey,
        visualStructureGroupId: candidate.structureGroupId,
      });
    }
  });
  if (feedback.length) return { status: "needs-director-revision", feedback };

  const recentBodyCompositions = [];
  selections.forEach((candidate, index) => {
    const metadata = metadataById.get(candidate.assetId);
    if (assetKind(candidate.assetId, metadata) !== "body") return;
    const compositionId = normalizedCompositionPlan.pages[index].compositionId;
    const recentRepeat = recentBodyCompositions.find((entry) => (
      index - entry.index === 1 && entry.compositionId === compositionId
    ));
    const alternatives = (candidate.compositionIds ?? []).filter((id) => id !== compositionId);
    if (recentRepeat && alternatives.length) {
      warnings.push({
        pageId: pageContents[index].pageId,
        code: "composition-rhythm-repeat",
        compositionId,
        previousPageId: pageContents[recentRepeat.index].pageId,
        legalAlternatives: alternatives,
      });
    }
    recentBodyCompositions.push({ index, compositionId });
  });
  const variants = await listRenderableVisualVariants({ root });
  const rhythm = planVisualVariants(structuralRequests, { variants });
  if (rhythm.status !== "accepted") return rhythm;

  const layoutDecisions = selections.map((candidate, index) => ({
    schemaVersion: "1.0",
    intentId: pageIntents[index].intentId,
    decision: "single-match",
    selectedFamilyId: candidate.familyId,
    selectedAssetId: candidate.assetId,
    selectedVariantId: candidate.variantId,
    selectedSilhouette: candidate.silhouette,
    selectionState: "selected",
    selectionOwner: "visual-director",
    candidates: [],
    rejections: [],
    resolutionPlan: null,
  }));
  const renderPayloads = layoutDecisions.map((decision, index) => {
    const compositionPage = normalizedCompositionPlan.pages[index];
    const metadata = metadataById.get(decision.selectedAssetId);
    const componentContent = metadata?.kind === "component"
      ? filterComponentContent(pageContents[index], compositionPage)
      : pageContents[index];
    const payload = mapRenderPayload(
      componentContent,
      pageIntents[index],
      decision,
      compositionPage,
      normalizedVisualPlan.pages[index],
    );
    if (metadata?.kind === "component") payload.parameters.visualVariantId = decision.selectedVariantId;
    return payload;
  });
  return {
    status: "accepted",
    feedback: [],
    warnings,
    layoutDecisions,
    renderPayloads,
    visualPlan: normalizedVisualPlan,
    compositionPlan: normalizedCompositionPlan,
  };
}
