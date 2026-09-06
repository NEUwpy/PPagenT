import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/archive-d/round-01';
const Theme = {
  primary: '#315F91',
  primaryDark: '#24486E',
  primaryLight: '#EAF1F8',
  primaryMid: '#C9D9E8',
  ink: '#252B33',
  muted: '#707780',
  bg: '#FFFFFF',
  soft: '#F4F7FA',
  line: '#D7E0E8',
  white: '#FFFFFF'
};
const FONT = 'Microsoft YaHei';
const SW = 1280, SH = 720;

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function baseTextStyle(fontSize, color = Theme.ink, extra = {}) {
  return { fontSize, color, fontFamily: FONT, ...extra };
}

function addText(slide, name, text, x, y, w, h, style = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox', name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 }
  });
  shape.text = text;
  shape.text.style = baseTextStyle(style.fontSize ?? 18, style.color ?? Theme.ink, {
    bold: style.bold ?? false,
    italic: style.italic ?? false,
    alignment: style.alignment ?? 'left',
    verticalAlignment: style.verticalAlignment ?? 'top',
    lineSpacing: style.lineSpacing ?? 1.05,
    insets: style.insets ?? { left: 0, right: 0, top: 0, bottom: 0 }
  });
  return shape;
}

function addNode(slide, name, text, x, y, w, h, opts = {}) {
  const config = {
    geometry: opts.geometry ?? 'roundRect', name,
    position: { left: x, top: y, width: w, height: h },
    fill: opts.fill ?? Theme.primaryLight,
    line: { style: 'solid', fill: opts.line ?? Theme.primary, width: opts.lineWidth ?? 1.5 }
  };
  if ((opts.geometry ?? 'roundRect') === 'roundRect' || (opts.geometry ?? 'roundRect') === 'rect' || (opts.geometry ?? 'roundRect') === 'textbox') config.borderRadius = opts.radius ?? 10;
  const shape = slide.shapes.add(config);
  shape.text = text;
  shape.text.style = baseTextStyle(opts.fontSize ?? 18, opts.color ?? Theme.ink, {
    bold: opts.bold ?? false,
    alignment: 'center',
    verticalAlignment: 'middle',
    lineSpacing: opts.lineSpacing ?? 1.0,
    insets: { left: opts.pad ?? 12, right: opts.pad ?? 12, top: opts.vpad ?? 8, bottom: opts.vpad ?? 8 }
  });
  return shape;
}

function addRule(slide, name, x, y, w, color = Theme.primary, height = 3) {
  return slide.shapes.add({
    geometry: 'rect', name, position: { left: x, top: y, width: w, height },
    fill: color, line: { style: 'solid', fill: color, width: 0 }
  });
}

function addFooter(slide, page, label = '实验数据归档｜方案讨论稿') {
  addRule(slide, `footer-rule-${page}`, 55, 679, 1170, Theme.line, 1);
  addText(slide, `footer-label-${page}`, label, 55, 688, 470, 18, { fontSize: 14, color: Theme.muted });
  addText(slide, `footer-page-${page}`, String(page).padStart(2, '0'), 1170, 688, 55, 18, { fontSize: 14, color: Theme.muted, alignment: 'right' });
}

function addAnalysisHeader(slide, page, title, kicker = '') {
  addText(slide, `kicker-${page}`, kicker, 55, 34, 420, 22, { fontSize: 16, color: Theme.primary, bold: true });
  addText(slide, `title-${page}`, title, 55, 62, 1170, 48, { fontSize: 32, color: Theme.ink, bold: true, lineSpacing: 0.95 });
  addRule(slide, `title-rule-${page}`, 55, 120, 1170, Theme.primary, 3);
}

function addNotes(slide, page, extra = '') {
  slide.speakerNotes.textFrame.setText(`[Sources]\narchive.txt（分配原稿，供本页事实与措辞）\n${extra}`);
  slide.speakerNotes.setVisible(true);
}

