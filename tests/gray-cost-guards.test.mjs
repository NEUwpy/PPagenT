import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptFingerprint, isStalledRetry, categoryCues, samePageCues, splitGate, SEMANTIC_REVIEW_CONTRACT } from '../src/runner/gray-semantics.mjs';
import { resolveGrayLayout, compressionMemory } from '../src/runner/gray-layout.mjs';
import { grayBodyLayout, fitGrayText } from '../src/runner/gray-draft.mjs';

const metrics = { measureBody: grayBodyLayout, fitText: fitGrayText };
const area = (height = 560) => ({ width: 1170, height });

// 夹具取自一页双栏实测样本（默认权重 [2,3] 最小 604，[2,5] 最小 545）：
// 用于验证方案 A 项 3 的测量式权重回退，不把任何稿件特例写进实现。
const fixture = () => ({
  schemaVersion: 'gray-plan-3',
  deckBrief: { title: '不足与感悟', audience: '管理层', objective: '双栏容量夹具' },
  pages: [{
    pageId: 'p1', title: '不足与感悟', claim: '两类并列', pagePurpose: '验证双栏容量', narrative: '两类并排',
    groups: [
      {
        id: 'g1', role: '类别', heading: '两点不足', importance: 'primary', kind: 'text', blocks: [
          { id: 'b1', label: '势能到动能阻力重重', text: '顶层设计完成后，变革落地成为关键。当前内部变革氛围尚未完全形成、信息系统支撑能力仍有差距、缺乏市场化管理机制，落地阻力重重。', sourceIds: ['s2'] },
          { id: 'b2', label: '合规管理短板亟待提升', text: '2017年巡视整改虽有成效，但暴露出人力条线基础管理薄弱，条线内部认识、作风、能力、协同均有待提升。', sourceIds: ['s2'] },
        ],
      },
      {
        id: 'g2', role: '类别', heading: '四点感悟', importance: 'primary', kind: 'text', blocks: [
          { id: 'b3', label: '统一语言才能合拍共鸣', text: '解决人力资源与业务两张皮，须沿用BLM管理模型，与业务单位统一语言、统一目标、统一策略，打通从业务战略到人力资源战略的端到端落地解决方案，达成「三个市场化」转型目标。', sourceIds: ['s3'] },
          { id: 'b4', label: '解决问题才是检验变革的唯一标准', text: '变革是否有成效，以能否解决实际问题为唯一检验标准，力求落地有实效。', sourceIds: ['s3'] },
          { id: 'b5', label: '顶层设计没有完结篇', text: '在加速试点、小步快跑基础上，加强与行业优秀实践对标，结合落地成效持续迭代优化，完善体系建设。', sourceIds: ['s3'] },
          { id: 'b6', label: '统筹兼顾才能弹好钢琴', text: '强化「变革是硬道理、合规是硬要求、作风是硬标准」的管理意识，以规范管理的效率强化变革转型的力度，以优良作风跑出变革转型的加速度。', sourceIds: ['s3'] },
        ],
      },
    ],
  }],
});

const rowSelect = weights => ({ pages: [{ pageId: 'p1', layout: { type: 'row', weights } }] });

test('同版重试：指纹对文案与版式敏感；容量失败后的同指纹重试被拒绝', () => {
  const base = attemptFingerprint(fixture(), rowSelect([2, 3]));
  assert.equal(attemptFingerprint(fixture(), rowSelect([2, 3])), base);
  const changedText = fixture();
  changedText.pages[0].groups[0].blocks[0].text = '顶层设计完成后，落地阻力重重。';
  assert.notEqual(attemptFingerprint(changedText, rowSelect([2, 3])), base);
  const changedLayout = attemptFingerprint(fixture(), rowSelect([2, 5]));
  assert.notEqual(changedLayout, base);
  const failedGeometry = [{ render: 1, accepted: false, stage: 'geometry', fingerprint: base }];
  assert.equal(isStalledRetry(failedGeometry, base), true);
  assert.equal(isStalledRetry(failedGeometry, changedLayout), false);
  assert.equal(isStalledRetry([{ render: 1, accepted: true, stage: 'geometry', fingerprint: base }], base), false);
  assert.equal(isStalledRetry([], base), false);
});

test('压缩记忆：附上一版实测高、目标差值与缩减量', () => {
  const first = compressionMemory({ currentMinimum: 634, areaHeight: 492 });
  assert.equal(first.previousMinimum, null);
  assert.equal(first.targetDelta, 142);
  assert.match(first.note, /本版实测最小高 634px，距目标还差 142px/u);
  const second = compressionMemory({ currentMinimum: 604, areaHeight: 492, previousMinimum: 634 });
  assert.equal(second.previousMinimum, 634);
  assert.equal(second.targetDelta, 112);
  assert.equal(second.previousTargetDelta, 142);
  assert.equal(second.delta, -30);
  assert.match(second.note, /上一版实测 634px，本版 604px，较上版 -30px；距目标还差 112px/u);
});

