import test from 'node:test';
import assert from 'node:assert/strict';
import { newRunState } from '../src/runner/state.mjs';
import { categoryCues, markFlowSources, validateSemanticPlan } from '../src/runner/gray-semantics.mjs';

const DOC = [
  '要点清单',
  '首先是两点不足。一是甲问题。二是乙问题。',
  '其次是四点感悟。一是丙。二是丁。三是戊。四是己。',
].join('\n\n');

const base = () => {
  const state = newRunState(DOC, 'fixture');
  state.sources = markFlowSources(state.sources);
  return state;
};

const block = (id, text, sourceIds) => ({ id, text, sourceIds });
const group = (id, heading, blocks) => ({ id, role: '要点', heading, importance: 'primary', kind: 'text', blocks });
const page = (id, title, groups) => ({ pageId: id, title, claim: '类别成组测试主题句', pagePurpose: '测试', narrative: '两类并排', groups });

test('类别线索按窄模式提取：前缀+数词+量词+类别词', () => {
  const cues = categoryCues(base().sources);
  assert.deepEqual(cues.map(c => [c.count, c.noun]), [['两', '不足'], ['四', '感悟']]);
  const noisy = categoryCues([{ text: '闲置六个月的设备单独列表。有两个站未覆盖。在三个街道试点。达成三个市场化目标。' }]);
  assert.deepEqual(noisy, []);
});

test('类别成组：组标题承载类别词时通过（含跨页复合标题）', () => {
  const wrong = {
    schemaVersion: 'gray-plan-3',
    deckBrief: { title: 'x', audience: 'y', objective: 'z' },
    pages: [page('p1', '两类事项', [
      group('g1', '两点不足', [
        block('b1', '一是甲问题。二是乙问题。', ['s1', 's2']),
      ]),
      group('g2', '四点感悟', [
        block('b2', '一是丙。二是丁。三是戊。四是己。', ['s3']),
      ]),
    ])],
  };
  const pass = structuredClone(wrong);
  pass.pages[0].groups = [
    group('g1', '两点不足', [block('b1', '甲问题。', ['s2']), block('b2', '乙问题。', ['s1', 's2'])]),
    group('g2', '四点感悟', [block('b3', '丙丁戊己。', ['s3'])]),
  ];
  const report = validateSemanticPlan(base(), pass);
  assert.equal(report.accepted, true, JSON.stringify(report.issues));
  const split = structuredClone(pass);
  split.pages = [
    page('p1', '不足', [group('g1', '两点不足', [block('b1', '甲问题。乙问题。', ['s1', 's2'])])]),
    page('p2', '感悟（上）', [group('g2', '感悟：丙与丁', [block('b2', '丙。', ['s3']), block('b3', '丁。', ['s3'])])]),
    page('p3', '感悟（下）', [group('g3', '感悟：戊与己', [block('b4', '戊。', ['s3']), block('b5', '己。', ['s3'])])]),
  ];
  const splitReport = validateSemanticPlan(base(), split);
  assert.equal(splitReport.accepted, true, JSON.stringify(splitReport.issues));
});

test('类别成组：条目即组或只写页标题都失败', () => {
  const itemAsGroup = {
    schemaVersion: 'gray-plan-3',
    deckBrief: { title: 'x', audience: 'y', objective: 'z' },
    pages: [page('p1', '两点不足', [
      group('g1', '甲问题', [block('b1', '甲问题。', ['s1', 's2'])]),
      group('g2', '乙问题', [block('b2', '乙问题。', ['s2'])]),
      group('g3', '丙丁戊己四条', [block('b3', '丙丁戊己。', ['s3'])]),
    ])],
  };
  const report = validateSemanticPlan(base(), itemAsGroup);
  assert.equal(report.accepted, false);
  const problems = report.issues.filter(issue => issue.code === 'category-not-grouped');
  assert.equal(problems.length, 2); // 不足、感悟都未由组标题承载
  const onlyTitle = structuredClone(itemAsGroup);
  onlyTitle.pages[0].title = '两点不足与四点感悟';
  const second = validateSemanticPlan(base(), onlyTitle);
  assert.equal(second.issues.filter(issue => issue.code === 'category-not-grouped').length, 2);
});

test('无类别线索的稿件不受本检查影响', () => {
  const plain = newRunState('各部门于十一月完成自查。抽查比例不低于百分之二十。', 'fixture');
  const plan = {
    schemaVersion: 'gray-plan-3',
    deckBrief: { title: 'x', audience: 'y', objective: 'z' },
    pages: [page('p1', '自查与抽查', [
      group('g1', '自查安排', [block('b1', '各部门于十一月完成自查。', ['s1', 's2'])]),
      group('g2', '抽查安排', [block('b2', '抽查比例不低于百分之二十。', ['s2'])]),
    ])],
  };
  const report = validateSemanticPlan(plain, plan);
  assert.equal(report.issues.filter(issue => issue.code === 'category-not-grouped').length, 0);
});
