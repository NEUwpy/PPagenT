import { digestJson, inspectCaseManifest, inspectValidationReport } from "./contracts.mjs";

export class ReviewPackError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ReviewPackError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ReviewPackError(code, message, details);
}

function assertRelativeArtifact(artifact, field) {
  const value = artifact?.path;
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    fail("REVIEW_PACK_EVIDENCE_PATH_INVALID", `${field}.path 必须是非空相对路径`, { field, value });
  }
  const normalized = value.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized)
    || normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    fail("REVIEW_PACK_EVIDENCE_PATH_INVALID", `${field}.path 必须是项目内相对路径`, { field, value });
  }
  if (typeof artifact.role !== "string" || artifact.role === ""
    || !/^sha256:[a-f0-9]{64}$/u.test(artifact.digest)
    || !Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes < 0) {
    fail("REVIEW_PACK_ARTIFACT_INVALID", `${field} 缺少有效 role、digest 或 sizeBytes`, { field });
  }
  return { ...artifact, path: normalized };
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    fail("REVIEW_PACK_BINDING_INVALID", `${field} 必须是无首尾空白的非空字符串`, { field, value });
  }
  return value;
}

function sameArtifact(actual, expected) {
  return actual.path === expected.path
    && actual.digest === expected.digest
    && actual.sizeBytes === expected.sizeBytes;
}

function sameNumberSet(actual, expected) {
  return actual.length === expected.length
    && new Set(actual).size === expected.length
    && expected.every((value) => actual.includes(value));
}

