import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/PPagenT';
const RUN = path.join(ROOT, 'experiments/university-skin-pilot/aesthetic-ab-01/composition-product-b/round-02');
const INPUT = path.join(ROOT, 'experiments/university-skin-pilot/aesthetic-ab-01/inputs');
const SOURCE = path.join(INPUT, 'product.txt');
const W = 1280;
const H = 720;
const FONT = 'Microsoft YaHei';
const C = {
  blue: '#315F91', ink: '#252B33', muted: '#707780', bg: '#FFFFFF',
  lightBlue: '#EEF4FA', paleBlue: '#F5F8FB', line: '#CBD3DC',
  paleGray: '#F4F5F6', darkBlue: '#244A72', white: '#FFFFFF'
};
const roles = [];
const linePaths = [];
const connections = [];
const nodePairs = [];
const reasoning = [
  'P1 封面：以产品问题和目标形成最小开场，标题承担核心判断，副句说明读者将理解的道路。',
  'P2：把“画”与真正昂贵的拆页、关系判断、表达选择和统一判断并置，形成问题定义；删去重复页底结论。',
  'P3：完整保留几乎不在意版式与高度定制两端，以及中间工作型需求；公式拆为两行并解释 Q、Q可用 与 R 的概念性质。',
  'P4：按共同维度逐行对照随机 95 分与稳定 80 分，补入增量定制成本和内部汇报无需为其付出同等代价。',
  'P5：将规范、能力、容量和退化方式按标签与解释组成自然高度分析面，删去重复页底口号。',
  'P6：分开内容导演、视觉导演与 AI/规则/代码执行链；职责文字靠近对应角色，AI→规则→代码 只连接真实可见节点。',
  'P7：保留两条路线与核心资产库唯一交汇；用户确认和选择合法能力分别作为真实可见语义节点接入箭头，删去透明锚点。',
  'P8：建设期与正式生成期采用标签+普通解释的自然高度对照，保留一次建设、多次复用和视觉模型非必要条件。',
  'P9：四项能力以共同分析行排列，正文不放入巨大浅色框，删去重复页底总结。',
  'P10：将主题与能力的标签、解释紧邻对齐，说明东北大学条件与其他组织的扩展边界。',
  'P11：收束回到普通问题和可靠产品能力，保留“不一定惊艳/独一无二/可以继续修改”的边界。'
];

function frame(left, top, width, height) { return { left, top, width, height }; }
function addText(slide, page, name, text, box, role, extra = {}) {
  const s = slide.shapes.add({
    geometry: 'textbox', name: `${page}-${name}`, position: box,
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 }
  });
  s.text = text;
  const style = {
    fontSize: { cover: 44, claim: 30, group: 21, body: 18, note: 16, footer: 12, metric: 36 }[role],
    bold: role === 'cover' || role === 'claim' || role === 'group' || role === 'metric',
    color: extra.color || (role === 'note' || role === 'footer' ? C.muted : C.ink),
    typeface: FONT,
    alignment: extra.alignment || 'left',
    verticalAlignment: extra.verticalAlignment || 'top',
    autoFit: 'none'
  };
  s.text.style = style;
  roles.push({ page, name: `${page}-${name}`, role });
  return s;
}
function rect(slide, name, box, fill, radius = null, line = null) {
  const cfg = { geometry: radius ? 'roundRect' : 'rect', name, position: box, fill, line: line || { style: 'solid', fill: 'none', width: 0 } };
  if (radius) cfg.borderRadius = radius;
  return slide.shapes.add(cfg);
}
function hline(slide, page, name, x1, y, x2, color = C.line, width = 1) {
  slide.shapes.add({ geometry: 'line', name: `${page}-${name}`, position: frame(x1, y, x2 - x1, 0), line: { style: 'solid', fill: color, width } });
  linePaths.push({ page, id: `${page}-${name}`, from: { x: x1, y }, to: { x: x2, y }, relation: '标题区与正文区分隔线', separator: true });
}
function connector(slide, page, name, source, target, reason) {
  slide.shapes.connect(source, target, {
    kind: 'straight', fromSide: 'right', toSide: 'left',
    line: { fill: C.blue, width: 2 }, tail: { type: 'arrow', width: 'sm', length: 'sm' }
  });
  connections.push({ page, id: `${page}-${name}`, source: source.name, target: target.name, arrowAt: 'target(tail)', reason });
}
function chrome(slide, page, title, kicker = '') {
  slide.background.fill = C.bg;
  if (kicker) addText(slide, page, 'kicker', kicker, frame(55, 30, 420, 30), 'note', { color: C.blue });
  addText(slide, page, 'title', title, frame(55, 66, 1170, 50), 'claim');
  hline(slide, page, 'title-rule', 55, 132, 1225);
  addText(slide, page, 'footer', `PPagenT 产品叙事  ·  ${String(page).padStart(2, '0')}`, frame(55, 682, 1170, 26), 'footer');
}
function body(slide, page, name, text, x, y, w, h, role = 'body', color) {
  return addText(slide, page, name, text, frame(x, y, w, h), role, color ? { color } : {});
}

