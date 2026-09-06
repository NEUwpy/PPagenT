import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = path.resolve('C:/PPagenT/experiments/university-skin-pilot/stability-01/archive-b/round-01');
const W = 1280;
const H = 720;
const FONT = 'Microsoft YaHei';
const C = {
  primary: '#315F91',
  primaryDark: '#23466D',
  primaryMid: '#6F93B7',
  pale: '#EAF1F7',
  pale2: '#F5F8FB',
  ink: '#252B33',
  muted: '#707780',
  line: '#C8D5E1',
  white: '#FFFFFF',
  warn: '#8B5E34',
  warnPale: '#F6EEE6',
};

function writeBlob(file, blob) {
  return blob.arrayBuffer().then(buf => fs.writeFile(file, new Uint8Array(buf)));
}

function addText(slide, name, value, x, y, w, h, size, color = C.ink, opts = {}) {
  const s = slide.shapes.add({
    geometry: 'textbox',
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  s.text = value;
  s.text.style = {
    fontSize: size,
    typeface: FONT,
    color,
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
    alignment: opts.align || 'left',
    verticalAlignment: opts.valign || 'middle',
  };
  s.text.insets = { top: 2, right: 2, bottom: 2, left: 2 };
  return s;
}

function addRect(slide, name, x, y, w, h, fill, line = 'none', radius = 0) {
  const s = slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect',
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: 'solid', fill: line === 'none' ? 'none' : line, width: line === 'none' ? 0 : 1 },
  });
  if (radius) s.borderRadius = radius;
  return s;
}

function addLine(slide, name, x1, y1, x2, y2, color = C.line, width = 2, dash = 'solid') {
  return slide.shapes.add({
    geometry: 'line',
    name,
    position: { left: x1, top: y1, width: x2 - x1, height: y2 - y1 },
    fill: 'none',
    line: { style: dash, fill: color, width },
  });
}

function addHeader(slide, kicker, title, subtitle, pageNo) {
  addText(slide, `kicker-${pageNo}`, kicker.toUpperCase(), 55, 32, 520, 22, 14, C.primary, { bold: true });
  addText(slide, `title-${pageNo}`, title, 55, 58, 970, 48, 32, C.ink, { bold: true });
  if (subtitle) addText(slide, `subtitle-${pageNo}`, subtitle, 55, 108, 1090, 28, 18, C.muted);
  addLine(slide, `header-rule-${pageNo}`, 55, 145, 1225, 145, C.primary, 2);
  addText(slide, `page-${pageNo}`, String(pageNo).padStart(2, '0'), 1182, 32, 43, 24, 14, C.muted, { align: 'right' });
}

function addFooter(slide, pageNo, label = '归档试点讨论稿｜虚构大学场景') {
  addLine(slide, `footer-rule-${pageNo}`, 55, 680, 1225, 680, C.line, 1);
  addText(slide, `footer-${pageNo}`, label, 55, 692, 800, 18, 14, C.muted);
  addText(slide, `footer-page-${pageNo}`, `${pageNo} / 8`, 1160, 692, 65, 18, 14, C.muted, { align: 'right' });
}

function addNode(slide, name, label, x, y, w, h, fill = C.primary, labelName = `${name}-label`, fontSize = 20) {
  const node = addRect(slide, name, x, y, w, h, fill, fill, 18);
  addText(slide, labelName, label, x + 12, y + 12, w - 24, h - 24, fontSize, C.white, { bold: true, align: 'center', valign: 'middle' });
  return node;
}

function addBullet(slide, name, lead, body, x, y, w, h, accent = C.primary) {
  addRect(slide, `${name}-bar`, x, y + 5, 4, h - 10, accent);
  addText(slide, `${name}-lead`, lead, x + 16, y, w - 16, 24, 18, C.ink, { bold: true });
  addText(slide, `${name}-body`, body, x + 16, y + 26, w - 16, h - 26, 16, C.muted);
}

