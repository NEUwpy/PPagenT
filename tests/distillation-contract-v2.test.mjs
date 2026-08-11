import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createPresentation } from "../src/asset-runtime/component-builders.mjs";
import { buildOrganizationTree } from "../src/asset-runtime/history-organization-builders.mjs";
import {
  createDistillationContractValidators,
  digestJson,
  inspectCaseManifest,
  inspectDistillationRun,
  inspectReviewState,
  inspectValidationReport,
} from "../src/distillation/contracts.mjs";

const root = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(root, "tests", "fixtures", "distillation", "case-manifest.valid.json");
const manifest = JSON.parse(await fs.readFile(fixturePath, "utf8"));
const validators = await createDistillationContractValidators(root);
const digest = (character) => `sha256:${character.repeat(64)}`;

function clone(value) {
  return structuredClone(value);
}

function artifact(role, suffix, character = "a") {
  return {
    role,
    path: `evidence/${suffix}`,
    digest: digest(character),
    sizeBytes: 100,
  };
}

function renderContext(item, context) {
  return {
    outcome: "render",
    paramsDigest: digestJson(item.params),
    slideNumber: item.slides[context],
    evidence: {
      deck: artifact(`${context}-deck`, `${context}.pptx`, context === "skin" ? "b" : "a"),
      png: artifact(`${context}-png`, `${item.caseId}-${context}.png`, "c"),
      layout: artifact(`${context}-layout`, `${item.caseId}-${context}.layout.json`, "d"),
      checksPassed: true,
    },
  };
}

function reportFor(sourceManifest = manifest) {
  return {
    schemaVersion: "2.0",
    batchId: sourceManifest.batchId,
    manifestDigest: digestJson(sourceManifest),
    status: "passed",
    inputs: [artifact("case-manifest", "case-manifest.json", "e")],
    artifacts: [artifact("review-montage", "review-montage.png", "f")],
    cases: sourceManifest.cases.map((item) => {
      const paramsDigest = digestJson(item.params);
      if (item.expected.outcome === "rejection") {
        const result = {
          outcome: "rejection",
          paramsDigest,
          errorCode: item.expected.errorCode,
        };
        return {
          caseId: item.caseId,
          assetId: item.assetId,
          paramsDigest,
          status: "passed",
          contexts: { standalone: { ...result }, skin: { ...result } },
        };
      }
      return {
        caseId: item.caseId,
        assetId: item.assetId,
        paramsDigest,
        status: "passed",
        contexts: {
          standalone: renderContext(item, "standalone"),
          skin: renderContext(item, "skin"),
        },
      };
    }),
    issues: [],
  };
}

function reviewFor(sourceManifest, report, reviewedCaseIds, packContentDigest = digest("9")) {
  return {
    schemaVersion: "2.0",
    batchId: sourceManifest.batchId,
    reportDigest: digestJson(report),
    packContentDigest,
    assetReviews: [{
      assetId: "organization-tree-001",
      maintainer: { status: "passed", reviewedCaseIds },
      user: { status: "accepted", reviewedCaseIds },
    }],
  };
}

test("v2 case manifest requires unique cases and covers every declared axis value", () => {
  assert.equal(inspectCaseManifest(manifest, validators).status, "passed");

  const duplicate = clone(manifest);
  duplicate.cases.push(clone(duplicate.cases[0]));
  const duplicateResult = inspectCaseManifest(duplicate, validators);
  assert.equal(duplicateResult.status, "failed");
  assert.ok(duplicateResult.issues.some((entry) => entry.code === "duplicate-case-id"));
  assert.ok(duplicateResult.issues.some((entry) => entry.code === "duplicate-context-slide"));

  const missingCoverage = clone(manifest);
  missingCoverage.cases = missingCoverage.cases.filter((item) => item.dimensions.departmentCount !== 3);
  const coverageResult = inspectCaseManifest(missingCoverage, validators);
  assert.equal(coverageResult.status, "failed");
  assert.ok(coverageResult.issues.some((entry) => entry.code === "missing-coverage-value"
    && entry.axis === "departmentCount" && entry.value === 3));
});

