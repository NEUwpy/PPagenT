import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { expressionParameters, handoffFingerprints, validateGrayHandoff } from '../src/tools/validate-gray-handoff.mjs';

const example = JSON.parse(await fs.readFile(new URL('../docs/契约/examples/gray-handoff-v0.1.example.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(example);
const restamp = pkg => { Object.assign(pkg.freeze, handoffFingerprints(pkg)); return pkg; };

test('field example resolves structure text solely from the original content references', async () => {
  const result = await validateGrayHandoff(example);
  assert.equal(result.accepted, true, JSON.stringify(result.issues));
  assert.deepEqual(result.materialized[0].parameters.levels.map(level => level.title), ['基础', '规范', '协同']);
  assert.equal(result.materialized[0].parameters.levels[1].body, example.plan.pages[1].groups[0].blocks[1].text);
});

test('freeze detects content role and binding changes, independently of visible-text review hashes', async () => {
  const pkg = fresh(); pkg.plan.pages[0].groups[0].role = 'other-role';
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /contentSha256 不匹配/);
  const changed = fresh(); changed.pageBindings[1].expressions[0].parameters.showStatus = true;
  assert.match((await validateGrayHandoff(changed)).issues.join('\n'), /bindingSha256 不匹配/);
});

test('binding pages preserve the contract page sequence', async () => {
  const pkg = fresh(); pkg.pageBindings.reverse(); restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /页序一一对应/);
});

test('scoped content references reject other groups even when a block ID happens to match', async () => {
  const pkg = fresh(); pkg.pageBindings[1].expressions[0].slotBindings[0].contentRef.groupId = 'g1'; restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /未拥有的内容/);
});

test('duplicating a whole expression cannot duplicate the same body content', async () => {
  const pkg = fresh(); const copy = structuredClone(pkg.pageBindings[0].expressions[0]); copy.expressionId = 'e-copy';
  pkg.pageBindings[0].expressions.push(copy); restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /必须由一个表达完整承载/);
});

test('unreferenced or unknown sources use the existing gray-plan checks', async () => {
  const pkg = fresh(); pkg.plan.pages[0].groups[0].blocks[0].sourceIds = ['unknown']; restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /未知来源/);
});

test('structure parameters cannot override bound titles with a second body source', () => {
  const pkg = fresh(), expression = pkg.pageBindings[1].expressions[0];
  expression.parameters.levels = [{ title: 'duplicate-text' }];
  assert.throws(() => expressionParameters(pkg.plan.pages[1], expression), /第二份绑定值/);
});

test('missing capacity stays draft and cannot masquerade as a frozen ready capability', async () => {
  const pkg = fresh(); pkg.pageBindings[1].expressions[0].selection = { status: 'missing', reason: '待建设' }; restamp(pkg);
  const draft = await validateGrayHandoff(pkg); assert.equal(draft.accepted, true); assert.equal(draft.warnings[0].code, 'capability-missing');
  pkg.freeze.status = 'frozen';
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /frozen 包不能保留 missing/);
});

test('binding paths cannot write prototype properties', () => {
  const pkg = fresh(), expression = pkg.pageBindings[1].expressions[0];
  expression.slotBindings[0].target = '__proto__.polluted';
  assert.throws(() => expressionParameters(pkg.plan.pages[1], expression), /禁止键/);
  assert.equal({}.polluted, undefined);
});

test('node target indexes preserve ordered block semantics', async () => {
  const pkg = fresh();
  for (const slot of pkg.pageBindings[1].expressions[0].slotBindings) slot.target = slot.target.replace(/\[(0|1)\]/, (_, index) => `[${1 - Number(index)}]`);
  restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /先后顺序/);
});

test('free copy cannot be smuggled into scalar structure parameters', async () => {
  const pkg = fresh(); pkg.pageBindings[1].expressions[0].parameters.customText = '另一份正文'; restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /字符串只能使用资产登记/);
});

test('a changed capacity declaration invalidates its pinned version', async () => {
  const pkg = fresh(); pkg.pageBindings[1].expressions[0].capacityRef.sha256 = '0'.repeat(64); restamp(pkg);
  assert.match((await validateGrayHandoff(pkg)).issues.join('\n'), /容量声明版本不匹配/);
});
