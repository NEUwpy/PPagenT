import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/field-test/run-fields";
const W = 1280;
const H = 720;
const C = {
  bg: "#FFFFFF",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#D8DEE6",
  pale: "#F4F7FA",
  blue: "#315F91",
  blueDark: "#23466D",
  blueMid: "#6C8FB4",
  bluePale: "#DCE8F3",
  gray: "#A5ABB3",
  grayPale: "#EEF0F2",
  white: "#FFFFFF",
};
const TITLE_FONT = "HYWenRunSongYun U";
const BODY_FONT = "Microsoft YaHei";

function shape(slide, geometry, x, y, w, h, fill = "none", lineFill = "none", lineWidth = 0, name) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function text(slide, value, x, y, w, h, fontSize, color = C.body, opts = {}) {
  const s = shape(slide, "textbox", x, y, w, h, "none", "none", 0, opts.name);
  s.text = value;
  s.text.style = {
    fontSize,
    color,
    typeface: opts.typeface ?? BODY_FONT,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    alignment: opts.align ?? "left",
  };
  return s;
}

function line(slide, x1, y1, x2, y2, color = C.line, width = 1, name) {
  return shape(slide, "line", x1, y1, x2 - x1, y2 - y1, "none", color, width, name);
}

function circle(slide, cx, cy, r, fill, stroke = "none", sw = 0, name) {
  return shape(slide, "ellipse", cx - r, cy - r, r * 2, r * 2, fill, stroke, sw, name);
}

function shell(slide, title, page) {
  slide.background.fill = C.bg;
  text(slide, title, 56, 44, 980, 48, 32, C.dark, { typeface: TITLE_FONT, bold: true, name: "page-title" });
  line(slide, 56, 104, 1224, 104, C.line, 1, "title-rule");
  text(slide, "大学共享仪器服务改进 · 模拟分析材料", 56, 678, 520, 18, 12, C.muted, { name: "source-note" });
  text(slide, "模拟数据，仅用于方案讨论", 560, 678, 420, 18, 12, C.muted, { align: "center", name: "simulation-note" });
  text(slide, String(page).padStart(2, "0"), 1176, 676, 48, 20, 14, C.muted, { align: "right", name: "page-number" });
}

function addNotes(slide, extra = "") {
  slide.speakerNotes.textFrame.setText(`[Sources]\n用户提供稿件：experiments/mckinsey-prompt-study/manuscript.md（模拟数据，无外部来源）。\n${extra}`);
  slide.speakerNotes.setVisible(true);
}

function addTickLabels(slide, x, y, width, max, values, labelY = y + 320) {
  for (const v of values) {
    const xx = x + (v / max) * width;
    line(slide, xx, y, xx, y + 300, C.line, 1);
    text(slide, String(v), xx - 25, labelY, 50, 18, 12, C.muted, { align: "center" });
  }
}

