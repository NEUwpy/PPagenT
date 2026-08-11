import path from "node:path";
import { discoverCoreAssetPackages } from "../runtime/core-asset-packages.mjs";
import { listRenderableVisualVariants } from "../selection/visual-variants.mjs";

const root = path.resolve(process.argv[2] ?? process.cwd());
const packages = await discoverCoreAssetPackages(root);
const renderableIds = new Set(
  (await listRenderableVisualVariants({ root })).map((item) => item.assetId),
);
const hidden = packages.filter((item) => !renderableIds.has(item.assetId));
if (hidden.length) throw new Error(`以下核心资产包没有进入正式候选：${hidden.map((item) => item.assetId).join(", ")}`);

console.log(JSON.stringify({
  count: packages.length,
  formalCandidates: packages.length,
  assets: packages.map((item) => ({
    assetId: item.assetId,
    familyId: item.runtime.familyId,
    variantId: item.runtime.variantId,
    relations: item.runtime.supportedBaseRelations,
    purposes: item.runtime.supportedPurposeKeys ?? [],
    itemCount: item.runtime.itemCount,
  })),
}, null, 2));
