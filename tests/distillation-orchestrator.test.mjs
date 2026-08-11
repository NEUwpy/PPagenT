import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDistillationContractValidators, digestJson } from "../src/distillation/contracts.mjs";
import { inspectDistillationRunFromDisk } from "../src/distillation/governance.mjs";
import { runDistillationOrchestration } from "../src/distillation/orchestrator.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const validators = await createDistillationContractValidators(projectRoot);

async function setup(t) {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-orchestrator-"));
  t.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  const write = async (relative, value) => {
    const target = path.join(repoRoot, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, value);
  };
  await fs.mkdir(path.join(repoRoot, "runs"));
  await write("asset/asset.json", "{}\n");
  await write("source/reference.pptx", "pptx");
  await write("skin/skin.mjs", "export const skin = {};\n");
  await write("package-lock.json", "{}\n");
  await write("tools/auditor.mjs", "export const audit = true;\n");
  await write("builder/entry.mjs", "import './helper.mjs';\nexport const build = true;\n");
  await write("builder/helper.mjs", "export const helper = true;\n");
  const runId = "org-pilot-v2";
  const runPrefix = `runs/${runId}`;
  const manifest = {
    schemaVersion: "2.0",
    methodVersion: "source-faithful-adaptive-v2",
    batchId: runId,
    revision: 1,
    assets: [{
      assetId: "organization-tree-001",
      source: { pptx: "source/reference.pptx", slides: [406] },
      coverageRequirements: { departmentCount: [2] },
      rejectionRequirements: ["ORG_TREE_DEPARTMENT_COUNT"],
    }],
    contexts: {
      standalone: { deck: `${runPrefix}/standalone.pptx`, qaDir: `${runPrefix}/standalone-qa` },
      skin: { skinId: "northeastern-university-001", deck: `${runPrefix}/skin.pptx`, qaDir: `${runPrefix}/skin-qa` },
    },
    cases: [
      {
        caseId: "org-valid",
        assetId: "organization-tree-001",
        dimensions: { departmentCount: 2 },
        params: { title: "项目组织", leader: { name: "李明", role: "负责人" }, departments: [{ name: "研发", head: "张三", members: [{ name: "小王", role: "设计" }] }, { name: "运营", head: "李四", members: [{ name: "小赵", role: "执行" }] }] },
        expected: { outcome: "render" },
        slides: { standalone: 1, skin: 1 },
      },
      {
        caseId: "org-invalid",
        assetId: "organization-tree-001",
        dimensions: { departmentCount: 5 },
        params: { title: "项目组织" },
        expected: { outcome: "rejection", errorCode: "ORG_TREE_DEPARTMENT_COUNT" },
      },
    ],
    reviewPackage: { index: `${runPrefix}/review-index.json`, montage: `${runPrefix}/paired-overview.png` },
  };
  const inputConfig = {
    assetMetadataPath: "asset/asset.json",
    sourcePptxPath: "source/reference.pptx",
    skinSourcePath: "skin/skin.mjs",
    lockfilePath: "package-lock.json",
    auditorPath: "tools/auditor.mjs",
    builderEntryPath: "builder/entry.mjs",
  };
  const renderContextBatch = async ({ context, contextSpec, cases }) => {
    await write(contextSpec.deck, `${context}-deck`);
    await fs.mkdir(path.join(repoRoot, contextSpec.qaDir));
    const results = [];
    for (const item of cases) {
      if (item.expected.outcome === "rejection") {
        results.push({ caseId: item.caseId, outcome: "rejection", errorCode: item.expected.errorCode });
      } else {
        const stem = `${contextSpec.qaDir}/slide-01`;
        await write(`${stem}.png`, `${context}-png`);
        await write(`${stem}.layout.json`, "{}\n");
        results.push({ caseId: item.caseId, outcome: "render", slideNumber: 1, pngPath: `${stem}.png`, layoutPath: `${stem}.layout.json`, checksPassed: true });
      }
    }
    return { deckPath: contextSpec.deck, results };
  };
  const buildReviewMaterials = async () => {
    await write(`${runPrefix}/paired-overview.png`, "overview");
    await write(`${runPrefix}/aesthetics.md`, "# 美学说明\n");
    return {
      pairedOverviewPath: `${runPrefix}/paired-overview.png`,
      aesthetics: [{ assetId: "organization-tree-001", path: `${runPrefix}/aesthetics.md` }],
      maintainerCases: manifest.cases.map((item) => ({ caseId: item.caseId, assetId: item.assetId, status: "passed", summary: "程序与人工复核通过" })),
    };
  };
  return { repoRoot, runId, manifest, inputConfig, renderContextBatch, buildReviewMaterials };
}