function addSlide1(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addText(slide, 'cover-kicker', '课题组讨论稿 · 归档试点', 55, 54, 500, 24, 16, C.primary, { bold: true });
  addText(slide, 'cover-title', '先让一次实验结果\n可以被理解', 55, 116, 650, 150, 48, C.ink, { bold: true, valign: 'top' });
  addText(slide, 'cover-subtitle', '拟议四周、小范围试点：建立结果、依据与责任边界的可追溯记录', 58, 292, 600, 64, 22, C.muted, { valign: 'top' });
  addRect(slide, 'cover-side', 805, 72, 420, 528, C.pale2, 'none', 22);
  addText(slide, 'cover-side-label', '一次结果要能回答三个问题', 850, 110, 330, 34, 22, C.primaryDark, { bold: true });
  addText(slide, 'cover-rel-1', '结果图', 850, 214, 220, 52, 28, C.primary, { bold: true, align: 'center' });
  addLine(slide, 'cover-rel-line1', 1085, 240, 1144, 240, C.primaryMid, 3);
  addText(slide, 'cover-rel-2', '依据链', 850, 320, 220, 52, 28, C.primary, { bold: true, align: 'center' });
  addLine(slide, 'cover-rel-line2', 1085, 346, 1144, 346, C.primaryMid, 3);
  addText(slide, 'cover-rel-3', '责任边界', 850, 426, 220, 52, 28, C.primary, { bold: true, align: 'center' });
  addText(slide, 'cover-note', '归档工具只是承载方式\n本次试点验证的是三者之间的联系', 850, 520, 330, 56, 16, C.muted, { valign: 'top' });
  addText(slide, 'cover-context', '虚构大学场景｜拟议方案，不代表已实施项目或已有成效', 55, 654, 700, 22, 14, C.muted);
  addText(slide, 'cover-page', '01 / 8', 1160, 654, 65, 22, 14, C.muted, { align: 'right' });
}

function addSlide2(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '为什么要归档', '找到图片，不等于结果可解释', '课题组经常能找到最终图片，却不能快速说明它来自哪批样本、用了哪版脚本。', 2);
  addRect(slide, 's2-evidence', 55, 190, 745, 430, C.pale2, 'none', 18);
  addText(slide, 's2-evidence-title', '同一张图，缺少的不是文件名', 88, 218, 640, 32, 22, C.primaryDark, { bold: true });
  addNode(slide, 's2-image-node', '最终图片', 116, 330, 190, 88, C.primary, 's2-image-label', 22);
  addLine(slide, 's2-arrow1', 306, 374, 383, 374, C.primaryMid, 3);
  addRect(slide, 's2-gap1', 390, 270, 300, 280, C.white, C.line, 14);
  addText(slide, 's2-gap-title', '解释链断在这里', 416, 288, 250, 28, 18, C.primary, { bold: true });
  addBullet(slide, 's2-gap-sample', '样本批次', '无法快速确认这张图对应哪批数据', 416, 326, 248, 64, C.primary);
  addBullet(slide, 's2-gap-script', '脚本版本', '无法定位实际运行的处理代码', 416, 404, 248, 64, C.primary);
  addBullet(slide, 's2-gap-exclude', '排除依据', '只剩“已清理”，判断过程不可见', 416, 482, 248, 64, C.primary);
  addText(slide, 's2-meaning', '文件存在  ≠  结果可以解释', 104, 560, 600, 48, 30, C.primaryDark, { bold: true, align: 'center' });
  addRect(slide, 's2-decision', 844, 190, 381, 430, C.primary, 'none', 18);
  addText(slide, 's2-decision-title', '本次讨论的判断', 878, 224, 310, 30, 22, C.white, { bold: true });
  addText(slide, 's2-decision-body', '归档首先要保存“结果—依据”的关系，随后才讨论扩大共享范围。', 878, 288, 300, 94, 22, C.white, { valign: 'top' });
  addLine(slide, 's2-decision-rule', 878, 414, 1188, 414, '#9DB7D0', 2);
  addText(slide, 's2-decision-note', '同名文件和个人目录让重复检索变难，\n但问题的核心是上下文与责任边界缺失。', 878, 450, 300, 106, 18, '#DCE8F2', { valign: 'top' });
  addFooter(slide, 2);
}

