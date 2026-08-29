import fs from "node:fs/promises";
import path from "node:path";

import { createRuleValidators, validationMessage } from "../selection/validation.mjs";

const validationContexts = new Map();

function loadValidationContext(root) {
  const resolvedRoot = path.resolve(root);
  if (!validationContexts.has(resolvedRoot)) {
    validationContexts.set(resolvedRoot, Promise.all([
      fs.readFile(path.join(resolvedRoot, "catalog", "asset-contracts.json"), "utf8")
        .then((content) => JSON.parse(content).defaults),
      createRuleValidators(resolvedRoot),
    ]).then(([defaults, validators]) => ({ defaults, validators })));
  }
  return validationContexts.get(resolvedRoot);
}

function mergeObject(base, override) {
  return { ...(base ?? {}), ...(override ?? {}) };
}

export function normalizeFormalAssetContract(defaults, contract) {
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

export function formalAssetContractFromManifest(defaults, asset) {
  const runtime = asset.runtime ?? {};
  return normalizeFormalAssetContract(defaults, {
    assetId: asset.id,
    status: "validated",
    abstractionLevel: runtime.contract?.abstractionLevel,
    adaptationStatus: runtime.contract?.adaptationStatus,
    supportedIntents: {
      baseRelations: runtime.supportedBaseRelations ?? [],
      purposeKeys: runtime.supportedPurposeKeys ?? [],
    },
    constraints: {
      ...(runtime.contract?.constraints ?? {}),
      metrics: [
        ...(runtime.contract?.constraints?.metrics ?? []),
        { field: "itemCount", ...(runtime.itemCount ?? {}) },
      ],
    },
    fallback: runtime.contract?.fallback ?? {},
    evidence: {
      basis: ["metadata", "user-confirmation"],
      realManuscriptValidated: true,
      notes: asset.review ?? "用户确认后进入核心资产包。",
    },
  });
}

export async function inspectFormalAssetContract(asset, root = process.cwd()) {
  if (asset.runtime?.renderer === "skin") return { valid: true, issues: [], contract: null };
  const { defaults, validators } = await loadValidationContext(root);
  const contract = formalAssetContractFromManifest(defaults, asset);
  const valid = validators.validateAssetContract(contract);
  return {
    valid,
    contract,
    issues: valid ? [] : [validationMessage(validators.ajv, validators.validateAssetContract)],
  };
}
