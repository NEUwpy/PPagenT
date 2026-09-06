import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../..');
const INPUT = path.join(ROOT, 'experiments/university-skin-pilot/aesthetic-ab-01/inputs');
const OUT = HERE;
const SOURCE_PATH = path.join(INPUT, 'product.txt');
const THEME_PATH = path.join(INPUT, 'theme.json');

const theme = JSON.parse(await fs.readFile(THEME_PATH, 'utf8'));
const W = 1280;
const H = 720;
const FONT = theme.font;
const C = {
  primary: theme.primaryColor,
  ink: theme.neutral.ink,
  muted: theme.neutral.muted,
  bg: theme.neutral.background,
  pale: '#EEF4F9',
  pale2: '#F6F8FA',
  line: '#CBD4DE',
  white: '#FFFFFF',
};

const ROLE = {
  cover: { fontSize: 44, bold: true, color: C.ink },
  claim: { fontSize: 30, bold: true, color: C.ink },
  group: { fontSize: 21, bold: true, color: C.primary },
  body: { fontSize: 18, bold: false, color: C.ink },
  note: { fontSize: 16, bold: false, color: C.muted },
  footer: { fontSize: 12, bold: false, color: C.muted },
  metric: { fontSize: 36, bold: true, color: C.primary },
};

const roleRecords = [];
const lineRecords = [];
const edgeRecords = [];
const nodePairs = [];

function box(left, top, width, height) { return { left, top, width, height }; }
function styleFor(role, overrides = {}) {
  return { ...ROLE[role], typeface: FONT, alignment: 'left', verticalAlignment: 'top', autoFit: 'none', wrap: 'square', lineSpacing: 1.4, ...overrides };
}
function addText(slide, name, text, position, role, overrides = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name,
    position,
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = styleFor(role, overrides);
  roleRecords.push({ page: slide.__page, name, role, text });
  return shape;
}
function addRect(slide, name, position, fill, lineFill = 'none', lineWidth = 0, geometry = 'rect') {
  const shape = slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
  });
  return shape;
}
function addDivider(slide, page, y = 105) {
  addRect(slide, `p${page}-divider`, box(55, y, 1170, 1), C.line);
  lineRecords.push({ page, name: `p${page}-divider`, kind: 'separator', from: { x: 55, y }, to: { x: 1225, y }, relation: 'title-body separation', isSeparator: true });
}
function addHeader(slide, page, title, eyebrow = 'PPagenT / PRODUCT NARRATIVE') {
  addText(slide, `p${page}-eyebrow`, eyebrow, box(55, 26, 420, 24), 'footer', { color: C.primary });
  addText(slide, `p${page}-title`, title, box(55, 60, 1165, 42), 'claim');
  addDivider(slide, page);
  addText(slide, `p${page}-footer`, `PPagenT  ·  ${String(page).padStart(2, '0')} / 11`, box(55, 680, 1170, 26), 'footer', { alignment: 'right' });
}
function addGroup(slide, page, key, label, body, x, y, w, labelW = 150, bodyRole = 'body') {
  addText(slide, `p${page}-${key}-label`, label, box(x, y, labelW, 38), 'group');
  addText(slide, `p${page}-${key}-body`, body, box(x + labelW + 18, y, w - labelW - 18, 90), bodyRole);
}
function addLine(slide, page, name, x1, y1, x2, y2, fill = C.line, width = 1, relation = 'separator') {
  addRect(slide, name, box(Math.min(x1, x2), Math.min(y1, y2), Math.max(1, Math.abs(x2 - x1) || width), Math.max(1, Math.abs(y2 - y1) || width),), fill);
  lineRecords.push({ page, name, kind: 'line', from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, relation, isSeparator: relation === 'separator' });
}
function connect(slide, page, source, target, sourceName, targetName, reason) {
  slide.shapes.connect(source, target, {
    kind: 'straight',
    fromSide: 'right',
    toSide: 'left',
    line: { fill: C.primary, width: 2 },
    tail: { type: 'arrow', width: 'sm', length: 'sm' },
  });
  edgeRecords.push({ page, sourceName, targetName, arrowAt: 'target', reason });
}

