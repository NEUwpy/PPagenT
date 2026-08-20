import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { discoverAssetManifestEntries } from "../src/tools/asset-manifest-inventory.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("核心库只以各资产 asset.json 为登记真源", async () => {
  const core = await discoverAssetManifestEntries(root, "assets");
  assert.ok(core.some((entry) => entry.id === "northeastern-university-agenda-001"));
  assert.ok(core.every((entry) => new Set(["core", "pending-review"]).has(entry.status)));
  assert.ok(core.some((entry) => entry.id === "causal-fishbone-attribution-001" && entry.status === "core"));
  assert.ok(core.some((entry) => entry.id === "problem-solution-outcome-001" && entry.status === "core"));
  assert.ok(core.some((entry) => entry.id === "matrix-quadrant-priority-001" && entry.status === "core"));
  await assert.rejects(fs.access(path.join(root, "assets", "registry.json")));
});

