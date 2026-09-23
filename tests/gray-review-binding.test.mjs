import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planContentFingerprint, checkReviewCoverage, grayDisplayBlocks, semanticReviewInput, semanticReviewFindings, validateSemanticPlan, validateSemanticReviewEvidence, SEMANTIC_REVIEW_CONTRACT,
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

function canonicalAudit(input, claims) {
  const linkedSources = new Set(claims.flatMap(claim => claim.sourceEvidence.map(item => item.sourceId)));
  const linkedLocations = new Set(claims.flatMap(claim => claim.visibleEvidence.map(item => item.locationId)));
  return {
    schemaVersion: 'gray-claim-audit-2',
    claims,
    unreferencedSources: input.sourceSegments
      .filter(segment => !linkedSources.has(segment.id))
      .map(segment => ({ sourceId: segment.id, disposition: 'non-claim', reason: '该来源段没有实质命题' })),
    unreferencedLocations: input.auditLocations
      .filter(location => !linkedLocations.has(location.id))
      .map(location => ({ locationId: location.id, disposition: 'non-claim', reason: '该位置仅为非命题文字' })),
  };
}

test('审稿只维护命题证据：位置直接带实文，引用派生不宣称语义完整', () => {
  const source = '每份申请都必须在30日内完成复核。延迟会导致权限无法开放。';
  const visible = '申请须30日内完成复核；延迟致权限无法开放。';
  const p = plan([block('b1', visible)]);
  const input = semanticReviewInput({ source, sourceSegments: [{ id: 's1', text: source }], area: { width: 1170, height: 492 }, plan: p });
  const bodyLocation = input.auditLocations.find(location => location.field === 'body');
  assert.equal(bodyLocation.text, visible, '审稿输入直接附上可见原文');

  const audit = canonicalAudit(input, [
    {
      id: 'c1',
      sourceEvidence: [{ sourceId: 's1', quote: '每份申请都必须在30日内完成复核。' }],
      visibleEvidence: [{ locationId: bodyLocation.id, quote: '申请须30日内完成复核' }],
      ruling: 'equivalent',
      rationale: '压缩措辞但保留对象、期限与义务。',
    },
    {
      id: 'c2',
      sourceEvidence: [{ sourceId: 's1', quote: '延迟会导致权限无法开放。' }],
      visibleEvidence: [{ locationId: bodyLocation.id, quote: '延迟致权限无法开放' }],
      ruling: 'equivalent',
      rationale: '来源与上屏都表达延迟导致权限无法开放。',
    },
  ]);
  const response = { notes: [], claimAudit: audit, organization: { verdict: 'pass', findings: [] } };
  const validation = validateSemanticReviewEvidence(input, response);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(Object.hasOwn(audit, 'sourceCoverage'), false);
  assert.equal(Object.hasOwn(audit, 'locationCoverage'), false);
  assert.equal(Object.hasOwn(audit.claims[0], 'addedImplications'), false);
  assert.equal(Object.hasOwn(audit.claims[0], 'sourceForce'), false);
  assert.deepEqual(semanticReviewFindings(response, input).issues, []);
  const duplicatedDecision = { ...response, accepted: true, issues: [] };
  assert.equal(validateSemanticReviewEvidence(input, duplicatedDecision).valid, false, '模型不能重复维护程序派生的通过与阻塞字段');
  assert.match(SEMANTIC_REVIEW_CONTRACT, /同一来源段已有一个引用，不表示该段其余命题已审完/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /概括性页面主题或分类标题的 sourceEvidence 必须引用能支持其判断的实质内容/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不证明语义完整或判断正确/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /organization:\{verdict:"pass\|revise",findings:/u);
});

test('organization 与事实 rulings 独立：revise 阻塞且必须引用真实上屏位置与文字', () => {
  const source = 'BLM方法推进指标与团队流程对齐，借此形成端到端数据路径并实现组织转型。';
  const visible = source;
  const p = plan([block('b1', visible)]);
  const input = semanticReviewInput({ source, sourceSegments: [{ id: 's1', text: source }], area: { width: 1170, height: 492 }, plan: p });
  const bodyLocation = input.auditLocations.find(location => location.field === 'body');
  const claim = {
    id: 'c1',
    sourceEvidence: [{ sourceId: 's1', quote: source }],
    visibleEvidence: [{ locationId: bodyLocation.id, quote: visible }],
    ruling: 'equivalent',
    rationale: '事实与关系忠实于来源。',
  };
  const response = {
    notes: [],
    claimAudit: canonicalAudit(input, [claim]),
    organization: { verdict: 'revise', findings: [{
      locationId: bodyLocation.id,
      quote: 'BLM方法推进指标与团队流程对齐，借此形成端到端数据路径并实现组织转型。',
      problem: '读者仍需从同一连续文字中自行拆出方法、条件、路径与目标之间的关系。',
      requiredRevision: '按来源中的实际关系组织成员，明确方法、对齐、路径与目标的对应。',
    }] },
  };
  assert.equal(response.claimAudit.claims.every(item => item.ruling === 'equivalent'), true);
  assert.equal(validateSemanticReviewEvidence(input, response).valid, true);
  const derived = semanticReviewFindings(response, input);
  assert.equal(derived.issues.length, 1);
  assert.equal(derived.issues[0].pageId, 'p1');
  assert.equal(derived.issues[0].locationId, bodyLocation.id);
  assert.equal(derived.issues[0].quote, response.organization.findings[0].quote);

  const pass = structuredClone(response);
  pass.organization = { verdict: 'pass', findings: [] };
  assert.equal(validateSemanticReviewEvidence(input, pass).valid, true);
  assert.deepEqual(semanticReviewFindings(pass, input).issues, []);

  const missing = structuredClone(response);
  delete missing.organization;
  assert.equal(validateSemanticReviewEvidence(input, missing).valid, false);
  const forgedLocation = structuredClone(response);
  forgedLocation.organization.findings[0].locationId = 'loc-9999';
  assert.equal(validateSemanticReviewEvidence(input, forgedLocation).valid, false);
  const forgedQuote = structuredClone(response);
  forgedQuote.organization.findings[0].quote = '并不存在的上屏文字';
  assert.equal(validateSemanticReviewEvidence(input, forgedQuote).valid, false);
  const invalidPass = structuredClone(response);
  invalidPass.organization.verdict = 'pass';
  assert.equal(validateSemanticReviewEvidence(input, invalidPass).valid, false);
  const emptyRevise = structuredClone(response);
  emptyRevise.organization.findings = [];
  assert.equal(validateSemanticReviewEvidence(input, emptyRevise).valid, false);
});

test('标题或标签改变正文关系时须合并命题引用，不能以 non-claim 豁免', () => {
  const source = '设备稳定性与维护频率有关。';
  const p = plan([block('b1', source, { label: '原因' })]);
  const input = semanticReviewInput({ source, sourceSegments: [{ id: 's1', text: source }], area: { width: 1170, height: 492 }, plan: p });
  const labelLocation = input.auditLocations.find(location => location.field === 'body' && location.text === '原因');
  const textLocation = input.auditLocations.find(location => location.field === 'body' && location.text.includes(source));
  assert.ok(labelLocation);
  assert.ok(textLocation);
  const response = {
    notes: [],
    claimAudit: canonicalAudit(input, [{
      id: 'c1',
      sourceEvidence: [{ sourceId: 's1', quote: source }],
      visibleEvidence: [
        { locationId: labelLocation.id, quote: '原因' },
        { locationId: textLocation.id, quote: source },
      ],
      ruling: 'strengthened',
      rationale: '上屏标签“原因”与正文合并后，把“有关”的关联升格为因果。',
    }]),
    organization: { verdict: 'pass', findings: [] },
  };
  assert.equal(validateSemanticReviewEvidence(input, response).valid, true);
  const findings = semanticReviewFindings(response, input);
  assert.equal(findings.issues.length, 1);
  assert.equal(findings.issues[0].pageId, 'p1');
  assert.match(findings.issues[0].problem, /原因.*有关.*因果/u);
  assert.doesNotMatch(response.claimAudit.unreferencedLocations.map(item => item.locationId).join(','), new RegExp(labelLocation.id));
  assert.match(SEMANTIC_REVIEW_CONTRACT, /标题、组标题、条目标签不得仅因其呈现类型而直接归为 non-claim/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /visibleEvidence 必须同时引用该标题\/标签和正文位置/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /sourceEvidence 必须引用能实际支撑该完整命题的原稿内容/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不能证明其下的数值排序或概括结论/u);
});

test('引用真实性与 ruling 派生阻塞/uncertain 备注', () => {
  const source = '每份申请都必须在30日内完成复核。延迟会导致权限无法开放。';
  const visible = '申请须30日内完成复核；延迟致权限无法开放。';
  const p = plan([block('b1', visible)]);
  const input = semanticReviewInput({ source, sourceSegments: [{ id: 's1', text: source }], area: { width: 1170, height: 492 }, plan: p });
  const bodyLocation = input.auditLocations.find(location => location.field === 'body');
  const claim = {
    id: 'c1',
    sourceEvidence: [{ sourceId: 's1', quote: '每份申请都必须在30日内完成复核。' }],
    visibleEvidence: [{ locationId: bodyLocation.id, quote: '申请须30日内完成复核' }],
    ruling: 'weakened',
    rationale: '上屏省略了原稿的明确义务。',
  };
  const response = { notes: [], claimAudit: canonicalAudit(input, [claim, {
    id: 'c2',
    sourceEvidence: [{ sourceId: 's1', quote: '延迟会导致权限无法开放。' }],
    visibleEvidence: [{ locationId: bodyLocation.id, quote: '延迟致权限无法开放' }],
    ruling: 'equivalent', rationale: '因果关系与来源一致。',
  }]), organization: { verdict: 'pass', findings: [] } };
  assert.equal(validateSemanticReviewEvidence(input, response).valid, true);
  const derived = semanticReviewFindings(response, input);
  assert.equal(derived.issues.length, 1);
  assert.equal(derived.issues[0].pageId, 'p1');
  assert.deepEqual(derived.issues[0].sourceIds, ['s1']);
  assert.deepEqual(derived.issues[0].claimIds, ['c1']);

  const unsupported = structuredClone(response);
  unsupported.claimAudit.claims[0].sourceEvidence = [];
  unsupported.claimAudit.claims[0].ruling = 'unsupported';
  assert.equal(validateSemanticReviewEvidence(input, unsupported).valid, true);
  assert.match(semanticReviewFindings(unsupported, input).issues[0].requiredRevision, /删除无来源支持/u);

  const badSource = structuredClone(response);
  badSource.claimAudit.claims[0].sourceEvidence[0].quote = '不存在的来源引文';
  assert.equal(validateSemanticReviewEvidence(input, badSource).valid, false);
  const badPosition = structuredClone(response);
  badPosition.claimAudit.claims[0].visibleEvidence[0].quote = '不存在的上屏引文';
  assert.equal(validateSemanticReviewEvidence(input, badPosition).valid, false);
  const badLocationText = structuredClone(input);
  badLocationText.auditLocations.find(location => location.id === bodyLocation.id).text = '替换过的审稿文本';
  assert.equal(validateSemanticReviewEvidence(badLocationText, response).valid, false);

  const uncertain = structuredClone(response);
  uncertain.claimAudit.claims[0].ruling = 'uncertain';
  uncertain.claimAudit.claims[0].rationale = '当前文字不足以确认义务强度是否改变。';
  const uncertainValidation = validateSemanticReviewEvidence(input, uncertain);
  const uncertainFindings = semanticReviewFindings(uncertain, input);
  assert.equal(uncertainValidation.valid, true, JSON.stringify(uncertainValidation.errors));
  assert.deepEqual(uncertainFindings.issues, []);
  assert.match(uncertainFindings.notes[0], /c1：未证实/u);

  const omitted = structuredClone(response);
  omitted.claimAudit.claims[0].ruling = 'omitted';
  omitted.claimAudit.claims[0].visibleEvidence = [];
  const omittedValidation = validateSemanticReviewEvidence(input, omitted);
  assert.equal(omittedValidation.valid, true, JSON.stringify(omittedValidation.errors));
  assert.equal(semanticReviewFindings(omitted, input).issues[0].pageId, undefined);
});

test('未引用来源与上屏位置必须逐项说明；unreviewed 或空命题审计不能通过', () => {
  const source = '来源段一。来源段二。';
  const p = plan([block('b1', '实际上屏命题。')]);
  const input = semanticReviewInput({
    source,
    sourceSegments: [{ id: 's1', text: '来源段一。' }, { id: 's2', text: '来源段二。' }],
    area: { width: 1170, height: 492 },
    plan: p,
  });
  const bodyLocation = input.auditLocations.find(location => location.field === 'body');
  const claim = {
    id: 'c1', sourceEvidence: [{ sourceId: 's1', quote: '来源段一。' }],
    visibleEvidence: [{ locationId: bodyLocation.id, quote: '实际上屏命题。' }],
    ruling: 'equivalent', rationale: '来源与上屏命题等价。',
  };
  const response = { notes: [], claimAudit: canonicalAudit(input, [claim]), organization: { verdict: 'pass', findings: [] } };
  assert.equal(response.claimAudit.unreferencedSources[0].sourceId, 's2');
  assert.ok(response.claimAudit.unreferencedLocations.some(item => item.locationId !== bodyLocation.id));
  assert.equal(validateSemanticReviewEvidence(input, response).valid, true);

  const missingDisposition = structuredClone(response);
  missingDisposition.claimAudit.unreferencedSources = [];
  assert.equal(validateSemanticReviewEvidence(input, missingDisposition).valid, false);
  const unreviewed = structuredClone(response);
  unreviewed.claimAudit.unreferencedSources[0].disposition = 'unreviewed';
  assert.equal(validateSemanticReviewEvidence(input, unreviewed).valid, false);

  const empty = structuredClone(response);
  empty.claimAudit.claims = [];
  empty.claimAudit.unreferencedSources = input.sourceSegments.map(item => ({
    sourceId: item.id, disposition: 'non-claim', reason: '无需审查',
  }));
  empty.claimAudit.unreferencedLocations = input.auditLocations.map(item => ({
    locationId: item.id, disposition: 'non-claim', reason: '无需审查',
  }));
  assert.equal(validateSemanticReviewEvidence(input, empty).valid, false);
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
