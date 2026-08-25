import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectHtmlComponentEligibility } from "./html-component-eligibility.mjs";
import { summarizeTextRegionContract } from "../visual-runtime/typography-matcher.mjs";

const defaultRoot = path.resolve(import.meta.dirname, "../..");
const indexCache = new Map();
const packageCache = new Map();

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

function validateManifest(asset, manifestPath) {
  const runtime = asset.runtime;
  const renderer = runtime.renderer;
  requireValue(new Set(["skin", "html-component", "legacy-builder"]).has(renderer), `${asset.id} 的 runtime.renderer 非法或缺失`);
  requireValue(typeof asset.id === "string" && asset.id, `${manifestPath} 缺少资产 id`);
  requireValue(typeof runtime.entry === "string" && runtime.entry, `${asset.id} 缺少 runtime.entry`);
  requireValue(typeof runtime.mapperExport === "string" && runtime.mapperExport, `${asset.id} 缺少 mapperExport`);
  if (renderer !== "skin") requireValue(typeof runtime.logicId === "string" && runtime.logicId, `${asset.id} 缺少 logicId`);
  if (renderer !== "skin") requireValue(typeof runtime.structureGroupId === "string" && runtime.structureGroupId, `${asset.id} 缺少 structureGroupId`);
  requireValue(typeof runtime.familyId === "string" && runtime.familyId, `${asset.id} 缺少 familyId`);
  requireValue(typeof runtime.variantId === "string" && runtime.variantId, `${asset.id} 缺少 variantId`);
  requireValue(typeof runtime.silhouette === "string" && runtime.silhouette, `${asset.id} 缺少 silhouette`);
  requireValue(Array.isArray(runtime.supportedBaseRelations), `${asset.id} 缺少 supportedBaseRelations`);
  requireValue(Number.isInteger(runtime.itemCount?.min) && Number.isInteger(runtime.itemCount?.max), `${asset.id} 缺少 itemCount 范围`);
  if (runtime.contentContract) {
    requireValue(runtime.contentContract.itemRole === "semantic-node", `${asset.id} 的 contentContract.itemRole 必须是 semantic-node`);
    requireValue(new Set(["forbidden", "optional", "required"]).has(runtime.contentContract.points), `${asset.id} 的 contentContract.points 非法`);
    if (runtime.contentContract.bindings) {
      requireValue(Array.isArray(runtime.contentContract.bindings), `${asset.id} 的 contentContract.bindings 必须是数组`);
      for (const binding of runtime.contentContract.bindings) {
        requireValue(typeof binding.id === "string" && binding.id, `${asset.id} 的 binding 缺少 id`);
        requireValue(binding.scope === "per-component-item", `${asset.id}:${binding.id} 的 binding.scope 暂只支持 per-component-item`);
        requireValue(binding.valueType === "text-list", `${asset.id}:${binding.id} 的 binding.valueType 暂只支持 text-list`);
        requireValue(Number.isInteger(binding.minItems) && Number.isInteger(binding.maxItems)
          && binding.minItems >= 1 && binding.maxItems >= binding.minItems,
        `${asset.id}:${binding.id} 的条目范围非法`);
        requireValue(Number.isInteger(binding.maxChars) && binding.maxChars > 0, `${asset.id}:${binding.id} 缺少 maxChars`);
        requireValue(binding.grounding === "source-fragment", `${asset.id}:${binding.id} 的 grounding 非法`);
      }
    }
  }
  if (runtime.slotContract) {
    requireValue(runtime.slotContract.schemaVersion === "1.0", `${asset.id} 的 slotContract.schemaVersion 非法`);
    requireValue(runtime.slotContract.coordinateSpace === "design-frame", `${asset.id} 的 slotContract.coordinateSpace 必须是 design-frame`);
    requireValue(typeof runtime.slotContract.resolverExport === "string" && runtime.slotContract.resolverExport, `${asset.id} 的 slotContract 缺少 resolverExport`);
    requireValue(typeof runtime.slotContract.binding === "string" && runtime.slotContract.binding, `${asset.id} 的 slotContract 缺少 binding`);
    requireValue(runtime.slotContract.maxDepth === 1, `${asset.id} 的 slotContract.maxDepth 当前只允许 1`);
    requireValue(runtime.slotContract.childPolicy === "registered-core-only", `${asset.id} 的 slotContract.childPolicy 必须是 registered-core-only`);
    requireValue(runtime.slotContract.fallback === "plain-text", `${asset.id} 的 slotContract.fallback 必须是 plain-text`);
  }
}

