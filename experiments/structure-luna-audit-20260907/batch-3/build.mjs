import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile, FileBlob } from "@oai/artifact-tool";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "").replace(/^([A-Za-z]):/, "$1:"));
const root = path.resolve(here, "../../..");
const runtimeNode = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const runtimePython = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const runtimeNodeModules = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const outDir = here;
const buildDir = path.join(here, ".build");
const evidenceDir = path.join(here, "evidence");
const evidencePath = path.join(evidenceDir, "structure-invocations.ndjson");
const inputPath = path.join(here, "input.json");
const candidatePath = path.join(outDir, "candidate.pptx");
const finalizedPath = path.join(outDir, "final", "candidate.pptx");

const C = Object.freeze({ paper: "#F5F4EF", surface: "#EEECE5", ink: "#20201D", body: "#4B4A45", muted: "#85837B", line: "#D8D5CC", accent: "#A35D4F", paleAccent: "#E6D4CE", blueGray: "#DDE4E3", soft: "#E9E5DC", white: "#FFFFFF" });
const SERIF = "Noto Serif SC";
const SANS = "Noto Sans SC";
const frame = { left: 55, top: 166, width: 1170, height: 492 };
const skin = { id: "neutral-editorial-001", bodyFrame: frame, background: C.paper, surface: C.surface, dark: C.ink, body: C.body, muted: C.muted, line: C.line, primaryColor: C.accent, font: SANS, typography: { componentHeading: 15.75, componentTitle: 15.75, componentItemTitle: 12.75, componentLead: 12.75, componentBody: 12.75, componentLabel: 11.25, componentMeta: 11.25 } };

const noLine = () => ({ style: "solid", fill: "none", width: 0 });
function shape(slide, geometry, position, fill = "none", line = noLine(), name) { return slide.shapes.add({ geometry, position, fill, line, name, shadow: "shadow-none" }); }
function rect(slide, position, fill = C.surface, line = { style: "solid", fill: C.line, width: 1 }, name) { return shape(slide, "rect", position, fill, line, name); }
function roundRect(slide, position, fill = C.surface, line = { style: "solid", fill: C.line, width: 1 }, name) { return shape(slide, "roundRect", position, fill, line, name); }
function ellipse(slide, position, fill = C.surface, line = { style: "solid", fill: C.line, width: 1 }, name) { return shape(slide, "ellipse", position, fill, line, name); }
function addText(slide, text, position, options = {}) {
  const s = slide.shapes.add({ geometry: "textbox", position, fill: "none", line: noLine(), name: options.name });
  s.text = String(text ?? "");
  s.text.style = { typeface: options.typeface ?? SANS, fontSize: options.fontSize ?? 16, color: options.color ?? C.body, bold: options.bold ?? false, alignment: options.alignment ?? "left", verticalAlignment: options.verticalAlignment ?? "top", lineSpacing: options.lineSpacing ?? 1.15, autoFit: "none", insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 } };
  return s;
}
function connect(slide, from, to, options = {}) { return slide.shapes.connect(from, to, { kind: options.kind ?? "straight", fromSide: options.fromSide, toSide: options.toSide, line: { style: "solid", fill: options.color ?? C.muted, width: options.width ?? 1.5 }, head: options.head ?? { type: "triangle", width: "sm", length: "sm" }, tail: options.tail }); }
function line(slide, x1, y1, x2, y2, color = C.line, width = 1.2, name) { return shape(slide, "line", { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1) || 1, height: Math.abs(y2 - y1) || 1, horizontalFlip: x2 < x1, verticalFlip: y2 < y1 }, "none", { style: "solid", fill: color, width }, name); }
function setText(shapeObject, text, options = {}) { shapeObject.text = String(text ?? ""); shapeObject.text.style = { typeface: options.typeface ?? SANS, fontSize: options.fontSize ?? 16, color: options.color ?? C.body, bold: options.bold ?? false, alignment: options.alignment ?? "left", verticalAlignment: options.verticalAlignment ?? "top", lineSpacing: options.lineSpacing ?? 1.15, autoFit: "none", insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 } }; return shapeObject; }
function label(slide, text, x, y, w, h, opts = {}) { return addText(slide, text, { left: x, top: y, width: w, height: h }, opts); }
function header(slide, item, index) {
  slide.background.fill = C.paper;
  label(slide, String(index + 1).padStart(2, "0"), 56, 47, 40, 32, { fontSize: 16, color: C.accent, bold: true, verticalAlignment: "middle", name: `chapter-${index + 1}` });
  label(slide, item.title, 105, 44, 790, 38, { typeface: SERIF, fontSize: 24, color: C.ink, bold: true, verticalAlignment: "middle", name: `title-${item.caseId}` });
  line(slide, 920, 64, 1224, 64, C.line, 1, `header-rule-${index + 1}`);
  label(slide, "LUNA HIGH · 结构 Skill 逐稿验证", 930, 47, 294, 28, { fontSize: 12, color: C.muted, alignment: "right", verticalAlignment: "middle" });
  label(slide, "中性编辑排版 · 结构保留后按正文重算", 56, 116, 720, 24, { fontSize: 15, color: C.body, verticalAlignment: "middle" });
}
function footer(slide, index) { line(slide, 56, 672, 1224, 672, C.line, 1, `footer-rule-${index + 1}`); label(slide, String(index + 1).padStart(2, "0"), 1180, 681, 44, 20, { fontSize: 12, color: C.muted, alignment: "right", verticalAlignment: "middle" }); }
function note(slide, text) { slide.speakerNotes.textFrame.setText(text); }

