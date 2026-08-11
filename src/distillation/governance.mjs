import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalJson,
  digestJson,
  inspectDistillationRun,
} from "./contracts.mjs";
import { verifyArtifactSummaries } from "./freshness.mjs";
import { buildReviewPackIndex, renderReviewPackMarkdown } from "./review-pack.mjs";

export class DistillationGovernanceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DistillationGovernanceError";
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(code, message, details) {
  throw new DistillationGovernanceError(code, message, details);
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function readJson(target, code) {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") fail(code, `missing governance file: ${target}`);
    if (error instanceof SyntaxError) fail("GOVERNANCE_JSON_INVALID", `invalid JSON: ${target}`);
    throw error;
  }
}

async function resolveRun(repoRoot, runDir) {
  const root = await fs.realpath(path.resolve(repoRoot));
  const lexical = path.isAbsolute(runDir) ? path.resolve(runDir) : path.resolve(root, runDir);
  const real = await fs.realpath(lexical);
  if (!isInside(root, real)) fail("GOVERNANCE_RUN_DIR_ESCAPE", "runDir must resolve inside the repository");
  return { root, runDir: real };
}

async function assertArtifactsInsideRun(artifacts, root, runDir) {
  for (const artifact of artifacts) {
    const lexical = path.resolve(root, artifact.path);
    const real = await fs.realpath(lexical);
    if (!isInside(runDir, real)) {
      fail("GOVERNANCE_OUTPUT_ESCAPE", `run output resolves outside runDir: ${artifact.path}`);
    }
  }
}

function reportOutputs(report) {
  const artifacts = [];
  const paths = new Set();
  const decks = new Map();
  for (const item of report.cases) {
    for (const context of ["standalone", "skin"]) {
      const evidence = item.contexts[context].evidence;
      if (!evidence) continue;
      const knownDeck = decks.get(context);
      if (knownDeck && canonicalJson(knownDeck) !== canonicalJson(evidence.deck)) {
        fail("GOVERNANCE_CONTEXT_DECK_INCONSISTENT", `${context} cases do not share one bound deck`);
      }
      decks.set(context, evidence.deck);
      for (const [kind, artifact] of [["png", evidence.png], ["layout", evidence.layout]]) {
        if (paths.has(artifact.path)) fail("GOVERNANCE_CASE_EVIDENCE_REUSED", `case evidence is reused: ${artifact.path}`);
        paths.add(artifact.path);
        artifacts.push({ ...artifact, role: `${context}-${item.caseId}-${kind}` });
      }
    }
  }
  for (const [context, artifact] of decks) {
    if (paths.has(artifact.path)) fail("GOVERNANCE_DECK_EVIDENCE_COLLISION", `${context} deck collides with case evidence`);
    paths.add(artifact.path);
    artifacts.push({ ...artifact, role: `${context}-deck` });
  }
  if (decks.size !== 2 || decks.get("standalone").path === decks.get("skin").path) {
    fail("GOVERNANCE_CONTEXT_DECK_REUSED", "standalone and Skin require two distinct decks");
  }
  return artifacts;
}

function maintainerCases(index) {
  return [...index.cases, ...index.rejectionCases].map((item) => item.maintainer);
}

function indexWithoutSelfDigest(index) {
  const copy = structuredClone(index);
  delete copy.packContentDigest;
  return copy;
}

/**
 * 官方批准/治理入口。它不信任调用者提供的摘要，而是从 runDir 读取并复算全部状态。
 */
