import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEMPLATES, pageFeatures, defaultTemplateFor, layoutShape, applyTemplateDefaults, describeDefaults } from '../src/runner/gray-templates.mjs';

const blocks = (count, chars = 10) => Array.from({ length: count }, (_, index) => ({ id: `b${index}`, text: '字'.repeat(chars) }));
const page = (id, groups) => ({ pageId: id, groups });

test('模板库 3–5 个、语义角色命名（非版位名），与 rules 真源同步', () => {
  assert.ok(TEMPLATES.length >= 3 && TEMPLATES.length <= 5);
  assert.deepEqual(TEMPLATES.map(template => template.name), ['类别容器', '单主体', '双栏对照', '行式清单', '头带主线']);
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

test('映射边界反例（取自覆盖样本）：两组主从走纵向、三组头带走 column[row,主]', () => {
  // C03 覆盖样本：g1 数据主体（primary）＋g2 质量限定（supporting）→ 单主体/column
  const mainNote = defaultTemplateFor(page('p', [
    { id: 'g1', importance: 'primary', blocks: blocks(1, 100) },
    { id: 'g2', importance: 'supporting', blocks: blocks(1, 40) },
  ]));
  assert.equal(mainNote.id, 'single-subject');
  assert.deepEqual(mainNote.layout, { type: 'column' });
  // B02 覆盖样本：末组为唯一非 text 主体、前两组短文本 → 头带主线
  const bandMain = defaultTemplateFor(page('p', [
    { id: 'g1', blocks: blocks(1, 50) },
    { id: 'g2', blocks: blocks(1, 40) },
    { id: 'g3', kind: 'flow', blocks: blocks(4, 30) },
  ]));
  assert.equal(bandMain.id, 'band-main');
  assert.equal(layoutShape(bandMain.layout), 'column[row[group,group],group]');
  // 顺序不符（主体在首）不套头带，落回行式清单
  assert.equal(defaultTemplateFor(page('p', [
    { id: 'g1', kind: 'flow', blocks: blocks(4, 30) },
    { id: 'g2', blocks: blocks(1, 50) },
    { id: 'g3', blocks: blocks(1, 40) },
  ])).id, 'row-list');
  // 头带超长不套
  assert.equal(defaultTemplateFor(page('p', [
    { id: 'g1', blocks: blocks(1, 120) },
    { id: 'g2', blocks: blocks(1, 120) },
    { id: 'g3', kind: 'flow', blocks: blocks(4, 30) },
  ])).id, 'row-list');
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

  const described = describeDefaults(plan);
  assert.deepEqual(described.map(item => item.name), ['类别容器', '双栏对照']);
  assert.equal(described[0].features.groupCount, 1);
});
