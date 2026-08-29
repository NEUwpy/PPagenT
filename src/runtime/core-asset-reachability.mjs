import {
  LOGIC_INTENT_DEFAULTS,
  logicIdForStructuredData,
} from "../content/formal-logic-contract.mjs";

function preferredItemCount(itemCount = {}) {
  const preferred = (itemCount.preferred ?? []).find((value) => (
    Number.isInteger(value) && value >= itemCount.min && value <= itemCount.max
  ));
  return preferred ?? itemCount.min;
}

function inspectApplicability(runtime = {}) {
  const contract = runtime.contentContract ?? {};
  const reasons = [];
  if (contract.requiresStructuredDataType) {
    reasons.push(`requires-structured-data:${contract.requiresStructuredDataType}`);
  }
  if (contract.points === "required") reasons.push("requires-points-per-item");
  if (contract.pointCount) {
    reasons.push(`requires-point-count:${contract.pointCount.min}-${contract.pointCount.max}`);
  }
  if (contract.polarity) reasons.push(`requires-polarity:${contract.polarity}`);
  // Semantic icons are resolved locally from a query and therefore do not
  // constrain the source manuscript. Only source-bound required media makes
  // an otherwise generic structure specialized.
  if (runtime.mediaContract?.mode !== "semantic-icon") {
    if (runtime.mediaContract?.requiredPerComponentItem) reasons.push("requires-source-media-per-item");
    if (runtime.mediaContract?.requiredPerInput) reasons.push("requires-source-media-per-input");
  }
  return {
    scope: reasons.length ? "specialized" : "generic",
    reasons,
  };
}

/**
 * Manifest-only formal reachability check.
 * It proves that the formal PageIntent produced for this Logic can reach the
 * asset selector without importing HTML/PPT code or generating an artifact.
 */
export function inspectCoreAssetReachability(asset) {
  if (asset.runtime?.renderer === "skin") {
    return {
      reachable: true,
      issues: [],
      witness: { renderer: "skin" },
      applicability: { scope: "shell", reasons: [] },
    };
  }
  const runtime = asset.runtime ?? {};
  const defaults = LOGIC_INTENT_DEFAULTS[runtime.logicId];
  const issues = [];
  if (!defaults) issues.push(`未知正式 Logic: ${runtime.logicId ?? "未声明"}`);

  const requiredStructuredDataType = runtime.contentContract?.requiresStructuredDataType;
  if (requiredStructuredDataType) {
    const structuredLogicId = logicIdForStructuredData(requiredStructuredDataType);
    if (!structuredLogicId) {
      issues.push(`正式 PageContent 不支持 structuredData.type=${requiredStructuredDataType}`);
    } else if (structuredLogicId !== runtime.logicId) {
      issues.push(`structuredData.type=${requiredStructuredDataType} 归属 ${structuredLogicId}，不是 ${runtime.logicId}`);
    }
  }

  if (defaults && !runtime.supportedBaseRelations?.includes(defaults.baseRelation)) {
    issues.push(`正式 baseRelation=${defaults.baseRelation} 不在资产支持范围`);
  }
  if (defaults && runtime.supportedPurposeKeys?.length
    && !runtime.supportedPurposeKeys.includes(defaults.purposeKey)) {
    issues.push(`正式 purposeKey=${defaults.purposeKey} 不在资产支持范围`);
  }

  const itemCount = preferredItemCount(runtime.itemCount);
  if (!Number.isInteger(itemCount)) issues.push("无法构造合法 itemCount 见证");

  return {
    reachable: issues.length === 0,
    issues,
    applicability: inspectApplicability(runtime),
    witness: defaults ? {
      logicId: runtime.logicId,
      baseRelation: defaults.baseRelation,
      purposeKey: defaults.purposeKey,
      itemCount,
      ...(requiredStructuredDataType ? { structuredDataType: requiredStructuredDataType } : {}),
    } : null,
  };
}