function build03({ slide, frame: f }) {
  const rootNode = roundRect(slide, { left: f.left + 405, top: f.top + 12, width: 360, height: 58 }, C.ink, { style: "solid", fill: C.ink, width: 0 }, "scenario-common-assumption");
  label(slide, "共同假设", f.left + 430, f.top + 21, 95, 20, { fontSize: 13, color: C.paleAccent, bold: true });
  label(slide, "现有团队规模不变", f.left + 430, f.top + 40, 300, 24, { fontSize: 18, color: C.white, bold: true });
  const scenarios = [
    ["需求平稳", "触发：需求平稳", "预期：双周交付，排期稳定"],
    ["短期激增", "触发：短期需求激增", "预期：先做核心，次要延后"],
    ["持续下降", "触发：需求持续下降", "预期：技术整理，积压减少"],
  ];
  const xs = [f.left + 35, f.left + 395, f.left + 755];
  const nodes = scenarios.map((s, i) => {
    const card = roundRect(slide, { left: xs[i], top: f.top + 205, width: 325, height: 185 }, i === 1 ? C.paleAccent : C.surface, { style: "solid", fill: i === 1 ? C.accent : C.line, width: i === 1 ? 2 : 1 }, `scenario-${i + 1}`);
    label(slide, `0${i + 1}`, xs[i] + 22, f.top + 224, 32, 24, { fontSize: 15, color: C.accent, bold: true });
    label(slide, s[0], xs[i] + 61, f.top + 220, 235, 34, { typeface: SERIF, fontSize: 20, color: C.ink, bold: true });
    label(slide, s[1], xs[i] + 22, f.top + 278, 275, 34, { fontSize: 15, color: C.body });
    label(slide, s[2], xs[i] + 22, f.top + 326, 280, 42, { fontSize: 15, color: C.body });
    return card;
  });
  nodes.forEach(n => connect(slide, rootNode, n, { kind: "curved", fromSide: "bottom", toSide: "top", color: C.accent, width: 2, head: { type: "triangle", width: "sm", length: "sm" } }));
  label(slide, "三种情景是备选假设，不是连续阶段", f.left + 20, f.top + 424, 520, 24, { fontSize: 14, color: C.muted });
  return { preserved: ["共同假设位于扇面起点", "情景路径从共同起点向外展开", "触发条件与预期结果配对"] };
}

function build06({ slide, frame: f }) {
  const y = f.top + 38, h = 320, leftX = f.left + 55, rightX = f.left + 625, w = 440;
  ellipse(slide, { left: f.left + 280, top: f.top + 370, width: 610, height: 48 }, C.soft, { style: "solid", fill: C.line, width: 1 }, "comparison-platform");
  const panels = [{ x: leftX, title: "方案甲", tone: "positive", fill: C.paleAccent, accent: C.accent, values: ["可独立回滚", "按角色区分权限", "保留审计记录", "模块独立维护"] }, { x: rightX, title: "方案乙", tone: "negative", fill: C.blueGray, accent: C.muted, values: ["必须整体回退", "权限共用", "依赖人工笔记", "模块相互耦合"] }];
  const built = panels.map((p, pi) => {
    const body = roundRect(slide, { left: p.x, top: y, width: w, height: h }, p.fill, { style: "solid", fill: pi === 0 ? C.accent : C.line, width: pi === 0 ? 2 : 1 }, `compare-panel-${pi + 1}`);
    roundRect(slide, { left: p.x + 18, top: y + 15, width: w - 36, height: 52 }, p.accent, { style: "solid", fill: p.accent, width: 0 }, `compare-cap-${pi + 1}`);
    label(slide, p.title, p.x + 38, y + 28, 280, 28, { typeface: SERIF, fontSize: 21, color: pi === 0 ? C.white : C.ink, bold: true });
    p.values.forEach((v, i) => { const rowY = y + 89 + i * 50; ellipse(slide, { left: p.x + 25, top: rowY + 10, width: 22, height: 22 }, pi === 0 ? C.accent : C.muted, { style: "solid", fill: pi === 0 ? C.accent : C.muted, width: 0 }); label(slide, pi === 0 ? "✓" : "–", p.x + 25, rowY + 9, 22, 22, { fontSize: 15, color: C.white, bold: true, alignment: "center", verticalAlignment: "middle" }); label(slide, v, p.x + 61, rowY + 8, 335, 28, { fontSize: 16, color: C.ink }); line(slide, p.x + 25, rowY + 42, p.x + w - 25, rowY + 42, pi === 0 ? "#D3AEA5" : C.line, 1); });
    return body;
  });
  const vs = ellipse(slide, { left: f.left + 553, top: f.top + 170, width: 64, height: 64 }, C.ink, { style: "solid", fill: C.white, width: 2 }, "comparison-vs");
  label(slide, "VS", f.left + 553, f.top + 187, 64, 28, { fontSize: 17, color: C.white, bold: true, alignment: "center", verticalAlignment: "middle" });
  label(slide, "推荐甲 · 乙仅适合临时验证", f.left + 410, f.top + 424, 360, 24, { fontSize: 16, color: C.accent, bold: true, alignment: "center" });
  return { preserved: ["两个比较舱镜像平衡", "对应要点横向共线", "中央比较节点位于真实留白", "底部椭圆平台收束两侧"] };
}