function connect(slide, source, target, opts = {}) {
  return slide.shapes.connect(source, target, {
    kind: 'straight',
    fromSide: opts.fromSide ?? 'right',
    toSide: opts.toSide ?? 'left',
    line: { style: opts.dashed ? 'dashed' : 'solid', fill: opts.color ?? Theme.primary, width: opts.width ?? 2 },
    tail: opts.arrow === false ? { type: 'none' } : { type: 'arrow', width: 'sm', length: 'sm' }
  });
}

function addBulletText(slide, name, items, x, y, w, h, opts = {}) {
  const text = items.map(v => `• ${v}`).join('\n');
  return addText(slide, name, text, x, y, w, h, { fontSize: opts.fontSize ?? 18, color: opts.color ?? Theme.ink, lineSpacing: opts.lineSpacing ?? 1.18 });
}

function slide1(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.primary;
  addText(slide, 'cover-eyebrow', '实验数据归档｜方案讨论稿', 72, 92, 480, 26, { fontSize: 18, color: Theme.white, bold: true });
  addText(slide, 'cover-title', '先把一次结果说明白', 72, 178, 880, 82, { fontSize: 48, color: Theme.white, bold: true, lineSpacing: 0.95 });
  addText(slide, 'cover-subtitle', '用四周、小范围试点，验证结果、依据与责任边界能否被理解', 76, 290, 820, 58, { fontSize: 24, color: '#EAF1F8', lineSpacing: 1.05 });
  addRule(slide, 'cover-rule', 76, 382, 260, Theme.white, 4);
  addNode(slide, 'cover-scope-node', '1 个课题方向  ·  2 名自愿成员  ·  4 周', 76, 452, 530, 68, { fill: '#24486E', line: '#C9D9E8', color: Theme.white, fontSize: 20, radius: 8 });
  addText(slide, 'cover-boundary', '虚构大学场景；非已实施项目或真实成效汇报', 76, 566, 560, 24, { fontSize: 16, color: '#D7E0E8' });
  addText(slide, 'cover-audience', '面向课题组教师与研究生', 76, 608, 560, 24, { fontSize: 16, color: '#D7E0E8' });
  addFooter(slide, 1, '实验数据归档｜有限试点讨论');
  addNotes(slide, 1, 'P01-P02：建立讨论目的与事实边界。');
  return slide;
}

function slide2(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 2, '找到图片，不等于结果已经可以解释', '问题边界');
  addText(slide, 's2-lead', '真正缺的不是文件，而是结果与依据的联系。', 55, 150, 560, 42, { fontSize: 24, color: Theme.primaryDark, bold: true });
  addText(slide, 's2-support', '归档先保存这条联系，再讨论扩大共享范围。', 55, 211, 500, 32, { fontSize: 18, color: Theme.muted });
  const result = addNode(slide, 's2-result-node', '可解释的\n实验结果', 790, 270, 300, 120, { fill: Theme.primary, line: Theme.primaryDark, color: Theme.white, fontSize: 26, bold: true, radius: 12 });
  const inputs = [
    ['s2-sample-node', '哪批样本？', '样本批次'],
    ['s2-script-node', '哪版脚本？', '处理脚本'],
    ['s2-exclusion-node', '排除了什么？', '排除依据']
  ];
  const ys = [250, 334, 418];
  const nodes = inputs.map((it, i) => addNode(slide, it[0], it[1], 225, ys[i], 310, 62, { fill: Theme.soft, line: Theme.line, fontSize: 20, bold: true, radius: 8 }));
  nodes.forEach((n) => connect(slide, n, result, { color: Theme.primaryMid, width: 2 }));
  addText(slide, 's2-file-note', '同名文件 + 个人目录\n让重复检索更难', 610, 488, 260, 56, { fontSize: 18, color: Theme.muted, alignment: 'center', lineSpacing: 1.1 });
  addRule(slide, 's2-bottom-band', 55, 586, 1170, Theme.primaryLight, 62);
  addText(slide, 's2-bottom-text', '文件存在 ≠ 结果可解释', 80, 603, 420, 28, { fontSize: 22, color: Theme.primaryDark, bold: true });
  addText(slide, 's2-bottom-detail', '先把来源、处理与排除条件连回结果，再谈共享边界。', 510, 606, 640, 24, { fontSize: 18, color: Theme.ink });
  addFooter(slide, 2);
  addNotes(slide, 2, 'P03：三项缺失依据共同支撑“结果可解释”，并说明同名文件与个人目录的检索问题。');
  return slide;
}

