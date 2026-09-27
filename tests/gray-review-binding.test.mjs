import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planContentFingerprint, checkReviewCoverage, grayDisplayBlocks, semanticReviewInput, validateSemanticPlan,
} from '../src/runner/gray-semantics.mjs';
import { grayBodyLayout } from '../src/runner/gray-draft.mjs';
import { newRunState } from '../src/runner/state.mjs';

const DOC = '先把事实说清楚。\n\n再把安排讲明白。';
const base = () => newRunState(DOC, 'fixture');

const block = (id, text, extra = {}) => ({ id, text, sourceIds: ['s1'], ...extra });
const plan = blocks => ({
  schemaVersion: 'gray-plan-3',
  deckBrief: { title: '题', audience: '众', objective: '的' },
  pages: [{
    pageId: 'p1', title: '页面', claim: '结论先行', pagePurpose: '目的', narrative: '关系',
    groups: [{ id: 'g1', role: '职责', heading: '组', importance: 'primary', kind: 'text', blocks }],
  }],
});

test('内容指纹：只随可见内容变化，backstage 与来源改绑不作废', () => {
  const a = plan([block('b1', '先把事实说清楚。', { label: '事实' })]);
  const b = plan([block('b1', '先把事实说清楚。', { label: '事实' })]);
  assert.equal(planContentFingerprint(a), planContentFingerprint(b));
  const changed = plan([block('b1', '先把事实说清楚！', { label: '事实' })]);
  assert.notEqual(planContentFingerprint(a), planContentFingerprint(changed));
  const backstage = plan([block('b1', '先把事实说清楚。', { label: '事实' })]);
  backstage.pages[0].narrative = '换了后台叙述';
  backstage.planningNotes = '换了后台说明';
  backstage.pages[0].groups[0].blocks[0].sourceIds = ['s2'];
  assert.equal(planContentFingerprint(a), planContentFingerprint(backstage));
  const scoped = plan([block('b1', '先把事实说清楚。', { label: '事实', scope: 'group' })]);
  assert.notEqual(planContentFingerprint(a), planContentFingerprint(scoped));
});

test('审稿覆盖判定：未审/未通过/内容已改都不得继承通过状态', () => {
  const p = plan([block('b1', '先把事实说清楚。', { label: '事实' })]);
  const fp = planContentFingerprint(p);
  assert.equal(checkReviewCoverage(null, p).status, 'not-reviewed');
  assert.equal(checkReviewCoverage({ accepted: false, fingerprint: fp }, p).status, 'open-issues');
  assert.equal(checkReviewCoverage({ accepted: true, fingerprint: fp.slice(0, 8) }, p).status, 'stale');
  const covered = checkReviewCoverage({ accepted: true, fingerprint: fp }, p);
  assert.equal(covered.status, 'covered');
  assert.equal(covered.covered, true);
  const changed = plan([block('b1', '先把事实说清楚。', { label: '事实二' })]);
  const stale = checkReviewCoverage({ accepted: true, fingerprint: fp }, changed);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.reviewedFingerprint, fp);
  assert.notEqual(stale.fingerprint, fp);
});

test('层级机制：scope:"group" 的共同说明不编号、随组以正文字号呈现（评审 #119 要求 3）', () => {
  const item = {
    id: 'g1', kind: 'text',
    blocks: [
      { id: 'b1', label: '焊前', text: '清理油污', sourceIds: ['s1'] },
      { id: 'b2', label: '焊接时', text: '双面保护', sourceIds: ['s1'] },
      { id: 'b3', label: '共同前提', text: '两项缺一不可', sourceIds: ['s1'], scope: 'group' },
    ],
  };
  const parts = grayDisplayBlocks(item);
  const texts = parts.map(part => part.text);
  assert.ok(texts.includes('一 焊前'));
  assert.ok(texts.includes('二 焊接时'));
  assert.ok(texts.includes('共同前提'));
  assert.ok(!texts.some(text => /[一二三四五] 共同前提/u.test(text)));
  const groupScoped = parts.filter(part => part.text === '共同前提' || part.text === '两项缺一不可');
  assert.equal(groupScoped.length, 2);
  assert.ok(groupScoped.every(part => part.attachment === true));
  // 呈现形态以布局实测为准（评审 #121）：共同说明 22px，条目 22px——与契约/审稿声明一致。
  const layout = grayBodyLayout(item, 800, 22, 2000);
  const premiseRuns = layout.runs.filter(run => run.text === '共同前提' || run.text === '两项缺一不可');
  assert.ok(premiseRuns.length >= 1);
  assert.ok(premiseRuns.every(run => run.fontSize === 22), JSON.stringify(premiseRuns.map(run => run.fontSize)));
  const entryRuns = layout.runs.filter(run => run.text === '一 焊前' || run.text === '二 焊接时');
  assert.equal(entryRuns.length, 2);
  assert.ok(entryRuns.every(run => run.fontSize === 22));
});

