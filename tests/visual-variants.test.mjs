import assert from "node:assert/strict";
import test from "node:test";

import { computeContainedFrame } from "../src/asset-runtime/component-builders.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university.mjs";
import { listStructureAssetBuilders } from "../src/runtime/assets.mjs";
import {
  listRenderableVisualVariants,
  planVisualVariants,
  queryVisualVariants,
} from "../src/selection/visual-variants.mjs";

const root = process.cwd();

test("东北大学主题以等比例 contain 承载正文组件", () => {
  const source = northeasternUniversitySkin.componentSourceFrame;
  const target = northeasternUniversitySkin.bodyFrame;
  const fitted = computeContainedFrame(source, target);
  assert.ok(fitted.width <= target.width);
  assert.ok(fitted.height <= target.height);
  assert.equal(fitted.scale, Math.min(target.width / source.width, target.height / source.height));
});

test("正式结构候选只保留循环闭环", async () => {
  const variants = await listRenderableVisualVariants({ root });
  const structural = variants.filter((variant) => variant.renderer !== "skin");
  assert.deepEqual(structural.map((variant) => variant.assetId), ["cycle-loop-001"]);
  assert.deepEqual(
    queryVisualVariants(structural, {
      logicId: "cycle",
      structureGroupId: "cycle-pdca-ring-p57",
      baseRelation: "sequence",
      itemCount: 4,
    }).map((variant) => variant.variantId),
    ["default"],
  );
  assert.deepEqual(
    queryVisualVariants(structural, { logicId: "cycle", itemCount: 7 }),
    [],
  );
});

test("运行时不再登记旧结构资产 Builder", () => {
  const builders = listStructureAssetBuilders();
  assert.deepEqual(builders.defaultAssetIds, ["cycle-loop-001"]);
  assert.deepEqual(builders.variantBuilderKeys, ["cycle-loop-001:default"]);
});

test("视觉导演仍需明确选择循环闭环 Structure Group", async () => {
  const variants = (await listRenderableVisualVariants({ root }))
    .filter((variant) => variant.renderer !== "skin");
  const missing = planVisualVariants([
    { pageId: "p1", logicId: "cycle", baseRelation: "sequence", itemCount: 4 },
  ], { variants });
  assert.equal(missing.status, "needs-director-revision");

  const accepted = planVisualVariants([
    {
      pageId: "p1",
      logicId: "cycle",
      baseRelation: "sequence",
      itemCount: 4,
      visualStructureGroupId: "cycle-pdca-ring-p57",
    },
  ], { variants });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.results[0].assetId, "cycle-loop-001");
});