function makeCover(p) {
  p.background.fill = C.bg;
  rect(p, 'cover-band', frame(55, 45, 8, 555), C.blue);
  addText(p, 1, 'title', '把 PPT 生成变成可靠的生产过程', frame(95, 145, 1050, 80), 'cover', { color: C.ink });
  addText(p, 1, 'sub', 'PPagenT 产品叙事', frame(98, 245, 500, 36), 'group', { color: C.blue });
  addText(p, 1, 'lead', '让 AI 帮我们读稿子，让规则帮我们做判断，让代码完成重复劳动。', frame(98, 320, 760, 74), 'body');
  rect(p, 'cover-note-bg', frame(95, 470, 830, 72), C.lightBlue);
  addText(p, 1, 'cover-note', '目标：在目标工作场景中，稳定跨过“可以直接拿去讲”的可用线。', frame(125, 487, 760, 38), 'group', { color: C.darkBlue });
  addText(p, 1, 'footer', 'PPagenT 产品叙事  ·  01', frame(55, 682, 1170, 26), 'footer');
}
function makeP2(p) {
  chrome(p, 2, '真正昂贵的不是画，而是一连串判断', '问题定义');
  body(p, 2, 'left-label', '做 PPT', 55, 184, 260, 34, 'group', C.blue);
  body(p, 2, 'left-body', '即使熟练完成答辩、汇报或讲课用的演示，仍然需要很长时间。', 55, 232, 425, 88);
  body(p, 2, 'analysis-head', '时间消耗集中在决定“怎么讲”', 525, 184, 650, 38, 'group');
  const rows = [
    ['拆页', '一篇长稿应该拆成多少页，每一页只承担什么职责'],
    ['判关系', '观点是并列、递进、因果还是流程，哪里应该突出'],
    ['选表达', '什么时候应该用图，什么时候一句话反而更有力量'],
    ['统一', '翻找旧 PPT、替换内容，再统一字体、字号、颜色和间距']
  ];
  rows.forEach((r, i) => { const y = 248 + i * 68; body(p, 2, `r${i}-l`, r[0], 525, y, 110, 34, 'group', C.blue); body(p, 2, `r${i}-b`, r[1], 655, y, 520, 46); if (i < rows.length - 1) hline(p, 2, `row${i}`, 525, y + 54, 1175); });
}
function makeP3(p) {
  chrome(p, 3, 'PPagenT 先选择概率密度最大的工作型 PPT', '需求与目标');
  body(p, 3, 'end-a-label', '一端', 55, 180, 80, 32, 'group', C.blue);
  body(p, 3, 'end-a', '几乎不在意版式，只要把文字放上去。', 145, 180, 430, 48, 'body');
  body(p, 3, 'end-b-label', '另一端', 55, 258, 100, 32, 'group', C.blue);
  body(p, 3, 'end-b', '发布会、品牌路演和高水平比赛，需要高度定制的视觉创意。', 165, 258, 410, 70, 'body');
  body(p, 3, 'middle-label', '中间', 55, 358, 80, 32, 'group', C.blue);
  body(p, 3, 'middle', '更多需求位于中间：学校、科研院所、事业单位、央国企和普通企业，需要快速得到结构清楚、视觉体面、符合组织规范的 PPT。', 145, 358, 430, 106, 'body');
  body(p, 3, 'floor-label', '底线', 55, 500, 80, 32, 'group', C.blue);
  body(p, 3, 'floor', '不能乱、不能丑、不能掉价，生成以后还要能继续修改。', 145, 500, 430, 60, 'body');
  body(p, 3, 'metric-label', '产品可靠度', 650, 180, 480, 32, 'group', C.blue);
  body(p, 3, 'metric-line-1', 'R = P(Q ≥ Q可用', 650, 232, 520, 48, 'metric', C.darkBlue);
  body(p, 3, 'metric-line-2', '      | 目标工作场景)', 650, 280, 520, 48, 'metric', C.darkBlue);
  body(p, 3, 'metric-vars', 'Q 是生成结果的综合质量；Q可用是“可以直接拿去讲”的最低标准。', 650, 362, 560, 74, 'body');
  body(p, 3, 'metric-goal', 'R 表达产品在目标工作场景中达到可用标准的概率，不是现成测量结果，也不是某一次生成的最高分。', 650, 462, 520, 96, 'body');
}
function makeP4(p) {
  chrome(p, 4, '稳定跨过可用线，比偶然惊艳更重要', '可靠度');
  body(p, 4, 'intro', '明天上午九点要汇报，晚上交给系统的工作稿，首先需要逻辑清楚、版式规范、符合单位风格，而且第二天仍然可以继续修改。', 55, 174, 1090, 62);
  body(p, 4, 'dim-head', '共同维度', 55, 275, 140, 32, 'group', C.muted);
  body(p, 4, 'left-head', '随机的 95 分', 255, 275, 400, 38, 'group', C.muted);
  body(p, 4, 'right-head', '稳定的 80 分', 780, 275, 400, 38, 'group', C.blue);
  const rows = [
    ['个性与上限', '偶尔高度定制、让人惊叹', '稳定达到工作需要的专业程度'],
    ['继续修改', '结果落点和修改基础不稳定', '第二天仍然可以继续修改'],
    ['投入回报', '增量定制成本会迅速上升', '许多内部汇报不必为这部分增量付出同等代价']
  ];
  rows.forEach((r, i) => { const y = 338 + i * 72; body(p, 4, `dim-${i}`, r[0], 55, y, 170, 40, 'group', C.blue); body(p, 4, `left-${i}`, r[1], 255, y, 430, 48, 'body'); body(p, 4, `right-${i}`, r[2], 780, y, 400, 48, 'body'); if (i < rows.length - 1) hline(p, 4, `row-${i}`, 55, y + 58, 1225); });
  body(p, 4, 'takeaway', '“80 分”是稳定可用状态的形象称呼，不是产品的质量上限。', 55, 590, 1120, 34, 'note');
}
function makeP5(p) {
  chrome(p, 5, '用限制一部分自由，换取可预测的结果', '产品选择');
  body(p, 5, 'lead', '自由度越高，理论上限越高；状态空间越大，失败模式也越多。正式工作的 PPT 更需要可预测。', 55, 174, 1080, 58);
  const items = [
    ['视觉规范', '学校或企业已有的颜色、字体、Logo、页眉页脚'],
    ['表达能力', '经过验证的并列、顺序、对比、层级、循环等结构'],
    ['容量边界', '明确数量和文字容量，超过边界就换样式或拆页'],
    ['退化方式', '没有合适结构时退回已登记的简单文字排版']
  ];
  items.forEach((it, i) => { const x = 55 + (i % 2) * 590; const y = 280 + Math.floor(i / 2) * 130; body(p, 5, `i${i}-l`, it[0], x, y, 220, 32, 'group', C.blue); body(p, 5, `i${i}-b`, it[1], x, y + 42, 500, 58, 'body'); });
}
function makeP6(p) {
  chrome(p, 6, 'AI 负责理解和路由，规则负责约束和选择，代码负责稳定生成', '控制器');
  body(p, 6, 'intro', 'AI 不直接自由绘制整份 PPT；内容导演和视觉导演先组织问题与表达，随后由确定性执行链完成生成。', 55, 170, 1120, 46);
  body(p, 6, 'directors-head', '导演分工', 55, 250, 300, 32, 'group', C.blue);
  body(p, 6, 'content-label', '内容导演', 55, 306, 160, 32, 'group', C.blue);
  body(p, 6, 'content-body', '理解稿件、组织叙事、拆页并形成页面内容。', 55, 348, 330, 50, 'body');
  body(p, 6, 'visual-label', '视觉导演', 55, 450, 160, 32, 'group', C.blue);
  body(p, 6, 'visual-body', '判断每页适合怎样表达，从已确认的能力中选择结构。', 55, 492, 330, 70, 'body');

  body(p, 6, 'chain-head', '确定性执行链', 470, 250, 300, 32, 'group', C.blue);
  const xs = [470, 720, 970];
  const titles = ['AI', '规则', '代码'];
  const bodies = ['理解与路由', '主题规范、能力选择与容量边界', '编译原生可编辑 PPTX，并检查'];
  const nodes = xs.map((x, i) => rect(p, `node-${i}`, frame(x, 315, 210, 154), i === 1 ? C.lightBlue : C.paleGray));
  nodePairs.push({ slide: 6, node: 'node-0', labels: ['6-node-0-t', '6-node-0-b'], semantic: 'AI' });
  nodePairs.push({ slide: 6, node: 'node-1', labels: ['6-node-1-t', '6-node-1-b'], semantic: '规则' });
  nodePairs.push({ slide: 6, node: 'node-2', labels: ['6-node-2-t', '6-node-2-b'], semantic: '代码' });
  connector(p, 6, 'ai-to-rules', nodes[0], nodes[1], '原稿：AI 负责理解、组织、路由；规则负责约束和选择');
  connector(p, 6, 'rules-to-code', nodes[1], nodes[2], '原稿：规则完成约束与选择后由代码稳定生成');
  titles.forEach((t, i) => { addText(p, 6, `node-${i}-t`, t, frame(xs[i] + 18, 334, 174, 32), 'group', { color: C.blue, alignment: 'center', verticalAlignment: 'middle' }); addText(p, 6, `node-${i}-b`, bodies[i], frame(xs[i] + 18, 378, 174, 68), 'body', { alignment: 'center', verticalAlignment: 'middle' }); });
}
function makeP7(p) {
  chrome(p, 7, '两条路线只在经过确认的核心资产库交汇', '核心架构');
  body(p, 7, 'intro', '能力建设发生在运行前；正式生成只读取核心库，必要时退回简单排版。', 55, 170, 1100, 42);
  body(p, 7, 'intake-title', '资产入库线', 55, 250, 400, 34, 'group', C.blue);
  body(p, 7, 'formal-title', '正式生成线', 760, 250, 400, 34, 'group', C.blue);
  const leftSteps = ['优秀参考', '提炼逻辑与设计规律', '扩展为可复用能力', '用户确认'];
  const rightSteps = ['原始稿件 + 组织主题', 'AI 理解与编排', '选择合法能力', '确定性排版与编译'];
  const leftNodes = leftSteps.map((t, i) => body(p, 7, `ls${i}`, `${String(i + 1).padStart(2, '0')}  ${t}`, 55, 305 + i * 52, 430, 34, 'body', i === 3 ? C.darkBlue : C.ink));
  const rightNodes = rightSteps.map((t, i) => body(p, 7, `rs${i}`, `${String(i + 1).padStart(2, '0')}  ${t}`, 760, 305 + i * 52, 430, 34, 'body', i === 2 ? C.darkBlue : C.ink));
  const core = rect(p, 'core', frame(555, 420, 170, 100), C.blue);
  nodePairs.push({ slide: 7, node: 'core', labels: ['7-core-t', '7-core-b'], semantic: '核心资产库' });
  connector(p, 7, 'intake-to-core', leftNodes[3], core, '原稿：用户确认通过后进入核心资产库');
  connector(p, 7, 'core-to-formal', core, rightNodes[2], '原稿：核心库向正式生成线提供只读调用');
  addText(p, 7, 'core-t', '核心资产库', frame(565, 438, 150, 30), 'group', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  addText(p, 7, 'core-b', '只读调用', frame(565, 476, 150, 26), 'note', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  body(p, 7, 'fallback', '没有合适结构 → 简单排版 / 拆页', 760, 560, 470, 30, 'note', C.muted);
}
function makeP8(p) {
  chrome(p, 8, '把昂贵的计算前移，让运行时主要负责理解、选择和填参', '建设期与运行时');
  body(p, 8, 'intro', '传统路线把理解、设计和失败风险集中在每次交付；PPagenT 把视觉理解前移为一次建设、多次复用的离线资产。', 55, 170, 1120, 52);
  body(p, 8, 'build-t', '建设期', 55, 280, 200, 32, 'group', C.blue);
  body(p, 8, 'build-b', '筛选优秀页面 → 理解规律 → 参数化内容、图片和数量 → 验证状态 → 用户确认。', 55, 330, 500, 88, 'body');
  body(p, 8, 'build-note', '视觉模型可用于资产理解与审查。', 55, 450, 500, 34, 'note', C.muted);
  body(p, 8, 'run-t', '正式生成期', 695, 280, 240, 32, 'group', C.blue);
  body(p, 8, 'run-b', '模型完成理解、分类、路由和填参；代码负责绘制与检查，纯文字模型承担主要在线任务。', 695, 330, 500, 88, 'body');
  body(p, 8, 'run-note', '视觉模型不成为每次交付的必要成本。', 695, 450, 500, 34, 'note', C.muted);
}
function makeP9(p) {
  chrome(p, 9, '真正积累的不是一万个模板，而是表达经验', '能力壁垒');
  body(p, 9, 'intro', '内容数量、字数和关系会变化；只有把规律提炼为可复用能力，漂亮页面才从一件作品变成一种能力。', 55, 170, 1120, 48);
  const items = [
    ['表达匹配', '什么内容适合怎样表达'],
    ['容量边界', '一个版式能够处理多少内容'],
    ['变化方式', '数量变化时怎样重新排布'],
    ['失败边界', '超出边界时换样式、拆页还是退化']
  ];
  items.forEach((it, i) => { const x = 55 + i * 290; body(p, 9, `w${i}-t`, it[0], x, 280, 250, 32, 'group', C.blue); body(p, 9, `w${i}-b`, it[1], x, 330, 250, 60, 'body'); });
  body(p, 9, 'barrier-note', '这些表达经验共同构成能力壁垒：新稿数量和字数变化时，仍知道如何排布以及何时换样式、拆页或退化。', 55, 475, 1120, 62, 'note', C.darkBlue);
}
function makeP10(p) {
  chrome(p, 10, '从一个学校走向更多组织，复用的是能力，替换的是主题', '扩展边界');
  body(p, 10, 'left-label', '首个场景', 55, 185, 160, 32, 'group', C.blue);
  body(p, 10, 'left', '东北大学有明确的视觉规范、持续发生的汇报需求和真实可检验的使用边界，因此成为第一个正式落地场景。', 55, 235, 500, 110, 'body');
  body(p, 10, 'orgs-label', '扩展对象', 55, 405, 160, 32, 'group', C.blue);
  body(p, 10, 'orgs', '其他学校、科研院所、实验室、企业和团队，都可以获得一套可低成本获得的生产能力。', 55, 455, 500, 88, 'body');
  body(p, 10, 'expand-title', '替换与复用', 690, 185, 500, 34, 'group', C.blue);
  body(p, 10, 'theme-l', '主题', 690, 250, 150, 30, 'group', C.blue);
  body(p, 10, 'theme-b', '颜色、Logo、字体、页眉页脚可以替换。', 850, 250, 380, 48, 'body');
  hline(p, 10, 'e1', 690, 325, 1190);
  body(p, 10, 'cap-l', '能力', 690, 365, 150, 30, 'group', C.blue);
  body(p, 10, 'cap-b', '内容理解规则与表达能力继续复用。', 850, 365, 340, 48, 'body');
  body(p, 10, 'foot', '组织不用要求每名成员都成为设计师，也能让日常输出稳定达到基本标准。', 690, 475, 500, 62, 'note', C.darkBlue);
}
function makeP11(p) {
  p.background.fill = C.bg;
  hline(p, 11, 'top-rule', 55, 85, 1225, C.blue, 2);
  addText(p, 11, 'title', '最后，它仍然只想解决一件普通的事', frame(55, 135, 1170, 50), 'claim');
  body(p, 11, 'body', '做一套好 PPT 太费时间了，而其中很多时间花在以前已经有人解决过的问题上。', 55, 240, 1000, 50, 'body');
  rect(p, 'close-bg', frame(55, 340, 1170, 190), C.lightBlue);
  body(p, 11, 'close', '不一定惊艳，但靠谱；不一定独一无二，但真的好用；可以立刻拿去讲，也可以继续修改。', 105, 395, 1060, 86, 'claim', C.darkBlue);
  body(p, 11, 'end', '如果持续做到这一点，普通问题就能成为可靠的产品能力，也有机会形成一门真正的生意。', 55, 590, 1120, 38, 'note', C.muted);
  addText(p, 11, 'footer', 'PPagenT 产品叙事  ·  11', frame(55, 682, 1170, 26), 'footer');
}

function assignSourceMap(raw) {
  const pageByHeading = {
    'PPagenT 产品叙事：把 PPT 生成变成可靠的生产过程': 1,
    '## 做 PPT，真正昂贵的不是“画”': 2,
    '## PPagenT 选择的是概率最大的需求': 3,
    '## 稳定跨过可用线，比偶然惊艳更重要': 4,
    '## 用限制自由换取可靠性': 5,
    '## AI 是控制器，不是画师': 6,
    '## 核心架构：建设能力，再稳定调用': 7,
    '## 把昂贵的计算前移': 8,
    '## 真正积累的不是一万个模板': 9,
    '## 从一个学校，走向更多组织': 10,
    '## 最后，它仍然只想解决一件普通的事': 11
  };
  const facts = {
    1: { keyFacts: ['产品把 PPT 生成转成可靠生产过程'], conditions: ['面向工作型 PPT'], optionsTradeoffs: [] },
    2: { keyFacts: ['昂贵部分是拆页、关系、层级和统一判断'], conditions: ['答辩、汇报或讲课场景'], optionsTradeoffs: [] },
    3: { keyFacts: ['目标是工作型 PPT 的可用概率 R'], conditions: ['学校、科研院所、事业单位、央国企和普通企业'], optionsTradeoffs: ['不追求单次最高分'] },
    4: { keyFacts: ['稳定 80 分比随机 95 分更值钱'], conditions: ['第二天仍需继续修改'], optionsTradeoffs: ['稳定可用 vs 偶然惊艳'] },
    5: { keyFacts: ['限制自由降低不可用状态机会'], conditions: ['规范、能力、容量和退化方式可确定'], optionsTradeoffs: ['理论峰值下降换取可预测'] },
    6: { keyFacts: ['AI 理解路由，规则约束选择，代码生成检查'], conditions: ['不让 AI 自由绘制整份 PPT'], optionsTradeoffs: [] },
    7: { keyFacts: ['资产入库线与正式生成线唯一交汇于核心库'], conditions: ['正式生成只读核心库；缺结构则简单排版/拆页'], optionsTradeoffs: ['建设期反复验证 vs 运行时稳定调用'] },
    8: { keyFacts: ['视觉理解前移为离线资产'], conditions: ['视觉模型非每次交付必要成本'], optionsTradeoffs: ['一次建设、多次复用'] },
    9: { keyFacts: ['积累表达匹配、容量、变化和失败边界'], conditions: ['新稿数量和字数会变化'], optionsTradeoffs: ['经验能力比模板数量更构成壁垒'] },
    10: { keyFacts: ['主题可替换，理解规则与表达能力可复用'], conditions: ['组织有规范和持续汇报需求'], optionsTradeoffs: [] },
    11: { keyFacts: ['产品承诺是靠谱、好用、可修改'], conditions: ['持续做到稳定可用'], optionsTradeoffs: ['不一定惊艳或独一无二'] }
  };
  const chunks = raw.split(/\r?\n\s*\r?\n/).map(s => s.trim()).filter(Boolean);
  let page = 1;
  const segments = chunks.map((text, index) => {
    if (pageByHeading[text]) page = pageByHeading[text];
    const meta = facts[page];
    return { index: index + 1, page, source: text, ...meta };
  });
  return { sourceFile: 'inputs/product.txt', pages: 11, segments, factsByPage: facts };
}

async function main() {
  await fs.mkdir(RUN, { recursive: true });
  const raw = await fs.readFile(SOURCE, 'utf8');
  // Save the source map before authoring any slide objects.
  await fs.writeFile(path.join(RUN, 'source-map.json'), JSON.stringify(assignSourceMap(raw), null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'reasoning.txt'), reasoning.map((x, i) => `${i + 1}. ${x}`).join('\n'), 'utf8');
  await fs.writeFile(path.join(RUN, 'structure-usage.txt'), [
    'mode: reference',
    'referenceAssetIds: sequence-flow-001, comparison-dual-verdict-001, causal-mediator-chain-003, problem-method-result-001',
    'P6 吸收 sequence-flow-001 的连续推进与真实节点绑定；内容导演和视觉导演作为职责文字独立呈现，不与执行链混为因果步骤。',
    'P7 参考 problem-method-result-001 的 1-N-1 汇聚骨架；用户确认、核心资产库、选择合法能力均为可见语义对象。',
    'P4 吸收 comparison-dual-verdict-001 的共同维度横向对齐方法，重组为三行分析面，不使用双舱或空槽。',
    'P8 吸收 comparison-dual-verdict-001 的对照关系；P6 的单向路径仅表达原稿明确的 AI→规则→代码传导。',
    '本轮未执行 invokeStructure；所有结构区域均以本次主题和指南重组为原生文字、形状与连接器。',
    'P7 有向边：用户确认 → 核心资产库；核心资产库 → 选择合法能力。P6 有向边：AI → 规则 → 代码。箭头目标端使用 tail。'
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(RUN, 'coverage.txt'), [
    '内容核对范围：product.txt 全部非空段落，按 source-map.json 逐段分配到 11 页。',
    '关键事实覆盖：两端需求与中间工作型需求、R 的概念目标及 Q/Q可用 变量、稳定 80 / 随机 95、增量定制成本、限制自由、内容导演/视觉导演及 AI/规则/代码职责、两条路线及唯一交汇点、建设期前移、能力壁垒、主题可替换与可靠收束。',
    '明确条件保留：目标工作场景、组织规范、容量边界、缺结构时简单排版/拆页、视觉模型只在建设期可用、持续做到稳定可用。',
    '方案取舍保留：最高分 vs 可用概率、自由度 vs 可预测、建设期成本 vs 运行时成本、模板数量 vs 表达经验。',
    '未做：视觉审查；按任务要求仅渲染并运行确定性检查，由父任务独立审查图片。'
  ].join('\n'), 'utf8');

  const pres = Presentation.create({ slideSize: { width: W, height: H } });
  const builders = [makeCover, makeP2, makeP3, makeP4, makeP5, makeP6, makeP7, makeP8, makeP9, makeP10, makeP11];
  for (let i = 0; i < builders.length; i++) builders[i](pres.slides.add());

  const roleOutput = [];
  for (let i = 0; i < pres.slides.items.length; i++) {
    const slide = pres.slides.items[i];
    const layout = await slide.export({ format: 'layout' });
    const text = await layout.text();
    await fs.writeFile(path.join(RUN, `slide-${String(i + 1).padStart(2, '0')}.layout.json`), text, 'utf8');
    let data = {};
    try { data = JSON.parse(text); } catch {}
    const elements = Array.isArray(data.elements) ? data.elements : [];
    for (const r of roles.filter(x => x.page === i + 1)) {
      const found = elements.find(e => e.name === r.name || e.id === r.name);
      roleOutput.push({ page: r.page, shapeId: found?.id || null, name: r.name, declaredRole: r.role, actualFontSize: found?.resolvedTextStyle?.fontSize || null, actualBold: found?.resolvedTextStyle?.bold ?? null });
    }
  }
  await fs.writeFile(path.join(RUN, 'text-roles.json'), JSON.stringify(roleOutput, null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'node-label-pairs.json'), JSON.stringify({
    pages: {
      'slide-06.layout.json': { pairs: nodePairs.filter(x => x.slide === 6).map(({ node, labels }) => ({ node, labels, padding: 8 })) },
      'slide-07.layout.json': { pairs: nodePairs.filter(x => x.slide === 7).map(({ node, labels }) => ({ node, labels, padding: 8 })) }
    },
    note: 'P6 执行链节点绑定标题与说明；P7 核心资产库绑定标题与说明，用户确认和选择合法能力作为可见语义文字节点参与连接。'
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'slide-06.node-label-pairs.json'), JSON.stringify({ pairs: nodePairs.filter(x => x.slide === 6).map(({ node, labels }) => ({ node, labels, padding: 8 })) }, null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'slide-07.node-label-pairs.json'), JSON.stringify({ pairs: nodePairs.filter(x => x.slide === 7).map(({ node, labels }) => ({ node, labels, padding: 8 })) }, null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'connections.json'), JSON.stringify(connections, null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'line-paths.json'), JSON.stringify(linePaths, null, 2), 'utf8');
  const pptx = await PresentationFile.exportPptx(pres);
  await pptx.save(path.join(RUN, 'deck.pptx'));
  await fs.writeFile(path.join(RUN, 'report.txt'), [
    '这是父审反馈修订后的 composition-product-b round-02，不计独立首稿。',
    '输出：11 页原生可编辑 PPTX；已导出每页 layout、source-map、reasoning、text-roles、connections、line-paths。',
    '结构采用 reference-recompose，未调用 invokeStructure；实际来源与改动见 structure-usage.txt。',
    `文字角色记录数：${roleOutput.length}；有向连接记录数：${connections.length}；线段记录数：${linePaths.length}。`,
    'P6/P7 连接均绑定实际可见语义对象；P3/P4 已补齐反馈指出的内容。',
    '已完成最终导出前的确定性产物写出；渲染、slides_test、文字重叠、节点配对、可见契约、换行尾部和连接器日志将在本目录保存。',
    '冻结状态：构建完成后不再修改。视觉审查由父任务独立完成，本报告不声明审美验收通过。'
  ].join('\n'), 'utf8');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
