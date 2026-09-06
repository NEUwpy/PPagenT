import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:/PPagenT";
const OUT = path.resolve("C:/PPagenT/experiments/neutral-magazine-reference-02");
const SRC = path.resolve("C:/PPagenT/experiments/neutral-magazine-luna-01/inputs/manuscript.md");
const C = Object.freeze({
  bg: "#F5F4EF", surface: "#EEECE5", ink: "#20201D", body: "#4B4A45",
  muted: "#85837B", line: "#D8D5CC", brick: "#A35D4F", white: "#FBFAF6",
});
const F = Object.freeze({ display: "Noto Serif SC", body: "Noto Sans SC" });
const PX = Object.freeze({ cover: 58, title: 25, module: 21, node: 17, body: 17, aux: 15, number: 48 });

function qaParent(id, domains = []) { return `PPAGENT_QA|parent=${id}${domains.length ? `|domains=${domains.join(",")}` : ""}`; }
function qaWithin(id, role) { return `PPAGENT_QA|within=${id}|role=${role}`; }
function addText(slide, text, frame, { role = "body", color = C.body, bold = false, align = "left", valign = "top", name, font = role === "body" || role === "aux" ? F.body : F.display, size = PX[role] ?? PX.body } = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name, position: frame, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = String(text ?? "");
  shape.text.style = { fontSize: size, typeface: font, color, bold, alignment: align, verticalAlignment: valign, autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return shape;
}
function addRect(slide, frame, { fill = "none", line = C.line, width = 1, name, radius = "rounded-none" } = {}) {
  return slide.shapes.add({ geometry: "rect", name, position: frame, fill, line: { style: "solid", fill: line, width }, borderRadius: radius });
}
function addCircle(slide, frame, { fill = "none", line = C.line, width = 1, name } = {}) {
  return slide.shapes.add({ geometry: "ellipse", name, position: frame, fill, line: { style: "solid", fill: line, width } });
}
function addLine(slide, from, to, { color = C.line, width = 1.2, name } = {}) {
  const pos = { left: Math.min(from.x, to.x), top: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y), horizontalFlip: to.x < from.x, verticalFlip: to.y < from.y };
  return slide.shapes.add({ geometry: "line", name, position: pos, fill: "none", line: { style: "solid", fill: color, width } });
}
function addArrow(slide, a, b, color = C.brick, name) {
  const from = { x: a.left + a.width, y: a.top + a.height / 2 };
  const to = { x: b.left, y: b.top + b.height / 2 };
  addLine(slide, from, to, { color, width: 1.3, name });
  addCircle(slide, { left: to.x - 4, top: to.y - 4, width: 8, height: 8 }, { fill: color, line: color, width: 0, name: "workflow-arrow-endpoint" });
}
function addDoubleDigit(slide, value, x, y, { color = C.brick, size = PX.module, width = 16, prefix = "digit" } = {}) {
  String(value).padStart(2, "0").slice(-2).split("").forEach((char, index) => addText(slide, char, { left: x + index * width, top: y, width, height: 30 }, { role: "module", color, size, font: F.display, valign: "top", name: `${prefix}-${index}` }));
}
function shell(slide, chapter, title, page) {
  slide.background.fill = C.bg;
  addDoubleDigit(slide, chapter, 56, 36, { color: C.brick, size: PX.module, width: 11, prefix: `chapter-${page}` });
  addText(slide, title, { left: 104, top: 35, width: 300, height: 34 }, { role: "title", color: C.ink, bold: true, size: PX.title, font: F.display, valign: "middle" });
  addLine(slide, { x: 395, y: 52 }, { x: 1224, y: 52 }, { color: C.line, width: 1 });
  addDoubleDigit(slide, page, 1195, 678, { color: C.muted, size: PX.aux, width: 10, prefix: `page-${page}` });
}
function foot(slide, left = "课题组讨论 · 数据归档试点") {
  addText(slide, left, { left: 56, top: 676, width: 300, height: 18 }, { role: "aux", color: C.muted, size: PX.aux });
}
function label(slide, text, x, y, w, color = C.brick) { addText(slide, text, { left: x, top: y, width: w, height: 22 }, { role: "aux", color, size: PX.aux, font: F.body }); }
function block(slide, id, frame, title, body, { accent = C.ink, fill = "none", titleSize = PX.module, bodySize = PX.body, line = C.line, domains = ["content"] } = {}) {
  if (fill !== "none" || line !== "none") addRect(slide, frame, { fill, line, width: line === "none" ? 0 : 1, name: qaParent(id, domains) });
  const ix = fill === "none" ? 0 : 20;
  addText(slide, title, { left: frame.left + ix, top: frame.top + 14, width: frame.width - ix * 2, height: 28 }, { role: "module", color: accent, bold: true, size: titleSize, font: F.display, name: qaWithin(id, "title") });
  addText(slide, body, { left: frame.left + ix, top: frame.top + 51, width: frame.width - ix * 2, height: frame.height - 61 }, { role: "body", color: C.body, size: bodySize, font: F.body, name: qaWithin(id, "body") });
}
function drawCover(p) {
  p.background.fill = C.bg;
  addText(p, "先把一次\n结果说明白", { left: 56, top: 118, width: 560, height: 128 }, { role: "cover", size: PX.cover, font: F.display, color: C.ink, valign: "middle" });
  addText(p, "实验数据归档试点讨论", { left: 60, top: 315, width: 390, height: 30 }, { role: "module", size: PX.module, font: F.body, color: C.brick });
  addLine(p, { x: 60, y: 364 }, { x: 430, y: 364 }, { color: C.brick, width: 1.4 });
  addText(p, "受众：课题组教师与研究生\n目的：讨论是否用四周、小范围试点，建立能够解释实验结果的数据归档习惯。", { left: 60, top: 405, width: 510, height: 74 }, { role: "body", size: PX.body, color: C.body });
  addLine(p, { x: 860, y: 170 }, { x: 860, y: 520 }, { color: C.line, width: 1 });
  addText(p, "R", { left: 894, top: 192, width: 80, height: 64 }, { role: "number", size: PX.number, color: C.brick, font: F.display });
  addText(p, "record unit", { left: 899, top: 270, width: 180, height: 20 }, { role: "aux", size: PX.aux, color: C.muted, font: F.body });
  addText(p, "结果 = 证据 + 责任边界", { left: 899, top: 323, width: 290, height: 28 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
  addText(p, "一次结果能否被别人理解，先于是否扩大共享范围。", { left: 899, top: 389, width: 250, height: 48 }, { role: "body", size: PX.body, color: C.body });
  addText(p, "有限尝试 · 方案讨论口径", { left: 56, top: 665, width: 300, height: 20 }, { role: "aux", color: C.muted, size: PX.aux });
  addDoubleDigit(p, 1, 1195, 678, { color: C.muted, size: PX.aux, width: 10, prefix: "page-cover" });
}

function drawProblem(p) {
  shell(p, "01", "问题从哪里开始", 2); foot(p);
  addText(p, "找到最终图片，不等于能够解释它", { left: 56, top: 100, width: 620, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display, color: C.ink });
  addText(p, "课题组讨论一张实验曲线时，经常能找到最终图片，却不能快速说明图片来自哪批样本、用了哪版脚本、哪些数据被排除。", { left: 56, top: 151, width: 730, height: 52 }, { role: "body", size: PX.body });
  addText(p, "文件存在，结果仍可能无法解释。", { left: 56, top: 238, width: 560, height: 34 }, { role: "module", size: PX.module, color: C.brick, font: F.display });
  const items = [
    ["最终图片", "结果看得到，来源说不清"], ["样本批次", "条件无法快速还原"], ["脚本版本", "处理过程难以定位"], ["排除依据", "只留下“已清理”"],
  ];
  items.forEach(([t, b], i) => {
    const x = 56 + i * 286;
    addLine(p, { x, y: 332 }, { x: x + 222, y: 332 }, { color: i === 0 ? C.brick : C.line, width: 1.4, name: qaParent(`problem-rule-${i}`) });
    addText(p, t, { left: x, top: 348, width: 222, height: 28 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
    addText(p, b, { left: x, top: 389, width: 222, height: 42 }, { role: "body", size: PX.body });
  });
  addRect(p, { left: 56, top: 514, width: 1168, height: 88 }, { fill: C.surface, line: C.surface, width: 0, name: qaParent("problem-thesis", ["conclusion"]) });
  addText(p, "归档首先要保存结果和依据之间的关系，随后才讨论扩大共享范围。", { left: 82, top: 536, width: 1084, height: 36 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
}

function drawRecordUnit(p) {
  shell(p, "02", "记录单元", 3); foot(p);
  addText(p, "一个可讨论的实验结果，由五项依据共同解释", { left: 56, top: 100, width: 720, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display, color: C.ink });
  addText(p, "这些项目共同解释一个结果，并不是必须依次执行的五个步骤。", { left: 56, top: 151, width: 720, height: 28 }, { role: "body", size: PX.body });
  const inputs = [
    ["原始数据位置", "保持原貌，指向真实来源"], ["样本与采集条件", "说明结果来自哪批样本"], ["处理脚本版本", "定位实际运行的代码"], ["结果文件", "保留可讨论的最终产物"], ["异常与排除说明", "保留判断依据与排除条件"],
  ];
  const ys = [252, 322, 392, 462, 532];
  const nodeFrames = [];
  inputs.forEach(([t, b], i) => {
    const f = { left: 74, top: ys[i], width: 280, height: 54 };
    nodeFrames.push(f);
    addRect(p, f, { fill: i === 4 ? C.surface : "none", line: i === 4 ? C.brick : C.line, width: 1, name: qaParent(`record-input-${i}`, ["record-input"]) });
    addText(p, t, { left: 90, top: ys[i] + 7, width: 240, height: 22 }, { role: "module", size: PX.module, color: i === 4 ? C.brick : C.ink, font: F.display, name: qaWithin(`record-input-${i}`, "title") });
    addText(p, b, { left: 90, top: ys[i] + 32, width: 240, height: 16 }, { role: "aux", size: PX.aux, color: C.muted, font: F.body, name: qaWithin(`record-input-${i}`, "body") });
    addLine(p, { x: 354, y: ys[i] + 27 }, { x: 676, y: 392 }, { color: i === 4 ? C.brick : C.line, width: 1.2, name: `record-link-${i}` });
  });
  addCircle(p, { left: 678, top: 324, width: 136, height: 136 }, { fill: C.brick, line: C.brick, width: 1, name: qaParent("record-core", ["record-result"]) });
  addText(p, "记录单元", { left: 694, top: 360, width: 104, height: 28 }, { role: "module", size: PX.module, color: C.white, align: "center", valign: "middle", font: F.display, name: qaWithin("record-core", "title") });
  addText(p, "结果 + 依据", { left: 694, top: 393, width: 104, height: 22 }, { role: "aux", size: PX.aux, color: C.white, align: "center", font: F.body, name: qaWithin("record-core", "body") });
  addLine(p, { x: 814, y: 392 }, { x: 964, y: 392 }, { color: C.brick, width: 1.6, name: "record-result-line" });
  addRect(p, { left: 964, top: 332, width: 254, height: 120 }, { fill: C.surface, line: C.brick, width: 1, name: qaParent("record-output", ["record-result"]) });
  addText(p, "可讨论的实验结果", { left: 988, top: 362, width: 206, height: 32 }, { role: "module", size: PX.module, color: C.ink, font: F.display, name: qaWithin("record-output", "title") });
  addText(p, "别人可以沿记录理解\n它是怎么产生的", { left: 988, top: 405, width: 206, height: 40 }, { role: "body", size: PX.body, color: C.body, name: qaWithin("record-output", "body") });
  addText(p, "清洗与处理另存；未纳入结果的样本也要解释排除条件。", { left: 74, top: 620, width: 860, height: 24 }, { role: "aux", size: PX.aux, color: C.muted });
}

function drawAccess(p) {
  shell(p, "02", "访问边界", 4); foot(p);
  addText(p, "记录完整，不等于所有人都能看到全部文件", { left: 56, top: 100, width: 760, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display });
  addText(p, "归档记录解释结果的来源，同时保留现有授权边界。", { left: 56, top: 151, width: 620, height: 28 }, { role: "body", size: PX.body });
  const left = { left: 80, top: 270, width: 440, height: 196 };
  const right = { left: 760, top: 270, width: 440, height: 196 };
  addRect(p, left, { fill: C.surface, line: C.line, width: 1, name: qaParent("access-discussion", ["access-domain"]) });
  addRect(p, right, { fill: "none", line: C.line, width: 1, name: qaParent("access-restricted", ["access-domain"]) });
  addText(p, "可讨论材料", { left: 110, top: 300, width: 250, height: 30 }, { role: "module", size: PX.module, color: C.ink, bold: true, font: F.display });
  addText(p, "结果图\n可公开的解释\n受控引用与访问条件", { left: 110, top: 350, width: 310, height: 90 }, { role: "body", size: PX.body });
  addText(p, "受限原始数据", { left: 790, top: 300, width: 280, height: 30 }, { role: "module", size: PX.module, color: C.brick, bold: true, font: F.display });
  addText(p, "仍放在原授权位置\n个人信息与合作限制继续有效\n记录中的路径不代表成员已获访问权", { left: 790, top: 350, width: 330, height: 100 }, { role: "body", size: PX.body });
  addLine(p, { x: 520, y: 373 }, { x: 760, y: 373 }, { color: C.brick, width: 1.4, name: "access-boundary-line" });
  addCircle(p, { left: 627, top: 358, width: 30, height: 30 }, { fill: C.brick, line: C.brick, width: 1, name: qaParent("access-boundary", ["access-boundary"]) });
  addText(p, "授权边界", { left: 585, top: 411, width: 114, height: 24 }, { role: "aux", size: PX.aux, color: C.brick, align: "center" });
  addText(p, "涉及新的访问授权时，暂停共享，由负责人处理授权后再继续。", { left: 80, top: 560, width: 1060, height: 28 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
}

function drawChoice(p) {
  shell(p, "03", "试点起点", 5); foot(p);
  addText(p, "先处理什么，决定试点能否留下可信上下文", { left: 56, top: 100, width: 760, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display });
  addText(p, "两种推进思路都是范围选择，各自保留一部分价值，也带来一部分代价。", { left: 56, top: 151, width: 760, height: 28 }, { role: "body", size: PX.body });
  const A = { left: 96, top: 280, width: 382, height: 220 };
  const B = { left: 802, top: 280, width: 382, height: 220 };
  addRect(p, A, { fill: "none", line: C.line, width: 1, name: qaParent("choice-history", ["choice-side"]) });
  addRect(p, B, { fill: C.surface, line: C.brick, width: 1, name: qaParent("choice-new", ["choice-side"]) });
  addText(p, "集中补历史档案", { left: 124, top: 313, width: 300, height: 30 }, { role: "module", size: PX.module, color: C.ink, bold: true, font: F.display });
  addText(p, "一次形成较大的目录\n但可能耗费大量时间追查遗失上下文，\n把不确定记忆写成确定说明。", { left: 124, top: 365, width: 306, height: 92 }, { role: "body", size: PX.body });
  addText(p, "先记录新增实验", { left: 830, top: 313, width: 300, height: 30 }, { role: "module", size: PX.module, color: C.brick, bold: true, font: F.display });
  addText(p, "上下文尚清楚时记录，\n但短期内无法解决全部历史材料的追溯问题。", { left: 830, top: 365, width: 306, height: 68 }, { role: "body", size: PX.body });
  addLine(p, { x: 478, y: 390 }, { x: 802, y: 390 }, { color: C.brick, width: 1.4, name: "choice-axis" });
  addText(p, "范围选择", { left: 584, top: 353, width: 136, height: 24 }, { role: "aux", size: PX.aux, color: C.brick, font: F.body, align: "center", valign: "middle" });
  addText(p, "对新增实验试行，对真正需要复核的历史结果逐项补充。", { left: 96, top: 555, width: 1060, height: 30 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
  addText(p, "这是一种范围选择，不能表述为已经证明新方式更高效。", { left: 96, top: 600, width: 680, height: 22 }, { role: "aux", size: PX.aux, color: C.muted });
}

function drawWorkflow(p) {
  shell(p, "04", "记录进入讨论", 6); foot(p);
  addText(p, "记录版本沿着复核与补充逐步成形", { left: 56, top: 100, width: 660, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display });
  addText(p, "复核先检查别人能否理解结果如何产生，不要求复做整项实验，也不代替科学结论审查。", { left: 56, top: 151, width: 920, height: 28 }, { role: "body", size: PX.body });
  const nodes = [
    { id: "wf-submit", x: 74, title: "提交记录", body: "执行者提交结果记录\n及受控引用" },
    { id: "wf-review", x: 354, title: "尝试定位", body: "另一位成员定位数据、\n脚本与条件，提出缺项" },
    { id: "wf-supplement", x: 634, title: "补充缺项", body: "执行者补充上下文，\n再交负责人确认" },
    { id: "wf-ready", x: 914, title: "可讨论版本", body: "记录进入讨论，\n依据关系清楚" },
  ];
  const frames = [];
  nodes.forEach((n, i) => {
    const f = { left: n.x, top: 300, width: 220, height: 146 }; frames.push(f);
    addRect(p, f, { fill: i === 3 ? C.brick : C.surface, line: i === 3 ? C.brick : C.line, width: 1, name: qaParent(n.id, ["workflow-stage"]) });
    addText(p, String(i + 1).padStart(2, "0"), { left: n.x + 18, top: 318, width: 36, height: 22 }, { role: "aux", size: PX.aux, color: i === 3 ? C.white : C.brick, font: F.body, name: qaWithin(n.id, "index") });
    addText(p, n.title, { left: n.x + 18, top: 349, width: 184, height: 28 }, { role: "module", size: PX.module, color: i === 3 ? C.white : C.ink, font: F.display, name: qaWithin(n.id, "title") });
    addText(p, n.body, { left: n.x + 18, top: 389, width: 184, height: 42 }, { role: "body", size: PX.body, color: i === 3 ? C.white : C.body, name: qaWithin(n.id, "body") });
  });
  for (let i = 0; i < frames.length - 1; i += 1) addArrow(p, frames[i], frames[i + 1], C.brick, `PPAGENT_CONNECTOR|from=${nodes[i].id}|fromSide=right|to=${nodes[i + 1].id}|toSide=left`);
  [2, 3].forEach((i) => {
    const x = nodes[i].x - 28;
    addLine(p, { x, y: 360 }, { x, y: 386 }, { color: C.brick, width: 1.4, name: `gate-${i}` });
    addText(p, i === 2 ? "缺项" : "负责人确认", { left: i === 3 ? 796 : x - 46, top: 329, width: i === 3 ? 120 : 92, height: 20 }, { role: "aux", size: PX.aux, color: C.brick, align: "center" });
  });
  addLine(p, { x: 744, y: 446 }, { x: 744, y: 530 }, { color: C.brick, width: 1.2, name: "workflow-authorization-branch" });
  addText(p, "涉及新的访问授权", { left: 790, top: 470, width: 260, height: 26 }, { role: "module", size: PX.module, color: C.brick, font: F.display });
  addText(p, "暂停共享，由负责人处理授权后再继续", { left: 790, top: 512, width: 360, height: 24 }, { role: "body", size: PX.body });
  addText(p, "推进条件是记录可理解且授权边界清楚。", { left: 74, top: 588, width: 700, height: 24 }, { role: "aux", size: PX.aux, color: C.muted });
}

function drawPilot(p) {
  shell(p, "05", "四周试点", 7); foot(p);
  addText(p, "先用一个课题方向，观察记录是否能被持续承担", { left: 56, top: 100, width: 780, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display });
  addText(p, "拟定范围：一个课题方向、两名自愿成员、只记录新增实验。四周安排没有实测效率提升或完成率数字。", { left: 56, top: 151, width: 1000, height: 28 }, { role: "body", size: PX.body });
  const weeks = [
    ["第1周", "共同定字段", "明确最少字段，用一个结果试填"],
    ["第2–3周", "实际记录与观察", "记录缺项与填写负担，收集复核过程"],
    ["第4周", "讨论去留", "保留、修改或停止"],
  ];
  addLine(p, { x: 96, y: 342 }, { x: 712, y: 342 }, { color: C.line, width: 1.4, name: "pilot-timeline" });
  weeks.forEach(([n, t, b], i) => {
    const x = [112, 390, 668][i];
    addCircle(p, { left: x, top: 316, width: 52, height: 52 }, { fill: i === weeks.length - 1 ? C.brick : C.bg, line: C.brick, width: 1.4, name: qaParent(`pilot-week-${i}`, ["pilot-week"]) });
    addText(p, n, { left: x - 25, top: 331, width: 102, height: 20 }, { role: "aux", size: PX.aux, color: i === weeks.length - 1 ? C.white : C.brick, align: "center", font: F.body });
    addText(p, t, { left: x - 72, top: 389, width: 150, height: 48 }, { role: "module", size: PX.module, color: C.ink, align: "center", font: F.display });
    addText(p, b, { left: x - 72, top: 440, width: 150, height: 66 }, { role: "aux", size: PX.aux, color: C.body, align: "center", font: F.body });
  });
  addLine(p, { x: 780, y: 242 }, { x: 780, y: 604 }, { color: C.line, width: 1 });
  addText(p, "试点评估回答三个问题", { left: 834, top: 248, width: 350, height: 28 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
  const qs = ["能否沿记录定位结果来源", "关键处理与排除是否有可理解依据", "记录负担是否在愿意持续承担的范围内"];
  qs.forEach((q, i) => {
    addText(p, String(i + 1).padStart(2, "0"), { left: 836, top: 318 + i * 84, width: 32, height: 24 }, { role: "module", size: PX.module, color: C.brick, font: F.display });
    addText(p, q, { left: 886, top: 318 + i * 84, width: 294, height: 42 }, { role: "body", size: PX.body, color: C.body });
    if (i < 2) addLine(p, { x: 836, y: 373 + i * 84 }, { x: 1178, y: 373 + i * 84 }, { color: C.line, width: 1 });
  });
  addText(p, "收集具体复核过程和当事人反馈，不先给一个统一“合格分数”。", { left: 834, top: 582, width: 370, height: 24 }, { role: "aux", size: PX.aux, color: C.muted });
}

function drawGuardrails(p) {
  shell(p, "06", "开始与止损", 8); foot(p);
  addText(p, "试点需要清楚的责任，也需要允许停止", { left: 56, top: 100, width: 650, height: 34 }, { role: "module", bold: true, size: PX.module, font: F.display });
  addText(p, "试点目标是理解结果的产生过程，范围、授权和负担都应在过程中保持可解释。", { left: 56, top: 151, width: 860, height: 28 }, { role: "body", size: PX.body });
  const panels = [
    { id: "start", x: 72, title: "开始前确认", accent: C.ink, fill: C.surface, body: "负责人确认试点范围\n负责人确认授权联系人\n参与成员认可最少字段\n确定谁负责复核" },
    { id: "stop", x: 664, title: "停止或修改信号", accent: C.brick, fill: "none", body: "填写工作持续挤占必要实验时间\n权限边界无法说明\n记录只增加重复抄写，没有帮助解释结果" },
  ];
  panels.forEach((m) => {
    const f = { left: m.x, top: 264, width: 504, height: 254 };
    addRect(p, f, { fill: m.fill, line: m.accent === C.brick ? C.brick : C.line, width: 1, name: qaParent(`guard-${m.id}`, ["guardrail-panel"]) });
    addText(p, m.title, { left: m.x + 28, top: 298, width: 420, height: 32 }, { role: "module", size: PX.module, color: m.accent, bold: true, font: F.display, name: qaWithin(`guard-${m.id}`, "title") });
    addLine(p, { x: m.x + 28, y: 348 }, { x: m.x + 470, y: 348 }, { color: m.accent, width: 1.2 });
    addText(p, m.body, { left: m.x + 28, top: 380, width: 432, height: 110 }, { role: "body", size: PX.body, color: C.body, name: qaWithin(`guard-${m.id}`, "body") });
  });
  addText(p, "届时先缩小要求或停止试点，不能为了完成试点目标强行推广。", { left: 72, top: 574, width: 940, height: 30 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
}

function drawClose(p) {
  shell(p, "07", "讨论要确认什么", 9);
  addText(p, "先让一次结果可以被理解，\n再决定哪些记录值得长期保存。", { left: 56, top: 136, width: 900, height: 128 }, { role: "cover", size: PX.cover, font: F.display, color: C.ink });
  addLine(p, { x: 56, y: 302 }, { x: 1220, y: 302 }, { color: C.brick, width: 1.4 });
  const words = [["结果", "一张图来自哪里"], ["依据", "处理与排除为何成立"], ["责任边界", "谁能看见，谁来确认"]];
  words.forEach(([t, b], i) => {
    const x = 76 + i * 370;
    addText(p, t, { left: x, top: 338, width: 280, height: 34 }, { role: "module", size: PX.module, color: i === 2 ? C.brick : C.ink, bold: true, font: F.display });
    addText(p, b, { left: x, top: 389, width: 270, height: 26 }, { role: "body", size: PX.body });
    if (i < 2) addLine(p, { x: x + 300, y: 342 }, { x: x + 300, y: 432 }, { color: C.line, width: 1 });
  });
  addText(p, "归档工具只是承载方式，结果、依据和责任边界的联系才是这次试点要验证的内容。", { left: 76, top: 520, width: 1050, height: 32 }, { role: "module", size: PX.module, color: C.ink, font: F.display });
  addText(p, "本次讨论确认的是一个有限尝试。", { left: 76, top: 588, width: 540, height: 24 }, { role: "aux", size: PX.aux, color: C.muted });
  addText(p, "PPagenT", { left: 1124, top: 652, width: 96, height: 20 }, { role: "aux", size: PX.aux, color: C.brick, align: "right", font: F.body });
}

function sourceCoverage() {
  return {
    source: SRC,
    pages: [
      { page: 1, covers: ["试点讨论目的", "受众", "四周有限尝试"] },
      { page: 2, covers: ["最终图片、样本批次、脚本版本、排除依据难以说明", "文件存在不等于结果可解释"] },
      { page: 3, covers: ["五项记录单元", "原始数据保持原貌", "清洗处理另存", "异常与排除依据"] },
      { page: 4, covers: ["可讨论材料与受限原始数据", "授权边界", "路径不等于访问权", "新授权暂停共享"] },
      { page: 5, covers: ["集中补历史与新增实验两种推进思路", "建议新增优先、按需补历史", "不宣称效率已证明"] },
      { page: 6, covers: ["提交、定位、补充、负责人确认、可讨论版本", "复核不要求复做实验", "新授权分支"] },
      { page: 7, covers: ["一个课题方向、两名自愿成员、四周", "周次安排", "三个评估问题", "不先给统一合格分数"] },
      { page: 8, covers: ["开始前责任", "停止或修改信号", "先缩小要求或停止，不强行推广"] },
      { page: 9, covers: ["有限尝试的确认", "结果、依据、责任边界联系", "工具只是承载方式"] },
    ],
  };
}

async function main() {
  await fs.mkdir(path.join(OUT, "slides"), { recursive: true });
  await fs.copyFile(SRC, path.join(OUT, "source-manuscript.md"));
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const pages = [drawCover, drawProblem, drawRecordUnit, drawAccess, drawChoice, drawWorkflow, drawPilot, drawGuardrails, drawClose];
  pages.forEach((draw) => draw(presentation.slides.add()));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.join(OUT, "deck.pptx"));
  await fs.writeFile(path.join(OUT, "source-coverage.json"), JSON.stringify(sourceCoverage(), null, 2), "utf8");
  await fs.writeFile(path.join(OUT, "reference-usage.json"), JSON.stringify({
    mode: "reference",
    visualReference: "C:/Users/ilove/Documents/Codex/2026-09-06/ppagent-magazine-luna-high-r2/outputs/deck.pptx",
    reviewedPages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => `C:/Users/ilove/Documents/Codex/2026-09-06/ppagent-magazine-luna-high-r2/outputs/slides/slide-${n}.png`),
    pageObservations: [
      "1：封面左侧大标题、砖红副标题线、右侧短引语与竖向分隔",
      "2：页首短标题、四段横向分组、底部大字收束",
      "3：单一横轴与中点标记，正文放在线与刻度之外",
      "4：公式作为完整组，右侧窄栏表达阈值区间",
      "5：共享比较轴、两端状态点与底部结论",
      "6：连续区间与两端边界表达条件范围",
      "7：四步水平关系线，末节点强调色承载",
      "8：上下两条工作轨道、回流虚线与最终结果节点",
      "9：建设期与正式生成期左右对照，中央关系线",
      "10：四项横向问题分组，末项用砖红线收焦",
      "11：四步水平线与编号圆，末步实心强调",
      "12：左侧强调场景、右侧大承载面与替换关系线",
      "13：大号结论、横线、三项收束概念与页脚",
    ],
    extractedMethods: ["纸色底与安静编辑式留白", "页首章节编号、短标题、向右延伸细线", "大号衬线结论与无衬线正文分工", "关系线以真实端点连接节点，强调色只标记语义焦点", "内容组按自然高度聚合，不使用机械三列卡片墙"],
    selectedStructureReferences: [
      { assetId: "convergence-many-to-one-003", read: ["reference output", "assets/结构图/多路汇聚结果-003/runtime.mjs", "assets/结构图/多路汇聚结果-003/review.mjs"], method: "五项依据从左侧独立汇聚到记录单元，再指向唯一结果", changed: "改为本稿五项记录字段、纸色细框与砖红圆心，保留关系但重排尺寸与文案" },
      { assetId: "comparison-dual-verdict-001", read: ["reference output", "assets/结构图/双向对比-001/runtime.mjs", "assets/结构图/双向对比-001/review.mjs"], method: "左右镜像对象、共同中轴与中央比较节点", changed: "改为两种试点起点的中性权衡，不使用 positive/negative 胶囊和整套组件" },
      { assetId: "sequence-phase-gates-004", read: ["reference output", "assets/结构图/阶段门禁流程-004/runtime.mjs", "assets/结构图/阶段门禁流程-004/review.mjs"], method: "阶段推进与相邻门禁条件", changed: "改为四步水平记录流程，门禁文字置于阶段之间，并增补新授权暂停共享的旁支" },
    ],
    limitations: ["未调用 invokeStructure，所有关系图均为本次脚本中的原生元素重组", "参考图是气质与局部关系方法来源，未复制其内容或整页构图"],
  }, null, 2), "utf8");
  await fs.writeFile(path.join(OUT, "rules-input-brief.txt"), `command: npm run rules:load -- --profile generation --skin neutral-editorial-001\nprofile: generation\nskin: neutral-editorial-001\nlayout system: magazine\nbackground: ${C.bg}\nfonts.display: ${F.display}\nfonts.body: ${F.body}\nroles: cover 58px, title 25px bold, module 21px bold, node/body 17px, aux 15px, number 48px\n`, "utf8");
  console.log(path.join(OUT, "deck.pptx"));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
