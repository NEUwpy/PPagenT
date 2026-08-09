import fs from "node:fs/promises";
import path from "node:path";

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
  return catalog.contracts.map((contract) => normalizeContract(catalog.defaults, contract));
}

function metricValue(intent, field) {
  if (Object.hasOwn(intent.structure, field)) return intent.structure[field];
  return intent.structure.dimensions?.[field];
}

function evaluateContract(intent, contract) {
  const reasons = [];
  const relationAllowed = contract.supportedIntents.relations.includes(intent.relation);
  if (!relationAllowed) reasons.push(`relation:${intent.relation}`);

  const purposes = contract.supportedIntents.purposes;
  if (purposes.length && !purposes.includes(intent.purpose)) {
    reasons.push(`purpose:${intent.purpose}`);
  }

  for (const metric of contract.constraints.metrics) {
    const value = metricValue(intent, metric.field);
    if (!Number.isInteger(value)) {
      reasons.push(`missing-metric:${metric.field}`);
      continue;
    }
    if (metric.min !== undefined && value < metric.min) reasons.push(`below-min:${metric.field}`);
    if (metric.max !== undefined && value > metric.max) reasons.push(`above-max:${metric.field}`);
  }

  for (const [field, expected] of Object.entries(contract.constraints.semantic)) {
    const actual = intent.structure[field];
    if (actual === undefined) reasons.push(`missing-semantic:${field}`);
    else if (actual !== expected) reasons.push(`semantic:${field}`);
  }

  if (contract.constraints.density.length && !contract.constraints.density.includes(intent.density)) {
    reasons.push(`density:${intent.density}`);
  }

  return { eligible: reasons.length === 0, reasons };
}

const LEVEL_ORDER = { foundation: 0, composite: 1, deferred: 2 };
const ADAPTATION_ORDER = { adaptive: 0, partial: 1, fixed: 2, unknown: 3 };

export function matchPageIntent(intent, contracts, options = {}) {
  const includeComposite = options.includeComposite ?? true;
  const includeDeferred = options.includeDeferred ?? false;
  const allowedStatuses = new Set(options.allowedStatuses ?? ["experimental", "validated"]);
  const eligible = [];
  const rejected = [];

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
    if (result.eligible) eligible.push(contract);
    else rejected.push({ assetId: contract.assetId, reasons: result.reasons });
  }

  eligible.sort((left, right) => {
    return LEVEL_ORDER[left.abstractionLevel] - LEVEL_ORDER[right.abstractionLevel]
      || ADAPTATION_ORDER[left.adaptationStatus] - ADAPTATION_ORDER[right.adaptationStatus]
      || left.assetId.localeCompare(right.assetId);
  });

  return {
    intentId: intent.intentId,
    decision: eligible.length === 0 ? "no-match" : eligible.length === 1 ? "single-match" : "needs-ranking",
    eligible: eligible.map((contract) => ({
      assetId: contract.assetId,
      abstractionLevel: contract.abstractionLevel,
      adaptationStatus: contract.adaptationStatus,
      evidence: contract.evidence,
    })),
    rejected,
  };
}
