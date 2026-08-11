import fs from "node:fs/promises";
import path from "node:path";
import { createFreshRunDirectory, sha256File } from "./artifacts.mjs";
import { digestJson, inspectCaseManifest } from "./contracts.mjs";
import { buildRequiredInputArtifacts, verifyArtifactSummaries } from "./freshness.mjs";
import { runPairedDistillation, writeValidationReport } from "./paired-run.mjs";
import { buildReviewPack } from "./review-pack.mjs";

const CONTEXTS = ["standalone", "skin"];
const INPUT_CONFIG_FIELDS = [
  "assetMetadataPath",
  "sourcePptxPath",
  "skinSourcePath",
  "lockfilePath",
  "auditorPath",
  "builderEntryPath",
];

export class DistillationOrchestrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DistillationOrchestrationError";
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(code, message, details) {
  throw new DistillationOrchestrationError(code, message, details);
}

function posix(value) {
  return value.replaceAll(path.sep, "/");
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertInputConfig(inputConfig) {
  if (!inputConfig || typeof inputConfig !== "object" || Array.isArray(inputConfig)) {
    fail("ORCHESTRATOR_INPUT_CONFIG_INVALID", "inputConfig must be an object");
  }
  const unknown = Object.keys(inputConfig).filter((key) => !INPUT_CONFIG_FIELDS.includes(key));
  if (unknown.length) fail("ORCHESTRATOR_INPUT_CONFIG_UNKNOWN", `unknown input config fields: ${unknown.join(", ")}`);
  const missing = INPUT_CONFIG_FIELDS.filter((key) => typeof inputConfig[key] !== "string" || inputConfig[key].length === 0);
  if (missing.length) fail("ORCHESTRATOR_INPUT_CONFIG_MISSING", `missing input config fields: ${missing.join(", ")}`);
}

function repositoryRelative(repoRoot, target, code = "ORCHESTRATOR_PATH_ESCAPE") {
  const absolute = path.isAbsolute(target) ? path.resolve(target) : path.resolve(repoRoot, target);
  if (!isInside(repoRoot, absolute)) fail(code, `path must stay inside repository: ${target}`, { path: target });
  return { absolute, relative: posix(path.relative(repoRoot, absolute)) };
}

function runOutputPath(repoRoot, runDir, target, code = "ORCHESTRATOR_OUTPUT_ESCAPE") {
  const resolved = repositoryRelative(repoRoot, target, code);
  if (!isInside(runDir, resolved.absolute)) fail(code, `output must stay inside the exclusive run directory: ${target}`, { path: target });
  return resolved;
}

async function artifactFor(repoRoot, runDir, target, role, { expectedParent } = {}) {
  const resolved = runOutputPath(repoRoot, runDir, target);
  let stat;
  try {
    stat = await fs.stat(resolved.absolute);
  } catch (error) {
    if (error?.code === "ENOENT") fail("ORCHESTRATOR_OUTPUT_MISSING", `output file is missing: ${target}`, { path: target });
    throw error;
  }
  if (!stat.isFile()) fail("ORCHESTRATOR_OUTPUT_NOT_FILE", `output is not a file: ${target}`, { path: target });
  const realRunDir = await fs.realpath(runDir);
  const realTarget = await fs.realpath(resolved.absolute);
  if (!isInside(realRunDir, realTarget)) {
    fail("ORCHESTRATOR_OUTPUT_REALPATH_ESCAPE", `output resolves outside the run directory: ${target}`, { path: target });
  }
  if (expectedParent) {
    const lexicalParent = runOutputPath(repoRoot, runDir, expectedParent).absolute;
    let parentStat;
    try {
      parentStat = await fs.stat(lexicalParent);
    } catch (error) {
      if (error?.code === "ENOENT") fail("ORCHESTRATOR_QA_DIR_MISSING", `QA directory is missing: ${expectedParent}`);
      throw error;
    }
    if (!parentStat.isDirectory()) fail("ORCHESTRATOR_QA_DIR_INVALID", `QA path is not a directory: ${expectedParent}`);
    const realParent = await fs.realpath(lexicalParent);
    if (!isInside(realRunDir, realParent) || !isInside(realParent, realTarget)) {
      fail("ORCHESTRATOR_OUTPUT_QA_ESCAPE", `evidence is not inside its context QA directory: ${target}`, { path: target });
    }
  }
  return {
    role,
    path: posix(path.relative(repoRoot, realTarget)),
    ...await sha256File(realTarget),
  };
}

function exactCaseMap(manifest, results, context) {
  if (!Array.isArray(results) || results.length !== manifest.cases.length) {
    fail("ORCHESTRATOR_RESULT_SET_INCOMPLETE", `${context} must return exactly one result per case`);
  }
  const map = new Map();
  for (const item of results) {
    if (!item || typeof item.caseId !== "string" || map.has(item.caseId)) {
      fail("ORCHESTRATOR_RESULT_CASE_INVALID", `${context} contains a missing or duplicate caseId`);
    }
    map.set(item.caseId, item);
  }
  for (const item of manifest.cases) {
    if (!map.has(item.caseId)) fail("ORCHESTRATOR_RESULT_CASE_MISSING", `${context} is missing ${item.caseId}`);
  }
  for (const caseId of map.keys()) {
    if (!manifest.cases.some((item) => item.caseId === caseId)) {
      fail("ORCHESTRATOR_RESULT_CASE_UNKNOWN", `${context} returned unknown case ${caseId}`);
    }
  }
  return map;
}

function outputArtifactsFromReport(report) {
  const byPath = new Map();
  for (const item of report.cases) {
    for (const context of CONTEXTS) {
      const evidence = item.contexts[context].evidence;
      if (!evidence) continue;
      for (const artifact of [evidence.deck, evidence.png, evidence.layout]) {
        if (!byPath.has(artifact.path)) byPath.set(artifact.path, artifact);
      }
    }
  }
  return [...byPath.values()].map((artifact, index) => ({
    ...artifact,
    role: `run-output-${String(index + 1).padStart(3, "0")}`,
  }));
}

async function writeExclusive(target, value) {
  await fs.writeFile(target, value, { encoding: "utf8", flag: "wx" });
}

/**
 * 唯一资产试运行入口：独占目录、固定输入、双上下文批量渲染、磁盘复算、验收包。
 * 正式用户批准不在这里发生；本函数最多产出“内部通过、等待外部 review-state”。
 */
export async function runDistillationOrchestration({
  repoRoot = process.cwd(),
  allowedRunsRoot,
  runId,
  manifest,
  validators,
  inputConfig,
  renderContextBatch,
  buildReviewMaterials,
}) {
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(runId ?? "")) fail("ORCHESTRATOR_RUN_ID_INVALID", "runId is invalid");
  const manifestInspection = inspectCaseManifest(manifest, validators);
  if (manifestInspection.status !== "passed") {
    fail("ORCHESTRATOR_MANIFEST_INVALID", "manifest failed schema or semantic validation", {
      issues: manifestInspection.issues,
    });
  }
  if (manifest.assets.length !== 1) fail("ORCHESTRATOR_MULTI_ASSET_UNSUPPORTED", "v2 orchestration currently owns exactly one asset per run");
  if (typeof renderContextBatch !== "function" || typeof buildReviewMaterials !== "function") {
    fail("ORCHESTRATOR_CALLBACK_REQUIRED", "renderContextBatch and buildReviewMaterials are required");
  }
  assertInputConfig(inputConfig);

  const realRepoRoot = await fs.realpath(path.resolve(repoRoot));
  const lexicalRunsRoot = repositoryRelative(realRepoRoot, allowedRunsRoot, "ORCHESTRATOR_RUNS_ROOT_ESCAPE").absolute;
  const runsRoot = await fs.realpath(lexicalRunsRoot);
  if (!isInside(realRepoRoot, runsRoot)) {
    fail("ORCHESTRATOR_RUNS_ROOT_ESCAPE", "allowedRunsRoot resolves outside the repository");
  }
  const runDir = path.join(runsRoot, runId);
  const reservationDir = path.join(runsRoot, ".run-ids");
  await fs.mkdir(reservationDir, { recursive: true });
  const reservationPath = path.join(reservationDir, `${runId}.json`);
  try {
    await writeExclusive(reservationPath, `${JSON.stringify({
      schemaVersion: "1.0",
      runId,
      reservedAt: new Date().toISOString(),
    }, null, 2)}\n`);
  } catch (error) {
    if (error?.code === "EEXIST") {
      fail("ORCHESTRATOR_RUN_ID_ALREADY_RESERVED", `runId has already been used: ${runId}`);
    }
    throw error;
  }
  await createFreshRunDirectory({ allowedRoot: runsRoot, runDir });

  const runRelative = posix(path.relative(realRepoRoot, runDir));
  const expectedPrefix = `${runRelative}/`;
  const requiredManifestOutputs = [
    manifest.contexts.standalone.deck,
    manifest.contexts.standalone.qaDir,
    manifest.contexts.skin.deck,
    manifest.contexts.skin.qaDir,
    manifest.reviewPackage?.index,
    manifest.reviewPackage?.montage,
  ];
  const manifestOutputTargets = new Set();
  for (const target of requiredManifestOutputs) {
    if (typeof target !== "string" || !target.replaceAll("\\", "/").startsWith(expectedPrefix)) {
      fail("ORCHESTRATOR_MANIFEST_OUTPUT_OUTSIDE_RUN", `manifest output is not owned by run ${runId}: ${target}`);
    }
    const resolved = runOutputPath(realRepoRoot, runDir, target).absolute;
    if (manifestOutputTargets.has(resolved)) {
      fail("ORCHESTRATOR_MANIFEST_OUTPUT_COLLISION", `manifest output path is reused: ${target}`);
    }
    manifestOutputTargets.add(resolved);
  }

  const manifestPath = path.join(runDir, "case-manifest.json");
  await writeExclusive(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const validationReportPath = path.join(runDir, "validation-report.json");
  const inputs = await buildRequiredInputArtifacts({
    repoRoot: realRepoRoot,
    caseManifestPath: posix(path.relative(realRepoRoot, manifestPath)),
    validationReportPath: posix(path.relative(realRepoRoot, validationReportPath)),
    ...inputConfig,
  });
  const inputDigest = digestJson(inputs);

  const batches = {};
  const deckPaths = new Set();
  const caseEvidencePaths = new Set();
  const qaRealPaths = new Set();
  for (const context of CONTEXTS) {
    const result = await renderContextBatch({
      context,
      contextSpec: structuredClone(manifest.contexts[context]),
      cases: structuredClone(manifest.cases),
      runDir,
      runId,
    });
    if (!result || result.deckPath !== manifest.contexts[context].deck) {
      fail("ORCHESTRATOR_DECK_PATH_MISMATCH", `${context} renderer returned the wrong deck path`);
    }
    const deck = await artifactFor(realRepoRoot, runDir, result.deckPath, `${context}-deck`);
    if (deckPaths.has(deck.path)) fail("ORCHESTRATOR_CONTEXT_DECK_REUSED", "standalone and Skin decks must be different files");
    deckPaths.add(deck.path);
    const qaLexical = runOutputPath(realRepoRoot, runDir, manifest.contexts[context].qaDir).absolute;
    let qaStat;
    try {
      qaStat = await fs.stat(qaLexical);
    } catch (error) {
      if (error?.code === "ENOENT") fail("ORCHESTRATOR_QA_DIR_MISSING", `${context} QA directory is missing`);
      throw error;
    }
    if (!qaStat.isDirectory()) fail("ORCHESTRATOR_QA_DIR_INVALID", `${context} QA path is not a directory`);
    const realQaDir = await fs.realpath(qaLexical);
    const realRunDir = await fs.realpath(runDir);
    if (!isInside(realRunDir, realQaDir)) fail("ORCHESTRATOR_QA_DIR_REALPATH_ESCAPE", `${context} QA directory resolves outside runDir`);
    if (qaRealPaths.has(realQaDir)) fail("ORCHESTRATOR_CONTEXT_QA_REUSED", "standalone and Skin QA directories must be different");
    qaRealPaths.add(realQaDir);
    const resultMap = exactCaseMap(manifest, result.results, context);
    const contexts = new Map();
    for (const manifestCase of manifest.cases) {
      const item = resultMap.get(manifestCase.caseId);
      if (item.outcome === "rejection") {
        contexts.set(manifestCase.caseId, { outcome: "rejection", errorCode: item.errorCode });
        continue;
      }
      if (item.outcome !== "render") fail("ORCHESTRATOR_RESULT_OUTCOME_INVALID", `${context}/${manifestCase.caseId} has no valid outcome`);
      const png = await artifactFor(realRepoRoot, runDir, item.pngPath, `${context}-${manifestCase.caseId}-png`, {
        expectedParent: manifest.contexts[context].qaDir,
      });
      const layout = await artifactFor(realRepoRoot, runDir, item.layoutPath, `${context}-${manifestCase.caseId}-layout`, {
        expectedParent: manifest.contexts[context].qaDir,
      });
      for (const evidence of [png, layout]) {
        if (deckPaths.has(evidence.path) || caseEvidencePaths.has(evidence.path)) {
          fail("ORCHESTRATOR_CASE_EVIDENCE_REUSED", `case evidence file is reused: ${evidence.path}`, {
            context,
            caseId: manifestCase.caseId,
          });
        }
        caseEvidencePaths.add(evidence.path);
      }
      contexts.set(manifestCase.caseId, {
        outcome: "render",
        slideNumber: item.slideNumber,
        evidence: { deck, png, layout, checksPassed: item.checksPassed === true },
      });
    }
    batches[context] = { deck, contexts };
  }

  const paired = await runPairedDistillation({
    manifest,
    validators,
    inputs,
    artifacts: [batches.standalone.deck, batches.skin.deck],
    executeContext: async ({ context, caseId }) => structuredClone(batches[context].contexts.get(caseId)),
  });
  await writeValidationReport(paired.report, validationReportPath);
  if (paired.inspection.status !== "passed") {
    fail("ORCHESTRATOR_VALIDATION_FAILED", "paired validation failed", { issues: paired.inspection.issues });
  }

  await verifyArtifactSummaries(inputs, {
    repoRoot: realRepoRoot,
    forbiddenPaths: [validationReportPath],
  });
  await verifyArtifactSummaries(outputArtifactsFromReport(paired.report), {
    repoRoot: realRepoRoot,
    forbiddenPaths: [validationReportPath],
  });

  const reportArtifact = await artifactFor(
    realRepoRoot,
    runDir,
    posix(path.relative(realRepoRoot, validationReportPath)),
    "run-validation-report",
  );
  const materials = await buildReviewMaterials({
    runDir,
    runId,
    manifest: structuredClone(manifest),
    validationReport: structuredClone(paired.report),
  });
  if (materials.pairedOverviewPath !== manifest.reviewPackage.montage) {
    fail("ORCHESTRATOR_OVERVIEW_PATH_MISMATCH", "paired overview does not match manifest.reviewPackage.montage");
  }
  const pairedOverview = await artifactFor(realRepoRoot, runDir, materials.pairedOverviewPath, "paired-overview");
  const aesthetics = [];
  for (const item of materials.aesthetics ?? []) {
    aesthetics.push({
      assetId: item.assetId,
      artifact: await artifactFor(realRepoRoot, runDir, item.path, `aesthetics-${item.assetId}`),
    });
  }
  await verifyArtifactSummaries([pairedOverview, ...aesthetics.map((item) => item.artifact)], {
    repoRoot: realRepoRoot,
    forbiddenPaths: [validationReportPath],
  });
  // Review-material generation is executable code. Recheck fixed inputs and rendered
  // evidence after it returns so a late mutation cannot reuse an earlier freshness pass.
  await verifyArtifactSummaries(inputs, {
    repoRoot: realRepoRoot,
    forbiddenPaths: [validationReportPath],
  });
  await verifyArtifactSummaries(outputArtifactsFromReport(paired.report), {
    repoRoot: realRepoRoot,
    forbiddenPaths: [validationReportPath],
  });
  await verifyArtifactSummaries([reportArtifact], { repoRoot: realRepoRoot });

  const sourceArtifact = inputs.find((item) => item.role === "source-pptx");
  const reportDigest = digestJson(paired.report);
  const pack = buildReviewPack({
    manifest,
    validationReport: paired.report,
    validators,
    freshness: { status: "passed", runId, reportDigest, inputDigest },
    bindings: {
      decks: { standalone: batches.standalone.deck, skin: batches.skin.deck },
      validationReport: reportArtifact,
      pairedOverview,
      sources: manifest.assets.map((asset) => ({
        assetId: asset.assetId,
        artifact: sourceArtifact,
        pages: asset.source.slides,
      })),
      aesthetics,
      maintainerCases: materials.maintainerCases,
    },
  });

  const indexTarget = runOutputPath(realRepoRoot, runDir, manifest.reviewPackage.index).absolute;
  const markdownTarget = path.join(runDir, "用户验收.md");
  await writeExclusive(indexTarget, `${JSON.stringify(pack.index, null, 2)}\n`);
  await writeExclusive(markdownTarget, pack.markdown);
  return {
    status: "awaiting-user-review",
    runId,
    runDir,
    report: paired.report,
    reportDigest,
    inputDigest,
    packContentDigest: pack.index.packContentDigest,
    reviewIndex: indexTarget,
    reviewMarkdown: markdownTarget,
  };
}
