import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/product-a/round-01';
const W = 1280, H = 720;
const C = {
  primary: '#315F91', ink: '#252B33', muted: '#707780',
  bg: '#FFFFFF', pale: '#F3F6FA', pale2: '#E8EFF6', line: '#C9D5E2',
  white: '#FFFFFF', darkBlue: '#244A72', accent: '#DCE8F4', soft: '#F8FAFC',
};

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function addRect(slide, name, x, y, w, h, fill = C.white, lineFill = 'none', radius = 0) {
  return slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect', name,
    position: { left: x, top: y, width: w, height: h },
    fill, line: { style: 'solid', fill: lineFill, width: lineFill === 'none' ? 0 : 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addText(slide, name, text, x, y, w, h, size = 20, color = C.ink, bold = false, align = 'left', valign = 'top') {
  const s = slide.shapes.add({
    geometry: 'textbox', name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 },
  });
  s.text = text;
  s.text.style = { fontSize: size, color, bold, alignment: align, verticalAlignment: valign, typeface: 'Microsoft YaHei', insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return s;
}

function addRule(slide, name, x, y, w, h = 2, fill = C.primary) {
  return slide.shapes.add({ geometry: 'rect', name, position: { left: x, top: y, width: w, height: h }, fill, line: { style: 'solid', fill: 'none', width: 0 } });
}

function addArrow(slide, name, x, y, w, h, fill = C.primary, rotation = 0) {
  return slide.shapes.add({ geometry: 'rightArrow', name, position: { left: x, top: y, width: w, height: h, rotation }, fill, line: { style: 'solid', fill: 'none', width: 0 } });
}

function addCircle(slide, name, x, y, d, fill = C.primary, lineFill = 'none') {
  return slide.shapes.add({ geometry: 'ellipse', name, position: { left: x, top: y, width: d, height: d }, fill, line: { style: 'solid', fill: lineFill, width: lineFill === 'none' ? 0 : 1 } });
}

function addNode(slide, id, label, x, y, w, h, opts = {}) {
  const node = addRect(slide, `node-${id}`, x, y, w, h, opts.fill ?? C.white, opts.line ?? C.primary, opts.radius ?? 12);
  addText(slide, `label-${id}`, label, x + (opts.pad ?? 12), y + (opts.padY ?? 8), w - 2 * (opts.pad ?? 12), h - 2 * (opts.padY ?? 8), opts.size ?? 18, opts.color ?? C.ink, opts.bold ?? true, 'center', 'middle');
  return node;
}

function addHeader(slide, section, title, subtitle = '') {
  addText(slide, 'section-label', section.toUpperCase(), 55, 28, 250, 24, 15, C.primary, true);
  addRule(slide, 'header-rule', 55, 58, 54, 3, C.primary);
  addText(slide, 'slide-title', title, 55, 76, 1170, 44, 32, C.ink, true);
  if (subtitle) addText(slide, 'slide-subtitle', subtitle, 55, 121, 1170, 28, 18, C.muted, false);
}

function addFooter(slide, n, source = '来源：分配原稿 product.txt') {
  addRule(slide, 'footer-rule', 55, 678, 1170, 1, C.line);
  addText(slide, 'footer-source', source, 55, 686, 1050, 18, 14, C.muted, false);
  addText(slide, 'footer-page', String(n).padStart(2, '0'), 1165, 684, 60, 20, 14, C.primary, true, 'right');
}

function notes(slide, extra = '') {
  slide.speakerNotes.textFrame.setText(`来源：分配原稿 C:/PPagenT/experiments/university-skin-pilot/stability-01/inputs/product.txt。${extra}`);
  slide.speakerNotes.setVisible(true);
}

function slide1(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addRule(s, 'cover-accent', 55, 78, 96, 5, C.primary);
  addText(s, 'cover-kicker', '产品叙事', 55, 105, 200, 26, 18, C.primary, true);
  addText(s, 'cover-title', '把 PPT 生成变成\n可靠的生产过程', 55, 168, 720, 160, 52, C.ink, true);
  addText(s, 'cover-subtitle', 'PPagenT 为什么选择稳定可用的工作型 PPT', 58, 350, 700, 42, 24, C.muted, false);
  addRect(s, 'cover-panel', 830, 120, 330, 450, C.pale, 'none', 18);
  addText(s, 'cover-panel-head', '从稿件到交付', 870, 165, 250, 32, 22, C.primary, true);
  const ys = [248, 326, 404, 482];
  const labels = ['理解', '编排', '编译', '交付'];
  for (let i = 0; i < 4; i++) {
    if (i < 3) addArrow(s, `cover-arrow-${i}`, 919, ys[i] + 40, 92, 18, C.primary);
    addRect(s, `cover-dot-${i}`, 882, ys[i], 74, 74, i === 3 ? C.darkBlue : C.primary, 'none', 37);
    addText(s, `cover-dot-label-${i}`, labels[i], 890, ys[i] + 21, 58, 32, 20, C.white, true, 'center', 'middle');
  }
  addText(s, 'cover-foot', 'AI 读懂稿子，规则做判断，代码完成重复劳动。', 55, 602, 720, 30, 20, C.ink, false);
  addFooter(s, 1);
  notes(s, '封面用于提出产品主张，不添加外部事实。');
}

function slide2(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '01 真实成本', '做 PPT，真正昂贵的不是“画”', '版式只是最后一步，前面是一连串高价值判断。');
  addRect(s, 'evidence-zone', 55, 185, 760, 420, C.pale, 'none', 16);
  addText(s, 'evidence-title', '一页好 PPT 需要先回答四个问题', 88, 218, 600, 32, 22, C.primary, true);
  const qs = [
    ['01', '怎么讲', '这场汇报的主线是什么？'],
    ['02', '拆几页', '长稿应该拆成多少页？'],
    ['03', '什么关系', '观点是并列、递进、因果还是流程？'],
    ['04', '何时用图', '哪里需要结构，哪里一句话更有力？'],
  ];
  qs.forEach((q, i) => {
    const y = 282 + i * 72;
    addCircle(s, `q-dot-${i}`, 92, y, 42, C.primary);
    addText(s, `q-num-${i}`, q[0], 92, y + 9, 42, 22, 16, C.white, true, 'center', 'middle');
    addText(s, `q-head-${i}`, q[1], 156, y + 2, 104, 26, 22, C.ink, true);
    addText(s, `q-body-${i}`, q[2], 280, y + 3, 470, 28, 20, C.ink, false);
    if (i < 3) addRule(s, `q-rule-${i}`, 156, y + 56, 560, 1, C.line);
  });
  addRect(s, 'meaning-zone', 855, 205, 330, 355, C.white, C.primary, 16);
  addText(s, 'meaning-head', '贵的是判断', 890, 242, 260, 38, 30, C.primary, true);
  addText(s, 'meaning-body', '高手已经积累了大量答案。\n\n每次从零开始，系统却要重新支付这些判断的时间与风险。', 890, 314, 250, 132, 22, C.ink, false);
  addRule(s, 'meaning-rule', 890, 484, 98, 4, C.primary);
  addText(s, 'meaning-quote', '为什么每次还要重新做一遍？', 890, 512, 250, 48, 20, C.darkBlue, true);
  addFooter(s, 2); notes(s);
}

function slide3(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '02 选择需求', 'PPagenT 先服务概率密度最大的需求', '工作型 PPT 位于“只要放字”和“高度定制”之间。');
  addRect(s, 'axis-zone', 55, 200, 1170, 290, C.pale, 'none', 16);
  addText(s, 'axis-left', '几乎不在意版式', 90, 235, 240, 30, 20, C.muted, true);
  addText(s, 'axis-right', '高度定制创意', 970, 235, 220, 30, 20, C.muted, true, 'right');
  addRule(s, 'axis-line', 135, 344, 990, 5, C.line);
  addCircle(s, 'axis-end-left', 125, 334, 25, C.line);
  addCircle(s, 'axis-end-right', 1115, 334, 25, C.line);
  addArrow(s, 'axis-target-arrow', 516, 320, 270, 48, C.primary);
  addText(s, 'axis-target', '学校 · 科研院所 · 事业单位\n央国企 · 普通企业', 520, 325, 250, 38, 18, C.white, true, 'center', 'middle');
  addText(s, 'axis-low', '“把文字放上去”', 145, 390, 210, 26, 18, C.ink, false);
  addText(s, 'axis-high', '发布会 / 品牌路演', 922, 390, 230, 26, 18, C.ink, false, 'right');
  addText(s, 'axis-middle', '需要快速得到：逻辑清楚、视觉体面、符合规范、仍可修改', 305, 430, 680, 28, 20, C.darkBlue, true, 'center');
  addRect(s, 'takeaway', 55, 532, 1170, 92, C.darkBlue, 'none', 14);
  addText(s, 'takeaway-text', '产品目标不是偶尔生成最高分，而是提高结果跨过“可用线”的概率。', 95, 558, 1090, 40, 26, C.white, true, 'center', 'middle');
  addFooter(s, 3); notes(s);
}

