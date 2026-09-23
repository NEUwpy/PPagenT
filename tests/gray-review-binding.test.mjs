import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planContentFingerprint, checkReviewCoverage, grayDisplayBlocks, semanticReviewInput, validateSemanticPlan, validateSemanticReviewEvidence,
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

test('结构化审稿证据允许忠实摘要与原文确有的因果关系', () => {
  const source = '每份申请都必须在30日内完成复核。延迟会导致权限无法开放。';
  const visible = '申请须30日内完成复核；延迟致权限无法开放。';
  const p = plan([block('b1', visible)]);
  const input = semanticReviewInput({ source, sourceSegments: [{ id: 's1', text: source }], area: { width: 1170, height: 492 }, plan: p });
  const bodyLocation = input.auditLocations.find(location => location.field === 'body');
  const audit = {
    schemaVersion: 'gray-claim-audit-1',
    sourceCoverage: [
      { sourceId: 's1', quote: '每份申请都必须在30日内完成复核。', classification: 'material-claim', claimIds: ['c1'] },
      { sourceId: 's1', quote: '延迟会导致权限无法开放。', classification: 'material-claim', claimIds: ['c2'] },
    ],
    locationCoverage: input.auditLocations.map(location => location.id === bodyLocation.id
      ? { locationId: location.id, classification: 'material-claim', claimIds: ['c1', 'c2'] }
      : { locationId: location.id, classification: 'non-claim', claimIds: [], reason: '标题或结构定位文字' }),
    claims: [
      {
        id: 'c1', pageId: 'p1', sourceEvidence: [{ sourceId: 's1', quote: '每份申请都必须在30日内完成复核。' }],
        visibleEvidence: [{ locationId: bodyLocation.id, quote: '申请须30日内完成复核' }],
        sourceForce: '对每份申请设定30日内完成复核的义务', visibleForce: '摘要仍对申请表达30日内完成复核的义务',
        addedImplications: { causality: false, certainty: false, obligation: false, scope: false }, ruling: 'equivalent', rationale: '压缩措辞但保留对象、期限与义务',
      },
      {
        id: 'c2', pageId: 'p1', sourceEvidence: [{ sourceId: 's1', quote: '延迟会导致权限无法开放。' }],
        visibleEvidence: [{ locationId: bodyLocation.id, quote: '延迟致权限无法开放' }],
        sourceForce: '原稿明确陈述延迟导致无法开放权限', visibleForce: '摘要继续表达延迟导致无法开放权限',
        addedImplications: { causality: false, certainty: false, obligation: false, scope: false }, ruling: 'equivalent', rationale: '原稿已有因果关系，摘要没有新加因果',
      },
    ],
  };
  const response = { accepted: true, issues: [], claimAudit: audit };
  const validation = validateSemanticReviewEvidence(input, response);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(audit.claims[1].addedImplications.causality, false);
  assert.equal(audit.claims[1].ruling, 'equivalent');
});

