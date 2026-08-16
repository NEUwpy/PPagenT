import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { discoverAssetManifestEntries } from "../src/tools/asset-manifest-inventory.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("核心库和候选库只以各资产 asset.json 为登记真源", async () => {
  const [core, candidates] = await Promise.all([
    discoverAssetManifestEntries(root, "assets"),
    discoverAssetManifestEntries(root, "备选资产"),
  ]);
  assert.ok(core.some((entry) => entry.id === "northeastern-university-agenda-001"));
  assert.ok(core.every((entry) => entry.status === "core"));
  assert.ok(candidates.every((entry) => entry.status === "candidate"));
  await assert.rejects(fs.access(path.join(root, "assets", "registry.json")));
  await assert.rejects(fs.access(path.join(root, "备选资产", "registry.json")));
});