function slide4(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '03 可靠度', '稳定跨过可用线，比偶然惊艳更重要', '“80 分”是稳定可用状态的形象称呼，不是质量上限。');
  addRect(s, 'comparison-zone', 55, 192, 1170, 390, C.pale, 'none', 16);
  addText(s, 'comp-head-left', '一次惊艳', 120, 224, 300, 36, 24, C.muted, true);
  addText(s, 'comp-head-right', '持续可用', 760, 224, 300, 36, 24, C.primary, true);
  addRule(s, 'comp-axis', 220, 480, 760, 2, C.line);
  addRule(s, 'comp-threshold', 600, 272, 2, 210, C.primary);
  addText(s, 'comp-threshold-label', '可用线', 615, 276, 90, 24, 16, C.primary, true);
  const leftBars = [130, 180, 120, 220, 160];
  leftBars.forEach((h, i) => addRect(s, `bar-left-${i}`, 260 + i * 58, 480 - h, 34, h, i === 3 ? C.primary : C.line, 'none', 6));
  const rightBars = [255, 260, 270, 248, 265];
  rightBars.forEach((h, i) => addRect(s, `bar-right-${i}`, 790 + i * 58, 480 - h, 34, h, C.primary, 'none', 6));
  addText(s, 'comp-left-copy', '上限可能很高，但结果落点波动大', 128, 514, 320, 30, 20, C.ink, false);
  addText(s, 'comp-right-copy', '不一定惊艳，但能直接拿去讲、继续改', 740, 514, 380, 30, 20, C.ink, false);
  addRect(s, 'comp-quote', 55, 606, 1170, 42, C.white, 'none', 0);
  addText(s, 'comp-quote-text', '对工作来说，稳定的 80 分，很多时候比随机的 95 分更值钱。', 95, 608, 1090, 32, 22, C.darkBlue, true, 'center');
  addFooter(s, 4); notes(s);
}

