import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/ablation/run-b";
const W = 1280;
const H = 720;
const C = {
  blue: "#315F91",
  blueDeep: "#24486D",
  blueSoft: "#EAF1F8",
  bluePale: "#F5F8FD",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#AFC6E8",
  grid: "#D9E3EF",
  white: "#FFFFFF",
};
const FONT_BODY = "Microsoft YaHei";
const FONT_TITLE = "HYWenRunSongYun U";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, left, top, width, height, size, color = C.body, opts = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    fontSize: size,
    typeface: opts.typeface || FONT_BODY,
    color,
    bold: Boolean(opts.bold),
    alignment: opts.align || "left",
    verticalAlignment: opts.valign || "top",
    autoFit: "none",
    wrap: "square",
    lineSpacing: opts.lineSpacing || 1.2,
    insets: opts.insets || { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return box;
}

function addRect(slide, name, left, top, width, height, fill, line = "none", radius = 0) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addLine(slide, name, x1, y1, x2, y2, color = C.line, width = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left: x1, top: y1, width: x2 - x1, height: y2 - y1 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addCircle(slide, name, cx, cy, d, fill, line = C.white) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left: cx - d / 2, top: cy - d / 2, width: d, height: d },
    fill,
    line: { style: "solid", fill: line, width: 2 },
  });
}

function chrome(slide, pageNo, section = "大学共享仪器服务改进") {
  slide.background.fill = C.white;
  addText(slide, `eyebrow-${pageNo}`, `${section}  /  模拟分析`, 56, 28, 420, 22, 14, C.muted, { bold: true });
  addText(slide, `page-${pageNo}`, `${String(pageNo).padStart(2, "0")} / 04`, 1080, 28, 144, 22, 14, C.muted, { align: "right" });
  addLine(slide, `title-rule-${pageNo}`, 56, 124, 1224, 124, C.line, 1);
  addText(slide, `footer-${pageNo}`, "模拟数据，仅用于方案讨论", 56, 682, 400, 18, 14, C.muted, { typeface: FONT_BODY });
  addText(slide, `footer-page-${pageNo}`, `大学平台管理团队  ·  ${String(pageNo).padStart(2, "0")}`, 1020, 682, 204, 18, 14, C.muted, { align: "right" });
}

function notes(slide, page) {
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    `- 内容：experiments/mckinsey-prompt-study/manuscript.md（第${page}节；模拟数据）`,
    "- 视觉：东北大学 Skin 主题契约（Microsoft YaHei 正文；HYWenRunSongYun U 标题；主题蓝 #315F91）",
    "[/Sources]",
  ]);
  slide.speakerNotes.setVisible(true);
}

function addAxisLabels(slide, values, left, top, width, height, max, prefix = "") {
  for (const value of values) {
    const x = left + (value / max) * width;
    addLine(slide, `${prefix}grid-${value}`, x, top, x, top + height, C.grid, 1);
    addText(slide, `${prefix}tick-${value}`, String(value), x - 22, top + height + 8, 44, 18, 14, C.muted, { align: "center" });
  }
}