test('声明一致性：scope:"group" 的呈现声明（不编号、正文字号）与布局实测一致（评审 #121）', () => {
  const blocks = [
    { id: 'b1', label: '焊前', text: '清理油污', sourceIds: ['s1'] },
    { id: 'b2', label: '焊接时', text: '双面保护', sourceIds: ['s1'] },
    { id: 'b3', label: '共同前提', text: '两项缺一不可', sourceIds: ['s1'], scope: 'group' },
  ];
  const layout = grayBodyLayout({ id: 'g1', kind: 'text', blocks }, 800, 22, 2000);
  const premiseRuns = layout.runs.filter(run => run.text === '共同前提' || run.text === '两项缺一不可');
  assert.ok(premiseRuns.length >= 1);
  assert.ok(premiseRuns.every(run => run.fontSize === 22), '布局实测须为本页22px正文');
  const input = semanticReviewInput({ source: DOC, area: { width: 1170, height: 492 }, plan: plan(blocks) });
  const surface = input.visiblePages[0].regions[0].surface;
  assert.match(surface, /本页正文字号/u, '审稿声明须与实测一致');
  assert.match(surface, /不编号/u);
});

test('层级机制校验：scope 合法通过；未知值/结构块/整组共同说明被拒（评审 #119 要求 3）', () => {
  const ok = plan([
    block('b1', '先把事实说清楚。', { label: '事实' }),
    { id: 'b2', text: '再把安排讲明白。', sourceIds: ['s2'], label: '安排' },
    block('b3', '先把事实说清楚。', { label: '共同前提', scope: 'group' }),
  ]);
  const okReport = validateSemanticPlan(base(), ok);
  assert.equal(okReport.accepted, true, JSON.stringify(okReport.issues));
  const unknown = plan([block('b1', '先把事实说清楚。', { label: '事实', scope: 'items' })]);
  const unknownReport = validateSemanticPlan(base(), unknown);
  assert.ok(unknownReport.issues.some(issue => issue.code === 'invalid-semantic-plan'));
  const onStructure = plan([block('b1', '先把事实说清楚。', { label: '事实', kind: 'flow', scope: 'group', expression: 'e', relationship: 'r', production: 'p' })]);
  const onStructureReport = validateSemanticPlan(base(), onStructure);
  assert.ok(onStructureReport.issues.some(issue => issue.code === 'invalid-semantic-plan'));
  const allScoped = plan([{ id: 'b1', text: '先把事实说清楚。', sourceIds: ['s1', 's2'], label: '共同前提', scope: 'group' }]);
  const allScopedReport = validateSemanticPlan(base(), allScoped);
  assert.ok(allScopedReport.issues.some(issue => issue.code === 'invalid-semantic-plan'));
});

test('审稿可见范围声明组级共同说明与自动编号（评审 #119 要求 2）', () => {
  const p = plan([
    block('b1', '先把事实说清楚。', { label: '事实' }),
    { id: 'b2', text: '再把安排讲明白。', sourceIds: ['s2'], label: '安排' },
    block('b3', '先把事实说清楚。', { label: '共同前提', scope: 'group' }),
  ]);
  const input = semanticReviewInput({ source: DOC, area: { width: 1170, height: 492 }, plan: p });
  const surface = input.visiblePages[0].regions[0].surface;
  assert.ok(surface.includes('scope=group'));
  assert.ok(surface.includes('不编号'));
  const body = input.visiblePages[0].regions[0].body.map(part => part.text);
  assert.ok(body.includes('一 事实'));
  assert.ok(body.includes('二 安排'));
  assert.ok(body.includes('共同前提'));
});

test('text-only backstage expression metadata survives render fingerprint round trip', () => {
  const a=plan([block('b1','正文',{label:'要点'})]);
  const b=structuredClone(a);
  Object.assign(b.pages[0].groups[0],{expression:'后台表达',relationship:'后台关系',production:'后台要求'});
  assert.equal(planContentFingerprint(a),planContentFingerprint(b));
  b.pages[0].groups[0].blocks[0].label='另一个要点';
  assert.notEqual(planContentFingerprint(a),planContentFingerprint(b));
  a.pages[0].groups[0].kind='diagram';
  const diagram=structuredClone(a);diagram.pages[0].groups[0].production='图形制作要求';
  assert.notEqual(planContentFingerprint(a),planContentFingerprint(diagram));
});

test('visible block production change invalidates semantic review', () => {
  const a=plan([block('b1','节点',{kind:'diagram',expression:'说明',relationship:'关联',production:'左向右'})]);
  const b=structuredClone(a);b.pages[0].groups[0].blocks[0].production='上向下';
  assert.notEqual(planContentFingerprint(a),planContentFingerprint(b));
  assert.equal(checkReviewCoverage({accepted:true,fingerprint:planContentFingerprint(a)},b).status,'stale');
});

test('group scope inherits every body tier while notes stay 12px',()=>{
 const item={kind:'text',blocks:[block('a','主要条目',{label:'要点'}),block('b','局部附注',{kind:'note'}),block('c','整组条件',{scope:'group'})]};
 for(const font of [22,20,18]){
  const body=grayBodyLayout(item,300,font);
  assert.equal(body.runs.find(r=>r.text==='整组条件').fontSize,font);
  assert.equal(body.runs.find(r=>r.text==='局部附注').fontSize,12);
  assert(body.runs.findIndex(r=>r.text==='整组条件')>body.runs.findIndex(r=>r.text==='局部附注'));
 }
});
