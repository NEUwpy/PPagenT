import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { discoverAssetManifestEntries } from "./asset-manifest-inventory.mjs";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const root = path.resolve(process.argv[2] ?? process.cwd());
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "public";
if (!new Set(["public", "local"]).has(mode)) throw new Error(`未知审计模式: ${mode}`);

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

async function slideCount(target) {
  const zip = await JSZip.loadAsync(await fs.readFile(target));
  return Object.keys(zip.files).filter((name) => {
    if (!name.startsWith("ppt/slides/slide") || !name.endsWith(".xml")) return false;
    return Number.isInteger(Number(name.slice(16, -4)));
  }).length;
}

async function walkFiles(directory) {
  const output = [];
  if (!(await exists(directory))) return output;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(target));
    else output.push(target);
  }
  return output;
}

const issues = [];
const coreRoot = path.join(root, "assets");
const candidateRoot = path.join(root, "备选资产");
const sampleRoot = path.join(root, "结构样本池");
const candidateAssets = await discoverAssetManifestEntries(root, "备选资产");
const coreAssets = await discoverAssetManifestEntries(root, "assets");
const sampleRegistry = await readJson(path.join(sampleRoot, "registry.json"));
const coverage = await readJson(path.join(root, "catalog", "family-candidate-coverage.json"));

const candidateIds = new Set();
let structureCandidates = 0;
for (const entry of candidateAssets) {
  if (candidateIds.has(entry.id)) issues.push(`重复备选 ID: ${entry.id}`);
  candidateIds.add(entry.id);
  if (entry.category === "结构图") structureCandidates += 1;
  const directory = entry.directory;
  const metadata = entry.metadata;
  for (const name of ["generate.mjs"]) {
    if (!(await exists(path.join(directory, name)))) issues.push(`备选缺少 ${name}: ${entry.id}`);
  }
  if (entry.category === "结构图" && !metadata.capacity && !metadata.boundary) issues.push(`结构图缺少容量边界: ${entry.id}`);
  const sourceFile = typeof metadata.source === "string" ? metadata.source : metadata.source?.file;
  if (!sourceFile) issues.push(`备选缺少来源: ${entry.id}`);
  else if (mode === "local" && !(await exists(path.join(root, sourceFile)))) issues.push(`备选来源不存在: ${entry.id}`);
  const showcase = metadata.showcase ? path.join(directory, metadata.showcase) : null;
  if (showcase && !(await exists(showcase))) issues.push(`备选声明的示例不存在: ${entry.id}/${metadata.showcase}`);
  if (showcase && await exists(showcase)) {
    const count = await slideCount(showcase);
    if (count < 1) issues.push(`备选示例没有页面: ${entry.id}`);
  }
}

const coreIds = new Set();
for (const entry of coreAssets) {
  if (coreIds.has(entry.id)) issues.push(`重复核心资产 ID: ${entry.id}`);
  coreIds.add(entry.id);
  if (entry.status !== "core") issues.push(`核心资产状态错误: ${entry.id}`);
  if (!entry.layoutExpansion || !new Set(["fixed", "responsive"]).has(entry.layoutExpansion.mode)) {
    issues.push(`核心资产缺少版式扩散模式: ${entry.id}`);
  }
  if (!entry.layoutExpansion?.range?.trim()) issues.push(`核心资产缺少版式扩散范围: ${entry.id}`);
  if (!entry.layoutExpansion?.rule?.trim()) issues.push(`核心资产缺少版式扩散规则: ${entry.id}`);
  const directory = entry.directory;
  const metadata = entry.metadata;
  for (const name of ["generate.mjs"]) {
    if (!(await exists(path.join(directory, name)))) issues.push(`核心资产缺少 ${name}: ${entry.id}`);
  }
  if (metadata.status !== "core") issues.push(`核心资产元数据状态错误: ${entry.id}`);
  if (metadata.kind === "component" && !metadata.spatialContract) issues.push(`核心结构资产缺少空间契约: ${entry.id}`);
  const sourceFile = typeof metadata.source === "string" ? metadata.source : metadata.source?.file;
  if (!sourceFile) issues.push(`核心资产缺少可追溯来源: ${entry.id}`);
  else if (mode === "local" && !(await exists(path.join(root, sourceFile)))) issues.push(`核心资产来源不存在: ${entry.id}`);
  const showcase = metadata.showcase ? path.join(directory, metadata.showcase) : null;
  if (showcase && !(await exists(showcase))) issues.push(`核心资产声明的示例不存在: ${entry.id}/${metadata.showcase}`);
  if (showcase && await exists(showcase)) {
    const count = await slideCount(showcase);
    if (count < 1) issues.push(`核心资产示例没有页面: ${entry.id}`);
  }
}

