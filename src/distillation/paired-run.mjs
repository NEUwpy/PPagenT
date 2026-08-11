import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalJson,
  digestJson,
  inspectCaseManifest,
  inspectValidationReport,
} from "./contracts.mjs";

const CONTEXTS = ["standalone", "skin"];

function stableErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Za-z][A-Za-z0-9._-]*$/u.test(error.code)
    ? error.code
    : "UNEXPECTED_ERROR";
}

function uniqueIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const key = canonicalJson(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicIssue(entry) {
  return {
    ...(entry.caseId ? { caseId: entry.caseId } : {}),
    code: entry.code,
    message: entry.message,
  };
}

async function executeOneContext({ manifestCase, context, executeContext }) {
  const params = structuredClone(manifestCase.params);
  try {
    const result = await executeContext({
      context,
      caseId: manifestCase.caseId,
      assetId: manifestCase.assetId,
      params,
      expectedSlideNumber: manifestCase.slides?.[context],
    });
    if (!result || !["render", "rejection"].includes(result.outcome)) {
      throw Object.assign(new Error("context executor returned no valid outcome"), {
        code: "INVALID_EXECUTOR_RESULT",
      });
    }
    return {
      ...result,
      paramsDigest: digestJson(params),
    };
  } catch (error) {
    return {
      outcome: "rejection",
      paramsDigest: digestJson(params),
      errorCode: stableErrorCode(error),
    };
  }
}

/**
 * 执行同一份案例清单的 standalone / Skin 双上下文，并生成可被 v2 契约复算的报告。
 * 渲染、导出和逐页 QA 由 executeContext 注入；本层只拥有配对、失败关闭和报告所有权。
 */
export async function runPairedDistillation({
  manifest,
  validators,
  inputs,
  artifacts = [],
  executeContext,
}) {
  if (typeof executeContext !== "function") throw new TypeError("executeContext must be a function");
  if (!Array.isArray(inputs) || inputs.length === 0) throw new TypeError("inputs must contain at least one artifact");

  const manifestInspection = inspectCaseManifest(manifest, validators);
  if (manifestInspection.status !== "passed") {
    const error = new Error("case manifest failed semantic validation");
    error.code = "INVALID_CASE_MANIFEST";
    error.issues = manifestInspection.issues;
    throw error;
  }

  const cases = [];
  for (const manifestCase of manifest.cases) {
    const contexts = {};
    for (const context of CONTEXTS) {
      contexts[context] = await executeOneContext({ manifestCase, context, executeContext });
    }
    cases.push({
      caseId: manifestCase.caseId,
      assetId: manifestCase.assetId,
      paramsDigest: digestJson(manifestCase.params),
      status: "passed",
      contexts,
    });
  }

  const provisional = {
    schemaVersion: "2.0",
    batchId: manifest.batchId,
    manifestDigest: digestJson(manifest),
    status: "passed",
    inputs,
    artifacts,
    cases,
    issues: [],
  };
  const firstInspection = inspectValidationReport(manifest, provisional, validators);
  if (firstInspection.status === "passed") {
    return { report: provisional, inspection: firstInspection };
  }

  const substantive = uniqueIssues(firstInspection.issues
    .filter((entry) => !["case-status-mismatch", "report-status-mismatch"].includes(entry.code))
    .map(publicIssue));
  if (substantive.length === 0) {
    substantive.push({
      code: "RUN_VALIDATION_FAILED",
      message: "paired run failed validation without a classified issue",
    });
  }
  const failingCaseIds = new Set(substantive.map((entry) => entry.caseId).filter(Boolean));
  const report = {
    ...provisional,
    status: "failed",
    cases: provisional.cases.map((item) => ({
      ...item,
      status: failingCaseIds.has(item.caseId) ? "failed" : "passed",
    })),
    issues: substantive,
  };
  return {
    report,
    inspection: inspectValidationReport(manifest, report, validators),
  };
}

export async function writeValidationReport(report, target) {
  const resolved = path.resolve(target);
  const parent = path.dirname(resolved);
  const parentStat = await fs.stat(parent);
  if (!parentStat.isDirectory()) throw new Error(`validation report parent is not a directory: ${parent}`);
  await fs.writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return resolved;
}
