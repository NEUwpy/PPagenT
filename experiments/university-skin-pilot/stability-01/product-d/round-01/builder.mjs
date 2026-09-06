import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/product-d/round-01';
const W = 1280, H = 720;
const Theme = {
  primary: '#315F91',
  primaryDark: '#24476D',
  primaryMid: '#5F86AD',
  primaryLight: '#EAF1F7',
  primaryPale: '#F5F8FB',
  ink: '#252B33',
  muted: '#707780',
  line: '#D5DEE8',
  white: '#FFFFFF',
  gray: '#F2F4F6',
};

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function rect(slide, name, x, y, w, h, fill, line = 'none', radius = 0) {
  return slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect', name,
    position: { left: x, top: y, width: w, height: h },
    fill, borderRadius: radius || undefined,
    line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 },
  });
}

function text(slide, name, x, y, w, h, value, size = 18, color = Theme.ink, opts = {}) {
  const s = slide.shapes.add({
    geometry: 'textbox', name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 },
  });
  s.text = value;
  s.text.style = {
    fontSize: size, color, typeface: 'Microsoft YaHei',
    bold: !!opts.bold, alignment: opts.align || 'left',
    verticalAlignment: opts.valign || (opts.align === 'center' ? 'middle' : 'top'),
    lineSpacing: opts.lineSpacing || 1.12,
    autoFit: 'shrinkText', insets: { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return s;
}

function rule(slide, name, x, y, w, color = Theme.primary, width = 3) {
  return slide.shapes.add({ geometry: 'line', name, position: { left: x, top: y, width: w, height: 0 }, fill: 'none', line: { style: 'solid', fill: color, width } });
}

function arrow(slide, name, from, to, fromSide = 'right', toSide = 'left', dashed = false) {
  const c = slide.shapes.connect(from, to, {
    kind: 'straight', fromSide, toSide,
    line: { style: dashed ? 'dash' : 'solid', fill: Theme.primaryMid, width: 2 },
    tail: { type: 'triangle', width: 'sm', length: 'sm' },
  });
  c.name = name;
  c.sendToBack();
  return c;
}

function chrome(slide, title, page, subtitle = '') {
  slide.background.fill = Theme.white;
  text(slide, `title-${page}`, 55, 34, 1080, 44, title, 32, Theme.ink, { bold: true });
  rule(slide, `title-rule-${page}`, 55, 87, 1170, Theme.primary, 3);
  if (subtitle) text(slide, `subtitle-${page}`, 55, 100, 1160, 26, subtitle, 16, Theme.muted);
  text(slide, `footer-${page}`, 55, 684, 900, 18, 'PPagenT 产品叙事', 14, Theme.muted);
  text(slide, `page-${page}`, 1170, 684, 55, 18, String(page).padStart(2, '0'), 14, Theme.muted, { align: 'right' });
}

function notes(slide, page) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n本页内容来自《PPagenT 产品叙事：把 PPT 生成变成可靠的生产过程》（inputs/product.txt），第 ${page} 页为原稿观点的结构化编排。`);
  slide.speakerNotes.setVisible(true);
}

function addMetric(slide, name, x, y, w, h, label, body, fill = Theme.primaryPale, accent = Theme.primary) {
  rect(slide, `${name}-surface`, x, y, w, h, fill, Theme.line, 8);
  rect(slide, `${name}-bar`, x, y, 6, h, accent);
  text(slide, `${name}-label`, x + 22, y + 18, w - 40, 30, label, 22, accent, { bold: true });
  text(slide, `${name}-body`, x + 22, y + 58, w - 40, h - 70, body, 18, Theme.ink);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 Cover
  {
    const s = deck.slides.add(); s.background.fill = Theme.primaryDark;
    text(s, 'cover-kicker', 78, 90, 480, 28, 'PPagenT · 产品叙事', 18, '#DCE8F2', { bold: true });
    text(s, 'cover-title', 78, 164, 760, 150, '把 PPT 生成\n变成可靠的生产过程', 48, Theme.white, { bold: true, lineSpacing: 1.02 });
    rule(s, 'cover-rule', 80, 346, 160, '#9DB8D1', 4);
    text(s, 'cover-subtitle', 80, 382, 650, 72, '让 AI 读懂稿子，让规则做判断，让代码完成重复劳动。', 23, '#DCE8F2');
    rect(s, 'cover-anchor', 864, 142, 296, 350, Theme.primary, '#6F93B6', 8);
    text(s, 'cover-anchor-title', 900, 180, 220, 44, '可靠交付', 26, Theme.white, { bold: true, align: 'center' });
    text(s, 'cover-anchor-copy', 900, 260, 220, 126, '不一定惊艳\n但靠谱、好用\n可以讲，也能改', 24, Theme.white, { align: 'center', lineSpacing: 1.18 });
    text(s, 'cover-footer', 80, 665, 600, 18, '面向不需要 AI 或 PowerPoint 开发背景的读者', 14, '#BFD2E3');
    notes(s, 1);
  }

  // 2 Problem
  {
    const s = deck.slides.add(); chrome(s, '真正昂贵的，是反复发生的判断', 2, '做 PPT 的成本首先来自叙事、拆页与关系判断。');
    rect(s, 'problem-main', 55, 150, 690, 470, Theme.primaryDark, 'none', 8);
    text(s, 'problem-main-head', 90, 182, 560, 42, '一套 PPT 要先回答什么？', 24, Theme.white, { bold: true });
    const rows = [
      ['01', '这场汇报到底怎么讲'],
      ['02', '长稿应该拆成多少页'],
      ['03', '观点是并列、递进、因果还是流程'],
      ['04', '哪里突出、什么时候用图'],
      ['05', '如何统一结构、字体、颜色与间距'],
    ];
    rows.forEach((r, i) => {
      const yy = 250 + i * 62;
      text(s, `problem-num-${i}`, 92, yy, 48, 26, r[0], 16, '#AFC8DE', { bold: true });
      text(s, `problem-row-${i}`, 154, yy - 2, 540, 30, r[1], 20, Theme.white);
      if (i < rows.length - 1) rule(s, `problem-rule-${i}`, 90, yy + 38, 590, '#587B9F', 1);
    });
    rect(s, 'problem-side', 790, 150, 435, 470, Theme.primaryPale, Theme.line, 8);
    text(s, 'problem-side-kicker', 828, 184, 360, 22, '真正费时间的不是“画”', 18, Theme.primary, { bold: true });
    text(s, 'problem-side-quote', 828, 240, 370, 120, '“高手已经知道怎样做得好，\n为什么每次还要重做？”', 28, Theme.ink, { bold: true, lineSpacing: 1.15 });
    text(s, 'problem-side-note', 828, 466, 350, 86, '高手脑子里积累的是一套答案：内容怎样组织，关系怎样表达，版式怎样稳定复用。', 18, Theme.muted);
    notes(s, 2);
  }

  // 3 Market + R
  {
    const s = deck.slides.add(); chrome(s, '先服务最适合标准化的工作型 PPT', 3, 'PPagenT 选择高概率、重复发生、需要规范与可修改的场景。');
    rect(s, 'r-card', 55, 150, 520, 340, Theme.primaryDark, 'none', 8);
    text(s, 'r-label', 92, 184, 400, 26, '产品可靠度', 20, '#BFD2E3', { bold: true });
    text(s, 'r-formula', 92, 246, 440, 86, 'R = P(Q ≥ Q可用 |\n目标工作场景)', 32, Theme.white, { bold: true, lineSpacing: 1.08 });
    text(s, 'r-explain', 92, 372, 405, 74, '追求生成结果稳定达到“可以直接拿去讲”的最低标准。', 20, '#DCE8F2');
    text(s, 'market-title', 625, 158, 550, 30, '需求分布不是平均的', 22, Theme.ink, { bold: true });
    rule(s, 'market-axis', 650, 290, 520, Theme.primaryMid, 3);
    rect(s, 'market-left', 650, 272, 110, 36, Theme.gray, 'none', 4);
    rect(s, 'market-mid', 760, 272, 300, 36, Theme.primary, 'none', 4);
    rect(s, 'market-right', 1060, 272, 110, 36, '#C8D5E1', 'none', 4);
    text(s, 'market-left-label', 650, 330, 115, 58, '只要把\n文字放上去', 16, Theme.muted, { align: 'center' });
    text(s, 'market-mid-label', 784, 330, 252, 58, '学校 · 科研院所 · 事业单位\n央国企 · 普通企业', 18, Theme.primary, { align: 'center', bold: true });
    text(s, 'market-right-label', 1060, 330, 110, 58, '高度定制\n视觉创意', 16, Theme.muted, { align: 'center' });
    rect(s, 'market-boundary', 625, 430, 550, 142, Theme.primaryPale, Theme.line, 8);
    text(s, 'market-boundary-head', 654, 452, 490, 28, '目标场景的共同底线', 20, Theme.primary, { bold: true });
    text(s, 'market-boundary-copy', 654, 498, 490, 54, '不能乱，不能丑，不能掉价，\n不能生成完以后无法修改。', 20, Theme.ink, { bold: true });
    notes(s, 3);
  }

  // 4 Reliable line
  {
    const s = deck.slides.add(); chrome(s, '稳定跨过可用线，比偶然惊艳更重要', 4, '“80 分”是稳定可用状态的形象称呼，不是质量上限。');
    text(s, 'reliable-lead', 55, 150, 1150, 36, '工作场景真正需要的是：明早能讲、符合单位风格、第二天还能继续修改。', 22, Theme.ink, { bold: true });
    rect(s, 'reliable-80', 80, 240, 500, 270, Theme.primaryDark, 'none', 8);
    text(s, 'reliable-80-num', 120, 274, 150, 82, '80', 58, Theme.white, { bold: true });
    text(s, 'reliable-80-unit', 274, 300, 150, 32, '稳定可用', 24, '#C9DBEB', { bold: true });
    text(s, 'reliable-80-copy', 120, 390, 380, 80, '直接使用不失专业\n继续修改有可靠基础\n投入与收益相匹配', 20, Theme.white, { lineSpacing: 1.18 });
    rect(s, 'reliable-95', 700, 240, 500, 270, Theme.gray, Theme.line, 8);
    text(s, 'reliable-95-num', 740, 274, 150, 82, '95', 58, Theme.muted, { bold: true });
    text(s, 'reliable-95-unit', 894, 300, 200, 32, '随机惊艳', 24, Theme.muted, { bold: true });
    text(s, 'reliable-95-copy', 740, 390, 400, 80, '偶尔生成让人惊叹的作品\n但不保证适配普通工作\n也不保证可持续修改', 20, Theme.ink, { lineSpacing: 1.18 });
    text(s, 'reliable-quote', 80, 564, 1120, 42, '对工作来说，稳定的 80 分，很多时候比随机的 95 分更值钱。', 24, Theme.primary, { bold: true, align: 'center' });
    notes(s, 4);
  }

  // 5 Constraint tradeoff
  {
    const s = deck.slides.add(); chrome(s, '用限制自由换取可靠性', 5, '正式工作更需要可预测：确定规范、能力边界与退化方式。');
    text(s, 'constraint-lead', 55, 150, 1130, 34, '自由度越高，理论上限越高；状态空间越大，失败模式也随之增加。', 21, Theme.ink, { bold: true });
    const a = rect(s, 'freedom-box', 80, 244, 260, 174, Theme.gray, Theme.line, 8);
    text(s, 'freedom-title', 110, 316, 200, 30, '每次都重来', 24, Theme.muted, { bold: true, align: 'center' });
    text(s, 'freedom-body', 110, 354, 200, 54, '颜色 · 字体\n结构 · 版式 · 风格', 18, Theme.ink, { align: 'center' });
    const b = rect(s, 'failure-box', 458, 244, 300, 174, Theme.primaryPale, Theme.line, 8);
    text(s, 'failure-title', 488, 316, 240, 30, '状态空间变大', 24, Theme.primary, { bold: true, align: 'center' });
    text(s, 'failure-body', 488, 354, 240, 54, '失败模式增加\n结果更难预测', 18, Theme.ink, { align: 'center' });
    const c = rect(s, 'bounded-box', 878, 244, 320, 174, Theme.primaryDark, 'none', 8);
    text(s, 'bounded-title', 908, 316, 260, 30, '主动限制自由', 24, Theme.white, { bold: true, align: 'center' });
    text(s, 'bounded-body', 908, 354, 260, 54, '规范 · 经验证能力\n容量边界 · 退化方式', 18, Theme.white, { align: 'center' });
    arrow(s, 'freedom-to-failure', a, b);
    arrow(s, 'failure-to-bounded', b, c);
    rect(s, 'constraint-bottom', 80, 478, 1118, 118, Theme.primaryPale, Theme.line, 8);
    text(s, 'constraint-bottom-head', 112, 504, 1000, 28, '这不是做不到自由，而是正式工作更需要可预测。', 21, Theme.primary, { bold: true });
    text(s, 'constraint-bottom-copy', 112, 548, 1000, 30, '学校、企业和团队各有长期形成的样子；固定往往意味着已经验证过。', 18, Theme.ink);
    notes(s, 5);
  }

  // 6 Controller
  {
    const s = deck.slides.add(); chrome(s, 'AI 负责理解和路由，规则约束，代码稳定生成', 6, 'PPagenT 把“生成一套 PPT”重新定义为受控的协同过程。');
    const x = [70, 425, 780]; const ws = 280;
    const n1 = rect(s, 'role-content', x[0], 218, ws, 170, Theme.primaryPale, Theme.line, 8);
    const n2 = rect(s, 'role-visual', x[1], 218, ws, 170, Theme.primaryLight, Theme.line, 8);
    const n3 = rect(s, 'role-code', x[2], 218, ws, 170, Theme.primaryDark, 'none', 8);
    text(s, 'role-content-title', x[0] + 24, 246, 232, 30, '内容导演', 24, Theme.primary, { bold: true, align: 'center' });
    text(s, 'role-content-body', x[0] + 24, 300, 232, 58, '理解稿件 · 组织叙事\n拆页 · 形成页面内容', 18, Theme.ink, { align: 'center' });
    text(s, 'role-visual-title', x[1] + 24, 246, 232, 30, '视觉导演', 24, Theme.primary, { bold: true, align: 'center' });
    text(s, 'role-visual-body', x[1] + 24, 300, 232, 58, '判断表达方式\n选择已确认的结构', 18, Theme.ink, { align: 'center' });
    text(s, 'role-code-title', x[2] + 24, 246, 232, 30, '确定性代码', 24, Theme.white, { bold: true, align: 'center' });
    text(s, 'role-code-body', x[2] + 24, 300, 232, 58, '约束与选择\n稳定生成原生可编辑 PPTX', 18, Theme.white, { align: 'center' });
    arrow(s, 'content-to-visual', n1, n2);
    arrow(s, 'visual-to-code', n2, n3);
    rect(s, 'controller-support', 70, 462, 990, 126, Theme.white, Theme.line, 8);
    text(s, 'controller-support-head', 102, 490, 250, 28, '系统共同约束', 20, Theme.primary, { bold: true });
    text(s, 'controller-support-copy', 102, 532, 900, 46, '主题：组织字体、颜色、Logo、页眉页脚与页面骨架  ·  能力库：并列、顺序、对比、层级、循环  ·  无合适结构：退回简单文字排版', 18, Theme.ink);
    text(s, 'controller-quote', 80, 624, 1120, 32, 'AI 读懂稿子，然后调用人已经提前做好的好东西。', 22, Theme.primary, { bold: true, align: 'center' });
    notes(s, 6);
  }

  // 7 Architecture
  {
    const s = deck.slides.add(); chrome(s, '建设能力，再稳定调用', 7, '两条路线的唯一交汇点，是经过用户确认的核心资产库。');
    rect(s, 'lane-build', 55, 154, 510, 330, Theme.primaryPale, Theme.line, 8);
    rect(s, 'lane-run', 715, 154, 510, 330, Theme.white, Theme.line, 8);
    text(s, 'lane-build-title', 85, 180, 430, 28, '资产入库线', 22, Theme.primary, { bold: true });
    text(s, 'lane-run-title', 745, 180, 430, 28, '正式生成线', 22, Theme.primary, { bold: true });
    const b1 = rect(s, 'build-ref', 90, 245, 180, 58, Theme.white, Theme.line, 6);
    const b2 = rect(s, 'build-rule', 315, 245, 180, 58, Theme.white, Theme.line, 6);
    const b3 = rect(s, 'build-pack', 90, 352, 180, 58, Theme.white, Theme.line, 6);
    const b4 = rect(s, 'build-confirm', 315, 352, 180, 58, Theme.primary, 'none', 6);
    text(s, 'build-ref-t', 100, 263, 160, 24, '优秀参考', 18, Theme.ink, { align: 'center' });
    text(s, 'build-rule-t', 325, 263, 160, 24, '提炼规律', 18, Theme.ink, { align: 'center' });
    text(s, 'build-pack-t', 100, 370, 160, 24, '可复用能力', 18, Theme.ink, { align: 'center' });
    text(s, 'build-confirm-t', 325, 370, 160, 24, '用户确认', 18, Theme.white, { align: 'center', bold: true });
    arrow(s, 'build-ref-rule', b1, b2);
    arrow(s, 'build-rule-pack', b2, b3, 'bottom', 'top');
    arrow(s, 'build-pack-confirm', b3, b4);
    const r1 = rect(s, 'run-input', 750, 245, 180, 58, Theme.primaryPale, Theme.line, 6);
    const r2 = rect(s, 'run-ai', 975, 245, 180, 58, Theme.primaryPale, Theme.line, 6);
    const r3 = rect(s, 'run-choice', 750, 352, 180, 58, Theme.primaryPale, Theme.line, 6);
    const r4 = rect(s, 'run-compile', 975, 352, 180, 58, Theme.primaryDark, 'none', 6);
    text(s, 'run-input-t', 760, 263, 160, 24, '稿件 + 主题', 18, Theme.ink, { align: 'center' });
    text(s, 'run-ai-t', 985, 263, 160, 24, 'AI 理解编排', 18, Theme.ink, { align: 'center' });
    text(s, 'run-choice-t', 760, 370, 160, 24, '选择核心能力', 18, Theme.ink, { align: 'center' });
    text(s, 'run-compile-t', 985, 370, 160, 24, '排版与编译', 18, Theme.white, { align: 'center', bold: true });
    arrow(s, 'run-input-ai', r1, r2);
    arrow(s, 'run-ai-choice', r2, r3, 'bottom', 'top');
    arrow(s, 'run-choice-compile', r3, r4);
    const core = rect(s, 'core-library', 555, 236, 170, 178, Theme.primaryDark, 'none', 8);
    text(s, 'core-library-title', 577, 264, 126, 58, '核心\n资产库', 26, Theme.white, { bold: true, align: 'center', lineSpacing: 1.05 });
    text(s, 'core-library-copy', 577, 346, 126, 42, '只读调用', 17, '#DCE8F2', { align: 'center' });
    arrow(s, 'confirm-to-core', b4, core, 'right', 'left');
    arrow(s, 'core-to-choice', core, r3, 'right', 'left', true);
    text(s, 'arch-note', 85, 500, 1080, 42, '若缺少对应 Logic 或 Structure Group，只说明缺口与页面；是否启动入库任务由用户决定。', 17, Theme.muted);
    notes(s, 7);
  }

  // 8 Cost shift
  {
    const s = deck.slides.add(); chrome(s, '把昂贵的计算前移，运行时保持轻量', 8, '一次建设，多次复用：视觉理解从在线成本变成可复用的离线资产。');
    text(s, 'cost-top-label', 80, 155, 300, 28, '传统生成式路线', 21, Theme.muted, { bold: true });
    text(s, 'cost-bottom-label', 80, 370, 300, 28, 'PPagenT 路线', 21, Theme.primary, { bold: true });
    const old = [];
    const nw = [];
    const labelsOld = ['每个用户', '重新理解', '重新设计', '重新绘制'];
    const labelsNew = ['筛选参考', '参数化与验证', '用户确认', '反复调用'];
    [80, 340, 600, 860].forEach((xx, i) => {
      old.push(rect(s, `old-${i}`, xx, 210, 200, 64, Theme.gray, Theme.line, 6));
      nw.push(rect(s, `new-${i}`, xx, 425, 200, 64, i === 3 ? Theme.primaryDark : Theme.primaryPale, i === 3 ? 'none' : Theme.line, 6));
      text(s, `old-t-${i}`, xx + 10, 230, 180, 22, labelsOld[i], 18, Theme.ink, { align: 'center' });
      text(s, `new-t-${i}`, xx + 10, 445, 180, 22, labelsNew[i], 18, i === 3 ? Theme.white : Theme.ink, { align: 'center', bold: i === 3 });
    });
    for (let i = 0; i < 3; i++) { arrow(s, `old-arrow-${i}`, old[i], old[i + 1]); arrow(s, `new-arrow-${i}`, nw[i], nw[i + 1]); }
    rect(s, 'cost-old-risk', 80, 292, 980, 36, '#FAFBFC', 'none', 4);
    text(s, 'cost-old-risk-t', 96, 300, 940, 22, '计算、审美判断与失败风险集中在运行时', 16, Theme.muted);
    rect(s, 'cost-new-note', 80, 520, 980, 78, Theme.primaryPale, Theme.line, 6);
    text(s, 'cost-new-note-t', 104, 542, 930, 38, '模型主要理解、分类、路由和填参；确定性代码负责绘制与检查。视觉模型可用于建设期，但不是每次交付的必要成本。', 18, Theme.ink);
    notes(s, 8);
  }

  // 9 Capability moat
  {
    const s = deck.slides.add(); chrome(s, '真正积累的不是一万个模板', 9, '静态模板会被内容数量与字数变化击穿；可验证的表达规律才会复用。');
    rect(s, 'capability-core', 410, 225, 460, 210, Theme.primaryDark, 'none', 8);
    text(s, 'capability-core-title', 450, 262, 380, 44, '经过验证的表达能力包', 28, Theme.white, { bold: true, align: 'center' });
    text(s, 'capability-core-copy', 466, 334, 348, 56, '把一件漂亮作品\n变成一种可复用的能力', 22, '#DCE8F2', { align: 'center', lineSpacing: 1.1 });
    addMetric(s, 'cap-route', 72, 190, 278, 116, '可靠路由', '新内容 → 正确能力');
    addMetric(s, 'cap-capacity', 930, 190, 278, 116, '容量与变化', '数量变化 → 稳定重排');
    addMetric(s, 'cap-boundary', 72, 414, 278, 116, '失败边界', '超出边界 → 换样式 / 拆页 / 退化');
    addMetric(s, 'cap-output', 930, 414, 278, 116, '交付结果', '符合规范 · 原生可编辑', Theme.primaryLight, Theme.primary);
    rule(s, 'cap-line-left-top', 350, 248, 60, Theme.primaryMid, 2);
    rule(s, 'cap-line-right-top', 870, 248, 60, Theme.primaryMid, 2);
    rule(s, 'cap-line-left-bottom', 350, 470, 60, Theme.primaryMid, 2);
    rule(s, 'cap-line-right-bottom', 870, 470, 60, Theme.primaryMid, 2);
    text(s, 'cap-example', 410, 486, 460, 68, '三个观点 → 四个观点\n十个字 → 六十个字', 18, Theme.muted, { align: 'center' });
    notes(s, 9);
  }

  // 10 Expansion
  {
    const s = deck.slides.add(); chrome(s, '从一个学校，走向更多组织', 10, '首个场景验证边界，主题替换身份，能力继续复用。');
    const org = rect(s, 'org-neu', 72, 235, 270, 176, Theme.primaryDark, 'none', 8);
    text(s, 'org-neu-title', 102, 270, 210, 30, '东北大学', 26, Theme.white, { bold: true, align: 'center' });
    text(s, 'org-neu-copy', 104, 324, 206, 56, '明确视觉规范\n持续汇报需求 · 可检验边界', 18, Theme.white, { align: 'center' });
    const theme = rect(s, 'org-theme', 478, 215, 324, 214, Theme.primaryPale, Theme.line, 8);
    text(s, 'org-theme-title', 514, 248, 252, 30, '主题配置', 24, Theme.primary, { bold: true, align: 'center' });
    text(s, 'org-theme-copy', 520, 306, 240, 86, '颜色 · Logo · 字体\n页眉页脚 · 页面骨架', 20, Theme.ink, { align: 'center', lineSpacing: 1.15 });
    const targets = rect(s, 'org-targets', 936, 182, 270, 280, Theme.white, Theme.line, 8);
    text(s, 'org-target-title', 970, 214, 200, 30, '可服务组织', 24, Theme.primary, { bold: true, align: 'center' });
    text(s, 'org-target-copy', 970, 272, 200, 150, '其他学校\n科研院所 · 实验室\n企业 · 团队\n长期个人风格', 19, Theme.ink, { align: 'center', lineSpacing: 1.15 });
    arrow(s, 'org-to-theme', org, theme);
    arrow(s, 'theme-to-targets', theme, targets);
    rect(s, 'org-bottom', 72, 512, 1134, 92, Theme.primaryLight, Theme.line, 8);
    text(s, 'org-bottom-t', 100, 540, 1080, 38, '把少数人头脑和电脑里的能力，转化为更多人低成本获得的生产能力。', 21, Theme.primary, { bold: true, align: 'center' });
    notes(s, 10);
  }

  // 11 Close
  {
    const s = deck.slides.add(); s.background.fill = Theme.primaryDark;
    text(s, 'close-kicker', 78, 88, 500, 26, 'PPagenT 的普通问题与长期价值', 18, '#C8DBEA', { bold: true });
    text(s, 'close-title', 78, 150, 1030, 90, '把不可预测的生成，\n变成概率上高度可预测的交付。', 40, Theme.white, { bold: true, lineSpacing: 1.06 });
    rule(s, 'close-rule', 80, 282, 170, '#9DB8D1', 4);
    const items = [
      ['靠谱', '不一定惊艳，但能直接拿去讲'],
      ['好用', '不一定独一无二，但真的有价值'],
      ['可持续', '可以立刻讲，也可以继续修改'],
    ];
    items.forEach((it, i) => {
      const xx = 80 + i * 370;
      rect(s, `close-${i}`, xx, 365, 320, 150, Theme.primary, '#6F93B6', 8);
      text(s, `close-${i}-head`, xx + 24, 394, 270, 32, it[0], 26, Theme.white, { bold: true, align: 'center' });
      text(s, `close-${i}-body`, xx + 24, 446, 270, 44, it[1], 18, '#DCE8F2', { align: 'center' });
    });
    text(s, 'close-footer', 80, 630, 1120, 36, '让 AI 读稿子，让规则做判断，让代码完成重复劳动。', 22, '#DCE8F2', { align: 'center' });
    notes(s, 11);
  }

  for (const [index, slide] of deck.slides.items.entries()) {
    const n = index + 1;
    const stem = `slide-${n}`;
    await writeBlob(`${OUT}/${stem}.artifact.png`, await deck.export({ slide, format: 'png', scale: 1 }));
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await (await slide.export({ format: 'layout' })).text());
  }
  await writeBlob(`${OUT}/deck-montage.webp`, await deck.export({ format: 'webp', montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
