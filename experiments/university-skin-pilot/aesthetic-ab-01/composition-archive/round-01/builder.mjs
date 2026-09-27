import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/composition-archive/round-01';
const W = 1280;
const H = 720;
const FONT = 'Microsoft YaHei';
const C = {
  primary: '#315F91',
  ink: '#252B33',
  muted: '#707780',
  bg: '#FFFFFF',
  pale: '#F6F8FB',
  lightBlue: '#EAF1F8',
  line: '#D4DCE6',
  soft: '#EDF2F7',
  white: '#FFFFFF',
};
const roles = {
  cover: { fontSize: 44, bold: true },
  claim: { fontSize: 30, bold: true },
  group: { fontSize: 21, bold: true },
  body: { fontSize: 18, bold: false },
  note: { fontSize: 16, bold: false },
  footer: { fontSize: 12, bold: false },
  metric: { fontSize: 36, bold: true },
};

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
const textRoles = [];
const linePaths = [];
const connections = [];
const nodePairs = {};
let pageNo = 0;

function addShape(slide, geometry, name, position, fill = 'none', line = { style: 'solid', fill: 'none', width: 0 }, extra = {}) {
  return slide.shapes.add({ geometry, name, position, fill, line, ...extra });
}

function addText(slide, name, text, position, role, opts = {}) {
  const shape = addShape(slide, 'textbox', name, position, 'none', { style: 'solid', fill: 'none', width: 0 });
  shape.text = text;
  shape.text.style = {
    fontSize: roles[role].fontSize,
    bold: roles[role].bold,
    color: opts.color || C.ink,
    typeface: FONT,
    alignment: opts.alignment || 'left',
    verticalAlignment: opts.verticalAlignment || 'top',
    lineSpacing: opts.lineSpacing || 1.4,
    wrap: 'square',
    autoFit: 'none',
    insets: opts.insets || { top: 0, right: 0, bottom: 0, left: 0 },
  };
  textRoles.push({ page: pageNo, shapeId: shape.id, name, role, declaredFontSize: roles[role].fontSize, declaredBold: roles[role].bold, text });
  return shape;
}

function addRect(slide, name, position, fill, lineFill = 'none', width = 0, extra = {}) {
  return addShape(slide, 'rect', name, position, fill, { style: 'solid', fill: lineFill, width }, extra);
}

function addRoundRect(slide, name, position, fill, lineFill = C.line, width = 1, extra = {}) {
  return addShape(slide, 'roundRect', name, position, fill, { style: 'solid', fill: lineFill, width }, { borderRadius: 12, ...extra });
}

function addLine(slide, name, x1, y1, x2, y2, relationshipObject = 'divider', color = C.line, width = 1) {
  const line = addShape(slide, 'line', name, { left: x1, top: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) }, 'none', { style: 'solid', fill: color, width });
  linePaths.push({ page: pageNo, shapeId: line.id, name, x1, y1, x2, y2, relationshipObject, isDivider: relationshipObject === 'divider' });
  return line;
}

function addFooter(slide, label = '虚构大学场景 · 讨论稿') {
  addLine(slide, `p${pageNo}-footer-rule`, 55, 682, 1225, 682, 'footer divider', C.line, 1);
  addText(slide, `p${pageNo}-footer-label`, label, { left: 55, top: 689, width: 420, height: 20 }, 'footer', { color: C.muted });
  addText(slide, `p${pageNo}-footer-page`, String(pageNo).padStart(2, '0'), { left: 1180, top: 687, width: 45, height: 20 }, 'footer', { color: C.muted, alignment: 'right' });
}

function addHeader(slide, title, kicker = '') {
  addText(slide, `p${pageNo}-title`, title, { left: 55, top: 38, width: 970, height: 46 }, 'claim', { color: C.ink, lineSpacing: 1.1 });
  if (kicker) addText(slide, `p${pageNo}-kicker`, kicker, { left: 1080, top: 51, width: 145, height: 24 }, 'note', { color: C.primary, alignment: 'right' });
  addLine(slide, `p${pageNo}-title-rule`, 55, 112, 1225, 112, 'title divider', C.line, 1);
}

function pair(page, titleShape, bodyShape, relation = 'node title and explanation') {
  if (!nodePairs[page]) nodePairs[page] = [];
  nodePairs[page].push({ node: titleShape.name, titleLabel: titleShape.id, explanationLabels: [bodyShape.id], relation });
}