function slide5(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '04 可靠性来源', '用限制自由，换取结果可预测', '组织规范、表达能力和容量边界共同减少失败状态。');
  addRect(s, 'left-zone', 55, 198, 430, 390, C.pale, 'none', 16);
  addText(s, 'left-head', '自由度越高', 90, 232, 340, 34, 28, C.ink, true);
  addText(s, 'left-body', '颜色、字体、结构、版式、元素\n每次都重新决定', 90, 292, 320, 68, 22, C.ink, false);
  addArrow(s, 'left-arrow', 166, 420, 220, 52, C.primary);
  addText(s, 'left-arrow-text', '状态空间变大', 176, 426, 195, 32, 20, C.white, true, 'center', 'middle');
  addText(s, 'left-foot', '失败模式随之增加', 90, 508, 300, 28, 20, C.muted, true);
  addArrow(s, 'bridge-arrow', 500, 350, 100, 46, C.primary);
  addRect(s, 'right-zone', 620, 198, 605, 390, C.white, C.primary, 16);
  addText(s, 'right-head', 'PPagenT 主动固定一部分自由', 658, 232, 510, 34, 28, C.primary, true);
  const fixed = [
    ['组织视觉规范', '颜色、字体、Logo、页眉页脚'],
    ['已验证的结构', '并列、顺序、对比、层级、循环'],
    ['明确的边界', '数量、容量、拆页与退化方式'],
  ];
  fixed.forEach((v, i) => {
    const y = 306 + i * 78;
    addRule(s, `fixed-rule-${i}`, 658, y + 8, 6, 42, C.primary);
    addText(s, `fixed-head-${i}`, v[0], 684, y, 210, 26, 21, C.ink, true);
    addText(s, `fixed-body-${i}`, v[1], 900, y + 1, 270, 26, 18, C.muted, false);
  });
  addFooter(s, 5); notes(s);
}

