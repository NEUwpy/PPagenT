import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--config") fail("REVIEW_ARGS", "usage: node src/tools/build-intake-user-review.mjs --config <review-batch.json>");
  return path.resolve(argv[1]);
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
  const configPath = parseArgs(process.argv.slice(2));
  const config = await readJson(configPath);
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
