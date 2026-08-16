import fs from "node:fs/promises";
import path from "node:path";
import { loadContractCatalog, matchPageIntent } from "../selection/contracts.mjs";
import { createRuleValidators, validationMessage } from "../selection/validation.mjs";
import { discoverAssetManifestEntries } from "./asset-manifest-inventory.mjs";

const root = path.resolve(process.argv[2] ?? process.cwd());
const readJson = async (target) => JSON.parse(await fs.readFile(target, "utf8"));
const validators = await createRuleValidators(root);
const contracts = await loadContractCatalog(root);
const issues = [];

const purposeVocabulary = await readJson(path.join(root, "catalog", "purpose-vocabulary.json"));
const purposeList = purposeVocabulary.purposes.map((item) => item.key);
if (new Set(purposeList).size !== purposeList.length) issues.push("purposeKey 存在重复");

function validate(label, validator, value) {
  if (!validator(value)) issues.push(`${label}: ${validationMessage(validators.ajv, validator)}`);
}

for (const contract of contracts) {
  validate(contract.assetId, validators.validateAssetContract, contract);
  for (const purposeKey of contract.supportedIntents.purposeKeys) {
    if (!validators.purposeKeys.has(purposeKey)) issues.push(`${contract.assetId}: 未登记 purposeKey=${purposeKey}`);
  }
}

const candidateAssets = await discoverAssetManifestEntries(root, "备选资产");
const coreAssets = await discoverAssetManifestEntries(root, "assets");
const visualVariantCatalog = await readJson(path.join(root, "catalog", "visual-variants.json"));
const structureIds = candidateAssets.filter((entry) => entry.category === "结构图").map((entry) => entry.id);
const selectableAssetIds = [
  ...candidateAssets.map((entry) => entry.id),
  ...coreAssets.map((entry) => entry.id),
];
const contractIds = contracts.map((contract) => contract.assetId);
for (const id of structureIds) if (!contractIds.includes(id)) issues.push(`结构候选缺少契约: ${id}`);
for (const id of contractIds) if (!selectableAssetIds.includes(id)) issues.push(`契约引用未知候选资产: ${id}`);
if (new Set(contractIds).size !== contractIds.length) issues.push("契约 ID 存在重复");

const coreIds = new Set(coreAssets.filter((entry) => entry.status === "core").map((entry) => entry.id));
for (const variant of visualVariantCatalog.variants) {
  if (variant.status !== "core") continue;
  if (!coreIds.has(variant.assetId)) issues.push(`正式变体引用非核心资产: ${variant.builderKey}`);
  if (variant.origin !== "distilled-asset") issues.push(`正式变体缺少蒸馏来源标记: ${variant.builderKey}`);
}

const failureCatalog = await readJson(path.join(root, "catalog", "failure-cases.json"));
for (const failureCase of failureCatalog.cases) {
  validate(`failure:${failureCase.caseId}`, validators.validateFailureCase, failureCase);
}

const fixtureDirectory = path.join(root, "tests", "fixtures");
for (const entry of await fs.readdir(fixtureDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const name = entry.name;
  const value = await readJson(path.join(fixtureDirectory, name));
  if (name.endsWith(".content.json")) validate(name, validators.validatePageContent, value);
  if (name.endsWith(".intent.json")) {
    validate(name, validators.validatePageIntent, value);
    if (!validators.purposeKeys.has(value.purposeKey)) issues.push(`${name}: 未知 purposeKey=${value.purposeKey}`);
    const decision = matchPageIntent(value, contracts);
    validate(`${name}:layout-decision`, validators.validateLayoutDecision, decision);
  }
}

const counts = contracts.reduce((result, item) => {
  result[item.abstractionLevel] = (result[item.abstractionLevel] ?? 0) + 1;
  return result;
}, {});

console.log(JSON.stringify({
  status: issues.length ? "failed" : "passed",
  contractCount: contracts.length,
  purposeCount: validators.purposeKeys.size,
  failureCaseCount: failureCatalog.cases.length,
  counts,
  issues,
}, null, 2));
if (issues.length) process.exitCode = 1;
