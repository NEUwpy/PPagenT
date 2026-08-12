import fs from "node:fs/promises";
import path from "node:path";
import { discoverCoreAssetPackages } from "../runtime/core-asset-packages.mjs";

function mergeObject(base, override) {
  return { ...(base ?? {}), ...(override ?? {}) };
}

export function normalizeContract(defaults, contract) {
  return {
    ...defaults,
    ...contract,
    supportedIntents: mergeObject(defaults.supportedIntents, contract.supportedIntents),
    constraints: {
      ...mergeObject(defaults.constraints, contract.constraints),
      semantic: mergeObject(defaults.constraints?.semantic, contract.constraints?.semantic),
      relationTraits: mergeObject(defaults.constraints?.relationTraits, contract.constraints?.relationTraits),
      metrics: contract.constraints?.metrics ?? defaults.constraints?.metrics ?? [],
      density: contract.constraints?.density ?? defaults.constraints?.density ?? [],
    },
    textBudget: mergeObject(defaults.textBudget, contract.textBudget),
    fallback: mergeObject(defaults.fallback, contract.fallback),
    evidence: {
      ...mergeObject(defaults.evidence, contract.evidence),
      basis: contract.evidence?.basis ?? defaults.evidence?.basis ?? [],
    },
  };
}

export async function loadContractCatalog(root = process.cwd()) {
  const target = path.join(root, "catalog", "asset-contracts.json");
  const catalog = JSON.parse(await fs.readFile(target, "utf8"));
  const packages = await discoverCoreAssetPackages(root);
  const packagedIds = new Set(packages.map((item) => item.assetId));
  const packagedContracts = packages.map((item) => normalizeContract(catalog.defaults, {
    assetId: item.assetId,
    status: "validated",
    abstractionLevel: item.runtime.contract.abstractionLevel,
    adaptationStatus: item.runtime.contract.adaptationStatus,
    supportedIntents: {
      baseRelations: item.runtime.supportedBaseRelations,
      purposeKeys: item.runtime.supportedPurposeKeys ?? [],
    },
    constraints: {
      ...item.runtime.contract.constraints,
      metrics: [
        ...(item.runtime.contract.constraints?.metrics ?? []),
        { field: "itemCount", ...item.runtime.itemCount },
      ],
    },
    evidence: {
      basis: ["metadata", "user-confirmation"],
      realManuscriptValidated: true,
      notes: item.asset.review ?? "用户确认后进入核心资产包。",
    },
  }));
  return [
    ...catalog.contracts
      .filter((contract) => !packagedIds.has(contract.assetId))
      .map((contract) => normalizeContract(catalog.defaults, contract)),
    ...packagedContracts,
  ];
}

function metricValue(intent, field) {
  if (Object.hasOwn(intent.structure, field)) return intent.structure[field];
  return intent.structure.dimensions?.[field];
}

function evaluateTextBudget(intent, contract, reasons) {
  const budget = contract.textBudget;
  if (budget.status === "unverified") return;
  if (budget.itemTitleMax !== undefined && intent.contentStats.maxItemTitleChars > budget.itemTitleMax) {
    reasons.push("too-long:item-title");
  }
  if (budget.itemBodyMax !== undefined && intent.contentStats.maxItemBodyChars > budget.itemBodyMax) {
    reasons.push("too-long:item-body");
  }
  if (budget.imbalanceRatioMax !== undefined && intent.contentStats.imbalanceRatio > budget.imbalanceRatioMax) {
    reasons.push("too-long:imbalance");
  }
}

