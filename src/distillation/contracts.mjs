import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const SCHEMA_FILES = {
  manifest: "distillation-case-manifest.schema.json",
  report: "distillation-validation-report.schema.json",
  review: "distillation-review-state.schema.json",
};

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function digestJson(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

export async function createDistillationContractValidators(root = process.cwd()) {
  const schemaRoot = path.join(root, "schemas");
  const schemas = Object.fromEntries(await Promise.all(
    Object.entries(SCHEMA_FILES).map(async ([key, name]) => [key, await readJson(path.join(schemaRoot, name))]),
  ));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const schema of Object.values(schemas)) ajv.addSchema(schema);
  return {
    ajv,
    manifest: ajv.getSchema(schemas.manifest.$id),
    report: ajv.getSchema(schemas.report.$id),
    review: ajv.getSchema(schemas.review.$id),
  };
}

function schemaIssues(validator, value, prefix) {
  if (validator(value)) return [];
  return (validator.errors ?? []).map((error) => ({
    code: `${prefix}-schema`,
    path: error.instancePath,
    message: error.message ?? "schema validation failed",
  }));
}

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function uniqueValues(values) {
  return new Set(values.map(canonicalJson));
}

function sameStringSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const values = new Set(actual);
  return values.size === expected.length && expected.every((value) => values.has(value));
}

export function inspectCaseManifest(manifest, validators) {
  const issues = schemaIssues(validators.manifest, manifest, "manifest");
  if (issues.length) return { status: "failed", issues };

  const assetsById = new Map();
  for (const asset of manifest.assets) {
    if (assetsById.has(asset.assetId)) {
      issues.push(issue("duplicate-asset-id", `duplicate assetId: ${asset.assetId}`, { assetId: asset.assetId }));
    } else {
      assetsById.set(asset.assetId, asset);
    }
  }

  const casesById = new Map();
  const usedSlides = { standalone: new Map(), skin: new Map() };
  for (const item of manifest.cases) {
    if (casesById.has(item.caseId)) {
      issues.push(issue("duplicate-case-id", `duplicate caseId: ${item.caseId}`, { caseId: item.caseId }));
    } else {
      casesById.set(item.caseId, item);
    }
    if (!assetsById.has(item.assetId)) {
      issues.push(issue("unknown-case-asset", `case references unknown asset: ${item.assetId}`, {
        caseId: item.caseId,
        assetId: item.assetId,
      }));
    }
    if (item.expected.outcome === "render") {
      if (item.expected.errorCode !== undefined) {
        issues.push(issue("render-case-has-error-code", "render case must not declare an error code", {
          caseId: item.caseId,
        }));
      }
      for (const context of ["standalone", "skin"]) {
        const slideNumber = item.slides[context];
        const previous = usedSlides[context].get(slideNumber);
        if (previous) {
          issues.push(issue("duplicate-context-slide", `${context} slide ${slideNumber} is assigned twice`, {
            context,
            slideNumber,
            caseIds: [previous, item.caseId],
          }));
        } else {
          usedSlides[context].set(slideNumber, item.caseId);
        }
      }
    } else if (item.slides !== undefined) {
      issues.push(issue("rejection-case-has-slides", "rejection case must not reserve rendered slides", {
        caseId: item.caseId,
      }));
    }
  }

  for (const asset of manifest.assets) {
    const assetCases = manifest.cases.filter((item) => item.assetId === asset.assetId);
    const renderCases = assetCases.filter((item) => item.expected.outcome === "render");
    for (const [axis, required] of Object.entries(asset.coverageRequirements)) {
      const covered = uniqueValues(
        renderCases.filter((item) => Object.hasOwn(item.dimensions, axis)).map((item) => item.dimensions[axis]),
      );
      for (const value of required) {
        if (!covered.has(canonicalJson(value))) {
          issues.push(issue("missing-coverage-value", `coverage axis ${axis} is missing ${canonicalJson(value)}`, {
            assetId: asset.assetId,
            axis,
            value,
          }));
        }
      }
    }
    const rejectionCodes = new Set(assetCases
      .filter((item) => item.expected.outcome === "rejection")
      .map((item) => item.expected.errorCode));
    for (const errorCode of asset.rejectionRequirements) {
      if (!rejectionCodes.has(errorCode)) {
        issues.push(issue("missing-rejection-case", `missing rejection case for ${errorCode}`, {
          assetId: asset.assetId,
          errorCode,
        }));
      }
    }
  }

  return { status: issues.length ? "failed" : "passed", issues };
}