test('结构化审稿证据核验精确来源、上屏位置和 issue-ruling 一致性', () => {
  const source = '每份申请都必须在30日内完成复核。延迟会导致权限无法开放。';
  const visible = '申请须30日内完成复核；延迟致权限无法开放。';
  const p = plan([block('b1', visible)]);
  const input = semanticReviewInput({ source, sourceSegments: [{ id: 's1', text: source }], area: { width: 1170, height: 492 }, plan: p });
  const bodyLocation = input.auditLocations.find(location => location.field === 'body');
  const claim = {
    id: 'c1', pageId: 'p1', sourceEvidence: [{ sourceId: 's1', quote: '每份申请都必须在30日内完成复核。' }],
    visibleEvidence: [{ locationId: bodyLocation.id, quote: '申请须30日内完成复核' }],
    sourceForce: '原稿有明确期限义务', visibleForce: '正文省略了必须义务',
    addedImplications: { causality: false, certainty: false, obligation: false, scope: false }, ruling: 'weakened', rationale: '文字改写削弱原稿义务强度',
  };
  const audit = {
    schemaVersion: 'gray-claim-audit-1',
    sourceCoverage: [{ sourceId: 's1', quote: claim.sourceEvidence[0].quote, classification: 'material-claim', claimIds: ['c1'] }],
    locationCoverage: input.auditLocations.map(location => location.id === bodyLocation.id
      ? { locationId: location.id, classification: 'material-claim', claimIds: ['c1'] }
      : { locationId: location.id, classification: 'non-claim', claimIds: [], reason: '非命题文字' }),
    claims: [claim],
  };
  const response = {
    accepted: false,
    issues: [{ pageId: 'p1', sourceIds: ['s1'], claimIds: ['c1'], problem: '义务强度变弱', requiredRevision: '保留必须复核' }],
    claimAudit: audit,
  };
  assert.equal(validateSemanticReviewEvidence(input, response).valid, true);
  const badSource = structuredClone(response);
  badSource.claimAudit.claims[0].sourceEvidence[0].sourceId = 'unknown';
  assert.equal(validateSemanticReviewEvidence(input, badSource).valid, false);
  const badPosition = structuredClone(response);
  badPosition.claimAudit.claims[0].visibleEvidence[0].locationId = 'loc-9999';
  assert.equal(validateSemanticReviewEvidence(input, badPosition).valid, false);
  const badRuling = structuredClone(response);
  badRuling.claimAudit.claims[0].ruling = 'equivalent';
  assert.equal(validateSemanticReviewEvidence(input, badRuling).valid, false);

  const uncertain = structuredClone(response);
  const uncertainReason = '仅凭当前文字无法确认义务强度是否被削弱';
  uncertain.accepted = true;
  uncertain.issues = [];
  uncertain.notes = [`c1：未证实，${uncertainReason}`];
  uncertain.claimAudit.claims[0].ruling = 'uncertain';
  uncertain.claimAudit.claims[0].uncertainReason = uncertainReason;
  assert.equal(validateSemanticReviewEvidence(input, uncertain).valid, true, '未证实的疑点可留在 notes，不强制修订');
  const uncertainAsIssue = structuredClone(uncertain);
  uncertainAsIssue.accepted = false;
  uncertainAsIssue.issues = response.issues;
  assert.equal(validateSemanticReviewEvidence(input, uncertainAsIssue).valid, false, '未证实裁定不得进入阻塞队列');
  const uncertainWithoutNote = structuredClone(uncertain);
  uncertainWithoutNote.notes = [];
  assert.equal(validateSemanticReviewEvidence(input, uncertainWithoutNote).valid, false, '未证实原因必须出现在 notes');
});

test('层级机制：scope:"group" 的共同说明不编号、随组以小字呈现（评审 #119 要求 3）', () => {
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
  // 呈现形态以布局实测为准（评审 #121）：共同说明 12px，条目 22px——与契约/审稿声明一致。
  const layout = grayBodyLayout(item, 800, 22, 2000);
  const premiseRuns = layout.runs.filter(run => run.text === '共同前提' || run.text === '两项缺一不可');
  assert.ok(premiseRuns.length >= 1);
  assert.ok(premiseRuns.every(run => run.fontSize === 12), JSON.stringify(premiseRuns.map(run => run.fontSize)));
  const entryRuns = layout.runs.filter(run => run.text === '一 焊前' || run.text === '二 焊接时');
  assert.equal(entryRuns.length, 2);
  assert.ok(entryRuns.every(run => run.fontSize === 22));
});

test('声明一致性：scope:"group" 的呈现声明（不编号、12px）与布局实测一致（评审 #121）', () => {
  const blocks = [
    { id: 'b1', label: '焊前', text: '清理油污', sourceIds: ['s1'] },
    { id: 'b2', label: '焊接时', text: '双面保护', sourceIds: ['s1'] },
    { id: 'b3', label: '共同前提', text: '两项缺一不可', sourceIds: ['s1'], scope: 'group' },
  ];
  const layout = grayBodyLayout({ id: 'g1', kind: 'text', blocks }, 800, 22, 2000);
  const premiseRuns = layout.runs.filter(run => run.text === '共同前提' || run.text === '两项缺一不可');
  assert.ok(premiseRuns.length >= 1);
  assert.ok(premiseRuns.every(run => run.fontSize === 12), '布局实测须为 12px');
  const input = semanticReviewInput({ source: DOC, area: { width: 1170, height: 492 }, plan: plan(blocks) });
  const surface = input.visiblePages[0].regions[0].surface;
  assert.match(surface, /12px/u, '审稿声明须与实测一致（12px）');
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