test("the sole orchestrator creates a fresh bound run and stops before user approval", async (t) => {
  const workspace = await setup(t);
  const result = await runDistillationOrchestration({
    ...workspace,
    allowedRunsRoot: "runs",
    validators,
  });
  assert.equal(result.status, "awaiting-user-review");
  assert.equal(result.report.status, "passed");
  assert.ok(result.packContentDigest.startsWith("sha256:"));
  const index = JSON.parse(await fs.readFile(result.reviewIndex, "utf8"));
  assert.equal(index.packContentDigest, result.packContentDigest);
  assert.equal(index.cases.length, 1);
  assert.equal(index.rejectionCases.length, 1);
  const markdown = await fs.readFile(result.reviewMarkdown, "utf8");
  assert.match(markdown, /不构成批准/u);
  assert.equal(await fs.stat(path.join(result.runDir, "case-manifest.json")).then((item) => item.isFile()), true);

  const pending = await inspectDistillationRunFromDisk({
    repoRoot: workspace.repoRoot,
    runDir: result.runDir,
    validators,
  });
  assert.equal(pending.status, "passed");
  assert.deepEqual(pending.acceptedAssetIds, []);
  await assert.rejects(
    inspectDistillationRunFromDisk({
      repoRoot: workspace.repoRoot,
      runDir: result.runDir,
      validators,
      reviewStatePath: "missing-explicit-review-state.json",
    }),
    (error) => error?.code === "GOVERNANCE_REVIEW_STATE_MISSING",
  );

  const reviewState = {
    schemaVersion: "2.0",
    batchId: workspace.manifest.batchId,
    reportDigest: digestJson(result.report),
    packContentDigest: result.packContentDigest,
    assetReviews: [{
      assetId: "organization-tree-001",
      maintainer: { status: "passed", reviewedCaseIds: ["org-valid"] },
      user: { status: "accepted", reviewedCaseIds: ["org-valid"], comment: "test approval" },
    }],
  };
  await fs.writeFile(path.join(result.runDir, "review-state.json"), `${JSON.stringify(reviewState, null, 2)}\n`);
  const governed = await inspectDistillationRunFromDisk({
    repoRoot: workspace.repoRoot,
    runDir: result.runDir,
    validators,
  });
  assert.equal(governed.status, "passed");
  assert.deepEqual(governed.acceptedAssetIds, ["organization-tree-001"]);

  await fs.appendFile(result.reviewMarkdown, "tampered\n");
  await assert.rejects(
    inspectDistillationRunFromDisk({ repoRoot: workspace.repoRoot, runDir: result.runDir, validators }),
    (error) => error?.code === "GOVERNANCE_REVIEW_MARKDOWN_MISMATCH",
  );
});

test("the sole orchestrator refuses run reuse and outputs outside its run directory", async (t) => {
  const workspace = await setup(t);
  await runDistillationOrchestration({ ...workspace, allowedRunsRoot: "runs", validators });
  await assert.rejects(
    runDistillationOrchestration({ ...workspace, allowedRunsRoot: "runs", validators }),
    (error) => error?.code === "ORCHESTRATOR_RUN_ID_ALREADY_RESERVED",
  );

  await fs.rm(path.join(workspace.repoRoot, "runs", workspace.runId), { recursive: true, force: true });
  await assert.rejects(
    runDistillationOrchestration({ ...workspace, allowedRunsRoot: "runs", validators }),
    (error) => error?.code === "ORCHESTRATOR_RUN_ID_ALREADY_RESERVED",
  );

  const escaped = await setup(t);
  escaped.manifest.contexts.standalone.deck = "outside.pptx";
  await assert.rejects(
    runDistillationOrchestration({ ...escaped, allowedRunsRoot: "runs", validators }),
    (error) => error?.code === "ORCHESTRATOR_MANIFEST_OUTPUT_OUTSIDE_RUN",
  );

  const invalid = await setup(t);
  invalid.manifest.cases = invalid.manifest.cases.slice(1);
  await assert.rejects(
    runDistillationOrchestration({ ...invalid, allowedRunsRoot: "runs", validators }),
    (error) => error?.code === "ORCHESTRATOR_MANIFEST_INVALID",
  );
  await assert.rejects(fs.access(path.join(invalid.repoRoot, "runs", invalid.runId)));
});

