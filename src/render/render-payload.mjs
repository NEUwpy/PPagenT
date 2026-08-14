import { coreAssetPackageMap } from "../runtime/core-asset-packages.mjs";

const packagedAssets = await coreAssetPackageMap();

export function mapRenderPayload(content, intent, decision, compositionPage = null) {
  const assetId = decision.selectedAssetId;
  if (!assetId) throw new Error(`${content.pageId} 没有可渲染的 selectedAssetId`);
  const assetPackage = packagedAssets.get(assetId);
  if (!assetPackage) throw new Error(`核心资产包不存在：${assetId}`);
  return assetPackage.mapper(content, intent, decision, compositionPage);
}