function newSlide() {
  const slide = presentation.slides.add();
  pageNo += 1;
  slide.background.fill = C.bg;
  return slide;
}

// 1 — cover
{
  const slide = newSlide();
  slide.background.fill = C.pale;
  addRect(slide, 'p1-primary-rail', { left: 55, top: 105, width: 8, height: 425 }, C.primary);
  addText(slide, 'p1-cover-title', '先把一次结果\n说明白', { left: 94, top: 154, width: 720, height: 150 }, 'cover', { lineSpacing: 1.05 });
  addText(slide, 'p1-cover-subtitle', '四周小范围归档试点讨论稿', { left: 98, top: 338, width: 600, height: 34 }, 'group', { color: C.primary });
  addText(slide, 'p1-cover-audience', '面向课题组教师与研究生\n目标：讨论一项有限尝试，而非宣布成效', { left: 98, top: 410, width: 570, height: 70 }, 'note', { color: C.muted, lineSpacing: 1.45 });
  addText(slide, 'p1-cover-relation', '结果  ↔  依据  ↔  责任边界', { left: 815, top: 258, width: 365, height: 42 }, 'group', { color: C.primary, alignment: 'center' });
  addLine(slide, 'p1-relation-rule', 848, 331, 1150, 331, 'cover relation guide', C.primary, 2);
  addText(slide, 'p1-cover-footnote', '虚构大学场景 · 原稿事实范围内的方案讨论', { left: 815, top: 355, width: 365, height: 40 }, 'note', { color: C.muted, alignment: 'center' });
  addText(slide, 'p1-cover-page', '01', { left: 1180, top: 687, width: 45, height: 20 }, 'footer', { color: C.muted, alignment: 'right' });
}

// 2 — problem and lens
{
  const slide = newSlide();
  addHeader(slide, '文件存在，不等于结果可以解释', '问题界定');
  addText(slide, 'p2-lead', '课题组讨论一张实验曲线时，最先缺的往往不是文件，而是文件与依据之间的联系。', { left: 55, top: 145, width: 1085, height: 38 }, 'note', { color: C.muted });
  addText(slide, 'p2-left-label', '找到最终图片', { left: 55, top: 221, width: 490, height: 34 }, 'group', { color: C.primary });
  const p2left = addText(slide, 'p2-left-body', '经常能找到最终图片，却不能快速说明图片来自哪批样本、用了哪版脚本、哪些数据被排除。', { left: 55, top: 273, width: 495, height: 110 }, 'body', { lineSpacing: 1.45 });
  addLine(slide, 'p2-center-rule', 625, 210, 625, 420, 'comparison divider', C.line, 1);
  addText(slide, 'p2-right-label', '说明结果如何产生', { left: 700, top: 221, width: 500, height: 34 }, 'group', { color: C.primary });
  const p2right = addText(slide, 'p2-right-body', '归档首先保存结果和依据之间的关系，随后才讨论扩大共享范围。文件存在，不等于结果可以解释。', { left: 700, top: 273, width: 500, height: 110 }, 'body', { lineSpacing: 1.45 });
  addLine(slide, 'p2-bottom-rule', 55, 490, 1225, 490, 'claim separator', C.primary, 2);
  addText(slide, 'p2-bottom-label', '本次讨论聚焦', { left: 55, top: 522, width: 190, height: 32 }, 'group', { color: C.primary });
  addText(slide, 'p2-bottom-body', '建立能够解释实验结果的数据归档习惯。', { left: 285, top: 522, width: 690, height: 34 }, 'body', { color: C.ink });
  addFooter(slide);
}

