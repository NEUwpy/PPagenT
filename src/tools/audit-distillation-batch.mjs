import fs from "node:fs/promises";
import path from "node:path";
import { auditRenderedGeometry, auditRenderedTypography } from "./audit-rendered-typography.mjs";

function parseArgs(argv) {
  const options = { root: ".", manifest: "workbench/distillation/validation-batches.json", batch: null, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") options.root = argv[++index];
    else if (arg === "--manifest") options.manifest = argv[++index];
    else if (arg === "--batch") options.batch = argv[++index];
    else if (arg === "--write") options.write = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function requireMetadata(metadata, assetId, issues) {
  if (!metadata.source?.file || !Array.isArray(metadata.source?.slides) || metadata.source.slides.length === 0) {
    issues.push({ assetId, type: "missing-source", message: "缺少可追溯的来源文件或页码" });
  }
  if (!metadata.semanticContract) issues.push({ assetId, type: "missing-semantic-contract", message: "缺少语义适用契约" });
  if (!metadata.doNotUseWhen) issues.push({ assetId, type: "missing-negative-boundary", message: "缺少不适用条件" });
  if (!metadata.adaptation) issues.push({ assetId, type: "missing-adaptation", message: "缺少数量或容量适配规则" });
  if (!metadata.generator || !metadata.showcase) issues.push({ assetId, type: "missing-artifact-link", message: "缺少生成器或案例文件对应关系" });
}

const options = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root);
const manifest = await readJson(path.resolve(root, options.manifest));
const registry = await readJson(path.join(root, "备选资产", "registry.json"));
const registryById = new Map(registry.assets.map((asset) => [asset.id, asset]));
const selected = options.batch
  ? manifest.batches.filter((batch) => batch.id === options.batch)
  : manifest.batches;
if (!selected.length) throw new Error(`unknown batch: ${options.batch}`);

const batchReports = [];
for (const batch of selected) {
  const issues = [];
  for (const assetId of batch.assetIds) {
    const entry = registryById.get(assetId);
    if (!entry) {
      issues.push({ assetId, type: "missing-registry-entry", message: "备选资产注册表中不存在" });
      continue;
    }
    const assetDir = path.join(root, "备选资产", entry.path);
    const metadataFile = path.join(assetDir, "asset.json");
    if (!await exists(metadataFile)) {
      issues.push({ assetId, type: "missing-metadata", message: "缺少 asset.json" });
      continue;
    }
    const metadata = await readJson(metadataFile);
    requireMetadata(metadata, assetId, issues);
    if (metadata.source?.file && !await exists(path.join(root, metadata.source.file))) {
      issues.push({ assetId, type: "missing-source-file", message: metadata.source.file });
    }
    for (const linked of [metadata.generator, metadata.showcase].filter(Boolean)) {
      if (!await exists(path.join(assetDir, linked))) {
        issues.push({ assetId, type: "missing-linked-file", message: linked });
      }
    }
  }

  const deckPath = path.join(root, batch.stressDeck);
  const qaDir = path.join(root, batch.qaDir);
  if (!await exists(deckPath)) issues.push({ type: "missing-stress-deck", message: batch.stressDeck });
  if (!await exists(qaDir)) issues.push({ type: "missing-qa-directory", message: batch.qaDir });

  let typography = { status: "not-run", violations: [] };
  let geometry = { status: "not-run", violations: [] };
  let evidence = { pngCount: 0, layoutCount: 0, expectedSlides: batch.expectedSlides };
  if (await exists(qaDir)) {
    const files = await fs.readdir(qaDir);
    evidence = {
      pngCount: files.filter((file) => /^slide-\d+\.png$/u.test(file)).length,
      layoutCount: files.filter((file) => /^slide-\d+\.layout\.json$/u.test(file)).length,
      expectedSlides: batch.expectedSlides,
    };
    if (evidence.pngCount !== batch.expectedSlides || evidence.layoutCount !== batch.expectedSlides) {
      issues.push({ type: "incomplete-render-evidence", message: evidence });
    }
    typography = await auditRenderedTypography(qaDir, { minimumFontSize: batch.minimumFontSize });
    geometry = await auditRenderedGeometry(qaDir, { tolerance: batch.geometryTolerance });
    if (typography.status !== "passed") issues.push({ type: "typography-failed", message: typography.violations });
    if (geometry.status !== "passed") issues.push({ type: "geometry-failed", message: geometry.violations });
  }

  const report = {
    schemaVersion: 1,
    methodVersion: manifest.methodVersion,
    batchId: batch.id,
    status: issues.length ? "failed" : "passed",
    assetIds: batch.assetIds,
    stressDeck: batch.stressDeck,
    evidence,
    typography,
    geometry,
    issues,
  };
  batchReports.push(report);
  if (options.write) {
    const reportPath = path.join(root, batch.report);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
}

const result = {
  status: batchReports.every((report) => report.status === "passed") ? "passed" : "failed",
  methodVersion: manifest.methodVersion,
  batches: batchReports,
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exitCode = 1;