function addSlide3(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '记录单元', '一次可讨论结果，必须保留一条依据链', '五项内容共同解释一个结果；它们是同一记录单元，不是必须依次执行的五个步骤。', 3);
  addRect(slide, 's3-main', 55, 190, 1170, 430, C.pale2, 'none', 18);
  addText(slide, 's3-main-title', '记录单元', 90, 222, 200, 28, 22, C.primaryDark, { bold: true });
  const cx = 520, cy = 330, cw = 240, ch = 110;
  const nodes = [
    ['s3-data', '原始数据位置', 135, 286],
    ['s3-sample', '样本与采集条件', 390, 214],
    ['s3-script', '处理脚本版本', 720, 214],
    ['s3-result', '结果文件', 930, 392],
    ['s3-exception', '异常与排除说明', 270, 470],
  ];
  const center = addRect(slide, 's3-center', cx, cy, cw, ch, C.primary, C.primary, 22);
  for (const [name, label, x, y] of nodes) {
    const node = addRect(slide, name, x, y, 200, 72, C.white, C.primaryMid, 14);
    addText(slide, `${name}-label`, label, x + 12, y + 10, 176, 52, 18, C.primaryDark, { bold: true, align: 'center' });
    slide.shapes.connect(node, center, {
      kind: 'straight',
      fromSide: x < cx ? 'right' : 'left',
      toSide: x < cx ? 'left' : 'right',
      line: { style: 'solid', fill: C.primaryMid, width: 2 },
    });
  }
  addText(slide, 's3-center-label', '可讨论的\n实验结果', cx + 16, cy + 18, cw - 32, ch - 36, 24, C.white, { bold: true, align: 'center' });
  addText(slide, 's3-note', '原始数据保持原貌；清洗与处理另存。\n异常说明保留判断依据；未纳入结果的样本也要解释排除条件。', 760, 514, 405, 64, 16, C.muted, { valign: 'top' });
  addFooter(slide, 3);
}

function addSlide4(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '授权边界', '归档保存关系，也必须保留授权边界', '记录中出现一个路径，不代表其他成员已经取得文件访问权。', 4);
  addRect(slide, 's4-left', 55, 190, 550, 388, C.pale2, 'none', 18);
  addRect(slide, 's4-right', 675, 190, 550, 388, C.warnPale, 'none', 18);
  addText(slide, 's4-left-title', '讨论材料可以包含', 88, 220, 450, 30, 22, C.primaryDark, { bold: true });
  addText(slide, 's4-left-main', '结果图  +  可公开的解释', 88, 288, 470, 58, 30, C.primary, { bold: true });
  addBullet(slide, 's4-left-b1', '结果图', '让成员先看到要复核的结果', 100, 388, 430, 54, C.primary);
  addBullet(slide, 's4-left-b2', '受控引用', '只指向受限原始数据的授权位置', 100, 458, 430, 54, C.primary);
  addText(slide, 's4-right-title', '受限材料仍按原授权管理', 708, 220, 470, 30, 22, C.warn, { bold: true });
  addText(slide, 's4-right-main', '个人信息或合作限制\n不会因归档而改变', 708, 286, 470, 90, 28, C.warn, { bold: true, valign: 'top' });
  addBullet(slide, 's4-right-b1', '原始数据', '继续放在原授权位置', 720, 414, 430, 54, C.warn);
  addBullet(slide, 's4-right-b2', '访问条件', '在记录中写明受控条件，而非开放文件', 720, 484, 430, 54, C.warn);
  addRect(slide, 's4-bottom', 208, 600, 864, 46, C.primary, 'none', 23);
  addText(slide, 's4-bottom-label', '路径 ≠ 访问权　｜　共享前先确认授权', 240, 608, 800, 30, 20, C.white, { bold: true, align: 'center' });
  addFooter(slide, 4);
}

function addSlide5(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '范围选择', '试点先从新增实验开始，历史材料逐项补', '两种推进思路各有边界；建议先选择可掌握的新增实验范围。', 5);
  addRect(slide, 's5-left', 55, 192, 540, 354, C.pale2, 'none', 18);
  addRect(slide, 's5-right', 685, 192, 540, 354, C.pale2, 'none', 18);
  addText(slide, 's5-left-title', '集中补历史档案', 90, 226, 450, 30, 22, C.primaryDark, { bold: true });
  addText(slide, 's5-left-tag', '目录较快变大', 90, 282, 430, 42, 28, C.primary, { bold: true });
  addBullet(slide, 's5-left-b1', '代价', '追查遗失上下文可能耗费大量时间', 104, 360, 430, 56, C.primary);
  addBullet(slide, 's5-left-b2', '风险', '不确定记忆可能被写成确定说明', 104, 432, 430, 56, C.primary);
  addText(slide, 's5-right-title', '先记录新增实验', 720, 226, 450, 30, 22, C.primaryDark, { bold: true });
  addText(slide, 's5-right-tag', '上下文尚清楚', 720, 282, 430, 42, 28, C.primary, { bold: true });
  addBullet(slide, 's5-right-b1', '优势', '新增结果发生时就能留下依据', 734, 360, 430, 56, C.primary);
  addBullet(slide, 's5-right-b2', '边界', '短期内无法解决全部历史追溯问题', 734, 432, 430, 56, C.primary);
  addLine(slide, 's5-scope-arrow', 563, 560, 715, 560, C.primary, 4);
  addText(slide, 's5-scope-note', '先对新增实验试行；真正需要复核的历史结果，再逐项补充。', 90, 570, 1080, 42, 22, C.ink, { bold: true, align: 'center' });
  addText(slide, 's5-boundary', '这是范围选择，不能表述为已经证明新方式更高效。', 90, 620, 1080, 26, 16, C.muted, { align: 'center' });
  addFooter(slide, 5);
}