function evaluateContract(intent, contract) {
  const reasons = [];
  if (!contract.supportedIntents.baseRelations.includes(intent.baseRelation)) {
    reasons.push(`base-relation:${intent.baseRelation}`);
  }

  const purposeKeys = contract.supportedIntents.purposeKeys;
  if (purposeKeys.length && !purposeKeys.includes(intent.purposeKey)) {
    reasons.push(`purpose-key:${intent.purposeKey}`);
  }

  for (const metric of contract.constraints.metrics) {
    const value = metricValue(intent, metric.field);
    if (!Number.isInteger(value)) reasons.push(`missing-metric:${metric.field}`);
    else {
      if (metric.min !== undefined && value < metric.min) reasons.push(`below-min:${metric.field}`);
      if (metric.max !== undefined && value > metric.max) reasons.push(`above-max:${metric.field}`);
    }
  }

  for (const [field, expected] of Object.entries(contract.constraints.semantic)) {
    const actual = intent.structure[field];
    if (actual === undefined) reasons.push(`missing-semantic:${field}`);
    else if (actual !== expected) reasons.push(`semantic:${field}`);
  }

  for (const [field, expected] of Object.entries(contract.constraints.relationTraits)) {
    const actual = intent.relationTraits[field];
    if (actual === undefined) reasons.push(`missing-trait:${field}`);
    else if (actual !== expected) reasons.push(`trait:${field}`);
  }

  if (contract.constraints.density.length && !contract.constraints.density.includes(intent.density)) {
    reasons.push(`density:${intent.density}`);
  }
  evaluateTextBudget(intent, contract, reasons);

  return { eligible: reasons.length === 0, reasons };
}

const LEVEL_ORDER = { foundation: 0, composite: 1, deferred: 2 };
const ADAPTATION_ORDER = { adaptive: 0, partial: 1, fixed: 2, unknown: 3 };

function fitSignals(intent, contract) {
  const preferredMetrics = contract.constraints.metrics.filter((metric) => {
    if (!metric.preferred?.length) return false;
    return metric.preferred.includes(metricValue(intent, metric.field));
  }).length;
  const totalPreferredMetrics = contract.constraints.metrics.filter((metric) => metric.preferred?.length).length;
  return {
    purposeSpecific: contract.supportedIntents.purposeKeys.length > 0,
    preferredMetrics,
    totalPreferredMetrics,
    validated: contract.status === "validated",
    realManuscriptValidated: contract.evidence.realManuscriptValidated,
  };
}

function preferredRatio(signals) {
  return signals.totalPreferredMetrics ? signals.preferredMetrics / signals.totalPreferredMetrics : 0;
}

function compareCandidates(left, right) {
  const leftSignals = left.fitSignals;
  const rightSignals = right.fitSignals;
  return left.reasons.length - right.reasons.length
    || Number(rightSignals.purposeSpecific) - Number(leftSignals.purposeSpecific)
    || preferredRatio(rightSignals) - preferredRatio(leftSignals)
    || Number(rightSignals.validated) - Number(leftSignals.validated)
    || Number(rightSignals.realManuscriptValidated) - Number(leftSignals.realManuscriptValidated)
    || ADAPTATION_ORDER[left.contract.adaptationStatus] - ADAPTATION_ORDER[right.contract.adaptationStatus]
    || LEVEL_ORDER[left.contract.abstractionLevel] - LEVEL_ORDER[right.contract.abstractionLevel]
    || left.contract.assetId.localeCompare(right.contract.assetId);
}

function sameFit(left, right) {
  if (!left || !right) return false;
  return left.fitSignals.purposeSpecific === right.fitSignals.purposeSpecific
    && preferredRatio(left.fitSignals) === preferredRatio(right.fitSignals)
    && left.fitSignals.validated === right.fitSignals.validated
    && left.fitSignals.realManuscriptValidated === right.fitSignals.realManuscriptValidated
    && left.contract.adaptationStatus === right.contract.adaptationStatus
    && left.contract.abstractionLevel === right.contract.abstractionLevel;
}

function fallbackKey(reason) {
  if (reason.startsWith("above-max:")) return "tooMany";
  if (reason.startsWith("below-min:")) return "tooFew";
  if (reason.startsWith("too-long:") || reason.startsWith("density:")) return "tooLong";
  return "semanticMismatch";
}