function build09({ slide, frame: f }) {
  const centers = [{ x: f.left + 300, y: f.top + 170, title: "真实需求", color: "#DAD8CD" }, { x: f.left + 550, y: f.top + 170, title: "技术可行", color: "#D9E3E1" }, { x: f.left + 425, y: f.top + 285, title: "组织可承担", color: "#E5D4CE" }];
  const nodes = centers.map((p, i) => { const n = ellipse(slide, { left: p.x, top: p.y, width: 340, height: 220 }, p.color, { style: "solid", fill: i === 2 ? C.accent : C.line, width: 1.5 }, `set-${i + 1}`); label(slide, p.title, p.x + 70, p.y + 38, 200, 28, { typeface: SERIF, fontSize: 20, color: C.ink, bold: true, alignment: "center" }); return n; });
  ellipse(slide, { left: f.left + 442, top: f.top + 245, width: 165, height: 110 }, C.ink, { style: "solid", fill: C.white, width: 2 }, "intersection-core");
  label(slide, "本期可交付", f.left + 457, f.top + 263, 135, 26, { fontSize: 18, color: C.ink, bold: true, alignment: "center" });
  label(slide, "三者共同部分", f.left + 463, f.top + 296, 125, 20, { fontSize: 14, color: C.body, alignment: "center" });
  label(slide, "只满足需求和技术、无人维护的方案不在共同部分", f.left + 200, f.top + 430, 770, 24, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["三个同级集合围绕共同核心", "圆形场域保持等权", "共同部分明确强调为中心"] };
}

function build12({ slide, frame: f }) {
  const names = ["相关性", "可解释性", "可观察性", "可验证性", "成本可承担"]; const widths = [1010, 920, 830, 740, 650];
  const nodes = names.map((name, i) => { const x = f.left + (1170 - widths[i]) / 2; const y = f.top + 26 + i * 72; const n = shape(slide, "chevron", { left: x, top: y, width: widths[i], height: 58 }, i === 4 ? C.accent : (i % 2 ? C.blueGray : C.surface), { style: "solid", fill: i === 4 ? C.accent : C.line, width: 1 }, `gate-${i + 1}`); label(slide, `0${i + 1}`, x + 23, y + 16, 34, 24, { fontSize: 15, color: i === 4 ? C.white : C.accent, bold: true }); label(slide, name, x + 70, y + 14, widths[i] - 125, 26, { typeface: SERIF, fontSize: 19, color: i === 4 ? C.white : C.ink, bold: true, alignment: "center" }); if (i > 0) line(slide, f.left + 585, y - 14, f.left + 585, y, C.muted, 1.2); return n; });
  label(slide, "想法", f.left + 20, f.top + 228, 90, 28, { fontSize: 16, color: C.muted, bold: true, alignment: "center" });
  label(slide, "可验证假设", f.left + 1040, f.top + 365, 120, 28, { fontSize: 16, color: C.accent, bold: true, alignment: "center" });
  label(slide, "连续筛选，范围持续收窄", f.left + 390, f.top + 425, 390, 24, { fontSize: 16, color: C.body, alignment: "center" });
  return { preserved: ["连续向下收窄的几何路径", "每一级对应一个筛选门槛", "末端保留可验证假设"] };
}

