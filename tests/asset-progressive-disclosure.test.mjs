import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  discoverCoreAssetPackages,
  loadCoreAssetCapabilities,
  loadCoreAssetPackage,
} from "../src/runtime/core-asset-packages.mjs";

test("资产发现只读轻量索引，不导入运行代码", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-index-"));
  const assetDir = path.join(root, "assets", "正文", "lazy-001");
  await fs.mkdir(assetDir, { recursive: true });
  await fs.writeFile(path.join(assetDir, "asset.json"), JSON.stringify({
    id: "lazy-001",
    status: "core",
    runtime: {
      renderer: "skin",
      entry: "runtime.mjs",
      mapperExport: "mapPageContent",
      familyId: "lazy",
      variantId: "default",
      silhouette: "lazy",
      supportedBaseRelations: ["none"],
      itemCount: { min: 0, max: 1 },
    },
  }));
  await fs.writeFile(path.join(assetDir, "runtime.mjs"), "throw new Error('RUNTIME_WAS_IMPORTED');\n");

  const assets = await discoverCoreAssetPackages(root);
  assert.deepEqual(assets.map((item) => item.assetId), ["lazy-001"]);
  await assert.rejects(() => loadCoreAssetPackage("lazy-001", root), /RUNTIME_WAS_IMPORTED/);
});

test("候选入围后才读取精确容量", async () => {
  const root = process.cwd();
  const [descriptor] = (await discoverCoreAssetPackages(root))
    .filter((item) => item.assetId === "cycle-loop-001");
  assert.equal(descriptor.textCapacity, null);
  const capability = await loadCoreAssetCapabilities("cycle-loop-001", root);
  assert.equal(capability.textCapacity.maxItemTitleChars, 8);
  assert.equal(capability.textCapacity.maxPointsPerItem, 4);
});

test("TextFlow 作为轻量能力随资产索引披露，不加载手写字数表", async () => {
  const root = process.cwd();
  const [descriptor] = (await discoverCoreAssetPackages(root))
    .filter((item) => item.assetId === "parallel-equal-cards-001");
  assert.deepEqual(descriptor.textFlow, { profile: "standard", scope: "per-item" });
  assert.equal(descriptor.textCapacity, null);
  const capability = await loadCoreAssetCapabilities("parallel-equal-cards-001", root);
  assert.equal(capability.textFlow.profile, "standard");
  assert.equal(capability.textFlow.scope, "per-item");
  assert.equal(capability.textFlow.planningStates.length, 3);
  assert.equal(capability.textFlow.planningStates[0].capacity.basis, "conservative-cjk-geometry");
  assert.equal(capability.textCapacity, null);
});
