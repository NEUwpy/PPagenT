import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const candidates = await readJson(path.join(root, "备选资产", "registry.json"));
const core = await readJson(path.join(root, "assets", "registry.json"));
const batches = await readJson(path.join(root, "workbench", "distillation", "validation-batches.json"));
const standaloneValidatedIds = new Set(
  batches.batches
    .filter((batch) => batch.validationContext === "standalone")
    .flatMap((batch) => batch.assetIds),
);
const skinValidatedIds = new Set(
  batches.batches
    .filter((batch) => batch.validationContext === "skin")
    .flatMap((batch) => batch.assetIds),
);
const coreIds = new Set(core.assets.map((asset) => asset.id));

const assets = [];
for (const entry of candidates.assets.filter((asset) => asset.category === "结构图")) {
  const metadata = await readJson(path.join(root, "备选资产", entry.path, "asset.json"));
  const missingFields = [];
  if (!metadata.source?.file || !metadata.source?.slides?.length) missingFields.push("source");
  if (!metadata.semanticContract) missingFields.push("semanticContract");
  if (!metadata.doNotUseWhen) missingFields.push("doNotUseWhen");
  if (!metadata.adaptation) missingFields.push("adaptation");
  const governanceStatus = skinValidatedIds.has(entry.id)
    ? "skin-validated-candidate"
    : standaloneValidatedIds.has(entry.id)
      ? "standalone-validated-needs-skin"
    : coreIds.has(entry.id)
      ? "core-needs-method-recheck"
      : "legacy-needs-rebuild-or-retire";
  assets.push({
    id: entry.id,
    name: entry.name,
    governanceStatus,
    missingFields,
    source: metadata.source,
    capacity: metadata.capacity,
  });
}

const countByStatus = Object.fromEntries(
  [...new Set(assets.map((asset) => asset.governanceStatus))]
    .map((status) => [status, assets.filter((asset) => asset.governanceStatus === status).length]),
);
const report = {
  schemaVersion: 1,
  methodVersion: batches.methodVersion,
  status: "passed",
  structureCandidateCount: assets.length,
  countByStatus,
  assets,
};
const output = path.join(root, "workbench", "distillation", "candidate-governance.json");
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...report }, null, 2));