function buildResolutionPlan(intent, nearMatches) {
  if (!nearMatches.length) {
    return {
      schemaVersion: "1.0",
      reason: "no-compatible-contract",
      action: "simple-layout",
      targetAssetIds: [],
      requiresReview: false,
      notes: "没有结构资产能够合法表达当前意图，退化为简单排版。",
    };
  }

  nearMatches.sort(compareCandidates);
  const nearest = nearMatches[0];
  const reason = nearest.reasons[0];
  const action = nearest.contract.fallback[fallbackKey(reason)];
  const plan = {
    schemaVersion: "1.0",
    reason,
    action,
    sourceAssetId: nearest.contract.assetId,
    targetAssetIds: [],
    requiresReview: new Set(["reject", "switch-layout", "defer-to-review"]).has(action),
  };

  if (action === "split" && reason.startsWith("above-max:")) {
    const field = reason.slice("above-max:".length);
    const metric = nearest.contract.constraints.metrics.find((item) => item.field === field);
    const value = metricValue(intent, field);
    if (metric?.max && Number.isInteger(value)) plan.pages = Math.ceil(value / metric.max);
  }
  return plan;
}

function publicCandidate(item) {
  return {
    assetId: item.contract.assetId,
    abstractionLevel: item.contract.abstractionLevel,
    adaptationStatus: item.contract.adaptationStatus,
    fitSignals: item.fitSignals,
  };
}

export function matchPageIntent(intent, contracts, options = {}) {
  const includeComposite = options.includeComposite ?? true;
  const includeDeferred = options.includeDeferred ?? false;
  const enableFallback = options.enableFallback ?? true;
  const allowedStatuses = new Set(options.allowedStatuses ?? ["experimental", "validated"]);
  const eligible = [];
  const rejected = [];
  const nearMatches = [];

  for (const contract of contracts) {
    if (!allowedStatuses.has(contract.status)) {
      rejected.push({ assetId: contract.assetId, reasons: [`status:${contract.status}`] });
      continue;
    }
    if (contract.abstractionLevel === "composite" && !includeComposite) {
      rejected.push({ assetId: contract.assetId, reasons: ["composite-disabled"] });
      continue;
    }
    if (contract.abstractionLevel === "deferred" && !includeDeferred) {
      rejected.push({ assetId: contract.assetId, reasons: ["deferred"] });
      continue;
    }

    const result = evaluateContract(intent, contract);
    const candidate = { contract, fitSignals: fitSignals(intent, contract), reasons: result.reasons };
    if (result.eligible) eligible.push(candidate);
    else {
      rejected.push({ assetId: contract.assetId, reasons: result.reasons });
      const hasIntentMismatch = result.reasons.some((reason) => reason.startsWith("base-relation:") || reason.startsWith("purpose-key:"));
      if (!hasIntentMismatch) nearMatches.push(candidate);
    }
  }

  eligible.sort(compareCandidates);
  if (!eligible.length) {
    return {
      schemaVersion: "1.0",
      intentId: intent.intentId,
      decision: enableFallback ? "fallback" : "no-match",
      selectedFamilyId: null,
      selectedAssetId: null,
      selectedVariantId: null,
      selectedSilhouette: null,
      selectionState: enableFallback ? "fallback" : "unresolved",
      selectionOwner: "legacy-matcher",
      candidates: [],
      rejections: rejected,
      resolutionPlan: enableFallback ? buildResolutionPlan(intent, nearMatches) : null,
    };
  }

  const decision = eligible.length === 1 ? "single-match" : sameFit(eligible[0], eligible[1]) ? "needs-ranking" : "ranked-match";
  return {
    schemaVersion: "1.0",
    intentId: intent.intentId,
    decision,
    selectedFamilyId: null,
    selectedAssetId: decision === "needs-ranking" ? null : eligible[0].contract.assetId,
    selectedVariantId: null,
    selectedSilhouette: null,
    selectionState: decision === "needs-ranking" ? "unresolved" : "legacy-asset-only",
    selectionOwner: "legacy-matcher",
    candidates: eligible.map(publicCandidate),
    rejections: rejected,
    resolutionPlan: null,
  };
}