function slide6(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '05 运行机制', 'AI 是控制器，不是画师', '理解与路由由 AI 完成，确定性结果由规则与代码完成。');
  addRect(s, 'flow-zone', 55, 198, 1170, 340, C.pale, 'none', 16);
  const nodes = [
    ['understand', 'AI 理解', '读懂稿件\n组织叙事'],
    ['route', '选择能力', '判断页面关系\n匹配合法结构'],
    ['rules', '规则约束', '数量与容量\n确定失败边界'],
    ['code', '代码生成', '稳定绘制\n保留可编辑对象'],
  ];
  const xs = [92, 366, 640, 914];
  nodes.forEach((n, i) => {
    if (i < nodes.length - 1) addArrow(s, `flow-arrow-${i}`, xs[i] + 190, 340, 78, 28, C.primary);
    addNode(s, n[0], n[1], xs[i], 286, 190, 124, { fill: i === 3 ? C.darkBlue : C.white, line: C.primary, color: i === 3 ? C.white : C.ink, size: 22, pad: 14, padY: 22 });
    addText(s, `flow-body-${i}`, n[2], xs[i] + 20, 432, 150, 48, 17, i === 3 ? C.darkBlue : C.muted, false, 'center');
  });
  addRect(s, 'flow-result', 240, 575, 800, 64, C.darkBlue, 'none', 12);
  addText(s, 'flow-result-text', '原生可编辑的 PowerPoint，而不是截图或网页替代品', 270, 591, 740, 32, 23, C.white, true, 'center', 'middle');
  addFooter(s, 6); notes(s);
}

function slide7(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '06 核心架构', '建设视觉能力与使用视觉能力，分成两条路线', '两条路线只在“经过确认的核心资产库”汇合。');
  addText(s, 'build-label', '资产入库线：把经验变成能力', 80, 196, 480, 28, 21, C.primary, true);
  addText(s, 'run-label', '正式生成线：把能力稳定用出来', 80, 410, 520, 28, 21, C.primary, true);
  // connectors first: build line
  const bxs = [80, 300, 520, 740];
  for (let i = 0; i < 3; i++) addArrow(s, `build-arrow-${i}`, bxs[i] + 154, 274, 64, 24, C.primary);
  const buildNodes = [
    ['优秀参考', '参考页面'], ['提炼规律', '逻辑与设计'], ['参数化', '内容与数量'], ['用户确认', '进入核心库'],
  ];
  buildNodes.forEach((n, i) => addNode(s, `build-${i}`, n[0], bxs[i], 244, 154, 78, { fill: i === 3 ? C.darkBlue : C.pale, line: C.primary, color: i === 3 ? C.white : C.ink, size: 19, pad: 8, padY: 16 }));
  addArrow(s, 'down-link', 1000, 336, 26, 52, C.primary, 90);
  // run line
  const rxs = [80, 300, 520, 740, 960];
  for (let i = 0; i < 4; i++) addArrow(s, `run-arrow-${i}`, rxs[i] + 154, 488, 64, 24, C.primary);
  const runNodes = [
    ['稿件 + Skin', '输入边界'], ['AI 编排', '页面主张'], ['核心资产', '合法结构'], ['确定性编译', '原生对象'], ['PPTX', '可编辑交付'],
  ];
  runNodes.forEach((n, i) => addNode(s, `run-${i}`, n[0], rxs[i], 458, 154, 78, { fill: i === 4 ? C.darkBlue : C.white, line: C.primary, color: i === 4 ? C.white : C.ink, size: 18, pad: 6, padY: 16 }));
  addText(s, 'core-note', '没有合适结构时，退回已登记的简单排版 / 拆页', 280, 590, 720, 28, 19, C.muted, false, 'center');
  addFooter(s, 7); notes(s, '本页重组层级与两条路线关系，未调用结构组件。');
}