function slide3(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 3, '一个可讨论结果，需要五类信息共同解释', '记录单元');
  addText(slide, 's3-lead', '五类信息共同归属于一个记录单元；它们不是必须依次执行的五个步骤。', 55, 150, 850, 34, { fontSize: 20, color: Theme.primaryDark, bold: true });
  const frame = slide.shapes.add({ geometry: 'rect', name: 's3-record-frame', position: { left: 90, top: 218, width: 1095, height: 330 }, fill: Theme.soft, line: { style: 'solid', fill: Theme.line, width: 1.5 } });
  const center = addNode(slide, 's3-center-node', '一次可讨论的\n实验结果', 490, 318, 300, 105, { fill: Theme.primary, line: Theme.primaryDark, color: Theme.white, fontSize: 24, bold: true, radius: 12 });
  const members = [
    ['s3-data-node', '原始数据位置', 150, 250, 230, 58],
    ['s3-sample-node', '样本与采集条件', 820, 250, 260, 58],
    ['s3-script-node', '处理脚本版本', 150, 450, 230, 58],
    ['s3-result-node', '结果文件', 820, 450, 260, 58],
    ['s3-exception-node', '异常与排除说明', 480, 470, 320, 58]
  ].map(([n,t,x,y,w,h]) => addNode(slide, n, t, x, y, w, h, { fill: Theme.primaryLight, line: Theme.primaryMid, fontSize: 18, bold: true, radius: 8 }));
  addText(slide, 's3-rules-title', '五条数据纪律', 55, 575, 220, 24, { fontSize: 18, color: Theme.primary, bold: true });
  addText(slide, 's3-rules', '原始数据保持原貌；清洗与处理另存。脚本版本要能定位实际运行代码。异常说明保留判断依据；\n排除样本说明排除条件。', 290, 573, 840, 42, { fontSize: 16, color: Theme.ink, lineSpacing: 1.1 });
  addFooter(slide, 3);
  addNotes(slide, 3, 'P04：五类信息共同解释结果，明确原始数据、脚本版本、异常与排除说明的保存纪律。');
  return slide;
}

function slide4(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 4, '记录完整，与所有人都能看到全部文件，是两件事', '授权边界');
  addText(slide, 's4-lead', '归档保存可理解的引用关系，但不改变原有授权。', 55, 150, 700, 34, { fontSize: 22, color: Theme.primaryDark, bold: true });
  const left = slide.shapes.add({ geometry: 'rect', name: 's4-open-frame', position: { left: 75, top: 225, width: 505, height: 300 }, fill: Theme.soft, line: { style: 'solid', fill: Theme.line, width: 1.2 } });
  const right = slide.shapes.add({ geometry: 'rect', name: 's4-restricted-frame', position: { left: 700, top: 225, width: 505, height: 300 }, fill: Theme.primaryLight, line: { style: 'solid', fill: Theme.primaryMid, width: 1.2 } });
  addText(slide, 's4-open-title', '讨论材料', 108, 258, 320, 32, { fontSize: 24, color: Theme.primaryDark, bold: true });
  addBulletText(slide, 's4-open-items', ['结果图', '可公开的解释', '受众可理解的记录摘要'], 108, 315, 395, 130, { fontSize: 20 });
  addText(slide, 's4-restricted-title', '受限原始数据', 733, 258, 360, 32, { fontSize: 24, color: Theme.primaryDark, bold: true });
  addBulletText(slide, 's4-restricted-items', ['仍放在原授权位置', '记录只保留受控引用', '写清访问条件'], 733, 315, 395, 130, { fontSize: 20 });
  addRule(slide, 's4-boundary', 640, 225, 2, Theme.primary, 300);
  addText(slide, 's4-boundary-label', '授权\n不变', 585, 338, 44, 70, { fontSize: 18, color: Theme.primary, bold: true, alignment: 'center', lineSpacing: 1.0 });
  addRule(slide, 's4-bottom-band', 75, 565, 1130, Theme.primaryLight, 58);
  addText(slide, 's4-bottom', '路径出现于记录表 ≠ 其他成员已经取得访问权', 105, 581, 1010, 26, { fontSize: 20, color: Theme.primaryDark, bold: true, alignment: 'center' });
  addText(slide, 's4-exception', '个人信息或合作限制，不能因为归档而改变授权。', 75, 635, 1130, 22, { fontSize: 16, color: Theme.muted, alignment: 'center' });
  addFooter(slide, 4);
  addNotes(slide, 4, 'P05：区分讨论材料与受限原始数据，保留个人信息、合作限制和访问权边界。');
  return slide;
}

