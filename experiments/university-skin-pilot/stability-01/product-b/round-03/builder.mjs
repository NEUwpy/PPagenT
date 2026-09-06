import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/product-b/round-03';
const THEME_PATH = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/inputs-v9/theme.json';

const baseTheme = JSON.parse(await fs.readFile(THEME_PATH, 'utf8'));
const Theme = {
  ...baseTheme,
  primary: baseTheme.primaryColor,
  primaryDark: '#274D76',
  primaryMid: '#5E83A8',
  primaryLight: '#E7EFF7',
  primaryPale: '#F4F8FB',
  ink: baseTheme.neutral.ink,
  muted: baseTheme.neutral.muted,
  bg: baseTheme.neutral.background,
  line: '#D7DDE3',
  soft: '#F4F6F8',
  coverText: '#DCE8F3',
  coverRule: '#6E91B5',
  spectrum: '#EEF1F4',
};

const W = 1280;
const H = 720;
const FONT = Theme.font;
const deck = Presentation.create({ slideSize: { width: W, height: H } });

function shape(slide, geometry, name, position, fill = 'none', lineFill = 'none', lineWidth = 0, borderRadius) {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
    ...(borderRadius ? { borderRadius } : {}),
  });
}

function text(slide, name, value, position, style = {}) {
  const s = shape(slide, 'textbox', name, position, 'none', 'none', 0);
  s.text = value;
  s.text.style = {
    fontFamily: FONT,
    fontSize: 20,
    color: Theme.ink,
    alignment: 'left',
    verticalAlignment: 'top',
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    ...style,
  };
  return s;
}

function node(slide, ctx, name, value, position, fill = Theme.primaryPale, style = {}) {
  const s = shape(slide, 'roundRect', name, position, fill, 'none', 0, 12);
  s.text = value;
  s.text.style = {
    fontFamily: FONT,
    fontSize: 20,
    color: Theme.ink,
    bold: false,
    alignment: 'center',
    verticalAlignment: 'middle',
    insets: { left: 16, right: 16, top: 10, bottom: 10 },
    ...style,
  };
  ctx.pairs.push({ node: name, label: name, labels: [name], padding: 8, centerTolerance: 2 });
  return s;
}

function rectNode(slide, ctx, name, value, position, fill = Theme.primaryPale, style = {}) {
  const s = shape(slide, 'rect', name, position, fill, 'none', 0);
  s.text = value;
  s.text.style = {
    fontFamily: FONT,
    fontSize: 20,
    color: Theme.ink,
    bold: false,
    alignment: 'center',
    verticalAlignment: 'middle',
    insets: { left: 16, right: 16, top: 10, bottom: 10 },
    ...style,
  };
  ctx.pairs.push({ node: name, label: name, labels: [name], padding: 8, centerTolerance: 2 });
  return s;
}

function rect(slide, name, position, fill, lineFill = 'none', lineWidth = 0) {
  return shape(slide, 'rect', name, position, fill, lineFill, lineWidth);
}

function arrow(slide, from, to, options = {}) {
  return slide.shapes.connect(from, to, {
    kind: options.kind || 'straight',
    fromSide: options.fromSide || 'right',
    toSide: options.toSide || 'left',
    line: { style: options.dashed ? 'dashed' : 'solid', fill: options.color || Theme.primaryMid, width: options.width || 2 },
    tail: { type: 'arrow', width: 'sm', length: 'sm' },
  });
}

function titleBand(slide, titleValue, subtitleValue, pageNo) {
  slide.background.fill = Theme.bg;
  text(slide, `slide-${pageNo}-title`, titleValue, { left: 55, top: 28, width: 1110, height: 44 }, { fontSize: 32, bold: true, color: Theme.ink, verticalAlignment: 'middle' });
  rect(slide, `slide-${pageNo}-divider`, { left: 55, top: 88, width: 1170, height: 4 }, Theme.primary);
  if (subtitleValue) text(slide, `slide-${pageNo}-subtitle`, subtitleValue, { left: 55, top: 102, width: 1120, height: 28 }, { fontSize: 16, color: Theme.muted });
  rect(slide, `slide-${pageNo}-footer-line`, { left: 55, top: 674, width: 1170, height: 1 }, Theme.line);
  text(slide, `slide-${pageNo}-source`, '来源：PPagenT 产品叙事', { left: 55, top: 685, width: 300, height: 18 }, { fontSize: 14, color: Theme.muted });
  text(slide, `slide-${pageNo}-page`, String(pageNo).padStart(2, '0'), { left: 1180, top: 685, width: 45, height: 18 }, { fontSize: 14, color: Theme.muted, alignment: 'right' });
}