function paragraphSourceMap(sourceText) {
  const lines = sourceText.replace(/\r/g, '').split('\n');
  const entries = [];
  let section = '';
  let pending = [];
  const flush = () => {
    const text = pending.join('\n').trim();
    if (text) entries.push({ section, original: text });
    pending = [];
  };
  for (const line of lines) {
    if (/^##\s+/.test(line)) { flush(); section = line.replace(/^##\s+/, '').trim(); continue; }
    if (/^#\s+/.test(line)) { flush(); section = line.replace(/^#\s+/, '').trim(); continue; }
    if (line.trim() === '') { flush(); continue; }
    pending.push(line);
  }
  flush();
  const pageBySection = {
    'PPagenT 产品叙事：把 PPT 生成变成可靠的生产过程': [1],
    '做 PPT，真正昂贵的不是“画”': [2],
    'PPagenT 选择的是概率最大的需求': [3],
    '稳定跨过可用线，比偶然惊艳更重要': [4],
    '用限制自由换取可靠性': [5],
    'AI 是控制器，不是画师': [6],
    '核心架构：建设能力，再稳定调用': [7],
    '把昂贵的计算前移': [8],
    '真正积累的不是一万个模板': [9],
    '从一个学校，走向更多组织': [10],
    '最后，它仍然只想解决一件普通的事': [11],
  };
  return entries.map((e, i) => ({
    id: `src-${String(i + 1).padStart(3, '0')}`,
    section: e.section,
    original: e.original,
    keyFacts: e.original.replace(/[*`>#]/g, '').slice(0, 240),
    conditions: /如果|不能|不|只有|每次|需要|可以|而/.test(e.original) ? '保留原文中的条件、边界或限制' : '',
    optionsAndCosts: /代价|成本|换取|两端|选择|限制/.test(e.original) ? '保留原文中的取舍与成本' : '',
    pages: pageBySection[e.section] || [],
  }));
}

const sourceText = await fs.readFile(SOURCE_PATH, 'utf8');
const sourceMap = paragraphSourceMap(sourceText);
await fs.writeFile(path.join(OUT, 'source-map.json'), JSON.stringify({ source: 'inputs/product.txt', entries: sourceMap }, null, 2));

const pres = Presentation.create({ slideSize: { width: W, height: H } });
function newSlide(page) {
  const slide = pres.slides.add();
  slide.__page = page;
  slide.background.fill = C.bg;
  return slide;
}

// 1. Cover
{
  const s = newSlide(1);
  addRect(s, 'p1-accent', box(55, 66, 8, 132), C.primary);
  addText(s, 'p1-kicker', 'PPagenT 产品叙事', box(92, 72, 420, 34), 'group');
  addText(s, 'p1-title', '把 PPT 生成变成可靠的生产过程', box(92, 128, 890, 80), 'cover');
  addText(s, 'p1-subtitle', '让 AI 帮我们读稿子，让规则帮我们做判断，让代码完成重复劳动。', box(92, 236, 790, 58), 'body');
  addDivider(s, 1, 330);
  addText(s, 'p1-foot', '一份关于产品道路、能力建设与交付可靠度的说明', box(92, 358, 760, 30), 'note');
  addText(s, 'p1-page', '01 / 11', box(1120, 660, 105, 26), 'footer', { alignment: 'right' });
}

// 2. Judgement is the expensive part
{
  const p = 2, s = newSlide(p);
  addHeader(s, p, '做 PPT，真正昂贵的是判断');
  addText(s, 'p2-lead', '真正费时间的不是把文本框拖到左边还是右边，而是一连串判断。', box(55, 132, 1130, 46), 'body');
  addGroup(s, p, 'g1', '怎么讲', '这场汇报到底怎么讲，一篇长稿应该拆成多少页。', 72, 218, 520, 130);
  addGroup(s, p, 'g2', '页职责', '每一页只承担什么职责，这几个观点是并列、递进、因果还是流程。', 72, 328, 520, 130);
  addGroup(s, p, 'g3', '视觉判断', '哪里应该突出，什么时候应该用图，什么时候一句话反而更有力量。', 72, 438, 520, 130);
  addRect(s, 'p2-analysis-surface', box(680, 218, 500, 278), C.pale2);
  addText(s, 'p2-side-title', '高手积累的是一套答案', box(716, 250, 410, 34), 'group');
  addText(s, 'p2-side-body', '一个 PPT 做得很好的人，脑子里已经积累了大量答案。\n但每次接到新稿件，仍要重新拆页、找结构、调字体、统一间距。', box(716, 308, 420, 120), 'body');
  addText(s, 'p2-side-note', '昂贵的部分，是判断反复发生。', box(716, 458, 420, 28), 'note');
}

// 3. Target market and reliability metric
{
  const p = 3, s = newSlide(p);
  addHeader(s, p, 'PPagenT 先服务概率密度最大的工作型 PPT');
  addText(s, 'p3-intro', '需求从“只要把文字放上去”到“高度定制的视觉创意”分布很宽，更多场景位于中间。', box(55, 132, 1130, 44), 'body');
  addText(s, 'p3-left-label', '需求分布', box(72, 221, 180, 30), 'group');
  addLine(s, p, 'p3-axis', 90, 376, 605, 376, C.line, 2, 'axis');
  addRect(s, 'p3-target-band', box(255, 316, 245, 48), C.pale);
  addText(s, 'p3-low', '只要能用', box(78, 394, 150, 28), 'note');
  addText(s, 'p3-target', '工作型 PPT', box(305, 322, 150, 34), 'group', { alignment: 'center', verticalAlignment: 'middle' });
  addText(s, 'p3-high', '高度定制', box(498, 394, 120, 28), 'note', { alignment: 'right' });
  addText(s, 'p3-band-note', '不能乱、不能丑、不能掉价、不能生成完以后无法修改。\n主要场景：学校、科研院所、事业单位、央国企和普通企业。', box(88, 438, 520, 66), 'body');
  addRect(s, 'p3-formula-surface', box(690, 214, 470, 234), C.pale2);
  addText(s, 'p3-formula-label', '产品可靠度 R', box(730, 246, 300, 34), 'group');
  addText(s, 'p3-formula', 'R = P(Q ≥ Q可用 | 目标工作场景)', box(710, 292, 430, 100), 'metric', { alignment: 'center', verticalAlignment: 'middle' });
  addText(s, 'p3-formula-body', '要提高的，是工作稿达到可用标准的概率。', box(710, 402, 430, 44), 'body', { alignment: 'center', verticalAlignment: 'middle' });
}

// 4. Stable 80 vs random 95
{
  const p = 4, s = newSlide(p);
  addHeader(s, p, '稳定跨过可用线，比偶然惊艳更有价值');
  addText(s, 'p4-intro', '“80 分”是稳定可用状态的形象称呼，不是产品给自己设置的质量上限。', box(55, 132, 1130, 40), 'body');
  addText(s, 'p4-dim', '共同维度', box(76, 208, 190, 36), 'group');
  addRect(s, 'p4-b-surface', box(810, 192, 380, 332), C.pale);
  addText(s, 'p4-a-title', '偶然的 95 分', box(365, 208, 320, 36), 'group', { color: C.muted });
  addText(s, 'p4-b-title', '稳定的 80 分', box(835, 208, 320, 36), 'group');
  const rows = [
    ['价值', '偶尔让人惊叹', '直接使用不失专业'],
    ['场景', '高度定制的视觉作品', '明天要汇报的普通工作'],
    ['后续', '为增量付出更高成本', '继续修改有可靠基础'],
    ['结论', '上限更高，但结果随机', '投入与收益相匹配'],
  ];
  rows.forEach((r, i) => {
    const y = 272 + i * 62;
    addText(s, `p4-r${i}-label`, r[0], box(76, y, 180, 38), 'group');
    addText(s, `p4-r${i}-a`, r[1], box(365, y, 350, 34), 'body');
    addText(s, `p4-r${i}-b`, r[2], box(835, y, 320, 34), 'body');
    addLine(s, p, `p4-row-line-${i}`, 76, y + 44, 1185, y + 44, C.line, 1, 'comparison row');
  });
  addText(s, 'p4-note', '对工作来说，稳定的 80 分，很多时候比随机的 95 分更值钱。', box(76, 560, 1060, 36), 'note');
}

// 5. Restriction reduces failure states
{
  const p = 5, s = newSlide(p);
  addHeader(s, p, '限制一部分自由，换取更少的不可用状态');
  addText(s, 'p5-intro', '自由度越高，理论上的上限越高；但状态空间更大，失败模式也随之增加。', box(55, 132, 1130, 40), 'body');
  const xs = [80, 430, 780];
  const nodes = [];
  const data = [
    ['自由度越高', '颜色、字体、结构、版式、元素每次重来'],
    ['状态空间变大', '失败模式随之增加'],
    ['主动限制自由', '规范、能力、边界和退化方式更确定'],
  ];
  data.forEach((d, i) => {
    const bg = i === 2 ? C.pale : C.pale2;
    addRect(s, `p5-node-${i}`, box(xs[i], 242, 260, 154), bg);
    const t = addText(s, `p5-node-${i}-title`, d[0], box(xs[i] + 22, 270, 216, 34), 'group');
    const b = addText(s, `p5-node-${i}-body`, d[1], box(xs[i] + 22, 326, 216, 54), 'body');
    nodes.push({ shape: t, name: `p5-node-${i}-title` });
  });
  connect(s, p, nodes[0].shape, nodes[1].shape, nodes[0].name, nodes[1].name, '自由度增加导致状态空间扩大');
  connect(s, p, nodes[1].shape, nodes[2].shape, nodes[1].name, nodes[2].name, '状态空间扩大带来更多失败模式');
  addText(s, 'p5-bottom', '正式工作更需要可预测。', box(80, 470, 1060, 38), 'group');
  addText(s, 'p5-bottom-body', '固定的组织视觉规范、经过验证的表达能力、明确的数量与容量边界，以及已经登记的退化方式，共同减少结果落到不可用区间的机会。', box(80, 526, 1060, 56), 'body');
}

// 6. AI / rules / code roles
{
  const p = 6, s = newSlide(p);
  addHeader(s, p, 'AI 在 PPagenT 里负责理解与路由');
  addText(s, 'p6-intro', 'AI 不直接自由绘制整份 PPT；视觉结果由提前确认的能力和确定性代码完成。', box(55, 132, 1130, 40), 'body');
  const cols = [
    { x: 80, title: 'AI', body: '理解稿件、组织叙事、拆页，并判断每一页适合怎样表达。', note: '理解与路由' },
    { x: 430, title: '规则', body: '主题约束组织规范，能力库提供并列、顺序、对比、层级、循环等表达方式。', note: '约束与选择' },
    { x: 780, title: '代码', body: '确定性排版与编译，把决策变成原生可编辑的 PowerPoint。', note: '稳定生成' },
  ];
  cols.forEach((c, i) => {
    addText(s, `p6-c${i}-title`, c.title, box(c.x, 224, 260, 36), 'group');
    addLine(s, p, `p6-c${i}-line`, c.x, 276, c.x + 260, 276, C.primary, 2, 'section accent');
    addText(s, `p6-c${i}-body`, c.body, box(c.x, 308, 260, 106), 'body');
    addText(s, `p6-c${i}-note`, c.note, box(c.x, 452, 260, 28), 'note');
  });
  addText(s, 'p6-quote', 'AI 负责理解和路由，规则负责约束和选择，代码负责稳定生成。', box(80, 560, 1050, 36), 'group');
}

// 7. Two routes converge at core asset library
{
  const p = 7, s = newSlide(p);
  addHeader(s, p, '能力建设与正式生成，两条路线只在核心资产库交汇');
  addText(s, 'p7-intro', '资产入库线把经验变成能力，正式生成线把能力稳定地用出来。', box(55, 132, 1130, 40), 'body');
  addText(s, 'p7-build-label', '资产入库线', box(74, 188, 190, 30), 'group');
  addText(s, 'p7-run-label', '正式生成线', box(74, 422, 190, 30), 'group');
  const top = [
    ['p7-b1', '优秀参考', 74], ['p7-b2', '提炼设计规律', 260], ['p7-b3', '扩展复用能力', 465]
  ];
  const topShapes = [];
  top.forEach(([name, txt, x]) => {
    addRect(s, name + '-bg', box(x, 238, 170, 72), C.pale2);
    topShapes.push({ shape: addText(s, name, txt, box(x + 12, 252, 146, 44), 'group', { alignment: 'center', verticalAlignment: 'middle' }), name });
  });
  topShapes.forEach((n, i) => { if (i < topShapes.length - 1) connect(s, p, n.shape, topShapes[i + 1].shape, n.name, topShapes[i + 1].name, '资产入库阶段先后'); });
  const core = addRect(s, 'p7-core-bg', box(650, 312, 220, 96), C.primary);
  const coreText = addText(s, 'p7-core', '核心资产库', box(674, 334, 172, 56), 'group', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  connect(s, p, topShapes[2].shape, coreText, topShapes[2].name, 'p7-core', '用户确认后进入核心资产库');
  const bottom = [
    ['p7-r1', '稿件 + 主题', 74], ['p7-r2', 'AI 理解与编排', 300], ['p7-r3', '选择合法能力', 480]
  ];
  const bottomShapes = [];
  bottom.forEach(([name, txt, x]) => {
    addRect(s, name + '-bg', box(x, 474, 190, 72), C.pale2);
    bottomShapes.push({ shape: addText(s, name, txt, box(x + 12, 488, 166, 44), 'group', { alignment: 'center', verticalAlignment: 'middle' }), name });
  });
  bottomShapes.forEach((n, i) => { if (i < bottomShapes.length - 1) connect(s, p, n.shape, bottomShapes[i + 1].shape, n.name, bottomShapes[i + 1].name, '正式生成阶段先后'); });
  connect(s, p, bottomShapes[2].shape, coreText, bottomShapes[2].name, 'p7-core', '正式生成只读取核心库');
  const out = addText(s, 'p7-out', '确定性编译 → 可编辑 PPTX', box(914, 334, 285, 56), 'group', { alignment: 'center', verticalAlignment: 'middle' });
  connect(s, p, coreText, out, 'p7-core', 'p7-out', '核心能力进入确定性编译');
  addText(s, 'p7-note', '两条路线的唯一交汇点，是经过确认的核心资产库。\n没有合适结构时，退回简单排版 / 拆页；缺口是否另行建设，由用户决定。', box(74, 590, 1100, 62), 'note');
}

// 8. Front-load expensive computation
{
  const p = 8, s = newSlide(p);
  addHeader(s, p, '把昂贵的计算前移，正式生成才能低成本复用');
  addText(s, 'p8-intro', '传统路线把理解、设计和失败风险集中在每次运行时；PPagenT 把不确定工作前移到建设期。', box(55, 132, 1130, 40), 'body');
  addText(s, 'p8-build-title', '建设期 / 一次建设', box(80, 215, 420, 34), 'group');
  addRect(s, 'p8-build-surface', box(64, 250, 450, 230), C.pale2);
  addText(s, 'p8-build-over', '筛选优秀页面\n理解为什么好看\n内容、图片和数量参数化\n反复验证并由用户确认', box(88, 274, 400, 170), 'body');
  addText(s, 'p8-arrow-label', '一次建设，多次复用', box(555, 330, 190, 28), 'note', { alignment: 'center' });
  addLine(s, p, 'p8-arrow', 530, 365, 750, 365, C.primary, 2, 'build to runtime');
  addText(s, 'p8-runtime-title', '正式生成 / 多次运行', box(820, 215, 360, 34), 'group');
  addText(s, 'p8-runtime', '理解、分类、路由和填参\n规则约束与确定性代码\n真实任务中持续校准', box(820, 274, 360, 126), 'body');
  addText(s, 'p8-result', '视觉理解从在线成本变成离线资产。\n视觉模型服务建设期审查，不成为每次交付的必要成本。', box(820, 450, 360, 72), 'note');
}

// 9. Reusable capabilities, layered
{
  const p = 9, s = newSlide(p);
  addHeader(s, p, '真正积累的不是一万个模板，而是可复用的表达能力');
  addText(s, 'p9-intro', '原页面和新稿件的数量、长度会变化，静态模板无法穷尽；真正要留下的是背后的规律。', box(55, 132, 1130, 40), 'body');
  const layers = [
    { y: 226, w: 620, title: '稳定交付', items: '组织规范 / 原生可编辑' },
    { y: 306, w: 720, title: '路由判断', items: '内容适配 / 表达选择' },
    { y: 386, w: 820, title: '表达能力', items: '并列 / 顺序 / 对比 / 层级' },
    { y: 466, w: 920, title: '容量边界', items: '换样式 / 拆页 / 简单排版' },
  ];
  layers.forEach((l, i) => {
    const x = 640 - l.w / 2;
    addRect(s, `p9-layer-${i}`, box(x, l.y, l.w, 58), i === 0 ? C.primary : (i === 1 ? '#DCEAF5' : '#EDF3F7'));
    addText(s, `p9-layer-${i}-title`, l.title, box(x + 24, l.y + 11, 170, 36), 'group', { alignment: 'center', verticalAlignment: 'middle', ...(i === 0 ? { color: C.white } : {}) });
    addText(s, `p9-layer-${i}-items`, l.items, box(x + 200, l.y + 11, l.w - 224, 36), 'body', { alignment: 'center', verticalAlignment: 'middle', ...(i === 0 ? { color: C.white } : {}) });
  });
  addText(s, 'p9-note', '一个漂亮页面，只有在这些规律被提炼出来以后，才能从一件作品变成一种能力。', box(80, 570, 1080, 34), 'note');
}

// 10. Reuse across organizations
{
  const p = 10, s = newSlide(p);
  addHeader(s, p, '从一个学校走向更多组织，主题替换而能力复用');
  addText(s, 'p10-intro', '东北大学是第一个正式落地场景，但学校或组织的主题可替换，内容理解规则与表达能力可以继续复用。', box(55, 132, 1130, 42), 'body');
  const inputs = [
    ['学校视觉规范', 208], ['科研院所 / 实验室', 286], ['企业团队', 364], ['个人长期风格', 442]
  ];
  inputs.forEach(([txt, y], i) => {
    addRect(s, `p10-in-${i}`, box(90, y, 250, 48), C.pale2);
    addText(s, `p10-in-${i}-text`, txt, box(112, y + 8, 206, 32), 'group', { alignment: 'center', verticalAlignment: 'middle' });
    addLine(s, p, `p10-path-${i}`, 340, y + 24, 650, 353, C.primary, 2, 'input to shared output');
  });
  addRect(s, 'p10-output-bg', box(720, 284, 410, 140), C.primary);
  addText(s, 'p10-output-title', '更多组织的工作型 PPT', box(760, 296, 330, 36), 'group', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  addText(s, 'p10-output-body', '主题配置替换颜色、Logo、字体和页眉页脚；能力继续复用。', box(760, 350, 330, 60), 'body', { color: C.white, alignment: 'center', verticalAlignment: 'middle' });
  addText(s, 'p10-note', '不用要求每名成员都成为设计师，也能让日常输出稳定达到基本标准。', box(90, 560, 1040, 34), 'note');
}

// 11. Close
{
  const p = 11, s = newSlide(p);
  addRect(s, 'p11-accent', box(55, 68, 8, 172), C.primary);
  addText(s, 'p11-kicker', 'PPagenT / CLOSE', box(92, 72, 420, 34), 'group');
  addText(s, 'p11-title', '它卖的不是一次偶然惊艳，而是概率上高度可预测的交付。', box(92, 130, 1050, 120), 'cover');
  addText(s, 'p11-quote', '不一定惊艳，但靠谱；不一定独一无二，但真的好用；可以立刻拿去讲，也可以继续修改的 PPT。', box(92, 276, 980, 90), 'body');
  addDivider(s, 11, 414);
  addText(s, 'p11-last', '如果能持续做到这一点，这个普通问题就能成为一项可靠的产品能力。', box(92, 456, 900, 40), 'group');
  addText(s, 'p11-opportunity', '也有机会形成一门真正的生意。', box(92, 520, 900, 30), 'note');
  addText(s, 'p11-page', '11 / 11', box(1120, 660, 105, 26), 'footer', { alignment: 'right' });
}

// Export deck and per-slide layout evidence.
for (const [idx, slide] of pres.slides.items.entries()) {
  const page = idx + 1;
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(path.join(OUT, `slide-${String(page).padStart(2, '0')}.layout.json`), await layout.text());
}
const pptx = await PresentationFile.exportPptx(pres);
await pptx.save(path.join(OUT, 'deck.pptx'));

const layouts = [];
for (let i = 1; i <= 11; i++) layouts.push(JSON.parse(await fs.readFile(path.join(OUT, `slide-${String(i).padStart(2, '0')}.layout.json`), 'utf8')));
function elementsFor(layout) { return layout.elements || layout.slide?.elements || []; }
function findId(page, name) {
  const el = elementsFor(layouts[page - 1]).find(e => e.name === name || e.id === name || e.shape?.name === name);
  return el?.id || null;
}
const textRoles = roleRecords.map(r => ({ page: r.page, id: findId(r.page, r.name), name: r.name, role: r.role, text: r.text }));
await fs.writeFile(path.join(OUT, 'text-roles.json'), JSON.stringify({ roles: textRoles }, null, 2));
const pairPages = [7, 9, 10];
for (const page of pairPages) {
  const pageRoles = textRoles.filter(r => r.page === page && r.id);
  let pairs = [];
  if (page === 7) {
    pairs = [
      { node: 'p7-b1-bg', labels: ['p7-b1'] },
      { node: 'p7-b2-bg', labels: ['p7-b2'] },
      { node: 'p7-b3-bg', labels: ['p7-b3'] },
      { node: 'p7-core-bg', labels: ['p7-core'] },
      { node: 'p7-r1-bg', labels: ['p7-r1'] },
      { node: 'p7-r2-bg', labels: ['p7-r2'] },
      { node: 'p7-r3-bg', labels: ['p7-r3'] },
    ];
  } else if (page === 9) {
    pairs = [0, 1, 2, 3].map(i => ({ node: `p9-layer-${i}`, labels: [`p9-layer-${i}-title`, `p9-layer-${i}-items`] }));
  } else if (page === 10) {
    pairs = [0, 1, 2, 3].map(i => ({ node: `p10-in-${i}`, labels: [`p10-in-${i}-text`] }));
    pairs.push({ node: 'p10-output-bg', labels: ['p10-output-title', 'p10-output-body'] });
  }
  pairs = pairs.map(pair => ({ ...pair, labelIds: pair.labels.map(name => findId(page, name)), labelsText: pair.labels.map(name => pageRoles.find(r => r.name === name)?.text || '') }));
  await fs.writeFile(path.join(OUT, `slide-${String(page).padStart(2, '0')}.node-label-pairs.json`), JSON.stringify({ page, pairs }, null, 2));
}
const connections = edgeRecords.map(e => ({ ...e, sourceId: findId(e.page, e.sourceName), targetId: findId(e.page, e.targetName) }));
await fs.writeFile(path.join(OUT, 'connections.json'), JSON.stringify({ edges: connections }, null, 2));
await fs.writeFile(path.join(OUT, 'line-paths.json'), JSON.stringify({ lines: lineRecords }, null, 2));
await fs.writeFile(path.join(OUT, 'reasoning.txt'), `沟通任务：让不熟悉 AI 或 PowerPoint 开发的读者理解 PPagenT 的产品道路、可靠度目标、架构分工与扩展路径。\n\n叙事路径：判断成本 → 目标场景与可靠度 → 稳定可用的价值 → 限制自由的取舍 → AI/规则/代码分工 → 两条路线交汇 → 前移计算 → 能力积累 → 组织扩展 → 收束。\n\n关系依据：第 5 页采用因果链表达“自由度—状态空间—限制自由”；第 7 页参考 layered/sequence 的阶段关系重组双路线与核心资产交汇；第 9 页参考 layered-architecture-001 的由底向上支撑关系；第 10 页参考 convergence-many-to-one-003 的多路输入汇聚为共同结果。比较页按共同维度逐行对应。\n\n背景说明：浅灰/浅蓝底面只聚合完整分析面或标记约束范围，不承载额外事实；页首细灰线只划分标题区与正文区。\n`);
await fs.writeFile(path.join(OUT, 'structure-usage.txt'), `mode: reference\nreferenceAssetIds: layered-architecture-001, comparison-dual-verdict-001, sequence-flow-001, convergence-many-to-one-003\n\n吸收的方法：\n- layered-architecture-001：保留上下支撑与共同中轴的层序，用于第 9 页能力层级；按本页文字量改为直角浅色层带，不复用源坐标或组件调用。\n- comparison-dual-verdict-001：第 4 页吸收共同维度、逐行共线与推荐侧轻底色，采用开放比较表，不调用原组件。\n- sequence-flow-001：第 7、8 页吸收明确的左到右先后，但按原稿区分阶段关系与运行复用，不把职责表硬连成流程。\n- convergence-many-to-one-003：第 10 页吸收多路输入指向共同结果的几何关系，使用原生线条重组为组织主题汇聚。\n\n本轮未调用 invokeStructure，因此不存在 success 调用事件；以上结构均为原生参考重组。\n`);
const coverage = sourceMap.map(e => `${e.id}\t页码=${e.pages.join(',') || '未分配'}\t${e.section}`).join('\n');
await fs.writeFile(path.join(OUT, 'coverage.txt'), coverage + '\n');
await fs.writeFile(path.join(OUT, 'report.txt'), `首轮独立生成已完成：11 页（含封面与收束），输出 deck.pptx。\n内容核对：source-map.json 由唯一原稿逐段解析，页面覆盖按原稿章节分配；最终 PPTX 已导出并生成逐页 layout JSON、text-roles、connections、line-paths。\n确定性检查：待运行 audit-text-overlaps、audit-node-labels、audit-visible-contract、audit-wrap-tails、audit-connectors、slides_test 与 render_slides.py；结果写入本目录。\n结构使用：reference 模式，未调用结构执行器。\n视觉审查：生成者不读取渲染图片，不自称视觉通过；由父任务独立审查。\n`);
console.log('built', path.join(OUT, 'deck.pptx'));
