import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSemanticPlan } from '../../../src/runner/gray-semantics.mjs';
import { newRunState } from '../../../src/runner/state.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const runName = process.argv[2] ?? '2026-11-19T15-20-12.787Z';
if (!/^[0-9T.Z-]+$/u.test(runName)) throw new Error('请选择已保存的运行时间戳目录');
const run = path.join(import.meta.dirname, 'runs', runName);
const sourcePath = path.join(root, '稿件', '模拟稿库', '布局试排-services.md');
const raw = await fs.readFile(sourcePath, 'utf8');
const state = newRunState(raw, sourcePath);
const oneShot = JSON.parse(await fs.readFile(path.join(run, 'one-shot-services.json'), 'utf8'));
const legacyTurn = JSON.parse(await fs.readFile(path.join(run, 'legacy-services-artifacts', 'agent', 'turn-1', 'response.json'), 'utf8'));
const legacyMisrouted = JSON.parse(legacyTurn.toolCalls[0].args.plan);

function check(plan) {
  const report = validateSemanticPlan(state, plan);
  return { accepted: report.accepted, issues: report.issues };
}

function probe(original, altered, dropSource = false) {
  const plan = structuredClone(oneShot.plan);
  const block = plan.pages[0].groups.flatMap(group => group.blocks).find(block => block.text.includes(original));
  if (!block) throw new Error(`未找到受控删除/改写字段 ${original}`);
  const before = block.text;
  block.text = before.replace(original, altered);
  if (dropSource) block.sourceIds = ['unknown-source'];
  return { before, after: block.text, sourceIds: block.sourceIds, ...check(plan) };
}

const result = {
  mode: 'deterministic-only, no new model calls',
  legacyMisroutedFirstPlan: check(legacyMisrouted),
  transferControl: probe('访问受限区域需事先获得授权', '访问受限区域需事先获得授权', true),
  qualifierFlip: probe('访问受限区域需事先获得授权', '访问受限区域无需事先获得授权'),
  weakenedRequirement: probe('紧急事项需同时电话联系值班人员', '紧急事项可选择电话联系值班人员'),
};
await fs.writeFile(path.join(run, 'semantic-replay.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
