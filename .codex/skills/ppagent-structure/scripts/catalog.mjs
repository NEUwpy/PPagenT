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
  console.log(JSON.stringify({
    mode: 'structure-skill', referenceAssetId: p.assetId, name: p.asset.name,
    logic: p.runtime.logicId, semantic: p.asset.semanticContract, source: p.asset.source,
    visualIntent: p.visualIntent, skill: p.skill,
    referenceImplementation: { manifest: path.relative(root, p.manifestPath), exampleCode: path.relative(root, p.entryPath) },
    execution: 'scripts/invoke.mjs: references + content + targetFrame + build。示例代码仅用于提取造型，原参数、数量、文字框不约束本次构建。',
  }, null, 2));
} else throw new Error('Use list [--logic <id>] or guide <assetId> (reference/inspect are aliases)');
