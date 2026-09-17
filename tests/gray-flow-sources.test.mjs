import test from 'node:test';
import assert from 'node:assert/strict';
import { newRunState } from '../src/runner/state.mjs';
import { markFlowSources, validateSemanticPlan } from '../src/runner/gray-semantics.mjs';

const mark = sources => markFlowSources(sources.map((text, index) => ({ id: `s${index + 1}`, text })));

const DOC = [
  '关于开展固定资产盘点工作的通知',
  '各部门：',
  '请各部门于 2026年9月17日 前完成自查，逐一核对资产编号。',
  '资产管理处\n2026年9月17日',
].join('\n\n');

const base = () => {
  const state = newRunState(DOC, 'fixture');
  state.sources = markFlowSources(state.sources);
  return state;
};

const plan = (text, sourceIds) => ({
  schemaVersion: 'gray-plan-3',
  deckBrief: { title: '盘点安排', audience: '各部门', objective: '明确自查安排' },
  pages: [{
    pageId: 'p1', title: '自查安排', claim: '按期完成资产自查', pagePurpose: '明确任务', narrative: '自查为单一行动',
    groups: [{
      id: 'g1', role: '行动', heading: '自查安排', importance: 'primary', kind: 'text',
      blocks: [{ id: 'b1', text, sourceIds }],
    }],
  }],
});

test('流转信息按窄模式打标：标题、称谓、发文字号、落款', () => {
  assert.equal(mark(['关于开展固定资产盘点工作的通知'])[0].flow, '文种标题');
  assert.equal(mark(['《固定资产管理办法》'])[0].flow, '文种标题');
  assert.equal(mark(['各部门：'])[0].flow, '称谓');
  assert.equal(mark(['各科室、各直属单位：'])[0].flow, '称谓');
  assert.equal(mark(['东大资发〔2026〕12号'])[0].flow, '发文字号');
  const tail = mark(['正文一。', '正文二。', '资产管理处\n2026年9月17日']);
  assert.equal(tail[2].flow, '落款');
});

test('宁可漏标不误标：正文引用、说明句、中段短行都不打标', () => {
  assert.equal(mark(['根据《关于开展固定资产盘点工作的通知》要求，现将有关事项通知如下。'])[0].flow, undefined);
  assert.equal(mark(['各部门职责如下：'])[0].flow, undefined);
  const middle = mark(['资产管理处\n2026年9月17日', '正文一。', '正文二。', '正文三。']);
  assert.equal(middle[0].flow, undefined);
  const dateInText = mark(['请于 2026年9月17日 前完成自查，逐一核对。', '正文。', '更多正文。']);
  assert.equal(dateInText[0].flow, undefined);
  const dateOnlyTail = mark(['正文一。', '正文二。', '2026年9月17日']);
  assert.equal(dateOnlyTail[2].flow, undefined);
  const heading = markFlowSources([{ id: 's1', heading: '通知', text: '关于开展固定资产盘点工作的通知' }]);
  assert.equal(heading[0].flow, undefined);
});

test('覆盖检查豁免流转来源：只引用正文即可通过，未打标时仍强制覆盖', () => {
  const markedBase = base();
  assert.equal(markedBase.sources[0].flow, '文种标题');
  assert.equal(markedBase.sources[1].flow, '称谓');
  assert.equal(markedBase.sources[3].flow, '落款');
  const onlyBody = plan('请各部门完成自查，逐一核对资产编号。', ['s3']);
  const report = validateSemanticPlan(markedBase, onlyBody);
  assert.equal(report.accepted, true, JSON.stringify(report.issues));
  const plain = newRunState(DOC, 'fixture');
  const control = validateSemanticPlan(plain, onlyBody);
  assert.equal(control.accepted, false);
  assert.ok(control.issues.some(issue => issue.code === 'missing-source-coverage'));
  const uncovered = validateSemanticPlan(markedBase, plan('请各部门完成自查。', ['s1']));
  assert.ok(uncovered.issues.some(issue => issue.code === 'missing-source-coverage' && issue.sourceIds?.includes('s3')));
});

test('流转信息不得上屏：标题、称谓、落款整段出现在正文都失败', () => {
  const markedBase = base();
  const title = validateSemanticPlan(markedBase, plan('关于开展固定资产盘点工作的通知', ['s1']));
  assert.ok(title.issues.some(issue => issue.code === 'flow-source-onscreen'));
  const greeting = validateSemanticPlan(markedBase, plan('各部门：', ['s2']));
  assert.ok(greeting.issues.some(issue => issue.code === 'flow-source-onscreen'));
  const signature = validateSemanticPlan(markedBase, plan('资产管理处\n2026年9月17日', ['s4']));
  assert.ok(signature.issues.some(issue => issue.code === 'flow-source-onscreen'));
});

test('正文里的日期不误伤：单独日期不算上屏，引用流转来源作为附加来源也不报错', () => {
  const markedBase = base();
  const dateOnly = validateSemanticPlan(markedBase, plan('请于 2026年9月17日 前完成自查，逐一核对资产编号。', ['s3']));
  assert.equal(dateOnly.accepted, true, JSON.stringify(dateOnly.issues));
  const padded = validateSemanticPlan(markedBase, plan('请各部门完成自查，逐一核对资产编号。', ['s3', 's1']));
  assert.equal(padded.accepted, true, JSON.stringify(padded.issues));
});
