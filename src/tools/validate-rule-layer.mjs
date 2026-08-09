import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { loadContractCatalog } from "../selection/contracts.mjs";

const root = path.resolve(process.argv[2] ?? process.cwd());
const readJson = async (target) => JSON.parse(await fs.readFile(target, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });

const pageIntentSchema = await readJson(path.join(root, "schemas", "page-intent.schema.json"));
const assetContractSchema = await readJson(path.join(root, "schemas", "asset-contract.schema.json"));
const validateIntent = ajv.compile(pageIntentSchema);
const validateContract = ajv.compile(assetContractSchema);
const contracts = await loadContractCatalog(root);
const issues = [];

for (const contract of contracts) {
  if (!validateContract(contract)) {
    issues.push(`${contract.assetId}: ${ajv.errorsText(validateContract.errors)}`);
  }
}

const structureRegistry = await readJson(path.join(root, "备选资产", "registry.json"));
const structureIds = structureRegistry.assets
  .filter((entry) => entry.category === "结构图")
  .map((entry) => entry.id);
const contractIds = contracts.map((contract) => contract.assetId);
for (const id of structureIds) if (!contractIds.includes(id)) issues.push(`结构候选缺少契约: ${id}`);
for (const id of contractIds) if (!structureIds.includes(id)) issues.push(`契约引用未知结构候选: ${id}`);
if (new Set(contractIds).size !== contractIds.length) issues.push("契约 ID 存在重复");

const fixtureDirectory = path.join(root, "tests", "fixtures");
for (const name of await fs.readdir(fixtureDirectory)) {
  if (!name.endsWith(".intent.json")) continue;
  const intent = await readJson(path.join(fixtureDirectory, name));
  if (!validateIntent(intent)) issues.push(`${name}: ${ajv.errorsText(validateIntent.errors)}`);
}

const counts = Object.groupBy
  ? Object.fromEntries(Object.entries(Object.groupBy(contracts, (item) => item.abstractionLevel)).map(([key, value]) => [key, value.length]))
  : contracts.reduce((result, item) => ({ ...result, [item.abstractionLevel]: (result[item.abstractionLevel] ?? 0) + 1 }), {});

console.log(JSON.stringify({
  status: issues.length ? "failed" : "passed",
  contractCount: contracts.length,
  counts,
  issues,
}, null, 2));
if (issues.length) process.exitCode = 1;
