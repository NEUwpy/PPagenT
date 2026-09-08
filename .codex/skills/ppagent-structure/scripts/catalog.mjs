import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listStructureSkills, loadStructureSkill } from '../../../../src/runtime/structure-skills.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const [command = 'list', ...args] = process.argv.slice(2);
if (command === 'list') {
  const packages = await listStructureSkills(root);
  const logic = args[args.indexOf('--logic') + 1];
  const summary = p => ({ id: p.assetId, name: p.asset.name, logic: p.runtime.logicId, semantic: p.asset.semanticContract, silhouette: p.runtime.silhouette });
  console.log(JSON.stringify(args.includes('--logic') ? packages.filter(p => p.runtime.logicId === logic).map(summary) : {
    total: packages.length,
    logics: Object.fromEntries([...new Set(packages.map(p => p.runtime.logicId))].sort().map(l => [l, packages.filter(p => p.runtime.logicId === l).length])),
    next: 'list --logic <logicId>; guide <assetId>',
  }, null, 2));
} else if (['guide', 'reference', 'inspect'].includes(command)) {
  const p = await loadStructureSkill(args[0], root);
  const { identityEvidence, fixedEvidence, variableEvidence, ...currentSkill } = p.skill;
  console.log(JSON.stringify({
    mode: 'structure-skill', referenceAssetId: p.assetId, name: p.asset.name,
    logic: p.runtime.logicId, semantic: p.asset.semanticContract, source: p.asset.source,
    skill: currentSkill,
    referenceImplementation: {
      manifest: path.relative(root, p.manifestPath),
      exampleCode: path.relative(root, path.resolve(path.dirname(p.manifestPath), p.guide?.exampleImplementation ?? path.basename(p.entryPath))),
      historicalRuntime: path.relative(root, p.entryPath),
    },
    execution: p.guide?.implementation?.mode === 'preserved-design'
      ? 'scripts/invoke.mjs: references + content + targetFrame + execution: preserved-design。直接执行登记的原造型适配实现，无需传 build。当前数量范围仍由该实现校验；文字按目标区域测量。'
      : 'scripts/invoke.mjs: references + content + targetFrame + build。此结构尚未接入保留造型适配实现，不可声称仅凭特征摘要重绘已完成迁移。',
    provenance: command === 'inspect'
      ? { notice: '历史设计证据，包含旧样例容量、颜色和文字框；不是当前构建约束。', visualIntent: p.visualIntent, identityEvidence, fixedEvidence, variableEvidence }
      : { next: `inspect ${p.assetId}`, notice: '需要核对来源时读取历史证据；数量与文字位置按当前稿件重算。' },
  }, null, 2));
} else throw new Error('Use list [--logic <id>] or guide <assetId> (reference/inspect are aliases)');