// 3 — record unit
{
  const slide = newSlide();
  addHeader(slide, '一个记录单元，把结果和依据绑在一起', '记录结构');
  addText(slide, 'p3-lead', '一次可讨论的实验结果，不是一个孤立文件，而是一组共同解释它的记录。', { left: 55, top: 145, width: 950, height: 34 }, 'note', { color: C.muted });
  addRect(slide, 'p3-record-surface', { left: 55, top: 194, width: 1170, height: 410 }, C.pale);
  addText(slide, 'p3-record-label', '一次可讨论的实验结果', { left: 85, top: 220, width: 420, height: 34 }, 'group', { color: C.primary });
  const items = [
    ['原始数据位置', '保持原始数据原貌，并能定位存放位置。'],
    ['样本与采集条件', '说明这批样本及其采集条件。'],
    ['处理脚本版本', '能够定位实际运行的代码版本。'],
    ['结果文件', '与本次讨论的结果图建立对应。'],
    ['异常与排除说明', '保留判断依据，解释哪些样本未纳入结果。'],
  ];
  const coords = [[85, 278], [645, 278], [85, 395], [645, 395], [85, 512]];
  items.forEach(([label, body], i) => {
    const [x, y] = coords[i];
    addLine(slide, `p3-item-${i + 1}-accent`, x, y + 4, x + 6, y + 62, 'record item accent', C.primary, 3);
    const t = addText(slide, `p3-item-${i + 1}-title`, label, { left: x + 20, top: y, width: 450, height: 30 }, 'group', { color: C.ink, lineSpacing: 1.1 });
    const b = addText(slide, `p3-item-${i + 1}-body`, body, { left: x + 20, top: y + 38, width: 470, height: 48 }, 'body', { color: C.muted, lineSpacing: 1.3 });
    pair(pageNo, t, b, 'record field and its explanation');
  });
  addLine(slide, 'p3-bottom-rule', 55, 616, 1225, 616, 'record scope divider', C.line, 1);
  addText(slide, 'p3-bottom-note', '这几项共同解释一个结果，并不是必须依次执行的五个步骤。', { left: 55, top: 635, width: 900, height: 28 }, 'note', { color: C.muted });
  addFooter(slide);
}

// 4 — access boundary
{
  const slide = newSlide();
  addHeader(slide, '记录完整，不会自动扩大访问权', '权限边界');
  addText(slide, 'p4-lead', '归档要让结果可理解，同时保留原有授权边界。', { left: 55, top: 145, width: 700, height: 34 }, 'note', { color: C.muted });
  addRect(slide, 'p4-analysis-band', { left: 55, top: 205, width: 1170, height: 220 }, C.pale);
  addText(slide, 'p4-public-label', '讨论材料', { left: 90, top: 238, width: 430, height: 34 }, 'group', { color: C.primary });
  const p4a = addText(slide, 'p4-public-body', '结果图和可公开的解释可以进入讨论材料。', { left: 90, top: 291, width: 430, height: 70 }, 'body', { lineSpacing: 1.45 });
  addLine(slide, 'p4-mid-rule', 625, 228, 625, 403, 'access comparison divider', C.line, 1);
  addText(slide, 'p4-restricted-label', '受限原始数据', { left: 700, top: 238, width: 450, height: 34 }, 'group', { color: C.primary });
  const p4b = addText(slide, 'p4-restricted-body', '仍放在原授权位置；记录中只保留受控引用和访问条件。', { left: 700, top: 291, width: 450, height: 70 }, 'body', { lineSpacing: 1.45 });
  pair(pageNo, addText(slide, 'p4-public-node-label', '可公开的解释', { left: 90, top: 370, width: 200, height: 24 }, 'note', { color: C.primary }), p4a, 'access condition');
  pair(pageNo, addText(slide, 'p4-restricted-node-label', '受控引用', { left: 700, top: 370, width: 200, height: 24 }, 'note', { color: C.primary }), p4b, 'access condition');
  addRect(slide, 'p4-boundary-band', { left: 55, top: 479, width: 1170, height: 117 }, C.lightBlue);
  addText(slide, 'p4-boundary-label', '路径 ≠ 授权', { left: 85, top: 508, width: 240, height: 34 }, 'group', { color: C.primary });
  addText(slide, 'p4-boundary-body', '记录表中出现一个路径，也不代表其他成员已经取得访问权。涉及个人信息或合作限制的内容，不能因为归档而改变授权。', { left: 350, top: 502, width: 820, height: 64 }, 'body', { lineSpacing: 1.35 });
  addFooter(slide);
}

