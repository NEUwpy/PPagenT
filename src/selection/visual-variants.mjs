import fs from "node:fs/promises";
import path from "node:path";
import { loadContractCatalog } from "./contracts.mjs";
import {
  discoverCoreAssetPackages,
  loadCoreAssetCapabilities,
} from "../runtime/core-asset-packages.mjs";

export async function loadVisualVariantCatalog(root = process.cwd()) {
  const target = path.join(root, "catalog", "visual-variants.json");
  const catalog = JSON.parse(await fs.readFile(target, "utf8"));
  if (!Array.isArray(catalog.variants)) throw new Error("visual-variants.json 缺少 variants 数组");
  const packages = await discoverCoreAssetPackages(root);
  const packagedKeys = new Set(packages.map((item) => `${item.assetId}:${item.runtime.variantId}`));
  const packagedVariants = packages.map((item) => ({
    logicId: item.runtime.logicId ?? "skin",
    structureGroupId: item.runtime.structureGroupId ?? item.runtime.variantId,
    familyId: item.runtime.familyId,
    assetId: item.assetId,
    variantId: item.runtime.variantId,
    builderKey: `${item.assetId}:${item.runtime.variantId}`,
    silhouette: item.runtime.silhouette,
    supportedBaseRelations: item.runtime.supportedBaseRelations,
    supportedPurposeKeys: item.runtime.supportedPurposeKeys ?? [],
    itemCount: { ...item.runtime.itemCount },
    textCapacity: item.textCapacity ? structuredClone(item.textCapacity) : null,
    textFlow: item.textFlow ? structuredClone(item.textFlow) : null,
    contentContract: item.runtime.contentContract ? structuredClone(item.runtime.contentContract) : null,
    slotContract: item.runtime.slotContract ? structuredClone(item.runtime.slotContract) : null,
    renderer: item.runtime.renderer,
    compositionIds: item.runtime.compositionIds ?? [],
    fallbackBody: Boolean(item.runtime.fallbackBody),
    stateContract: item.runtime.stateContract ?? null,
    sourceFrame: item.runtime.sourceFrame ? { ...item.runtime.sourceFrame } : null,
    mediaContract: item.runtime.mediaContract ?? { mode: "no-image", required: [] },
    status: "core",
    origin: "self-describing-asset",
    runtimeDeclared: true,
  }));
  return [
    ...catalog.variants.filter((variant) => !packagedKeys.has(`${variant.assetId}:${variant.variantId}`)),
    ...packagedVariants,
  ]
    .map((variant) => ({ ...variant, itemCount: { ...variant.itemCount } }))
    .sort((left, right) => (
      Number(right.origin === "self-describing-asset") - Number(left.origin === "self-describing-asset")
      || left.familyId.localeCompare(right.familyId)
      || left.assetId.localeCompare(right.assetId)
      || left.variantId.localeCompare(right.variantId)
    ));
}

export async function loadCoreAssetIds(root = process.cwd()) {
  return new Set((await discoverCoreAssetPackages(root)).map((item) => item.assetId));
}

async function discoverRenderMapperAssetIds(root) {
  const target = path.join(root, "src", "render", "render-payload.mjs");
  const source = await fs.readFile(target, "utf8");
  return new Set([
    ...[...source.matchAll(/assetId\s*===\s*["']([^"']+)["']/g)].map((match) => match[1]),
    ...(await discoverCoreAssetPackages(root)).map((item) => item.assetId),
  ]);
}

export async function listRenderableVisualVariants(options = {}) {
  const root = options.root ?? process.cwd();
  const variants = options.variants ?? await loadVisualVariantCatalog(root);
  const contracts = options.contracts ?? await loadContractCatalog(root);
  const allowedStatuses = new Set(options.allowedStatuses ?? ["experimental", "validated"]);
  const allowedVariantStatuses = new Set(options.allowedVariantStatuses ?? ["core"]);
  const coreAssetIds = options.coreAssetIds
    ? new Set(options.coreAssetIds)
    : await loadCoreAssetIds(root);
  const contractIds = new Set(
    contracts
      .filter((contract) => allowedStatuses.has(contract.status))
      .map((contract) => contract.assetId),
  );
  const mapperIds = options.mapperAssetIds
    ? new Set(options.mapperAssetIds)
    : await discoverRenderMapperAssetIds(root);

  return variants
    .map((variant) => ({
      ...variant,
      contractAvailable: contractIds.has(variant.assetId),
      coreAssetAvailable: coreAssetIds.has(variant.assetId),
      callableStatus: allowedVariantStatuses.has(variant.status),
      mapperAvailable: mapperIds.has(variant.assetId),
      builderAvailable: variant.renderer === "skin" || variant.runtimeDeclared === true,
    }))
    .filter((variant) => (
      variant.contractAvailable
      && variant.coreAssetAvailable
      && variant.callableStatus
      && variant.mapperAvailable
      && variant.builderAvailable
    ));
}