test('双栏权重回退：默认权重放不下时按测量改选分栏（回执标注 reweighted）', () => {
  const result = resolveGrayLayout(fixture(), rowSelect([2, 3]), area(560), metrics);
  const receipt = result.receipts[0];
  assert.deepEqual(receipt.reweighted, { from: [2, 3], to: [2, 5] });
  assert.deepEqual(receipt.layout.weights, [2, 5]);
  const regions = result.plan.pages[0].composition.regions;
  assert.ok(regions.every(region => region.height <= 560), JSON.stringify(regions));
});

test('双栏权重回退有边界：没有任何候选能容纳时仍如实报容量失败', () => {
  assert.throws(() => resolveGrayLayout(fixture(), rowSelect([2, 3]), area(520), metrics), /一页放不下/u);
});

test('权重回退只作用于双栏 row 根：其他组合失败行为不变', () => {
  assert.throws(() => resolveGrayLayout(fixture(), { pages: [{ pageId: 'p1', layout: { type: 'column' } }] }, area(200), metrics), /一页放不下/u);
});

const cueSources = [
  { id: 's1', text: '首先是两点不足。一是势能到动能阻力重重。二是合规管理短板亟待提升。' },
  { id: 's2', text: '其次是四点感悟。一是统一语言才能合拍共鸣。二是解决问题才是检验变革的唯一标准。' },
];
const mergedPlan = () => ({ pages: [{ pageId: 'p1', groups: [{ heading: '不足：落地阻力与合规短板' }, { heading: '感悟：四条推进准则' }] }] });
const splitPlan = () => ({ pages: [{ pageId: 'p1', groups: [{ heading: '不足：落地阻力与合规短板' }] }, { pageId: 'p2', groups: [{ heading: '感悟：四条推进准则' }] }] });

test('分页闸门：同页双容器目标下，两轮真压缩前拒绝分页计划', () => {
  const cues = categoryCues(cueSources);
  assert.equal(cues.length, 2);
  assert.equal(samePageCues(cues, mergedPlan()), true);
  assert.equal(samePageCues(cues, splitPlan()), false);
  assert.equal(splitGate({ cues, plan: mergedPlan(), minimums: [] }).blocked, false);
  assert.equal(splitGate({ cues, plan: splitPlan(), minimums: [] }).blocked, false); // 尚未发生同页容量失败：不引入新死锁
  assert.equal(splitGate({ cues, plan: splitPlan(), minimums: [664] }).blocked, true);
  assert.equal(splitGate({ cues, plan: splitPlan(), minimums: [664, 634] }).blocked, true);
  assert.deepEqual(splitGate({ cues, plan: splitPlan(), minimums: [664, 634, 600] }), { blocked: false, rounds: 2 });
  const singleCue = categoryCues([cueSources[0]]);
  assert.equal(splitGate({ cues: singleCue, plan: splitPlan(), minimums: [] }).blocked, false);
});

test('审稿窄条款在契约中：同页并列类别不得要求配对/对应表', () => {
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不得要求一一配对卡片或对应表/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /必须有原稿明示依据/u);
});

test('同页双容器字号降档：18–20px 候选中按测量选择，492 内可容纳；未标形态仍 22px 失败', () => {
  assert.throws(() => resolveGrayLayout(fixture(), rowSelect([2, 3]), area(492), metrics), /一页放不下/u);
  const result = resolveGrayLayout(fixture(), rowSelect([2, 3]), area(492), { ...metrics, fontSizes: () => [20, 18] });
  const receipt = result.receipts[0];
  assert.ok(receipt.formPick, '应记录 formPick 选择依据');
  assert.ok([18, 20].includes(receipt.fontSize), `fontSize=${receipt.fontSize}`);
  assert.ok(receipt.formPick.maxHeight <= 492, JSON.stringify(receipt.formPick));
  const [wa, wb] = receipt.formPick.weights;
  const share = wa / (wa + wb);
  assert.ok(share >= 0.30 && share <= 0.65, `单栏占比应在参照带内：${share}`);
  const regions = result.plan.pages[0].composition.regions;
  assert.ok(regions.every(region => region.fontSize === receipt.fontSize));
  assert.ok(regions.every(region => region.height <= 492), JSON.stringify(regions));
});