// 5 — option comparison
{
  const slide = newSlide();
  addHeader(slide, '新增实验优先，能保留清楚上下文；历史补档仍要逐项判断', '范围取舍');
  addText(slide, 'p5-lead', '两种推进思路的差别，关键在于上下文是否仍清楚，以及短期能覆盖到什么。', { left: 55, top: 145, width: 1030, height: 34 }, 'note', { color: C.muted });
  const xLabel = 55, xA = 270, xB = 770, wLabel = 170, wCol = 405;
  addText(slide, 'p5-dim-header', '共同维度', { left: xLabel, top: 210, width: wLabel, height: 30 }, 'group', { color: C.muted });
  addRect(slide, 'p5-a-header-bg', { left: xA, top: 198, width: wCol, height: 58 }, C.soft);
  addRect(slide, 'p5-b-header-bg', { left: xB, top: 198, width: wCol, height: 58 }, C.lightBlue);
  addText(slide, 'p5-a-header', '集中补历史档案', { left: xA + 20, top: 212, width: wCol - 40, height: 30 }, 'group', { color: C.ink });
  addText(slide, 'p5-b-header', '先从新增实验开始', { left: xB + 20, top: 212, width: wCol - 40, height: 30 }, 'group', { color: C.primary });
  const rows = [
    ['能得到什么', '一次形成较大的目录。', '在上下文尚清楚时记录。'],
    ['主要代价', '追查遗失上下文耗时，也可能把不确定记忆写成确定说明。', '短期内无法解决全部历史材料的追溯问题。'],
    ['使用方式', '不宜一口气覆盖历史。', '先对新增实验试行；真正需要复核的历史结果逐项补充。'],
  ];
  rows.forEach((row, i) => {
    const y = 286 + i * 93;
    addLine(slide, `p5-row-${i + 1}-rule`, 55, y - 18, 1225, y - 18, 'comparison row divider', C.line, 1);
    addText(slide, `p5-row-${i + 1}-label`, row[0], { left: xLabel, top: y, width: wLabel, height: 28 }, 'group', { color: C.primary, lineSpacing: 1.1 });
    const a = addText(slide, `p5-row-${i + 1}-a`, row[1], { left: xA + 20, top: y, width: wCol - 35, height: 60 }, 'body', { lineSpacing: 1.35 });
    const b = addText(slide, `p5-row-${i + 1}-b`, row[2], { left: xB + 20, top: y, width: wCol - 35, height: 60 }, 'body', { lineSpacing: 1.35 });
  });
  addLine(slide, 'p5-bottom-rule', 55, 582, 1225, 582, 'comparison scope divider', C.primary, 2);
  addText(slide, 'p5-bottom-note', '建议先对新增实验试行。这是一种范围选择，不能表述为已经证明新方式更高效。', { left: 55, top: 612, width: 1040, height: 42 }, 'note', { color: C.muted });
  addFooter(slide);
}

// 6 — review chain
{
  const slide = newSlide();
  addHeader(slide, '复核是一条有责任边界的协作链', '工作顺序');
  addText(slide, 'p6-lead', '先检查别人是否能理解这个结果怎么产生，再进入可讨论版本；复核不要求复做整项实验。', { left: 55, top: 145, width: 1100, height: 34 }, 'note', { color: C.muted });
  const nodeX = [55, 355, 655, 955];
  const nodeW = 230;
  const nodeY = 220;
  const nodeH = 160;
  const nodeData = [
    ['提交记录', '执行者提交一个结果记录及受控引用。'],
    ['尝试定位', '另一位成员依据记录定位数据、脚本和条件，并提出缺项。'],
    ['补充说明', '执行者补充缺项后交给负责人确认。'],
    ['确认版本', '负责人确认，记录进入可讨论版本。'],
  ];
  const nodes = [];
  nodeData.forEach(([title, body], i) => {
    const box = addRoundRect(slide, `p6-node-${i + 1}-box`, { left: nodeX[i], top: nodeY, width: nodeW, height: nodeH }, C.white, C.line, 1);
    const t = addText(slide, `p6-node-${i + 1}-title`, title, { left: nodeX[i] + 20, top: nodeY + 24, width: nodeW - 40, height: 30 }, 'group', { color: C.primary, alignment: 'center', lineSpacing: 1.1, verticalAlignment: 'middle' });
    const b = addText(slide, `p6-node-${i + 1}-body`, body, { left: nodeX[i] + 20, top: nodeY + 70, width: nodeW - 40, height: 65 }, 'body', { color: C.ink, alignment: 'center', lineSpacing: 1.3, verticalAlignment: 'middle' });
    nodes.push(box);
    pair(pageNo, t, b, 'workflow node title and explanation');
  });
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const conn = slide.shapes.connect(nodes[i], nodes[i + 1], {
      kind: 'straight',
      fromSide: 'right',
      toSide: 'left',
      line: { style: 'solid', fill: C.primary, width: 2 },
      tail: { type: 'arrow', width: 'sm', length: 'sm' },
    });
    conn.sendToBack();
    connections.push({ page: pageNo, connectorId: conn.id, sourceObject: nodes[i].name, sourceShapeId: nodes[i].id, targetObject: nodes[i + 1].name, targetShapeId: nodes[i + 1].id, arrowAt: 'tail', basis: '原稿工作顺序：提交→定位→补充→确认' });
  }
  addRect(slide, 'p6-condition-band', { left: 55, top: 454, width: 1170, height: 120 }, C.lightBlue);
  addText(slide, 'p6-condition-label', '授权条件', { left: 85, top: 484, width: 170, height: 30 }, 'group', { color: C.primary });
  addText(slide, 'p6-condition-body', '涉及新的访问授权时，暂停共享，由负责人处理授权后再继续。复核只检查可理解性，不代替科学结论审查。', { left: 285, top: 480, width: 910, height: 66 }, 'body', { lineSpacing: 1.35 });
  addFooter(slide);
}