function normalizeBindings(manifest, validationReport, freshness, bindings) {
  if (!freshness || freshness.status !== "passed") {
    fail("REVIEW_PACK_FRESHNESS_NOT_PASSED", "freshness 未通过，拒绝生成统一验收包", {
      status: freshness?.status,
    });
  }
  const runId = requireString(freshness.runId, "freshness.runId");
  const reportDigest = requireString(freshness.reportDigest, "freshness.reportDigest");
  const inputDigest = requireString(freshness.inputDigest, "freshness.inputDigest");
  if (!/^sha256:[a-f0-9]{64}$/u.test(reportDigest) || !/^sha256:[a-f0-9]{64}$/u.test(inputDigest)) {
    fail("REVIEW_PACK_BINDING_INVALID", "reportDigest 与 inputDigest 必须是 sha256 digest");
  }
  if (reportDigest !== digestJson(validationReport)) {
    fail("REVIEW_PACK_REPORT_DIGEST_MISMATCH", "freshness.reportDigest 未绑定当前 validation report");
  }
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    fail("REVIEW_PACK_BINDING_INVALID", "bindings 必须是对象");
  }

  const decks = {
    standalone: assertRelativeArtifact(bindings.decks?.standalone, "bindings.decks.standalone"),
    skin: assertRelativeArtifact(bindings.decks?.skin, "bindings.decks.skin"),
  };
  for (const context of ["standalone", "skin"]) {
    if (decks[context].path !== manifest.contexts[context].deck.replaceAll("\\", "/")) {
      fail("REVIEW_PACK_DECK_MISMATCH", `${context} deck 与 manifest 不一致`, {
        expected: manifest.contexts[context].deck,
        actual: decks[context].path,
      });
    }
  }
  const validationReportArtifact = assertRelativeArtifact(
    bindings.validationReport,
    "bindings.validationReport",
  );
  const pairedOverview = assertRelativeArtifact(bindings.pairedOverview, "bindings.pairedOverview");

  if (!Array.isArray(bindings.sources) || bindings.sources.length !== manifest.assets.length) {
    fail("REVIEW_PACK_SOURCE_BINDING_MISSING", "每个资产都必须绑定来源 artifact 与来源页");
  }
  const sourcesByAsset = new Map();
  for (const [index, source] of bindings.sources.entries()) {
    const assetId = requireString(source?.assetId, `bindings.sources[${index}].assetId`);
    if (sourcesByAsset.has(assetId)) fail("REVIEW_PACK_SOURCE_BINDING_DUPLICATE", `来源绑定重复：${assetId}`);
    if (!Array.isArray(source.pages) || !source.pages.every(Number.isInteger)) {
      fail("REVIEW_PACK_SOURCE_BINDING_INVALID", `来源页无效：${assetId}`);
    }
    sourcesByAsset.set(assetId, {
      assetId,
      artifact: assertRelativeArtifact(source.artifact, `bindings.sources[${index}].artifact`),
      pages: [...source.pages],
    });
  }
  const sources = manifest.assets.map((asset) => {
    const source = sourcesByAsset.get(asset.assetId);
    if (!source || source.artifact.path !== asset.source.pptx.replaceAll("\\", "/")
      || !sameNumberSet(source.pages, asset.source.slides)) {
      fail("REVIEW_PACK_SOURCE_BINDING_MISMATCH", `资产 ${asset.assetId} 的来源或页码不一致`, {
        assetId: asset.assetId,
      });
    }
    return source;
  });

  if (!Array.isArray(bindings.aesthetics) || bindings.aesthetics.length !== manifest.assets.length) {
    fail("REVIEW_PACK_AESTHETICS_MISSING", "每个资产都必须绑定美学说明 artifact");
  }
  const aestheticsByAsset = new Map();
  for (const [index, item] of bindings.aesthetics.entries()) {
    const assetId = requireString(item?.assetId, `bindings.aesthetics[${index}].assetId`);
    if (aestheticsByAsset.has(assetId)) fail("REVIEW_PACK_AESTHETICS_DUPLICATE", `美学说明重复：${assetId}`);
    aestheticsByAsset.set(assetId, {
      assetId,
      artifact: assertRelativeArtifact(item.artifact, `bindings.aesthetics[${index}].artifact`),
    });
  }
  const aesthetics = manifest.assets.map((asset) => {
    const item = aestheticsByAsset.get(asset.assetId);
    if (!item) fail("REVIEW_PACK_AESTHETICS_MISSING", `缺少资产 ${asset.assetId} 的美学说明`);
    return item;
  });

  if (!Array.isArray(bindings.maintainerCases) || bindings.maintainerCases.length !== manifest.cases.length) {
    fail("REVIEW_PACK_MAINTAINER_RESULTS_MISSING", "每个 case 都必须有维护者复核结果");
  }
  const maintainerByCase = new Map();
  for (const [index, item] of bindings.maintainerCases.entries()) {
    const caseId = requireString(item?.caseId, `bindings.maintainerCases[${index}].caseId`);
    const assetId = requireString(item?.assetId, `bindings.maintainerCases[${index}].assetId`);
    const summary = requireString(item?.summary, `bindings.maintainerCases[${index}].summary`);
    if (item.status !== "passed") {
      fail("REVIEW_PACK_MAINTAINER_NOT_PASSED", `case ${caseId} 尚未通过维护者复核`, { caseId });
    }
    if (maintainerByCase.has(caseId)) fail("REVIEW_PACK_MAINTAINER_RESULTS_DUPLICATE", `维护者结果重复：${caseId}`);
    maintainerByCase.set(caseId, { caseId, assetId, status: "passed", summary });
  }
  for (const item of manifest.cases) {
    const result = maintainerByCase.get(item.caseId);
    if (!result || result.assetId !== item.assetId) {
      fail("REVIEW_PACK_MAINTAINER_RESULTS_MISMATCH", `case ${item.caseId} 的维护者结果缺失或资产不一致`);
    }
  }

  return {
    runId,
    reportDigest,
    inputDigest,
    decks,
    validationReport: validationReportArtifact,
    sources,
    aesthetics,
    pairedOverview,
    maintainerByCase,
  };
}

function summarizeObject(value) {
  return Object.entries(value).map(([key, nested]) => {
    if (nested === null || ["string", "number", "boolean"].includes(typeof nested)) return `${key}=${nested}`;
    if (Array.isArray(nested)) return `${key}=${nested.length}项`;
    if (typeof nested === "object") return `${key}={${summarizeObject(nested)}}`;
    return `${key}=${String(nested)}`;
  }).join("，");
}

export function summarizeCaseParams(params) {
  const summary = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      const childCounts = value
        .filter((item) => item && typeof item === "object" && Array.isArray(item.members))
        .map((item) => item.members.length);
      summary[key] = childCounts.length === value.length
        ? `${value.length}项（子项 ${childCounts.join("/")}）`
        : `${value.length}项`;
    } else if (typeof value === "object") {
      summary[key] = summarizeObject(value);
    }
  }
  return summary;
}