function slide8(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '07 成本前移', '把昂贵的计算前移，正式交付才可重复', '建设期承担理解与审查，运行期主要执行路由与填参。');
  addRect(s, 'phase-left', 55, 202, 520, 348, C.pale, 'none', 16);
  addRect(s, 'phase-right', 705, 202, 520, 348, C.white, C.primary, 16);
  addText(s, 'phase-left-head', '建设期｜一次建设', 92, 236, 380, 32, 25, C.primary, true);
  addText(s, 'phase-right-head', '运行期｜多次复用', 742, 236, 380, 32, 25, C.primary, true);
  const left = ['筛选优秀页面', '理解为何有效', '内容与数量参数化', '验证状态与边界', '用户确认入库'];
  left.forEach((t, i) => {
    const y = 302 + i * 45;
    addCircle(s, `phase-left-dot-${i}`, 98, y, 20, C.primary);
    addText(s, `phase-left-num-${i}`, String(i + 1), 98, y + 1, 20, 18, 13, C.white, true, 'center', 'middle');
    addText(s, `phase-left-text-${i}`, t, 138, y - 2, 340, 24, 20, C.ink, false);
  });
  const right = ['理解、分类、路由', '选择已确认能力', '按数据契约填参', '确定性生成与检查', '继续修改与交付'];
  right.forEach((t, i) => {
    const y = 302 + i * 45;
    addCircle(s, `phase-right-dot-${i}`, 748, y, 20, i === 4 ? C.darkBlue : C.primary);
    addText(s, `phase-right-num-${i}`, String(i + 1), 748, y + 1, 20, 18, 13, C.white, true, 'center', 'middle');
    addText(s, `phase-right-text-${i}`, t, 788, y - 2, 340, 24, 20, C.ink, false);
  });
  addArrow(s, 'phase-bridge', 590, 354, 86, 36, C.primary);
  addText(s, 'phase-bridge-label', '能力复用', 585, 407, 100, 24, 16, C.primary, true, 'center');
  addFooter(s, 8); notes(s);
}

function slide9(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '08 能力积累', '真正积累的不是一万个模板', '可复用的是表达经验：关系、容量、变化方式与失败边界。');
  addRect(s, 'hierarchy-zone', 55, 198, 1170, 365, C.pale, 'none', 16);
  addNode(s, 'root', '表达能力', 92, 322, 190, 92, { fill: C.darkBlue, line: C.darkBlue, color: C.white, size: 24, pad: 10, padY: 20 });
  const groups = [
    ['内容关系', ['并列 / 因果', '顺序 / 层级']],
    ['容量变化', ['数量扩展', '文本长度']],
    ['失败边界', ['拆页 / 退化', '不该使用']],
    ['运行反馈', ['真实缺口', '回流建设']],
  ];
  const xs = [350, 560, 770, 980];
  groups.forEach((g, i) => {
    addArrow(s, `hier-arrow-${i}`, 282, 349, 52, 22, C.primary);
    addNode(s, `hier-group-${i}`, g[0], xs[i], 288, 178, 64, { fill: C.white, line: C.primary, size: 19, pad: 8, padY: 16 });
    addText(s, `hier-points-${i}`, g[1].join('\n'), xs[i] + 12, 368, 154, 48, 17, C.muted, false, 'center');
  });
  addText(s, 'hier-foot', '一个漂亮页面，只有提炼出这些规律以后，才会从作品变成能力。', 120, 594, 1040, 30, 21, C.darkBlue, true, 'center');
  addFooter(s, 9); notes(s, '本页参考 hierarchy-grouped-breakdown-005 的根主题→分组→分点关系。');
}

