import { mapRenderPayload } from "../render/render-payload.mjs";
import { loadContractCatalog, matchPageIntent } from "../selection/contracts.mjs";
import {
  listRenderableVisualVariants,
  planVisualVariants,
  queryVisualVariants,
} from "../selection/visual-variants.mjs";

const SKIN_CANDIDATES = {
  present_cover: {
    familyId: "skin-cover",
    assetId: "northeastern-university-cover-001",
    variantId: "default",
    silhouette: "cover",
    adaptationStatus: "fixed",
  },
  present_closing: {
    familyId: "skin-closing",
    assetId: "northeastern-university-closing-001",
    variantId: "default",
    silhouette: "closing",
    adaptationStatus: "fixed",
  },
};

function publicVariant(variant, contract) {
  return {
    familyId: variant.familyId,
    assetId: variant.assetId,
    variantId: variant.variantId,
    silhouette: variant.silhouette,
    adaptationStatus: contract.adaptationStatus,
    itemCount: variant.itemCount,
  };
}

export function computeCapacityDensity(stats) {
  const estimatedTotal = stats.avgItemChars * stats.itemCount;
  if (stats.itemCount <= 4 && estimatedTotal <= 70 && stats.maxItemChars <= 32) return "low";
  if (stats.itemCount <= 6 && estimatedTotal <= 180 && stats.maxItemChars <= 72) return "medium";
  return "high";
}

export async function buildVisualCandidateSets({ root = process.cwd(), pageContents, pageIntents }) {
  const [contracts, variants] = await Promise.all([
    loadContractCatalog(root),
    listRenderableVisualVariants({ root }),
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
    if (skinCandidate) return { pageId, intentId: intent.intentId, candidates: [skinCandidate] };

    const capacityDensity = computeCapacityDensity(intent.contentStats);
    const semantic = matchPageIntent({ ...intent, density: capacityDensity }, renderableContracts, {
      includeComposite: true,
      includeDeferred: false,
      enableFallback: false,
    });
    const contractsById = new Map(renderableContracts.map((contract) => [contract.assetId, contract]));
    const candidates = semantic.candidates.flatMap((candidate) => {
      const compatible = queryVisualVariants(variantsByAsset.get(candidate.assetId) ?? [], {
        itemCount: intent.structure.itemCount,
        baseRelation: intent.baseRelation,
        purposeKey: intent.purposeKey,
      });
      return compatible.map((variant) => publicVariant(variant, contractsById.get(candidate.assetId)));
    });
    return {
      pageId,
      intentId: intent.intentId,
      candidates,
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

export async function resolveVisualPlan({ root = process.cwd(), pageContents, pageIntents, visualPlan, candidateSets }) {
  if (!Array.isArray(candidateSets) || candidateSets.length !== pageIntents.length) {
    return { status: "needs-director-revision", feedback: [{ code: "candidate-set-mismatch" }] };
  }

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
    selections.push(candidate);
    if (!candidate.assetId.startsWith("northeastern-university-")) {
      structuralRequests.push({
        pageId: planPage.pageId,
        familyId: candidate.familyId,
        assetId: candidate.assetId,
        itemCount: pageIntents[index].structure.itemCount,
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
    const payload = mapRenderPayload(pageContents[index], pageIntents[index], decision);
    if (!decision.selectedAssetId.startsWith("northeastern-university-")) {
      payload.parameters.visualVariantId = decision.selectedVariantId;
    }
    return payload;
  });
  return { status: "accepted", feedback: [], layoutDecisions, renderPayloads };
}