function slide1(pres) {
  const s = pres.slides.add();
  chrome(s, 1);
  addText(s, "title-1", "使用量上升与等待下降同时出现，仍需拆分高峰拥堵", 56, 72, 1080, 42, 32, C.dark, { typeface: FONT_TITLE, bold: true });
  addText(s, "sub-1", "预约完成量（单）与中位等待时间（天）", 56, 143, 600, 24, 18, C.muted);

  const chartTop = 205;
  const chartH = 320;
  const chartLeft = 86;
  const chartW = 620;
  const maxVol = 2100;
  [0, 700, 1400, 2100].forEach((v) => {
    const y = chartTop + chartH - (v / maxVol) * chartH;
    addLine(s, `vol-y-${v}`, chartLeft, y, chartLeft + chartW, y, C.grid, 1);
    addText(s, `vol-label-${v}`, v === 0 ? "0" : v.toLocaleString(), 20, y - 9, 64, 18, 14, C.muted, { align: "right" });
  });
  addText(s, "vol-axis", "预约完成量（单）", 56, 183, 220, 20, 16, C.body, { bold: true });
  const years = ["2023", "2024", "2025"];
  const volumes = [1200, 1560, 1920];
  const xCenters = [190, 370, 550];
  volumes.forEach((v, i) => {
    const h = (v / maxVol) * chartH;
    addRect(s, `vol-bar-${i}`, xCenters[i] - 36, chartTop + chartH - h, 72, h, C.blue, "none", 4);
    addText(s, `vol-value-${i}`, v.toLocaleString(), xCenters[i] - 45, chartTop + chartH - h - 28, 90, 20, 16, C.blueDeep, { bold: true, align: "center" });
    addText(s, `vol-year-${i}`, years[i], xCenters[i] - 45, chartTop + chartH + 14, 90, 20, 16, C.body, { align: "center" });
  });
  addText(s, "vol-source", "观察量：完成量逐年增加", 86, 552, 380, 24, 18, C.body, { bold: true });

  const lineLeft = 814;
  const lineW = 320;
  const waitTop = 205;
  const waitH = 320;
  addText(s, "wait-axis", "中位等待时间（天）", 784, 183, 240, 20, 16, C.body, { bold: true });
  [0, 2, 4, 6, 8].forEach((v) => {
    const y = waitTop + waitH - (v / 8) * waitH;
    addLine(s, `wait-y-${v}`, lineLeft, y, lineLeft + lineW, y, C.grid, 1);
    addText(s, `wait-label-${v}`, String(v), 776, y - 9, 26, 18, 14, C.muted, { align: "right" });
  });
  const waits = [8, 7, 6];
  const lx = [850, 970, 1090];
  const points = waits.map((v, i) => ({ x: lx[i], y: waitTop + waitH - (v / 8) * waitH }));
  addLine(s, "wait-line-1", points[0].x, points[0].y, points[1].x, points[1].y, C.blueDeep, 3);
  addLine(s, "wait-line-2", points[1].x, points[1].y, points[2].x, points[2].y, C.blueDeep, 3);
  points.forEach((p, i) => {
    addCircle(s, `wait-dot-${i}`, p.x, p.y, 16, C.white, C.blueDeep);
    addText(s, `wait-value-${i}`, `${waits[i]}天`, p.x - 32, p.y - 34, 64, 20, 16, C.blueDeep, { bold: true, align: "center" });
    addText(s, `wait-year-${i}`, years[i], p.x - 42, waitTop + waitH + 14, 84, 20, 16, C.body, { align: "center" });
  });
  addText(s, "wait-source", "观察量：中位等待同步下降", 814, 552, 380, 24, 18, C.body, { bold: true });

  addRect(s, "boundary-1", 56, 594, 1168, 58, C.bluePale, C.line, 8);
  addText(s, "boundary-1-text", "如何解读：两项指标同时改善，但不证明任何单一措施造成改善。下一步按高峰时段与分设备等待拆分，避免平均值掩盖局部拥堵。", 78, 607, 1124, 34, 18, C.body, { valign: "middle" });
  notes(s, 1);
}

function slide2(pres) {
  const s = pres.slides.add();
  chrome(s, 2);
  addText(s, "title-2", "校内与校外的主要障碍不同，应分别设定优先顺序", 56, 72, 1080, 42, 32, C.dark, { typeface: FONT_TITLE, bold: true });
  addText(s, "sub-2", "模拟问卷多选：每组 n=100；百分比不相加为 100%", 56, 143, 720, 24, 18, C.muted);
  addText(s, "legend-in", "校内用户", 170, 184, 160, 22, 16, C.blueDeep, { bold: true });
  addRect(s, "legend-in-dot", 140, 188, 18, 14, C.blue, "none", 3);
  addText(s, "legend-out", "校外用户", 1000, 184, 160, 22, 16, C.blueDeep, { bold: true });
  addRect(s, "legend-out-dot", 972, 188, 18, 14, C.blueDeep, "none", 3);
  const rows = [
    ["时段难匹配", 62, 45],
    ["审批慢", 48, 65],
    ["费用不清", 28, 58],
    ["操作培训不足", 44, 32],
  ];
  const centerX = 640;
  const half = 470;
  const max = 70;
  const rowYs = [250, 335, 420, 505];
  addLine(s, "compare-axis", centerX, 220, centerX, 548, C.line, 2);
  addText(s, "left-scale", "70%", centerX - half - 16, 212, 44, 18, 14, C.muted, { align: "right" });
  addText(s, "left-scale-0", "0", centerX - 8, 212, 16, 18, 14, C.muted, { align: "center" });
  addText(s, "right-scale-0", "0", centerX - 8, 212, 16, 18, 14, C.muted, { align: "center" });
  addText(s, "right-scale", "70%", centerX + half - 22, 212, 44, 18, 14, C.muted, { align: "center" });
  rows.forEach(([label, inside, outside], i) => {
    const y = rowYs[i];
    addLine(s, `row-line-${i}`, centerX - half, y + 28, centerX + half, y + 28, C.grid, 1);
    const inW = (inside / max) * half;
    const outW = (outside / max) * half;
    addRect(s, `in-bar-${i}`, centerX - inW, y + 6, inW, 20, i === 0 ? C.blueDeep : C.blue, "none", 4);
    addRect(s, `out-bar-${i}`, centerX, y + 6, outW, 20, i === 1 || i === 2 ? C.blueDeep : C.blue, "none", 4);
    addText(s, `in-value-${i}`, `${inside}%`, centerX - inW - 58, y + 3, 50, 22, 16, C.blueDeep, { bold: true, align: "right" });
    addText(s, `out-value-${i}`, `${outside}%`, centerX + outW + 8, y + 3, 50, 22, 16, C.blueDeep, { bold: true });
    addRect(s, `row-label-bg-${i}`, centerX - 125, y - 1, 250, 34, C.white, "none", 2);
    addText(s, `row-label-${i}`, label, centerX - 125, y, 250, 32, 18, C.body, { bold: true, align: "center", valign: "middle" });
  });
  addRect(s, "judgment-2", 56, 590, 1168, 62, C.bluePale, C.line, 8);
  addText(s, "judgment-2-text", "判断：校内优先关注时段供给；校外优先关注审批与费用说明。", 78, 607, 1124, 30, 21, C.blueDeep, { bold: true, valign: "middle" });
  notes(s, 2);
}

