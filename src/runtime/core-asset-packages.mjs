import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectAssetIntakeState } from "./asset-intake-state.mjs";
import { inspectHtmlComponentEligibility } from "./html-component-eligibility.mjs";
import { inspectCoreAssetReachability } from "./core-asset-reachability.mjs";
import { assertAssetManifestContract } from "./asset-manifest-contract.mjs";
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

async function readLogicMap(root) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, "catalog", "logic-map.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { logics: [] };
    throw error;
  }
}

async function loadDescriptor(manifestPath, logicMap, root) {
  let asset;
  try {
    asset = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (asset.status !== "core" || !asset.runtime) return null;
  const assetDir = path.dirname(manifestPath);
  if (asset.intake?.schemaVersion === "1.0") {
    const intakeState = await inspectAssetIntakeState({ asset, assetDir, logicMap, root });
    if (!intakeState.coreConsistent) return null;
  } else {
    if (asset.runtime.renderer === "html-component") {
      const eligibility = await inspectHtmlComponentEligibility(assetDir, asset.id);
      if (!eligibility.eligible) return null;
    }
    assertAssetManifestContract(asset, manifestPath);
    if (!inspectCoreAssetReachability(asset).reachable) return null;
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
      const logicMap = await readLogicMap(resolvedRoot);
      const packages = (await Promise.all((await discoverManifestPaths(resolvedRoot))
        .map((manifestPath) => loadDescriptor(manifestPath, logicMap, resolvedRoot))))
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
