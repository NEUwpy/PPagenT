import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/stability-01/archive-a/round-01";
const W = 1280;
const H = 720;
const C = {
  primary: "#315F91",
  primaryDark: "#24496F",
  primaryPale: "#EAF1F8",
  primaryPaler: "#F5F8FB",
  ink: "#252B33",
  muted: "#707780",
  line: "#D6DEE7",
  white: "#FFFFFF",
  warn: "#8A5A16",
  warnPale: "#FBF4E6",
  stop: "#8A3A3A",
  stopPale: "#F8ECEC",
};
const FONT = "Microsoft YaHei";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function rect(slide, name, x, y, w, h, fill, line = "none", radius = 0) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function line(slide, name, x, y, w, h, color = C.line, width = 1, dash = "solid") {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: dash, fill: color, width },
  });
}

function text(slide, name, value, x, y, w, h, style = {}) {
  const s = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  s.text = value;
  s.text.style = {
    fontSize: style.fontSize ?? 20,
    color: style.color ?? C.ink,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    lineSpacing: style.lineSpacing ?? 1.15,
    typeface: FONT,
    autoFit: "shrinkText",
    wrap: "square",
    insets: style.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return s;
}

function titleBand(slide, titleText, kicker, pageNo) {
  slide.background.fill = C.white;
  text(slide, `kicker-${pageNo}`, kicker, 55, 30, 360, 22, { fontSize: 14, color: C.primary, bold: true });
  text(slide, `title-${pageNo}`, titleText, 55, 57, 1080, 48, { fontSize: 32, color: C.ink, bold: true, lineSpacing: 1.0 });
  line(slide, `accent-${pageNo}`, 55, 118, 90, 4, C.primary, 4);
  text(slide, `page-${pageNo}`, `${String(pageNo).padStart(2, "0")} / 09`, 1112, 34, 113, 20, { fontSize: 14, color: C.muted, alignment: "right" });
  line(slide, `footer-line-${pageNo}`, 55, 681, 1170, 1, C.line, 1);
  text(slide, `footer-${pageNo}`, "归档试点讨论稿｜拟议方案，尚无实测成效", 55, 690, 600, 18, { fontSize: 14, color: C.muted });
}

function sourceNotes(slide) {
  slide.speakerNotes.textFrame.setText("[Sources]\n- 本页内容均据本轮分配原稿 archive.txt；无外部资产与外部事实。\n");
}

function addBulletBlock(slide, name, items, x, y, w, h, opts = {}) {
  const body = items.map(v => `• ${v}`).join("\n");
  return text(slide, name, body, x, y, w, h, { fontSize: opts.fontSize ?? 18, color: opts.color ?? C.ink, lineSpacing: opts.lineSpacing ?? 1.28 });
}

function addNode(slide, name, x, y, w, h, label, fill, opts = {}) {
  const node = rect(slide, name, x, y, w, h, fill, opts.line ?? "none", opts.radius ?? 12);
  text(slide, `${name}-label`, label, x + 12, y + 10, w - 24, h - 20, {
    fontSize: opts.fontSize ?? 20,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? true,
    alignment: "center",
    verticalAlignment: "middle",
    lineSpacing: 1.05,
  });
  return node;
}

function connect(slide, from, to, opts = {}) {
  return slide.shapes.connect(from, to, {
    kind: opts.kind ?? "straight",
    fromSide: opts.fromSide ?? "right",
    toSide: opts.toSide ?? "left",
    line: { style: opts.dash ?? "solid", fill: opts.color ?? C.primary, width: opts.width ?? 2 },
    tail: opts.arrow === false ? { type: "none" } : { type: "triangle", width: "sm", length: "sm" },
  });
}

function slide01(p) {
  const s = p.slides.add();
  s.background.fill = C.white;
  rect(s, "cover-left", 0, 0, 430, H, C.primary);
  text(s, "cover-kicker", "课题组讨论稿 · 归档试点", 58, 78, 300, 28, { fontSize: 16, color: C.white, bold: true });
  text(s, "cover-title", "先把一次结果说明白", 58, 170, 330, 156, { fontSize: 42, color: C.white, bold: true, lineSpacing: 1.03 });
  line(s, "cover-rule", 58, 356, 74, 4, C.white, 4);
  text(s, "cover-sub", "再决定哪些记录值得长期保存", 58, 386, 310, 78, { fontSize: 22, color: C.white, lineSpacing: 1.15 });
  text(s, "cover-right-kicker", "有限尝试 · 四周 · 一个课题方向", 510, 112, 600, 28, { fontSize: 18, color: C.primary, bold: true });
  text(s, "cover-right-title", "讨论是否建立能够解释实验结果的数据归档习惯", 510, 172, 650, 102, { fontSize: 30, color: C.ink, bold: true, lineSpacing: 1.08 });
  rect(s, "cover-purpose", 510, 330, 620, 138, C.primaryPale, "none", 12);
  text(s, "cover-purpose-title", "本次希望确认", 540, 358, 180, 28, { fontSize: 20, color: C.primaryDark, bold: true });
  text(s, "cover-purpose-body", "先让一个新增实验的结果可被他人理解，再决定是否保留、修改或停止。", 540, 398, 530, 56, { fontSize: 20, color: C.ink, lineSpacing: 1.2 });
  text(s, "cover-boundary", "虚构大学场景｜拟议试点，不是已有项目或真实成效", 510, 610, 650, 22, { fontSize: 14, color: C.muted });
  text(s, "cover-page", "01 / 09", 1110, 650, 110, 22, { fontSize: 14, color: C.muted, alignment: "right" });
  sourceNotes(s);
}

function slide02(p) {
  const s = p.slides.add();
  titleBand(s, "文件存在，不等于结果可以解释", "01 现状与问题", 2);
  rect(s, "problem-main", 55, 157, 702, 454, C.primaryPaler, "none", 12);
  text(s, "problem-main-head", "一张图被找到后，还缺什么？", 84, 188, 500, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  rect(s, "problem-result-box", 135, 310, 200, 78, C.primary, "none", 10);
  text(s, "problem-main-result", "最终图片", 145, 320, 180, 58, { fontSize: 26, color: C.white, bold: true, alignment: "center", verticalAlignment: "middle" });
  text(s, "problem-main-bridge", "无法快速说明", 388, 330, 200, 28, { fontSize: 18, color: C.muted, alignment: "center", bold: true });
  line(s, "problem-arrow", 340, 348, 28, 0, C.primary, 2);
  text(s, "problem-main-missing", "哪批样本\n哪版脚本\n哪些被排除", 594, 300, 130, 130, { fontSize: 20, color: C.ink, bold: true, lineSpacing: 1.26 });
  text(s, "problem-main-caption", "同名文件与个人目录让重复检索变难；核心缺口是结果与依据的关系没有被保存。", 84, 492, 600, 78, { fontSize: 20, color: C.ink, lineSpacing: 1.2 });
  rect(s, "problem-side", 791, 157, 434, 454, C.white, C.line, 12);
  text(s, "problem-side-head", "归档先解决的判断", 825, 188, 330, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  addBulletBlock(s, "problem-side-list", ["结果从哪来？", "关键处理依据是什么？", "异常与排除为何成立？"], 825, 260, 350, 155, { fontSize: 20, lineSpacing: 1.42 });
  line(s, "problem-side-rule", 825, 450, 360, 1, C.line, 1);
  text(s, "problem-side-bottom", "先能解释，再讨论扩大共享范围。", 825, 482, 340, 66, { fontSize: 22, color: C.primary, bold: true, lineSpacing: 1.12 });
  sourceNotes(s);
}

function slide03(p) {
  const s = p.slides.add();
  titleBand(s, "一条可讨论记录，必须把结果和依据连在一起", "02 记录单元", 3);
  rect(s, "record-frame", 55, 157, 800, 454, C.primaryPaler, "none", 12);
  text(s, "record-head", "记录单元 = 结果 + 解释依据", 90, 184, 470, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  const center = addNode(s, "record-result", 350, 330, 210, 92, "一次实验结果", C.primary, { color: C.white, fontSize: 24, radius: 14 });
  const n1 = addNode(s, "record-raw", 90, 250, 180, 68, "原始数据位置", C.white, { line: C.line, fontSize: 18 });
  const n2 = addNode(s, "record-cond", 620, 250, 180, 68, "样本与采集条件", C.white, { line: C.line, fontSize: 18 });
  const n3 = addNode(s, "record-script", 90, 468, 180, 68, "处理脚本版本", C.white, { line: C.line, fontSize: 18 });
  const n4 = addNode(s, "record-exc", 620, 468, 180, 68, "异常与排除说明", C.white, { line: C.line, fontSize: 18 });
  connect(s, n1, center, { fromSide: "right", toSide: "left", color: C.primary, width: 2 });
  connect(s, n2, center, { fromSide: "left", toSide: "right", color: C.primary, width: 2 });
  connect(s, n3, center, { fromSide: "right", toSide: "left", color: C.primary, width: 2 });
  connect(s, n4, center, { fromSide: "left", toSide: "right", color: C.primary, width: 2 });
  text(s, "record-note", "这几项共同解释一个结果，不是必须依次执行的五个步骤。", 90, 556, 700, 32, { fontSize: 18, color: C.muted });
  rect(s, "record-side", 887, 157, 338, 454, C.white, C.line, 12);
  text(s, "record-side-head", "写清楚三个边界", 920, 190, 260, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  text(s, "record-side-body", "原始数据保持原貌\n清洗与处理另存\n脚本定位到实际运行代码\n异常保留判断依据\n未纳入样本说明排除条件", 920, 264, 255, 245, { fontSize: 19, color: C.ink, lineSpacing: 1.42 });
  rect(s, "record-side-callout", 920, 535, 258, 52, C.primaryPale, "none", 8);
  text(s, "record-side-callout-text", "“已清理”不能替代依据", 936, 548, 225, 26, { fontSize: 17, color: C.primaryDark, bold: true, alignment: "center", verticalAlignment: "middle" });
  sourceNotes(s);
}

function slide04(p) {
  const s = p.slides.add();
  titleBand(s, "可追溯不等于可见：授权边界随记录保留", "03 访问与责任", 4);
  rect(s, "access-left", 55, 157, 550, 454, C.primaryPaler, "none", 12);
  rect(s, "access-right", 635, 157, 590, 454, C.warnPale, "none", 12);
  text(s, "access-left-head", "讨论材料", 88, 190, 240, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  text(s, "access-left-body", "可以包含结果图\n和可公开的解释", 88, 272, 370, 92, { fontSize: 28, color: C.ink, bold: true, lineSpacing: 1.12 });
  text(s, "access-left-caption", "记录中保留受控引用，帮助定位来源。", 88, 424, 440, 30, { fontSize: 18, color: C.muted });
  text(s, "access-right-head", "受限原始数据", 670, 190, 300, 34, { fontSize: 24, color: C.warn, bold: true });
  text(s, "access-right-body", "仍放在原授权位置\n记录只写引用与访问条件", 670, 272, 450, 92, { fontSize: 28, color: C.ink, bold: true, lineSpacing: 1.12 });
  text(s, "access-right-caption", "个人信息或合作限制不能因归档而改变授权。", 670, 424, 500, 30, { fontSize: 18, color: C.muted });
  line(s, "access-rule", 605, 255, 30, 0, C.primary, 2);
  line(s, "access-rule2", 605, 410, 30, 0, C.primary, 2);
  rect(s, "access-bottom", 190, 536, 900, 46, C.primary, "none", 8);
  text(s, "access-bottom-text", "记录表中出现一个路径，不代表其他成员已经取得访问权。", 210, 548, 860, 24, { fontSize: 18, color: C.white, bold: true, alignment: "center", verticalAlignment: "middle" });
  sourceNotes(s);
}

function slide05(p) {
  const s = p.slides.add();
  titleBand(s, "建议从新增实验开始，历史结果逐项补充", "04 试点范围选择", 5);
  text(s, "scope-lead", "这是范围选择，不是已经证明新方式更高效。", 55, 145, 760, 28, { fontSize: 20, color: C.primary, bold: true });
  rect(s, "scope-new", 55, 205, 535, 338, C.primaryPale, "none", 12);
  rect(s, "scope-history", 690, 205, 535, 338, C.white, C.line, 12);
  text(s, "scope-new-title", "先记录新增实验", 90, 242, 400, 38, { fontSize: 28, color: C.primaryDark, bold: true });
  text(s, "scope-history-title", "集中补历史档案", 725, 242, 400, 38, { fontSize: 28, color: C.ink, bold: true });
  addBulletBlock(s, "scope-new-list", ["上下文尚清楚时记录", "能先检验最少字段", "短期不能解决全部历史追溯"], 95, 330, 440, 150, { fontSize: 20, lineSpacing: 1.35 });
  addBulletBlock(s, "scope-history-list", ["一次形成较大目录", "可能耗时追查遗失上下文", "容易把不确定记忆写成确定说明"], 730, 330, 440, 150, { fontSize: 20, lineSpacing: 1.35 });
  line(s, "scope-bottom-rule", 55, 581, 1170, 1, C.line, 1);
  text(s, "scope-bottom", "建议路径：新增实验先行；真正需要复核的历史结果，再逐项补充。", 55, 596, 1170, 36, { fontSize: 22, color: C.primaryDark, bold: true, alignment: "center" });
  sourceNotes(s);
}

function slide06(p) {
  const s = p.slides.add();
  titleBand(s, "复核先检查：别人能否理解结果如何产生", "05 工作顺序", 6);
  text(s, "workflow-intro", "主路径从提交到可讨论版本；授权问题会暂停共享。", 55, 145, 850, 28, { fontSize: 20, color: C.primary, bold: true });
  const a = addNode(s, "wf-submit", 70, 270, 220, 108, "执行者\n提交记录与受控引用", C.white, { line: C.line, fontSize: 19 });
  const b = addNode(s, "wf-review", 355, 270, 220, 108, "另一位成员\n定位并提出缺项", C.white, { line: C.line, fontSize: 19 });
  const c = addNode(s, "wf-supplement", 640, 270, 220, 108, "执行者\n补充后交负责人", C.white, { line: C.line, fontSize: 19 });
  const d = addNode(s, "wf-ready", 925, 270, 220, 108, "负责人确认\n进入可讨论版本", C.primary, { color: C.white, fontSize: 19 });
  connect(s, a, b, { color: C.primary, width: 2 });
  connect(s, b, c, { color: C.primary, width: 2 });
  connect(s, c, d, { color: C.primary, width: 2 });
  rect(s, "wf-gate", 520, 455, 260, 76, C.warnPale, "none", 10);
  text(s, "wf-gate-label", "若涉及新的访问授权\n暂停共享，由负责人处理", 540, 470, 220, 46, { fontSize: 18, color: C.warn, bold: true, alignment: "center", verticalAlignment: "middle" });
  connect(s, c, s.shapes.add({ geometry: "rect", name: "wf-gate-anchor", position: { left: 649, top: 455, width: 2, height: 2 }, fill: "none", line: { style: "solid", fill: "none", width: 0 } }), { fromSide: "bottom", toSide: "top", color: C.warn, dash: "dashed", arrow: false });
  text(s, "wf-clarify", "复核不要求复做整项实验，也不代替科学结论审查；它先检查别人是否能理解这个结果是怎么产生的。", 70, 574, 1070, 42, { fontSize: 18, color: C.muted, lineSpacing: 1.18 });
  sourceNotes(s);
}

function slide07(p) {
  const s = p.slides.add();
  titleBand(s, "四周试点只验证记录能否被持续使用", "06 试点安排", 7);
  rect(s, "pilot-left", 55, 157, 775, 454, C.primaryPaler, "none", 12);
  rect(s, "pilot-right", 865, 157, 360, 454, C.white, C.line, 12);
  text(s, "pilot-left-head", "拟定范围", 88, 190, 200, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  const weeks = [
    ["第 1 周", "明确最少字段\n用一个结果试填"],
    ["第 2–3 周", "在实际工作中记录\n缺项与填写负担"],
    ["第 4 周", "讨论保留、修改\n或停止"],
  ];
  const xs = [90, 320, 550];
  for (let i = 0; i < weeks.length; i++) {
    rect(s, `pilot-week-${i}`, xs[i], 286, 190, 170, i === 0 ? C.primary : C.white, i === 0 ? "none" : C.line, 10);
    text(s, `pilot-week-title-${i}`, weeks[i][0], xs[i] + 18, 317, 154, 28, { fontSize: 20, color: i === 0 ? C.white : C.primaryDark, bold: true, alignment: "center", verticalAlignment: "middle" });
    text(s, `pilot-week-body-${i}`, weeks[i][1], xs[i] + 18, 365, 154, 60, { fontSize: 18, color: i === 0 ? C.white : C.ink, alignment: "center", verticalAlignment: "middle", lineSpacing: 1.22 });
    if (i < weeks.length - 1) line(s, `pilot-arrow-${i}`, xs[i] + 192, 370, 32, 0, C.primary, 2);
  }
  text(s, "pilot-left-foot", "一个课题方向 · 两名自愿成员 · 记录新增实验", 90, 515, 650, 28, { fontSize: 18, color: C.muted, bold: true });
  text(s, "pilot-right-head", "边界提醒", 900, 190, 250, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  text(s, "pilot-right-body", "四周、两人和周次\n都是拟定范围\n\n没有实测效率提升\n或完成率数字", 900, 270, 260, 190, { fontSize: 22, color: C.ink, bold: true, lineSpacing: 1.3 });
  rect(s, "pilot-right-tag", 900, 514, 260, 48, C.warnPale, "none", 8);
  text(s, "pilot-right-tag-text", "先观察，再决定", 920, 526, 220, 24, { fontSize: 18, color: C.warn, bold: true, alignment: "center", verticalAlignment: "middle" });
  sourceNotes(s);
}

function slide08(p) {
  const s = p.slides.add();
  titleBand(s, "评估围绕三个问题展开，不先设统一合格分数", "07 评估与停止", 8);
  rect(s, "eval-main", 55, 157, 740, 454, C.primaryPaler, "none", 12);
  text(s, "eval-head", "收集具体复核过程与当事人反馈", 88, 190, 600, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  const q = [
    ["01", "能否定位来源？", "沿记录找到结果、数据、脚本和条件"],
    ["02", "依据是否可理解？", "看懂关键处理与排除的理由"],
    ["03", "负担能否持续？", "成员愿意继续承担填写工作"],
  ];
  for (let i = 0; i < q.length; i++) {
    const yy = 270 + i * 90;
    text(s, `eval-num-${i}`, q[i][0], 92, yy, 54, 36, { fontSize: 28, color: C.primary, bold: true, alignment: "center" });
    text(s, `eval-q-${i}`, q[i][1], 165, yy, 250, 30, { fontSize: 21, color: C.ink, bold: true });
    text(s, `eval-a-${i}`, q[i][2], 430, yy, 305, 38, { fontSize: 18, color: C.muted, lineSpacing: 1.15 });
  }
  rect(s, "eval-side", 835, 157, 390, 454, C.stopPale, "none", 12);
  text(s, "eval-side-head", "停止或修改的信号", 870, 190, 310, 34, { fontSize: 24, color: C.stop, bold: true });
  addBulletBlock(s, "eval-side-list", ["填写持续挤占必要实验时间", "权限边界无法说明", "重复抄写却没有帮助解释结果"], 870, 278, 310, 180, { fontSize: 19, color: C.ink, lineSpacing: 1.35 });
  text(s, "eval-side-foot", "先缩小要求或停止试点，不能为完成目标强行推广。", 870, 516, 310, 58, { fontSize: 18, color: C.stop, bold: true, lineSpacing: 1.18 });
  sourceNotes(s);
}

function slide09(p) {
  const s = p.slides.add();
  titleBand(s, "开始前只需确认范围、字段与责任", "08 讨论决定", 9);
  rect(s, "decision-main", 55, 157, 760, 454, C.primary, "none", 12);
  text(s, "decision-main-head", "本次需要确认", 92, 190, 300, 34, { fontSize: 24, color: C.white, bold: true });
  const items = [
    "负责人确认试点范围与授权联系人",
    "参与成员认可最少字段",
    "确定谁负责复核",
  ];
  for (let i = 0; i < items.length; i++) {
    const yy = 270 + i * 78;
    rect(s, `decision-num-box-${i}`, 96, yy, 44, 44, C.white, "none", 22);
    text(s, `decision-num-${i}`, `${i + 1}`, 104, yy + 8, 28, 28, { fontSize: 20, color: C.primary, bold: true, alignment: "center", verticalAlignment: "middle" });
    text(s, `decision-item-${i}`, items[i], 170, yy + 4, 570, 36, { fontSize: 22, color: C.white, bold: true, verticalAlignment: "middle" });
  }
  text(s, "decision-main-foot", "先让一次结果可以被理解，再决定哪些记录值得长期保存。", 92, 522, 650, 54, { fontSize: 22, color: C.white, bold: true, lineSpacing: 1.15 });
  rect(s, "decision-side", 855, 157, 370, 454, C.primaryPaler, "none", 12);
  text(s, "decision-side-head", "把握住验证对象", 890, 190, 290, 34, { fontSize: 24, color: C.primaryDark, bold: true });
  text(s, "decision-side-body", "归档工具只是承载方式。\n\n这次试点要验证的，是：\n结果、依据和责任边界\n能否被连在一起。", 890, 274, 295, 190, { fontSize: 21, color: C.ink, bold: true, lineSpacing: 1.32 });
  text(s, "decision-side-label", "有限尝试 · 方案讨论口径", 890, 536, 290, 28, { fontSize: 17, color: C.primary, bold: true });
  sourceNotes(s);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  slide01(p); slide02(p); slide03(p); slide04(p); slide05(p); slide06(p); slide07(p); slide08(p); slide09(p);
  for (const [i, slide] of p.slides.items.entries()) {
    const n = i + 1;
    await writeBlob(`${OUT}/artifact-slide-${n}.png`, await p.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(`${OUT}/slide-${n}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(`${OUT}/artifact-montage.webp`, await p.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