function slide5(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 5, '建议先试新增实验，再逐项补真正需要复核的历史结果', '范围选择');
  addText(slide, 's5-lead', '两种推进思路的差异，关键在上下文是否还清楚，以及历史追溯要付出什么代价。', 55, 150, 1080, 34, { fontSize: 20, color: Theme.primaryDark, bold: true });
  const left = slide.shapes.add({ geometry: 'rect', name: 's5-history-frame', position: { left: 75, top: 225, width: 505, height: 320 }, fill: Theme.soft, line: { style: 'solid', fill: Theme.line, width: 1.2 } });
  const right = slide.shapes.add({ geometry: 'rect', name: 's5-new-frame', position: { left: 700, top: 225, width: 505, height: 320 }, fill: Theme.primaryLight, line: { style: 'solid', fill: Theme.primary, width: 2 } });
  addText(slide, 's5-history-title', '集中补历史档案', 105, 255, 410, 32, { fontSize: 24, color: Theme.ink, bold: true });
  addText(slide, 's5-history-benefit', '能一次形成较大的目录', 105, 318, 410, 28, { fontSize: 20, color: Theme.primaryDark, bold: true });
  addText(slide, 's5-history-cost', '代价：追查遗失上下文耗时；\n不确定记忆可能被写成确定说明。', 105, 382, 410, 70, { fontSize: 18, color: Theme.muted, lineSpacing: 1.12 });
  addText(slide, 's5-new-title', '先从新增实验开始', 730, 255, 410, 32, { fontSize: 24, color: Theme.primaryDark, bold: true });
  addText(slide, 's5-new-benefit', '上下文尚清楚时就记录', 730, 318, 410, 28, { fontSize: 20, color: Theme.primaryDark, bold: true });
  addText(slide, 's5-new-cost', '代价：短期无法解决全部历史材料的追溯。', 730, 382, 410, 45, { fontSize: 18, color: Theme.muted });
  addRule(slide, 's5-recommend-band', 75, 575, 1130, Theme.primary, 68);
  addText(slide, 's5-recommend', '建议：新增实验先试行；真正需要复核的历史结果逐项补充。', 105, 592, 1065, 28, { fontSize: 22, color: Theme.white, bold: true, alignment: 'center' });
  addText(slide, 's5-boundary', '这是范围选择，不是已经证明新方式更高效。', 75, 650, 1130, 20, { fontSize: 16, color: Theme.muted, alignment: 'center' });
  addFooter(slide, 5);
  addNotes(slide, 5, 'P06：保留两种方案各自收益与代价，并明确推荐与“未证明更高效”的边界。');
  return slide;
}

