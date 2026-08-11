import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  if (argv.length !== 2 || !["--config", "--batch-config"].includes(argv[0])) {
    fail("REVIEW_ARGS", "usage: node src/tools/build-intake-user-review.mjs --config <review-batch.json> | --batch-config <intake-batch.json>");
  }
  return { mode: argv[0] === "--batch-config" ? "batch" : "review", configPath: path.resolve(argv[1]) };
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJsonExclusive(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

async function writeTextExclusive(filePath, value) {
  await fs.writeFile(filePath, value, { encoding: "utf8", flag: "wx" });
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fs.writeFile(filePath, value, "utf8");
}

async function imageBytes(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function assertConfig(config) {
  if (!config || config.schemaVersion !== "1.0") fail("REVIEW_CONFIG_SCHEMA", "review config schemaVersion must be 1.0");
  if (typeof config.batchId !== "string" || !config.batchId.trim()) fail("REVIEW_BATCH_ID", "batchId is required");
  if (typeof config.sourceRoot !== "string" || !path.isAbsolute(config.sourceRoot)) fail("REVIEW_SOURCE_ROOT", "sourceRoot must be absolute");
  if (typeof config.outputDir !== "string" || !path.isAbsolute(config.outputDir)) fail("REVIEW_OUTPUT_DIR", "outputDir must be absolute");
  if (!Array.isArray(config.assets) || config.assets.length === 0) fail("REVIEW_ASSETS", "assets must be a non-empty array");
  for (const [index, asset] of config.assets.entries()) {
    if (typeof asset.label !== "string" || !asset.label.trim()) fail("REVIEW_ASSET_LABEL", `assets[${index}].label is required`);
    if (typeof asset.runDir !== "string" || path.isAbsolute(asset.runDir) || asset.runDir.includes("..")) fail("REVIEW_RUN_DIR", `assets[${index}].runDir must be a safe relative path`);
    if (asset.caseIds !== undefined) {
      if (!Array.isArray(asset.caseIds) || asset.caseIds.length === 0 || asset.caseIds.some((caseId) => typeof caseId !== "string" || !caseId.trim())) {
        fail("REVIEW_CASE_IDS", `assets[${index}].caseIds must be a non-empty string array`);
      }
      if (new Set(asset.caseIds).size !== asset.caseIds.length) fail("REVIEW_CASE_IDS_DUPLICATE", `assets[${index}].caseIds must be unique`);
    }
  }
}

function requireBatchString(value, field) {
  if (typeof value !== "string" || !value.trim()) fail("INTAKE_FIELD", `${field} is required`);
  return value.trim();
}

function normalizeBatchPath(value, field, configPath) {
  const raw = typeof value === "string" ? value : value?.path;
  requireBatchString(raw, `${field}.path`);
  return {
    label: typeof value === "object" && value.label ? String(value.label).trim() : path.basename(raw),
    path: path.resolve(path.dirname(configPath), raw),
  };
}

async function assertReadableBatchPath(entry, field) {
  try {
    const stat = await fs.stat(entry.path);
    if (!stat.isFile() && !stat.isDirectory()) fail("INTAKE_PATH", `${field} must be a file or directory`);
    if (stat.isFile() && path.extname(entry.path).toLowerCase() === ".json") await readJson(entry.path);
  } catch (error) {
    if (error.code?.startsWith("INTAKE_")) throw error;
    fail("INTAKE_PATH", `${field} is not readable: ${entry.path}`);
  }
}

function assertPercent(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    fail("INTAKE_PERCENT", `${field} must be a number from 0 to 100`);
  }
  return value;
}

function assertOptionalIsoDate(value, field) {
  if (value === undefined) return undefined;
  requireBatchString(value, field);
  if (!Number.isFinite(Date.parse(value))) fail("INTAKE_TASK", `${field} must be an ISO date-time`);
  return value;
}

async function normalizeBatchConfig(config, configPath, existing) {
  if (!config || config.schemaVersion !== "1.0") fail("INTAKE_CONFIG_SCHEMA", "batch config schemaVersion must be 1.0");
  const batchId = requireBatchString(config.batchId ?? existing?.batchId, "batchId");
  const outputDir = path.resolve(path.dirname(configPath), requireBatchString(config.outputDir ?? existing?.outputDir, "outputDir"));
  if (config.sources !== undefined && !Array.isArray(config.sources)) fail("INTAKE_SOURCES", "sources must be an array");
  if (config.resultPaths !== undefined && !Array.isArray(config.resultPaths)) fail("INTAKE_RESULT_PATHS", "resultPaths must be an array");
  const sources = config.sources === undefined
    ? existing?.sources ?? []
    : config.sources.map((source, index) => normalizeBatchPath(source, `sources[${index}]`, configPath));
  const resultPaths = config.resultPaths === undefined
    ? existing?.resultPaths ?? []
    : config.resultPaths.map((result, index) => normalizeBatchPath(result, `resultPaths[${index}]`, configPath));
  const inputAssets = config.assets;
  if (inputAssets !== undefined && (!Array.isArray(inputAssets) || inputAssets.length === 0)) {
    fail("INTAKE_ASSETS", "assets must be a non-empty array when provided");
  }
  if (inputAssets === undefined && !existing) fail("INTAKE_ASSETS", "assets are required when creating a batch");
  const existingAssetsById = new Map((existing?.assets ?? []).map((asset) => [asset.assetId, asset]));
  const assets = inputAssets === undefined
    ? existing?.assets ?? []
    : inputAssets.map(async (asset, index) => {
      const assetId = requireBatchString(asset?.assetId, `assets[${index}].assetId`);
      const previous = existingAssetsById.get(assetId);
      const label = requireBatchString(asset?.label ?? previous?.label, `assets[${index}].label`);
      if (asset.resultPaths !== undefined && !Array.isArray(asset.resultPaths)) fail("INTAKE_RESULT_PATHS", `assets[${index}].resultPaths must be an array`);
      if (asset.reviewPages !== undefined && !Array.isArray(asset.reviewPages)) fail("INTAKE_REVIEW_PAGES", `assets[${index}].reviewPages must be an array`);
      const normalizedResults = asset.resultPaths === undefined
        ? previous?.resultPaths ?? []
        : asset.resultPaths.map((result, resultIndex) => normalizeBatchPath(result, `assets[${index}].resultPaths[${resultIndex}]`, configPath));
      const reviewPages = asset.reviewPages === undefined
        ? previous?.reviewPages ?? []
        : asset.reviewPages.map((page, pageIndex) => ({
        pageId: requireBatchString(page?.pageId ?? `page-${pageIndex + 1}`, `assets[${index}].reviewPages[${pageIndex}].pageId`),
        label: requireBatchString(page?.label ?? page?.pageId ?? `page-${pageIndex + 1}`, `assets[${index}].reviewPages[${pageIndex}].label`),
        ...normalizeBatchPath(page, `assets[${index}].reviewPages[${pageIndex}]`, configPath),
        }));
      if (asset.resultPaths !== undefined) {
        for (const [resultIndex, result] of normalizedResults.entries()) await assertReadableBatchPath(result, `assets[${index}].resultPaths[${resultIndex}]`);
      }
      if (asset.reviewPages !== undefined) {
        for (const [pageIndex, page] of reviewPages.entries()) await assertReadableBatchPath(page, `assets[${index}].reviewPages[${pageIndex}]`);
      }
      return { assetId, label, resultPaths: normalizedResults, reviewPages };
    });
  const resolvedAssets = inputAssets === undefined ? assets : await Promise.all(assets);
  if (resolvedAssets.length === 0) fail("INTAKE_ASSETS", "at least one asset is required");
  if (new Set(resolvedAssets.map((asset) => asset.assetId)).size !== resolvedAssets.length) fail("INTAKE_ASSET_DUPLICATE", "assetId must be unique");
  for (const [index, source] of sources.entries()) await assertReadableBatchPath(source, `sources[${index}]`);
  for (const [index, result] of resultPaths.entries()) await assertReadableBatchPath(result, `resultPaths[${index}]`);
  if (sources.length === 0) fail("INTAKE_SOURCES", "at least one source is required");

  const weeklyInput = config.weeklyLimit;
  if (weeklyInput !== undefined && (!weeklyInput || typeof weeklyInput !== "object" || Array.isArray(weeklyInput))) {
    fail("INTAKE_WEEKLY_LIMIT", "weeklyLimit must be an object");
  }
  const existingWeekly = existing?.weeklyLimit;
  const startValue = existingWeekly?.startPercent ?? weeklyInput?.startPercent;
  if (startValue === undefined) fail("INTAKE_WEEKLY_LIMIT", "weeklyLimit.startPercent is required for a new batch");
  const startPercent = assertPercent(startValue, "weeklyLimit.startPercent");
  if (existingWeekly?.startPercent !== undefined && weeklyInput?.startPercent !== undefined
    && weeklyInput.startPercent !== existingWeekly.startPercent) {
    fail("INTAKE_WEEKLY_START_MISMATCH", "weeklyLimit.startPercent cannot change after batch creation");
  }
  const endValue = weeklyInput?.endPercent ?? existingWeekly?.endPercent ?? undefined;
  const endPercent = endValue === undefined ? null : assertPercent(endValue, "weeklyLimit.endPercent");
  const taskInput = config.task ?? {};
  const taskExisting = existing?.task ?? {};
  if (taskExisting.startedAt !== undefined && taskInput.startedAt !== undefined && taskInput.startedAt !== taskExisting.startedAt) {
    fail("INTAKE_TASK_START_MISMATCH", "task.startedAt cannot change after batch creation");
  }
  const task = {
    startedAt: assertOptionalIsoDate(taskInput.startedAt ?? taskExisting.startedAt, "task.startedAt"),
    endedAt: assertOptionalIsoDate(taskInput.endedAt ?? taskExisting.endedAt, "task.endedAt"),
    model: taskInput.model ?? taskExisting.model,
    assetCount: resolvedAssets.length,
  };
  if (!task.startedAt) fail("INTAKE_TASK", "task.startedAt is required when creating a batch");
  if (!task.model) fail("INTAKE_TASK", "task.model is required when creating a batch");
  if (task.model !== undefined) task.model = requireBatchString(task.model, "task.model");
  if (config.allReleased !== undefined && typeof config.allReleased !== "boolean") fail("INTAKE_APPROVAL", "allReleased must be boolean when provided");
  const allReleased = config.allReleased === true;
  const mergedAssets = new Map((existing?.assets ?? []).map((asset) => [asset.assetId, asset]));
  for (const asset of resolvedAssets) mergedAssets.set(asset.assetId, asset);
  const finalAssets = [...mergedAssets.values()];
  task.assetCount = finalAssets.length;
  if (allReleased) {
    if (endPercent === null) fail("INTAKE_RELEASE_INCOMPLETE", "allReleased requires weeklyLimit.endPercent");
    const incompleteAssets = finalAssets.filter((asset) => asset.resultPaths.length === 0 || asset.reviewPages.length === 0);
    if (incompleteAssets.length > 0) fail("INTAKE_RELEASE_INCOMPLETE", `allReleased requires resultPaths and reviewPages for every asset: ${incompleteAssets.map((asset) => asset.assetId).join(", ")}`);
  }
  return {
    schemaVersion: "1.0",
    batchId,
    title: config.title ?? existing?.title ?? batchId,
    outputDir,
    status: allReleased ? "user-approved" : "awaiting-complete-user-review",
    promotionEligible: allReleased,
    sources,
    resultPaths,
    assets: finalAssets,
    reviewPages: finalAssets.flatMap((asset) => asset.reviewPages.map((page) => ({ assetId: asset.assetId, assetLabel: asset.label, ...page }))),
    weeklyLimit: {
      startPercent,
      endPercent,
      consumedPercentagePoints: endPercent === null ? null : startPercent - endPercent,
      inputSource: "user-or-maintainer-provided",
    },
    task,
    updatedAt: new Date().toISOString(),
  };
}

function linkPath(entry) {
  return `[${entry.label}](<${entry.path.replaceAll("\\", "/")}>)`;
}

function renderBatchMarkdown(record) {
  const statusText = record.status === "user-approved" ? "已获整批用户确认" : "等待整批用户验收";
  const lines = [
    `# ${record.title}：入库批次 ${record.batchId}`,
    "",
    `- 批次状态：**${statusText}**`,
    `- 核心库晋升：${record.promotionEligible ? "后续操作仍需完成；本工具不修改核心 registry" : "未获得整批用户确认"}`,
    `- 资产数量：${record.assets.length}`,
    `- 待看页面数量：${record.reviewPages.length}`,
    "",
    "## 来源",
    "",
    ...(record.sources.length === 0 ? ["- 待补录"] : record.sources.map((source) => `- ${linkPath(source)}`)),
    "",
    "## 主要结果路径",
    "",
    ...(record.resultPaths.length === 0 ? ["- 待生成"] : record.resultPaths.map((result) => `- ${linkPath(result)}`)),
    "",
    "## 资产与全部待看页面",
    "",
  ];
  for (const asset of record.assets) {
    lines.push(
      `### ${asset.assetId}：${asset.label}`,
      "",
      "结果路径：",
      ...(asset.resultPaths.length === 0 ? ["- 待生成"] : asset.resultPaths.map((result) => `- ${linkPath(result)}`)),
      "",
      `待看页面（${asset.reviewPages.length}）：`,
    );
    if (asset.reviewPages.length === 0) lines.push("- 待生成");
    else for (const page of asset.reviewPages) lines.push(`- [ ] ${page.pageId}：${linkPath(page)}`);
    lines.push("");
  }
  lines.push(
    "## 周限剩余（用户提供）",
    "",
    `- 开始时剩余：${record.weeklyLimit.startPercent}%`,
    `- 当前结束时剩余：${record.weeklyLimit.endPercent === null ? "未提供" : `${record.weeklyLimit.endPercent}%`}`,
    ...(record.weeklyLimit.consumedPercentagePoints === null
      ? []
      : [`- 本批百分点消耗：${record.weeklyLimit.consumedPercentagePoints} 个百分点（开始值－结束值）`]),
    "- 数据来源：用户或维护者手工提供；工具不会读取或声称读取 Codex 账户周限。",
    "",
    "## 任务信息",
    "",
    `- 执行模型：${record.task.model ?? "未提供"}`,
    `- 开始时间：${record.task.startedAt ?? "未提供"}`,
    `- 结束时间：${record.task.endedAt ?? "未提供（待补录）"}`,
    `- 资产数量：${record.task.assetCount}`,
    "",
    record.promotionEligible
      ? "用户已明确确认本批全部资产可放行；核心库晋升仍由后续操作完成。"
      : "在用户明确确认本批全部资产前，本批不得视为已确认或已晋升。",
    "",
  );
  return lines.join("\n");
}

async function runBatch(config, configPath) {
  const outputDir = path.resolve(path.dirname(configPath), requireBatchString(config.outputDir, "outputDir"));
  const batchPath = path.join(outputDir, "batch.json");
  let existing;
  try {
    existing = await readJson(batchPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing && config.batchId !== existing.batchId) {
    fail("INTAKE_BATCH_ID_MISMATCH", `existing batchId is ${existing.batchId}; refusing update for ${config.batchId ?? "missing batchId"}`);
  }
  const record = await normalizeBatchConfig(config, configPath, existing);
  await fs.mkdir(outputDir, { recursive: true });
  await writeJson(batchPath, record);
  const markdownPath = path.join(outputDir, "用户验收.md");
  await writeText(markdownPath, renderBatchMarkdown(record));
  process.stdout.write(`${JSON.stringify({ status: record.status, batchId: record.batchId, assetCount: record.assets.length, reviewPageCount: record.reviewPages.length, consumedPercentagePoints: record.weeklyLimit.consumedPercentagePoints, batchPath, markdownPath }, null, 2)}\n`);
}

async function resolveEvidence(sourceRoot, artifact) {
  if (!artifact || typeof artifact.path !== "string") fail("REVIEW_EVIDENCE", "case evidence path is missing");
  const absolute = path.resolve(sourceRoot, artifact.path);
  if (!inside(sourceRoot, absolute)) fail("REVIEW_EVIDENCE_ESCAPE", `evidence escapes sourceRoot: ${artifact.path}`);
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) fail("REVIEW_EVIDENCE_NOT_FILE", artifact.path);
  return absolute;
}

async function loadCases(config) {
  const sourceRoot = await fs.realpath(config.sourceRoot);
  const pages = [];
  for (const asset of config.assets) {
    const runDir = path.resolve(sourceRoot, asset.runDir);
    if (!inside(sourceRoot, runDir)) fail("REVIEW_RUN_ESCAPE", asset.runDir);
    const runRoot = await fs.realpath(runDir);
    if (!inside(sourceRoot, runRoot)) fail("REVIEW_RUN_REALPATH_ESCAPE", asset.runDir);
    const index = await readJson(path.join(runRoot, "review-index.json"));
    if (!Array.isArray(index.cases) || index.cases.length !== index.summary?.renderCaseCount) fail("REVIEW_CASE_COUNT", `${asset.label} review-index case count mismatch`);
    const indexedCases = new Map(index.cases.map((item) => [item.caseId, item]));
    const selectedCases = asset.caseIds
      ? asset.caseIds.map((caseId) => indexedCases.get(caseId) ?? fail("REVIEW_CASE_ID_UNKNOWN", `${asset.label} has no case ${caseId}`))
      : index.cases;
    for (const item of selectedCases) {
      if (!item.skin?.png || !item.standalone?.png) fail("REVIEW_CASE_PAIR", `${asset.label}/${item.caseId} lacks paired evidence`);
      pages.push({
        sequence: pages.length + 1,
        assetId: item.assetId,
        assetLabel: asset.label,
        runId: index.runId,
        caseId: item.caseId,
        skinPageNumber: item.skin.pageNumber,
        standalonePageNumber: item.standalone.pageNumber,
        skinPath: await resolveEvidence(sourceRoot, item.skin.png),
        standalonePath: await resolveEvidence(sourceRoot, item.standalone.png),
      });
    }
  }
  return { sourceRoot, pages };
}

async function buildDeck(pages, context, outputPath) {
  const { Presentation, PresentationFile } = await import("@oai/artifact-tool");
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  for (const page of pages) {
    const slide = deck.slides.add();
    slide.images.add({
      blob: await imageBytes(context === "skin" ? page.skinPath : page.standalonePath),
      contentType: "image/png",
      alt: `${page.assetLabel} ${page.caseId} ${context}`,
      fit: "fill",
      position: { left: 0, top: 0, width: 1280, height: 720 },
    });
  }
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(outputPath);
}

async function main() {
  const { mode, configPath } = parseArgs(process.argv.slice(2));
  const config = await readJson(configPath);
  if (mode === "batch") {
    await runBatch(config, configPath);
    return;
  }
  assertConfig(config);
  const { pages } = await loadCases(config);
  if (pages.length === 0) fail("REVIEW_NO_PAGES", "no render pages found");

  const outputParent = path.dirname(config.outputDir);
  await fs.mkdir(outputParent, { recursive: true });
  await fs.mkdir(config.outputDir, { recursive: false });
  const skinPngDir = path.join(config.outputDir, "逐页PNG", "Skin");
  const standalonePngDir = path.join(config.outputDir, "逐页PNG", "独立版");
  await fs.mkdir(skinPngDir, { recursive: true });
  await fs.mkdir(standalonePngDir, { recursive: true });

  const manifestPages = [];
  for (const page of pages) {
    const stem = `${String(page.sequence).padStart(3, "0")}_${page.assetId}_${page.caseId}.png`;
    const skinRelative = path.join("逐页PNG", "Skin", stem);
    const standaloneRelative = path.join("逐页PNG", "独立版", stem);
    await fs.copyFile(page.skinPath, path.join(config.outputDir, skinRelative), fsConstants.COPYFILE_EXCL);
    await fs.copyFile(page.standalonePath, path.join(config.outputDir, standaloneRelative), fsConstants.COPYFILE_EXCL);
    manifestPages.push({
      sequence: page.sequence,
      assetId: page.assetId,
      assetLabel: page.assetLabel,
      runId: page.runId,
      caseId: page.caseId,
      skinPageNumber: page.skinPageNumber,
      standalonePageNumber: page.standalonePageNumber,
      skinPng: skinRelative.replaceAll(path.sep, "/"),
      standalonePng: standaloneRelative.replaceAll(path.sep, "/"),
    });
  }

  await buildDeck(pages, "skin", path.join(config.outputDir, "逐页验收-Skin.pptx"));
  await buildDeck(pages, "standalone", path.join(config.outputDir, "逐页验收-独立版.pptx"));

  const manifest = {
    schemaVersion: "1.0",
    batchId: config.batchId,
    status: "awaiting-complete-user-review",
    reviewRule: "Only an explicit whole-batch approval can release this batch. Silence or partial approval is not approval.",
    scopeRule: "Primary review contains distinct user-facing topology states. Text-pressure and invalid-input cases remain in QA evidence unless they change the visible layout.",
    pageCount: manifestPages.length,
    pages: manifestPages,
  };
  await writeJsonExclusive(path.join(config.outputDir, "review-manifest.json"), manifest);

  const checklist = [
    `# ${config.title ?? config.batchId}：逐页验收清单`,
    "",
    `- 批次状态：待用户完整审核`,
    `- Skin 页面：${manifestPages.length} 页`,
    "- 放行规则：只有用户明确表示“本批全部放行/全部可以入库”才算批准。未提及、未点名或部分认可均不算批准。",
    "- 呈现范围：主验收只展示会改变真实视觉效果的拓扑状态；纯文字压力和非法输入留在 QA 证据中。",
    "- 返工规则：只修改有问题的资产，但下一轮必须重新呈现本清单全部主验收页面，顺序保持稳定。",
    "",
    ...manifestPages.map((page) => `- [ ] ${String(page.sequence).padStart(3, "0")} · ${page.assetLabel} · ${page.caseId} · ${page.runId}`),
    "",
  ].join("\n");
  await writeTextExclusive(path.join(config.outputDir, "验收清单.md"), checklist);

  process.stdout.write(`${JSON.stringify({ status: manifest.status, batchId: manifest.batchId, pageCount: manifest.pageCount, outputDir: config.outputDir }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", code: error.code ?? "REVIEW_BUILD_FAILED", message: error.message }, null, 2)}\n`);
  process.exitCode = 1;
});
