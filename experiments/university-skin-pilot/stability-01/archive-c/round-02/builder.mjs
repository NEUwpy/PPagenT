import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/archive-c/round-02';
const W = 1280, H = 720;
const Theme = {
  primary: '#315F91',
  primaryDark: '#24486E',
  primaryMid: '#6F91B5',
  primaryLight: '#EAF1F8',
  primaryPale: '#F5F8FB',
  ink: '#252B33',
  muted: '#707780',
  line: '#D9DEE5',
  bg: '#FFFFFF',
  grayFill: '#F3F5F7',
};
const FONT = 'Microsoft YaHei';

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}
function rect(slide, name, x, y, w, h, fill, radius = 0, lineFill = 'none', lineWidth = 0) {
  return slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect', name,
    position: { left: x, top: y, width: w, height: h },
    fill, borderRadius: radius || undefined,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
  });
}
function line(slide, name, x1, y1, x2, y2, color = Theme.line, width = 2) {
  return slide.shapes.add({ geometry: 'line', name,
    position: { left: x1, top: y1, width: x2 - x1, height: y2 - y1 },
    fill: 'none', line: { style: 'solid', fill: color, width } });
}
function text(slide, name, value, x, y, w, h, style = {}) {
  const s = slide.shapes.add({ geometry: 'textbox', name,
    position: { left: x, top: y, width: w, height: h }, fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 } });
  s.text = value;
  s.text.style = {
    fontFamily: FONT, fontSize: 18, color: Theme.ink,
    alignment: 'left', verticalAlignment: 'top',
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    ...style,
  };
  return s;
}
function centerText(slide, name, value, x, y, w, h, style = {}) {
  return text(slide, name, value, x, y, w, h, {
    alignment: 'center', verticalAlignment: 'middle', ...style,
  });
}
function title(slide, number, value, subtitle = '') {
  text(slide, `s${number}-title`, value, 55, 34, 1100, 46,
    { fontSize: 32, bold: true, color: Theme.ink });
  rect(slide, `s${number}-title-rule`, 55, 90, 1170, 4, Theme.primary);
  if (subtitle) text(slide, `s${number}-subtitle`, subtitle, 55, 108, 1170, 28,
    { fontSize: 16, color: Theme.muted });
}
function footer(slide, n, light = false) {
  const c = light ? '#DCE8F4' : Theme.muted;
  line(slide, `s${n}-footer-rule`, 55, 684, 1225, 684, light ? '#7092B6' : Theme.line, 1);
  text(slide, `s${n}-footer-source`, '实验数据归档：先把一次结果说明白', 55, 691, 500, 18,
    { fontSize: 14, color: c });
  text(slide, `s${n}-footer-page`, `${String(n).padStart(2, '0')} / 09`, 1165, 691, 60, 18,
    { fontSize: 14, color: c, alignment: 'right' });
}
function notes(slide) {
  slide.speakerNotes.textFrame.setText('[Sources]\n来源：实验数据归档：先把一次结果说明白（用户提供原稿）');
  slide.speakerNotes.setVisible(true);
}
function bullet(slide, name, value, x, y, w, h, color = Theme.ink, fs = 18) {
  return text(slide, name, `• ${value}`, x, y, w, h, { fontSize: fs, color });
}