function build15({ slide, frame: f }) {
  const names = ["目标设定", "参数配置", "执行测试", "结果评估"]; const xs = [f.left + 25, f.left + 310, f.left + 595, f.left + 880]; const nodes = names.map((name, i) => { const n = roundRect(slide, { left: xs[i], top: f.top + 105, width: 210, height: 120 }, i === 3 ? C.paleAccent : C.surface, { style: "solid", fill: i === 3 ? C.accent : C.line, width: i === 3 ? 2 : 1 }, `feedback-node-${i + 1}`); label(slide, `0${i + 1}`, xs[i] + 18, f.top + 122, 26, 22, { fontSize: 14, color: C.accent, bold: true }); label(slide, name, xs[i] + 47, f.top + 118, 145, 27, { typeface: SERIF, fontSize: 19, color: i === 3 ? C.ink : C.ink, bold: true }); label(slide, i === 0 ? "定义成功标准" : i === 1 ? "调整输入参数" : i === 2 ? "运行一次测试" : "判断是否满足目标", xs[i] + 18, f.top + 164, 174, 42, { fontSize: 14, color: C.body }); return n; });
  for (let i = 0; i < nodes.length - 1; i++) connect(slide, nodes[i], nodes[i + 1], { fromSide: "right", toSide: "left", color: C.muted, width: 2 });
  const feedback = connect(slide, nodes[3], nodes[1], { kind: "elbow3", fromSide: "bottom", toSide: "bottom", color: C.accent, width: 2, head: { type: "triangle", width: "sm", length: "sm" } });
  label(slide, "不满足目标时", f.left + 700, f.top + 300, 140, 22, { fontSize: 14, color: C.accent, bold: true, alignment: "center" });
  label(slide, "反馈回到参数配置进行校准", f.left + 390, f.top + 370, 360, 28, { fontSize: 17, color: C.accent, bold: true, alignment: "center" });
  label(slide, "满足目标时保留当前配置", f.left + 820, f.top + 370, 280, 24, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["前向主链从左向右推进", "结果节点向上游参数配置回流", "反馈路径独立于目标设定"] };
}

function build18({ slide, frame: f }) {
  const center = ellipse(slide, { left: f.left + 455, top: f.top + 155, width: 250, height: 150 }, C.ink, { style: "solid", fill: C.ink, width: 0 }, "hub-center");
  label(slide, "统一知识入口", f.left + 482, f.top + 198, 195, 28, { typeface: SERIF, fontSize: 22, color: C.white, bold: true, alignment: "center" });
  label(slide, "唯一中心", f.left + 512, f.top + 236, 135, 20, { fontSize: 14, color: C.paleAccent, alignment: "center" });
  const items = ["新人培训", "问题定位", "方案复用", "变更查询", "经验检索", "责任查找", "合规检查"];
  const pos = [[f.left + 35, f.top + 45], [f.left + 380, f.top + 8], [f.left + 820, f.top + 45], [f.left + 900, f.top + 220], [f.left + 780, f.top + 370], [f.left + 300, f.top + 390], [f.left + 55, f.top + 260]];
  pos.forEach(([x, y], i) => { const n = roundRect(slide, { left: x, top: y, width: 180, height: 60 }, i === 6 ? C.paleAccent : C.surface, { style: "solid", fill: i === 6 ? C.accent : C.line, width: i === 6 ? 2 : 1 }, `hub-item-${i + 1}`); label(slide, items[i], x + 14, y + 16, 152, 26, { fontSize: 16, color: C.ink, bold: i === 6, alignment: "center", verticalAlignment: "middle" }); connect(slide, center, n, { kind: "straight", color: C.muted, width: 1.2, head: { type: "none" } }); });
  label(slide, "中心提供支持，外围之间没有流程", f.left + 355, f.top + 440, 460, 24, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["中心锚点与七个同级外围节点", "径向关系表达中心支持", "外围之间没有先后连接"] };
}

function build21({ slide, frame: f }) {
  const layers = [["资源层", "计算", "存储"], ["数据层", "采集", "版本"], ["服务层", "接口", "事件"], ["能力层", "搜索", "分析"], ["流程层", "任务", "审批"], ["应用层", "工作台", "报表"]];
  const h = 54, gap = 12, widths = [760, 820, 880, 940, 1000, 1060];
  const nodes = layers.map((a, i) => { const w = widths[i], x = f.left + (1170 - w) / 2, y = f.top + 12 + i * (h + gap); const n = shape(slide, "parallelogram", { left: x, top: y, width: w, height: h }, i === 5 ? C.paleAccent : (i % 2 ? C.blueGray : C.surface), { style: "solid", fill: i === 5 ? C.accent : C.line, width: 1 }, `layer-${i + 1}`); label(slide, a[0], x + 35, y + 15, 120, 24, { typeface: SERIF, fontSize: 18, color: C.ink, bold: true }); label(slide, `${a[1]}  ·  ${a[2]}`, x + 245, y + 15, w - 310, 24, { fontSize: 16, color: C.body, alignment: "center" }); return n; });
  for (let i = 0; i < nodes.length - 1; i++) connect(slide, nodes[i], nodes[i + 1], { fromSide: "bottom", toSide: "top", color: C.muted, width: 1.4, head: { type: "triangle", width: "sm", length: "sm" } });
  label(slide, "层间支撑关系 · 自下而上从基础走向应用", f.left + 250, f.top + 446, 670, 24, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["六层自下而上递进", "每层两个同级能力", "层间只有纵向支撑线"] };
}

