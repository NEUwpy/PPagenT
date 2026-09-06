import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARTIFACT_TOOL = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";
const { Presentation, PresentationFile } = await import(pathToFileURL(ARTIFACT_TOOL).href);
const { finalizePresentation } = await import(pathToFileURL("C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations/container_tools/artifact_tool_utils.mjs").href);

const workspaceDir = "C:/PPagenT/experiments/neutral-magazine-luna-01/feedback-01";
const buildDir = path.join(workspaceDir, ".codex-build");
const finalPath = path.join(workspaceDir, "deliverables", "deck-feedback-01.pptx");
const BG = "#F5F4EF";
const SURFACE = "#EEECE5";
const DARK = "#20201D";
const BODY = "#4B4A45";
const MUTED = "#85837B";
const LINE = "#D8D5CC";
const ACCENT = "#A35D4F";
const DISPLAY = "Noto Serif SC";
const BODY_FONT = "Noto Sans SC";
const W = 1280;
const H = 720;

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

function box(slide, text, left, top, width, height, style = {}, name = undefined) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: style.typeface ?? BODY_FONT,
    fontSize: style.fontSize ?? 17,
    bold: style.bold ?? false,
    color: style.color ?? BODY,
    alignment: style.alignment ?? "left",
    italic: style.italic ?? false,
  };
  return shape;
}

function rect(slide, left, top, width, height, fill = "none", lineFill = LINE, radius = 0, name = undefined) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineFill === "none" ? 0 : 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function ellipse(slide, left, top, width, height, fill = BG, lineFill = LINE, name = undefined) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineFill === "none" ? 0 : 1 },
  });
}

function line(slide, left, top, width, height, color = LINE, widthPx = 1, style = "solid", name = undefined, flips = {}) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height, ...flips },
    fill: "none",
    line: { style, fill: color, width: widthPx },
  });
}

function addFooter(slide, page) {
  box(slide, String(page).padStart(2, "0"), 1170, 678, 54, 20, { fontSize: 12, color: MUTED, alignment: "right" }, `page-${page}`);
}

function addHeader(slide, chapter, title, page) {
  box(slide, chapter, 56, 44, 40, 28, { typeface: BODY_FONT, fontSize: 15, color: ACCENT, bold: true, alignment: "center" }, `chapter-${page}`);
  box(slide, title, 112, 40, 320, 34, { typeface: DISPLAY, fontSize: 25, color: DARK, bold: true }, `title-${page}`);
  const lineStart = Math.min(430, 112 + Math.max(4, title.length) * 25 + 22);
  line(slide, lineStart, 58, 1200 - lineStart, 0, LINE, 1, "solid", `header-rule-${page}`);
  addFooter(slide, page);
}

function note(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
}

function addArrow(slide, from, to, color = BODY) {
  return slide.shapes.connect(from, to, {
    kind: "elbow",
    fromSide: "right",
    toSide: "left",
    line: { style: "solid", fill: color, width: 1.5 },
    // Artifact Tool renders `tail` at the destination end in its native PPTX export.
    tail: { type: "arrow", width: "med", length: "med" },
  });
}

function addRelationship(slide, from, to, color = BODY) {
  return slide.shapes.connect(from, to, {
    kind: "elbow",
    fromSide: "right",
    toSide: "left",
    line: { style: "solid", fill: color, width: 1.5 },
  });
}

// 1. Cover
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  line(s, 56, 56, 1168, 0, LINE, 1);
  box(s, "讨论稿  /  四周小范围试点", 56, 76, 320, 24, { fontSize: 15, color: ACCENT, bold: true });
  box(s, "实验数据\n归档", 56, 148, 590, 160, { typeface: DISPLAY, fontSize: 58, color: DARK, bold: true });
  box(s, "先把一次结果说明白", 60, 334, 520, 38, { typeface: DISPLAY, fontSize: 21, color: ACCENT, bold: true });
  box(s, "面向课题组教师与研究生的方案讨论\n把结果、依据与责任边界放回同一个记录单元", 60, 402, 520, 92, { fontSize: 17, color: BODY });
  line(s, 60, 538, 270, 0, ACCENT, 2);
  box(s, "这是一项有限尝试：先让一次结果可以被理解，\n再决定哪些记录值得长期保存。", 60, 562, 620, 58, { fontSize: 15, color: MUTED });
  line(s, 770, 148, 0, 420, LINE, 1);
  box(s, "“", 820, 146, 80, 84, { typeface: DISPLAY, fontSize: 72, color: ACCENT });
  box(s, "文件存在，\n不等于结果可以解释。", 820, 226, 350, 110, { typeface: DISPLAY, fontSize: 30, color: DARK, bold: true });
  box(s, "讨论重点", 820, 390, 140, 24, { fontSize: 15, color: ACCENT, bold: true });
  box(s, "试点范围、复核方式、停止信号", 820, 425, 340, 40, { fontSize: 17, color: BODY });
  box(s, "01", 1170, 678, 54, 20, { fontSize: 12, color: MUTED, alignment: "right" });
  note(s, "来源：inputs/manuscript.md。虚构大学场景，仅用于排版验证与方案讨论，不代表已实施项目或真实成效。");
}