function slide3(pres) {
  const s = pres.slides.add();
  chrome(s, 3);
  addText(s, "title-3", "三阶段试点按可观察的管理动作推进，不预设改善曲线", 56, 72, 1080, 42, 32, C.dark, { typeface: FONT_TITLE, bold: true });
  addText(s, "sub-3", "阶段有先后；指标用于观察，不写入预设数值目标", 56, 143, 720, 24, 18, C.muted);
  const xs = [78, 416, 754];
  const cardW = 286;
  const cardY = 220;
  const cardH = 310;
  const titles = ["统一入口", "明确审批责任", "发布说明" ];
  const actions = [
    ["交付", "统一设备与时段目录"],
    ["交付", "责任人与时限表"],
    ["交付", "费用清单及培训入口"],
  ];
  const indicators = ["观察：信息完整率", "观察：审批时长", "观察：重复咨询量"];
  // connectors first so the sequence remains visually behind the stage nodes
  addLine(s, "flow-1", xs[0] + cardW, 350, xs[1] - 26, 350, C.blue, 3);
  addLine(s, "flow-2", xs[1] + cardW, 350, xs[2] - 26, 350, C.blue, 3);
  addRect(s, "arrow-1", xs[1] - 30, 342, 26, 16, C.blue, "none", 2);
  addRect(s, "arrow-2", xs[2] - 30, 342, 26, 16, C.blue, "none", 2);
  xs.forEach((x, i) => {
    addRect(s, `stage-${i}`, x, cardY, cardW, cardH, C.white, C.line, 10);
    addRect(s, `stage-top-${i}`, x, cardY, cardW, 8, C.blue, "none", 4);
    addCircle(s, `stage-number-${i}`, x + 38, cardY + 52, 34, C.blue, C.white);
    addText(s, `stage-number-text-${i}`, String(i + 1), x + 23, cardY + 40, 30, 24, 18, C.white, { bold: true, align: "center", valign: "middle" });
    addText(s, `stage-title-${i}`, titles[i], x + 70, cardY + 34, 192, 34, 21, C.blueDeep, { bold: true, valign: "middle" });
    addLine(s, `stage-divider-${i}`, x + 26, cardY + 96, x + cardW - 26, cardY + 96, C.grid, 1);
    addText(s, `stage-action-label-${i}`, actions[i][0], x + 26, cardY + 120, 56, 24, 16, C.muted, { bold: true });
    addText(s, `stage-action-${i}`, actions[i][1], x + 26, cardY + 149, cardW - 52, 54, 18, C.body, { bold: true });
    addText(s, `stage-ind-label-${i}`, "指标", x + 26, cardY + 226, 56, 24, 16, C.muted, { bold: true });
    addText(s, `stage-ind-${i}`, indicators[i], x + 26, cardY + 255, cardW - 52, 32, 18, C.body);
  });
  addRect(s, "condition-3", 56, 558, 1168, 56, C.bluePale, C.line, 8);
  addText(s, "condition-3", "推进门槛：每阶段仅在记录完整、责任明确后推进，由平台负责人确认。", 78, 572, 1124, 26, 18, C.blueDeep, { bold: true, valign: "middle" });
  addText(s, "exception-3", "授权例外：涉及新访问授权时暂停共享；授权处理后恢复。", 56, 632, 900, 24, 16, C.muted);
  notes(s, 3);
}