function compareContextResult(manifestCase, reportCase, context, issues) {
  const actual = reportCase.contexts[context];
  const expectedParamsDigest = digestJson(manifestCase.params);
  if (actual.paramsDigest !== expectedParamsDigest) {
    issues.push(issue("context-params-digest-mismatch", `${context} params digest does not match manifest`, {
      caseId: manifestCase.caseId,
      context,
    }));
  }
  if (manifestCase.expected.outcome === "render") {
    if (actual.outcome !== "render") {
      issues.push(issue("render-case-rejected", `${context} rejected a render case`, {
        caseId: manifestCase.caseId,
        context,
      }));
      return;
    }
    if (actual.slideNumber !== manifestCase.slides[context]) {
      issues.push(issue("case-slide-mismatch", `${context} slide does not match case manifest`, {
        caseId: manifestCase.caseId,
        context,
        expected: manifestCase.slides[context],
        actual: actual.slideNumber,
      }));
    }
    if (!actual.evidence.checksPassed) {
      issues.push(issue("case-evidence-check-failed", `${context} evidence checks did not pass`, {
        caseId: manifestCase.caseId,
        context,
      }));
    }
    if (actual.errorCode !== undefined) {
      issues.push(issue("render-result-has-error-code", `${context} render result must not include an error code`, {
        caseId: manifestCase.caseId,
        context,
      }));
    }
  } else if (actual.outcome !== "rejection") {
    issues.push(issue("rejection-case-rendered", `${context} rendered a rejection case`, {
      caseId: manifestCase.caseId,
      context,
    }));
  } else if (actual.errorCode !== manifestCase.expected.errorCode) {
    issues.push(issue("rejection-error-code-mismatch", `${context} rejection code does not match manifest`, {
      caseId: manifestCase.caseId,
      context,
      expected: manifestCase.expected.errorCode,
      actual: actual.errorCode,
    }));
  } else if (actual.slideNumber !== undefined || actual.evidence !== undefined) {
    issues.push(issue("rejection-result-has-render-evidence", `${context} rejection result must not include rendered evidence`, {
      caseId: manifestCase.caseId,
      context,
    }));
  }
}

export function inspectValidationReport(manifest, report, validators) {
  const schemaValidationIssues = [
    ...schemaIssues(validators.manifest, manifest, "manifest"),
    ...schemaIssues(validators.report, report, "report"),
  ];
  if (schemaValidationIssues.length) return { status: "failed", issues: schemaValidationIssues };

  const computedIssues = [];
  const declaredCaseIds = new Set(report.issues.filter((entry) => entry.caseId).map((entry) => entry.caseId));

  if (report.batchId !== manifest.batchId) {
    computedIssues.push(issue("report-batch-mismatch", "report batchId does not match manifest"));
  }
  if (report.manifestDigest !== digestJson(manifest)) {
    computedIssues.push(issue("stale-manifest-digest", "report is not bound to the current manifest"));
  }

  const manifestCases = new Map(manifest.cases.map((item) => [item.caseId, item]));
  const reportCases = new Map();
  for (const item of report.cases) {
    if (reportCases.has(item.caseId)) {
      computedIssues.push(issue("duplicate-report-case-id", `duplicate report caseId: ${item.caseId}`, { caseId: item.caseId }));
    } else {
      reportCases.set(item.caseId, item);
    }
    const source = manifestCases.get(item.caseId);
    if (!source) {
      computedIssues.push(issue("unknown-report-case", `report contains unknown case: ${item.caseId}`, { caseId: item.caseId }));
      continue;
    }
    if (item.assetId !== source.assetId) {
      computedIssues.push(issue("report-case-asset-mismatch", "report case assetId does not match manifest", { caseId: item.caseId }));
    }
    const paramsDigest = digestJson(source.params);
    if (item.paramsDigest !== paramsDigest) {
      computedIssues.push(issue("case-params-digest-mismatch", "case params digest does not match manifest", { caseId: item.caseId }));
    }
    if (item.contexts.standalone.paramsDigest !== item.contexts.skin.paramsDigest) {
      computedIssues.push(issue("paired-params-digest-mismatch", "standalone and skin used different parameter digests", {
        caseId: item.caseId,
      }));
    }
    compareContextResult(source, item, "standalone", computedIssues);
    compareContextResult(source, item, "skin", computedIssues);
    if (source.expected.outcome === "rejection"
      && item.contexts.standalone.outcome === "rejection"
      && item.contexts.skin.outcome === "rejection"
      && item.contexts.standalone.errorCode !== item.contexts.skin.errorCode) {
      computedIssues.push(issue("paired-rejection-code-mismatch", "standalone and skin returned different rejection codes", {
        caseId: item.caseId,
      }));
    }
    const casePassed = computedIssues.every((entry) => entry.caseId !== item.caseId)
      && !declaredCaseIds.has(item.caseId);
    if ((item.status === "passed") !== casePassed) {
      computedIssues.push(issue("case-status-mismatch", "reported case status does not match evidence", { caseId: item.caseId }));
    }
  }
  for (const caseId of manifestCases.keys()) {
    if (!reportCases.has(caseId)) computedIssues.push(issue("missing-report-case", `report is missing case: ${caseId}`, { caseId }));
  }

  const declaredIssues = report.issues.map((entry) => ({ ...entry, declared: true }));
  const shouldPass = computedIssues.length === 0 && declaredIssues.length === 0;
  const consistencyIssues = [];
  if ((report.status === "passed") !== shouldPass) {
    consistencyIssues.push(issue("report-status-mismatch", "reported status does not match computed and declared issues"));
  }
  const issues = [...computedIssues, ...declaredIssues, ...consistencyIssues];
  return {
    status: report.status === "passed" && issues.length === 0 ? "passed" : "failed",
    issues,
    computedIssues,
    declaredIssues,
  };
}

