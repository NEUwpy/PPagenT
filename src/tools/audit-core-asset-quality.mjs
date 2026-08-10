import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { exportTemplateMappedQa } from "../asset-runtime/template-utils.mjs";
import { auditRenderedDeck } from "./audit-rendered-typography.mjs";
import { assertSpatialFit, loadCompositionLayouts } from "../composition/layouts.mjs";
import { northeasternUniversitySkin } from "../runtime/skins/northeastern-university.mjs";

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

async function sha256(target) {
  return crypto.createHash("sha256").update(await fs.readFile(target)).digest("hex");
}

function inspectSpatialContract(metadata, layouts) {
  if (metadata.kind !== "component") return { status: "not-applicable", issues: [] };
  const contract = metadata.spatialContract;
  const issues = [];
  if (!contract) return { status: "failed", issues: ["missing-spatial-contract"] };
  for (const field of ["coordinateSystem", "contentFrame", "minimumFrame", "preferredFrame", "resizeMode", "minFontSize", "safePadding", "supportedCompositionIds"]) {
    if (contract[field] === undefined) issues.push(`missing-${field}`);
  }
  if (contract.resizeMode !== "contain") issues.push("component-resize-mode-must-be-contain");
  if (contract.minFontSize < 16) issues.push("minimum-font-size-below-16");
  if (!Array.isArray(contract.supportedCompositionIds) || !contract.supportedCompositionIds.length) {
    issues.push("missing-supported-compositions");
  } else {
    for (const compositionId of contract.supportedCompositionIds) {
      const layout = layouts.get(compositionId);
      if (!layout) {
        issues.push(`unknown-composition:${compositionId}`);
        continue;
      }
      try {
        assertSpatialFit(metadata, layout, northeasternUniversitySkin.bodyFrame);
      } catch (error) {
        issues.push(`spatial-fit:${compositionId}:${error.message}`);
      }
    }
  }
  return { status: issues.length ? "failed" : "passed", issues };
}

async function inspectAsset(root, entry, tempRoot, runtimeSha256, layouts) {
  const directory = path.join(root, "assets", entry.path);
  const metadataPath = path.join(directory, "asset.json");
  const examplePath = path.join(directory, "example.pptx");
  const generatorPath = path.join(directory, "generate.mjs");
  const metadata = await readJson(metadataPath);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(examplePath));
  const qaDir = path.join(tempRoot, entry.id);
  await exportTemplateMappedQa(presentation, qaDir);
  const audit = await auditRenderedDeck(qaDir, {
    minimumFontSize: 16,
    tolerance: 0.5,
    requireQaParents: metadata.kind === "component",
  });
  const spatialContractAudit = inspectSpatialContract(metadata, layouts);
  return {
    id: entry.id,
    status: audit.status === "passed" && spatialContractAudit.status !== "failed" ? "passed" : "failed",
    kind: metadata.kind,
    metadataSha256: await sha256(metadataPath),
    exampleSha256: await sha256(examplePath),
    generatorSha256: await sha256(generatorPath),
    runtimeSha256,
    spatialContractAudit,
    audit,
  };
}

export async function auditCoreAssetQuality(root, { writeReport = false } = {}) {
  const resolvedRoot = path.resolve(root);
  const registry = await readJson(path.join(resolvedRoot, "assets", "registry.json"));
  const runtimePath = path.join(resolvedRoot, "src", "asset-runtime", "component-builders.mjs");
  const auditorPath = path.join(resolvedRoot, "src", "tools", "audit-rendered-typography.mjs");
  const compositionCatalogPath = path.join(resolvedRoot, "catalog", "composition-layouts.json");
  const compositionRuntimePath = path.join(resolvedRoot, "src", "render", "page-composition.mjs");
  const runtimeSha256 = await sha256(runtimePath);
  const auditorSha256 = await sha256(auditorPath);
  const compositionCatalogSha256 = await sha256(compositionCatalogPath);
  const compositionRuntimeSha256 = await sha256(compositionRuntimePath);
  const layouts = await loadCompositionLayouts(resolvedRoot);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-core-qa-"));
  try {
    const assets = [];
    for (const entry of registry.assets) {
      assets.push(await inspectAsset(resolvedRoot, entry, tempRoot, runtimeSha256, layouts));
    }
    const report = {
      schemaVersion: 1,
      status: assets.every((asset) => asset.status === "passed") ? "passed" : "failed",
      minimumFontSize: 16,
      geometryTolerance: 0.5,
      runtimePath: "src/asset-runtime/component-builders.mjs",
      runtimeSha256,
      auditorPath: "src/tools/audit-rendered-typography.mjs",
      auditorSha256,
      compositionCatalogPath: "catalog/composition-layouts.json",
      compositionCatalogSha256,
      compositionRuntimePath: "src/render/page-composition.mjs",
      compositionRuntimeSha256,
      assets,
    };
    if (writeReport) {
      await fs.writeFile(
        path.join(resolvedRoot, "assets", "quality-report.json"),
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8",
      );
    }
    return report;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const report = await auditCoreAssetQuality(root, { writeReport: process.argv.includes("--write-report") });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "passed") process.exitCode = 1;
}