function slide1(pres) {
  const s = pres.slides.add();
  shell(s, "预约完成量增长与等待下降同时发生", 1);
  text(s, "2023—2025 年，两项指标朝有利方向变化，但不能归因于单一措施", 56, 120, 900, 28, 18, C.body);

  const x = 92, chartW = 740, baseY = 390;
  text(s, "预约完成量（单）", x, 158, 220, 24, 18, C.blueDark, { bold: true });
  const orderScale = 210 / 2000;
  const orders = [1200, 1560, 1920];
  const years = ["2023", "2024", "2025"];
  orders.forEach((v, i) => {
    const bx = x + 90 + i * 215;
    const bh = v * orderScale;
    shape(s, "rect", bx, baseY - bh, 82, bh, C.blue, "none", 0, `orders-${i}`);
    text(s, String(v), bx - 8, baseY - bh - 28, 98, 22, 16, C.blueDark, { bold: true, align: "center" });
    text(s, years[i], bx - 8, baseY + 10, 98, 20, 14, C.muted, { align: "center" });
  });
  line(s, x + 35, baseY, x + chartW, baseY, C.dark, 1);
  [0, 1000, 2000].forEach(v => {
    const yy = baseY - v * orderScale;
    line(s, x + 35, yy, x + chartW, yy, C.line, 1);
    text(s, String(v), x - 8, yy - 9, 36, 18, 12, C.muted, { align: "right" });
  });

  const waitTop = 452, waitBase = 618;
  text(s, "中位等待时间（天）", x, 430, 260, 24, 18, C.body, { bold: true });
  const waitScale = 125 / 10;
  [8, 7, 6].forEach((v, i) => {
    const bx = x + 90 + i * 215;
    const bh = v * waitScale;
    shape(s, "rect", bx, waitBase - bh, 82, bh, C.gray, "none", 0, `wait-${i}`);
    text(s, String(v), bx - 8, waitBase - bh - 25, 98, 20, 15, C.body, { bold: true, align: "center" });
  });
  line(s, x + 35, waitBase, x + chartW, waitBase, C.dark, 1);
  [0, 5, 10].forEach(v => {
    const yy = waitBase - v * waitScale;
    line(s, x + 35, yy, x + chartW, yy, C.line, 1);
    text(s, String(v), x - 8, yy - 9, 36, 18, 12, C.muted, { align: "right" });
  });
  years.forEach((yr, i) => text(s, yr, x + 82 + i * 215, waitBase + 8, 98, 20, 14, C.muted, { align: "center" }));

  shape(s, "roundRect", 900, 158, 300, 446, C.pale, C.line, 1, "interpretation-box");
  text(s, "读法", 928, 190, 220, 28, 21, C.blueDark, { bold: true });
  text(s, "同时观察到：\n使用量 ↑\n等待时间 ↓", 928, 238, 230, 112, 24, C.dark, { bold: true });
  line(s, 928, 372, 1168, 372, C.line, 1);
  text(s, "这组趋势不能证明任何单一措施造成改善。", 928, 398, 234, 72, 17, C.body);
  text(s, "建议继续观察高峰时段及分设备等待，避免平均改善掩盖局部拥堵。", 928, 490, 236, 86, 16, C.body);
  addNotes(s);
}

function slide2(pres) {
  const s = pres.slides.add();
  shell(s, "障碍结构不同：校内受时段约束，校外更受审批与费用影响", 2);
  text(s, "模拟问卷多选（校内 n=100；校外 n=100）", 56, 120, 700, 26, 18, C.body);
  const x0 = 240, chartW = 700, rowY = [208, 292, 376, 460];
  const cats = ["时段难匹配", "审批慢", "费用不清", "操作培训不足"];
  const inP = [62, 48, 28, 44];
  const outP = [45, 65, 58, 32];
  [0, 25, 50, 75, 100].forEach(v => {
    const xx = x0 + (v / 100) * chartW;
    line(s, xx, 180, xx, 528, C.line, 1);
    text(s, String(v), xx - 18, 540, 36, 18, 12, C.muted, { align: "center" });
  });
  cats.forEach((cat, i) => {
    const y = rowY[i];
    text(s, cat, 56, y - 12, 150, 24, 17, C.body, { bold: true });
    shape(s, "rect", x0, y - 18, chartW, 20, C.grayPale, "none", 0, `row-bg-${i}`);
    shape(s, "rect", x0, y - 18, chartW * inP[i] / 100, 20, C.blue, "none", 0, `inside-${i}`);
    shape(s, "rect", x0, y + 18, chartW * outP[i] / 100, 20, C.blueMid, "none", 0, `outside-${i}`);
    text(s, `${inP[i]}%`, x0 + chartW * inP[i] / 100 + 10, y - 20, 48, 20, 14, C.blueDark, { bold: true });
    text(s, `${outP[i]}%`, x0 + chartW * outP[i] / 100 + 10, y + 16, 48, 20, 14, C.body, { bold: true });
  });
  shape(s, "rect", 242, 148, 14, 14, C.blue, "none", 0);
  text(s, "校内", 264, 143, 70, 24, 15, C.body, { bold: true });
  shape(s, "rect", 340, 148, 14, 14, C.blueMid, "none", 0);
  text(s, "校外", 362, 143, 70, 24, 15, C.body, { bold: true });
  shape(s, "roundRect", 1000, 180, 216, 348, C.pale, C.line, 1, "takeaway-box");
  text(s, "讨论重点", 1022, 206, 170, 28, 21, C.blueDark, { bold: true });
  text(s, "校内\n优先看时段供给", 1022, 260, 168, 64, 20, C.dark, { bold: true });
  line(s, 1022, 338, 1190, 338, C.line, 1);
  text(s, "校外\n优先看审批与费用说明", 1022, 362, 168, 76, 20, C.dark, { bold: true });
  text(s, "各项比例可加总超过 100%，因为问卷为多选。样本为模拟，不能推广。", 56, 594, 860, 30, 15, C.muted);
  addNotes(s);
}