// 7 — pilot timeline and evaluation
{
  const slide = newSlide();
  addHeader(slide, '四周试点，先观察能否持续解释结果', '试点边界');
  addText(slide, 'p7-lead', '范围是拟定的：一个课题方向、两名自愿成员，只记录新增实验。', { left: 55, top: 145, width: 950, height: 34 }, 'note', { color: C.muted });
  addRect(slide, 'p7-scope-band', { left: 55, top: 194, width: 1170, height: 92 }, C.pale);
  addText(slide, 'p7-scope-metric-1', '4周', { left: 90, top: 214, width: 120, height: 45 }, 'metric', { color: C.primary });
  addText(slide, 'p7-scope-label-1', '试点周期', { left: 91, top: 262, width: 130, height: 22 }, 'note', { color: C.muted });
  addText(slide, 'p7-scope-metric-2', '2名', { left: 300, top: 214, width: 120, height: 45 }, 'metric', { color: C.primary });
  addText(slide, 'p7-scope-label-2', '自愿成员', { left: 301, top: 262, width: 130, height: 22 }, 'note', { color: C.muted });
  addText(slide, 'p7-scope-label-3', '1个课题方向', { left: 510, top: 225, width: 180, height: 30 }, 'group', { color: C.ink });
  addText(slide, 'p7-scope-body-3', '记录新增实验', { left: 510, top: 262, width: 180, height: 22 }, 'note', { color: C.muted });
  addLine(slide, 'p7-timeline-main', 112, 371, 1165, 371, 'timeline progression', C.primary, 2);
  const weeks = [
    ['第一周', '共同明确最少字段，用一个结果试填。'],
    ['第二周', '在实际工作中记录缺项。'],
    ['第三周', '在实际工作中记录填写负担。'],
    ['第四周', '讨论保留、修改或停止。'],
  ];
  const wx = [80, 365, 650, 935];
  weeks.forEach(([label, body], i) => {
    addShape(slide, 'ellipse', `p7-week-${i + 1}-dot`, { left: wx[i], top: 356, width: 30, height: 30 }, C.primary, { style: 'solid', fill: C.primary, width: 1 });
    const t = addText(slide, `p7-week-${i + 1}-title`, label, { left: wx[i] + 46, top: 333, width: 150, height: 30 }, 'group', { color: C.primary });
    const b = addText(slide, `p7-week-${i + 1}-body`, body, { left: wx[i] + 46, top: 385, width: 250, height: 54 }, 'body', { lineSpacing: 1.3 });
    pair(pageNo, t, b, 'pilot week and planned work');
  });
  addRect(slide, 'p7-eval-band', { left: 55, top: 492, width: 1170, height: 117 }, C.lightBlue);
  addText(slide, 'p7-eval-label', '评估不设统一“合格分数”', { left: 85, top: 518, width: 300, height: 34 }, 'group', { color: C.primary });
  addText(slide, 'p7-eval-q1', '能否沿记录定位结果来源', { left: 430, top: 515, width: 220, height: 30 }, 'body', { color: C.ink });
  addText(slide, 'p7-eval-q2', '处理与排除是否有可理解依据', { left: 680, top: 515, width: 250, height: 30 }, 'body', { color: C.ink });
  addText(slide, 'p7-eval-q3', '负担是否在愿意持续承担的范围内', { left: 950, top: 515, width: 250, height: 48 }, 'body', { color: C.ink });
  addText(slide, 'p7-eval-note', '收集具体复核过程和当事人反馈；四周安排不代表已有效率提升或完成率数字。', { left: 85, top: 570, width: 1040, height: 26 }, 'note', { color: C.muted });
  addFooter(slide);
}

