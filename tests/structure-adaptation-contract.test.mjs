import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { discoverCoreAssetPackages } from "../src/runtime/core-asset-packages.mjs";
import {
  adaptiveProfileCoverage,
  StructureSpatialRequirementError,
} from "../src/runtime/structure-adaptation.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("正式 35 个 Structure 都登记 planned profile 与统一空间 resolver", async () => {
  const packages = (await discoverCoreAssetPackages(root))
    .filter((item) => item.runtime.renderer === "html-component");
  assert.equal(packages.length, 35);
  const coverage = new Map(adaptiveProfileCoverage().map((item) => [item.assetId, item.profile]));
  assert.equal(coverage.size, 35);

  for (const descriptor of packages) {
    const manifest = descriptor.asset;
    assert.equal(manifest.spatialContract.resizeMode, "natural", descriptor.assetId);
    assert.equal(manifest.spatialContract.adaptation.mode, "planned", descriptor.assetId);
    assert.equal(manifest.runtime.contract.adaptationStatus, "partial", descriptor.assetId);
    assert.equal(manifest.runtime.spatialResolverExport, "resolveSpatialRequirement", descriptor.assetId);
    assert.ok(coverage.has(descriptor.assetId), descriptor.assetId);
    assert.deepEqual(
      manifest.spatialContract.supportedCompositionIds,
      ["component-full"],
      descriptor.assetId,
    );

    const module = await import(pathToFileURL(descriptor.entryPath).href);
    const resolver = module[manifest.runtime.spatialResolverExport];
    assert.equal(typeof resolver, "function", descriptor.assetId);
    const requirement = resolver({}, { left: 0, top: 0, width: 1170, height: 492 });
    assert.equal(requirement.ok, true, descriptor.assetId);
    assert.equal(requirement.profile, coverage.get(descriptor.assetId), descriptor.assetId);
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

test("资产清单的适配下界与 resolver 由同一 profile 计算", async () => {
  const packages = (await discoverCoreAssetPackages(root))
    .filter((item) => item.runtime.renderer === "html-component");
  for (const descriptor of packages) {
    const source = JSON.parse(await fs.readFile(descriptor.manifestPath, "utf8"));
    const module = await import(pathToFileURL(descriptor.entryPath).href);
    const result = module[source.runtime.spatialResolverExport]({}, {
      left: 0,
      top: 0,
      width: source.spatialContract.adaptiveMinimumFrame.width,
      height: source.spatialContract.adaptiveMinimumFrame.height,
    });
    assert.equal(result.ok, true, descriptor.assetId);
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
