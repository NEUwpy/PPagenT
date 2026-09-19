import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { attemptFingerprint, isStalledRetry, categoryCues, samePageCues, splitGate, SEMANTIC_REVIEW_CONTRACT, regionBody, grayDisplayBlocks, planTextVolume, isSameMinimumRetry, validateSemanticPlan } from '../src/runner/gray-semantics.mjs';
import { resolveGrayLayout, compressionMemory } from '../src/runner/gray-layout.mjs';
import { grayBodyLayout, fitGrayText, structurePlaceholderHeight } from '../src/runner/gray-draft.mjs';
import { newRunState } from '../src/runner/state.mjs';

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
  assert.equal(splitGate({ cues, plan: splitPlan(), minimums: [] }).blocked, true); // 直接分页也被拦：先按同页并排规划
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

test('结构位口径在审稿契约中：汇聚/扇出用 diagram、节点短语摘引一致', () => {
  assert.match(SEMANTIC_REVIEW_CONTRACT, /并列汇聚\/扇出用 diagram/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /节点短语须能在该条目散文中逐字找到/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /flow 只用于原文有先后线索的真实时序/u);
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

test('附注最小化：关系一句＋摘引短语，与 rules/排版.md 同步', async () => {
  const block = { id: 'b1', label: '势能到动能阻力重重', text: '变革氛围尚未完全形成／信息系统支撑能力仍有差距／缺乏市场化管理机制', kind: 'diagram', expression: '三因并列、箭头汇聚指向结果框「变革落地阻力重重」', relationship: '汇聚：三项原因共同造成落地阻力', production: '三框一果箭头图', sourceIds: ['s1'] };
  assert.equal(regionBody(block), '本条建议画结构图：三因并列、箭头汇聚指向结果框「变革落地阻力重重」；节点短语（摘引）：变革氛围尚未完全形成／信息系统支撑能力仍有差距／缺乏市场化管理机制。');
  assert.doesNotMatch(regionBody(block), /作:|承:|关:|制:/u);
  const rules = await fs.readFile(new URL('../rules/排版.md', import.meta.url), 'utf8');
  assert.match(rules, /定案图形区以蓝框框出、面积＝图真实占位/u);
});

test('条目编号标签：按带标签条目顺序、附注不占号；单条目组不编号', () => {
  const group = { id: 'g1', kind: 'text', heading: '两点不足', blocks: [
    { id: 'b1', label: '第一条', text: '甲。' },
    { id: 'b2', text: '无标签条目。' },
    { id: 'b3', label: '第三条', text: '丙。' },
  ] };
  assert.deepEqual(grayDisplayBlocks(group).filter(run => run.bold).map(run => run.text), ['一 第一条', '二 第三条']);
  const withNote = { id: 'g2', kind: 'text', heading: '两点不足', blocks: [
    { id: 'b1', label: '势能', text: '甲。' },
    { id: 'bn', label: '阻力来源结构图', text: '本条先画结构图', kind: 'diagram', expression: '汇聚', relationship: '三因一果', production: '三框一果' },
    { id: 'b2', label: '合规', text: '乙。' },
    { id: 'bn2', label: '短板反映结构图', text: '本条先画结构图', kind: 'diagram', expression: '扇出', relationship: '一源四项', production: '一排四框' },
  ] };
  assert.deepEqual(grayDisplayBlocks(withNote).filter(run => run.bold).map(run => run.text), ['一 势能', '阻力来源结构图', '二 合规', '短板反映结构图']);
  const single = { id: 'g3', kind: 'text', blocks: [{ id: 'b1', label: '唯一条目', text: '甲。' }] };
  assert.deepEqual(grayDisplayBlocks(single).filter(run => run.bold).map(run => run.text), ['唯一条目']);
});

test('蓝注解耦：块级附注独立 12px 小字，与主文字号互不锁死', () => {
  const group = { id: 'g1', kind: 'text', heading: '两点不足', blocks: [
    { id: 'b1', label: '势能到动能阻力重重', text: '完成顶层设计后，变革落地就是关键。现阶段变革氛围尚未完全形成。' },
    { id: 'bn', text: '变革氛围尚未完全形成／信息系统支撑能力存在差距／缺乏市场化机制', kind: 'diagram', expression: '三因汇聚到结果', relationship: '三项原因共同造成落地阻力', production: '三框一果箭头图' },
  ] };
  const body = grayBodyLayout(group, 426, 18);
  const noteRuns = body.runs.filter(run => run.kind === 'diagram');
  const textRuns = body.runs.filter(run => !run.kind);
  assert.equal(noteRuns.length, 1);
  assert.equal(noteRuns[0].fontSize, 12);
  assert.ok(textRuns.every(run => run.fontSize === 18));
});

test('结构位真占位：占位高按类型与节点数（范本校准），与描述文字长度无关', () => {
  assert.equal(structurePlaceholderHeight('diagram', 3), 80);
  assert.equal(structurePlaceholderHeight('diagram', 4), 140);
  assert.equal(structurePlaceholderHeight('diagram', 7), 200);
  assert.equal(structurePlaceholderHeight('flow', 4), 80);
  const group = { id: 'g1', kind: 'text', heading: '两点不足', blocks: [
    { id: 'b1', label: '势能到动能阻力重重', text: '完成顶层设计后，变革落地就是关键。现阶段变革氛围尚未完全形成，造成落地阻力重重。' },
    { id: 'bn', text: '变革氛围尚未完全形成／信息系统支撑能力存在差距／缺乏市场化机制／变革落地阻力重重', kind: 'diagram', expression: '三因汇聚', relationship: '三因一果', production: '三框一果' },
  ] };
  const body = grayBodyLayout(group, 426, 18);
  const placeholder = body.sections.find(section => section.placeholder);
  assert.equal(placeholder.noteArea.height, structurePlaceholderHeight('diagram', 4));
  assert.equal(body.sections.filter(section => section.placeholder).length, 1); // 占位并入条目，不单列
  // 描述很长、占位较矮（flow）时降为一句
  group.blocks[1].kind = 'flow';
  group.blocks[1].expression = '把三项内部成因汇聚到同一后果的因果关系画出来，供读者直读阻力来源。'.repeat(3);
  const brief = grayBodyLayout(group, 426, 18);
  assert.ok(brief.runs.some(run => run.kind === 'flow' && run.text === '本条先画结构图'), JSON.stringify(brief.runs));
});

test('同最小高重试：实测高未降且文本未缩短才拒绝；缩短或降高均放行', () => {
  assert.equal(isSameMinimumRetry({ previousMinimum: 503, currentMinimum: 503, previousTextLength: 800, currentTextLength: 800 }), true);
  assert.equal(isSameMinimumRetry({ previousMinimum: 503, currentMinimum: 504, previousTextLength: 800, currentTextLength: 810 }), true);
  assert.equal(isSameMinimumRetry({ previousMinimum: 503, currentMinimum: 503, previousTextLength: 800, currentTextLength: 760 }), false);
  assert.equal(isSameMinimumRetry({ previousMinimum: 503, currentMinimum: 490, previousTextLength: 800, currentTextLength: 800 }), false);
  assert.equal(isSameMinimumRetry({ previousMinimum: undefined, currentMinimum: 503, previousTextLength: undefined, currentTextLength: 800 }), false);
});

test('计划文本量：计入标题、标签、正文与结构位字段', () => {
  const plan = { pages: [{ groups: [{ heading: '不足', blocks: [
    { id: 'b1', label: '势能', text: '正文' },
    { id: 'b2', text: '说明', kind: 'flow', expression: '作用', relationship: '关系', production: '要求' },
  ] }] }] };
  assert.equal(planTextVolume(plan), '不足'.length + '势能'.length + '正文'.length + '说明'.length + '作用'.length + '关系'.length + '要求'.length);
});

test('结构位缺失检查：同页双容器下明示汇聚/扇出必须有结构位块', () => {
  const base = newRunState('占位', 'fixture');
  base.sources = [
    { id: 's1', text: '首先是两点不足。一是势能到动能阻力重重。现阶段公司内部人力资源变革氛围尚未完全形成，信息系统支撑能力仍存在差距，缺乏市场化的管理机制，造成变革落地阻力重重。' },
    { id: 's2', text: '其次是四点感悟。一是统一语言才能合拍共鸣。二是解决问题才是检验变革的唯一标准。' },
  ];
  const page = () => ({
    pageId: 'p1', title: '不足与感悟', claim: '两类并列', pagePurpose: '验证结构位检查', narrative: '两类并排',
    groups: [
      { id: 'g1', role: '类别', heading: '不足：阻力与短板', importance: 'primary', kind: 'text', blocks: [
        { id: 'b1', label: '势能到动能阻力重重', text: '现阶段公司内部人力资源变革氛围尚未完全形成，信息系统支撑能力仍存在差距，缺乏市场化的管理机制，造成变革落地阻力重重。', sourceIds: ['s1'] },
      ] },
      { id: 'g2', role: '类别', heading: '感悟：方法与标准', importance: 'primary', kind: 'text', blocks: [
        { id: 'b2', label: '统一语言才能合拍共鸣', text: '统一语言才能合拍共鸣', sourceIds: ['s2'] },
      ] },
    ],
  });
  const plan = () => ({ schemaVersion: 'gray-plan-3', deckBrief: { title: '不足与感悟', audience: '管理层', objective: '验证' }, pages: [page()] });
  const missing = validateSemanticPlan(base, plan());
  assert.ok(missing.issues.some(issue => issue.code === 'structure-note-missing'), JSON.stringify(missing.issues));
  const withNote = plan();
  withNote.pages[0].groups[0].blocks.push({ id: 'b1n', text: '变革氛围尚未完全形成／信息系统支撑能力仍存在差距／缺乏市场化的管理机制', kind: 'diagram', expression: '三个阻力原因汇聚到结果', relationship: '汇聚：三因共同造成落地阻力', production: '三框一果箭头图', sourceIds: ['s1'] });
  const accepted = validateSemanticPlan(base, withNote);
  assert.equal(accepted.accepted, true, JSON.stringify(accepted.issues));
  const collapsed = plan();
  collapsed.pages[0].groups[0].blocks = [{ id: 'b1', text: '现阶段公司内部人力资源变革氛围尚未完全形成，信息系统支撑能力仍存在差距，缺乏市场化的管理机制，造成变革落地阻力重重。', kind: 'diagram', expression: '汇聚', relationship: '三因一果', production: '三框一果箭头图', sourceIds: ['s1'] }];
  assert.ok(validateSemanticPlan(base, collapsed).issues.some(issue => issue.code === 'structure-collapsed'));
  // 摘引一致（评审 #33）：节点短语丢限定词（完全）→ 拒
  const looseQuote = plan();
  looseQuote.pages[0].groups[0].blocks.push({ id: 'b1n', text: '变革氛围尚未形成／信息系统支撑能力仍存在差距', kind: 'diagram', expression: '汇聚', relationship: '三因一果', production: '三框一果箭头图', sourceIds: ['s1'] });
  assert.ok(validateSemanticPlan(base, looseQuote).issues.some(issue => issue.code === 'structure-quote-mismatch'));
  // 节点短语缺「／」分隔（评审 #77 收紧）→ 拒
  const noSeparator = plan();
  noSeparator.pages[0].groups[0].blocks.push({ id: 'b1n', text: '变革氛围尚未完全形成，信息系统支撑能力仍存在差距，缺乏市场化的管理机制', kind: 'diagram', expression: '汇聚', relationship: '三因一果', production: '三框一果箭头图', sourceIds: ['s1'] });
  assert.ok(validateSemanticPlan(base, noSeparator).issues.some(issue => issue.code === 'structure-quote-mismatch'));
  // 收尾标点去重（评审 #33）：连续重复闭标点 → 拒
  const dupPunct = plan();
  dupPunct.pages[0].groups[0].blocks[0].text = '现阶段公司内部人力资源变革氛围尚未完全形成，造成变革落地阻力重重。。';
  assert.ok(validateSemanticPlan(base, dupPunct).issues.some(issue => issue.code === 'duplicate-punctuation'));
});

test('条件降档：16px 下限候选在 18px 放不下时被选用（仅同页形态）', () => {
  const result = resolveGrayLayout(fixture(), rowSelect([2, 3]), area(440), { ...metrics, fontSizes: () => [20, 18, 16] });
  assert.equal(result.receipts[0].fontSize, 16);
  const regions = result.plan.pages[0].composition.regions;
  assert.ok(regions.every(region => region.height <= 440), JSON.stringify(regions));
});

test('条件降档：15px 下限档（用户拍板 D′）在更紧时被选用', () => {
  const result = resolveGrayLayout(fixture(), rowSelect([2, 3]), area(390), { ...metrics, fontSizes: () => [20, 18, 16, 15] });
  assert.equal(result.receipts[0].fontSize, 15);
  const regions = result.plan.pages[0].composition.regions;
  assert.ok(regions.every(region => region.height <= 390), JSON.stringify(regions));
});
