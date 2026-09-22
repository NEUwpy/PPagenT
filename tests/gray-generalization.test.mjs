import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_RULES, SEMANTIC_CONTRACT, SEMANTIC_REVIEW_CONTRACT, validateSemanticPlan } from '../src/runner/gray-semantics.mjs';
import { GRAY_AGENT_PROMPT } from '../src/runner/gray-agent.mjs';
import { newRunState } from '../src/runner/state.mjs';
import { resolveGrayLayout } from '../src/runner/gray-layout.mjs';
import { grayBodyLayout, fitGrayText } from '../src/runner/gray-draft.mjs';

const prose = '设备尚未到位，人员尚未到岗，材料尚未验收，造成试验无法启动。';
const makeGroup = (id, heading, text, sourceId) => ({
  id, heading, role: '说明', importance: 'primary', kind: 'text',
  blocks: [{ id: `${id}-text`, label: '执行条件', text, sourceIds: [sourceId] }],
});
const makePage = (pageId, groups) => ({ pageId, title: '试验安排', claim: '先确认条件再启动', pagePurpose: '说明试验安排', narrative: '保留各事项的归属和条件', groups });
function fixture({ cued = true, split = false, third = false } = {}) {
  const base = newRunState('测试', 'fixture');
  base.sources = [
    { id: 's1', text: `${cued ? '首先是两项风险。' : '风险如下。'}${prose}` },
    { id: 's2', text: `${cued ? '其次是两项安排。' : '安排如下。'}到货后验收；验收通过后试运行。` },
    ...(third ? [{ id: 's3', text: '最后是两项保障。安排值守，并记录异常。' }] : []),
  ];
  const groups = base.sources.map((source, i) => makeGroup(`g${i + 1}`, ['风险', '安排', '保障'][i], source.text, source.id));
  const plan = { schemaVersion: 'gray-plan-3', deckBrief: { title: '试验', audience: '现场人员', objective: '说明条件' },
    pages: split ? groups.map((group, i) => makePage(`p${i + 1}`, [group])) : [makePage('p1', groups)] };
  return { base, plan };
}

test('关系相同：换措辞、增加类别或分页，不凭连接词强制图形位', () => {
  for (const options of [{}, { cued: false }, { third: true }, { split: true }]) {
    const { base, plan } = fixture(options);
    const report = validateSemanticPlan(base, plan);
    assert.equal(report.accepted, true, JSON.stringify(report.issues));
  }
});

test('已选局部结构位：单类、双类、多类和跨页共用所属条目摘引检查', () => {
  for (const options of [{}, { third: true }, { split: true }]) {
    const { base, plan } = fixture(options);
    const group = plan.pages[0].groups[0];
    group.blocks.push({ id: 'note', kind: 'diagram', text: '设备尚未到位／人员尚未到岗／材料尚未验收→试验无法启动',
      expression: '画出启动条件与结果', relationship: '汇聚', production: '条件汇聚到无法启动', sourceIds: ['s1'] });
    assert.equal(validateSemanticPlan(base, plan).accepted, true);
    // 允许压缩提炼：节点可省修饰字，但须与所属条目实文顺序对应（评审 #128）
    group.blocks[1].text = '设备未到位／人员未到岗／材料未验收→试验无法启动';
    assert.equal(validateSemanticPlan(base, plan).accepted, true, JSON.stringify(validateSemanticPlan(base, plan).issues));
    group.blocks[1].text = '设备尚未到位／人员尚未到岗／材料尚未验收→试验无法启动';
    group.blocks[1].text = '设备已经到位／人员尚未到岗';
    assert.ok(validateSemanticPlan(base, plan).issues.some(issue => issue.code === 'structure-quote-mismatch'));
  }
});

test('节点分隔符与证据范围：｜ 分隔与来源内节点通过，条目实文压缩不构成失配', () => {
  const { base, plan } = fixture();
  const group = plan.pages[0].groups[0];
  group.blocks.push({ id: 'note', kind: 'diagram', text: '设备尚未到位｜人员尚未到岗｜材料尚未验收→试验无法启动',
    expression: '条件图', relationship: '汇聚', production: '汇聚图', sourceIds: ['s1'] });
  assert.equal(validateSemanticPlan(base, plan).accepted, true, JSON.stringify(validateSemanticPlan(base, plan).issues));
  // 条目实文压缩后，节点仍可由该块所引来源支撑（任务 #169-G03：证据范围与承诺一致）
  group.blocks.find(block => block.id === 'g1-text').text = '风险见来源。';
  assert.equal(validateSemanticPlan(base, plan).accepted, true, JSON.stringify(validateSemanticPlan(base, plan).issues));
});

