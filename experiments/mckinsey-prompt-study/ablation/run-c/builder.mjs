import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/ablation/run-c";
const W = 1280;
const H = 720;
const C = {
  ink: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  blue: "#0057B8",
  blue2: "#3A78B8",
  blueLight: "#DCEAF7",
  bluePale: "#EEF5FB",
  line: "#D2D7DE",
  teal: "#4F8A9C",
  tealPale: "#EAF3F5",
  warmPale: "#F6F2EA",
  white: "#FFFFFF",
};
const FONT = "Microsoft YaHei";
const DISPLAY = "HYWenRunSongYun U";

function addText(slide, text, x, y, w, h, size, color = C.body, bold = false, opts = {}) {
  const s = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  s.text = text;
  s.text.style = {
    fontSize: size,
    fontFamily: opts.display ? DISPLAY : FONT,
    color,
    bold,
    alignment: opts.align || "left",
    verticalAlignment: opts.valign || "middle",
    italic: opts.italic || false,
  };
  return s;
}
function rect(slide, x, y, w, h, fill, line = "none", radius = false, name) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
    ...(radius ? { borderRadius: "rounded-lg" } : {}),
  });
}
function ellipse(slide, x, y, w, h, fill, line = "none", name) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
  });
}
function line(slide, x1, y1, x2, y2, color = C.line, width = 1, name) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left: x1, top: y1, width: x2 - x1, height: y2 - y1 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}
function arrow(slide, x, y, w, h, fill, name) {
  return slide.shapes.add({
    geometry: "rightArrow",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: "none", width: 0 },
  });
}
function header(slide, title, page) {
  addText(slide, title, 56, 34, 980, 48, 32, C.ink, true, { display: true, name: "page-title" });
  line(slide, 56, 92, 1224, 92, C.line, 1, "title-rule");
  addText(slide, "大学共享仪器服务改进｜模拟分析", 56, 676, 520, 20, 14, C.muted, false);
  addText(slide, "模拟数据，仅用于方案讨论", 560, 676, 430, 20, 14, C.muted, false, { align: "center" });
  addText(slide, String(page).padStart(2, "0"), 1170, 676, 54, 20, 14, C.muted, true, { align: "right" });
}
function note(slide, body) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n${body}`);
  slide.speakerNotes.setVisible(true);
}
function pct(v) { return `${v}%`; }

function slide1(p) {
  const s = p.slides.add();
  s.background.fill = C.white;
  header(s, "预约量上升与等待下降同时出现，仍需拆分高峰与设备差异", 1);
  addText(s, "2023–2025 年观察到的方向一致，但不构成因果证据", 56, 112, 730, 28, 18, C.body, false);

  const chart = { left: 90, top: 184, width: 790, height: 380 };
  const baseY = chart.top + chart.height;
  const topY = chart.top + 24;
  const maxVol = 2000;
  const years = ["2023", "2024", "2025"];
  const vols = [1200, 1560, 1920];
  const waits = [8, 7, 6];
  for (let i = 0; i <= 4; i++) {
    const y = baseY - (chart.height * i) / 4;
    line(s, chart.left, y, chart.left + chart.width, y, i === 0 ? C.body : C.line, i === 0 ? 1.5 : 1);
    addText(s, `${i * 500}`, 24, y - 10, 66, 20, 14, C.muted, false, { align: "right" });
  }
  addText(s, "预约完成量（单）", 90, 148, 170, 22, 16, C.blue, true);
  addText(s, "中位等待时间（天）", 720, 148, 190, 22, 16, C.muted, true, { align: "right" });
  const xs = [240, 480, 720];
  const bw = 100;
  xs.forEach((x, i) => {
    const bh = (vols[i] / maxVol) * chart.height;
    rect(s, x - bw / 2, baseY - bh, bw, bh, i === 2 ? C.blue : C.blue2, "none", true, `volume-bar-${i}`);
    addText(s, String(vols[i]), x - 70, baseY - bh - 30, 140, 24, 18, C.blue, true, { align: "center" });
    addText(s, years[i], x - 50, baseY + 16, 100, 24, 16, C.ink, true, { align: "center" });
  });
  // A restrained companion line for the second metric; labels carry the exact values.
  const waitY = (v) => chart.top + 50 + ((8 - v) / 2) * 170;
  line(s, xs[0], waitY(waits[0]), xs[1], waitY(waits[1]), C.ink, 2, "wait-line-1");
  line(s, xs[1], waitY(waits[1]), xs[2], waitY(waits[2]), C.ink, 2, "wait-line-2");
  xs.forEach((x, i) => {
    ellipse(s, x - 7, waitY(waits[i]) - 7, 14, 14, C.white, C.ink, `wait-point-${i}`);
    addText(s, `${waits[i]} 天`, x - 42, waitY(waits[i]) - 34, 84, 22, 16, C.ink, true, { align: "center" });
  });
  addText(s, "读法", 950, 178, 110, 22, 16, C.blue, true);
  line(s, 950, 207, 1224, 207, C.line, 1);
  addText(s, "使用增长与等待下降是同时观察到的现象。", 950, 228, 260, 52, 18, C.body, false);
  addText(s, "拟议下一步", 950, 320, 160, 22, 16, C.blue, true);
  line(s, 950, 349, 1224, 349, C.line, 1);
  addText(s, "继续观察高峰时段及分设备等待，避免平均改善掩盖局部拥堵。", 950, 370, 260, 92, 18, C.body, false);
  addText(s, "注：预约量与等待时间使用不同量纲；图中并列展示，不进行合并评分。", 90, 606, 790, 22, 14, C.muted, false);
  note(s, "数据与判断均来自用户提供的 manuscript.md 第 1 节；所有数字为模拟构造数据。未使用外部资产。 ");
}

function slide2(p) {
  const s = p.slides.add();
  s.background.fill = C.white;
  header(s, "校内先解决时段供给，校外先解决审批与费用说明", 2);
  addText(s, "模拟多选问卷：两组各 100 人，四个维度可同时被选择", 56, 112, 760, 28, 18, C.body);
  addText(s, "选择比例（%）", 278, 164, 160, 22, 16, C.muted, true);
  addText(s, "校内", 620, 164, 100, 22, 16, C.blue, true, { align: "center" });
  addText(s, "校外", 810, 164, 100, 22, 16, C.teal, true, { align: "center" });
  line(s, 278, 194, 940, 194, C.line, 1);
  const labels = ["时段难匹配", "审批慢", "费用不清", "操作培训不足"];
  const inVals = [62, 48, 28, 44];
  const outVals = [45, 65, 58, 32];
  const y0 = 228;
  const rowGap = 74;
  const scale = 4.2;
  labels.forEach((lab, i) => {
    const y = y0 + i * rowGap;
    addText(s, lab, 56, y + 1, 200, 24, 18, C.ink, true);
    addText(s, pct(inVals[i]), 278, y + 1, 52, 24, 16, C.blue, true, { align: "right" });
    rect(s, 344, y + 4, 230, 14, C.bluePale, "none", true);
    rect(s, 344, y + 4, inVals[i] * scale, 14, C.blue, "none", true);
    addText(s, pct(outVals[i]), 620, y + 1, 52, 24, 16, C.teal, true, { align: "right" });
    rect(s, 686, y + 4, 230, 14, C.tealPale, "none", true);
    rect(s, 686, y + 4, outVals[i] * scale, 14, C.teal, "none", true);
    line(s, 278, y + 48, 940, y + 48, C.line, 1);
  });
  addText(s, "校内优先", 1000, 222, 170, 24, 21, C.blue, true);
  addText(s, "时段供给", 1000, 258, 180, 34, 28, C.ink, true, { display: true });
  line(s, 1000, 308, 1224, 308, C.line, 1);
  addText(s, "校外优先", 1000, 338, 170, 24, 21, C.teal, true);
  addText(s, "审批 + 费用说明", 1000, 374, 210, 34, 25, C.ink, true, { display: true });
  line(s, 1000, 428, 1224, 428, C.line, 1);
  addText(s, "口径提醒", 1000, 456, 120, 22, 16, C.muted, true);
  addText(s, "多选比例不相加为 100%；样本仅用于本次讨论，不能推广。", 1000, 486, 224, 70, 16, C.body);
  note(s, "数据与判断均来自用户提供的 manuscript.md 第 2 节；校内与校外各 100 人，多选比例不相加为 100%。所有数字为模拟构造数据。未使用外部资产。 ");
}

function slide3(p) {
  const s = p.slides.add();
  s.background.fill = C.white;
  header(s, "三阶段试点按记录完整、责任明确逐步推进", 3);
  addText(s, "每一阶段先交付可检查的基础，再观察对应指标；未设定量化改善目标", 56, 112, 920, 28, 18, C.body);
  const y = 276;
  // Connectors first: the rail is continuous and gates sit on top of it.
  arrow(s, 88, y + 34, 320, 68, C.bluePale, "stage-rail-1");
  arrow(s, 372, y + 34, 320, 68, C.blueLight, "stage-rail-2");
  arrow(s, 656, y + 34, 320, 68, C.blue, "stage-rail-3");
  // Gates across the rail encode the must-pass condition.
  rect(s, 356, y + 18, 18, 100, C.ink, "none", true, "gate-1");
  rect(s, 640, y + 18, 18, 100, C.ink, "none", true, "gate-2");
  const stages = [
    { x: 92, title: "阶段 1｜统一入口", deliver: "统一设备与时段目录", metric: "信息完整率", fill: C.bluePale },
    { x: 376, title: "阶段 2｜明确责任", deliver: "责任人与时限表", metric: "审批时长", fill: C.blueLight },
    { x: 660, title: "阶段 3｜发布说明", deliver: "费用清单及培训入口", metric: "重复咨询量", fill: C.blue },
  ];
  stages.forEach((st, i) => {
    addText(s, st.title, st.x, 186, 236, 28, 21, i === 2 ? C.blue : C.ink, true);
    addText(s, "交付", st.x, 376, 70, 20, 14, C.muted, true);
    addText(s, st.deliver, st.x, 400, 220, 28, 18, C.body, false);
    addText(s, "观察", st.x, 456, 70, 20, 14, C.muted, true);
    addText(s, st.metric, st.x, 480, 220, 28, 18, C.ink, true);
  });
  addText(s, "记录完整", 325, 226, 100, 22, 16, C.ink, true, { align: "center" });
  addText(s, "责任明确", 609, 226, 100, 22, 16, C.ink, true, { align: "center" });
  line(s, 330, 252, 420, 252, C.line, 1);
  line(s, 614, 252, 704, 252, C.line, 1);
  rect(s, 980, 180, 244, 286, C.warmPale, "none", true, "access-note");
  addText(s, "暂停条件", 1004, 204, 150, 24, 21, C.ink, true);
  line(s, 1004, 240, 1198, 240, C.line, 1);
  addText(s, "涉及新访问授权时暂停共享；授权处理后恢复。", 1004, 264, 190, 74, 18, C.body);
  addText(s, "预期用途", 1004, 366, 150, 24, 16, C.blue, true);
  addText(s, "更早判断可用性，并定位问题落在哪个环节。", 1004, 396, 190, 52, 18, C.body);
  addText(s, "这是假设中的管理用途，不是已验证收益。", 88, 590, 820, 22, 14, C.muted, false);
  note(s, "流程、指标与暂停条件均来自用户提供的 manuscript.md 第 3 节。阶段先后与门禁为拟议方案；指标没有预设数值，所有内容用于方案讨论。未使用外部资产。 ");
}

function slide4(p) {
  const s = p.slides.add();
  s.background.fill = C.white;
  header(s, "支持优先级由预约频次与操作支持需求共同定位", 4);
  addText(s, "二维诊断用于本次讨论：50 为分界，不代表行业标准或统计分类", 56, 112, 900, 28, 18, C.body);
  const plot = { left: 180, top: 190, width: 660, height: 360 };
  const midX = plot.left + plot.width / 2;
  const midY = plot.top + plot.height / 2;
  rect(s, plot.left, plot.top, plot.width / 2, plot.height / 2, C.bluePale, "none");
  rect(s, midX, plot.top, plot.width / 2, plot.height / 2, C.blueLight, "none");
  rect(s, plot.left, midY, plot.width / 2, plot.height / 2, C.white, "none");
  rect(s, midX, midY, plot.width / 2, plot.height / 2, C.tealPale, "none");
  line(s, midX, plot.top, midX, plot.top + plot.height, C.body, 1.5, "y-axis");
  line(s, plot.left, midY, plot.left + plot.width, midY, C.body, 1.5, "x-axis");
  addText(s, "操作支持需求高", plot.left - 30, plot.top - 36, 180, 22, 16, C.ink, true);
  addText(s, "操作支持需求低", plot.left - 30, plot.top + plot.height + 18, 180, 22, 16, C.muted, true);
  addText(s, "预约频次低", plot.left - 4, plot.top + plot.height + 48, 120, 22, 16, C.muted, true);
  addText(s, "预约频次高", plot.left + plot.width - 118, plot.top + plot.height + 48, 120, 22, 16, C.ink, true, { align: "right" });
  addText(s, "50", midX - 18, midY + 8, 36, 20, 14, C.muted, true, { align: "center" });
  addText(s, "50", midX + 10, midY - 28, 36, 20, 14, C.muted, true, { align: "center" });
  const mapX = (v) => plot.left + (v / 100) * plot.width;
  const mapY = (v) => plot.top + plot.height - (v / 100) * plot.height;
  const bubbles = [
    { name: "显微成像", x: 85, y: 80, fill: C.blue, ink: C.white, r: 50 },
    { name: "基础检测", x: 80, y: 25, fill: C.white, ink: C.ink, r: 45 },
    { name: "材料制备", x: 35, y: 75, fill: C.teal, ink: C.white, r: 48 },
    { name: "常规加工", x: 30, y: 30, fill: C.white, ink: C.ink, r: 44 },
  ];
  bubbles.forEach((b, i) => {
    const cx = mapX(b.x); const cy = mapY(b.y);
    ellipse(s, cx - b.r, cy - b.r, b.r * 2, b.r * 2, b.fill, b.fill === C.white ? C.line : "none", `bubble-${i}`);
    addText(s, b.name, cx - b.r + 6, cy - 12, b.r * 2 - 12, 24, 16, b.ink, true, { align: "center" });
  });
  addText(s, "优先增设辅导时段", 900, 202, 260, 24, 18, C.blue, true);
  addText(s, "高频 × 高支持｜显微成像", 900, 232, 270, 22, 16, C.body);
  line(s, 900, 270, 1224, 270, C.line, 1);
  addText(s, "优先完善自助说明", 900, 294, 260, 24, 18, C.ink, true);
  addText(s, "高频 × 低支持｜基础检测", 900, 324, 270, 22, 16, C.body);
  line(s, 900, 362, 1224, 362, C.line, 1);
  addText(s, "预约辅导 / 维持基础服务", 900, 386, 300, 24, 18, C.teal, true);
  addText(s, "低频 × 高支持：材料制备；低频 × 低支持：常规加工", 900, 418, 300, 54, 16, C.body);
  addText(s, "点的位置不表示成本、设备价值或真实利用率。", 180, 628, 660, 22, 14, C.muted);
  note(s, "设备名称与坐标来自用户提供的 manuscript.md 第 4 节；横纵轴均为 0–100，50 为本次讨论分界，无外部行业含义。气泡大小仅服务排版，不表达第三维数据。未使用外部资产。 ");
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(p); slide2(p); slide3(p); slide4(p);
  for (const [i, s] of p.slides.items.entries()) {
    const n = String(i + 1).padStart(2, "0");
    await writeBlob(`${OUT}/slide-${n}.png`, await p.export({ slide: s, format: "png", scale: 1 }));
  }
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