// 8 — close with start/stop conditions
{
  const slide = newSlide();
  addHeader(slide, '先让一次结果可以被理解，再决定长期保存什么', '讨论收束');
  addText(slide, 'p8-lead', '现在需要确认的是一项有限尝试，以及它可以被停止或修改的边界。', { left: 55, top: 145, width: 1000, height: 34 }, 'note', { color: C.muted });
  addText(slide, 'p8-start-label', '开始前需要确认', { left: 55, top: 214, width: 470, height: 34 }, 'group', { color: C.primary });
  const starts = [
    '负责人确认范围与授权联系人',
    '参与成员认可最少字段',
    '确定谁负责复核',
  ];
  starts.forEach((s, i) => {
    const y = 274 + i * 60;
    addLine(slide, `p8-start-${i + 1}-accent`, 55, y + 3, 61, y + 38, 'start condition accent', C.primary, 3);
    addText(slide, `p8-start-${i + 1}`, s, { left: 80, top: y, width: 485, height: 34 }, 'body', { color: C.ink });
  });
  addLine(slide, 'p8-mid-rule', 625, 212, 625, 432, 'start stop divider', C.line, 1);
  addText(slide, 'p8-stop-label', '需要缩小或停止的信号', { left: 700, top: 214, width: 470, height: 34 }, 'group', { color: C.primary });
  const stops = [
    '填写持续挤占必要实验时间',
    '权限边界无法说明',
    '记录只增加重复抄写，没有帮助解释结果',
  ];
  stops.forEach((s, i) => {
    const y = 274 + i * 60;
    addLine(slide, `p8-stop-${i + 1}-accent`, 700, y + 3, 706, y + 38, 'stop condition accent', C.primary, 3);
    addText(slide, `p8-stop-${i + 1}`, s, { left: 725, top: y, width: 470, height: 45 }, 'body', { color: C.ink });
  });
  addRect(slide, 'p8-close-band', { left: 55, top: 492, width: 1170, height: 109 }, C.primary);
  addText(slide, 'p8-close-title', '工具只是承载方式', { left: 85, top: 518, width: 300, height: 32 }, 'group', { color: C.white });
  addText(slide, 'p8-close-body', '本次试点要验证的是：结果、依据和责任边界能否在一次真实记录中保持联系。', { left: 410, top: 514, width: 760, height: 50 }, 'body', { color: C.white, lineSpacing: 1.35 });
  addText(slide, 'p8-stop-note', '如果边界无法说明，先缩小要求或停止试点，不能为了完成试点目标强行推广。', { left: 55, top: 625, width: 960, height: 28 }, 'note', { color: C.muted });
  addFooter(slide);
}

