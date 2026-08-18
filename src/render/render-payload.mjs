import { loadCoreAssetPackage } from "../runtime/core-asset-packages.mjs";

/** Third disclosure stage: load only the asset selected by the visual director. */
export async function mapRenderPayload(content, intent, decision, compositionPage = null, visualPage = null) {
  const assetId = decision.selectedAssetId;
  if (!assetId) throw new Error(`${content.pageId} 没有可渲染的 selectedAssetId`);
  const assetPackage = await loadCoreAssetPackage(assetId);
  return assetPackage.mapper(content, intent, decision, compositionPage, visualPage);
}
