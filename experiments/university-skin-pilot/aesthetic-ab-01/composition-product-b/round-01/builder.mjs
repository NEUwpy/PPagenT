import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/PPagenT';
const RUN = path.join(ROOT, 'experiments/university-skin-pilot/aesthetic-ab-01/composition-product-b/round-01');
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
const reasoning = [
  'P1 封面：以产品问题和目标形成最小开场，标题承担核心判断，副句说明读者将理解的道路。',
  'P2：把“画”与真正昂贵的拆页、关系判断、层级判断并置，形成问题定义。',
  'P3：呈现需求分布和目标工作场景，用 R = P(Q ≥ Q可用 | 目标工作场景) 作为概念指标；不把概念当测量。',
  'P4：对照偶然 95 分与稳定 80 分，落点是直接使用、继续修改和投入收益的组合判断。',
  'P5：解释限制自由的选择逻辑，将规范、能力、容量和退化方式放在同一约束面。',
  'P6：把 AI、规则、代码三种职责并置并按原稿箭头方向表达，职责与执行先后分开。',
  'P7：用双路线与核心资产库表现唯一交汇点；资产入库线和正式生成线分别保留，缺结构时退回简单排版。',
  'P8：围绕建设期与正式生成期对照昂贵工作和运行时职责，保留一次建设、多次复用及视觉模型非必要的条件。',
  'P9：把模板数量与可复用表达经验对照，列出壁垒的四个构成，并保留容量和失败边界。',
  'P10：从东北大学的落地条件推向其他组织，说明可替换的是主题，持续复用的是理解规则与表达能力。',
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
  rect(p, 'analysis-bg', frame(525, 178, 700, 370), C.paleBlue);
  body(p, 2, 'analysis-head', '时间消耗集中在决定“怎么讲”', 565, 205, 600, 38, 'group');
  const rows = [
    ['拆页', '一篇长稿应该拆成多少页，每一页只承担什么职责'],
    ['判关系', '观点是并列、递进、因果还是流程，哪里应该突出'],
    ['选表达', '什么时候应该用图，什么时候一句话反而更有力量'],
    ['统一', '翻找旧 PPT、替换内容，再统一字体、字号、颜色和间距']
  ];
  rows.forEach((r, i) => { const y = 270 + i * 66; body(p, 2, `r${i}-l`, r[0], 565, y, 100, 34, 'group', C.blue); body(p, 2, `r${i}-b`, r[1], 695, y, 485, 46); if (i < rows.length - 1) hline(p, 2, `row${i}`, 565, y + 52, 1180); });
  body(p, 2, 'question', '既然高手已经知道怎样做是好的，为什么每次还要重新做一遍？', 55, 600, 1110, 42, 'group', C.darkBlue);
}
function makeP3(p) {
  chrome(p, 3, 'PPagenT 先选择概率密度最大的工作型 PPT', '需求与目标');
  body(p, 3, 'left', '两端需求都存在，但更多需求位于中间：学校、科研院所、事业单位、央国企和普通企业，需要快速得到结构清楚、视觉体面、符合组织规范的 PPT。', 55, 180, 520, 145);
  body(p, 3, 'left-note', '底线：不能乱，不能丑，不能掉价，不能生成以后无法修改。', 55, 360, 500, 56, 'group', C.blue);
  rect(p, 'metric-bg', frame(650, 178, 575, 300), C.lightBlue);
  body(p, 3, 'metric-label', '产品可靠度', 690, 218, 480, 32, 'group', C.blue);
  body(p, 3, 'metric', 'R = P(Q ≥ Q可用 | 目标工作场景)', 690, 275, 500, 86, 'metric', C.darkBlue);
  body(p, 3, 'metric-body', '追求的是随机工作稿达到可用标准的概率，而不是某一次生成的最高分。', 690, 365, 475, 70);
  body(p, 3, 'footer-note', '这里的 R 是产品目标的概念表达，不是现成测量结果。', 55, 590, 900, 28, 'note');
}
function makeP4(p) {
  chrome(p, 4, '稳定跨过可用线，比偶然惊艳更重要', '可靠度');
  body(p, 4, 'intro', '明天上午九点要汇报，晚上交给系统的工作稿，首先需要逻辑清楚、版式规范、符合单位风格，而且第二天仍然可以继续修改。', 55, 174, 1090, 62);
  rect(p, 'compare-bg', frame(55, 272, 1170, 250), C.paleGray);
  body(p, 4, 'left-head', '随机的 95 分', 95, 310, 400, 38, 'group', C.muted);
  body(p, 4, 'left-body', '偶尔高度定制、让人惊叹，但结果落点和修改基础不稳定。', 95, 365, 405, 72);
  hline(p, 4, 'mid', 620, 300, 620, C.line, 1);
  body(p, 4, 'right-head', '稳定的 80 分', 700, 310, 400, 38, 'group', C.blue);
  body(p, 4, 'right-body', '直接使用不失专业，继续修改有可靠基础，投入与收益相匹配。', 700, 365, 405, 72);
  body(p, 4, 'takeaway', '“80 分”是稳定可用状态的形象称呼，不是产品的质量上限。', 55, 585, 1120, 34, 'note');
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
  rect(p, 'constraint-bg', frame(55, 265, 1170, 285), C.lightBlue);
  items.forEach((it, i) => { const x = 90 + (i % 2) * 560; const y = 300 + Math.floor(i / 2) * 105; body(p, 5, `i${i}-l`, it[0], x, y, 220, 32, 'group', C.blue); body(p, 5, `i${i}-b`, it[1], x, y + 40, 450, 44); });
  body(p, 5, 'quote', '每次都不一样，有时候才是缺点。', 55, 595, 800, 34, 'group', C.darkBlue);
}
function makeP6(p) {
  chrome(p, 6, 'AI 负责理解和路由，规则负责约束和选择，代码负责稳定生成', '控制器');
  body(p, 6, 'intro', 'AI 不直接自由绘制整份 PPT，而是把稿件变成页面内容，再从已确认的能力中选择合适结构。', 55, 170, 1120, 46);
  const xs = [75, 455, 835];
  const titles = ['AI', '规则', '代码'];
  const bodies = ['理解稿件、组织叙事、拆页、形成页面内容', '使用主题规范、能力选择、数量与容量边界', '把决策编译成原生可编辑 PowerPoint，并完成检查'];
  titles.forEach((t, i) => { rect(p, `node-${i}`, frame(xs[i], 285, 300, 150), i === 1 ? C.lightBlue : C.paleGray); addText(p, 6, `node-${i}-t`, t, frame(xs[i] + 28, 305, 244, 36), 'group', { color: C.blue, alignment: 'center', verticalAlignment: 'middle' }); addText(p, 6, `node-${i}-b`, bodies[i], frame(xs[i] + 28, 357, 244, 58), 'body', { alignment: 'center', verticalAlignment: 'middle' }); });
  // Use explicit text boxes as connector anchors so the visible direction is inspectable.
  const a = body(p, 6, 'anchor-a', '', 365, 350, 2, 2, 'note');
  const b = body(p, 6, 'anchor-b', '', 745, 350, 2, 2, 'note');
  connector(p, 6, 'ai-to-rules', a, b, '原稿：AI 负责理解、组织、路由；规则负责约束和选择');
  const c = body(p, 6, 'anchor-c', '', 745, 450, 2, 2, 'note');
  const d = body(p, 6, 'anchor-d', '', 1125, 450, 2, 2, 'note');
  connector(p, 6, 'rules-to-code', c, d, '原稿：规则完成约束与选择后由代码稳定生成');
  body(p, 6, 'bottom', 'AI 是控制器，不是画师；真正视觉结果由提前确认的能力和确定性代码完成。', 55, 555, 1120, 40, 'group', C.darkBlue);
}
function makeP7(p) {
  chrome(p, 7, '两条路线只在经过确认的核心资产库交汇', '核心架构');
  body(p, 7, 'intro', '能力建设发生在运行前；正式生成只读取核心库，必要时退回简单排版。', 55, 170, 1100, 42);
  rect(p, 'intake-bg', frame(55, 245, 500, 300), C.paleGray);
  rect(p, 'formal-bg', frame(725, 245, 500, 300), C.paleBlue);
  body(p, 7, 'intake-title', '资产入库线', 85, 275, 400, 34, 'group', C.blue);
  body(p, 7, 'formal-title', '正式生成线', 755, 275, 400, 34, 'group', C.blue);
  const leftSteps = ['优秀参考', '提炼逻辑与设计规律', '扩展为可复用能力', '用户确认'];
  const rightSteps = ['原始稿件 + 组织主题', 'AI 理解与编排', '选择合法能力', '确定性排版与编译'];
  leftSteps.forEach((t, i) => { const y = 330 + i * 48; body(p, 7, `ls${i}`, `${String(i + 1).padStart(2, '0')}  ${t}`, 90, y, 410, 30, 'body', i === 3 ? C.darkBlue : C.ink); if (i < 3) hline(p, 7, `lh${i}`, 90, y + 36, 500, C.line, 1); });
  rightSteps.forEach((t, i) => { const y = 330 + i * 48; body(p, 7, `rs${i}`, `${String(i + 1).padStart(2, '0')}  ${t}`, 760, y, 410, 30, 'body', i === 2 ? C.darkBlue : C.ink); if (i < 3) hline(p, 7, `rh${i}`, 760, y + 36, 1170, C.line, 1); });
  rect(p, 'core', frame(565, 315, 150, 110), C.blue);
  addText(p, 7, 'core-t', '核心资产库', frame(575, 335, 130, 30), 'group', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  addText(p, 7, 'core-b', '只读调用', frame(575, 377, 130, 28), 'note', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  const la = body(p, 7, 'anchor-la', '', 555, 370, 2, 2, 'note'); const lb = body(p, 7, 'anchor-lb', '', 565, 370, 2, 2, 'note'); connector(p, 7, 'intake-to-core', la, lb, '原稿：用户确认通过后进入核心资产库');
  const ra = body(p, 7, 'anchor-ra', '', 715, 370, 2, 2, 'note'); const rb = body(p, 7, 'anchor-rb', '', 725, 370, 2, 2, 'note'); connector(p, 7, 'core-to-formal', ra, rb, '原稿：核心库向正式生成线提供只读调用');
  body(p, 7, 'fallback', '没有合适结构 → 简单排版 / 拆页', 755, 570, 470, 30, 'note', C.muted);
}
function makeP8(p) {
  chrome(p, 8, '把昂贵的计算前移，让运行时主要负责理解、选择和填参', '建设期与运行时');
  body(p, 8, 'intro', '传统路线把理解、设计和失败风险集中在每次交付；PPagenT 把视觉理解前移为一次建设、多次复用的离线资产。', 55, 170, 1120, 52);
  rect(p, 'build-bg', frame(55, 270, 530, 270), C.lightBlue);
  rect(p, 'run-bg', frame(695, 270, 530, 270), C.paleGray);
  body(p, 8, 'build-t', '建设期', 90, 305, 200, 32, 'group', C.blue);
  body(p, 8, 'build-b', '筛选优秀页面 → 理解规律 → 参数化内容、图片和数量 → 验证状态 → 用户确认', 90, 360, 430, 100, 'body');
  body(p, 8, 'run-t', '正式生成期', 730, 305, 240, 32, 'group', C.blue);
  body(p, 8, 'run-b', '模型完成理解、分类、路由和填参；代码负责绘制与检查，纯文字模型承担主要在线任务。', 730, 360, 430, 100, 'body');
  body(p, 8, 'foot', '视觉模型可以用于建设期的资产理解与审查，但不成为每次交付的必要成本。', 55, 592, 1140, 32, 'note', C.darkBlue);
}
function makeP9(p) {
  chrome(p, 9, '真正积累的不是一万个模板，而是表达经验', '能力壁垒');
  body(p, 9, 'intro', '内容数量、字数和关系会变化；只有把规律提炼为可复用能力，漂亮页面才从一件作品变成一种能力。', 55, 170, 1120, 48);
  rect(p, 'wall-bg', frame(55, 265, 1170, 285), C.paleBlue);
  const items = [
    ['表达匹配', '什么内容适合怎样表达'],
    ['容量边界', '一个版式能够处理多少内容'],
    ['变化方式', '数量变化时怎样重新排布'],
    ['失败边界', '超出边界时换样式、拆页还是退化']
  ];
  items.forEach((it, i) => { const x = 90 + i * 275; body(p, 9, `w${i}-t`, it[0], x, 315, 240, 32, 'group', C.blue); body(p, 9, `w${i}-b`, it[1], x, 370, 240, 70, 'body'); });
  body(p, 9, 'barrier', '真正的壁垒 = 有效表达能力 + 正确路由 + 容量与失败边界 + 稳定生成', 55, 600, 1140, 34, 'group', C.darkBlue);
}
function makeP10(p) {
  chrome(p, 10, '从一个学校走向更多组织，复用的是能力，替换的是主题', '扩展边界');
  body(p, 10, 'left', '东北大学是第一个正式落地场景，因为它有明确的视觉规范、持续发生的汇报需求和真实可检验的使用边界。', 55, 185, 520, 120);
  rect(p, 'expand-bg', frame(650, 175, 575, 360), C.lightBlue);
  body(p, 10, 'expand-title', '可以替换与继续复用的两层', 690, 210, 500, 34, 'group', C.blue);
  body(p, 10, 'theme-l', '主题', 690, 285, 150, 30, 'group', C.blue);
  body(p, 10, 'theme-b', '颜色、Logo、字体、页眉页脚', 850, 285, 310, 30, 'body');
  hline(p, 10, 'e1', 690, 335, 1170);
  body(p, 10, 'cap-l', '能力', 690, 380, 150, 30, 'group', C.blue);
  body(p, 10, 'cap-b', '内容理解规则与表达能力继续复用', 850, 380, 310, 54, 'body');
  body(p, 10, 'orgs', '其他学校、科研院所、实验室、企业和团队，都可以获得一套可低成本获得的生产能力。', 55, 390, 520, 95);
  body(p, 10, 'foot', '组织不用要求每名成员都成为设计师，也能让日常输出稳定达到基本标准。', 55, 590, 1120, 32, 'note', C.darkBlue);
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
    'P6/P7 吸收 sequence-flow-001 的连续推进与节点绑定；P7 参考 problem-method-result-001 的 1-N-1 汇聚骨架。',
    'P4 吸收 comparison-dual-verdict-001 的共同维度横向对齐方法，但重组为两段分析文字，不使用卡片式双舱。',
    'P8 吸收 comparison-dual-verdict-001 的对照关系；P6 的职责传导参考 causal-mediator-chain-003 的单向路径，但不把职责表当作因果证明。',
    '本轮未执行 invokeStructure；所有结构区域均以本次主题和指南重组为原生文字、形状与连接器。',
    'P7 有向边：用户确认 → 核心资产库；核心资产库 → 正式生成线。P6 有向边：AI → 规则 → 代码。箭头目标端使用 tail。'
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(RUN, 'coverage.txt'), [
    '内容核对范围：product.txt 全部非空段落，按 source-map.json 逐段分配到 11 页。',
    '关键事实覆盖：R 的概念目标、可用线、稳定 80 / 随机 95、限制自由、AI/规则/代码职责、两条路线及唯一交汇点、建设期前移、能力壁垒、主题可替换与可靠收束。',
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
  await fs.writeFile(path.join(RUN, 'connections.json'), JSON.stringify(connections, null, 2), 'utf8');
  await fs.writeFile(path.join(RUN, 'line-paths.json'), JSON.stringify(linePaths, null, 2), 'utf8');
  const pptx = await PresentationFile.exportPptx(pres);
  await pptx.save(path.join(RUN, 'deck.pptx'));
  await fs.writeFile(path.join(RUN, 'report.txt'), [
    '首轮 composition-product-b 已生成。',
    '输出：11 页原生可编辑 PPTX；已导出每页 layout、source-map、reasoning、text-roles、connections、line-paths。',
    '结构采用 reference-recompose，未调用 invokeStructure；实际来源与改动见 structure-usage.txt。',
    `文字角色记录数：${roleOutput.length}；有向连接记录数：${connections.length}；线段记录数：${linePaths.length}。`,
    '本轮不声明视觉通过；已完成确定性产物写出，待运行外部渲染与检查器。'
  ].join('\n'), 'utf8');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
