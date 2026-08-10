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

const SKIN_CANDIDATES = {
  present_cover: {
    familyId: "skin-cover",
    assetId: "northeastern-university-cover-001",
    variantId: "default",
    silhouette: "cover",
    adaptationStatus: "fixed",
    compositionIds: ["fixed-cover"],
  },
  present_closing: {
    familyId: "skin-closing",
    assetId: "northeastern-university-closing-001",
    variantId: "default",
    silhouette: "closing",
    adaptationStatus: "fixed",
    compositionIds: ["fixed-closing"],
  },
};

const BODY_CANDIDATE = {
  familyId: "skin-body-editorial",
  assetId: "northeastern-university-body-001",
  variantId: "editorial",
  silhouette: "editorial-page",
  adaptationStatus: "adaptive",
};

function publicVariant(variant, contract, compositionIds) {
  return {
    familyId: variant.familyId,
    assetId: variant.assetId,
    variantId: variant.variantId,
    silhouette: variant.silhouette,
    adaptationStatus: contract.adaptationStatus,
    itemCount: variant.itemCount,
    compositionIds,
  };
}

export function computeCapacityDensity(stats) {
  const estimatedTotal = stats.avgItemChars * stats.itemCount;
  if (stats.itemCount <= 4 && estimatedTotal <= 70 && stats.maxItemChars <= 32) return "low";
  if (stats.itemCount <= 6 && estimatedTotal <= 180 && stats.maxItemChars <= 72) return "medium";
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
    const skinCandidate = SKIN_CANDIDATES[intent.purposeKey];
    if (skinCandidate) {
      return {
        pageId,
        intentId: intent.intentId,
        candidates: coreAssetIds.has(skinCandidate.assetId) ? [skinCandidate] : [],
      };
    }

    const capacityDensity = computeCapacityDensity(intent.contentStats);
    const semantic = matchPageIntent({ ...intent, density: capacityDensity }, renderableContracts, {
      includeComposite: true,
      includeDeferred: false,
      enableFallback: false,
    });
    const contractsById = new Map(renderableContracts.map((contract) => [contract.assetId, contract]));
    const structuralCandidates = semantic.candidates.flatMap((candidate) => {
      const compatible = queryVisualVariants(variantsByAsset.get(candidate.assetId) ?? [], {
        itemCount: intent.structure.itemCount,
        baseRelation: intent.baseRelation,
        purposeKey: intent.purposeKey,
      });
      const metadata = metadataById.get(candidate.assetId);
      const compositionIds = compositionCandidatesForAsset(layouts, candidate.assetId, metadata)
        .map((layout) => layout.id);
      return compatible.map((variant) => publicVariant(
        variant,
        contractsById.get(candidate.assetId),
        compositionIds,
      ));
    });
    const bodyMetadata = metadataById.get(BODY_CANDIDATE.assetId);
    const bodyCandidate = {
      ...BODY_CANDIDATE,
      compositionIds: compositionCandidatesForAsset(layouts, BODY_CANDIDATE.assetId, bodyMetadata)
        .map((layout) => layout.id),
    };
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

function idsForPage(content) {
  return new Set(content.items.map((item) => item.id));
}

function filterComponentContent(content, compositionPage) {
  const selected = new Set(compositionPage.componentItemIds);
  const expandedInText = new Set(compositionPage.textSlots.flatMap((slot) => slot.sourceItemIds));
  return {
    ...content,
    items: content.items
      .filter((item) => selected.has(item.id))
      .map((item) => compositionPage.componentContentMode === "titles-only"
        ? { ...item, body: "", ...(expandedInText.has(item.id) ? { emphasis: false } : {}) }
        : item),
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
  const unknownIds = [...new Set(referencedIds.filter((id) => !sourceIds.has(id)))];
  if (unknownIds.length) issues.push({ code: "composition-source-item-missing", sourceItemIds: unknownIds });
  const omittedIds = [...sourceIds].filter((id) => !referencedIds.includes(id));
  const fixedPage = ["cover", "closing"].includes(assetKind(candidate.assetId, metadata));
  if (!fixedPage && omittedIds.length) issues.push({ code: "composition-content-unplaced", sourceItemIds: omittedIds });

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

  if (layout.requiresComponent) {
    if (!compositionPage.componentItemIds.length || compositionPage.componentContentMode === "none") {
      issues.push({ code: "component-composition-without-content" });
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
  const structuralRequests = [];
  const selections = [];
  const feedback = [];
  visualPlan.pages.forEach((planPage, index) => {
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
    const compositionIssues = validateCompositionPage({
      content: pageContents[index],
      candidate,
      compositionPage: compositionPlan.pages[index],
      layouts,
      metadataById,
    });
    if (compositionIssues.length) {
      feedback.push({ pageId: planPage.pageId, code: "composition-invalid", issues: compositionIssues });
    }
    selections.push(candidate);
    if (metadataById.get(candidate.assetId)?.kind === "component") {
      structuralRequests.push({
        pageId: planPage.pageId,
        familyId: candidate.familyId,
        assetId: candidate.assetId,
        itemCount: compositionPlan.pages[index].componentItemIds.length,
        baseRelation: pageIntents[index].baseRelation,
        purposeKey: pageIntents[index].purposeKey,
        visualVariantId: candidate.variantId,
      });
    }
  });
  if (feedback.length) return { status: "needs-director-revision", feedback };

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
    const compositionPage = compositionPlan.pages[index];
    const metadata = metadataById.get(decision.selectedAssetId);
    const componentContent = metadata?.kind === "component"
      ? filterComponentContent(pageContents[index], compositionPage)
      : pageContents[index];
    const payload = mapRenderPayload(componentContent, pageIntents[index], decision);
    if (metadata?.kind === "component") payload.parameters.visualVariantId = decision.selectedVariantId;
    return payload;
  });
  return { status: "accepted", feedback: [], layoutDecisions, renderPayloads, compositionPlan };
}