const sampleIds = new Set();
const sourceCounts = {};
const familyCounts = {};
for (const entry of sampleRegistry.samples) {
  if (sampleIds.has(entry.id)) issues.push(`重复样本 ID: ${entry.id}`);
  sampleIds.add(entry.id);
  const metadataPath = path.join(sampleRoot, entry.path);
  if (!(await exists(metadataPath))) { issues.push(`样本元数据不存在: ${entry.id}`); continue; }
  const metadata = await readJson(metadataPath);
  const preview = path.join(sampleRoot, metadata.preview);
  const pptx = path.join(sampleRoot, metadata.singleSlidePptx);
  if (mode === "local" && !(await exists(preview))) issues.push(`样本预览不存在: ${entry.id}`);
  if (mode === "local" && !(await exists(pptx))) issues.push(`样本 PPT 不存在: ${entry.id}`);
  else if (mode === "local" && await slideCount(pptx) !== 1) issues.push(`样本 PPT 不是单页: ${entry.id}`);
  if (entry.pptxStatus !== "ready" || metadata.pptxStatus !== "ready") issues.push(`样本仍未就绪: ${entry.id}`);
  const family = entry.families?.[0];
  if (!family || family === "待归类") issues.push(`样本未归类: ${entry.id}`);
  else familyCounts[family] = (familyCounts[family] ?? 0) + 1;
  const source = metadata.source?.file;
  if (!source) issues.push(`样本缺少来源: ${entry.id}`);
  else {
    if (mode === "local" && !(await exists(path.join(root, source)))) issues.push(`样本来源不存在: ${entry.id}`);
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
  }
}

const sampleFamilies = new Set(Object.keys(familyCounts));
const coverageFamilies = new Set(Object.keys(coverage.coverage));
for (const family of sampleFamilies) {
  const ids = coverage.coverage[family] ?? [];
  if (!ids.length) issues.push(`功能家族无候选覆盖: ${family}`);
  for (const id of ids) if (!candidateIds.has(id)) issues.push(`覆盖映射引用未知备选: ${family}/${id}`);
}
for (const family of coverageFamilies) if (!sampleFamilies.has(family)) issues.push(`覆盖映射存在未知家族: ${family}`);

const candidateFiles = await walkFiles(candidateRoot);
const inspectFiles = candidateFiles.filter((file) => file.endsWith(".inspect.ndjson"));
if (inspectFiles.length) issues.push(`备选资产残留调试文件: ${inspectFiles.length}`);
const pendingFiles = await walkFiles(path.join(sampleRoot, "待归类"));
if (pendingFiles.length) issues.push(`待归类目录仍有文件: ${pendingFiles.length}`);

const report = {
  status: issues.length ? "failed" : "passed",
  mode,
  candidateCount: candidateAssets.length,
  coreAssetCount: coreAssets.length,
  structureCandidateCount: structureCandidates,
  sampleCount: sampleRegistry.samples.length,
  familyCount: sampleFamilies.size,
  familyCounts,
  sourceCounts,
  issues,
};
console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
