import fs from "node:fs/promises";
import path from "node:path";
import { loadCoreAssetPackage } from "../../../../src/runtime/core-asset-packages.mjs";
import { renderStructureAsset, closeHtmlComponentRuntime } from "../../../../src/runtime/assets.mjs";

let usedRuntime = false;
export async function invokeStructure({root,slide,skin,assetId,parameters,targetFrame,evidencePath,pageId,regionId,reason}) {
  if (!evidencePath || !pageId || !regionId || !reason) throw new Error("调用需 evidencePath/pageId/regionId/reason 以保留证据");
  const base={assetId,pageId,regionId,reason,targetFrame};
  await fs.mkdir(path.dirname(evidencePath),{recursive:true});
  const log=event=>fs.appendFile(evidencePath,JSON.stringify({at:new Date().toISOString(),...base,...event})+"\n");
  await log({event:"attempt",parameters});
  try {
    const p=await loadCoreAssetPackage(assetId,root);
    const f=targetFrame, b=skin.bodyFrame;
    if (!f || ![f.left,f.top,f.width,f.height].every(Number.isFinite) || f.width<=0 || f.height<=0 || f.left<b.left-.5 || f.top<b.top-.5 || f.left+f.width>b.left+b.width+.5 || f.top+f.height>b.top+b.height+.5) throw new Error("targetFrame 必须在 Skin 正文区内");
    const count=parameters.items?.length ?? parameters.causes?.length ?? parameters.layers?.length ?? parameters.sides?.[0]?.items?.length;
    const minimum=p.asset.spatialContract?.stateFootprints?.[String(count)] ?? p.asset.spatialContract?.minimumFrame;
    if (minimum && (f.width+.5<minimum.width || f.height+.5<minimum.height)) throw new Error(`区域不足：${assetId} 当前状态至少需要 ${minimum.width}×${minimum.height}，实际 ${f.width}×${f.height}`);
    const before=slide.shapes.items.length;
    usedRuntime=true;
    const result=await renderStructureAsset(slide,{assetId,parameters},skin,targetFrame,root);
    await log({event:"success",nativeShapeDelta:slide.shapes.items.length-before,manifestPath:path.relative(root,p.manifestPath)});
    return result;
  } catch(error) { await log({event:"failure",message:error.message}); throw error; }
}
export async function closeStructureRuntime() { if (usedRuntime) { await closeHtmlComponentRuntime(); usedRuntime=false; } }