/**
 * Second disclosure stage: imports only a shortlisted asset's lightweight
 * runtime contract to expose exact text/container capacity.
 */
export async function loadVisualVariantCapabilities(variant, root = process.cwd()) {
  if (variant.renderer === "skin" || variant.textRegions?.length) return variant;
  const capability = await loadCoreAssetCapabilities(variant.assetId, root);
  return {
    ...variant,
    textCapacity: variant.textCapacity ?? capability.textCapacity,
    textFlow: capability.textFlow
      ? { ...(variant.textFlow ?? {}), ...capability.textFlow }
      : variant.textFlow,
    textRegions: capability.textRegions,
  };
}

export function queryVisualVariants(variants, query = {}) {
  let filtered = variants.filter((variant) => {
    if (query.logicId && variant.logicId !== query.logicId) return false;
    if (query.structureGroupId && variant.structureGroupId !== query.structureGroupId) return false;
    if (query.familyId && variant.familyId !== query.familyId) return false;
    if (query.assetId && variant.assetId !== query.assetId) return false;
    if (query.baseRelation && !variant.supportedBaseRelations?.includes(query.baseRelation)) return false;
    if (query.requiredItemRole && variant.contentContract?.itemRole !== query.requiredItemRole) return false;
    if (variant.contentContract?.requiresStructuredDataType
      && variant.contentContract.requiresStructuredDataType !== query.structuredDataType) return false;
    if ((query.maxPointsPerItem ?? 0) > 0 && variant.contentContract?.points === "forbidden") return false;
    const pointCounts = query.pointCounts ?? [];
    if (variant.contentContract?.points === "required"
      && (!pointCounts.length || pointCounts.some((count) => count <= 0))
      && !query.allowMissingRequiredPoints) return false;
    const pointCountContract = variant.contentContract?.pointCount;
    if (pointCountContract && !query.allowMissingRequiredPoints && (
      pointCounts.length !== query.itemCount
      || pointCounts.some((count) => count < pointCountContract.min || count > pointCountContract.max)
      || (pointCountContract.balancedAcrossItems && new Set(pointCounts).size > 1)
    )) return false;
    if (variant.contentContract?.polarity === "one-positive-one-negative") {
      const polarities = query.polarities ?? [];
      const explicitPair = polarities.length === 2
        && polarities.includes("positive")
        && polarities.includes("negative");
      const emphasisCount = (query.emphases ?? []).filter(Boolean).length;
      if (!explicitPair && emphasisCount !== 1) return false;
    }
    if (query.itemCount !== undefined) {
      if (query.itemCount < variant.itemCount.min || query.itemCount > variant.itemCount.max) return false;
    }
    if (variant.textCapacity) {
      if (query.maxItemTitleChars !== undefined
        && query.maxItemTitleChars > variant.textCapacity.maxItemTitleChars) return false;
      if (query.maxItemBodyChars !== undefined
        && query.maxItemBodyChars > variant.textCapacity.maxItemBodyChars) return false;
      if (variant.textCapacity.maxPointsPerItem !== undefined
        && (query.maxPointsPerItem ?? 0) > variant.textCapacity.maxPointsPerItem) return false;
      if (variant.textCapacity.maxPointChars !== undefined
        && (query.maxPointChars ?? 0) > variant.textCapacity.maxPointChars) return false;
    }
    return true;
  });
  if (query.purposeKey) {
    const purposeSpecific = filtered.filter((variant) => variant.supportedPurposeKeys?.includes(query.purposeKey));
    if (purposeSpecific.length) return purposeSpecific;
  }
  filtered = filtered.filter((variant) => !variant.supportedPurposeKeys?.length);
  return filtered;
}

function preferredDistance(variant, itemCount) {
  const preferred = variant.itemCount.preferred ?? [];
  if (!preferred.length || preferred.includes(itemCount)) return 0;
  return 1 + Math.min(...preferred.map((value) => Math.abs(value - itemCount)));
}

function selectionScore(variant, itemCount, history) {
  const previous = history.at(-1);
  const silhouetteFrequency = history.filter((entry) => entry.silhouette === variant.silhouette).length;
  const structureGroupFrequency = history.filter((entry) => (
    entry.structureGroupId === variant.structureGroupId
  )).length;
  return [
    Number(previous?.silhouette === variant.silhouette),
    silhouetteFrequency,
    structureGroupFrequency,
    preferredDistance(variant, itemCount),
    variant.variantId,
  ];
}