function slide6(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 6, '复核先确认：别人能否理解这个结果是怎么产生的', '工作顺序');
  addText(slide, 's6-lead', '流程只检查来源、脚本和条件是否可定位；它不要求复做整项实验，也不代替科学结论审查。', 55, 150, 1130, 34, { fontSize: 20, color: Theme.primaryDark, bold: true });
  const nodes = [
    addNode(slide, 's6-submit-node', '01  执行者提交\n结果记录 + 受控引用', 75, 260, 245, 120, { fill: Theme.primaryLight, line: Theme.primary, fontSize: 18, bold: true }),
    addNode(slide, 's6-locate-node', '02  另一位成员定位\n数据、脚本与条件\n提出缺项', 380, 260, 245, 120, { fill: Theme.primaryLight, line: Theme.primary, fontSize: 18, bold: true }),
    addNode(slide, 's6-supplement-node', '03  执行者补充\n交负责人确认', 685, 260, 245, 120, { fill: Theme.primaryLight, line: Theme.primary, fontSize: 18, bold: true }),
    addNode(slide, 's6-discussable-node', '04  进入\n可讨论版本', 990, 260, 210, 120, { fill: Theme.primary, line: Theme.primaryDark, color: Theme.white, fontSize: 20, bold: true })
  ];
  for (let i = 0; i < nodes.length - 1; i++) connect(slide, nodes[i], nodes[i + 1], { color: Theme.primary, width: 2.5 });
  addRule(slide, 's6-role-rule', 75, 430, 1130, Theme.line, 1);
  addText(slide, 's6-roles', '实验执行者', 100, 448, 200, 26, { fontSize: 16, color: Theme.muted, alignment: 'center' });
  addText(slide, 's6-roles2', '另一位成员', 405, 448, 200, 26, { fontSize: 16, color: Theme.muted, alignment: 'center' });
  addText(slide, 's6-roles3', '实验执行者 → 负责人', 685, 448, 245, 26, { fontSize: 16, color: Theme.muted, alignment: 'center' });
  const pause = slide.shapes.add({ geometry: 'rect', name: 's6-pause-frame', position: { left: 255, top: 510, width: 770, height: 78 }, fill: Theme.soft, line: { style: 'dashed', fill: Theme.primaryMid, width: 1.5 } });
  addText(slide, 's6-pause-title', '遇到新的访问授权：暂停共享', 280, 527, 330, 26, { fontSize: 20, color: Theme.primaryDark, bold: true });
  addText(slide, 's6-pause-detail', '由负责人处理授权后再继续；授权不是流程中的默认通行证。', 620, 527, 370, 34, { fontSize: 16, color: Theme.muted, lineSpacing: 1.05 });
  addFooter(slide, 6);
  addNotes(slide, 6, 'P07：四个真实先后步骤、三类角色、授权暂停条件与复核边界。');
  return slide;
}

function slide7(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 7, '试点范围小而明确，四周用来观察缺项与填写负担', '四周试点');
  addNode(slide, 's7-scope-node', '1 个课题方向  ·  2 名自愿成员  ·  记录新增实验', 150, 155, 980, 52, { fill: Theme.primary, line: Theme.primaryDark, color: Theme.white, fontSize: 20, bold: true, radius: 8 });
  const weeks = [
    ['s7-w1-node', '第 1 周', '明确最少字段\n一个结果试填', 170],
    ['s7-w23-node', '第 2—3 周', '实际记录缺项\n与填写负担', 480],
    ['s7-w4-node', '第 4 周', '讨论保留、\n修改或停止', 850]
  ];
  const weekNodes = weeks.map(([n,t,d,x]) => {
    const circle = addNode(slide, n, t, x, 295, 170, 100, { geometry: 'roundRect', fill: Theme.primary, line: Theme.primaryDark, color: Theme.white, fontSize: 20, bold: true, radius: 20, pad: 8, vpad: 8 });
    addText(slide, `${n}-detail`, d, x - 5, 420, 180, 64, { fontSize: 18, color: Theme.ink, alignment: 'center', lineSpacing: 1.08 });
    return circle;
  });
  connect(slide, weekNodes[0], weekNodes[1], { color: Theme.primaryMid, width: 2 });
  connect(slide, weekNodes[1], weekNodes[2], { color: Theme.primaryMid, width: 2 });
  addRule(slide, 's7-boundary-band', 150, 550, 980, Theme.primaryLight, 60);
  addText(slide, 's7-boundary-text', '四周、两人和周次安排都是拟定范围；目前没有实测效率提升或完成率数字。', 180, 568, 920, 24, { fontSize: 18, color: Theme.primaryDark, bold: true, alignment: 'center' });
  addFooter(slide, 7);
  addNotes(slide, 7, 'P08：保留课题方向、成员数量、四周安排和无实测效果数字的边界。');
  return slide;
}