function notes(slide, extra = '') {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- PPagenT 产品叙事（用户提供原稿）${extra ? `\n${extra}` : ''}`);
  slide.speakerNotes.setVisible(true);
}

const pairManifests = [];

// 1. Cover
{
  const slide = deck.slides.add();
  slide.background.fill = Theme.primaryDark;
  rect(slide, 'cover-accent', { left: 55, top: 58, width: 92, height: 8 }, Theme.primary);
  text(slide, 'cover-eyebrow', 'PPagenT 产品叙事', { left: 55, top: 84, width: 400, height: 30 }, { fontSize: 18, bold: true, color: Theme.coverText });
  text(slide, 'cover-title', '把 PPT 生成\n变成可靠的生产过程', { left: 55, top: 170, width: 690, height: 160 }, { fontSize: 48, bold: true, color: '#FFFFFF', verticalAlignment: 'middle' });
  text(slide, 'cover-subtitle', '让 AI 读懂稿子，让规则做判断，让代码完成重复劳动。', { left: 58, top: 368, width: 620, height: 64 }, { fontSize: 22, color: Theme.coverText });
  rect(slide, 'cover-rule', { left: 55, top: 488, width: 1170, height: 1 }, Theme.coverRule);
  text(slide, 'cover-foot', '工作型 PPT · 结构清楚 · 视觉体面 · 原生可编辑', { left: 55, top: 520, width: 700, height: 28 }, { fontSize: 18, color: Theme.coverText });
  text(slide, 'cover-page', '01', { left: 1180, top: 660, width: 45, height: 18 }, { fontSize: 14, color: Theme.coverText, alignment: 'right' });
  notes(slide);
}

// 2. The costly part
{
  const slide = deck.slides.add();
  titleBand(slide, '做 PPT 真正昂贵的，是一连串判断', '拖动文本框只是最后一步；前面还有一套叙事与视觉决策。', 2);
  const ctx = { pairs: [] };
  const left = node(slide, ctx, 'p2-narrative', '叙事判断', { left: 88, top: 202, width: 300, height: 104 }, Theme.primaryLight, { fontSize: 26, bold: true, color: Theme.primaryDark });
  const right = node(slide, ctx, 'p2-visual', '视觉落地判断', { left: 88, top: 400, width: 300, height: 104 }, Theme.soft, { fontSize: 26, bold: true, color: Theme.ink });
  const out = node(slide, ctx, 'p2-output', '一套可以继续修改的 PPT', { left: 820, top: 250, width: 360, height: 230 }, Theme.primary, { fontSize: 26, bold: true, color: '#FFFFFF' });
  arrow(slide, left, out, { fromSide: 'right', toSide: 'left', color: Theme.primaryMid, kind: 'straight' });
  arrow(slide, right, out, { fromSide: 'right', toSide: 'left', color: Theme.muted, kind: 'straight' });
  text(slide, 'p2-narrative-detail', '怎么讲、拆成几页、每页承担什么职责\n观点之间是并列、递进、因果还是流程', { left: 88, top: 316, width: 300, height: 76 }, { fontSize: 18, color: Theme.muted });
  text(slide, 'p2-visual-detail', '哪里突出、什么时候用图\n怎样统一字体、字号、颜色和间距', { left: 88, top: 522, width: 300, height: 56 }, { fontSize: 18, color: Theme.muted });
  text(slide, 'p2-caption', '高手已经积累了这些答案；PPagenT 要把答案留下来。', { left: 820, top: 510, width: 360, height: 40 }, { fontSize: 18, color: Theme.muted, alignment: 'center' });
  pairManifests.push({ page: 2, pairs: ctx.pairs });
  notes(slide);
}

// 3. Target demand
{
  const slide = deck.slides.add();
  titleBand(slide, 'PPagenT 先服务需求密度最大的工作型 PPT', '两端需求都存在，但更适合标准化的是中间的日常工作场景。', 3);
  const ctx = { pairs: [] };
  text(slide, 'p3-axis-left', '几乎不在意版式', { left: 88, top: 184, width: 220, height: 28 }, { fontSize: 18, color: Theme.muted });
  text(slide, 'p3-axis-right', '高度定制的视觉创意', { left: 970, top: 184, width: 220, height: 28 }, { fontSize: 18, color: Theme.muted, alignment: 'right' });
  rect(slide, 'p3-spectrum-left', { left: 88, top: 240, width: 265, height: 104 }, Theme.spectrum);
  const target = rectNode(slide, ctx, 'p3-target', '工作型 PPT\n学校 · 科研院所 · 事业单位 · 企业', { left: 353, top: 228, width: 572, height: 128 }, Theme.primary, { fontSize: 22, bold: true, color: '#FFFFFF' });
  rect(slide, 'p3-spectrum-right', { left: 925, top: 240, width: 265, height: 104 }, Theme.spectrum);
  text(slide, 'p3-target-note', '概率密度最大、重复发生，也最适合标准化', { left: 356, top: 382, width: 566, height: 30 }, { fontSize: 18, color: Theme.primaryDark, alignment: 'center' });
  text(slide, 'p3-bottom-head', '这类场景的底线很明确', { left: 88, top: 478, width: 300, height: 30 }, { fontSize: 22, bold: true, color: Theme.ink });
  text(slide, 'p3-bottom-copy', '不能乱，不能丑，不能掉价，不能生成以后无法修改。', { left: 88, top: 524, width: 1000, height: 46 }, { fontSize: 24, color: Theme.primaryDark, bold: true });
  rect(slide, 'p3-bottom-rule', { left: 88, top: 598, width: 1102, height: 1 }, Theme.line);
  text(slide, 'p3-bottom-foot', '产品选择因此不是覆盖所有需求，而是先把最常见、最可重复的工作做好。', { left: 88, top: 616, width: 920, height: 28 }, { fontSize: 18, color: Theme.muted });
  pairManifests.push({ page: 3, pairs: ctx.pairs });
  notes(slide);
}

// 4. Reliability metric
{
  const slide = deck.slides.add();
  titleBand(slide, '产品真正追求的，是跨过可用线的概率', '目标不是偶尔生成 95 分，而是让随机工作稿稳定进入可用区间。', 4);
  text(slide, 'p4-formula-label', '概念上的产品可靠度', { left: 88, top: 168, width: 310, height: 28 }, { fontSize: 18, color: Theme.muted });
  text(slide, 'p4-formula', 'R = P(Q ≥ Q可用 | 目标工作场景)', { left: 88, top: 205, width: 640, height: 68 }, { fontSize: 36, bold: true, color: Theme.primaryDark, verticalAlignment: 'middle' });
  rect(slide, 'p4-formula-rule', { left: 88, top: 296, width: 640, height: 2 }, Theme.primary);
  text(slide, 'p4-formula-explain', 'Q 是生成质量；Q可用是“可以直接拿去讲”的最低标准。', { left: 88, top: 316, width: 600, height: 34 }, { fontSize: 18, color: Theme.muted });
  const ctx = { pairs: [] };
  const rare = node(slide, ctx, 'p4-rare', '95 分\n偶尔惊艳', { left: 790, top: 172, width: 300, height: 142 }, Theme.soft, { fontSize: 30, bold: true, color: Theme.ink });
  const reliable = node(slide, ctx, 'p4-reliable', '80 分\n稳定可用', { left: 790, top: 366, width: 300, height: 142 }, Theme.primary, { fontSize: 30, bold: true, color: '#FFFFFF' });
  text(slide, 'p4-side-note', '80 分只是“稳定可用”的形象称呼。\n可靠基础比偶然峰值更值钱。', { left: 760, top: 536, width: 420, height: 56 }, { fontSize: 18, color: Theme.muted });
  pairManifests.push({ page: 4, pairs: ctx.pairs });
  notes(slide);
}

// 5. Constraints
{
  const slide = deck.slides.add();
  titleBand(slide, '用限制自由，换取更可预测的交付', '固定规范、能力边界与退化方式，减少运行时的失败空间。', 5);
  const ctx = { pairs: [] };
  const a = node(slide, ctx, 'p5-free', '自由决定\n颜色 · 字体 · 结构 · 元素', { left: 80, top: 240, width: 270, height: 130 }, Theme.soft, { fontSize: 23, bold: true });
  const b = node(slide, ctx, 'p5-rules', '确定规范\n主题 · 核心能力 · 数量边界', { left: 490, top: 240, width: 300, height: 130 }, Theme.primaryLight, { fontSize: 23, bold: true, color: Theme.primaryDark });
  const c = node(slide, ctx, 'p5-result', '可预测交付\n稳定、规范、可编辑', { left: 930, top: 240, width: 270, height: 130 }, Theme.primary, { fontSize: 23, bold: true, color: '#FFFFFF' });
  arrow(slide, a, b, { fromSide: 'right', toSide: 'left' });
  arrow(slide, b, c, { fromSide: 'right', toSide: 'left' });
  text(slide, 'p5-cause-1', '状态空间更大，失败模式更多', { left: 80, top: 402, width: 290, height: 28 }, { fontSize: 18, color: Theme.muted, alignment: 'center' });
  text(slide, 'p5-cause-2', '把已验证的选择提前固定', { left: 490, top: 402, width: 300, height: 28 }, { fontSize: 18, color: Theme.muted, alignment: 'center' });
  text(slide, 'p5-cause-3', '必要时按已登记方式退化', { left: 930, top: 402, width: 270, height: 28 }, { fontSize: 18, color: Theme.muted, alignment: 'center' });
  rect(slide, 'p5-note-surface', { left: 80, top: 506, width: 1120, height: 92 }, Theme.primaryPale);
  text(slide, 'p5-note', '学校有学校的样子，企业有企业的样子。每次都不一样，有时候才是缺点。', { left: 108, top: 532, width: 1060, height: 34 }, { fontSize: 22, color: Theme.primaryDark, bold: true, alignment: 'center' });
  pairManifests.push({ page: 5, pairs: ctx.pairs });
  notes(slide);
}

// 6. Core architecture
{
  const slide = deck.slides.add();
  titleBand(slide, 'AI 负责理解和路由，规则负责约束，代码负责稳定生成', '两条路线在确认过的核心资产库处相交，最后输出原生可编辑 PPTX。', 6);
  rect(slide, 'p6-lane-top', { left: 55, top: 142, width: 1170, height: 170 }, Theme.primaryPale);
  rect(slide, 'p6-lane-bottom', { left: 55, top: 338, width: 1170, height: 236 }, Theme.soft);
  text(slide, 'p6-lane-top-label', '资产入库线', { left: 75, top: 155, width: 120, height: 26 }, { fontSize: 18, bold: true, color: Theme.primaryDark });
  text(slide, 'p6-lane-bottom-label', '正式生成线', { left: 75, top: 351, width: 120, height: 26 }, { fontSize: 18, bold: true, color: Theme.ink });
  const ctx = { pairs: [] };
  const t1 = node(slide, ctx, 'p6-ref', '优秀参考', { left: 165, top: 195, width: 150, height: 72 }, '#FFFFFF', { fontSize: 19, bold: true });
  const t2 = node(slide, ctx, 'p6-extract', '提炼规律\n参数化', { left: 365, top: 195, width: 165, height: 72 }, '#FFFFFF', { fontSize: 19, bold: true });
  const t3 = node(slide, ctx, 'p6-confirm', '用户确认', { left: 580, top: 195, width: 150, height: 72 }, '#FFFFFF', { fontSize: 19, bold: true });
  const t4 = node(slide, ctx, 'p6-core', '核心资产库', { left: 780, top: 195, width: 180, height: 72 }, Theme.primary, { fontSize: 20, bold: true, color: '#FFFFFF' });
  arrow(slide, t1, t2, { fromSide: 'right', toSide: 'left', color: Theme.primaryMid });
  arrow(slide, t2, t3, { fromSide: 'right', toSide: 'left', color: Theme.primaryMid });
  arrow(slide, t3, t4, { fromSide: 'right', toSide: 'left', color: Theme.primaryMid });
  const b1 = node(slide, ctx, 'p6-input', '原始稿件 + 主题', { left: 150, top: 420, width: 185, height: 78 }, '#FFFFFF', { fontSize: 19, bold: true });
  const b2 = node(slide, ctx, 'p6-content', '内容导演（AI）\n理解稿件 · 组织叙事 · 拆页', { left: 365, top: 420, width: 205, height: 78 }, Theme.primaryLight, { fontSize: 17, bold: true, color: Theme.primaryDark });
  const b3 = node(slide, ctx, 'p6-visual', '视觉导演（AI）\n判断表达 · 选择结构', { left: 600, top: 420, width: 205, height: 78 }, Theme.primaryLight, { fontSize: 17, bold: true, color: Theme.primaryDark });
  const b4 = node(slide, ctx, 'p6-choice', '合法能力\n或简单排版', { left: 835, top: 420, width: 170, height: 78 }, '#FFFFFF', { fontSize: 18, bold: true });
  const b5 = node(slide, ctx, 'p6-pptx', '原生可编辑\nPPTX', { left: 1060, top: 420, width: 135, height: 78 }, Theme.primary, { fontSize: 19, bold: true, color: '#FFFFFF' });
  arrow(slide, b1, b2, { fromSide: 'right', toSide: 'left' });
  arrow(slide, b2, b3, { fromSide: 'right', toSide: 'left' });
  arrow(slide, b3, b4, { fromSide: 'right', toSide: 'left' });
  arrow(slide, b4, b5, { fromSide: 'right', toSide: 'left' });
  arrow(slide, t4, b4, { fromSide: 'bottom', toSide: 'top', dashed: true, color: Theme.primaryMid, kind: 'elbow' });
  text(slide, 'p6-core-note', '核心资产库只读供给选择', { left: 970, top: 350, width: 220, height: 40 }, { fontSize: 16, color: Theme.primaryMid, alignment: 'center' });
  text(slide, 'p6-generation-note', '确定性生成', { left: 1005, top: 505, width: 175, height: 24 }, { fontSize: 16, color: Theme.primaryDark, bold: true, alignment: 'center' });
  text(slide, 'p6-caption', '内容导演组织叙事，视觉导演选择结构；AI 不直接自由绘制整份 PPT，确定性代码完成重复劳动。', { left: 120, top: 600, width: 1080, height: 28 }, { fontSize: 18, color: Theme.muted, alignment: 'center' });
  pairManifests.push({ page: 6, pairs: ctx.pairs });
  notes(slide);
}

// 7. Front-load the expensive work
{
  const slide = deck.slides.add();
  titleBand(slide, '把昂贵的视觉理解与失败风险前移', '建设完成以后，正式生成阶段主要执行理解、选择和填参。', 7);
  const ctx = { pairs: [] };
  const build = rectNode(slide, ctx, 'p7-build', '建设期\n筛选 · 参数化 · 验证 · 用户确认', { left: 88, top: 225, width: 450, height: 158 }, Theme.primaryLight, { fontSize: 24, bold: true, color: Theme.primaryDark });
  const deliver = rectNode(slide, ctx, 'p7-deliver', '交付期\n理解 · 路由 · 填参 · 稳定生成', { left: 742, top: 225, width: 450, height: 158 }, Theme.primary, { fontSize: 24, bold: true, color: '#FFFFFF' });
  arrow(slide, build, deliver, { fromSide: 'right', toSide: 'left', color: Theme.primaryMid });
  text(slide, 'p7-arrow-label', '一次建设，多次复用', { left: 554, top: 180, width: 172, height: 28 }, { fontSize: 18, color: Theme.primaryDark, bold: true, alignment: 'center' });
  rect(slide, 'p7-build-detail', { left: 88, top: 440, width: 450, height: 110 }, Theme.soft);
  text(slide, 'p7-build-copy', '人和工具先把优秀页面理解成能力，\n验证不同状态，再由用户确认进入核心库。', { left: 112, top: 466, width: 402, height: 64 }, { fontSize: 18, color: Theme.ink });
  rect(slide, 'p7-deliver-detail', { left: 742, top: 440, width: 450, height: 110 }, Theme.primaryPale);
  text(slide, 'p7-deliver-copy', '低成本模型承担理解、选择和填参；\n确定性代码负责稳定绘制与检查。', { left: 766, top: 466, width: 402, height: 64 }, { fontSize: 18, color: Theme.ink });
  text(slide, 'p7-bottom', '视觉理解没有消失，而是从每次在线支付的成本，变成一次建设、持续复用的资产。', { left: 88, top: 602, width: 1080, height: 30 }, { fontSize: 20, bold: true, color: Theme.primaryDark });
  pairManifests.push({ page: 7, pairs: ctx.pairs });
  notes(slide);
}

// 8. Capability and scale
{
  const slide = deck.slides.add();
  titleBand(slide, '真正积累的是表达能力的边界', '模板会过时；容量、变化方式与退化边界才是可以反复调用的经验。', 8);
  const ctx = { pairs: [] };
  const pack = node(slide, ctx, 'p8-pack', '经过验证的表达能力包', { left: 88, top: 190, width: 650, height: 96 }, Theme.primary, { fontSize: 28, bold: true, color: '#FFFFFF' });
  const boundary = rectNode(slide, ctx, 'p8-boundary', '知道什么内容适合怎样表达\n知道数量变化时怎样重排\n知道超过边界后怎样拆页或退化\n知道哪些结构不应该使用', { left: 88, top: 336, width: 650, height: 190 }, Theme.primaryPale, { fontSize: 19, color: Theme.ink });
  arrow(slide, pack, boundary, { fromSide: 'bottom', toSide: 'top', color: Theme.primaryMid });
  text(slide, 'p8-bridge', '应用结论：组织主题可替换', { left: 850, top: 190, width: 330, height: 28 }, { fontSize: 20, bold: true, color: Theme.primaryDark, alignment: 'center' });
  const theme = node(slide, ctx, 'p8-theme', '组织主题\n颜色 · Logo · 字体 · 页眉页脚', { left: 850, top: 255, width: 330, height: 112 }, Theme.soft, { fontSize: 20, bold: true });
  const org = node(slide, ctx, 'p8-org', '更多学校、科研院所、企业与团队', { left: 850, top: 452, width: 330, height: 90 }, Theme.primary, { fontSize: 22, bold: true, color: '#FFFFFF' });
  arrow(slide, theme, org, { fromSide: 'bottom', toSide: 'top', color: Theme.primaryMid });
  text(slide, 'p8-org-note', '东北大学是第一个正式落地场景；能力继续复用。', { left: 790, top: 574, width: 430, height: 26 }, { fontSize: 17, color: Theme.muted, alignment: 'center' });
  pairManifests.push({ page: 8, pairs: ctx.pairs });
  notes(slide);
}

// 9. Close
{
  const slide = deck.slides.add();
  slide.background.fill = Theme.primaryDark;
  rect(slide, 'p9-accent', { left: 55, top: 58, width: 92, height: 8 }, Theme.primary);
  text(slide, 'p9-eyebrow', 'PPagenT 的产品承诺', { left: 55, top: 84, width: 420, height: 30 }, { fontSize: 18, bold: true, color: Theme.coverText });
  text(slide, 'p9-title', '不一定惊艳，\n但真的好用。', { left: 55, top: 170, width: 610, height: 132 }, { fontSize: 48, bold: true, color: '#FFFFFF', verticalAlignment: 'middle' });
  text(slide, 'p9-copy', '可以立刻拿去讲，也可以继续修改。\n不一定独一无二，但稳定、靠谱、可预测。', { left: 58, top: 350, width: 590, height: 72 }, { fontSize: 22, color: Theme.coverText });
  rect(slide, 'p9-rule', { left: 760, top: 172, width: 1, height: 360 }, Theme.coverRule);
  text(slide, 'p9-four', 'AI 读懂稿子\n\n规则帮我们做判断\n\n代码完成重复劳动\n\n经验变成可靠能力', { left: 820, top: 180, width: 330, height: 330 }, { fontSize: 22, color: '#FFFFFF', bold: true });
  text(slide, 'p9-page', '09', { left: 1180, top: 660, width: 45, height: 18 }, { fontSize: 14, color: Theme.coverText, alignment: 'right' });
  notes(slide);
}

await fs.mkdir(OUT, { recursive: true });
for (const [i, slide] of deck.slides.items.entries()) {
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(`${OUT}/slide-${i + 1}.layout.json`, await layout.text(), 'utf8');
}
for (const manifest of pairManifests) {
  await fs.writeFile(`${OUT}/slide-${manifest.page}.node-label-pairs.json`, JSON.stringify({ pairs: manifest.pairs }, null, 2), 'utf8');
}
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(`${OUT}/deck.pptx`);
console.log(JSON.stringify({ slides: deck.slides.items.length, output: `${OUT}/deck.pptx` }));
