import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveComposition, buildComposition, CompositionFitError } from '../src/composition/resolve.mjs';

function input() {
  return {
    pageId: 'P1', bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
    intent: {
      topic: '条件决定扩围', topicPlacement: 'Skin 主题带',
      groups: ['process', 'conditions', 'decision'].map((id, i) => ({ id, role: i === 2 ? 'interpretation' : 'analysis', message: id, sourceRefs: ['模拟稿'], emphasis: i === 0 ? 'primary' : 'secondary', medium: i === 0 ? 'structure' : 'text', ...(i === 2 ? { relatesTo: ['conditions'] } : {}) })),
      relations: [{ type: 'condition', from: ['conditions'], to: 'decision', meaning: '同时满足才能扩围' }, { type: 'support', from: ['process'], to: 'decision', meaning: '阶段证据支撑范围判断' }],
      composition: { op: 'row', weights: [2, 1], children: [{ groupId: 'process' }, { op: 'column', children: [{ groupId: 'conditions' }, { groupId: 'decision' }] }] },
      readingOrder: ['process', 'conditions', 'decision'], alignment: '条件对应决策', fitStrategy: '不足则重组'
    }, contracts: { process: { minWidth: 600, minHeight: 300 }, conditions: { minWidth: 400, minHeight: 200 }, decision: { minWidth: 400, minHeight: 130 } }
  };
}

test('嵌套解析满足容量、正文边界与组间隔，重复输入输出一致', () => {
  const value = input(); const result = resolveComposition(value);
  assert.deepEqual(result, resolveComposition(value));
  const { process, conditions, decision } = result.regions;
  assert.equal(conditions.left - process.left - process.width, 28);
  assert.ok(Math.abs(decision.top - conditions.top - conditions.height - 28) < 1e-6);
  for (const [id, frame] of Object.entries(result.regions)) {
    assert.ok(frame.width >= value.contracts[id].minWidth && frame.height >= value.contracts[id].minHeight);
    assert.ok(frame.left >= 55 && frame.top >= 166 && frame.left + frame.width <= 1225.00001 && frame.top + frame.height <= 658.00001);
  }
  assert.throws(() => { result.regions.process.width = 1; }, TypeError);
  assert.equal(result.visualStatus, 'not-evaluated');
});

test('容量失败、孤立关系与未知锚点在绘制前明确拒绝', () => {
  const tooSmall = input(); tooSmall.contracts.conditions.minHeight = 400;
  assert.throws(() => resolveComposition(tooSmall), CompositionFitError);
  const orphan = input(); orphan.intent.relations.pop();
  assert.throws(() => resolveComposition(orphan), /缺少逻辑关联/);
  const missing = input(); delete missing.contracts.decision;
  assert.throws(() => resolveComposition(missing), /容量契约/);
  const anchored = input(); anchored.intent.composition.op = 'annotate'; delete anchored.intent.composition.weights;
  assert.throws(() => resolveComposition(anchored), /锚点/);
});

test('嵌套网格按共同列与行分配并预检容量', () => {
  const value = input(); value.intent.composition = { op: 'grid', columns: 2, children: value.intent.groups.map(g => ({ groupId: g.id })) };
  value.contracts = Object.fromEntries(value.intent.groups.map(g => [g.id, { minWidth: 300, minHeight: 150 }]));
  const result = resolveComposition(value);
  assert.equal(result.regions.process.top, result.regions.conditions.top);
  assert.equal(result.regions.process.left, result.regions.decision.left);
  assert.equal(result.regions.process.width, result.regions.conditions.width);
});

test('同一计划按阅读顺序驱动全部构建器，缺失构建器不产生半页', async () => {
  const resolved = resolveComposition(input()); const calls = [];
  const builders = Object.fromEntries(resolved.intent.groups.map(g => [g.id, async context => { calls.push(context); return { count: 1 }; }]));
  const bad = { ...builders }; delete bad.decision;
  await assert.rejects(buildComposition({ resolved, builders: bad }), /缺少/);
  assert.equal(calls.length, 0);
  const output = await buildComposition({ resolved, builders });
  assert.deepEqual(calls.map(c => c.group.id), resolved.intent.readingOrder);
  assert.equal(calls[0].frame, resolved.regions.process);
  assert.equal(output.records.length, 3);
  assert.equal(output.visualStatus, 'not-evaluated');
});

test('上下相关组放入共享列，最小宽度不同也不产生跨层错位', () => {
  const value = input();
  value.intent.groups.push({ id: 'note', role: 'annotation', message: '证据边界', sourceRefs: ['模拟稿'], emphasis: 'supporting', medium: 'text' });
  value.intent.readingOrder.push('note');
  value.intent.relations.push({ type: 'condition', from: ['note'], to: 'decision', meaning: '限定决策范围' });
  value.contracts = { process: {minWidth: 500, minHeight: 180}, conditions: {minWidth: 600, minHeight: 160}, decision: {minWidth: 400, minHeight: 120}, note: {minWidth: 300, minHeight: 150} };
  value.intent.composition = { op: 'row', children: [
    {op: 'column', children: [{groupId: 'process'}, {groupId: 'conditions'}]},
    {op: 'column', children: [{groupId: 'decision'}, {groupId: 'note'}]}
  ] };
  const { regions } = resolveComposition(value);
  for (const [a, b] of [['process', 'conditions'], ['decision', 'note']]) {
    assert.equal(regions[a].left, regions[b].left);
    assert.equal(regions[a].width, regions[b].width);
  }
});