const sourceMap = {
  source: 'experiments/university-skin-pilot/aesthetic-ab-01/inputs/archive.txt',
  pages: 8,
  entries: [
    { id: 'p1-purpose', original: '这是用于验证 PPT 排版的虚构大学场景，不是东北大学已实施的项目或真实成效。受众为课题组教师与研究生。汇报目的：讨论是否用四周、小范围试点，建立能够解释实验结果的数据归档习惯。', keyFacts: ['虚构场景', '受众为课题组教师与研究生', '讨论四周小范围试点'], conditions: ['不写成真实项目或成效'], page: 1 },
    { id: 'p2-problem', original: '课题组讨论一张实验曲线时，经常能找到最终图片，却不能快速说明图片来自哪批样本、用了哪版脚本、哪些数据被排除。同名文件和个人目录让重复检索变难，但问题并不只是文件没有上传：文件存在，不等于结果可以解释。归档首先要保存结果和依据之间的关系，随后才讨论扩大共享范围。', keyFacts: ['文件存在不等于可解释', '结果与依据关系优先'], conditions: ['不把问题简化为文件未上传'], page: 2 },
    { id: 'p3-record-unit', original: '我们拟把一次可讨论的实验结果组织为一个记录单元。它包含原始数据的位置、样本与采集条件、处理脚本版本、结果文件，以及异常和排除的说明。这几项共同解释一个结果，并不是必须依次执行的五个步骤。原始数据需要保持原貌，清洗与处理另存；脚本版本应能定位实际运行的代码；异常说明保留判断依据，不能只留下“已清理”的结论。没有纳入结果的样本，也要解释排除条件。', keyFacts: ['五类记录字段', '原始数据保持原貌', '脚本可定位', '异常与排除保留依据'], conditions: ['五项不是时间步骤'], page: 3 },
    { id: 'p4-access', original: '记录完整不等于所有人都能看到全部文件。讨论材料可以包含结果图和可公开的解释；受限原始数据仍放在原授权位置，记录中只保留受控引用和访问条件。涉及个人信息或合作限制的内容不能因为归档而改变授权。记录表中出现一个路径，也不代表其他成员已经取得访问权。', keyFacts: ['讨论材料可公开部分', '受限原始数据保留原授权', '路径不代表访问权'], conditions: ['不因归档改变授权'], page: 4 },
    { id: 'p5-options', original: '试点有两种推进思路。集中补历史档案，能一次形成较大的目录，也可能耗费大量时间追查已经遗失的上下文，并把不确定记忆写成确定说明。先从新增实验开始，能在上下文尚清楚时记录，但短期内无法解决全部历史材料的追溯问题。建议先对新增实验试行，对真正需要复核的历史结果逐项补充；这是一种范围选择，不能表述为已经证明新方式更高效。', keyFacts: ['集中补历史：目录大但追查代价高', '新增优先：上下文清楚但历史追溯暂不完整'], conditions: ['建议是范围选择，不是效率实证'], page: 5 },
    { id: 'p6-review', original: '拟采用的工作顺序是：实验执行者提交一个结果记录及受控引用；另一位成员依据记录尝试定位数据、脚本和条件，并提出缺项；执行者补充后交给负责人确认，记录进入可讨论版本。如果涉及新的访问授权，暂停共享，由负责人处理授权后再继续。复核不要求复做整项实验，也不代替科学结论审查；它先检查别人是否能理解这个结果是怎么产生的。', keyFacts: ['提交→定位→补充→确认', '授权条件会暂停共享'], conditions: ['复核不是复做实验或科学结论审查'], page: 6 },
    { id: 'p7-pilot', original: '四周试点只选择一个课题方向，两名自愿成员，记录新增实验。第一周共同明确最少字段，并用一个结果试填；第二、三周在实际工作中记录缺项与填写负担；第四周讨论是否保留、修改或停止。四周、两人和周次安排都是拟定范围，没有实测效率提升或完成率数字。试点评估回答三个问题：其他成员能否沿记录定位结果的来源；关键处理与排除是否有可理解的依据；记录负担是否在成员愿意持续承担的范围内。收集具体复核过程和当事人反馈，不先给一个统一“合格分数”。', keyFacts: ['一个方向、两名自愿成员、四周', '三项评估问题', '收集过程与反馈'], conditions: ['不写成已有效率提升或完成率数字', '不预设统一合格分数'], page: 7 },
    { id: 'p8-boundaries', original: '开始试点需要负责人确认范围与授权联系人，参与成员认可最少字段，并确定谁负责复核。停止或修改的信号包括：填写工作持续挤占必要实验时间；权限边界无法说明；记录只增加重复抄写而没有帮助解释结果。届时先缩小要求或停止试点，不能为了完成试点目标强行推广。希望本次讨论确认的是一个有限尝试：先让一次结果可以被理解，再决定哪些记录值得长期保存。归档工具只是承载方式，结果、依据和责任边界的联系才是这次试点要验证的内容。', keyFacts: ['启动前确认三项责任', '三类停止/修改信号', '有限尝试'], conditions: ['可缩小或停止', '不强行推广'], page: 8 },
  ],
};