function slide8(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = Theme.bg;
  addAnalysisHeader(slide, 8, '用三类问题决定保留、修改，还是停止', '评估与下一步');
  addText(slide, 's8-lead', '先收集具体复核过程和成员反馈，不先设一个统一“合格分数”。', 55, 150, 900, 34, { fontSize: 20, color: Theme.primaryDark, bold: true });
  const evalFrame = slide.shapes.add({ geometry: 'rect', name: 's8-eval-frame', position: { left: 75, top: 220, width: 540, height: 320 }, fill: Theme.primaryLight, line: { style: 'solid', fill: Theme.primaryMid, width: 1.2 } });
  addText(slide, 's8-eval-title', '三个评估问题', 105, 250, 360, 30, { fontSize: 24, color: Theme.primaryDark, bold: true });
  addText(slide, 's8-eval-items', '01  能否沿记录定位结果来源？\n02  关键处理与排除是否有可理解依据？\n03  记录负担是否在成员愿意持续承担范围？', 105, 318, 470, 150, { fontSize: 19, color: Theme.ink, lineSpacing: 1.3 });
  addText(slide, 's8-failure', '字段填满仍找不到脚本版本，也不算追溯问题已解决。', 105, 490, 470, 30, { fontSize: 16, color: Theme.primaryDark, bold: true, lineSpacing: 1.0 });
  const gateFrame = slide.shapes.add({ geometry: 'rect', name: 's8-gate-frame', position: { left: 665, top: 220, width: 540, height: 320 }, fill: Theme.soft, line: { style: 'solid', fill: Theme.line, width: 1.2 } });
  addText(slide, 's8-gate-title', '开始前确认', 695, 250, 220, 30, { fontSize: 24, color: Theme.primaryDark, bold: true });
  addText(slide, 's8-start', '负责人：确认范围与授权联系人\n成员：认可最少字段\n共同：确定谁负责复核', 695, 310, 460, 100, { fontSize: 18, color: Theme.ink, lineSpacing: 1.25 });
  addText(slide, 's8-stop-title', '出现这些信号，就先缩小要求或停止', 695, 428, 460, 26, { fontSize: 18, color: Theme.primaryDark, bold: true });
  addText(slide, 's8-stop', '填写持续挤占实验时间；权限边界无法说明；重复抄写却没有帮助解释结果。', 695, 465, 460, 50, { fontSize: 16, color: Theme.muted, lineSpacing: 1.08 });
  addRule(slide, 's8-close-band', 75, 575, 1130, Theme.primary, 68);
  addText(slide, 's8-close', '有限尝试：先让一次结果可理解，再决定哪些记录值得长期保存。', 105, 592, 1065, 28, { fontSize: 22, color: Theme.white, bold: true, alignment: 'center' });
  addText(slide, 's8-tool-boundary', '归档工具只是承载方式；这次试点验证的是结果、依据与责任边界的联系。', 75, 650, 1130, 20, { fontSize: 16, color: Theme.muted, alignment: 'center' });
  addFooter(slide, 8);
  addNotes(slide, 8, 'P09-P11：三个评估问题、启动条件、停止/修改信号与有限尝试的收束判断。');
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: SW, height: SH } });
  slide1(presentation); slide2(presentation); slide3(presentation); slide4(presentation);
  slide5(presentation); slide6(presentation); slide7(presentation); slide8(presentation);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const number = index + 1;
    const layoutBlob = await slide.export({ format: 'layout' });
    await fs.writeFile(`${OUT}/slide-${number}.layout.json`, await layoutBlob.text(), 'utf8');
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