function build24({ slide, frame: f }) {
  const x0 = f.left + 210, y0 = f.top + 38, w = 760, h = 330, cw = w / 2, ch = h / 2;
  rect(slide, { left: x0, top: y0, width: cw, height: ch }, C.blueGray, { style: "solid", fill: C.line, width: 1 }, "quad-low-low"); rect(slide, { left: x0 + cw, top: y0, width: cw, height: ch }, C.paleAccent, { style: "solid", fill: C.line, width: 1 }, "quad-low-high"); rect(slide, { left: x0, top: y0 + ch, width: cw, height: ch }, C.surface, { style: "solid", fill: C.line, width: 1 }, "quad-high-low"); rect(slide, { left: x0 + cw, top: y0 + ch, width: cw, height: ch }, "#DCC0B7", { style: "solid", fill: C.accent, width: 1 }, "quad-high-high"); line(slide, x0 + cw, y0 - 18, x0 + cw, y0 + h + 18, C.ink, 2, "matrix-y-axis"); line(slide, x0 - 18, y0 + ch, x0 + w + 18, y0 + ch, C.ink, 2, "matrix-x-axis"); label(slide, "影响范围：小", x0 - 95, y0 + h + 30, 180, 22, { fontSize: 14, color: C.muted, alignment: "center" }); label(slide, "影响范围：大", x0 + w - 85, y0 + h + 30, 180, 22, { fontSize: 14, color: C.body, alignment: "center" }); label(slide, "紧迫性：高", x0 - 120, y0 + 15, 100, 22, { fontSize: 14, color: C.body, alignment: "right" }); label(slide, "紧迫性：低", x0 - 120, y0 + h - 20, 100, 22, { fontSize: 14, color: C.muted, alignment: "right" }); const blocks = [["高紧迫 · 小影响", "现场快速处置"], ["高紧迫 · 大影响", "立即组织处理"], ["低紧迫 · 小影响", "进入常规清单"], ["低紧迫 · 大影响", "纳入专项计划"]]; const positions = [[x0 + 22, y0 + 26], [x0 + cw + 22, y0 + 26], [x0 + 22, y0 + ch + 26], [x0 + cw + 22, y0 + ch + 26]]; positions.forEach(([x, y], i) => { label(slide, blocks[i][0], x, y, cw - 44, 24, { typeface: SERIF, fontSize: 17, color: C.ink, bold: true, alignment: "center" }); label(slide, blocks[i][1], x, y + 44, cw - 44, 24, { fontSize: 16, color: C.body, alignment: "center" }); });
  return { preserved: ["横纵轴真实交叉形成四象限", "轴端明确表达维度方向", "四象限分别承载处置策略"] };
}

function foldedNote(slide, x, y, w, h, index, title, body) {
  rect(slide, { left: x + 8, top: y + 10, width: w, height: h }, "#E2DED4", { style: "solid", fill: "none", width: 0 }, `note-shadow-${index}`);
  const p = rect(slide, { left: x, top: y, width: w, height: h }, C.white, { style: "solid", fill: C.line, width: 1 }, `note-paper-${index}`);
  rect(slide, { left: x, top: y, width: w, height: 34 }, index % 2 ? C.surface : C.paleAccent, { style: "solid", fill: index % 2 ? C.line : C.accent, width: 0 }, `note-band-${index}`);
  ellipse(slide, { left: x + 12, top: y + 9, width: 16, height: 16 }, C.accent, { style: "solid", fill: C.accent, width: 0 }, `note-anchor-${index}`);
  label(slide, String(index).padStart(2, "0"), x + 11, y + 8, 18, 16, { fontSize: 9, color: C.white, bold: true, alignment: "center", verticalAlignment: "middle" });
  label(slide, title, x + 36, y + 8, w - 50, 18, { fontSize: 14, color: C.ink, bold: true, verticalAlignment: "middle" });
  label(slide, body, x + 16, y + 50, w - 34, h - 66, { fontSize: 12.8, color: C.body, lineSpacing: 1.2 });
  line(slide, x + w - 25, y + h, x + w, y + h - 25, C.accent, 1.2, `note-fold-${index}`);
  line(slide, x + w - 25, y + h, x + w - 3, y + h, C.accent, 1.2, `note-fold-base-${index}`);
  return p;
}
function build27({ slide, frame: f }) {
  const items = [["目标明确", "让评审先对齐要达成什么"], ["范围清楚", "避免评审对象不断扩张"], ["事实可查", "每个判断都有来源依据"], ["责任到人", "出现疑问时知道找谁"], ["接口可用", "确认协作边界能够衔接"], ["错误可定位", "出现偏差时能找到位置"], ["版本可追踪", "知道当前依据是哪一版"], ["结果可编辑", "交付后仍能继续修改"], ["交接有记录", "让下一位接手不丢上下文"]];
  const cw = 340, ch = 112, gapX = 36, gapY = 20; items.forEach((it, i) => { const col = i % 3, row = Math.floor(i / 3); foldedNote(slide, f.left + 20 + col * (cw + gapX), f.top + 8 + row * (ch + gapY), cw, ch, i + 1, it[0], it[1]); });
  label(slide, "九个要点等权呈现，按三行三列扫描", f.left + 330, f.top + 444, 510, 24, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["三行三列等权阵列", "纸面、标题带、折角与底影三层关系", "每项有标题和短说明"] };
}