test("legal coverage only counts render cases and boundary coverage requires rejection cases", () => {
  const rejectedInsteadOfRendered = clone(manifest);
  const middle = rejectedInsteadOfRendered.cases.find((item) => item.caseId === "org-d3-normal");
  delete middle.slides;
  middle.expected = { outcome: "rejection", errorCode: "ORG_TREE_DEPARTMENT_COUNT" };
  const legalCoverage = inspectCaseManifest(rejectedInsteadOfRendered, validators);
  assert.equal(legalCoverage.status, "failed");
  assert.ok(legalCoverage.issues.some((entry) => entry.code === "missing-coverage-value"
    && entry.axis === "departmentCount" && entry.value === 3));

  const missingBoundary = clone(manifest);
  missingBoundary.cases = missingBoundary.cases.filter((item) => item.expected.outcome !== "rejection");
  const boundaryCoverage = inspectCaseManifest(missingBoundary, validators);
  assert.equal(boundaryCoverage.status, "failed");
  assert.ok(boundaryCoverage.issues.some((entry) => entry.code === "missing-rejection-case"
    && entry.errorCode === "ORG_TREE_DEPARTMENT_COUNT"));
});

test("render cases bind the same params digest and exact standalone/Skin pages", () => {
  const report = reportFor();
  assert.equal(inspectValidationReport(manifest, report, validators).status, "passed");

  const wrongSkinParams = clone(report);
  wrongSkinParams.cases[0].contexts.skin.paramsDigest = digest("9");
  const paramsResult = inspectValidationReport(manifest, wrongSkinParams, validators);
  assert.equal(paramsResult.status, "failed");
  assert.ok(paramsResult.issues.some((entry) => entry.code === "paired-params-digest-mismatch"));

  const wrongSlide = clone(report);
  wrongSlide.cases[1].contexts.skin.slideNumber = 99;
  const slideResult = inspectValidationReport(manifest, wrongSlide, validators);
  assert.equal(slideResult.status, "failed");
  assert.ok(slideResult.issues.some((entry) => entry.code === "case-slide-mismatch"));
});

test("rejection cases must reject in both contexts with one stable error code", () => {
  const report = reportFor();
  const rejected = report.cases.find((item) => item.caseId === "org-d5-rejected");
  rejected.contexts.skin.errorCode = "different-error";
  const result = inspectValidationReport(manifest, report, validators);
  assert.equal(result.status, "failed");
  assert.ok(result.issues.some((entry) => entry.code === "paired-rejection-code-mismatch"));
  assert.ok(result.issues.some((entry) => entry.code === "rejection-error-code-mismatch"));
});

test("real organization-tree validation errors satisfy the paired rejection contract", () => {
  const rejectionCase = manifest.cases.find((item) => item.caseId === "org-d5-rejected");
  const execute = () => {
    const deck = createPresentation();
    let caught;
    try {
      buildOrganizationTree(deck, rejectionCase.params);
    } catch (error) {
      caught = error;
    }
    assert.equal(deck.slides.items.length, 0);
    assert.equal(caught?.code, "ORG_TREE_DEPARTMENT_COUNT");
    return {
      outcome: "rejection",
      paramsDigest: digestJson(rejectionCase.params),
      errorCode: caught.code,
    };
  };

  const report = reportFor();
  const result = report.cases.find((item) => item.caseId === rejectionCase.caseId);
  result.contexts = { standalone: execute(), skin: execute() };
  assert.equal(inspectValidationReport(manifest, report, validators).status, "passed");
});

