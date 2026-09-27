import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/focus-a/round-01";
const FONT = "Microsoft YaHei";
const C = {
  primary: "#315F91",
  deep: "#244A73",
  ink: "#252B33",
  muted: "#707780",
  bg: "#FFFFFF",
  line: "#D6DCE3",
  pale: "#F3F6F9",
  bluePale: "#EAF1F8",
  blueWash: "#F5F8FB",
  neutralBlue: "#6C7C8C",
};
const ROLE = {
  cover: { fontSize: 44, bold: true },
  claim: { fontSize: 30, bold: true },
  group: { fontSize: 21, bold: true },
  body: { fontSize: 18, bold: false },
  note: { fontSize: 16, bold: false },
  footer: { fontSize: 12, bold: false },
  metric: { fontSize: 36, bold: true },
};
const roleRecords = [];
const linePaths = [];
const connections = [];
let slideNo = 0;

function rect(slide, name, left, top, width, height, fill, opts = {}) {
  const shape = slide.shapes.add({
    geometry: opts.geometry || "rect",
    name,
    position: { left, top, width, height },
    fill,
    line: opts.line || { style: "solid", fill: "none", width: 0 },
    ...(opts.borderRadius ? { borderRadius: opts.borderRadius } : {}),
  });
  return shape;
}

function rule(slide, name, x1, y1, x2, y2, color = C.line, width = 1) {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), width);
  const h = Math.max(Math.abs(y2 - y1), width);
  const shape = rect(slide, name, left, top, w, h, color);
  linePaths.push({ slide: slideNo, name, from: [x1, y1], to: [x2, y2], relation: "separator", isDivider: true, shape: shape.id });
  return shape;
}

function text(slide, name, value, left, top, width, height, role, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  const spec = ROLE[role];
  shape.text = value;
  shape.text.style = {
    typeface: FONT,
    fontSize: spec.fontSize,
    bold: opts.bold ?? spec.bold,
    color: opts.color || C.ink,
    alignment: opts.alignment || "left",
    verticalAlignment: opts.verticalAlignment || "top",
    lineSpacing: opts.lineSpacing || 1.2,
    wrap: "square",
    autoFit: "none",
    insets: opts.insets || { top: 0, right: 0, bottom: 0, left: 0 },
  };
  roleRecords.push({ slide: slideNo, id: shape.id, name, role, fontSize: spec.fontSize, bold: opts.bold ?? spec.bold });
  return shape;
}

function footer(slide, page) {
  text(slide, `p${page}-footer-left`, "UNIVERSITY BLUE PILOT  /  分析记录试点", 55, 688, 500, 16, "footer", { color: C.muted });
  text(slide, `p${page}-footer-right`, `${String(page).padStart(2, "0")}  /  04`, 1120, 688, 105, 16, "footer", { color: C.muted, alignment: "right" });
}

function header(slide, page, title, eyebrow) {
  text(slide, `p${page}-eyebrow`, eyebrow, 55, 35, 400, 20, "note", { color: C.primary, bold: true });
  text(slide, `p${page}-title`, title, 55, 65, 1170, 46, "claim", { color: C.ink });
  rule(slide, `p${page}-header-rule`, 55, 126, 1225, 126, C.line, 1);
  footer(slide, page);
}

