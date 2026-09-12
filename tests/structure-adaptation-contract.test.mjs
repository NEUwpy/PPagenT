import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { discoverCoreAssetPackages } from "../src/runtime/core-asset-packages.mjs";
import {
  adaptiveProfileCoverage,
  getStructureAdaptationProfile,
  StructureSpatialRequirementError,
} from "../src/runtime/structure-adaptation.mjs";

const root = path.resolve(import.meta.dirname, "..");

// 台账：已登记 planned 空间契约（spatialContract.adaptation + runtime.spatialResolverExport）
// 的正式资产 id。真源是逐份 assets/结构图/*/asset.json 的实际落盘结果，下面两组断言会把
// 这份台账与磁盘状态对死；将来迁移推进会先让它们变红，而不是被 filter 悄悄稀释掉。
const MIGRATED_ASSET_IDS = Object.freeze([
  "convergence-many-to-one-003",
  "cycle-loop-001",
  "sequence-flow-001",
]);

// 台账：尚未迁移的正式资产数量，等于 35 个正式范围减去上面 3 个。真源同上一行。
// 该数字是"进度"而不是"目标"——迁移一批就该改一次这里，不允许把它换成范围过滤来掩盖。
const UNMIGRATED_ASSET_COUNT = 32;

async function coreHtmlComponentPackages() {
  return (await discoverCoreAssetPackages(root))
    .filter((item) => item.runtime.renderer === "html-component");
}