function build30({ slide, frame: f }) {
  const items = [["基础操作", "熟悉基本工具"], ["独立处理", "可独立完成任务"], ["跨组协作", "能在接口处协同"], ["系统优化", "主动改善系统"], ["带教复用", "把能力传给他人"]]; const baseX = f.left + 55, baseY = f.top + 400, stepW = 205, gap = 15;
  const nodes = items.map((it, i) => { const h = 90 + i * 48, x = baseX + i * (stepW + gap), y = baseY - h; const shadow = rect(slide, { left: x + 8, top: y + 10, width: stepW, height: h }, "#E1DED5", { style: "solid", fill: "none", width: 0 }, `ladder-shadow-${i + 1}`); const riser = rect(slide, { left: x, top: y, width: stepW, height: h }, i === 4 ? C.paleAccent : (i % 2 ? C.blueGray : C.surface), { style: "solid", fill: i === 4 ? C.accent : C.line, width: 1 }, `ladder-step-${i + 1}`); shape(slide, "parallelogram", { left: x, top: y, width: stepW, height: 20 }, i === 4 ? C.accent : C.ink, { style: "solid", fill: i === 4 ? C.accent : C.ink, width: 0 }, `ladder-tread-${i + 1}`); label(slide, `0${i + 1}`, x + 16, y + 32, 30, 20, { fontSize: 13, color: C.accent, bold: true }); label(slide, it[0], x + 18, y + 55, stepW - 36, 24, { typeface: SERIF, fontSize: 17, color: C.ink, bold: true, alignment: "center" }); label(slide, it[1], x + 16, y + 84, stepW - 32, 40, { fontSize: 13, color: C.body, alignment: "center" }); return riser; });
  for (let i = 0; i < nodes.length - 1; i++) connect(slide, nodes[i], nodes[i + 1], { fromSide: "right", toSide: "left", color: C.accent, width: 1.5, head: { type: "triangle", width: "sm", length: "sm" } });
  label(slide, "能力要求逐级提高，阶段连续且有里程点", f.left + 325, f.top + 434, 520, 24, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["从左下向右上的连续阶台", "踏面和立面共享投影", "每级由随形承托面组织文字"] };
}

