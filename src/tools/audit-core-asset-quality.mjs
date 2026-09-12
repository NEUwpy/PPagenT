import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { exportTemplateMappedQa } from "../asset-runtime/template-utils.mjs";
import { auditRenderedDeck } from "./audit-rendered-typography.mjs";
import { MINIMUM_READABLE_FONT_SIZE_PT } from "../runtime/typography-standards.mjs";
import { assertSpatialFit, loadCompositionLayouts } from "../composition/layouts.mjs";
import { northeasternUniversitySkin } from "../runtime/skins/northeastern-university.mjs";
import { discoverAssetManifestEntries } from "./asset-manifest-inventory.mjs";

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

async function sha256(target) {
  return crypto.createHash("sha256").update(await fs.readFile(target)).digest("hex");
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function inspectSpatialContract(metadata, layouts) {
  if (metadata.kind !== "component") return { status: "not-applicable", issues: [] };
  const contract = metadata.spatialContract;
  const issues = [];
  if (!contract) return { status: "failed", issues: ["missing-spatial-contract"] };
  for (const field of ["coordinateSystem", "contentFrame", "minimumFrame", "preferredFrame", "resizeMode", "minFontSize", "safePadding", "supportedCompositionIds"]) {
    if (contract[field] === undefined) issues.push(`missing-${field}`);
  }
  if (!new Set(["natural", "contain", "adaptive"]).has(contract.resizeMode)) {
    issues.push(`unsupported-component-resize-mode:${contract.resizeMode ?? "missing"}`);
  }
  // 旧检查写死在 15，把 32 个合规核心结构全部误判违规；下限以 typography-standards.mjs 为准。
  if (contract.minFontSize < MINIMUM_READABLE_FONT_SIZE_PT) issues.push("minimum-font-size-below-minimum");
  if (contract.resizeMode === "adaptive") {
    if (metadata.runtime?.contract?.adaptationStatus !== "verified") {
      issues.push("adaptive-component-not-verified");
    }
    if (!Number.isFinite(contract.adaptiveMinimumFrame?.width)
      || !Number.isFinite(contract.adaptiveMinimumFrame?.height)) {
      issues.push("missing-adaptive-minimum-frame");
    }
    if (!metadata.runtime?.spatialResolverExport) issues.push("missing-spatial-resolver-export");
  }
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
        assertSpatialFit(metadata, layout, northeasternUniversitySkin.bodyFrame, {
          itemCount: metadata.runtime?.itemCount?.preferred?.[0] ?? metadata.runtime?.itemCount?.min ?? null,
        });
      } catch (error) {
        issues.push(`spatial-fit:${compositionId}:${error.message}`);
      }
    }
  }
  return { status: issues.length ? "failed" : "passed", issues };
}

async function inspectAsset(root, entry, tempRoot, runtimeSha256, layouts) {
  const directory = entry.directory;
  const metadataPath = path.join(directory, "asset.json");
  const examplePath = path.join(directory, "example.pptx");
  const generatorPath = path.join(directory, "generate.mjs");
  const metadata = await readJson(metadataPath);
  // 资产缺 example.pptx / generate.mjs 也是一条 issue，不是进程级失败。旧实现直接
  // 让 FileBlob.load / sha256 抛出，整个审计会在第一个缺文件的资产上崩掉，
  // 后面所有资产的结果一起丢失（assets/结构图/反方质疑回应论证-003 即可复现）。
  const missingArtifacts = [];
  for (const [label, target] of [["example.pptx", examplePath], ["generate.mjs", generatorPath]]) {
    if (!(await exists(target))) missingArtifacts.push(`missing-${label}`);
  }
  if (missingArtifacts.length) {
    // status 是 "not-auditable" 而不是 "passed" 也不是 "failed"：这类资产没有被审过，
    // 记成 passed 是假通过，记成 failed 是把"没有可审的产物"和"审出问题"混为一谈。
    // 它仍然逐条出现在报告里并计入 counts.notAuditable，不是被过滤掉。
    return {
      id: entry.id,
      status: "not-auditable",
      kind: metadata.kind,
      metadataSha256: await sha256(metadataPath),
      exampleSha256: null,
      generatorSha256: null,
      runtimeSha256,
      issues: missingArtifacts,
      spatialContractAudit: { status: "skipped", issues: [] },
      audit: { status: "skipped", minimumFontSize: null, violations: [] },
    };
  }
  const presentation = await PresentationFile.importPptx(await FileBlob.load(examplePath));
  const qaDir = path.join(tempRoot, entry.id);
  await exportTemplateMappedQa(presentation, qaDir);
  const audit = await auditRenderedDeck(qaDir, {
    minimumFontSize: MINIMUM_READABLE_FONT_SIZE_PT,
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
  // 注意范围：discoverAssetManifestEntries() 返回 assets/ 下全部清单（此刻 93 份，
  // 含待审/撤回/替代），不是"core"。工具名与 npm 脚本名里的 core 只是历史命名，
  // 这里保持全量遍历而不是悄悄改成只审 core——那会让另外 54 份无声消失。
  const libraryEntries = await discoverAssetManifestEntries(resolvedRoot, "assets");
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
    for (const entry of libraryEntries) {
      assets.push(await inspectAsset(resolvedRoot, entry, tempRoot, runtimeSha256, layouts));
    }
    const notAuditable = assets.filter((asset) => asset.status === "not-auditable");
    const report = {
      schemaVersion: 1,
      // 总状态只对"真的被审过"的资产下结论。缺 example.pptx 的资产没有结论，
      // 既不算通过也不算失败；数量与 id 都在 counts.notAuditable 与 assets 里，
      // 不靠缩小遍历范围来让总状态变绿。
      status: assets.every((asset) => asset.status === "passed" || asset.status === "not-auditable") ? "passed" : "failed",
      counts: {
        total: assets.length,
        passed: assets.filter((asset) => asset.status === "passed").length,
        failed: assets.filter((asset) => asset.status === "failed").length,
        notAuditable: notAuditable.length,
      },
      minimumFontSize: MINIMUM_READABLE_FONT_SIZE_PT,
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
