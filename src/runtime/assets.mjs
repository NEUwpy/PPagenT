// Current structure execution is content-driven native construction.
// The old API production line explicitly imports legacy-structure-assets.mjs.
import { listStructureSkills, executeStructureSkill } from './structure-skills.mjs';
export { executeStructureSkill } from './structure-skills.mjs';
export async function listStructureAssetBuilders(root) {
  const skills = await listStructureSkills(root);
  return { defaultAssetIds: skills.map(s => s.assetId), variantBuilderKeys: skills.map(s => `${s.assetId}:${s.runtime.variantId}`).sort() };
}
export async function hasStructureAssetBuilder(assetId, variantId = null, root) {
  const skill = (await listStructureSkills(root)).find(s => s.assetId === assetId);
  return Boolean(skill && (!variantId || skill.runtime.variantId === variantId));
}
export async function renderStructureAsset(slide, recipe, skin, targetFrame = skin.bodyFrame, root) {
  return executeStructureSkill({ ...recipe, slide, skin, targetFrame, root });
}