function addSlide6(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '复核路径', '复核先确认结果如何产生，再进入可讨论版本', '流程先检查可理解性，不要求复做整项实验，也不代替科学结论审查。', 6);
  addRect(slide, 's6-main', 55, 190, 1170, 365, C.pale2, 'none', 18);
  addText(slide, 's6-main-title', '一条可追踪的主路径', 90, 218, 400, 30, 22, C.primaryDark, { bold: true });
  const xs = [92, 318, 544, 770, 996];
  const labels = [
    ['s6-n1', '01', '提交记录', '结果记录\n+ 受控引用'],
    ['s6-n2', '02', '成员复核', '定位数据、脚本\n与条件并提缺项'],
    ['s6-n3', '03', '执行者补充', '补齐缺项与\n异常判断依据'],
    ['s6-n4', '04', '负责人确认', '检查责任边界\n与授权条件'],
    ['s6-n5', '05', '可讨论版本', '记录可被他人\n理解与追溯'],
  ];
  const nodes = [];
  for (let i = 0; i < labels.length; i++) {
    const [name, num, title, body] = labels[i];
    const node = addRect(slide, name, xs[i], 302, 164, 122, i === 4 ? C.primary : C.white, i === 4 ? C.primary : C.primaryMid, 16);
    nodes.push(node);
    addText(slide, `${name}-num`, num, xs[i] + 12, 318, 42, 28, 16, i === 4 ? '#DCE8F2' : C.primary, { bold: true, align: 'left' });
    addText(slide, `${name}-title`, title, xs[i] + 12, 347, 140, 26, 20, i === 4 ? C.white : C.primaryDark, { bold: true, align: 'center' });
    addText(slide, `${name}-body`, body, xs[i] + 12, 378, 140, 38, 15, i === 4 ? '#DCE8F2' : C.muted, { align: 'center' });
  }
  for (let i = 0; i < nodes.length - 1; i++) {
    slide.shapes.connect(nodes[i], nodes[i + 1], {
      kind: 'straight', fromSide: 'right', toSide: 'left',
      line: { style: 'solid', fill: C.primaryMid, width: 3 },
      head: { type: 'triangle', width: 'sm', length: 'sm' },
    });
  }
  addRect(slide, 's6-gate', 314, 482, 652, 50, C.warnPale, C.warn, 14);
  addText(slide, 's6-gate-label', '若涉及新的访问授权：暂停共享 → 负责人处理授权 → 再继续', 334, 492, 612, 30, 18, C.warn, { bold: true, align: 'center' });
  addFooter(slide, 6);
}

function addSlide7(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '四周试点', '四周试点只验证一件事：记录能否支撑复核', '拟定范围：一个课题方向、两名自愿成员、记录新增实验；所有数字都是方案设定。', 7);
  addRect(slide, 's7-scope', 55, 190, 1170, 78, C.primary, 'none', 18);
  addText(slide, 's7-scope-label', '一个课题方向', 90, 214, 300, 30, 22, C.white, { bold: true, align: 'center' });
  addLine(slide, 's7-scope-l1', 405, 210, 405, 248, '#9DB7D0', 2);
  addText(slide, 's7-scope-label2', '两名自愿成员', 470, 214, 300, 30, 22, C.white, { bold: true, align: 'center' });
  addLine(slide, 's7-scope-l2', 785, 210, 785, 248, '#9DB7D0', 2);
  addText(slide, 's7-scope-label3', '记录新增实验', 850, 214, 300, 30, 22, C.white, { bold: true, align: 'center' });
  addLine(slide, 's7-rail-1', 142, 398, 204, 398, C.primaryMid, 4);
  addLine(slide, 's7-rail-2', 268, 398, 488, 398, C.primaryMid, 4);
  addLine(slide, 's7-rail-3', 552, 398, 772, 398, C.primaryMid, 4);
  addLine(slide, 's7-rail-4', 836, 398, 1056, 398, C.primaryMid, 4);
  addLine(slide, 's7-rail-5', 1120, 398, 1138, 398, C.primaryMid, 4);
  const weeks = [
    ['s7-w1', '第一周', '共同明确最少字段', '用一个结果试填'],
    ['s7-w2', '第二周', '在实际工作中记录', '发现缺项与填写负担'],
    ['s7-w3', '第三周', '继续实际记录', '收集复核过程与反馈'],
    ['s7-w4', '第四周', '讨论下一步', '保留、修改或停止'],
  ];
  const wx = [118, 402, 686, 970];
  for (let i = 0; i < weeks.length; i++) {
    const [name, week, title, body] = weeks[i];
    addRect(slide, `${name}-dot`, wx[i] + 86, 366, 64, 64, C.primary, C.primary, 32);
    addText(slide, `${name}-num`, String(i + 1), wx[i] + 94, 384, 48, 28, 18, C.white, { bold: true, align: 'center' });
    addText(slide, `${name}-week`, week, wx[i], 300, 236, 30, 22, C.primaryDark, { bold: true, align: 'center' });
    addText(slide, `${name}-title`, title, wx[i], 452, 236, 30, 18, C.ink, { bold: true, align: 'center' });
    addText(slide, `${name}-body`, body, wx[i], 490, 236, 44, 16, C.muted, { align: 'center' });
  }
  addText(slide, 's7-boundary', '四周、两人和周次安排是拟定范围；没有实测效率提升或完成率数字。', 90, 585, 1100, 28, 18, C.muted, { align: 'center' });
  addFooter(slide, 7);
}