async function main() {
  const p = Presentation.create({ slideSize: { width: W, height: H } });

  // Slide 1 — cover
  {
    const s = p.slides.add(); s.background.fill = Theme.primary;
    rect(s, 's1-left-band', 55, 74, 9, 180, '#FFFFFF');
    text(s, 's1-kicker', '课题组讨论提案', 88, 82, 420, 30,
      { fontSize: 18, bold: true, color: '#DCE8F4' });
    text(s, 's1-main-title', '先让一次结果可以被理解', 88, 156, 770, 72,
      { fontSize: 46, bold: true, color: '#FFFFFF' });
    text(s, 's1-sub-title', '再决定哪些记录值得长期保存', 88, 236, 720, 44,
      { fontSize: 28, color: '#EAF1F8' });
    rect(s, 's1-callout-surface', 88, 356, 600, 132, '#24486E', 10);
    text(s, 's1-callout', '拟议范围', 120, 380, 160, 28,
      { fontSize: 18, bold: true, color: '#BFD3E7' });
    text(s, 's1-callout-body', '四周｜一个课题方向｜两名自愿成员\n只记录新增实验，先验证可追溯记录能否持续留下',
      120, 416, 510, 54, { fontSize: 20, color: '#FFFFFF' });
    text(s, 's1-question', '讨论要点：结果、依据与责任边界能否在一次记录中对上？',
      88, 588, 800, 32, { fontSize: 18, color: '#EAF1F8' });
    footer(s, 1, true); notes(s);
  }

  // Slide 2 — problem
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 2, '文件找得到，不等于结果能解释', '问题首先是关系断了，而不是文件有没有上传。');
    rect(s, 's2-main-surface', 55, 160, 1170, 392, Theme.primaryPale);
    text(s, 's2-left-heading', '讨论时看到的结果', 96, 194, 420, 34,
      { fontSize: 22, bold: true, color: Theme.primaryDark });
    rect(s, 's2-result-box', 96, 250, 390, 132, '#FFFFFF', 8, Theme.primaryMid, 2);
    centerText(s, 's2-result-label', '最终实验图片\n看见曲线，却说不清来路', 116, 278, 350, 76,
      { fontSize: 22, bold: true, color: Theme.primary });
    rect(s, 's2-gap-band', 520, 252, 200, 126, Theme.primary, 8);
    centerText(s, 's2-gap-label', '解释链\n断开', 544, 273, 152, 84,
      { fontSize: 26, bold: true, color: '#FFFFFF' });
    text(s, 's2-right-heading', '需要同时回答的依据', 760, 194, 400, 34,
      { fontSize: 22, bold: true, color: Theme.primaryDark });
    bullet(s, 's2-evidence-1', '哪批样本、什么采集条件？', 760, 256, 380, 30);
    bullet(s, 's2-evidence-2', '用了哪版处理脚本？', 760, 310, 380, 30);
    bullet(s, 's2-evidence-3', '哪些数据被排除，依据是什么？', 760, 364, 400, 30);
    rect(s, 's2-note-surface', 96, 448, 1035, 66, '#FFFFFF', 6);
    text(s, 's2-note', '同名文件与个人目录让重复检索变难；文件存在，仍可能无法解释结果。',
      120, 466, 980, 28, { fontSize: 18, color: Theme.ink });
    footer(s, 2); notes(s);
  }

  // Slide 3 — record unit composition
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 3, '一条可讨论记录，必须把结果和依据绑在一起', '五项内容共同解释一个结果，不是必须依次执行的五个步骤。');
    rect(s, 's3-record-surface', 55, 158, 1170, 420, Theme.primaryPale, 10, Theme.line, 1);
    rect(s, 's3-record-band', 55, 158, 1170, 52, Theme.primaryDark);
    text(s, 's3-record-heading', '记录单元', 88, 172, 200, 28,
      { fontSize: 22, bold: true, color: '#FFFFFF' });
    rect(s, 's3-result-node', 465, 240, 350, 100, Theme.primary, 8);
    centerText(s, 's3-result-label', '一个实验结果\n结果与依据的共同归属', 490, 256, 300, 68,
      { fontSize: 21, bold: true, color: '#FFFFFF' });
    const items = [
      ['s3-item-raw', '原始数据位置', '保持原貌'],
      ['s3-item-cond', '样本与采集条件', '说明上下文'],
      ['s3-item-script', '处理脚本版本', '定位实际代码'],
      ['s3-item-result', '结果文件', '对应讨论对象'],
      ['s3-item-exc', '异常与排除说明', '保留判断依据'],
    ];
    const xs = [92, 316, 540, 764, 988];
    for (let i = 0; i < items.length; i++) {
      const [nm, h, sub] = items[i];
      rect(s, nm, xs[i], 398, 190, 116, '#FFFFFF', 6, Theme.line, 1);
      centerText(s, `${nm}-label`, h, xs[i] + 12, 420, 166, 40,
        { fontSize: 19, bold: true, color: Theme.primaryDark });
      centerText(s, `${nm}-sub`, sub, xs[i] + 12, 468, 166, 24,
        { fontSize: 16, color: Theme.muted });
    }
    text(s, 's3-bottom-note', '清洗与处理另存；没有纳入结果的样本，也要说明排除条件。',
      88, 542, 1030, 28, { fontSize: 18, color: Theme.ink });
    footer(s, 3); notes(s);
  }

  // Slide 4 — authorization boundary
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 4, '归档扩展的是可解释性，不自动扩展访问权', '记录把“如何产生”说清楚，同时保留原有授权边界。');
    rect(s, 's4-left-surface', 55, 164, 540, 378, Theme.primaryLight);
    rect(s, 's4-right-surface', 625, 164, 600, 378, Theme.grayFill);
    text(s, 's4-left-heading', '可放进讨论材料', 88, 194, 390, 32,
      { fontSize: 22, bold: true, color: Theme.primaryDark });
    text(s, 's4-left-body', '结果图\n可公开的解释\n受控引用与访问条件', 88, 258, 410, 144,
      { fontSize: 22, color: Theme.ink });
    line(s, 's4-left-rule', 88, 442, 520, 442, Theme.primaryMid, 2);
    text(s, 's4-left-note', '重点：别人能理解结果从何而来。', 88, 462, 430, 28,
      { fontSize: 18, color: Theme.primaryDark, bold: true });
    text(s, 's4-right-heading', '仍受原授权约束', 658, 194, 420, 32,
      { fontSize: 22, bold: true, color: Theme.ink });
    text(s, 's4-right-body', '受限原始数据继续放在原授权位置\n涉及个人信息或合作限制的内容不改变授权\n记录中的路径不代表成员已经取得访问权',
      658, 258, 500, 150, { fontSize: 21, color: Theme.ink });
    rect(s, 's4-right-note-surface', 658, 440, 500, 64, '#FFFFFF', 5, Theme.line, 1);
    text(s, 's4-right-note', '路径是受控引用，不是授权传递。', 682, 458, 450, 26,
      { fontSize: 18, bold: true, color: Theme.primaryDark });
    footer(s, 4); notes(s);
  }

  // Slide 5 — proposed scope choice and trade-off (comparison, no sequence arrows)
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 5, '新增实验先行，是范围选择，不是效率结论', '两种推进思路各有代价；建议先保留上下文清楚的新增记录。');
    rect(s, 's5-left-surface', 55, 164, 540, 346, Theme.grayFill);
    rect(s, 's5-right-surface', 625, 164, 600, 346, Theme.primaryLight);
    text(s, 's5-left-heading', '集中补历史档案', 88, 194, 400, 34,
      { fontSize: 24, bold: true, color: Theme.ink });
    bullet(s, 's5-left-1', '一次形成较大的目录', 94, 260, 420, 30, Theme.ink, 19);
    bullet(s, 's5-left-2', '追查已遗失上下文，可能耗费大量时间', 94, 318, 440, 50, Theme.ink, 19);
    bullet(s, 's5-left-3', '不确定记忆可能被写成确定说明', 94, 388, 440, 48, Theme.ink, 19);
    text(s, 's5-right-heading', '先从新增实验开始', 658, 194, 430, 34,
      { fontSize: 24, bold: true, color: Theme.primaryDark });
    bullet(s, 's5-right-1', '上下文尚清楚时记录', 664, 260, 450, 30, Theme.ink, 19);
    bullet(s, 's5-right-2', '短期无法解决全部历史材料的追溯', 664, 318, 480, 50, Theme.ink, 19);
    bullet(s, 's5-right-3', '真正需要复核的历史结果，再逐项补充', 664, 388, 500, 48, Theme.ink, 19);
    rect(s, 's5-recommendation', 88, 536, 1040, 68, Theme.primaryDark, 6);
    text(s, 's5-recommendation-text', '建议：先对新增实验试行，再补充真正需要复核的历史结果。',
      120, 557, 980, 28, { fontSize: 21, bold: true, color: '#FFFFFF' });
    text(s, 's5-caveat', '这是范围选择，不能表述为已经证明新方式更高效。',
      88, 620, 900, 26, { fontSize: 18, color: Theme.muted });
    footer(s, 5); notes(s);
  }

  // Slide 6 — review workflow. Nodes are declared before connector creation only to supply endpoints;
  // connectors are placed behind nodes and labels are added after them.
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 6, '复核先验证可理解性，再进入可讨论版本', '先看别人能否沿记录定位结果的来路，不代替科学结论审查。');
    const nodeY = 238, nodeW = 220, nodeH = 116;
    const xs = [76, 352, 628, 904];
    const nodes = [];
    for (let i = 0; i < 4; i++) nodes.push(rect(s, `s5-node-${i + 1}`, xs[i], nodeY, nodeW, nodeH, '#FFFFFF', 8, Theme.primaryMid, 2));
    const connOpts = { kind: 'straight', fromSide: 'right', toSide: 'left', line: { style: 'solid', fill: Theme.primary, width: 2 }, tail: { type: 'arrow', width: 'sm', length: 'sm' } };
    for (let i = 0; i < 3; i++) { const c = s.shapes.connect(nodes[i], nodes[i + 1], connOpts); c.sendToBack(); }
    const steps = [
      ['01', '提交记录', '执行者提交\n结果及受控引用'],
      ['02', '尝试定位', '另一位成员定位\n数据、脚本和条件'],
      ['03', '补充缺项', '执行者依据反馈\n补齐记录'],
      ['04', '负责人确认', '记录进入\n可讨论版本'],
    ];
    for (let i = 0; i < 4; i++) {
      centerText(s, `s5-step-${i + 1}-label`, `${steps[i][0]}｜${steps[i][1]}`, xs[i] + 18, nodeY + 14, 184, 34,
        { fontSize: 20, bold: true, color: Theme.primaryDark });
      centerText(s, `s5-step-${i + 1}-body`, steps[i][2], xs[i] + 18, nodeY + 58, 184, 44,
        { fontSize: 16, color: Theme.ink });
    }
    rect(s, 's5-gate-surface', 196, 420, 888, 80, Theme.primaryLight, 6);
    text(s, 's5-gate-label', '授权变化时', 226, 444, 150, 28,
      { fontSize: 20, bold: true, color: Theme.primaryDark });
    text(s, 's5-gate-body', '暂停共享 → 负责人处理授权 → 获得明确边界后再继续',
      398, 444, 650, 28, { fontSize: 19, color: Theme.ink });
    text(s, 's5-bottom-note', '复核只检查别人是否能理解结果是怎么产生的；不要求复做整项实验。',
      88, 548, 1030, 28, { fontSize: 18, color: Theme.muted });
    footer(s, 6); notes(s);
  }

  // Slide 6 — four-week pilot timeline
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 7, '四周只验证新增实验能否持续留下可追溯记录', '范围是拟定的试点安排，没有效率提升或完成率实测数字。');
    rect(s, 's6-scope-band', 55, 156, 1170, 64, Theme.primaryDark);
    text(s, 's6-scope', '一个课题方向  ·  两名自愿成员  ·  只记录新增实验', 88, 175, 1000, 28,
      { fontSize: 22, bold: true, color: '#FFFFFF' });
    line(s, 's6-timeline', 122, 382, 1160, 382, Theme.primary, 4);
    const weeks = [
      ['第1周', '共同明确最少字段', '用一个结果试填'],
      ['第2周', '在实际工作中记录', '观察缺项'],
      ['第3周', '继续实际记录', '记录填写负担'],
      ['第4周', '集中讨论试点结果', '保留、修改或停止'],
    ];
    const xs = [122, 458, 794, 1130];
    for (let i = 0; i < 4; i++) {
      rect(s, `s6-week-${i + 1}-node`, xs[i] - 15, 366, 30, 30, Theme.primary, 15);
      centerText(s, `s6-week-${i + 1}-label`, weeks[i][0], xs[i] - 86, 278, 172, 34,
        { fontSize: 22, bold: true, color: Theme.primaryDark });
      text(s, `s6-week-${i + 1}-main`, weeks[i][1], xs[i] - 86, 422, 172, 46,
        { fontSize: 18, bold: true, color: Theme.ink, alignment: 'center' });
      text(s, `s6-week-${i + 1}-sub`, weeks[i][2], xs[i] - 86, 474, 172, 42,
        { fontSize: 16, color: Theme.muted, alignment: 'center' });
    }
    rect(s, 's6-caveat', 88, 560, 1040, 52, Theme.grayFill, 5);
    text(s, 's6-caveat-text', '周次、人数和范围都是拟定边界；试点不以“完成更多”作为预设结论。',
      116, 575, 990, 24, { fontSize: 17, color: Theme.ink });
    footer(s, 7); notes(s);
  }

  // Slide 7 — evaluation questions
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 8, '试点评估看追溯、依据和负担，暂不设统一合格分数', '收集具体复核过程与当事人反馈，再判断是否值得继续。');
    const rows = [
      ['01', '能否定位来源？', '其他成员能否沿记录找到结果的来源？'],
      ['02', '依据是否可理解？', '关键处理与排除是否有可理解的依据？'],
      ['03', '负担是否可持续？', '记录负担是否在成员愿意持续承担的范围内？'],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 178 + i * 112;
      rect(s, `s7-row-${i + 1}`, 88, y, 1040, 84, i === 1 ? Theme.primaryLight : Theme.primaryPale, 5);
      centerText(s, `s7-row-${i + 1}-num`, rows[i][0], 112, y + 18, 56, 42,
        { fontSize: 26, bold: true, color: Theme.primary });
      text(s, `s7-row-${i + 1}-question`, rows[i][1], 202, y + 16, 270, 30,
        { fontSize: 22, bold: true, color: Theme.primaryDark });
      text(s, `s7-row-${i + 1}-detail`, rows[i][2], 500, y + 18, 570, 42,
        { fontSize: 19, color: Theme.ink });
    }
    rect(s, 's7-evidence-band', 88, 536, 1040, 72, Theme.primaryDark, 6);
    text(s, 's7-evidence', '证据来自具体复核过程与当事人反馈。字段填满但仍找不到脚本版本，不能算追溯已解决。',
      116, 558, 980, 30, { fontSize: 18, color: '#FFFFFF' });
    footer(s, 8); notes(s);
  }

  // Slide 8 — decision gate / close
  {
    const s = p.slides.add(); s.background.fill = Theme.bg;
    title(s, 9, '先定范围、授权和复核责任，再决定保留、修改或停止', '本次讨论要确认的是一个有限尝试。');
    rect(s, 's8-main-surface', 55, 160, 720, 414, Theme.primaryLight);
    text(s, 's8-start-heading', '开始试点前确认', 88, 192, 360, 34,
      { fontSize: 24, bold: true, color: Theme.primaryDark });
    bullet(s, 's8-start-1', '负责人确认试点范围与授权联系人', 94, 260, 600, 30, Theme.ink, 19);
    bullet(s, 's8-start-2', '参与成员认可最少字段', 94, 320, 600, 30, Theme.ink, 19);
    bullet(s, 's8-start-3', '确定谁负责复核与最终确认', 94, 380, 600, 30, Theme.ink, 19);
    rect(s, 's8-decision-band', 88, 464, 648, 76, Theme.primaryDark, 6);
    centerText(s, 's8-decision', '一次结果 → 可被理解 → 再决定长期保存', 112, 483, 600, 38,
      { fontSize: 21, bold: true, color: '#FFFFFF' });
    rect(s, 's8-stop-surface', 817, 160, 408, 414, Theme.grayFill);
    text(s, 's8-stop-heading', '出现这些信号，就缩小或停止', 850, 192, 330, 60,
      { fontSize: 23, bold: true, color: Theme.ink });
    bullet(s, 's8-stop-1', '填写持续挤占必要实验时间', 850, 286, 330, 44, Theme.ink, 18);
    bullet(s, 's8-stop-2', '权限边界无法说明', 850, 352, 330, 44, Theme.ink, 18);
    bullet(s, 's8-stop-3', '只增加抄写，没有帮助解释结果', 850, 418, 330, 52, Theme.ink, 18);
    text(s, 's8-close', '归档工具只是承载方式；结果、依据和责任边界的联系，才是试点要验证的内容。',
      88, 610, 1050, 32, { fontSize: 18, color: Theme.primaryDark, bold: true });
    footer(s, 9); notes(s);
  }

  await fs.mkdir(OUT, { recursive: true });
  for (const [idx, slide] of p.slides.items.entries()) {
    const n = idx + 1;
    const layout = await slide.export({ format: 'layout' });
    await fs.writeFile(`${OUT}/slide-${n}.layout.json`, await layout.text());
    await writeBlob(`${OUT}/artifact-slide-${n}.png`, await p.export({ slide, format: 'png', scale: 1 }));
  }
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
  await fs.writeFile(`${OUT}/connections.json`, JSON.stringify({ connections: [
    { slide: 6, source: 's5-node-1', target: 's5-node-2', arrowAt: 'target' },
    { slide: 6, source: 's5-node-2', target: 's5-node-3', arrowAt: 'target' },
    { slide: 6, source: 's5-node-3', target: 's5-node-4', arrowAt: 'target' },
  ] }, null, 2));
}

main().catch(err => { console.error(err); process.exitCode = 1; });