function addNotes(slide, paragraph) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- Internal source: inputs/composition-v2/study.txt (paragraph ${paragraph})\n[/Sources]`);
  slide.speakerNotes.setVisible(true);
}

function addConnector(slide, source, target, label, slideIndex, opts = {}) {
  const connector = slide.shapes.connect(source, target, {
    kind: "straight",
    fromSide: opts.fromSide || "right",
    toSide: opts.toSide || "left",
    line: { style: opts.dashed ? "dashed" : "solid", fill: opts.color || C.primary, width: opts.width || 2 },
    ...(opts.arrow === false ? {} : { tail: { type: "arrow", width: "sm", length: "sm" } }),
  });
  connections.push({ slide: slideIndex, source: source.name, target: target.name, arrowAt: opts.arrow === false ? "none" : "target", relation: label, evidence: opts.evidence || "inputs/composition-v2/study.txt" });
  return connector;
}

function labelPair(slide, node, titleName, titleValue, descName, descValue, box) {
  text(slide, titleName, titleValue, box.left + 12, box.top + 13, box.width - 24, 28, "group", { alignment: "center", verticalAlignment: "middle", color: C.deep });
  text(slide, descName, descValue, box.left + 14, box.top + 51, box.width - 28, box.height - 62, "body", { alignment: "center", verticalAlignment: "middle", color: C.ink, lineSpacing: 1.05 });
}

function slide1(presentation) {
  slideNo = 1;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, 1, "一个结果，需要共同可追溯的记录单元", "ANALYSIS  /  01  ·  RESULT RECORD");

  const x = 55, y = 160, w = 790, h = 458;
  rect(slide, "p1-table-header", x, y, w, 50, C.deep);
  text(slide, "p1-table-header-a", "记录单元", x + 18, y + 14, 220, 24, "group", { color: "#FFFFFF" });
  text(slide, "p1-table-header-b", "共同解释这个结果", x + 250, y + 14, 500, 24, "group", { color: "#FFFFFF" });
  const rows = [
    ["原始数据位置", "知道结果从哪里产生。"],
    ["样本与采集条件", "把结果放回它的采集边界。"],
    ["处理脚本版本", "定位实际运行代码。"],
    ["结果文件", "保留结果本体，便于讨论。"],
    ["异常及排除说明", "说明哪些样本未纳入结果及其依据。"],
  ];
  rows.forEach((row, i) => {
    const ry = y + 50 + i * 69;
    if (i === 4) rect(slide, `p1-row-${i}-wash`, x, ry, w, 69, C.bluePale);
    text(slide, `p1-row-${i}-label`, row[0], x + 18, ry + 18, 220, 28, "group", { color: C.primary });
    text(slide, `p1-row-${i}-body`, row[1], x + 250, ry + 18, 500, 32, "body", { color: C.ink });
    if (i < rows.length - 1) rule(slide, `p1-row-${i}-rule`, x + 16, ry + 68, x + w - 16, ry + 68, C.line, 1);
  });
  text(slide, "p1-table-note", "五项共同解释一个结果，不是五个先后步骤。", x + 18, 580, 720, 26, "note", { color: C.muted });

  const sx = 890, sy = 160, sw = 335, sh = 458;
  rect(slide, "p1-access-surface", sx, sy, sw, sh, C.pale);
  rect(slide, "p1-access-accent", sx, sy, 6, sh, C.primary);
  text(slide, "p1-access-title", "记录完整 ≠ 全部开放", sx + 28, sy + 24, sw - 48, 32, "group", { color: C.deep });
  text(slide, "p1-access-lead", "保存纪律", sx + 28, sy + 79, sw - 48, 26, "group", { color: C.primary });
  text(slide, "p1-access-body", "原始数据保持原貌；清洗另存\n排除样本保留依据。", sx + 28, sy + 113, sw - 48, 66, "body", { color: C.ink, lineSpacing: 1.25 });
  rule(slide, "p1-access-rule", sx + 28, sy + 204, sx + sw - 28, sy + 204, C.line, 1);
  text(slide, "p1-access-scope", "访问边界", sx + 28, sy + 224, sw - 48, 26, "group", { color: C.primary });
  text(slide, "p1-access-body2", "讨论材料：结果图与可公开解释。\n受限数据：留在原授权位置。\n记录只含受控引用与访问条件。", sx + 28, sy + 259, sw - 48, 92, "body", { color: C.ink, lineSpacing: 1.2 });
  text(slide, "p1-access-note", "路径不代表访问权。", sx + 28, sy + 382, sw - 48, 26, "note", { color: C.muted });
  addNotes(slide, 1);
}

function slide2(presentation) {
  slideNo = 2;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, 2, "新增先记，历史按需补：这是范围选择", "ANALYSIS  /  02  ·  SCOPE CHOICE");

  const x = 55, y = 160, labelW = 180, colW = 440, gap = 65;
  const leftX = x + labelW, rightX = leftX + colW + gap;
  rect(slide, "p2-table-header", x, y, 1170, 58, C.pale);
  text(slide, "p2-dimension-head", "比较维度", x + 18, y + 17, labelW - 30, 24, "group", { color: C.muted });
  text(slide, "p2-history-head", "集中补历史", leftX + 15, y + 17, colW - 30, 24, "group", { color: C.neutralBlue });
  text(slide, "p2-new-head", "先记录新增", rightX + 15, y + 17, colW - 30, 24, "group", { color: C.primary });
  rect(slide, "p2-recommend-accent", rightX, y, 5, 58, C.primary);
  const rows = [
    ["可得到什么", "一次形成较大目录。", "上下文清楚时即可记录。"],
    ["代价", "追查遗失上下文耗时。", "短期无法解决全部历史材料追溯。"],
    ["最大边界", "可能把不确定记忆写成确定说明。", "不能把新增记录当成历史补全。"],
  ];
  rows.forEach((row, i) => {
    const ry = y + 58 + i * 86;
    if (i === 1) rect(slide, `p2-row-${i}-wash`, x, ry, 1170, 86, C.blueWash);
    text(slide, `p2-row-${i}-label`, row[0], x + 18, ry + 24, labelW - 30, 30, "group", { color: C.primary });
    text(slide, `p2-row-${i}-left`, row[1], leftX + 15, ry + 21, colW - 30, 46, "body", { color: C.ink });
    text(slide, `p2-row-${i}-right`, row[2], rightX + 15, ry + 21, colW - 30, 46, "body", { color: C.ink });
    if (i < rows.length - 1) rule(slide, `p2-row-${i}-rule`, x + 18, ry + 85, x + 1150, ry + 85, C.line, 1);
  });
  rule(slide, "p2-mid-rule", leftX + colW + gap / 2, y + 12, leftX + colW + gap / 2, y + 316, C.line, 1);
  text(slide, "p2-recommend-label", "原稿建议", 55, 468, 130, 24, "group", { color: C.primary });
  rect(slide, "p2-recommend-surface", 190, 458, 1035, 92, C.bluePale);
  text(slide, "p2-recommend-body", "先记录新增；对真正需要复核的历史结果逐项补充。", 220, 480, 960, 28, "group", { color: C.deep });
  text(slide, "p2-recommend-note", "这是范围选择，没有证明效率提升。", 220, 516, 960, 22, "note", { color: C.muted });
  text(slide, "p2-reading-note", "比较的是覆盖方式与可解释性，不是已测得的效率差。", 55, 593, 1170, 25, "note", { color: C.muted });
  addNotes(slide, 2);
}

function slide3(presentation) {
  slideNo = 3;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, 3, "复核确认的是结果如何产生，不代替科学结论审查", "ANALYSIS  /  03  ·  REVIEW PATH");

  text(slide, "p3-normal-label", "正常复核路径", 55, 151, 250, 25, "group", { color: C.primary });
  const boxes = [
    { name: "p3-node-submit", left: 55, titleName: "p3-node-submit-title", descName: "p3-node-submit-desc", title: "提交", desc: "记录与受控引用" },
    { name: "p3-node-locate", left: 285, titleName: "p3-node-locate-title", descName: "p3-node-locate-desc", title: "定位缺项", desc: "数据、脚本和条件" },
    { name: "p3-node-supplement", left: 515, titleName: "p3-node-supplement-title", descName: "p3-node-supplement-desc", title: "执行者补充", desc: "补齐缺项" },
    { name: "p3-node-confirm", left: 745, titleName: "p3-node-confirm-title", descName: "p3-node-confirm-desc", title: "负责人确认", desc: "确认后继续" },
    { name: "p3-node-discuss", left: 975, titleName: "p3-node-discuss-title", descName: "p3-node-discuss-desc", title: "可讨论版本", desc: "进入讨论" },
  ];
  const shapes = boxes.map(b => rect(slide, b.name, b.left, 198, 185, 118, C.blueWash, { geometry: "roundRect", borderRadius: "rounded-lg", line: { style: "solid", fill: C.line, width: 1 } }));
  for (let i = 0; i < shapes.length - 1; i++) addConnector(slide, shapes[i], shapes[i + 1], "正常复核顺序", 3, { evidence: "study paragraph 3" });
  boxes.forEach((b) => labelPair(slide, null, b.titleName, b.title, b.descName, b.desc, { left: b.left, top: 198, width: 185, height: 118 }));
  rule(slide, "p3-flow-baseline", 55, 336, 1160, 336, C.line, 1);

  text(slide, "p3-exception-label", "新增访问授权时，正常流程暂停", 55, 366, 480, 25, "group", { color: C.primary });
  const ex = [
    { name: "p3-ex-node-detect", left: 115, titleName: "p3-ex-detect-title", descName: "p3-ex-detect-desc", title: "发现授权", desc: "新增访问授权" },
    { name: "p3-ex-node-pause", left: 390, titleName: "p3-ex-pause-title", descName: "p3-ex-pause-desc", title: "暂停共享", desc: "等待负责人处理" },
    { name: "p3-ex-node-owner", left: 665, titleName: "p3-ex-owner-title", descName: "p3-ex-owner-desc", title: "负责人处理", desc: "完成授权处理" },
    { name: "p3-ex-node-resume", left: 940, titleName: "p3-ex-resume-title", descName: "p3-ex-resume-desc", title: "继续共享", desc: "回到复核路径" },
  ];
  const exShapes = ex.map(b => rect(slide, b.name, b.left, 404, 205, 86, C.pale, { geometry: "roundRect", borderRadius: "rounded-lg", line: { style: "solid", fill: C.line, width: 1 } }));
  for (let i = 0; i < exShapes.length - 1; i++) addConnector(slide, exShapes[i], exShapes[i + 1], "授权例外顺序", 3, { color: C.neutralBlue, evidence: "study paragraph 3" });
  ex.forEach((b) => labelPair(slide, null, b.titleName, b.title, b.descName, b.desc, { left: b.left, top: 404, width: 205, height: 86 }));
  rect(slide, "p3-scope-surface", 55, 532, 1170, 86, C.pale);
  text(slide, "p3-scope-title", "复核范围", 82, 550, 150, 25, "group", { color: C.primary });
  text(slide, "p3-scope-body", "检查结果如何产生；不要求复做实验，也不代替科学结论审查。", 250, 550, 920, 28, "body", { color: C.ink });
  addNotes(slide, 3);
}

function slide4(presentation) {
  slideNo = 4;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, 4, "四周试点用过程反馈决定保留、修改或停止", "ANALYSIS  /  04  ·  PILOT DECISION");
  text(slide, "p4-scope-label", "试点范围", 55, 150, 120, 24, "group", { color: C.primary });
  text(slide, "p4-scope-body", "一个课题方向  ·  两名自愿成员  ·  仅记录新增实验", 180, 151, 930, 24, "body", { color: C.ink });

  const weeks = [
    { name: "p4-week1", left: 55, titleName: "p4-week1-title", descName: "p4-week1-desc", title: "第 1 周", desc: "确认最少字段，试填一个结果" },
    { name: "p4-week23", left: 340, titleName: "p4-week23-title", descName: "p4-week23-desc", title: "第 2–3 周", desc: "记录缺项和填写负担" },
    { name: "p4-week4", left: 625, titleName: "p4-week4-title", descName: "p4-week4-desc", title: "第 4 周", desc: "决定保留、修改或停止" },
  ];
  const weekShapes = weeks.map((b, i) => rect(slide, b.name, b.left, 211, 240, 104, i === 2 ? C.bluePale : C.blueWash, { geometry: "roundRect", borderRadius: "rounded-lg", line: { style: "solid", fill: i === 2 ? C.primary : C.line, width: i === 2 ? 2 : 1 } }));
  for (let i = 0; i < weekShapes.length - 1; i++) addConnector(slide, weekShapes[i], weekShapes[i + 1], "四周试点顺序", 4, { evidence: "study paragraph 4" });
  weeks.forEach((b) => labelPair(slide, null, b.titleName, b.title, b.descName, b.desc, { left: b.left, top: 211, width: 240, height: 104 }));
  text(slide, "p4-timeline-note", "过程反馈作决定；不设统一分数。", 910, 246, 315, 42, "note", { color: C.muted });

  text(slide, "p4-eval-title", "评估什么", 55, 370, 240, 28, "group", { color: C.primary });
  text(slide, "p4-eval-body", "来源能否定位\n处理与排除依据能否理解\n负担是否愿意长期承担", 55, 414, 535, 112, "body", { color: C.ink, lineSpacing: 1.35 });
  rule(slide, "p4-column-rule", 625, 370, 625, 570, C.line, 1);
  rect(slide, "p4-stop-surface", 680, 360, 545, 224, C.pale);
  rect(slide, "p4-stop-accent", 680, 360, 5, 224, C.primary);
  text(slide, "p4-stop-title", "何时缩小要求或停止", 710, 386, 470, 28, "group", { color: C.primary });
  text(slide, "p4-stop-body", "持续挤占实验时间\n权限不明\n只有重复抄写，不帮助解释结果", 710, 431, 470, 108, "body", { color: C.ink, lineSpacing: 1.35 });
  rect(slide, "p4-decision-surface", 55, 606, 1170, 50, C.deep);
  text(slide, "p4-decision-body", "第四周决定：保留、修改或停止", 82, 619, 520, 24, "group", { color: "#FFFFFF" });
  text(slide, "p4-decision-note", "范围为拟定；没有实测效率或完成率。", 720, 620, 460, 22, "note", { color: "#E5EDF5", alignment: "right" });
  addNotes(slide, 4);
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  slide1(presentation);
  slide2(presentation);
  slide3(presentation);
  slide4(presentation);
  for (const [i, slide] of presentation.slides.items.entries()) {
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT}/slide-${i + 1}.layout.json`, await layout.text());
  }
  await fs.writeFile(`${OUT}/text-roles.json`, JSON.stringify({ roles: roleRecords }, null, 2));
  await fs.writeFile(`${OUT}/connections.json`, JSON.stringify({ connections }, null, 2));
  await fs.writeFile(`${OUT}/line-paths.json`, JSON.stringify({ linePaths }, null, 2));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
