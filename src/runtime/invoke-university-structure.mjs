import { invokeStructure, closeStructureRuntime } from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
import { loadStructureSkill } from './structure-skills.mjs';
import { universityMckinseySkin } from './skins/university-mckinsey.mjs';

export { universityMckinseySkin, closeStructureRuntime };

// The page chooses content and a region; the library owns the drawing.
export async function invokeUniversityStructure(options) {
  if (options.build !== undefined || options.skin !== undefined || options.execution !== undefined || options.references !== undefined) {
    throw new Error('大学结构入口固定使用大学 Skin 与保留原造型实现，不接受自定义 build/skin/execution/references');
  }
  const { assetId, root, slide, targetFrame, content, evidencePath, pageId, regionId, reason } = options;
  const ref = await loadStructureSkill(assetId, root);
  if (ref.guide?.implementation?.mode !== 'preserved-design') {
    throw new Error(`${assetId} 尚未登记保留原造型适配；不能退回自由重画`);
  }
  return invokeStructure({ root, slide, targetFrame, content, evidencePath, pageId, regionId, reason,
    skin: universityMckinseySkin, execution: 'preserved-design',
    references: [{ assetId, preservedFeatures: ref.guide.designBoundary.invariants }],
  });
}