test("正式 35 个 Structure 共享统一 profile 覆盖；3 个已登记 planned 空间契约、32 个未迁移", async () => {
  const packages = await coreHtmlComponentPackages();
  assert.equal(packages.length, 35);
  const coverage = new Map(adaptiveProfileCoverage().map((item) => [item.assetId, item.profile]));
  assert.equal(coverage.size, 35);
  // 台账断言：profile 覆盖集合与正式范围必须逐个 id 对齐，任一侧多一个少一个都要被看见。
  assert.deepEqual(
    [...coverage.keys()].sort(),
    packages.map((item) => item.assetId).sort(),
  );

  const migrated = [];
  const unmigrated = [];
  for (const descriptor of packages) {
    const manifest = descriptor.asset;
    // 全 35 个普遍成立的统一不变量。真源：assets/结构图/*/asset.json 的 spatialContract 落盘值。
    // 注意 resizeMode 全库都是 "natural"：当前没有任何正式资产声明 adaptive。
    // src/tools/migrate-structure-adaptation-contracts.mjs 写的是 resizeMode="adaptive"，
    // 与这里的落盘真源相反，说明那份迁移工具尚未真正跑过（见文件末尾说明）。
    assert.equal(manifest.spatialContract.resizeMode, "natural", descriptor.assetId);
    assert.deepEqual(
      manifest.spatialContract.supportedCompositionIds,
      ["component-full"],
      descriptor.assetId,
    );
    assert.ok(coverage.has(descriptor.assetId), descriptor.assetId);

    // adaptation / adaptiveMinimumFrame / spatialResolverExport 三者必须同时存在或同时缺席，
    // 否则会出现"清单声明了 profile 却没有 resolver"这类半迁移状态。
    const hasAdaptation = Object.hasOwn(manifest.spatialContract, "adaptation");
    assert.equal(
      hasAdaptation,
      Object.hasOwn(manifest.runtime, "spatialResolverExport"),
      descriptor.assetId,
    );
    assert.equal(
      hasAdaptation,
      Object.hasOwn(manifest.spatialContract, "adaptiveMinimumFrame"),
      descriptor.assetId,
    );

    if (hasAdaptation) migrated.push(descriptor);
    else unmigrated.push(descriptor);
  }

  // 台账断言：已迁移集合恰好是这 3 个 id，未迁移恰好 32 个。
  assert.deepEqual(migrated.map((item) => item.assetId).sort(), [...MIGRATED_ASSET_IDS].sort());
  assert.equal(unmigrated.length, UNMIGRATED_ASSET_COUNT);

  for (const descriptor of unmigrated) {
    const manifest = descriptor.asset;
    // 未迁移资产的现状：只有 runtime.contract.adaptationStatus 这个裸声明，
    // spatialContract 里没有 profile 契约，runtime 里也没有统一 resolver 出口。
    // 这里断言的是"裸声明确实写着 adaptive"这一落盘事实，不是"它可适配"——
    // 真源：src/runtime/structure-adaptation.mjs isAdaptiveStructureAsset() 现在以
    // spatialContract.adaptation 是否存在为判据，因此对这 32 个返回 false（旧判据
    // 以 adaptationStatus === "adaptive" 为准，恰好给出相反的答案）。
    assert.equal(manifest.runtime.contract.adaptationStatus, "adaptive", descriptor.assetId);
    const module = await import(pathToFileURL(descriptor.entryPath).href);
    assert.equal(typeof module.resolveSpatialRequirement, "undefined", descriptor.assetId);
  }

  for (const descriptor of migrated) {
    const manifest = descriptor.asset;
    const adaptation = manifest.spatialContract.adaptation;
    const profile = getStructureAdaptationProfile(manifest);
    // 真源：src/runtime/structure-adaptation.mjs 的 PROFILE_BY_ASSET（getStructureAdaptationProfile）。
    assert.equal(adaptation.profile, coverage.get(descriptor.assetId), descriptor.assetId);
    assert.equal(adaptation.profile, profile.id, descriptor.assetId);
    assert.equal(adaptation.mode, "planned", descriptor.assetId);
    assert.equal(adaptation.axis, profile.axis, descriptor.assetId);
    assert.deepEqual(adaptation.preserves, profile.preserve, descriptor.assetId);
    // planned 契约尚未启用：这三项合起来就是"只是登记、不是实测结论"的证据边界。
    assert.equal(adaptation.textPolicy, "discrete-font-tier-with-space-feedback", descriptor.assetId);
    assert.equal(adaptation.fallback, "STRUCTURE_SPACE_INSUFFICIENT", descriptor.assetId);
    assert.equal(adaptation.evidence, "profile-contract-unverified", descriptor.assetId);
    assert.equal(adaptation.enabled, false, descriptor.assetId);
    // 已迁移资产把 adaptationStatus 从裸声明 "adaptive" 收紧为 "partial"（真源：asset.json 落盘值）。
    assert.equal(manifest.runtime.contract.adaptationStatus, "partial", descriptor.assetId);
    assert.equal(manifest.runtime.spatialResolverExport, "resolveSpatialRequirement", descriptor.assetId);
    // 清单登记的下界必须就是该 asset 所属 profile 的下界，不是随手写的数字。
    assert.deepEqual(manifest.spatialContract.adaptiveMinimumFrame, profile.minimumFrame, descriptor.assetId);

    const module = await import(pathToFileURL(descriptor.entryPath).href);
    const resolver = module[manifest.runtime.spatialResolverExport];
    assert.equal(typeof resolver, "function", descriptor.assetId);
    const requirement = resolver({}, { left: 0, top: 0, width: 1170, height: 492 });
    assert.equal(requirement.ok, true, descriptor.assetId);
    assert.equal(requirement.profile, coverage.get(descriptor.assetId), descriptor.assetId);
    assert.equal(requirement.profile, adaptation.profile, descriptor.assetId);
    assert.ok(requirement.requiredFrame.width < 1170, descriptor.assetId);
    assert.ok(requirement.requiredFrame.height < 492, descriptor.assetId);
    assert.throws(
      () => resolver({}, { left: 0, top: 0, width: 100, height: 100 }),
      (error) => error instanceof StructureSpatialRequirementError
        && ["STRUCTURE_FRAME_UNSUPPORTED", "STRUCTURE_CONTENT_OVERFLOW"].includes(error.code)
        && error.assetId === descriptor.assetId
        && error.requiredFrame.width > 100,
      descriptor.assetId,
    );
  }
});