test('节点短语超出所属条目与所引来源时仍被拒绝（来源内节点按声明来源放行）', () => {
  const { base, plan } = fixture();
  const group = plan.pages[0].groups[0];
  group.blocks.push({ id: 'note', kind: 'diagram', text: '设备已经到位／人员尚未到岗',
    expression: '条件图', relationship: '并列', production: '并列条件', sourceIds: ['s1'] });
  assert.ok(validateSemanticPlan(base, plan).issues.some(issue => issue.code === 'structure-quote-mismatch'));
});

test('归属、否定和来源保真底线继续存在，伪造来源仍被拒绝', () => {
  const { base, plan } = fixture({ split: true });
  plan.pages[0].groups[0].blocks[0].sourceIds = ['不存在的来源'];
  assert.equal(validateSemanticPlan(base, plan).accepted, false);
  assert.match(SHARED_RULES.category, /保留重要事实、对象、条件、否定和关系/u);
});

test('统一测量对单主体、横向、纵向、网格及嵌套页均可用，组合和正文不被改写', () => {
  for (const type of ['single', 'row', 'column', 'grid', 'nested']) {
    const { plan } = fixture({ cued: false });
    if (type === 'single') plan.pages[0].groups.splice(1);
    const layout = type === 'nested' ? { type: 'column', children: [{ type: 'row', children: [{ groupId: 'g1' }] }, { groupId: 'g2' }] } : { type };
    const before = structuredClone(plan);
    const result = resolveGrayLayout(plan, { pages: [{ pageId: 'p1', layout }] }, { width: 1170, height: 492 }, {
      measureBody: grayBodyLayout, fitText: fitGrayText, fontSizes: () => [22, 20, 18, 16, 12],
    });
    assert.deepEqual(plan, before);
    assert.equal(result.receipts[0].layout.type, layout.type);
    for (const region of result.plan.pages[0].composition.regions) {
      assert.ok(region.fontSize >= 12 && region.fontSize <= 22);
      assert.ok(region.y + region.height <= 492);
    }
  }
});

test('固定几何、只替换类别名称时，字号和区域结果保持相同', () => {
  const first = fixture().plan;
  const second = structuredClone(first);
  second.pages[0].groups[0].heading = '条件';
  second.pages[0].groups[1].heading = '措施';
  const solve = plan => resolveGrayLayout(plan, { pages: [{ pageId: 'p1', layout: { type: 'row' } }] }, { width: 1170, height: 492 }, {
    measureBody: grayBodyLayout, fitText: fitGrayText, fontSizes: () => [22, 20, 18, 16, 12],
  }).plan.pages[0].composition.regions;
  assert.deepEqual(solve(first), solve(second));
});

test('通用生成与审稿入口不包含样稿答案，审稿承认局部蓝框阶段', () => {
  for (const text of [GRAY_AGENT_PROMPT, SEMANTIC_REVIEW_CONTRACT]) {
    assert.doesNotMatch(text, /范本|不足与感悟|统一语言、统一目标、统一策略|同页双容器|两轮压缩/u);
  }
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不要求已经画出内部节点和箭头/u);
});

test('带时间锚点的序列＋当前观察分支：通用判定进生成与审稿契约且不含样本词（任务 #216）', () => {
  // 抽象 fixture：一段有时代锚点的演进序列 ＋ 一条“现在/新方向/越来越多”的当下观察分支。
  const fixture = '早期阶段（某年代）…；中期阶段（某年代）…；现在有一个新方向值得关注，应用正在增加。';
  assert.match(fixture, /新方向/u);
  const fragment = SHARED_RULES.timeline;
  assert.ok(fragment.length >= 20, 'timeline 片段过短');
  assert.match(fragment, /历史\/演进序列/u);
  assert.match(fragment, /当下分支/u);
  assert.match(fragment, /不因数量或顺序把它并为历史节点/u);
  assert.match(fragment, /程度与作用范围/u);
  assert.match(fragment, /flow 只承载真实先后序列/u);
  assert.ok(GRAY_AGENT_PROMPT.includes(fragment), 'GRAY_AGENT_PROMPT 缺少 timeline 片段');
  assert.ok(SEMANTIC_CONTRACT.includes(fragment), 'SEMANTIC_CONTRACT 缺少 timeline 片段');
  assert.match(SEMANTIC_REVIEW_CONTRACT, /把当下分支读成历史阶段/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /把趋势弱化成静态事实/u);
  // 通用规则不得写死任何样稿词句。
  for (const sample of ['搅拌摩擦焊', '焊接', '铝合金', '新能源汽车', '锻焊', '垃圾', '厨余', '备件']) {
    assert.doesNotMatch(fragment, new RegExp(sample, 'u'), `timeline 片段不应包含样本词：${sample}`);
  }
});
