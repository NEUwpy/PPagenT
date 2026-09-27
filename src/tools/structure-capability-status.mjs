import {neutralStructureProfiles} from '../visual-runtime/neutral-structure-profiles.mjs';
export function structureCapabilityStatus(asset, skin, skinStatus) {
  // Every core asset now exposes the shared large/medium/small adapter. Visual
  // approval and page-level acceptance remain separate status fields.
  const eligible=asset.status==='core';
  return {
    color:skin==='university'?'原 Skin 预览':!eligible?'未接入':skin==='neutral'?'换色已审阅':skinStatus==='reviewed'?'Skin 样例已审阅；全库另验':'换色待审阅',
    sizes:eligible?['large','medium','small']:['large'],
    sizeLabel:eligible?'大／中／小可调用；本稿容量另验':'仅原尺寸；中小未适配',
    wholePage:'整页调用：未逐项登记验收',
    native:asset.userApprovedHtmlNative?'原设计 PPT 已审批；当前适配另验':'PPT 待审批',
    evidence:eligible&&skin==='neutral'?'experiments/structure-unified-neutral/index.html':null,
  };
}
