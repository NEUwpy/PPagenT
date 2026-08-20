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
const sampleRoot = path.join(root, "结构样本池");
const coreAssets = await discoverAssetManifestEntries(root, "assets");
const sampleRegistryPath = path.join(sampleRoot, "registry.json");
const sampleRegistryAvailable = await exists(sampleRegistryPath);
const sampleRegistry = sampleRegistryAvailable ? await readJson(sampleRegistryPath) : { samples: [] };
const logicMap = await readJson(path.join(root, "catalog", "logic-map.json"));

const assetIds = new Set();
const coreIds = new Set();
const pendingReviewIds = new Set();
for (const entry of coreAssets) {
  if (assetIds.has(entry.id)) issues.push(`重复资产 ID: ${entry.id}`);
  assetIds.add(entry.id);
  const isCore = entry.status === "core";
  const isPendingReview = entry.status === "pending-review";
  if (isCore) coreIds.add(entry.id);
  else if (isPendingReview) pendingReviewIds.add(entry.id);
  else issues.push(`资产状态错误: ${entry.id}/${entry.status ?? "未声明"}`);
  if (!entry.layoutExpansion || !new Set(["fixed", "responsive"]).has(entry.layoutExpansion.mode)) {
    issues.push(`核心资产缺少版式扩散模式: ${entry.id}`);
  }
  if (!entry.layoutExpansion?.range?.trim()) issues.push(`核心资产缺少版式扩散范围: ${entry.id}`);
  if (!entry.layoutExpansion?.rule?.trim()) issues.push(`核心资产缺少版式扩散规则: ${entry.id}`);
  const directory = entry.directory;
  const metadata = entry.metadata;
  for (const name of isCore ? ["generate.mjs"] : ["review.mjs", "component.css", "visual-intent.md"]) {
    if (!(await exists(path.join(directory, name)))) issues.push(`${isCore ? "核心资产" : "待确认资产"}缺少 ${name}: ${entry.id}`);
  }
  if (metadata.status !== entry.status) issues.push(`资产元数据状态错误: ${entry.id}`);
  if (isPendingReview && metadata.runtime?.renderer !== "html-component") issues.push(`待确认资产必须使用 HTML 路线: ${entry.id}`);
  if (isPendingReview && await exists(path.join(directory, "user-approval.json"))) issues.push(`待确认资产不应已有用户确认记录: ${entry.id}`);
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
const logics = Array.isArray(logicMap.logics) ? logicMap.logics : [];
const logicIds = new Set();
const logicNames = new Set();
const knownAssetIds = new Set(coreIds);
if (!logics.length) issues.push("Logic 能力地图为空");
for (const logic of logics) {
  if (!logic.id?.trim()) issues.push("Logic 缺少 ID");
  else if (logicIds.has(logic.id)) issues.push(`重复 Logic ID: ${logic.id}`);
  else logicIds.add(logic.id);
  if (!logic.name?.trim()) issues.push(`Logic 缺少名称: ${logic.id ?? "未知"}`);
  else if (logicNames.has(logic.name)) issues.push(`重复 Logic 名称: ${logic.name}`);
  else logicNames.add(logic.name);
  if (!logic.description?.trim()) issues.push(`Logic 缺少逻辑说明: ${logic.id ?? "未知"}`);
  if (!Array.isArray(logic.assetIds)) issues.push(`Logic assetIds 必须是数组: ${logic.id ?? "未知"}`);
  for (const assetId of logic.assetIds ?? []) {
    if (!knownAssetIds.has(assetId)) issues.push(`Logic 引用未知资产: ${logic.id}/${assetId}`);
  }
}
for (const entry of coreAssets) {
  if (entry.metadata.kind !== "component") continue;
  const logicId = entry.metadata.runtime?.logicId;
  const logic = logics.find((item) => item.id === logicId);
  if (!logic) issues.push(`结构资产未登记 Logic 槽位: ${entry.id}/${logicId ?? "未声明"}`);
  else if (coreIds.has(entry.id) && !logic.assetIds.includes(entry.id)) issues.push(`核心结构资产未填入对应 Logic: ${entry.id}/${logicId}`);
  else if (pendingReviewIds.has(entry.id) && logic.assetIds.includes(entry.id)) issues.push(`待确认结构资产不应提前填入 Logic: ${entry.id}/${logicId}`);
}

const pendingFiles = await walkFiles(path.join(sampleRoot, "待归类"));
if (pendingFiles.length) issues.push(`待归类目录仍有文件: ${pendingFiles.length}`);

const report = {
  status: issues.length ? "failed" : "passed",
  mode,
  assetCount: coreAssets.length,
  coreAssetCount: coreIds.size,
  pendingReviewAssetCount: pendingReviewIds.size,
  sampleCount: sampleRegistry.samples.length,
  familyCount: sampleFamilies.size,
  familyCounts,
  sourceCounts,
  issues,
};
console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
