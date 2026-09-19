import test from 'node:test';
import assert from 'node:assert/strict';
import { newRunState } from '../src/runner/state.mjs';
import { validateSemanticPlan, semanticReviewInput, grayDisplayBlocks, semanticPages, labelHasOrdinal, SEMANTIC_REVIEW_CONTRACT } from '../src/runner/gray-semantics.mjs';
import { grayBodyLayout } from '../src/runner/gray-draft.mjs';

const source = '具体是三个要点：焊前彻底清理油污和氧化膜；焊接时用高纯度氩气双面保护；层间温度不超过 150 度。三条缺一条，接头质量就没有保障。';
const base = () => {
  const state = newRunState('焊接要点。', 'fixture');
  state.sources = [{ id: 's1', text: source }];
  return state;
};
const page = groups => ({ pageId: 'p1', title: '保护熔池的三个要点', claim: '三个要点缺一不可', pagePurpose: '交代操作要点及共同约束', narrative: '三条要点并列，共同约束附着其后', groups });
const group = () => ({
  id: 'g1', role: '操作要点', heading: '保护熔池的三个要点', importance: 'primary', kind: 'text',
  blocks: [
    { id: 'b1', label: '焊前清理', text: '彻底清理油污和氧化膜。', sourceIds: ['s1'] },
    { id: 'b2', label: '焊接保护', text: '用高纯度氩气双面保护。', sourceIds: ['s1'] },
    { id: 'b3', label: '层间温度', text: '不超过 150 度。', sourceIds: ['s1'] },
  ],
});
const plan = groups => ({ schemaVersion: 'gray-plan-3', deckBrief: { title: '焊接培训', audience: '焊接学员', objective: '记住三个要点' }, pages: [page(groups)] });

test('附着说明块：紧随所属条目、不编号、无占位框，审稿投影带 attachment 标记', () => {
  const groups = group();
  groups.blocks.push({ id: 'b4', label: '缺一不可', kind: 'note', text: '三条缺一条，接头质量就没有保障。', sourceIds: ['s1'] });
  const report = validateSemanticPlan(base(), plan([groups]));
  assert.equal(report.accepted, true, JSON.stringify(report.issues));
  const item = semanticPages(plan([groups]))[0].items[0];
  const display = grayDisplayBlocks(item);
  assert.deepEqual(display.filter(run => run.bold).map(run => run.text), ['一 焊前清理', '二 焊接保护', '三 层间温度', '缺一不可']);
  assert.equal(display.filter(run => run.attachment).length, 2);
  assert.deepEqual(display.filter(run => run.kind === 'note').map(run => run.text), ['三条缺一条，接头质量就没有保障。']);
  const body = grayBodyLayout(item, 600, 22);
  assert.equal(body.sections.length, 3);
  assert.ok(body.sections[2].noteArea, '附注并入前一条目');
  assert.ok(!body.sections.some(section => section.placeholder), '附着说明不产生蓝框占位');
  const noteRuns = body.runs.filter(run => run.kind === 'note');
  assert.equal(noteRuns.length, 1);
  assert.equal(noteRuns[0].fontSize, 12);
  assert.equal(body.runs.map(run => run.text).join('\n').includes('四 缺一不可'), false);
  const review = semanticReviewInput({ source: base().sources, area: { width: 600, height: 492 }, plan: plan([groups]) });
  assert.deepEqual(review.visiblePages[0].regions[0].body, grayDisplayBlocks(item));
  assert.match(review.visiblePages[0].regions[0].surface, /附着说明/);
  assert.match(JSON.stringify(review.visiblePages), /attachment/);
});

test('附着说明必须紧跟文字条目：首块、紧跟另一附注都拒绝', () => {
  const first = group();
  first.blocks.unshift({ id: 'b0', kind: 'note', text: '三条缺一条，接头质量就没有保障。', sourceIds: ['s1'] });
  const firstReport = validateSemanticPlan(base(), plan([first]));
  assert.equal(firstReport.accepted, false);
  assert.ok(firstReport.issues.some(issue => issue.code === 'attachment-not-adjacent'), JSON.stringify(firstReport.issues));
  const double = group();
  double.blocks.push({ id: 'b4', kind: 'note', text: '三条缺一条，接头质量就没有保障。', sourceIds: ['s1'] });
  double.blocks.push({ id: 'b5', kind: 'note', text: '不超过 150 度。', sourceIds: ['s1'] });
  assert.ok(validateSemanticPlan(base(), plan([double])).issues.some(issue => issue.code === 'attachment-not-adjacent'));
  const withProduction = group();
  withProduction.blocks.push({ id: 'b4', kind: 'note', text: '三条缺一条，接头质量就没有保障。', sourceIds: ['s1'], expression: '不应出现' });
  assert.equal(validateSemanticPlan(base(), plan([withProduction])).accepted, false);
});

test('label 序号检测：覆盖最小合规形态，不误伤常用词与惯用语', () => {
  assert.equal(labelHasOrdinal('原因一'), true);
  assert.equal(labelHasOrdinal('不足一'), true);
  assert.equal(labelHasOrdinal('第一条'), true);
  assert.equal(labelHasOrdinal('一、核验'), true);
  assert.equal(labelHasOrdinal('1. 核验'), true);
  assert.equal(labelHasOrdinal('（一）核验'), true);
  assert.equal(labelHasOrdinal('统一'), false);
  assert.equal(labelHasOrdinal('安全第一'), false);
  assert.equal(labelHasOrdinal('核验与开放'), false);
  const groups = group();
  groups.blocks[0].label = '原因一';
  const report = validateSemanticPlan(base(), plan([groups]));
  assert.equal(report.accepted, false);
  assert.ok(report.issues.some(issue => issue.code === 'label-ordinal'));
  const legacy = { id: 'g9', kind: 'text', blocks: [
    { id: 'x1', label: '原因一', text: '甲。' },
    { id: 'x2', label: '原因二', text: '乙。' },
  ] };
  assert.deepEqual(grayDisplayBlocks(legacy).filter(run => run.bold).map(run => run.text), ['原因一', '原因二']);
});

test('程序不按词表强制附注：同措辞不同真实关系与同关系换措辞都不触发结构要求', () => {
  const plain = plan([group()]);
  const plainReport = validateSemanticPlan(base(), plain);
  assert.equal(plainReport.accepted, true, JSON.stringify(plainReport.issues));
  assert.ok(!plainReport.issues.some(issue => issue.code.startsWith('attachment')));
  const reworded = group();
  reworded.blocks.push({ id: 'b4', label: '必须全做到', kind: 'note', text: '任何一条做不到，结果都不成立。', sourceIds: ['s1'] });
  const rewordedBase = base();
  rewordedBase.sources = [{ id: 's1', text: '具体是三个要点：焊前彻底清理油污和氧化膜；焊接时用高纯度氩气双面保护；层间温度不超过 150 度。任何一条做不到，结果都不成立。' }];
  const rewordedReport = validateSemanticPlan(rewordedBase, plan([reworded]));
  assert.equal(rewordedReport.accepted, true, JSON.stringify(rewordedReport.issues));
  const display = grayDisplayBlocks(semanticPages(plan([reworded]))[0].items[0]);
  assert.deepEqual(display.filter(run => run.bold).map(run => run.text).slice(-1), ['必须全做到']);
});

test('审稿契约写明程序序号口径：编号用于核对层级，kind:note 视为附着落实', () => {
  assert.match(SEMANTIC_REVIEW_CONTRACT, /序号不是模型标签/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /kind:note/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不得被编号成与主体同级的条目/u);
});