export async function inspectDistillationRunFromDisk({
  repoRoot = process.cwd(),
  runDir,
  validators,
  reviewStatePath,
}) {
  const resolved = await resolveRun(repoRoot, runDir);
  const manifestPath = path.join(resolved.runDir, "case-manifest.json");
  const reportPath = path.join(resolved.runDir, "validation-report.json");
  const markdownPath = path.join(resolved.runDir, "用户验收.md");
  const manifest = await readJson(manifestPath, "GOVERNANCE_MANIFEST_MISSING");
  const report = await readJson(reportPath, "GOVERNANCE_REPORT_MISSING");
  const indexPath = path.resolve(resolved.root, manifest.reviewPackage?.index ?? "");
  const indexReal = await fs.realpath(indexPath);
  if (!isInside(resolved.runDir, indexReal)) fail("GOVERNANCE_INDEX_ESCAPE", "review index is outside runDir");
  const index = await readJson(indexReal, "GOVERNANCE_INDEX_MISSING");
  const explicitReviewState = reviewStatePath !== undefined;
  const reviewTarget = path.isAbsolute(reviewStatePath ?? "review-state.json")
    ? path.resolve(reviewStatePath)
    : path.resolve(resolved.runDir, reviewStatePath ?? "review-state.json");
  let reviewState = null;
  try {
    const reviewReal = await fs.realpath(reviewTarget);
    if (!isInside(resolved.runDir, reviewReal)) fail("GOVERNANCE_REVIEW_STATE_ESCAPE", "review state is outside runDir");
    reviewState = await readJson(reviewReal, "GOVERNANCE_REVIEW_STATE_MISSING");
  } catch (error) {
    if (error?.code === "ENOENT" && explicitReviewState) {
      fail("GOVERNANCE_REVIEW_STATE_MISSING", `missing governance file: ${reviewTarget}`);
    }
    if (error?.code !== "ENOENT") throw error;
  }

  const recomputedPackDigest = digestJson(indexWithoutSelfDigest(index));
  if (index.packContentDigest !== recomputedPackDigest) {
    fail("GOVERNANCE_PACK_DIGEST_MISMATCH", "review index content changed after packaging");
  }
  if (index.reportDigest !== digestJson(report)) fail("GOVERNANCE_REPORT_DIGEST_MISMATCH", "review index is bound to a stale report");
  if (index.inputDigest !== digestJson(report.inputs)) fail("GOVERNANCE_INPUT_DIGEST_MISMATCH", "review index is bound to stale inputs");

  const inputs = await verifyArtifactSummaries(report.inputs, {
    repoRoot: resolved.root,
    forbiddenPaths: [reportPath],
  });
  const outputs = reportOutputs(report);
  await assertArtifactsInsideRun(outputs, resolved.root, resolved.runDir);
  const verifiedOutputs = await verifyArtifactSummaries(outputs, {
    repoRoot: resolved.root,
    forbiddenPaths: [reportPath],
  });
  const inputPaths = new Set(inputs.artifacts.map((item) => item.path));
  for (const artifact of verifiedOutputs.artifacts) {
    if (inputPaths.has(artifact.path)) fail("GOVERNANCE_INPUT_OUTPUT_COLLISION", `input is reused as output: ${artifact.path}`);
  }

  const packageOutputs = [
    index.artifacts.validationReport,
    index.artifacts.pairedOverview,
    ...index.artifacts.aesthetics.map((item) => item.artifact),
  ].map((artifact, indexNumber) => ({ ...artifact, role: `package-output-${String(indexNumber + 1).padStart(3, "0")}` }));
  await assertArtifactsInsideRun(packageOutputs, resolved.root, resolved.runDir);
  await verifyArtifactSummaries(packageOutputs, { repoRoot: resolved.root });
  await verifyArtifactSummaries(
    index.artifacts.sources.map((item, sourceIndex) => ({
      ...item.artifact,
      role: `package-source-${String(sourceIndex + 1).padStart(3, "0")}`,
    })),
    { repoRoot: resolved.root, forbiddenPaths: [reportPath] },
  );

  const expectedIndex = buildReviewPackIndex({
    manifest,
    validationReport: report,
    validators,
    freshness: {
      status: "passed",
      runId: index.runId,
      reportDigest: digestJson(report),
      inputDigest: digestJson(report.inputs),
    },
    bindings: {
      decks: index.artifacts.decks,
      validationReport: index.artifacts.validationReport,
      pairedOverview: index.artifacts.pairedOverview,
      sources: index.artifacts.sources,
      aesthetics: index.artifacts.aesthetics,
      maintainerCases: maintainerCases(index),
    },
  });
  if (canonicalJson(expectedIndex) !== canonicalJson(index)) {
    fail("GOVERNANCE_REVIEW_INDEX_MISMATCH", "review index cannot be reproduced from current manifest and report");
  }
  const markdown = await fs.readFile(markdownPath, "utf8");
  if (markdown !== renderReviewPackMarkdown(index)) {
    fail("GOVERNANCE_REVIEW_MARKDOWN_MISMATCH", "review markdown changed or is not derived from the current index");
  }

  // A clean run intentionally has no persisted user decision yet. Audit that
  // state as pending without creating a review-state file or inventing an
  // approval. If a review file exists (or is explicitly requested), it remains
  // the sole source of user acceptance.
  if (reviewState === null) {
    reviewState = {
      schemaVersion: "2.0",
      batchId: manifest.batchId,
      reportDigest: digestJson(report),
      packContentDigest: recomputedPackDigest,
      assetReviews: manifest.assets.map(({ assetId }) => ({
        assetId,
        maintainer: {
          status: "passed",
          reviewedCaseIds: manifest.cases
            .filter((item) => item.assetId === assetId && item.expected.outcome === "render")
            .map((item) => item.caseId),
        },
        user: { status: "pending", reviewedCaseIds: [] },
      })),
    };
  }

  const contract = inspectDistillationRun(manifest, report, reviewState, validators, {
    packContentDigest: recomputedPackDigest,
  });
  return {
    ...contract,
    runId: index.runId,
    packContentDigest: recomputedPackDigest,
    acceptedAssetIds: contract.status === "passed" ? contract.acceptedAssetIds : [],
  };
}