await fs.writeFile(`${OUT}/source-map.json`, JSON.stringify(sourceMap, null, 2), 'utf8');
await fs.writeFile(`${OUT}/text-roles.json`, JSON.stringify(textRoles, null, 2), 'utf8');
await fs.writeFile(`${OUT}/node-label-pairs.json`, JSON.stringify({ pairs: [0, 1, 2, 3].map((_, i) => ({ node: `p6-node-${i + 1}-box`, labels: [`p6-node-${i + 1}-title`, `p6-node-${i + 1}-body`], centerTolerance: 3, padding: 8 })) }, null, 2), 'utf8');
await fs.writeFile(`${OUT}/connections.json`, JSON.stringify(connections, null, 2), 'utf8');
await fs.writeFile(`${OUT}/line-paths.json`, JSON.stringify(linePaths, null, 2), 'utf8');
await fs.writeFile(`${OUT}/structure-usage.txt`, `本轮结构检索：\n- sequence-phase-gates-004（阶段门禁流程）：参考阶段推进与门槛的关系语法；本稿第6页改为四步原生协作链，第7页改为四周时间轴，未调用 invokeStructure。\n- comparison-dual-verdict-001（双向结论对比）：参考两对象共同维度逐行对齐；本稿第5页重组为文字比较面，保留新增优先的建议边界，未调用 invokeStructure。\n- role-stage-collaboration-001（阶段角色协同泳道）：参考职责与阶段分离；本稿第6页用执行者、复核成员、负责人三类责任嵌入协作链，未调用 invokeStructure。\n实际采用：原生 textbox、rect、roundRect、line 与 connector；无图片、无外部素材。`, 'utf8');
await fs.writeFile(`${OUT}/reasoning.txt`, `沟通任务：让课题组教师与研究生理解，归档试点要验证的是结果、依据和责任边界的联系，并据此讨论一个有限、可停止的四周尝试。\n\n页1：封面只建立虚构场景、受众和讨论目标，并用结果—依据—责任边界作为阅读入口。\n页2：先提出核心判断“文件存在不等于可解释”，再把找到图片与说明产生依据放在同一高度，最后落到本次讨论要建立的习惯。\n页3：把五类记录字段作为一个记录单元的组成项，用两列开放文字组承载字段与说明；底部明确它们不是五个时间步骤。\n页4：按“可公开讨论材料 / 受限原始数据”同一行对照，底部单独聚合权限约束，避免把路径误读为授权。\n页5：按共同维度“能得到什么 / 主要代价 / 使用方式”横向对齐两种推进思路，保留新增优先建议及“不是效率实证”的限制。\n页6：采用四个有明确先后的协作节点；箭头只表达原稿给出的提交→定位→补充→确认。授权条件放在独立说明带，不把它虚构为第五步。\n页7：四周是拟定时间范围，所以用时间轴表达周次和安排；范围数字分别标注单位，不推导效率。底部三项评估问题与“无统一合格分数”就近呈现。\n页8：收束页左右分开启动条件与停止/修改信号，深色底只承载最终讨论焦点，不扩展原稿结论。\n\n背景使用说明：浅灰底只聚合一个完整分析面或条件区；蓝色底只标记权限约束、推荐范围或最终收束。普通解释均为左对齐或在真实节点内居中，按角色字号输出。`, 'utf8');
await fs.writeFile(`${OUT}/coverage.txt`, `source-map entries: ${sourceMap.entries.length}\nassigned pages: ${[...new Set(sourceMap.entries.map(e => e.page))].sort((a,b)=>a-b).join(', ')}\nall original paragraphs represented: yes\nkey facts preserved: virtual scenario, audience, purpose, record unit fields, raw-data preservation, script version, anomaly/exclusion basis, access boundary, two options and costs, workflow and authorization pause, four-week scope, three evaluation questions, no measured gains, start conditions, stop signals, limited-trial conclusion\nstructural additions: none; wording is compressed only for slide readability.`, 'utf8');

for (const [index, slide] of presentation.slides.items.entries()) {
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(`${OUT}/slide-${index + 1}.layout.json`, await layout.text(), 'utf8');
}
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(`${OUT}/deck.pptx`);
const hash = crypto.createHash('sha256').update(await fs.readFile(`${OUT}/deck.pptx`)).digest('hex');
await fs.writeFile(`${OUT}/final-hash.txt`, `${hash}  deck.pptx\n`, 'utf8');
await fs.writeFile(`${OUT}/report.txt`, `首稿已导出：deck.pptx\n页数：${presentation.slides.items.length}\n内容核对：source-map.json 已在编排前建立，覆盖原稿 8 个主题段落。\n结构：三项结构资产仅作参考重组，未调用 invokeStructure。\n确定性检查：待运行审计脚本后补录。\n视觉审查：未执行；按任务要求由父任务独立审查。\n渲染图片：将由 render_slides.py 重新读取最终 PPTX，生成者不读取渲染结果。\nSHA-256：${hash}\n`, 'utf8');