function slide3(pres) {
  const s = pres.slides.add();
  shell(s, "试点按责任可观察性推进，不预设改善曲线", 3);
  text(s, "每阶段先完成记录与责任条件，再进入下一阶段；指标只作为观察项", 56, 120, 930, 26, 18, C.body);

  // Adapted phase-gates motif: a narrowing, segmented blue river with gates.
  const segments = [
    { x: 82, y: 268, w: 300, h: 170, title: "01 统一预约入口", body: "交付：设备与时段目录\n观察：信息完整率" },
    { x: 430, y: 230, w: 300, h: 154, title: "02 明确审批责任", body: "交付：责任人与时限表\n观察：审批时长" },
    { x: 778, y: 198, w: 300, h: 138, title: "03 发布费用与培训说明", body: "交付：费用清单＋培训入口\n观察：重复咨询量" },
  ];
  segments.forEach((seg, i) => {
    shape(s, "roundRect", seg.x, seg.y, seg.w, seg.h, i === 0 ? C.blue : i === 1 ? C.blueMid : C.blueDark, "none", 0, `phase-${i}`);
    text(s, seg.title, seg.x + 22, seg.y + 24, seg.w - 44, 28, i === 2 ? 18 : 21, C.white, { bold: true });
    text(s, seg.body, seg.x + 22, seg.y + 72, seg.w - 44, seg.h - 82, 16, C.white);
  });
  // Gates cross the river at phase boundaries.
  [{ x: 404, y: 244, label: "记录完整" }, { x: 752, y: 214, label: "责任明确" }].forEach((g, i) => {
    shape(s, "rect", g.x, g.y, 18, 184, C.dark, "none", 0, `gate-${i}`);
    line(s, g.x + 9, g.y - 28, g.x + 9, g.y, C.dark, 1);
    text(s, g.label, g.x - 42, g.y - 58, 104, 24, 15, C.dark, { bold: true, align: "center" });
  });
  // Directional chevrons behind/above the segments.
  shape(s, "chevron", 365, 313, 50, 48, C.bluePale, "none", 0, "advance-1");
  shape(s, "chevron", 713, 273, 50, 48, C.bluePale, "none", 0, "advance-2");
  shape(s, "triangle", 1080, 217, 42, 42, C.blueDark, "none", 0, "end-arrow");
  text(s, "阶段指标没有预设数值目标；推进依据是信息记录与责任条件是否具备。", 56, 468, 720, 28, 16, C.body, { italic: true });
  shape(s, "roundRect", 56, 528, 1020, 88, C.pale, C.line, 1, "pause-strip");
  text(s, "访问授权条件", 80, 550, 150, 22, 17, C.blueDark, { bold: true });
  text(s, "涉及新访问授权时暂停共享；授权处理后恢复。", 252, 548, 600, 26, 18, C.dark, { bold: true });
  text(s, "预期用途：让用户更早判断可用性，工作人员定位问题所在环节。仍属预期，不是已验证收益。", 80, 584, 920, 22, 14, C.muted);
  addNotes(s, "结构选择：sequence-phase-gates-004（阶段门禁流程）；本页保留分段推进、横跨门闸、阅读方向，按本页文字重算几何。");
}