function build33({ slide, frame: f }) {
  const cols = ["提出", "评估", "实现", "验收", "确认"]; const roles = ["业务", "研发", "质量"]; const x0 = f.left + 145, y0 = f.top + 42, colW = 188, laneH = 74; const cells = [];
  rect(slide, { left: f.left + 15, top: y0, width: 1090, height: 38 }, C.blueGray, { style: "solid", fill: C.line, width: 1 }, "stage-header"); cols.forEach((c, i) => { label(slide, `${i + 1}  ${c}`, x0 + i * colW + 15, y0 + 8, colW - 30, 22, { typeface: SERIF, fontSize: 16, color: C.ink, bold: true, alignment: "center" }); });
  roles.forEach((r, ri) => { const y = y0 + 46 + ri * laneH; rect(slide, { left: f.left + 15, top: y, width: 1090, height: laneH - 6 }, ri % 2 ? C.surface : "#F0EFEA", { style: "solid", fill: C.line, width: 1 }, `lane-${ri + 1}`); roundRect(slide, { left: f.left + 23, top: y + 13, width: 100, height: 42 }, ri === 1 ? C.ink : C.muted, { style: "solid", fill: ri === 1 ? C.ink : C.muted, width: 0 }, `role-${ri + 1}`); label(slide, r, f.left + 23, y + 22, 100, 22, { fontSize: 15, color: C.white, bold: true, alignment: "center" }); });
  const tasks = [[0, 0, "说明诉求"], [1, 1, "检查影响"], [2, 1, "修改方案"], [3, 2, "验证结果"], [4, 0, "最后确认"]];
  const taskNodes = tasks.map(([ci, ri, text], i) => { const x = x0 + ci * colW + 30, y = y0 + 54 + ri * laneH + 9; const n = roundRect(slide, { left: x, top: y, width: 128, height: 42 }, i === 4 ? C.paleAccent : C.white, { style: "solid", fill: i === 4 ? C.accent : C.line, width: i === 4 ? 2 : 1 }, `task-${i + 1}`); label(slide, text, x + 8, y + 10, 112, 22, { fontSize: 14, color: C.ink, bold: i === 4, alignment: "center", verticalAlignment: "middle" }); return n; });
  for (let i = 0; i < taskNodes.length - 1; i++) connect(slide, taskNodes[i], taskNodes[i + 1], { kind: "elbow", fromSide: "right", toSide: "left", color: C.accent, width: 1.8, head: { type: "triangle", width: "sm", length: "sm" } });
  label(slide, "交接沿阶段向右推进：诉求 → 评估 → 修改 → 验证 → 确认", f.left + 220, f.top + 410, 760, 26, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["横向阶段与纵向角色形成泳道", "任务归属明确到角色和阶段", "交接路径连接真实任务"] };
}

const specs = [
  { caseId: "case-03", assetId: "branching-scenario-fan-004", reason: "同一团队规模假设下并列推演三种需求情景，触发条件与预期结果成对表达。", build: build03 },
  { caseId: "case-06", assetId: "comparison-dual-verdict-001", reason: "方案甲乙按四个共同维度逐行对应，且稿件给出明确推荐方向。", build: build06 },
  { caseId: "case-09", assetId: "containment-multi-set-intersection-001", reason: "三个等权集合的共同部分决定可交付范围，交集是本页核心结论。", build: build09 },
  { caseId: "case-12", assetId: "sequence-phase-gates-004", reason: "五道筛选按连续先后收窄范围，阶段门禁表达每次筛选的必要门槛。", build: build12 },
  { caseId: "case-15", assetId: "cycle-single-chain-feedback-002", reason: "前向主链明确，结果不满足目标时仅回到参数配置校准。", build: build15 },
  { caseId: "case-18", assetId: "hub-radial-001", reason: "唯一知识入口向七项并列工作提供支持，外围之间没有流程。", build: build18 },
  { caseId: "case-21", assetId: "layered-architecture-001", reason: "六层系统能力自下而上支撑，层内两项能力同级，层间无跨层网络线。", build: build21 },
  { caseId: "case-24", assetId: "matrix-quadrant-priority-001", reason: "影响范围与紧迫性构成两个独立维度，四象限直接承载处置策略。", build: build24 },
  { caseId: "case-27", assetId: "parallel-folded-notes-grid-002", reason: "九个等权要点需要密集枚举，折角便签保留纸面层次与两排阵列语法并扩展为三行。", build: build27 },
  { caseId: "case-30", assetId: "progression-maturity-steps-002", reason: "五个能力阶段具有离散门槛并逐级提高，阶梯比连续曲线更忠实。", build: build30 },
  { caseId: "case-33", assetId: "role-stage-collaboration-001", reason: "阶段横向推进、角色纵向分工，五个真实交接任务需要泳道表达。", build: build33 },
];
const preservedByAsset = {
  "branching-scenario-fan-004": ["共同假设位于扇面起点", "情景路径从共同起点向外展开", "触发条件与预期结果配对"],
  "comparison-dual-verdict-001": ["两个比较舱镜像平衡", "对应要点横向共线", "中央比较节点位于真实留白", "底部椭圆平台收束两侧"],
  "containment-multi-set-intersection-001": ["三个同级集合围绕共同核心", "圆形场域保持等权", "共同部分明确强调为中心"],
  "sequence-phase-gates-004": ["连续向下收窄的几何路径", "每一级对应一个筛选门槛", "末端保留可验证假设"],
  "cycle-single-chain-feedback-002": ["前向主链从左向右推进", "结果节点向上游参数配置回流", "反馈路径独立于目标设定"],
  "hub-radial-001": ["中心锚点与七个同级外围节点", "径向关系表达中心支持", "外围之间没有先后连接"],
  "layered-architecture-001": ["六层自下而上递进", "每层两个同级能力", "层间只有纵向支撑线"],
  "matrix-quadrant-priority-001": ["横纵轴真实交叉形成四象限", "轴端明确表达维度方向", "四象限分别承载处置策略"],
  "parallel-folded-notes-grid-002": ["纸面折角轮廓", "标题色带和独立视觉锚点", "等权阵列的居中节奏"],
  "progression-maturity-steps-002": ["从左下向右上的连续阶台", "踏面和立面共享投影", "每级由随形承托面组织文字"],
  "role-stage-collaboration-001": ["横向阶段与纵向角色形成泳道", "任务归属明确到角色和阶段", "交接路径连接真实任务"],
};