function artifactEvidence(contextResult, manifestCase, context) {
  if (contextResult.outcome !== "render") {
    fail("REVIEW_PACK_RENDER_PAIR_MISSING", `${manifestCase.caseId} 缺少 ${context} 渲染证据`, {
      caseId: manifestCase.caseId,
      context,
      outcome: contextResult.outcome,
    });
  }
  const expectedPage = manifestCase.slides[context];
  if (contextResult.slideNumber !== expectedPage) {
    fail("REVIEW_PACK_PAGE_NUMBER_MISMATCH", `${manifestCase.caseId} 的 ${context} 页码错误`, {
      caseId: manifestCase.caseId,
      context,
      expectedPage,
      actualPage: contextResult.slideNumber,
    });
  }
  if (contextResult.evidence?.checksPassed !== true) {
    fail("REVIEW_PACK_EVIDENCE_NOT_PASSED", `${manifestCase.caseId} 的 ${context} 证据未通过检查`, {
      caseId: manifestCase.caseId,
      context,
    });
  }
  return {
    pageNumber: expectedPage,
    png: assertRelativeArtifact(contextResult.evidence?.png, `${manifestCase.caseId}.${context}.png`),
    layout: assertRelativeArtifact(contextResult.evidence?.layout, `${manifestCase.caseId}.${context}.layout`),
  };
}