// 2. Agenda
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "00", "讨论框架", 2);
  box(s, "讨论只确认一个有限尝试", 56, 116, 640, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "先建立共同问题，再把试点的边界与退出条件说清楚。", 58, 180, 660, 32, { fontSize: 17, color: BODY });
  const rows = [
    ["01", "问题", "找到图片，却说不清来源与依据", "为什么需要记录单元"],
    ["02", "记录", "把结果与依据放在同一个关系里", "哪些内容要保留，哪些访问仍受限"],
    ["03", "试点", "推进思路、复核流程、四周范围", "启动条件与何时缩小或停止"],
    ["04", "评估", "用复核证据与成员反馈决定去留", "保留、修改或停止的信号"],
  ];
  let y = 230;
  for (const [no, head, lead, desc] of rows) {
    ellipse(s, 68, y + 4, 42, 42, ACCENT, ACCENT, `agenda-dot-${no}`);
    box(s, no, 68, y + 14, 42, 18, { fontSize: 14, color: BG, bold: true, alignment: "center" });
    box(s, head, 140, y, 110, 28, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
    box(s, lead, 280, y, 430, 28, { typeface: BODY_FONT, fontSize: 17, color: DARK, bold: true });
    box(s, desc, 280, y + 34, 580, 26, { fontSize: 15, color: MUTED });
    line(s, 140, y + 76, 930, 0, LINE, 1);
    y += 88;
  }
  box(s, "确认范围，而不是承诺效率提升", 820, 604, 340, 24, { typeface: DISPLAY, fontSize: 17, color: ACCENT, bold: true, alignment: "right" });
  note(s, "来源：inputs/manuscript.md 第 1、5、6、8、9 段。页内三项是叙事章节，不是新增事实。");
}

// 3. Problem
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "01", "问题", 3);
  box(s, "文件存在，不等于结果可解释", 56, 116, 720, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "同名文件和个人目录让重复检索变难，但真正的缺口在于关系没有被保留下来。", 58, 180, 770, 48, { fontSize: 17, color: BODY });
  rect(s, 58, 280, 480, 210, SURFACE, "none", 0, "problem-left");
  box(s, "能找到什么", 88, 312, 180, 26, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "最终图片\n某个结果文件\n一条看似明确的结论", 88, 360, 310, 100, { fontSize: 21, color: BODY });
  box(s, "文件位置", 402, 312, 90, 24, { fontSize: 15, color: MUTED, alignment: "right" });
  line(s, 588, 278, 0, 214, LINE, 1);
  rect(s, 638, 280, 550, 210, "none", ACCENT, 0, "problem-right");
  box(s, "仍说不清什么", 668, 312, 220, 26, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "来自哪批样本？\n用了哪版脚本？\n哪些数据被排除，依据是什么？", 668, 360, 430, 100, { fontSize: 21, color: BODY });
  line(s, 58, 558, 1130, 0, LINE, 1);
  box(s, "归档首先要保存结果和依据之间的关系，随后才讨论扩大共享范围。", 58, 590, 760, 34, { typeface: DISPLAY, fontSize: 21, color: ACCENT, bold: true });
  note(s, "来源：inputs/manuscript.md 第 2 段。页面将“可找到结果”和“可解释依据”作概念对照，未引入数量或效果数据。");
}