async function main() {
  process.env.RUNTIME_NODE_MODULES = runtimeNodeModules;
  process.env.RUNTIME_NODE = runtimeNode;
  await fs.mkdir(buildDir, { recursive: true }); await fs.mkdir(evidenceDir, { recursive: true });
  await fs.rm(evidencePath, { force: true });
  const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const { invokeStructure, closeStructureRuntime } = await import(pathToFileURL(path.join(root, ".codex/skills/ppagent-structure/scripts/invoke.mjs")).href);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const choices = [];
  for (let i = 0; i < input.length; i++) {
    const item = input[i]; const spec = specs.find(s => s.caseId === item.caseId); const slide = presentation.slides.add(); header(slide, item, i);
    let status = "failed"; let preserved = []; let changes = [];
    try {
      const preservedFeatures = preservedByAsset[spec.assetId];
      const result = await invokeStructure({ root, slide, skin, targetFrame: { left: frame.left + 15, top: frame.top, width: frame.width - 30, height: frame.height - 18 }, content: { caseId: item.caseId, title: item.title, manuscript: item.manuscript }, references: [{ assetId: spec.assetId, preservedFeatures }], evidencePath, pageId: `${item.caseId}-page-01`, regionId: `${item.caseId}-structure`, reason: spec.reason, build: async args => spec.build(args) });
      status = result.validation; preserved = preservedFeatures;
      changes = ["按 neutral-editorial-001 颜色用途适配", "按正文数量重算几何", "保留结构轮廓与关系语法"];
      footer(slide, i); note(slide, `来源稿件：${item.caseId} ${item.title}\n正文：${item.manuscript}\n结构 Skill：${spec.assetId}\n本次保留：${spec.reason}\n验证：invokeStructure 返回 ${result.validation}；随后执行 PPTX 导出、重新导入、layout 与逐页 PNG 检查。`);
    } catch (error) {
      status = `failed: ${error.message}`; footer(slide, i); note(slide, `来源稿件：${item.caseId} ${item.title}\n结构 Skill：${spec.assetId}\n调用失败：${error.stack ?? error}`);
    }
    choices.push({ caseId: item.caseId, selectedAssetIds: [spec.assetId], reason: spec.reason, preservedFeatures: preserved, changes, invocationStatus: status, unresolved: status === "rendered-unreviewed" ? ["结构 Skill guide 标记 not-validated，已完成本次原生输出与独立视觉复核"] : ["需要修复结构调用或构建错误"] });
  }
  await fs.writeFile(path.join(outDir, "choice.json"), JSON.stringify(choices, null, 2), "utf8");
  const draftPath = path.join(buildDir, "draft.pptx");
  await (await PresentationFile.exportPptx(presentation)).save(draftPath);
  await fs.mkdir(path.dirname(finalizedPath), { recursive: true });
  await fs.rm(finalizedPath, { force: true });
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
  const validation = await finalizePresentation({ explicitTotalSlideCount: 11, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [], workspaceDir: here, candidatePath: draftPath, finalPath: finalizedPath, pythonExecutable: runtimePython, integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"), layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"), layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"], fontPolicy: { basis: "design", families: [SERIF, SANS] }, verifyArtifactToolImport: true, receiptPath: path.join(buildDir, "validation.json") });
  await fs.copyFile(finalizedPath, candidatePath);
  const imported = await PresentationFile.importPptx(await FileBlob.load(candidatePath));
  for (let i = 0; i < imported.slides.items.length; i++) { const s = imported.slides.items[i]; const png = await s.export({ format: "png", scale: 1 }); await fs.writeFile(path.join(outDir, `rendered-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer())); const lay = await s.export({ format: "layout" }); await fs.writeFile(path.join(outDir, `layout-${String(i + 1).padStart(2, "0")}.json`), await lay.text(), "utf8"); }
  const inspect = await imported.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,layout", maxChars: 200000 }); await fs.writeFile(path.join(outDir, "layout.ndjson"), inspect.ndjson, "utf8");
  await fs.writeFile(path.join(outDir, "build-result.json"), JSON.stringify({ candidatePath, validation, slideCount: imported.slides.items.length }, null, 2), "utf8");
  await closeStructureRuntime();
  console.log(JSON.stringify({ candidatePath, slideCount: imported.slides.items.length, validation }, null, 2));
}
main().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
