import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectAssetManifestContract } from "../runtime/asset-manifest-contract.mjs";
import { adaptiveMinimumFrame, getStructureAdaptationProfile } from "../runtime/structure-adaptation.mjs";

// 把「只有 runtime.contract.adaptationStatus 裸声明」的正式结构补成「已登记的 planned 空间契约」。
// 输出必须与手工迁移的 3 份（sequence-flow-001 / cycle-loop-001 / convergence-many-to-one-003）
// 逐字段一致，且必须通过 inspectAssetManifestContract()；任一条不成立就不写盘。
// 对照台账：tests/structure-adaptation-contract.test.mjs。

const root = path.resolve(process.argv[2] ?? process.cwd());
const assetRoot = path.join(root, "assets", "结构图");
const migrated = [];
const skipped = [];

for (const entry of await fs.readdir(assetRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(assetRoot, entry.name);
  const manifestPath = path.join(directory, "asset.json");
  let source;
  let asset;
  try {
    source = await fs.readFile(manifestPath, "utf8");
    asset = JSON.parse(source);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (asset.status !== "core" || asset.kind !== "component" || asset.runtime?.renderer !== "html-component") continue;

  const profile = getStructureAdaptationProfile(asset);
  const minimum = adaptiveMinimumFrame(asset);
  const spatial = asset.spatialContract ?? {};
  // resizeMode 保持原值（全库都是 "natural"），不写 "adaptive"：
  // asset-manifest-contract.mjs 规定只有 runtime.contract.adaptationStatus === "verified"
  // 才准声明 adaptive，而本工具只登记 profile 契约、不产生任何实测证据。
  // 旧版同时写 resizeMode="adaptive" 与 adaptationStatus="adaptive"，对任一份未迁移清单
  // 试跑都会被 inspectAssetManifestContract() 立刻判为不合契约——即本工具一旦运行
  // 就会污染全部被迁移的清单，这正是它必须带写入前闸门的原因。
  spatial.adaptiveMinimumFrame = { width: minimum.width, height: minimum.height };
  // 键序与手工迁移的 3 份逐字一致：JSON.stringify 保持插入序，换个位置就会让
  // 每一份被迁移的清单都产生一次纯粹的重排 diff，掩盖真正的内容变化。
  spatial.adaptation = {
    mode: "planned",
    profile: profile.id,
    axis: profile.axis,
    preserves: profile.preserve,
    textPolicy: "discrete-font-tier-with-space-feedback",
    fallback: "STRUCTURE_SPACE_INSUFFICIENT",
    evidence: "profile-contract-unverified",
    enabled: false,
  };
  asset.spatialContract = spatial;
  asset.runtime.spatialResolverExport = "resolveSpatialRequirement";
  asset.runtime.contract ??= {};
  // 登记了契约但没经过实测，成熟度就是 "partial" 而不是裸声明时期的 "adaptive"。
  asset.runtime.contract.adaptationStatus = "partial";

  const issues = [];
  // 闸门一：清单声明了 spatialResolverExport，入口模块就必须真的导出它。只改清单不改入口
  // 会造出半迁移状态，core-asset-packages.loadCoreAssetPackage() 会在运行期直接抛错。
  const module = await import(pathToFileURL(path.join(directory, "runtime.mjs")).href).catch(() => null);
  if (typeof module?.resolveSpatialRequirement !== "function") {
    issues.push("runtime.mjs 未导出 resolveSpatialRequirement");
  }
  // 闸门二：变换后的整份清单必须合法。
  const contract = inspectAssetManifestContract(asset);
  if (!contract.valid) issues.push(...contract.issues);

  if (issues.length) {
    skipped.push({ id: asset.id, issues });
    continue;
  }

  const pretty = source.includes("\n");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const output = JSON.stringify(asset, null, pretty ? 2 : 0).replace(/\n/g, eol);
  await fs.writeFile(manifestPath, pretty ? `${output}${eol}` : output, "utf8");
  migrated.push({ id: asset.id, profile: profile.id, minimumFrame: minimum });
}

console.log(JSON.stringify({
  migratedCount: migrated.length,
  skippedCount: skipped.length,
  migrated,
  skipped,
}, null, 2));
