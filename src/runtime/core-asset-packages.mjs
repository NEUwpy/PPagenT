import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const defaultRoot = path.resolve(import.meta.dirname, "../..");
const cache = new Map();

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function inside(parent, target) {
  const relative = path.relative(parent, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function discoverManifestPaths(root) {
  const assetsRoot = path.join(root, "assets");
  const categories = await fs.readdir(assetsRoot, { withFileTypes: true });
  const paths = [];
  for (const category of categories.filter((entry) => entry.isDirectory())) {
    const categoryRoot = path.join(assetsRoot, category.name);
    const entries = await fs.readdir(categoryRoot, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory())) {
      paths.push(path.join(categoryRoot, entry.name, "asset.json"));
    }
  }
  return paths.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function loadPackage(manifestPath) {
  let asset;
  try {
    asset = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (asset.status !== "core" || !asset.runtime) return null;

  const runtime = asset.runtime;
  requireValue(typeof asset.id === "string" && asset.id, `${manifestPath} 缺少资产 id`);
  requireValue(typeof runtime.entry === "string" && runtime.entry, `${asset.id} 缺少 runtime.entry`);
  requireValue(typeof runtime.builderExport === "string" && runtime.builderExport, `${asset.id} 缺少 builderExport`);
  requireValue(typeof runtime.mapperExport === "string" && runtime.mapperExport, `${asset.id} 缺少 mapperExport`);
  requireValue(typeof runtime.familyId === "string" && runtime.familyId, `${asset.id} 缺少 familyId`);
  requireValue(typeof runtime.variantId === "string" && runtime.variantId, `${asset.id} 缺少 variantId`);
  requireValue(typeof runtime.silhouette === "string" && runtime.silhouette, `${asset.id} 缺少 silhouette`);
  requireValue(Array.isArray(runtime.supportedBaseRelations), `${asset.id} 缺少 supportedBaseRelations`);
  requireValue(Number.isInteger(runtime.itemCount?.min) && Number.isInteger(runtime.itemCount?.max), `${asset.id} 缺少 itemCount 范围`);

  const assetDir = path.dirname(manifestPath);
  const entryPath = path.resolve(assetDir, runtime.entry);
  requireValue(inside(assetDir, entryPath), `${asset.id} 的运行入口必须位于资产目录内`);
  const module = await import(pathToFileURL(entryPath).href);
  const builder = module[runtime.builderExport];
  const mapper = module[runtime.mapperExport];
  requireValue(typeof builder === "function", `${asset.id} 没有导出 ${runtime.builderExport}`);
  requireValue(typeof mapper === "function", `${asset.id} 没有导出 ${runtime.mapperExport}`);

  return { assetId: asset.id, asset, assetDir, manifestPath, runtime, builder, mapper };
}

export async function discoverCoreAssetPackages(root = defaultRoot) {
  const resolvedRoot = path.resolve(root);
  if (!cache.has(resolvedRoot)) {
    cache.set(resolvedRoot, (async () => {
      const packages = (await Promise.all((await discoverManifestPaths(resolvedRoot)).map(loadPackage)))
        .filter(Boolean);
      const ids = new Set();
      for (const item of packages) {
        requireValue(!ids.has(item.assetId), `核心资产包 id 重复：${item.assetId}`);
        ids.add(item.assetId);
      }
      return packages.sort((left, right) => left.assetId.localeCompare(right.assetId));
    })());
  }
  return cache.get(resolvedRoot);
}

export async function coreAssetPackageMap(root = defaultRoot) {
  return new Map((await discoverCoreAssetPackages(root)).map((item) => [item.assetId, item]));
}
