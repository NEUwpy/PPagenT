import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { discoverAssetManifestEntries } from "../src/tools/asset-manifest-inventory.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("核心库只以各资产 asset.json 为登记真源", async () => {
  const core = await discoverAssetManifestEntries(root, "assets");
  assert.ok(core.some((entry) => entry.id === "northeastern-university-agenda-001"));
  // 状态词汇随 kind 而变，不能共用一个白名单：
  // - Skin（kind==="skin"，如 assets/主题/中性编辑排版-001/asset.json）用
  //   candidate/reviewed 表达主题成熟度，真源为
  //   src/runtime/skins/structure-skin-registry.mjs:12 的 validateStructureSkin
  //   （强制 status ∈ {candidate, reviewed}）。
  // - 结构组件用 core/pending-review/withdrawn/superseded 表达登记状态。
  // 与 src/tools/audit-asset-library.mjs 的 isSkin 分支保持一致。
  const skinStatuses = new Set(["candidate", "reviewed"]);
  const structureStatuses = new Set(["core", "pending-review", "withdrawn", "superseded"]);
  assert.ok(core.every((entry) => (
    entry.metadata.kind === "skin"
      ? skinStatuses.has(entry.status)
      : structureStatuses.has(entry.status)
  )));
  assert.ok(core.some((entry) => entry.id === "causal-fishbone-attribution-001" && entry.status === "core"));
  assert.ok(core.some((entry) => entry.id === "problem-solution-outcome-001" && entry.status === "core"));
  assert.ok(core.some((entry) => entry.id === "matrix-quadrant-priority-001" && entry.status === "core"));
  await assert.rejects(fs.access(path.join(root, "assets", "registry.json")));
});