test("report status is jointly controlled by recomputed and declared issues", () => {
  const passedWithIssue = reportFor();
  passedWithIssue.issues.push({ code: "visual-review-failed", message: "visible imbalance" });
  const passedWithIssueResult = inspectValidationReport(manifest, passedWithIssue, validators);
  assert.equal(passedWithIssueResult.status, "failed");
  assert.ok(passedWithIssueResult.issues.some((entry) => entry.code === "report-schema"));

  const failedWithoutIssue = reportFor();
  failedWithoutIssue.status = "failed";
  const failedWithoutIssueResult = inspectValidationReport(manifest, failedWithoutIssue, validators);
  assert.equal(failedWithoutIssueResult.status, "failed");
  assert.ok(failedWithoutIssueResult.issues.some((entry) => entry.code === "report-schema"));

  const declaredFailure = reportFor();
  declaredFailure.status = "failed";
  declaredFailure.issues = [{ code: "visual-review-failed", message: "visible imbalance" }];
  const declaredFailureResult = inspectValidationReport(manifest, declaredFailure, validators);
  assert.equal(declaredFailureResult.status, "failed");
  assert.equal(declaredFailureResult.declaredIssues.length, 1);
  assert.ok(!declaredFailureResult.issues.some((entry) => entry.code === "report-status-mismatch"));
});

test("report membership is exact and stale manifest digests fail closed", () => {
  const missingCase = reportFor();
  missingCase.cases.pop();
  const missingResult = inspectValidationReport(manifest, missingCase, validators);
  assert.ok(missingResult.issues.some((entry) => entry.code === "missing-report-case"));

  const stale = reportFor();
  stale.manifestDigest = digest("8");
  const staleResult = inspectValidationReport(manifest, stale, validators);
  assert.ok(staleResult.issues.some((entry) => entry.code === "stale-manifest-digest"));
});

test("accepted review binds the report digest and covers all render cases", () => {
  const report = reportFor();
  const renderCaseIds = manifest.cases
    .filter((item) => item.expected.outcome === "render")
    .map((item) => item.caseId);
  const accepted = reviewFor(manifest, report, renderCaseIds);
  const acceptedResult = inspectReviewState(manifest, report, accepted, validators, {
    packContentDigest: accepted.packContentDigest,
  });
  assert.equal(acceptedResult.status, "passed");
  assert.deepEqual(acceptedResult.acceptedAssetIds, ["organization-tree-001"]);

  const incomplete = reviewFor(manifest, report, renderCaseIds.slice(0, 1));
  const incompleteResult = inspectReviewState(manifest, report, incomplete, validators, {
    packContentDigest: incomplete.packContentDigest,
  });
  assert.equal(incompleteResult.status, "failed");
  assert.ok(incompleteResult.issues.some((entry) => entry.code === "user-acceptance-incomplete"));

  const stale = reviewFor(manifest, report, renderCaseIds);
  stale.reportDigest = digest("7");
  const staleResult = inspectReviewState(manifest, report, stale, validators, {
    packContentDigest: stale.packContentDigest,
  });
  assert.equal(staleResult.status, "failed");
  assert.ok(staleResult.issues.some((entry) => entry.code === "stale-report-digest"));
  assert.deepEqual(staleResult.acceptedAssetIds, []);

  const stalePack = reviewFor(manifest, report, renderCaseIds);
  const stalePackResult = inspectReviewState(manifest, report, stalePack, validators, {
    packContentDigest: digest("8"),
  });
  assert.equal(stalePackResult.status, "failed");
  assert.ok(stalePackResult.issues.some((entry) => entry.code === "stale-review-pack-digest"));
  assert.deepEqual(stalePackResult.acceptedAssetIds, []);
});

test("review and aggregate run reject semantically invalid reports even when their digest matches", () => {
  const report = reportFor();
  report.cases[0].contexts.skin.slideNumber = 99;
  const renderCaseIds = manifest.cases
    .filter((item) => item.expected.outcome === "render")
    .map((item) => item.caseId);
  const review = reviewFor(manifest, report, renderCaseIds);

  const reviewResult = inspectReviewState(manifest, report, review, validators, {
    packContentDigest: review.packContentDigest,
  });
  assert.equal(reviewResult.status, "failed");
  assert.ok(reviewResult.issues.some((entry) => entry.code === "validation-report-not-passed"));
  assert.deepEqual(reviewResult.acceptedAssetIds, []);

  const runResult = inspectDistillationRun(manifest, report, review, validators, {
    packContentDigest: review.packContentDigest,
  });
  assert.equal(runResult.status, "failed");
  assert.deepEqual(runResult.acceptedAssetIds, []);
});