// 4. Record unit relationship map
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "02", "记录单元", 4);
  box(s, "一个结果需要一组相互关联的依据", 56, 116, 760, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "五项内容共同解释一个结果；清洗与处理另存，异常保留依据。", 58, 180, 780, 32, { fontSize: 17, color: BODY });
  const center = ellipse(s, 530, 330, 220, 104, ACCENT, ACCENT, "record-center");
  box(s, "可讨论\n结果", 545, 351, 190, 62, { typeface: DISPLAY, fontSize: 25, color: BG, bold: true, alignment: "center" });
  const nodes = [
    ["原始数据", 210, 252, "保持原貌"],
    ["样本与条件", 852, 252, "采集上下文"],
    ["处理脚本", 214, 486, "定位实际运行版本"],
    ["结果文件", 846, 486, "对应图与输出"],
    ["异常与排除", 528, 548, "保留判断依据"],
  ];
  // Straight, manually routed relationship lines keep each affiliation legible.
  line(s, 400, 288, 130, 94, BODY, 1.5, "solid", "rel-top-left");
  line(s, 750, 288, 102, 94, BODY, 1.5, "solid", "rel-top-right", { verticalFlip: true });
  line(s, 404, 400, 126, 122, BODY, 1.5, "solid", "rel-bottom-left", { verticalFlip: true });
  line(s, 750, 400, 96, 122, BODY, 1.5, "solid", "rel-bottom-right");
  line(s, 640, 434, 0, 114, BODY, 1.5, "solid", "rel-bottom-center");
  for (const [label, x, y, sub] of nodes) {
    const n = ellipse(s, x, y, 190, 72, BG, LINE, `record-${label}`);
    box(s, label, x + 12, y + 14, 166, 24, { typeface: DISPLAY, fontSize: 17, color: DARK, bold: true, alignment: "center" });
    box(s, sub, x + 12, y + 42, 166, 18, { fontSize: 13, color: MUTED, alignment: "center" });
  }
  box(s, "记录单元", 56, 632, 150, 24, { fontSize: 15, color: ACCENT, bold: true });
  box(s, "结果 + 依据 + 责任边界", 220, 632, 420, 24, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "字段填满仍无法定位脚本版本，追溯问题仍未解决。", 56, 660, 760, 18, { fontSize: 13, color: MUTED });
  note(s, "来源：inputs/manuscript.md 第 3 段。关系图采用原生椭圆与连接线，表达共同解释关系，不表达顺序或数量比例。");
}

// 5. Access boundary
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "02", "访问边界", 5);
  box(s, "记录完整，不等于文件开放", 56, 116, 720, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "记录可以让讨论更清楚，同时保留原始数据的授权边界。", 58, 180, 680, 32, { fontSize: 17, color: BODY });
  rect(s, 58, 278, 420, 244, SURFACE, "none", 0, "access-public");
  box(s, "讨论材料", 88, 310, 180, 28, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "结果图\n可公开的解释\n受控引用", 88, 366, 260, 104, { fontSize: 21, color: BODY });
  box(s, "可以进入讨论材料", 88, 482, 220, 22, { fontSize: 15, color: ACCENT, bold: true });
  rect(s, 802, 278, 420, 244, "none", ACCENT, 0, "access-restricted");
  box(s, "受限原始数据", 832, 310, 220, 28, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "仍放在原授权位置\n记录访问条件\n个人信息与合作限制不变", 832, 366, 300, 104, { fontSize: 21, color: BODY });
  box(s, "授权未确认时暂停共享", 832, 482, 240, 22, { fontSize: 15, color: ACCENT, bold: true });
  line(s, 480, 398, 302, 0, BODY, 1.5);
  box(s, "受控引用\n+ 访问条件", 590, 350, 130, 62, { typeface: DISPLAY, fontSize: 17, color: ACCENT, bold: true, alignment: "center" });
  line(s, 58, 574, 1130, 0, LINE, 1);
  box(s, "记录表中出现一个路径，也不代表其他成员已经取得访问权。", 58, 606, 780, 30, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "新的访问授权须由负责人处理，授权完成后再继续共享。", 58, 642, 780, 18, { fontSize: 15, color: MUTED });
  note(s, "来源：inputs/manuscript.md 第 4 段。页面用左右边界和受控引用表示访问关系，未暗示任何授权已发生。");
}