function addSlide8(pres) {
  const slide = pres.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, '评估与决策', '先看复核过程，再决定保留、修改或停止', '试点结束时不先给统一“合格分数”，而是依据真实复核过程与成员反馈作决定。', 8);
  addRect(slide, 's8-eval', 55, 190, 680, 410, C.pale2, 'none', 18);
  addText(slide, 's8-eval-title', '评估回答三个问题', 90, 220, 560, 30, 22, C.primaryDark, { bold: true });
  addBullet(slide, 's8-q1', '来源', '其他成员能否沿记录定位结果的来源？', 94, 286, 570, 64, C.primary);
  addBullet(slide, 's8-q2', '依据', '关键处理与排除是否有可理解的依据？', 94, 374, 570, 64, C.primary);
  addBullet(slide, 's8-q3', '负担', '记录负担是否在成员愿意持续承担的范围内？', 94, 462, 570, 64, C.primary);
  addText(slide, 's8-method', '收集具体复核过程和当事人反馈。字段填满却找不到脚本版本，不能算追溯问题已解决。', 94, 550, 570, 36, 16, C.muted, { valign: 'top' });
  addRect(slide, 's8-decision', 780, 190, 445, 410, C.primary, 'none', 18);
  addText(slide, 's8-decision-title', '开始与停止信号', 814, 220, 380, 30, 22, C.white, { bold: true });
  addText(slide, 's8-start', '开始前确认', 814, 278, 340, 26, 18, '#DCE8F2', { bold: true });
  addText(slide, 's8-start-body', '负责人确认范围与授权联系人；成员认可最少字段；确定复核负责人。', 814, 306, 340, 66, 17, C.white, { valign: 'top' });
  addLine(slide, 's8-sep', 814, 394, 1190, 394, '#9DB7D0', 2);
  addText(slide, 's8-stop', '出现这些信号就收缩', 814, 416, 340, 26, 18, '#DCE8F2', { bold: true });
  addText(slide, 's8-stop-body', '持续挤占实验时间；权限边界无法说明；重复抄写却没有帮助解释结果。', 814, 446, 340, 58, 17, C.white, { valign: 'top' });
  addText(slide, 's8-close', '先让一次结果可以被理解，再决定哪些记录值得长期保存。', 90, 626, 1100, 30, 22, C.primaryDark, { bold: true, align: 'center' });
  addFooter(slide, 8, '归档工具只是承载方式｜关系与责任边界才是试点要验证的内容');
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const pres = Presentation.create({ slideSize: { width: W, height: H } });
  addSlide1(pres);
  addSlide2(pres);
  addSlide3(pres);
  addSlide4(pres);
  addSlide5(pres);
  addSlide6(pres);
  addSlide7(pres);
  addSlide8(pres);
  for (let i = 0; i < pres.slides.items.length; i++) {
    const slide = pres.slides.items[i];
    const stem = `slide-${i + 1}`;
    const layout = await slide.export({ format: 'layout' });
    await fs.writeFile(path.join(OUT, `${stem}.layout.json`), await layout.text());
  }
  const pptx = await PresentationFile.exportPptx(pres);
  await pptx.save(path.join(OUT, 'deck.pptx'));
}

main().catch(err => { console.error(err); process.exitCode = 1; });