function slide4(pres) {
  const s = pres.slides.add();
  shell(s, "支持优先级取决于预约频次与操作支持需求的组合", 4);
  text(s, "二维诊断：两条 50 分界线仅用于本次讨论，不代表外部行业标准", 56, 120, 900, 26, 18, C.body);
  const px = 118, py = 184, pw = 720, ph = 400;
  shape(s, "rect", px, py, pw, ph, C.pale, C.line, 1, "plot-frame");
  // Grid and thresholds
  [0, 25, 50, 75, 100].forEach(v => {
    const xx = px + (v / 100) * pw;
    const yy = py + ph - (v / 100) * ph;
    line(s, xx, py, xx, py + ph, v === 50 ? C.blueDark : C.line, v === 50 ? 2 : 1);
    line(s, px, yy, px + pw, yy, v === 50 ? C.blueDark : C.line, v === 50 ? 2 : 1);
    text(s, String(v), xx - 18, py + ph + 10, 36, 18, 12, C.muted, { align: "center" });
    text(s, String(v), px - 44, yy - 9, 34, 18, 12, C.muted, { align: "right" });
  });
  text(s, "预约频次指数", px + 244, 620, 230, 24, 16, C.dark, { bold: true, align: "center" });
  text(s, "操作支持需求指数", 42, 330, 180, 24, 16, C.dark, { bold: true, align: "center" });
  // Points: fixed radius, position only encodes values.
  const pts = [
    { name: "显微成像", x: 85, y: 80, dx: -82, dy: -36 },
    { name: "基础检测", x: 80, y: 25, dx: -72, dy: 16 },
    { name: "材料制备", x: 35, y: 75, dx: 18, dy: -34 },
    { name: "常规加工", x: 30, y: 30, dx: 18, dy: 16 },
  ];
  pts.forEach((p, i) => {
    const cx = px + (p.x / 100) * pw;
    const cy = py + ph - (p.y / 100) * ph;
    circle(s, cx, cy, 13, i === 0 ? C.blueDark : C.blue, C.white, 2, `point-${i}`);
    text(s, `${p.name}  (${p.x},${p.y})`, cx + p.dx, cy + p.dy, 160, 22, 14, C.dark, { bold: true });
  });
  text(s, "高频 × 高支持", px + 520, py + 18, 160, 20, 14, C.blueDark, { bold: true, align: "center" });
  text(s, "低频 × 高支持", px + 40, py + 18, 160, 20, 14, C.blueDark, { bold: true, align: "center" });
  text(s, "高频 × 低支持", px + 520, py + ph - 34, 160, 20, 14, C.blueDark, { bold: true, align: "center" });
  text(s, "低频 × 低支持", px + 40, py + ph - 34, 160, 20, 14, C.blueDark, { bold: true, align: "center" });

  shape(s, "roundRect", 900, 184, 300, 400, C.pale, C.line, 1, "priority-box");
  text(s, "讨论建议", 928, 210, 220, 28, 21, C.blueDark, { bold: true });
  const recs = [
    ["高频高支持", "增设辅导时段"],
    ["高频低支持", "完善自助说明"],
    ["低频高支持", "采用预约辅导"],
    ["低频低支持", "维持基础服务"],
  ];
  recs.forEach((r, i) => {
    const yy = 264 + i * 70;
    text(s, r[0], 928, yy, 140, 20, 15, C.dark, { bold: true });
    text(s, r[1], 928, yy + 24, 210, 22, 17, C.blueDark);
    if (i < recs.length - 1) line(s, 928, yy + 56, 1172, yy + 56, C.line, 1);
  });
  text(s, "点的位置不表示成本、设备价值或真实利用率。", 56, 648, 700, 20, 14, C.muted);
  addNotes(s);
}

async function main() {
  const pres = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(pres); slide2(pres); slide3(pres); slide4(pres);
  const pptx = await PresentationFile.exportPptx(pres);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
