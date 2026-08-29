import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { inspectCoreAssetReachability } from "../src/runtime/core-asset-reachability.mjs";
import { discoverAssetManifestEntries } from "../src/tools/asset-manifest-inventory.mjs";
import {
  listRenderableVisualVariants,
  queryVisualVariants,
} from "../src/selection/visual-variants.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("每个核心 Structure 进入正式库前都有可达见证", async () => {
  const entries = await discoverAssetManifestEntries(root, "assets");
  const unreachable = entries
    .filter((entry) => entry.status === "core" && entry.metadata.kind === "component")
    .map((entry) => ({ id: entry.id, result: inspectCoreAssetReachability(entry.metadata) }))
    .filter((entry) => !entry.result.reachable);
  assert.deepEqual(unreachable, []);
});

test("未知结构化内容类型不能伪装成正式可调用资产", () => {
  const result = inspectCoreAssetReachability({
    id: "invalid-asset",
    runtime: {
      renderer: "html-component",
      logicId: "comparison",
      supportedBaseRelations: ["comparison"],
      supportedPurposeKeys: ["compare_options"],
      itemCount: { min: 2, preferred: [2], max: 2 },
      contentContract: { requiresStructuredDataType: "comparison-summary" },
    },
  });
  assert.equal(result.reachable, false);
  assert.match(result.issues.join("\n"), /不支持 structuredData\.type=comparison-summary/);
});

test("可达见证同时区分通用结构与专用内容结构", () => {
  const generic = inspectCoreAssetReachability({
    id: "generic-sequence",
    runtime: {
      renderer: "html-component",
      logicId: "sequence",
      supportedBaseRelations: ["sequence"],
      supportedPurposeKeys: ["explain_process"],
      itemCount: { min: 3, preferred: [4], max: 6 },
      contentContract: { itemRole: "semantic-node", points: "optional" },
    },
  });
  assert.equal(generic.reachable, true);
  assert.equal(generic.applicability.scope, "generic");

  const specialized = inspectCoreAssetReachability({
    id: "gated-sequence",
    runtime: {
      renderer: "html-component",
      logicId: "sequence",
      supportedBaseRelations: ["sequence"],
      supportedPurposeKeys: ["explain_process"],
      itemCount: { min: 3, preferred: [4], max: 5 },
      contentContract: {
        itemRole: "semantic-node",
        points: "required",
        pointCount: { min: 1, max: 3 },
      },
    },
  });
  assert.equal(specialized.reachable, true);
  assert.equal(specialized.applicability.scope, "specialized");
  assert.ok(specialized.applicability.reasons.includes("requires-points-per-item"));
});

test("通过统一入库收尾的两个最新资产能从正式候选目录命中", async () => {
  const variants = await listRenderableVisualVariants({ root });
  const causal = queryVisualVariants(variants, {
    logicId: "causal",
    baseRelation: "causal",
    purposeKey: "analyze_causes",
    itemCount: 3,
  });
  assert.ok(causal.some((variant) => variant.assetId === "causal-mediator-chain-003"));

  const parallel = queryVisualVariants(variants, {
    logicId: "parallel",
    baseRelation: "parallel",
    purposeKey: "present_parallel_points",
    itemCount: 4,
  });
  assert.ok(parallel.some((variant) => variant.assetId === "parallel-folded-notes-grid-002"));
});
