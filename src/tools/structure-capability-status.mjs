import {neutralStructureProfiles} from '../visual-runtime/neutral-structure-profiles.mjs';
const approved=new Set(neutralStructureProfiles.map(p=>p.id));
const sized=new Set(['parallel-folded-notes-grid-002','convergence-simple-funnel-001','progression-maturity-steps-002']);
export function structureCapabilityStatus(asset, skin, skinStatus) {
  const eligible=asset.status==='core'&&asset.userApprovedHtmlNative&&approved.has(asset.id);
  return {
    color:skin==='university'?'原 Skin 预览':!eligible?'未接入':skin==='neutral'?'换色已审阅':skinStatus==='reviewed'?'Skin 样例已审阅；全库另验':'换色待审阅',
    sizes:sized.has(asset.id)&&eligible?['large','medium','small']:['large'],
    sizeLabel:sized.has(asset.id)&&eligible?'大／中／小样例已验证':'仅原尺寸；中小未适配',
    wholePage:'整页调用：未逐项登记验收',
    native:asset.userApprovedHtmlNative?'原设计 PPT 已审批；当前适配另验':'PPT 待审批',
    evidence:eligible&&skin==='neutral'?'experiments/structure-unified-neutral/index.html':null,
  };
}
