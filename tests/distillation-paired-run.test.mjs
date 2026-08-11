import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDistillationContractValidators,
  digestJson,
} from "../src/distillation/contracts.mjs";
import {
  runPairedDistillation,
  writeValidationReport,
} from "../src/distillation/paired-run.mjs";

const root = path.resolve(import.meta.dirname, "..");
const fixture = JSON.parse(await fs.readFile(
  path.join(root, "tests", "fixtures", "distillation", "case-manifest.valid.json"),
  "utf8",
));
const validators = await createDistillationContractValidators(root);
const artifact = (role, name) => ({
  role,
  path: `run/${name}`,
  digest: `sha256:${"a".repeat(64)}`,
  sizeBytes: 1,
});
const evidence = (context, slideNumber) => ({
  deck: artifact(`${context}-deck`, `${context}.pptx`),
  png: artifact(`${context}-png`, `${context}/slide-${slideNumber}.png`),
  layout: artifact(`${context}-layout`, `${context}/slide-${slideNumber}.layout.json`),
  checksPassed: true,
});

test("paired runner produces a passed report only when both contexts match", async () => {
  const calls = [];
  const { report, inspection } = await runPairedDistillation({
    manifest: fixture,
    validators,
    inputs: [artifact("case-manifest", "case-manifest.json")],
    executeContext: async ({ context, caseId, params, expectedSlideNumber }) => {
      calls.push(`${caseId}:${context}`);
      if (caseId === "org-d5-rejected") {
        const error = new Error("too many departments");
        error.code = "ORG_TREE_DEPARTMENT_COUNT";
        throw error;
      }
      assert.equal(digestJson(params), digestJson(
        fixture.cases.find((item) => item.caseId === caseId).params,
      ));
      return {
        outcome: "render",
        slideNumber: expectedSlideNumber,
        evidence: evidence(context, expectedSlideNumber),
      };
    },
  });
  assert.equal(calls.length, fixture.cases.length * 2);
  assert.equal(report.status, "passed");
  assert.equal(inspection.status, "passed");
});

test("one wrong Skin page fails the batch and cannot hide behind case status", async () => {
  const { report, inspection } = await runPairedDistillation({
    manifest: fixture,
    validators,
    inputs: [artifact("case-manifest", "case-manifest.json")],
    executeContext: async ({ context, caseId, expectedSlideNumber }) => {
      if (caseId === "org-d5-rejected") {
        return { outcome: "rejection", errorCode: "ORG_TREE_DEPARTMENT_COUNT" };
      }
      const slideNumber = context === "skin" && caseId === "org-d3-normal"
        ? expectedSlideNumber + 1
        : expectedSlideNumber;
      return { outcome: "render", slideNumber, evidence: evidence(context, slideNumber) };
    },
  });
  assert.equal(report.status, "failed");
  assert.equal(report.cases.find((item) => item.caseId === "org-d3-normal").status, "failed");
  assert.ok(report.issues.some((entry) => entry.code === "case-slide-mismatch"));
  assert.equal(inspection.status, "failed");
});

test("parameter mutation and generic errors fail closed with auditable codes", async () => {
  const { report } = await runPairedDistillation({
    manifest: fixture,
    validators,
    inputs: [artifact("case-manifest", "case-manifest.json")],
    executeContext: async ({ context, caseId, params, expectedSlideNumber }) => {
      if (caseId === "org-d5-rejected") throw new Error("generic failure");
      if (context === "skin" && caseId === "org-d2-short") params.title = "mutated";
      return {
        outcome: "render",
        slideNumber: expectedSlideNumber,
        evidence: evidence(context, expectedSlideNumber),
      };
    },
  });
  assert.equal(report.status, "failed");
  assert.ok(report.issues.some((entry) => entry.code === "context-params-digest-mismatch"));
  assert.ok(report.issues.some((entry) => entry.code === "rejection-error-code-mismatch"));
  assert.equal(report.cases.find((item) => item.caseId === "org-d5-rejected").contexts.skin.errorCode, "UNEXPECTED_ERROR");
});

test("invalid manifests never call the renderer", async () => {
  let calls = 0;
  await assert.rejects(
    runPairedDistillation({
      manifest: { ...fixture, cases: fixture.cases.slice(1) },
      validators,
      inputs: [artifact("case-manifest", "case-manifest.json")],
      executeContext: async () => { calls += 1; },
    }),
    (error) => error?.code === "INVALID_CASE_MANIFEST",
  );
  assert.equal(calls, 0);
});

test("validation reports are exclusive writes into an existing run directory", async (t) => {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-report-wx-"));
  t.after(() => fs.rm(runDir, { recursive: true, force: true }));
  const target = path.join(runDir, "validation-report.json");
  await writeValidationReport({ status: "passed" }, target);
  await assert.rejects(
    writeValidationReport({ status: "failed" }, target),
    (error) => error?.code === "EEXIST",
  );
  assert.deepEqual(JSON.parse(await fs.readFile(target, "utf8")), { status: "passed" });
});