test("已迁移资产的适配下界与 resolver 由同一 profile 计算", async () => {
  const packages = await coreHtmlComponentPackages();
  // 缩小范围到"清单里真的写了 adaptiveMinimumFrame"的资产：只有这类资产才谈得上
  // "清单下界"与"运行器判定"是否一致。台账断言把范围钉死，避免后续迁移把范围稀释。
  const migratedPackages = packages.filter((item) => Object.hasOwn(item.asset.spatialContract ?? {}, "adaptiveMinimumFrame"));
  assert.deepEqual(migratedPackages.map((item) => item.assetId).sort(), [...MIGRATED_ASSET_IDS].sort());
  assert.equal(packages.length - migratedPackages.length, UNMIGRATED_ASSET_COUNT);

  for (const descriptor of migratedPackages) {
    const source = JSON.parse(await fs.readFile(descriptor.manifestPath, "utf8"));
    const profile = getStructureAdaptationProfile(source);
    assert.equal(source.spatialContract.adaptation.profile, profile.id, descriptor.assetId);
    assert.equal(source.runtime.spatialResolverExport, "resolveSpatialRequirement", descriptor.assetId);
    // 真源：asset.json 的 adaptiveMinimumFrame 与 structure-adaptation.mjs 的 profile 下界是同一份数据，
    // 且标注为 profile-contract-unverified（尚未经真实渲染校准）。
    assert.deepEqual(source.spatialContract.adaptiveMinimumFrame, profile.minimumFrame, descriptor.assetId);
    assert.equal(source.spatialContract.adaptation.evidence, "profile-contract-unverified", descriptor.assetId);

    const module = await import(pathToFileURL(descriptor.entryPath).href);
    const result = module[source.runtime.spatialResolverExport]({}, {
      left: 0,
      top: 0,
      width: source.spatialContract.adaptiveMinimumFrame.width,
      height: source.spatialContract.adaptiveMinimumFrame.height,
    });
    // 边界不变量：清单声明的下界必须正好是 resolver 接受的最小区域，两者不能漂移。
    assert.equal(result.ok, true, descriptor.assetId);
    assert.equal(result.profile, profile.id, descriptor.assetId);
    assert.deepEqual(
      {
        width: result.declaredMinimumFrame.width,
        height: result.declaredMinimumFrame.height,
      },
      source.spatialContract.adaptiveMinimumFrame,
      descriptor.assetId,
    );
  }
});

/*
 * 顺带记录两处与本次断言无关、但会误导迁移的现状（未在本文件断言，留作报告）：
 *
 * 1. src/tools/migrate-structure-adaptation-contracts.mjs 写出的契约互相矛盾：
 *    它把 spatialContract.resizeMode 写成 "adaptive"、runtime.contract.adaptationStatus 写成
 *    "adaptive"，而 src/runtime/asset-manifest-contract.mjs 规定只有 adaptationStatus === "verified"
 *    才能声明 adaptive。实测把该工具的变换套到任一未迁移资产上，
 *    inspectAssetManifestContract() 立刻报 "只有 adaptationStatus=verified 才能声明 adaptive"
 *    （现有 35 份 asset.json 全部通过该校验）。也就是说这份迁移工具一旦运行就会写出不合契约的清单。
 *
 * 2. 已迁移的 3 个资产入口 runtime.mjs 调用的是
 *    resolveStructureSpatialRequirement("<asset-id>", parameters, targetFrame, options)，
 *    只传 id 而不传 asset，因此 resolver 计算下界时永远走 profile 回退分支，
 *    读不到 asset.json 里登记的 spatialContract.adaptiveMinimumFrame。
 *    当前两者数值恰好相同所以无害；一旦按真实渲染校准清单下界而不改入口，二者会静默分叉。
 */