async function loadDescriptor(manifestPath) {
  let asset;
  try {
    asset = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (asset.status !== "core" || !asset.runtime) return null;
  validateManifest(asset, manifestPath);
  const assetDir = path.dirname(manifestPath);
  if (asset.runtime.renderer === "html-component") {
    const eligibility = await inspectHtmlComponentEligibility(assetDir, asset.id);
    if (!eligibility.eligible) return null;
  }
  const entryPath = path.resolve(assetDir, asset.runtime.entry);
  requireValue(inside(assetDir, entryPath), `${asset.id} 的运行入口必须位于资产目录内`);
  return {
    assetId: asset.id,
    asset,
    assetDir,
    manifestPath,
    entryPath,
    runtime: asset.runtime,
    textCapacity: asset.runtime.textCapacity ?? null,
    textFlow: asset.runtime.textFlow ?? null,
  };
}

async function loadGeneratedTextFlow(assetDir) {
  try {
    const contract = JSON.parse(await fs.readFile(path.join(assetDir, "slot-contract.json"), "utf8"));
    return contract.textFlow ?? null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadGeneratedSlotContract(assetDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(assetDir, "slot-contract.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Lightweight discovery: reads asset.json and approval metadata only.
 * It never imports an asset module or the PowerPoint rendering runtime.
 */
export async function discoverCoreAssetPackages(root = defaultRoot) {
  const resolvedRoot = path.resolve(root);
  if (!indexCache.has(resolvedRoot)) {
    indexCache.set(resolvedRoot, (async () => {
      const packages = (await Promise.all((await discoverManifestPaths(resolvedRoot)).map(loadDescriptor)))
        .filter(Boolean);
      const ids = new Set();
      for (const item of packages) {
        requireValue(!ids.has(item.assetId), `核心资产包 id 重复：${item.assetId}`);
        ids.add(item.assetId);
      }
      return packages.sort((left, right) => left.assetId.localeCompare(right.assetId));
    })());
  }
  return indexCache.get(resolvedRoot);
}

export async function coreAssetPackageMap(root = defaultRoot) {
  return new Map((await discoverCoreAssetPackages(root)).map((item) => [item.assetId, item]));
}

export async function loadCoreAssetPackage(assetId, root = defaultRoot) {
  const resolvedRoot = path.resolve(root);
  const key = `${resolvedRoot}\0${assetId}`;
  if (!packageCache.has(key)) {
    packageCache.set(key, (async () => {
      const descriptor = (await discoverCoreAssetPackages(resolvedRoot))
        .find((item) => item.assetId === assetId);
      if (!descriptor) throw new Error(`核心资产包不存在：${assetId}`);
      const { runtime } = descriptor;
      const module = await import(pathToFileURL(descriptor.entryPath).href);
      const builder = runtime.builderExport ? module[runtime.builderExport] : null;
      const component = runtime.componentExport ? module[runtime.componentExport] : null;
      const mapper = module[runtime.mapperExport];
      const slotResolver = runtime.slotContract?.resolverExport ? module[runtime.slotContract.resolverExport] : null;
      if (runtime.renderer === "legacy-builder") {
        requireValue(typeof runtime.builderExport === "string" && runtime.builderExport, `${assetId} 缺少 builderExport`);
        requireValue(typeof builder === "function", `${assetId} 没有导出 ${runtime.builderExport}`);
      } else if (runtime.renderer === "html-component") {
        requireValue(typeof runtime.componentExport === "string" && runtime.componentExport, `${assetId} 缺少 componentExport`);
        requireValue(component && typeof component.renderMarkup === "function", `${assetId} 没有导出可用的 ${runtime.componentExport}`);
      }
      requireValue(typeof mapper === "function", `${assetId} 没有导出 ${runtime.mapperExport}`);
      if (runtime.slotContract) requireValue(typeof slotResolver === "function", `${assetId} 没有导出 ${runtime.slotContract.resolverExport}`);
      return {
        ...descriptor,
        textCapacity: component?.textCapacity ?? runtime.textCapacity ?? null,
        textFlow: component?.textFlow ?? runtime.textFlow ?? null,
        builder,
        component,
        mapper,
        slotResolver,
        generatedSlotContract: await loadGeneratedSlotContract(descriptor.assetDir),
      };
    })());
  }
  return packageCache.get(key);
}

/** Load detailed container/capacity data for a shortlisted asset only. */
export async function loadCoreAssetCapabilities(assetId, root = defaultRoot) {
  const assetPackage = await loadCoreAssetPackage(assetId, root);
  const generatedTextFlow = assetPackage.textFlow
    ? await loadGeneratedTextFlow(assetPackage.assetDir)
    : null;
  return {
    textCapacity: assetPackage.textCapacity ? structuredClone(assetPackage.textCapacity) : null,
    textFlow: assetPackage.textFlow ? {
      ...structuredClone(assetPackage.textFlow),
      ...(generatedTextFlow ? structuredClone(generatedTextFlow) : {}),
    } : null,
    textRegions: assetPackage.generatedSlotContract
      ? summarizeTextRegionContract(assetPackage.generatedSlotContract)
      : [],
    generatedSlotContract: assetPackage.generatedSlotContract
      ? structuredClone(assetPackage.generatedSlotContract)
      : null,
    slotResolver: assetPackage.slotResolver,
    component: assetPackage.component,
  };
}