function slide4(pres) {
  const s = pres.slides.add();
  chrome(s, 4);
  addText(s, "title-4", "诊断矩阵把辅导投入引向高频高支持场景", 56, 72, 1080, 42, 32, C.dark, { typeface: FONT_TITLE, bold: true });
  addText(s, "sub-4", "预约频次指数 × 操作支持需求指数（均为 0—100；50 为本次讨论分界）", 56, 143, 960, 24, 18, C.muted);
  const plot = { left: 120, top: 220, width: 620, height: 330 };
  addRect(s, "plot-bg", plot.left, plot.top, plot.width, plot.height, C.bluePale, C.line, 4);
  const midX = plot.left + plot.width / 2;
  const midY = plot.top + plot.height / 2;
  addLine(s, "matrix-mid-x", midX, plot.top, midX, plot.top + plot.height, C.blue, 1);
  addLine(s, "matrix-mid-y", plot.left, midY, plot.left + plot.width, midY, C.blue, 1);
  addLine(s, "x-axis", plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, C.dark, 2);
  addLine(s, "y-axis", plot.left, plot.top, plot.left, plot.top + plot.height, C.dark, 2);
  [0, 50, 100].forEach((v) => {
    const x = plot.left + (v / 100) * plot.width;
    const y = plot.top + plot.height - (v / 100) * plot.height;
    addText(s, `x-label-${v}`, String(v), x - 18, plot.top + plot.height + 12, 36, 18, 14, C.muted, { align: "center" });
    addText(s, `y-label-${v}`, String(v), plot.left - 34, y - 9, 28, 18, 14, C.muted, { align: "right" });
  });
  addText(s, "x-title", "预约频次指数", plot.left + 206, 574, 220, 22, 16, C.body, { bold: true, align: "center" });
  addText(s, "y-title", "操作支持需求指数", 30, 302, 24, 170, 16, C.body, { bold: true, align: "center", valign: "middle" });
  addText(s, "q-hh", "高频 / 高支持", midX + 18, plot.top + 12, 160, 22, 16, C.blueDeep, { bold: true });
  addText(s, "q-hl", "高频 / 低支持", midX + 18, midY + 12, 160, 22, 16, C.muted, { bold: true });
  addText(s, "q-lh", "低频 / 高支持", plot.left + 18, plot.top + 12, 160, 22, 16, C.muted, { bold: true });
  addText(s, "q-ll", "低频 / 低支持", plot.left + 18, midY + 12, 160, 22, 16, C.muted, { bold: true });
  const devices = [
    ["显微成像", 85, 80, 0, -28, C.blueDeep],
    ["基础检测", 80, 25, 0, 12, C.blue],
    ["材料制备", 35, 75, -94, -12, C.blue],
    ["常规加工", 30, 30, -94, 12, C.blue],
  ];
  devices.forEach(([label, xVal, yVal, dx, dy, fill], i) => {
    const cx = plot.left + (xVal / 100) * plot.width;
    const cy = plot.top + plot.height - (yVal / 100) * plot.height;
    addCircle(s, `device-${i}`, cx, cy, 22, fill, C.white);
    addText(s, `device-label-${i}`, label, cx + dx, cy + dy, 96, 22, 16, C.body, { bold: true, align: dx < 0 ? "right" : "left" });
    addText(s, `device-value-${i}`, `(${xVal}, ${yVal})`, cx + dx, cy + dy + 22, 96, 18, 14, C.muted, { align: dx < 0 ? "right" : "left" });
  });

  addText(s, "matrix-action-title", "按象限安排支持", 820, 212, 300, 28, 21, C.blueDeep, { bold: true });
  const actions = [
    ["高频 × 高支持", "增设辅导时段", C.blueDeep],
    ["高频 × 低支持", "完善自助说明", C.blue],
    ["低频 × 高支持", "采用预约辅导", C.blue],
    ["低频 × 低支持", "维持基础服务", C.muted],
  ];
  actions.forEach(([q, a, col], i) => {
    const y = 270 + i * 66;
    addLine(s, `action-line-${i}`, 820, y + 46, 1178, y + 46, C.grid, 1);
    addText(s, `action-q-${i}`, q, 820, y, 180, 24, 16, col, { bold: true });
    addText(s, `action-a-${i}`, a, 1015, y, 160, 24, 18, C.body, { bold: true });
  });
  addRect(s, "matrix-boundary", 820, 548, 358, 70, C.bluePale, C.line, 8);
  addText(s, "matrix-boundary-text", "边界：分界只帮助本次讨论；点位不表示成本、设备价值或真实利用率。", 838, 560, 322, 48, 16, C.body, { valign: "middle" });
  notes(s, 4);
}

async function main() {
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(presentation);
  slide2(presentation);
  slide3(presentation);
  slide4(presentation);
  await fs.mkdir(OUT, { recursive: true });
  for (const [idx, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(idx + 1).padStart(2, "0")}`;
    await writeBlob(`${OUT}/${stem}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