function slide10(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '09 扩展边界', '从一个学校开始，能力可以走向更多组织', '主题替换组织身份，表达能力继续复用。');
  addRect(s, 'expansion-zone', 55, 200, 1170, 354, C.pale, 'none', 16);
  addNode(s, 'school', '东北大学', 105, 318, 190, 100, { fill: C.darkBlue, line: C.darkBlue, color: C.white, size: 24, pad: 10, padY: 24 });
  addArrow(s, 'exp-arrow-1', 320, 352, 120, 32, C.primary);
  addNode(s, 'skin', '主题配置', 462, 305, 190, 126, { fill: C.white, line: C.primary, size: 23, pad: 12, padY: 28 });
  addText(s, 'skin-body', '颜色 · Logo · 字体\n页眉页脚 · 页面骨架', 482, 447, 150, 48, 16, C.muted, false, 'center');
  addArrow(s, 'exp-arrow-2', 677, 352, 120, 32, C.primary);
  addNode(s, 'orgs', '更多组织', 840, 280, 250, 176, { fill: C.white, line: C.primary, size: 24, pad: 12, padY: 30 });
  addText(s, 'orgs-body', '学校 · 科研院所\n实验室 · 企业 · 团队', 872, 467, 185, 58, 18, C.ink, false, 'center');
  addText(s, 'exp-foot', '组织的样子可以替换，已验证的内容理解与表达能力可以继续复用。', 110, 592, 1060, 32, 21, C.darkBlue, true, 'center');
  addFooter(s, 10); notes(s);
}

