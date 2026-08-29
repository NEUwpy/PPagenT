import fs from "node:fs/promises";
import path from "node:path";

import { normalizeFormalAssetManifest } from "../runtime/asset-manifest-contract.mjs";
import { inspectAssetIntakeState } from "../runtime/asset-intake-state.mjs";
import { discoverAssetManifestEntries } from "./asset-manifest-inventory.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function writeJsonAtomic(target, value) {
  const temporary = `${target}.intake-${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, target);
}

const root = path.resolve(argument("--root") ?? process.cwd());
const assetId = argument("--asset");
if (!assetId) throw new Error("缺少 --asset <assetId>");

const entries = await discoverAssetManifestEntries(root, "assets");
const entry = entries.find((item) => item.id === assetId);
if (!entry) throw new Error(`找不到资产: ${assetId}`);
if (!new Set(["pending-review", "core"]).has(entry.status)) {
  throw new Error(`${assetId} 当前状态 ${entry.status} 不能执行入库收尾`);
}

const logicMapPath = path.join(root, "catalog", "logic-map.json");
const logicMap = JSON.parse(await fs.readFile(logicMapPath, "utf8"));
const normalized = normalizeFormalAssetManifest({ ...entry.metadata, status: "pending-review" });
const readiness = await inspectAssetIntakeState({
  asset: normalized,
  assetDir: entry.directory,
  logicMap,
  root,
});
if (!readiness.readyToRegister) {
  console.error(JSON.stringify({ status: "blocked", assetId, stage: readiness.stage, issues: readiness.readinessIssues }, null, 2));
  process.exitCode = 1;
} else {
  const logic = logicMap.logics.find((item) => item.id === normalized.runtime.logicId);
  if (!logic) throw new Error(`Logic 能力地图中不存在 ${normalized.runtime.logicId}`);
  logic.assetIds = [...new Set([...(logic.assetIds ?? []), assetId])];
  const promoted = {
    ...normalized,
    status: "core",
    intake: {
      schemaVersion: "1.0",
      state: "registered",
      witness: readiness.formalReachability.witness,
    },
  };
  const originalManifestText = await fs.readFile(entry.manifestPath, "utf8");
  const originalLogicMapText = await fs.readFile(logicMapPath, "utf8");

  try {
    await writeJsonAtomic(entry.manifestPath, promoted);
    await writeJsonAtomic(logicMapPath, logicMap);

    const [{ listRenderableVisualVariants, queryVisualVariants }] = await Promise.all([
      import("../selection/visual-variants.mjs"),
    ]);
    const variants = await listRenderableVisualVariants({ root });
    const witness = readiness.formalReachability.witness;
    const matches = queryVisualVariants(variants, {
      assetId,
      logicId: witness.logicId,
      baseRelation: witness.baseRelation,
      purposeKey: witness.purposeKey,
      itemCount: witness.itemCount,
      structuredDataType: witness.structuredDataType,
      requiredItemRole: promoted.runtime.contentContract?.itemRole,
      allowMissingRequiredPoints: true,
    });
    if (!matches.some((item) => item.assetId === assetId)) {
      throw new Error(`${assetId} 晋升后未被正式候选查询命中`);
    }

    const finalState = await inspectAssetIntakeState({
      asset: promoted,
      assetDir: entry.directory,
      logicMap,
      root,
    });
    if (!finalState.coreConsistent) {
      throw new Error(`${assetId} 晋升后状态不一致: ${finalState.readinessIssues.join("；")}`);
    }
    console.log(JSON.stringify({
      status: "registered",
      assetId,
      logicId: promoted.runtime.logicId,
      stage: finalState.stage,
      witness,
    }, null, 2));
  } catch (error) {
    await fs.writeFile(entry.manifestPath, originalManifestText, "utf8");
    await fs.writeFile(logicMapPath, originalLogicMapText, "utf8");
    throw error;
  }
}