export function buildReviewPackIndex({ manifest, validationReport, validators, freshness, bindings }) {
  if (!validators) fail("REVIEW_PACK_VALIDATORS_REQUIRED", "必须提供 v2 contract validators");
  const manifestInspection = inspectCaseManifest(manifest, validators);
  if (manifestInspection.status !== "passed") {
    fail("REVIEW_PACK_MANIFEST_NOT_PASSED", "case manifest 未通过语义检查", {
      issues: manifestInspection.issues,
    });
  }
  const reportInspection = inspectValidationReport(manifest, validationReport, validators);
  if (reportInspection.status !== "passed") {
    fail("REVIEW_PACK_VALIDATION_NOT_PASSED", "validation report 未通过语义检查", {
      issues: reportInspection.issues,
    });
  }
  const normalizedBindings = normalizeBindings(
    manifest,
    validationReport,
    freshness,
    bindings,
  );

  const reportByCaseId = new Map(validationReport.cases.map((item) => [item.caseId, item]));
  const cases = [];
  const rejectionCases = [];
  for (const manifestCase of manifest.cases) {
    const reportCase = reportByCaseId.get(manifestCase.caseId);
    if (!reportCase || reportCase.status !== "passed") {
      fail("REVIEW_PACK_CASE_NOT_PASSED", `case ${manifestCase.caseId} 缺失或未通过`, {
        caseId: manifestCase.caseId,
      });
    }
    if (manifestCase.expected.outcome === "render") {
      const standalone = artifactEvidence(reportCase.contexts.standalone, manifestCase, "standalone");
      const skin = artifactEvidence(reportCase.contexts.skin, manifestCase, "skin");
      const standaloneDeck = assertRelativeArtifact(
        reportCase.contexts.standalone.evidence.deck,
        `${manifestCase.caseId}.standalone.deck`,
      );
      const skinDeck = assertRelativeArtifact(
        reportCase.contexts.skin.evidence.deck,
        `${manifestCase.caseId}.skin.deck`,
      );
      if (!sameArtifact(standaloneDeck, normalizedBindings.decks.standalone)
        || !sameArtifact(skinDeck, normalizedBindings.decks.skin)) {
        fail("REVIEW_PACK_DECK_EVIDENCE_MISMATCH", `case ${manifestCase.caseId} 的 deck 证据与统一绑定不一致`, {
          caseId: manifestCase.caseId,
        });
      }
      cases.push({
        caseId: manifestCase.caseId,
        assetId: manifestCase.assetId,
        paramsSummary: summarizeCaseParams(manifestCase.params),
        standalone,
        skin,
        maintainer: normalizedBindings.maintainerByCase.get(manifestCase.caseId),
      });
      continue;
    }
    const standaloneCode = reportCase.contexts.standalone.errorCode;
    const skinCode = reportCase.contexts.skin.errorCode;
    if (reportCase.contexts.standalone.outcome !== "rejection"
      || reportCase.contexts.skin.outcome !== "rejection"
      || standaloneCode !== manifestCase.expected.errorCode
      || skinCode !== manifestCase.expected.errorCode) {
      fail("REVIEW_PACK_REJECTION_MISMATCH", `case ${manifestCase.caseId} 未按预期拒绝`, {
        caseId: manifestCase.caseId,
        expectedErrorCode: manifestCase.expected.errorCode,
        standaloneCode,
        skinCode,
      });
    }
    rejectionCases.push({
      caseId: manifestCase.caseId,
      assetId: manifestCase.assetId,
      errorCode: manifestCase.expected.errorCode,
      contexts: { standalone: standaloneCode, skin: skinCode },
      maintainer: normalizedBindings.maintainerByCase.get(manifestCase.caseId),
    });
  }

  const content = {
    schemaVersion: "2.0",
    runId: normalizedBindings.runId,
    batchId: manifest.batchId,
    reportDigest: normalizedBindings.reportDigest,
    inputDigest: normalizedBindings.inputDigest,
    summary: {
      assetCount: manifest.assets.length,
      renderCaseCount: cases.length,
      pairedRenderCount: cases.length,
      rejectionCaseCount: rejectionCases.length,
    },
    assets: manifest.assets.map((asset) => ({ assetId: asset.assetId })),
    artifacts: {
      decks: normalizedBindings.decks,
      validationReport: normalizedBindings.validationReport,
      sources: normalizedBindings.sources,
      aesthetics: normalizedBindings.aesthetics,
      pairedOverview: normalizedBindings.pairedOverview,
    },
    cases,
    rejectionCases,
  };
  return { ...content, packContentDigest: digestJson(content) };
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

function formatParams(paramsSummary) {
  return Object.entries(paramsSummary)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("；");
}

function evidenceLinks(evidence) {
  return `第 ${evidence.pageNumber} 页 · [PNG](<${evidence.png.path}>) · [layout](<${evidence.layout.path}>)`;
}

export function renderReviewPackMarkdown(index) {
  const lines = [
    `# ${index.batchId} 用户验收`,
    "",
    "> 本文件只负责人工复核入口。外部 review-state 正式接受前，任何资产都不得晋升核心资产库。",
    "",
    "## 客观摘要",
    "",
    `- 资产：${index.summary.assetCount} 项`,
    `- 成对渲染案例：${index.summary.pairedRenderCount} 组`,
    `- 非法输入验证：${index.summary.rejectionCaseCount} 项`,
    `- 运行绑定：${index.runId}`,
    `- 验证报告：${index.reportDigest}`,
    `- 输入集合：${index.inputDigest}`,
    `- 验收包内容：${index.packContentDigest}`,
    "",
    "## 成对页面",
    "",
    "| Case | 资产 | 参数摘要 | Standalone（左） | Skin（右） | 维护者逐案结果 |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const item of index.cases) {
    lines.push(`| ${escapeTable(item.caseId)} | ${escapeTable(item.assetId)} | ${escapeTable(formatParams(item.paramsSummary))} | ${evidenceLinks(item.standalone)} | ${evidenceLinks(item.skin)} | 已通过：${escapeTable(item.maintainer.summary)} |`);
  }

  lines.push("", "## 统一证据入口", "");
  lines.push(
    `- Standalone deck：[文件](<${index.artifacts.decks.standalone.path}>)`,
    `- Skin deck：[文件](<${index.artifacts.decks.skin.path}>)`,
    `- Validation report：[文件](<${index.artifacts.validationReport.path}>)`,
    `- 成对总览：[文件](<${index.artifacts.pairedOverview.path}>)`,
  );
  for (const source of index.artifacts.sources) {
    lines.push(`- ${source.assetId} 来源（第 ${source.pages.join("、")} 页）：[文件](<${source.artifact.path}>)`);
  }
  for (const aesthetics of index.artifacts.aesthetics) {
    lines.push(`- ${aesthetics.assetId} 美学说明：[文件](<${aesthetics.artifact.path}>)`);
  }

  lines.push("", "## 非法输入验证", "");
  if (index.rejectionCases.length === 0) {
    lines.push("无。", "");
  } else {
    lines.push("| Case | 资产 | Standalone 错误码 | Skin 错误码 | 维护者逐案结果 |", "| --- | --- | --- | --- | --- |");
    for (const item of index.rejectionCases) {
      lines.push(`| ${escapeTable(item.caseId)} | ${escapeTable(item.assetId)} | ${escapeTable(item.contexts.standalone)} | ${escapeTable(item.contexts.skin)} | 已通过：${escapeTable(item.maintainer.summary)} |`);
    }
    lines.push("");
  }

  lines.push("## 资产验收清单", "");
  for (const asset of index.assets) {
    lines.push(
      `### ${asset.assetId}`,
      "",
      "- [ ] 用户复核入口：待在外部 review-state 完成；此处勾选只表示阅读进度，不构成批准。",
      "",
    );
  }
  lines.push(
    "> 正式批准只能写入外部 review-state，并且必须绑定本包的 packContentDigest；包内勾选不构成批准。",
    "> 外部 review-state 正式接受前不得晋升。",
    "",
  );
  return lines.join("\n");
}

export function buildReviewPack(input) {
  const index = buildReviewPackIndex(input);
  return { index, markdown: renderReviewPackMarkdown(index) };
}