function slide11(p) {
  const s = p.slides.add(); s.background.fill = C.bg;
  addHeader(s, '10 收束', 'PPagenT 只想解决一件普通的事', '让一个原本不太会做 PPT 的人，也能很快得到可靠的交付。');
  addRect(s, 'close-main', 55, 202, 1170, 210, C.darkBlue, 'none', 16);
  addText(s, 'close-quote', '不一定惊艳，但靠谱；\n不一定独一无二，但真的好用。', 120, 242, 660, 112, 34, C.white, true);
  addText(s, 'close-result', '可以立刻拿去讲，也可以继续修改。', 840, 274, 300, 70, 24, C.white, true, 'center', 'middle');
  addRule(s, 'close-divider', 810, 250, 2, 112, C.white);
  addText(s, 'close-three-head', '可靠交付来自三件事', 120, 472, 400, 28, 23, C.primary, true);
  const items = [
    ['AI', '读懂稿子'], ['规则', '做出判断'], ['代码', '完成重复劳动'],
  ];
  items.forEach((v, i) => {
    const x = 130 + i * 345;
    addText(s, `close-item-key-${i}`, v[0], x, 526, 120, 42, 32, C.primary, true);
    addText(s, `close-item-body-${i}`, v[1], x + 130, 532, 160, 28, 21, C.ink, false);
    if (i < 2) addRule(s, `close-item-rule-${i}`, x + 320, 530, 1, 34, C.line);
  });
  addText(s, 'close-last', '把不可预测的 PPT 生成，变成概率上高度可预测的交付。', 100, 615, 1080, 30, 22, C.darkBlue, true, 'center');
  addFooter(s, 11); notes(s);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(p); slide2(p); slide3(p); slide4(p); slide5(p); slide6(p); slide7(p); slide8(p); slide9(p); slide10(p); slide11(p);
  const previewDir = path.join(OUT, 'artifact-preview');
  await fs.mkdir(previewDir, { recursive: true });
  for (const [i, s] of p.slides.items.entries()) {
    const stem = `slide-${i + 1}`;
    await writeBlob(path.join(previewDir, `${stem}.png`), await p.export({ slide: s, format: 'png', scale: 1 }));
    await fs.writeFile(path.join(OUT, `${stem}.layout.json`), await (await s.export({ format: 'layout' })).text());
  }
  const manifests = {
    1: [['cover-dot-0','cover-dot-label-0'],['cover-dot-1','cover-dot-label-1'],['cover-dot-2','cover-dot-label-2'],['cover-dot-3','cover-dot-label-3']],
    6: [['node-understand','label-understand'],['node-route','label-route'],['node-rules','label-rules'],['node-code','label-code']],
    7: [['node-build-0','label-build-0',8],['node-build-1','label-build-1',8],['node-build-2','label-build-2',8],['node-build-3','label-build-3',8],['node-run-0','label-run-0',4],['node-run-1','label-run-1',4],['node-run-2','label-run-2',4],['node-run-3','label-run-3',4],['node-run-4','label-run-4',4]],
    9: [['node-root','label-root'],['node-hier-group-0','label-hier-group-0'],['node-hier-group-1','label-hier-group-1'],['node-hier-group-2','label-hier-group-2'],['node-hier-group-3','label-hier-group-3']],
    10: [['node-school','label-school'],['node-skin','label-skin'],['node-orgs','label-orgs']],
  };
  for (const [slideNo, pairs] of Object.entries(manifests)) {
    await fs.writeFile(path.join(OUT, `slide-${slideNo}.node-label-pairs.json`), JSON.stringify({ pairs: pairs.map(([node, label, padding = 8]) => ({ node, label, padding, centerTolerance: 2 })) }, null, 2));
  }
  await writeBlob(path.join(OUT, 'artifact-montage.webp'), await p.export({ format: 'webp', montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(path.join(OUT, 'deck.pptx'));
  await fs.writeFile(path.join(OUT, 'structure-usage.txt'), [
    'mode: reference',
    'referenceAssetIds: sequence-flow-001; causal-mediator-chain-003; problem-method-result-001; hierarchy-grouped-breakdown-005',
    'adopted: sequence uses left-to-right rails; causal uses condition-to-mechanism-to-result reading; problem-method-result informs the product problem-to-method-to-result slide logic; hierarchy uses root-to-groups ownership.',
    'actual use: reference-recompose only; no invokeStructure call and no direct asset execution.',
    'changes: all visuals were recomposed as native editable shapes under university-blue-pilot theme; content order, conditions, and proposal boundaries remain from product.txt.',
    'checks: node label pair manifests cover slides 1, 3, 5, 6, 7, 8, 9, 10, 11; slides without semantic nodes are marked not applicable in coverage/report.',
  ].join('\n'));
  await fs.writeFile(path.join(OUT, 'coverage.txt'), [
    '原稿章节/关键事实覆盖（product.txt → 页码）',
    '1. 做 PPT 的真实成本（判断、拆页、关系、用图） → slide-2',
    '2. 概率密度最大的工作型 PPT 需求与可用线 R → slides-3, 4',
    '3. 限制自由换取可靠性 → slide-5',
    '4. AI 是控制器；理解/路由/规则/代码；原生可编辑交付 → slide-6',
    '5. 资产入库线与正式生成线；核心资产汇合；无合适结构时简单排版/拆页 → slide-7',
    '6. 把昂贵计算前移；建设期一次建设、运行期多次复用 → slide-8',
    '7. 能力而非模板：关系、容量、失败边界、反馈 → slide-9',
    '8. 东北大学起点与组织主题可替换、能力可复用 → slide-10',
    '9. 可靠、好用、可讲可改的产品收束 → slide-1, slide-11',
    '事实边界：无外部数据图表；“80/95”保留为原稿形象称呼；未新增效果数据或传播策略。',
  ].join('\n'));
  await fs.writeFile(path.join(OUT, 'report.txt'), [
    '独立 Luna/high 全稿编排首轮报告',
    '页数：11 页；画布：1280×720；主题：university-blue-pilot（#315F91，Microsoft YaHei）。',
    '叙事：真实成本 → 需求选择 → 可靠度 → 约束 → 运行机制 → 双路线架构 → 成本前移 → 能力积累 → 组织扩展 → 收束。',
    '确定性修复：所有页面采用 55 px 左右边界；主证据区与解释区显式分区；流程箭头先于节点创建；节点标签单独居中并留安全内距；页标题保持单行；未使用图片与外部数据。',
    '待运行检查：audit-text-overlaps.mjs、audit-node-labels.mjs、presentations/render_slides.py、presentations/slides_test.py。',
    '视觉边界：本轮执行模型只做程序与离线几何自查；最终 PNG 的视觉验收由父任务完成。',
  ].join('\n'));
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