// 6.推进思路对照
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "03", "推进思路", 6);
  box(s, "历史补档与新增记录各有边界", 56, 116, 860, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "两种推进思路分别解决不同问题，建议先限定范围，再决定是否补历史。", 58, 180, 860, 32, { fontSize: 17, color: BODY });
  rect(s, 58, 260, 500, 250, SURFACE, "none", 0, "history-path");
  box(s, "集中补历史档案", 88, 292, 300, 28, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "可能的收益", 88, 342, 150, 22, { fontSize: 15, color: ACCENT, bold: true });
  box(s, "一次形成较大的目录", 88, 372, 300, 26, { fontSize: 17, color: BODY });
  line(s, 88, 416, 420, 0, LINE, 1);
  box(s, "需要承担的代价", 88, 438, 180, 22, { fontSize: 15, color: MUTED, bold: true });
  box(s, "追查已遗失的上下文，可能耗费大量时间\n不确定的记忆可能被写成确定说明", 88, 468, 410, 48, { fontSize: 17, color: BODY });
  rect(s, 660, 260, 530, 250, "none", ACCENT, 0, "new-path");
  box(s, "从新增实验开始", 690, 292, 300, 28, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "可能的收益", 690, 342, 150, 22, { fontSize: 15, color: ACCENT, bold: true });
  box(s, "上下文尚清楚时记录", 690, 372, 300, 26, { fontSize: 17, color: BODY });
  line(s, 690, 416, 440, 0, LINE, 1);
  box(s, "需要承担的代价", 690, 438, 180, 22, { fontSize: 15, color: MUTED, bold: true });
  box(s, "短期无法解决全部历史材料的追溯问题", 690, 468, 430, 26, { fontSize: 17, color: BODY });
  line(s, 58, 558, 1132, 0, LINE, 1);
  box(s, "建议范围", 58, 586, 150, 24, { fontSize: 15, color: ACCENT, bold: true });
  box(s, "新增实验先行；真正需要复核的历史结果逐项补充。", 220, 582, 800, 30, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  note(s, "来源：inputs/manuscript.md 第 5 段。两侧收益与代价均来自原稿，底部为原稿提出的范围建议；未表述为效率验证结果。\n结构使用：本页为自主原生对照编排，未直接调用比较结构资产。");
}

// 7. Workflow with branch
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "03", "复核流程", 7);
  box(s, "复核先检查可理解性", 56, 116, 620, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "先确认别人能否理解结果如何产生，再进入可讨论版本。", 58, 180, 640, 32, { fontSize: 17, color: BODY });
  const steps = [
    ["01", "提交记录", "执行者提交结果记录\n及受控引用"],
    ["02", "尝试定位", "另一位成员定位数据、\n脚本与条件并提出缺项"],
    ["03", "补充缺项", "执行者补充说明，\n保留异常与排除依据"],
    ["04", "负责人确认", "负责人确认后，\n记录进入可讨论版本"],
  ];
  const boxes = [];
  let x = 58;
  for (const [no, title, body] of steps) {
    const sh = rect(s, x, 286, 244, 144, no === "04" ? ACCENT : SURFACE, no === "04" ? ACCENT : "none", 0, `flow-${no}`);
    box(s, no, x + 18, 304, 40, 22, { fontSize: 15, color: no === "04" ? BG : ACCENT, bold: true });
    box(s, title, x + 18, 338, 200, 26, { typeface: DISPLAY, fontSize: 21, color: no === "04" ? BG : DARK, bold: true });
    box(s, body, x + 18, 378, 208, 46, { fontSize: 15, color: no === "04" ? BG : BODY });
    boxes.push(sh);
    x += 276;
  }
  for (let i = 0; i < boxes.length - 1; i += 1) addArrow(s, boxes[i], boxes[i + 1], BODY);
  line(s, 302, 465, 0, 62, LINE, 1);
  line(s, 302, 527, 270, 0, LINE, 1);
  ellipse(s, 596, 493, 350, 68, BG, ACCENT, "authorization-branch");
  box(s, "如果涉及新的访问授权：\n暂停共享，由负责人处理", 620, 507, 302, 40, { fontSize: 15, color: ACCENT, bold: true, alignment: "center" });
  box(s, "复核不要求复做整项实验，也不代替科学结论审查。", 58, 618, 680, 24, { fontSize: 15, color: MUTED });
  note(s, "来源：inputs/manuscript.md 第 6 段。流程保留提交、定位、补充、确认四个阶段，并保留新的授权分支与暂停条件。");
}