test("the sole orchestrator rejects missing or tampered evidence before a review pack exists", async (t) => {
  const missing = await setup(t);
  missing.renderContextBatch = async ({ context, contextSpec, cases }) => {
    await fs.writeFile(path.join(missing.repoRoot, contextSpec.deck), "deck");
    return {
      deckPath: contextSpec.deck,
      results: cases.map((item) => item.expected.outcome === "rejection"
        ? { caseId: item.caseId, outcome: "rejection", errorCode: item.expected.errorCode }
        : { caseId: item.caseId, outcome: "render", slideNumber: 1, pngPath: `${contextSpec.qaDir}/missing.png`, layoutPath: `${contextSpec.qaDir}/missing.json`, checksPassed: true }),
    };
  };
  await assert.rejects(
    runDistillationOrchestration({ ...missing, allowedRunsRoot: "runs", validators }),
    (error) => ["ORCHESTRATOR_QA_DIR_MISSING", "ORCHESTRATOR_OUTPUT_MISSING"].includes(error?.code),
  );
  await assert.rejects(fs.access(path.join(missing.repoRoot, "runs", missing.runId, "review-index.json")));

  const tampered = await setup(t);
  const originalMaterials = tampered.buildReviewMaterials;
  tampered.buildReviewMaterials = async (args) => {
    const materials = await originalMaterials(args);
    await fs.writeFile(
      path.join(tampered.repoRoot, "runs", tampered.runId, "standalone-qa", "slide-01.png"),
      "tampered",
    );
    return materials;
  };
  await assert.rejects(
    runDistillationOrchestration({ ...tampered, allowedRunsRoot: "runs", validators }),
    (error) => ["ARTIFACT_SIZE_MISMATCH", "ARTIFACT_DIGEST_MISMATCH"].includes(error?.code),
  );
  await assert.rejects(fs.access(path.join(tampered.repoRoot, "runs", tampered.runId, "review-index.json")));
});

test("every render case owns unique PNG and layout evidence", async (t) => {
  const workspace = await setup(t);
  const first = workspace.manifest.cases[0];
  workspace.manifest.cases.splice(1, 0, {
    ...structuredClone(first),
    caseId: "org-valid-second",
    slides: { standalone: 2, skin: 2 },
  });
  await assert.rejects(
    runDistillationOrchestration({ ...workspace, allowedRunsRoot: "runs", validators }),
    (error) => error?.code === "ORCHESTRATOR_CASE_EVIDENCE_REUSED",
  );
});

test("disk governance rejects evidence changed after packaging", async (t) => {
  const workspace = await setup(t);
  const result = await runDistillationOrchestration({ ...workspace, allowedRunsRoot: "runs", validators });
  const reviewState = {
    schemaVersion: "2.0",
    batchId: workspace.manifest.batchId,
    reportDigest: digestJson(result.report),
    packContentDigest: result.packContentDigest,
    assetReviews: [{
      assetId: "organization-tree-001",
      maintainer: { status: "passed", reviewedCaseIds: ["org-valid"] },
      user: { status: "accepted", reviewedCaseIds: ["org-valid"] },
    }],
  };
  await fs.writeFile(path.join(result.runDir, "review-state.json"), JSON.stringify(reviewState));
  await fs.writeFile(path.join(result.runDir, "skin-qa", "slide-01.png"), "changed-after-packaging");
  await assert.rejects(
    inspectDistillationRunFromDisk({ repoRoot: workspace.repoRoot, runDir: result.runDir, validators }),
    (error) => ["ARTIFACT_SIZE_MISMATCH", "ARTIFACT_DIGEST_MISMATCH"].includes(error?.code),
  );
});