function compareScore(left, right) {
  for (let index = 0; index < left.length - 1; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.at(-1).localeCompare(right.at(-1));
}

function rankVisualVariantCandidates({
  logicId, structureGroupId, familyId, assetId, itemCount, baseRelation, purposeKey,
  pointCounts, polarities, emphases, maxPointsPerItem, maxPointChars, requiredItemRole, structuredDataType,
  history = [], variants,
}) {
  const candidates = queryVisualVariants(variants, {
    logicId,
    structureGroupId,
    familyId,
    assetId,
    itemCount,
    baseRelation,
    purposeKey,
    pointCounts,
    polarities,
    emphases,
    maxPointsPerItem,
    maxPointChars,
    requiredItemRole,
    structuredDataType,
  });
  return candidates
    .map((variant) => ({ variant, score: selectionScore(variant, itemCount, history) }))
    .sort((left, right) => compareScore(left.score, right.score))
    .map(({ variant }) => variant);
}

function candidateSummary(variant) {
  return {
    logicId: variant.logicId,
    structureGroupId: variant.structureGroupId,
    variantId: variant.variantId,
    silhouette: variant.silhouette,
    builderKey: variant.builderKey,
  };
}

function resultWithIssue(request, status, candidates, code, message) {
  return {
    pageId: request.pageId,
    status,
    familyId: request.familyId,
    logicId: request.logicId,
    assetId: request.assetId ?? candidates[0]?.assetId ?? null,
    itemCount: request.itemCount,
    candidates: candidates.map(candidateSummary),
    issues: [{ code, message }],
  };
}

/**
 * 对视觉导演给出的整套变体决策做程序合法化和节奏冲突检查。
 * 本函数不替视觉导演选择变体；缺失、非法或重复失衡时只返回可用候选和反馈。
 */
export function planVisualVariants(requests, options) {
  const history = [...(options.history ?? [])];
  const results = [];
  const feedback = [];

  for (const request of requests) {
    const candidates = rankVisualVariantCandidates({ ...request, history, variants: options.variants });
    let result;
    if (!candidates.length) {
      result = resultWithIssue(
        request,
        "invalid-director-decision",
        [],
        "no-renderable-variant",
        `${request.familyId ?? request.assetId} 没有支持 ${request.itemCount} 个内容项的可渲染视觉变体`,
      );
    } else if (!request.visualStructureGroupId) {
      result = resultWithIssue(
        request,
        "needs-director-decision",
        candidates,
        "missing-visual-variant",
        "视觉导演尚未为该页指定 visualStructureGroupId",
      );
    } else {
      const requestedStructureGroup = request.visualStructureGroupId;
      const selected = candidates.find((variant) => (
        variant.structureGroupId === requestedStructureGroup
      ));
      if (!selected) {
        result = resultWithIssue(
          request,
          "invalid-director-decision",
          candidates,
          "unsupported-visual-variant",
          `${requestedStructureGroup} 不满足当前表达能力、运行能力或内容数量约束`,
        );
      } else {
        const previous = history.at(-1);
        const alternatives = candidates.filter((variant) => variant.silhouette !== selected.silhouette);
        const selectedUses = history.filter((entry) => entry.silhouette === selected.silhouette).length;
        const leastAlternativeUses = alternatives.length
          ? Math.min(...alternatives.map((variant) => history.filter((entry) => entry.silhouette === variant.silhouette).length))
          : Number.POSITIVE_INFINITY;
        if (previous?.silhouette === selected.silhouette && alternatives.length) {
          result = resultWithIssue(
            request,
            "rhythm-conflict",
            candidates,
            "adjacent-silhouette-repeat",
            `${selected.silhouette} 与前一页轮廓相同，且存在合法替代表现`,
          );
        } else if (selectedUses > leastAlternativeUses + 1) {
          result = resultWithIssue(
            request,
            "frequency-conflict",
            candidates,
            "unnecessary-silhouette-frequency",
            `${selected.silhouette} 的使用频次明显高于同家族合法替代轮廓`,
          );
        } else {
          result = {
            pageId: request.pageId,
            status: "accepted",
            familyId: selected.familyId,
            logicId: selected.logicId,
            structureGroupId: selected.structureGroupId,
            assetId: selected.assetId,
            itemCount: request.itemCount,
            variantId: selected.variantId,
            silhouette: selected.silhouette,
            builderKey: selected.builderKey,
            candidates: candidates.map(candidateSummary),
            issues: [],
          };
          history.push(result);
        }
      }
    }
    results.push(result);
    for (const issue of result.issues) {
      feedback.push({
        pageId: result.pageId,
        code: issue.code,
        message: issue.message,
        candidateVariantIds: result.candidates.map((candidate) => candidate.variantId),
      });
    }
  }

  const output = {
    status: feedback.length ? "needs-director-revision" : "accepted",
    results,
    feedback,
  };
  if (options.throwOnConflict && feedback.length) {
    throw new Error(`视觉变体计划未通过：${feedback.map((item) => `${item.pageId}:${item.code}`).join(", ")}`);
  }
  return output;
}
