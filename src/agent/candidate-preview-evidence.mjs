import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const indexPromises = new Map();
const renderJobs = new Map();

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildPreviewIndex(root) {
  const assetsRoot = path.join(path.resolve(root), "assets");
  const index = new Map();
  let categories = [];
  try {
    categories = await fs.readdir(assetsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return index;
    throw error;
  }
  for (const category of categories) {
    if (!category.isDirectory() || category.name.startsWith("_")) continue;
    const categoryPath = path.join(assetsRoot, category.name);
    for (const asset of await fs.readdir(categoryPath, { withFileTypes: true })) {
      if (!asset.isDirectory() || asset.name.startsWith("_")) continue;
      const assetDir = path.join(categoryPath, asset.name);
      const manifestPath = path.join(assetDir, "asset.json");
      if (!(await exists(manifestPath))) continue;
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        const previewPath = path.join(assetDir, "example", "slide-01.png");
        const deckPath = path.join(assetDir, manifest.showcase ?? "example.pptx");
        if (manifest.id) index.set(manifest.id, {
          previewPath: await exists(previewPath) ? previewPath : null,
          deckPath: await exists(deckPath) ? deckPath : null,
        });
      } catch {
        // A malformed manifest is reported by the asset audit; visual evidence stays best-effort.
      }
    }
  }
  return index;
}

async function previewIndex(root) {
  const key = path.resolve(root);
  if (!indexPromises.has(key)) indexPromises.set(key, buildPreviewIndex(key));
  return indexPromises.get(key);
}

function renderPreviewDeck(root, deckPath, outputDir) {
  return new Promise((resolve, reject) => {
    const toolPath = path.join(path.resolve(root), "src", "tools", "render-pptx-evidence.mjs");
    const child = spawn(process.execPath, [toolPath, deckPath, outputDir], {
      cwd: path.resolve(root),
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`candidate preview renderer exited with ${code}: ${stderr}`));
    });
  });
}

async function ensurePreview(root, assetId, record) {
  if (record?.previewPath && await exists(record.previewPath)) return record.previewPath;
  if (!record?.deckPath || !(await exists(record.deckPath))) return null;
  const cacheKey = crypto.createHash("sha256").update(`${assetId}\0${record.deckPath}`).digest("hex").slice(0, 20);
  const outputDir = path.join(path.resolve(root), ".tmp", "visual-director-candidate-previews", cacheKey);
  const previewPath = path.join(outputDir, "slide-01.png");
  const [deckStat, previewStat] = await Promise.all([
    fs.stat(record.deckPath),
    fs.stat(previewPath).catch(() => null),
  ]);
  if (previewStat && previewStat.mtimeMs >= deckStat.mtimeMs) return previewPath;
  if (!renderJobs.has(cacheKey)) {
    renderJobs.set(cacheKey, (async () => {
      await fs.mkdir(outputDir, { recursive: true });
      await renderPreviewDeck(root, record.deckPath, outputDir);
      return previewPath;
    })().finally(() => renderJobs.delete(cacheKey)));
  }
  try {
    return await renderJobs.get(cacheKey);
  } catch {
    return null;
  }
}

async function resolvePreviewBatch(root, items, concurrency = 3) {
  const results = [];
  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency);
    results.push(...await Promise.all(batch.map(async (item) => ({
      ...item,
      previewPath: await ensurePreview(root, item.assetId, item.record),
    }))));
  }
  return results;
}

export async function collectVisualDirectorEvidence({
  root,
  candidateSets = [],
  previousRenderResult = null,
  pageIds = [],
  maxImages = 12,
}) {
  const entries = [];
  const imagePaths = [];
  const push = async (filePath, entry) => {
    if (!filePath || imagePaths.length >= maxImages || !(await exists(filePath))) return;
    const resolved = path.resolve(filePath);
    if (imagePaths.includes(resolved)) return;
    imagePaths.push(resolved);
    entries.push({ imageIndex: imagePaths.length, ...entry });
  };

  await push(previousRenderResult?.montage, {
    kind: "previous-deck-montage",
    purpose: "检查上一轮整套页面的节奏、重复和视觉重心",
  });
  if (!previousRenderResult?.montage) {
    const pageIdSet = new Set(pageIds);
    for (const [index, evidencePath] of (previousRenderResult?.pageEvidence ?? []).entries()) {
      const pageId = previousRenderResult?.pageIds?.[index];
      if (pageId && pageIdSet.size && !pageIdSet.has(pageId)) continue;
      await push(evidencePath, {
        kind: "previous-page-render",
        ...(pageId ? { pageId } : {}),
        purpose: "检查上一轮页面的构图与文字承载",
      });
    }
  }

  const previews = await previewIndex(root);
  const seenAssets = new Set();
  const candidatePreviews = [];
  for (const set of candidateSets) {
    for (const candidate of set.candidates ?? []) {
      if (!candidate.assetId || seenAssets.has(candidate.assetId)) continue;
      seenAssets.add(candidate.assetId);
      candidatePreviews.push({
        assetId: candidate.assetId,
        structureGroupId: candidate.structureGroupId,
        pageIds: candidateSets.filter((item) => item.candidates?.some((entry) => entry.assetId === candidate.assetId)).map((item) => item.pageId),
        record: previews.get(candidate.assetId),
      });
    }
  }
  const remaining = Math.max(0, maxImages - imagePaths.length);
  const resolvedPreviews = await resolvePreviewBatch(root, candidatePreviews.slice(0, remaining));
  for (const candidate of resolvedPreviews) {
    await push(candidate.previewPath, {
      kind: "candidate-structure-preview",
      assetId: candidate.assetId,
      structureGroupId: candidate.structureGroupId,
      pageIds: candidate.pageIds,
      purpose: "查看已登记 Structure Group 的真实视觉形态，不把预览文字当作当前稿件事实",
    });
  }
  return { imagePaths, entries };
}
