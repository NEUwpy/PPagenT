import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEMPLATES, pageFeatures, defaultTemplateFor, layoutShape, applyTemplateDefaults } from '../src/runner/gray-templates.mjs';

const blocks = (count, chars = 10) => Array.from({ length: count }, (_, index) => ({ id: `b${index}`, text: '字'.repeat(chars) }));
const page = (id, groups) => ({ pageId: id, groups });

test('模板库 3–5 个、语义角色命名（非版位名），与 rules 真源同步', () => {
  assert.ok(TEMPLATES.length >= 3 && TEMPLATES.length <= 5);
  assert.deepEqual(TEMPLATES.map(template => template.name), ['类别容器', '单主体', '双栏对照', '行式清单']);
  for (const template of TEMPLATES) {
    assert.ok(!/栏|布局/.test(template.name) || template.name === '双栏对照');
    assert.ok(template.role && template.fit);
  }
  const rules = fs.readFileSync('rules/页面组合.md', 'utf8');
  for (const template of TEMPLATES) assert.ok(rules.includes(template.name), `rules 缺少模板：${template.name}`);
  assert.ok(rules.includes('override'), 'rules 缺少覆盖规则说明');
});

test('特征→默认映射可测试：组数分界与双栏权重按实文量', () => {
  assert.equal(defaultTemplateFor(page('p', [{ blocks: blocks(3) }])).id, 'category-container');
  assert.equal(defaultTemplateFor(page('p', [{ blocks: blocks(1) }])).id, 'single-subject');
  assert.equal(defaultTemplateFor(page('p', [{ blocks: blocks(2) }, { blocks: blocks(2) }])).id, 'dual-column');
  assert.equal(defaultTemplateFor(page('p', [{ blocks: blocks(1) }, { blocks: blocks(1) }, { blocks: blocks(1) }])).id, 'row-list');
  assert.equal(defaultTemplateFor(page('p', [])).id, 'single-subject');
  assert.equal(defaultTemplateFor(page('p', [])).layout.type, 'column');

  const lopsided = defaultTemplateFor(page('p', [{ blocks: blocks(1, 100) }, { blocks: blocks(1, 20) }])).layout;
  assert.deepEqual(lopsided, { type: 'row', weights: [4, 1] });
  const balanced = defaultTemplateFor(page('p', [{ blocks: blocks(1, 50) }, { blocks: blocks(1, 50) }])).layout;
  assert.deepEqual(balanced.weights, [3, 2]);
  const features = pageFeatures(page('p', [{ blocks: blocks(2) }, { kind: 'flow', blocks: blocks(1) }]));
  assert.equal(features.groupCount, 2);
  assert.equal(features.nonTextGroups, 1);
});

test('形状指纹忽略 weights：微调权重不算覆盖，结构不同才算', () => {
  assert.equal(layoutShape({ type: 'row', weights: [4, 1] }), layoutShape({ type: 'row', weights: [1, 4] }));
  assert.notEqual(layoutShape({ type: 'row' }), layoutShape({ type: 'column' }));
  const nested = { type: 'column', children: [{ type: 'row', children: [{ groupId: 'g1' }, { groupId: 'g2' }] }, { groupId: 'g3' }] };
  assert.equal(layoutShape(nested), 'column[row[group,group],group]');
});

test('applyTemplateDefaults：缺省用默认、同形放行、异形须理由、入档可分析', () => {
  const plan = { pages: [page('p1', [{ blocks: blocks(2) }]), page('p2', [{ blocks: blocks(1) }, { blocks: blocks(1) }])] };
  const viaDefault = applyTemplateDefaults(plan, [{ pageId: 'p1' }, { pageId: 'p2', layout: { type: 'row', weights: [1, 4] } }]);
  assert.deepEqual(viaDefault.decisions.map(decision => decision.mode), ['default', 'default']);
  assert.equal(viaDefault.layouts[0].layout.type, 'single');
  assert.deepEqual(viaDefault.layouts[1].layout.weights, [1, 4]);

  assert.throws(() => applyTemplateDefaults(plan, [{ pageId: 'p1' }, { pageId: 'p2', layout: { type: 'column' } }]), /默认模板「双栏对照」/);
  const overridden = applyTemplateDefaults(plan, [{ pageId: 'p1' }, { pageId: 'p2', layout: { type: 'column' }, override: { reason: '双栏放不下，改顺列' } }]);
  assert.equal(overridden.decisions[1].mode, 'override');
  assert.equal(overridden.decisions[1].reason, '双栏放不下，改顺列');
  assert.throws(() => applyTemplateDefaults(plan, [{ pageId: 'p1' }, { pageId: 'p2', layout: { type: 'row' } }, { pageId: 'p9' }]), /未知页面/);
});