export function inspectReviewState(manifest, report, reviewState, validators, { packContentDigest } = {}) {
  const issues = [
    ...schemaIssues(validators.manifest, manifest, "manifest"),
    ...schemaIssues(validators.report, report, "report"),
    ...schemaIssues(validators.review, reviewState, "review"),
  ];
  if (issues.length) return { status: "failed", issues, acceptedAssetIds: [] };

  const reportInspection = inspectValidationReport(manifest, report, validators);
  if (reportInspection.status !== "passed") {
    issues.push(issue("validation-report-not-passed", "review requires a semantically passed validation report"));
  }

  if (reviewState.batchId !== manifest.batchId || reviewState.batchId !== report.batchId) {
    issues.push(issue("review-batch-mismatch", "review batchId does not match manifest and report"));
  }
  if (reviewState.reportDigest !== digestJson(report)) {
    issues.push(issue("stale-report-digest", "review state is not bound to the current validation report"));
  }
  if (typeof packContentDigest !== "string") {
    issues.push(issue("review-pack-digest-not-provided", "review state inspection requires the current pack content digest"));
  } else if (reviewState.packContentDigest !== packContentDigest) {
    issues.push(issue("stale-review-pack-digest", "review state is not bound to the current review package"));
  }

  const assetIds = new Set(manifest.assets.map((item) => item.assetId));
  const seen = new Set();
  const acceptedAssetIds = [];
  for (const assetReview of reviewState.assetReviews) {
    if (seen.has(assetReview.assetId)) {
      issues.push(issue("duplicate-asset-review", `duplicate asset review: ${assetReview.assetId}`, {
        assetId: assetReview.assetId,
      }));
      continue;
    }
    seen.add(assetReview.assetId);
    if (!assetIds.has(assetReview.assetId)) {
      issues.push(issue("unknown-review-asset", `review references unknown asset: ${assetReview.assetId}`, {
        assetId: assetReview.assetId,
      }));
      continue;
    }
    const renderCaseIds = manifest.cases
      .filter((item) => item.assetId === assetReview.assetId && item.expected.outcome === "render")
      .map((item) => item.caseId);
    if (assetReview.maintainer.status === "passed"
      && !sameStringSet(assetReview.maintainer.reviewedCaseIds, renderCaseIds)) {
      issues.push(issue("maintainer-review-incomplete", "maintainer pass must cover every render case", {
        assetId: assetReview.assetId,
      }));
    }
    if (assetReview.user.status === "accepted") {
      if (!sameStringSet(assetReview.user.reviewedCaseIds, renderCaseIds)) {
        issues.push(issue("user-acceptance-incomplete", "user acceptance must cover every render case", {
          assetId: assetReview.assetId,
        }));
      }
      if (assetReview.maintainer.status !== "passed") {
        issues.push(issue("user-accepted-before-maintainer", "user acceptance requires maintainer pass", {
          assetId: assetReview.assetId,
        }));
      }
      if (reportInspection.status !== "passed") {
        issues.push(issue("user-accepted-failed-report", "user cannot accept a failed validation report", {
          assetId: assetReview.assetId,
        }));
      }
      if (!issues.some((entry) => entry.assetId === assetReview.assetId)) acceptedAssetIds.push(assetReview.assetId);
    }
  }

  return {
    status: issues.length ? "failed" : "passed",
    issues,
    acceptedAssetIds: issues.length ? [] : acceptedAssetIds,
  };
}

export function inspectDistillationRun(manifest, report, reviewState, validators, options) {
  const manifestResult = inspectCaseManifest(manifest, validators);
  const reportResult = inspectValidationReport(manifest, report, validators);
  const reviewResult = inspectReviewState(manifest, report, reviewState, validators, options);
  const issues = [...manifestResult.issues, ...reportResult.issues, ...reviewResult.issues];
  const allPassed = manifestResult.status === "passed"
    && reportResult.status === "passed"
    && reviewResult.status === "passed";
  return {
    status: allPassed ? "passed" : "failed",
    manifest: manifestResult.status,
    report: reportResult.status,
    review: reviewResult.status,
    acceptedAssetIds: allPassed ? reviewResult.acceptedAssetIds : [],
    issues,
  };
}