// 8. Pilot scope
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "03", "试点范围", 8);
  box(s, "四周试点只测试一件事", 56, 116, 680, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "范围是拟定安排，不代表已经测得效率提升或完成率。", 58, 180, 620, 32, { fontSize: 17, color: BODY });
  const stats = [["4", "周"], ["1", "个课题方向"], ["2", "名自愿成员"]];
  let sx = 58;
  for (const [num, label] of stats) {
    box(s, num, sx, 256, 90, 70, { typeface: DISPLAY, fontSize: 48, color: ACCENT, bold: true });
    box(s, label, sx + 86, 284, 150, 24, { fontSize: 17, color: DARK, bold: true });
    sx += 260;
  }
  line(s, 58, 360, 1128, 0, LINE, 1);
  const weeks = [
    ["第 1 周", "明确最少字段\n用一个结果试填"],
    ["第 2 周", "在实际工作中\n记录缺项与负担"],
    ["第 3 周", "继续记录\n观察填写负担"],
    ["第 4 周", "讨论保留、修改\n或停止"],
  ];
  let wx = 58;
  for (let i = 0; i < weeks.length; i += 1) {
    ellipse(s, wx + 6, 390, 32, 32, i === 3 ? ACCENT : BG, i === 3 ? ACCENT : ACCENT, `week-${i + 1}`);
    box(s, String(i + 1), wx + 6, 398, 32, 16, { fontSize: 13, color: i === 3 ? BG : ACCENT, bold: true, alignment: "center" });
    box(s, weeks[i][0], wx + 52, 392, 180, 22, { typeface: DISPLAY, fontSize: 17, color: DARK, bold: true });
    box(s, weeks[i][1], wx + 52, 430, 190, 46, { fontSize: 15, color: BODY });
    if (i < weeks.length - 1) line(s, wx + 236, 406, 40, 0, LINE, 1);
    wx += 280;
  }
  line(s, 58, 548, 1128, 0, LINE, 1);
  box(s, "开始试点前", 58, 568, 180, 24, { typeface: DISPLAY, fontSize: 21, color: ACCENT, bold: true });
  box(s, "负责人确认范围与授权联系人", 58, 608, 300, 22, { fontSize: 15, color: BODY });
  box(s, "成员认可最少字段", 430, 608, 240, 22, { fontSize: 15, color: BODY });
  box(s, "明确谁负责复核", 780, 608, 220, 22, { fontSize: 15, color: BODY });
  note(s, "来源：inputs/manuscript.md 第 5、7、9 段。四周、一个方向、两名成员及周次安排均保持拟定口径；启动前补齐范围、授权联系人、最少字段认可和复核责任人，未添加测量数字。");
}

// 9. Evaluation and close
{
  const s = presentation.slides.add();
  s.background.fill = BG;
  addHeader(s, "04", "评估与收束", 9);
  box(s, "是否继续，由复核证据与成员负担决定", 56, 116, 860, 38, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
  box(s, "试点评估先收集具体复核过程和当事人反馈，不预设统一“合格分数”。", 58, 180, 840, 32, { fontSize: 17, color: BODY });
  const qs = [
    ["01", "来源可定位", "其他成员能否沿记录\n定位结果的来源"],
    ["02", "依据可理解", "关键处理与排除\n是否有可理解的依据"],
    ["03", "负担可持续", "填写负担是否在成员\n愿意持续承担的范围内"],
  ];
  let qx = 58;
  for (const [no, head, body] of qs) {
    box(s, no, qx, 276, 60, 34, { typeface: DISPLAY, fontSize: 25, color: ACCENT, bold: true });
    box(s, head, qx, 326, 260, 28, { typeface: DISPLAY, fontSize: 21, color: DARK, bold: true });
    box(s, body, qx, 372, 260, 56, { fontSize: 17, color: BODY });
    if (qx < 600) line(s, qx + 300, 286, 0, 160, LINE, 1);
    qx += 380;
  }
  line(s, 58, 490, 1128, 0, LINE, 1);
  box(s, "停止或修改的信号", 58, 526, 230, 26, { typeface: DISPLAY, fontSize: 21, color: ACCENT, bold: true });
  box(s, "挤占必要实验时间\n权限边界无法说明\n只增加抄写，没有帮助解释结果", 58, 570, 370, 76, { fontSize: 15, color: BODY });
  line(s, 540, 526, 0, 124, LINE, 1);
  box(s, "先让一次结果可以被理解，再决定哪些记录值得长期保存。", 606, 548, 520, 76, { typeface: DISPLAY, fontSize: 25, color: DARK, bold: true });
  box(s, "归档工具只是承载方式；要验证的是结果、依据和责任边界的联系。", 606, 630, 530, 24, { fontSize: 15, color: MUTED });
  note(s, "来源：inputs/manuscript.md 第 8、9 段。收束保留三项评估问题、停止信号和有限尝试的结论，未把方案写成已验证结果。");
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
const candidatePath = path.join(buildDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 9,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: [DISPLAY, BODY_FONT] };
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations/container_tools/inspect_presentation_package_integrity.py",
  layoutValidatorPath: "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations/container_tools/inspect_presentation_layout_geometry.py",
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "deck.validation-feedback-01.json"),
});
console.log(JSON.stringify({ finalPath, candidatePath, result }, null, 2));
