import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/run-v1";
const W = 1280;
const H = 720;
const C = {
  bg: "#FFFFFF",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#D7DEE6",
  grid: "#E8EDF2",
  blue: "#315F91",
  blueDark: "#1D3856",
  blueLight: "#DDEAF5",
  bluePale: "#EEF5FA",
  blueMid: "#86A8C7",
  grayFill: "#F4F6F8",
  grayBlue: "#7A8C9E",
  white: "#FFFFFF",
  accent: "#B36B32",
};

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function shape(slide, geometry, position, fill = "none", line = { style: "solid", fill: "none", width: 0 }, name) {
  return slide.shapes.add({ geometry, name, position, fill, line });
}

function rect(slide, left, top, width, height, fill, line = { style: "solid", fill: "none", width: 0 }, name, radius = 0) {
  return shape(slide, radius ? "roundRect" : "rect", { left, top, width, height }, fill, line, name);
}

function ellipse(slide, left, top, width, height, fill, line = { style: "solid", fill: "none", width: 0 }, name) {
  return shape(slide, "ellipse", { left, top, width, height }, fill, line, name);
}

function text(slide, value, left, top, width, height, style = {}, name) {
  const s = shape(slide, "textbox", { left, top, width, height }, "none", { style: "solid", fill: "none", width: 0 }, name);
  s.text = value;
  s.text.style = { fontFamily: "Microsoft YaHei", color: C.body, fontSize: 20, ...style };
  return s;
}

function line(slide, x1, y1, x2, y2, color = C.line, width = 1, name) {
  return shape(slide, "line", { left: x1, top: y1, width: x2 - x1, height: y2 - y1 }, "none", { style: "solid", fill: color, width }, name);
}

function path(slide, left, top, width, height, commands, fill, lineCfg = { style: "solid", fill: "none", width: 0 }, name) {
  return slide.shapes.add({ geometry: "custom", name, position: { left, top, width, height }, fill, line: lineCfg, customPaths: [{ width, height, commands }] });
}

function addHeader(slide, page, title, kicker = "大学共享仪器服务改进") {
  text(slide, kicker, 56, 28, 420, 22, { fontSize: 15, color: C.blue, bold: true, letterSpacing: 0.5 }, `kicker-${page}`);
  text(slide, title, 56, 56, 1110, 58, { fontSize: 38, color: C.dark, bold: true, breakLine: false }, `title-${page}`);
  line(slide, 56, 128, 1224, 128, C.line, 1, `rule-${page}`);
  text(slide, String(page).padStart(2, "0"), 1180, 28, 44, 22, { fontSize: 14, color: C.muted, alignment: "right" }, `page-${page}`);
}

function addFooter(slide, page, note = "模拟数据，仅用于方案讨论") {
  line(slide, 56, 681, 1224, 681, C.line, 1, `footer-rule-${page}`);
  text(slide, note, 56, 689, 520, 18, { fontSize: 13, color: C.muted }, `footer-note-${page}`);
  text(slide, `大学共享仪器服务改进  ·  ${String(page).padStart(2, "0")}`, 950, 689, 274, 18, { fontSize: 13, color: C.muted, alignment: "right" }, `footer-page-${page}`);
}

function addSources(slide, sourceText) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- ${sourceText}`);
  slide.speakerNotes.setVisible(true);
}

function addBullet(slide, y, label, value, color = C.blue) {
  ellipse(slide, 824, y + 5, 10, 10, color, { style: "solid", fill: color, width: 0 }, `bullet-${y}`);
  text(slide, label, 844, y - 2, 112, 26, { fontSize: 18, color: C.muted, bold: true }, `bullet-label-${y}`);
  text(slide, value, 958, y - 2, 220, 36, { fontSize: 18, color: C.dark }, `bullet-value-${y}`);
}

function slide1(p) {
  const s = p.slides.add();
  s.background.fill = C.bg;
  addHeader(s, 1, "预约量持续增长，但中位等待下降仍需拆分观察");
  text(s, "2023—2025 同时观察到：完成量 +60%，中位等待 8→6 天", 56, 144, 650, 32, { fontSize: 22, color: C.body });

  const x0 = 100, y0 = 582, chartW = 640, chartH = 330;
  rect(s, 56, 188, 720, 420, C.white, { style: "solid", fill: C.line, width: 1 }, "trend-frame", 10);
  text(s, "完成量与等待时间的同向变化", 88, 210, 560, 30, { fontSize: 23, color: C.dark, bold: true }, "trend-title");
  text(s, "柱 = 预约完成量（单）  ·  线 = 中位等待（天）", 88, 242, 560, 24, { fontSize: 16, color: C.muted }, "trend-subtitle");
  const plotL = 132, plotT = 304, plotW = 570, plotH = 242;
  [0, 0.25, 0.5, 0.75, 1].forEach((f, i) => {
    const y = plotT + plotH * f;
    line(s, plotL, y, plotL + plotW, y, C.grid, 1, `trend-grid-${i}`);
    text(s, String(Math.round(2200 - 2200 * f)), 72, y - 10, 58, 22, { fontSize: 13, color: C.muted, alignment: "right" }, `trend-left-${i}`);
    text(s, String((10 - 10 * f).toFixed(0)), plotL + plotW + 10, y - 10, 48, 22, { fontSize: 13, color: C.muted }, `trend-right-${i}`);
  });
  line(s, plotL, plotT, plotL, plotT + plotH, C.grayBlue, 1.3, "trend-axis-y");
  line(s, plotL, plotT + plotH, plotL + plotW, plotT + plotH, C.grayBlue, 1.3, "trend-axis-x");
  const years = ["2023", "2024", "2025"];
  const vol = [1200, 1560, 1920];
  const wait = [8, 7, 6];
  const xs = [245, 425, 605];
  const points = [];
  years.forEach((yr, i) => {
    const barH = (vol[i] / 2200) * plotH;
    rect(s, xs[i] - 32, plotT + plotH - barH, 64, barH, C.blue, { style: "solid", fill: C.blue, width: 0 }, `bar-${yr}`, 4);
    text(s, vol[i].toLocaleString(), xs[i] - 45, plotT + plotH - barH - 26, 90, 22, { fontSize: 15, color: C.blueDark, alignment: "center", bold: true }, `bar-label-${yr}`);
    const py = plotT + plotH - (wait[i] / 10) * plotH;
    points.push({ x: xs[i], y: py });
    ellipse(s, xs[i] - 8, py - 8, 16, 16, C.accent, { style: "solid", fill: C.white, width: 2 }, `point-${yr}`);
    text(s, `${wait[i]}天`, xs[i] - 28, py - 34, 56, 22, { fontSize: 15, color: C.accent, alignment: "center", bold: true }, `point-label-${yr}`);
    text(s, yr, xs[i] - 32, plotT + plotH + 16, 64, 22, { fontSize: 15, color: C.body, alignment: "center" }, `year-${yr}`);
  });
  line(s, points[0].x, points[0].y, points[1].x, points[1].y, C.accent, 3, "wait-line-1");
  line(s, points[1].x, points[1].y, points[2].x, points[2].y, C.accent, 3, "wait-line-2");
  text(s, "预约完成量（单）", 88, 555, 150, 22, { fontSize: 14, color: C.blue }, "trend-axis-left-label");
  text(s, "中位等待（天）", 624, 555, 110, 22, { fontSize: 14, color: C.accent, alignment: "right" }, "trend-axis-right-label");

  rect(s, 816, 188, 408, 420, C.bluePale, { style: "solid", fill: C.blueLight, width: 1 }, "trend-aside", 10);
  text(s, "这组变化说明什么", 848, 218, 310, 30, { fontSize: 24, color: C.blueDark, bold: true }, "trend-aside-title");
  addBullet(s, 282, "完成量", "1,200 → 1,920 单", C.blue);
  addBullet(s, 342, "等待", "8 → 6 天", C.accent);
  line(s, 848, 402, 1188, 402, C.blueLight, 1, "aside-divider");
  text(s, "边界", 848, 424, 72, 24, { fontSize: 18, color: C.blueDark, bold: true }, "trend-boundary-label");
  text(s, "两项指标是同时观察到的现象，不能据此证明任何单一措施造成改善。", 848, 452, 330, 64, { fontSize: 18, color: C.body, breakLine: true }, "trend-boundary-text");
  text(s, "拟议观察", 848, 534, 96, 24, { fontSize: 18, color: C.blueDark, bold: true }, "trend-proposal-label");
  text(s, "继续按高峰时段、分设备拆分等待，避免平均改善掩盖局部拥堵。", 948, 534, 238, 56, { fontSize: 17, color: C.body }, "trend-proposal-text");
  addFooter(s, 1);
  addSources(s, "本轮原稿 experiments/mckinsey-prompt-study/manuscript.md，第 1 节；数字为风格测试构造的模拟数据。");
}

function comparisonRow(s, y, label, a, b, tone = "neutral") {
  const fill = tone === "focus" ? C.bluePale : C.grayFill;
  rect(s, 108, y, 330, 48, fill, { style: "solid", fill: tone === "focus" ? C.blueLight : C.line, width: 1 }, `left-row-${y}`, 8);
  rect(s, 842, y, 330, 48, fill, { style: "solid", fill: tone === "focus" ? C.blueLight : C.line, width: 1 }, `right-row-${y}`, 8);
  text(s, label, 130, y + 12, 170, 22, { fontSize: 17, color: C.muted }, `row-label-${y}`);
  text(s, a, 300, y + 10, 116, 26, { fontSize: 19, color: tone === "focus" ? C.blueDark : C.dark, bold: true, alignment: "right" }, `left-value-${y}`);
  text(s, label, 864, y + 12, 170, 22, { fontSize: 17, color: C.muted }, `row-label-r-${y}`);
  text(s, b, 1034, y + 10, 116, 26, { fontSize: 19, color: tone === "focus" ? C.blueDark : C.dark, bold: true, alignment: "right" }, `right-value-${y}`);
}

function slide2(p) {
  const s = p.slides.add();
  s.background.fill = C.bg;
  addHeader(s, 2, "两类用户的障碍不同，入口设计需要分别回应");
  text(s, "同一组四个维度下，校内用户更受时段影响，校外用户更受审批与费用影响", 56, 144, 970, 32, { fontSize: 21, color: C.body });
  text(s, "模拟多选问卷 · 各组 n=100 · 比例不相加为 100%", 56, 172, 700, 22, { fontSize: 15, color: C.muted });
  rect(s, 80, 220, 420, 390, C.white, { style: "solid", fill: C.line, width: 1 }, "inside-column", 10);
  rect(s, 780, 220, 420, 390, C.white, { style: "solid", fill: C.line, width: 1 }, "outside-column", 10);
  rect(s, 108, 244, 330, 48, C.blue, { style: "solid", fill: C.blue, width: 0 }, "inside-head", 8);
  rect(s, 842, 244, 330, 48, C.blueDark, { style: "solid", fill: C.blueDark, width: 0 }, "outside-head", 8);
  text(s, "校内用户", 130, 255, 290, 24, { fontSize: 22, color: C.white, bold: true }, "inside-title");
  text(s, "校外用户", 864, 255, 290, 24, { fontSize: 22, color: C.white, bold: true }, "outside-title");
  const rows = [
    ["时段难匹配", "62%", "45%", "focus"],
    ["审批慢", "48%", "65%", "focus"],
    ["费用不清", "28%", "58%", "focus"],
    ["操作培训不足", "44%", "32%", "neutral"],
  ];
  rows.forEach((r, i) => comparisonRow(s, 312 + i * 62, r[0], r[1], r[2], r[3]));
  ellipse(s, 586, 374, 108, 108, C.white, { style: "solid", fill: C.blue, width: 2 }, "vs-ring");
  text(s, "对照", 602, 398, 76, 22, { fontSize: 16, color: C.blueDark, alignment: "center", bold: true }, "vs-label");
  text(s, "同四维", 602, 425, 76, 22, { fontSize: 16, color: C.muted, alignment: "center" }, "vs-sub");
  line(s, 500, 428, 586, 428, C.blueLight, 2, "vs-left");
  line(s, 694, 428, 780, 428, C.blueLight, 2, "vs-right");
  rect(s, 80, 630, 1120, 32, C.bluePale, { style: "solid", fill: C.blueLight, width: 1 }, "priority-strip", 6);
  text(s, "讨论优先级：校内先看时段供给；校外先看审批责任与费用说明。样本仅为模拟，不能直接推广。", 104, 637, 1070, 20, { fontSize: 16, color: C.blueDark, alignment: "center" }, "priority-text");
  addFooter(s, 2);
  addSources(s, "本轮原稿 experiments/mckinsey-prompt-study/manuscript.md，第 2 节；模拟多选问卷，校内 100 人、校外 100 人。");
}

function slide3(p) {
  const s = p.slides.add();
  s.background.fill = C.bg;
  addHeader(s, 3, "三阶段试点先补齐入口、责任与说明，再观察问题落点");
  text(s, "每一阶段先完成交付并记录，再跨过门禁推进；指标只观察，不预设改善幅度", 56, 144, 1050, 32, { fontSize: 21, color: C.body });
  const baseY = 250;
  const stages = [
    { x: 84, w: 330, fill: C.bluePale, title: "第一阶段 统一入口", body: "交付：设备与时段目录\n观察：信息完整率", gate: "目录与记录完整" },
    { x: 444, w: 330, fill: "#E7EFF6", title: "第二阶段 明确责任", body: "交付：责任人与时限表\n观察：审批时长", gate: "责任人与时限明确" },
    { x: 804, w: 330, fill: "#DDEAF5", title: "第三阶段 发布说明", body: "交付：费用清单及培训入口\n观察：重复咨询量", gate: "负责人确认后推进" },
  ];
  stages.forEach((st, i) => {
    const nextX = st.x + st.w;
    const cmds = [
      { moveTo: { x: 0, y: 22 } },
      { lineTo: { x: st.w - 34, y: 22 } },
      { lineTo: { x: st.w, y: 86 } },
      { lineTo: { x: st.w - 34, y: 150 } },
      { lineTo: { x: 0, y: 150 } },
      { close: {} },
    ];
    path(s, st.x, baseY, st.w, 172, cmds, st.fill, { style: "solid", fill: C.blueLight, width: 1 }, `stage-river-${i}`);
    text(s, st.title, st.x + 28, baseY + 42, st.w - 80, 30, { fontSize: 22, color: C.blueDark, bold: true }, `stage-title-${i}`);
    text(s, st.body, st.x + 28, baseY + 84, st.w - 80, 54, { fontSize: 18, color: C.body }, `stage-body-${i}`);
    if (i < 2) {
      const gx = nextX + 4;
      rect(s, gx, baseY + 18, 18, 136, C.blueDark, { style: "solid", fill: C.blueDark, width: 0 }, `gate-${i}`, 4);
      rect(s, gx - 110, baseY - 44, 220, 30, C.white, { style: "solid", fill: C.blue, width: 1 }, `gate-label-${i}`, 6);
      text(s, `门禁 ${i + 1}  ·  ${st.gate}`, gx - 100, baseY - 37, 200, 18, { fontSize: 13, color: C.blueDark, alignment: "center" }, `gate-text-${i}`);
    }
  });
  // Direction arrow at the far end of the river.
  path(s, 1130, baseY + 58, 72, 58, [
    { moveTo: { x: 0, y: 18 } }, { lineTo: { x: 40, y: 18 } }, { lineTo: { x: 40, y: 0 } },
    { lineTo: { x: 72, y: 29 } }, { lineTo: { x: 40, y: 58 } }, { lineTo: { x: 40, y: 40 } },
    { lineTo: { x: 0, y: 40 } }, { close: {} },
  ], C.blue, { style: "solid", fill: C.blue, width: 0 }, "flow-arrow");
  text(s, "推进方向", 1130, baseY + 128, 72, 20, { fontSize: 13, color: C.muted, alignment: "center" }, "flow-arrow-label");
  rect(s, 84, 474, 1118, 124, C.grayFill, { style: "solid", fill: C.line, width: 1 }, "global-rule", 8);
  text(s, "贯穿三阶段的规则", 112, 496, 240, 24, { fontSize: 19, color: C.blueDark, bold: true }, "rule-title");
  text(s, "每阶段在记录完整、责任明确后再推进；平台负责人确认。涉及新访问授权时暂停共享，授权处理后恢复。", 112, 530, 1028, 44, { fontSize: 18, color: C.body }, "rule-body");
  text(s, "预期用途：用户更早判断可用性，工作人员更快定位问题环节。该收益尚未验证。", 112, 570, 1028, 22, { fontSize: 16, color: C.muted }, "rule-limit");
  addFooter(s, 3);
  addSources(s, "本轮原稿 experiments/mckinsey-prompt-study/manuscript.md，第 3 节；三阶段为拟议试点，指标无预设数值。");
}

function slide4(p) {
  const s = p.slides.add();
  s.background.fill = C.bg;
  addHeader(s, 4, "设备支持优先级取决于频次与支持需求的组合位置");
  text(s, "二维诊断只用于本次讨论：横轴预约频次指数，纵轴操作支持需求指数，50 为讨论分界", 56, 144, 1120, 32, { fontSize: 20, color: C.body });
  rect(s, 56, 188, 760, 430, C.white, { style: "solid", fill: C.line, width: 1 }, "matrix-frame", 10);
  const ml = 150, mt = 240, mw = 570, mh = 300;
  // Quadrant tints are light and subordinate to the axes.
  rect(s, ml + mw / 2, mt, mw / 2, mh / 2, "#F1F6FA", { style: "solid", fill: "none", width: 0 }, "q-high-high");
  rect(s, ml, mt, mw / 2, mh / 2, "#F7FAFC", { style: "solid", fill: "none", width: 0 }, "q-low-high");
  rect(s, ml + mw / 2, mt + mh / 2, mw / 2, mh / 2, "#FBFCFD", { style: "solid", fill: "none", width: 0 }, "q-high-low");
  rect(s, ml, mt + mh / 2, mw / 2, mh / 2, "#FFFFFF", { style: "solid", fill: "none", width: 0 }, "q-low-low");
  line(s, ml, mt + mh, ml + mw, mt + mh, C.grayBlue, 1.5, "matrix-x");
  line(s, ml, mt, ml, mt + mh, C.grayBlue, 1.5, "matrix-y");
  line(s, ml + mw / 2, mt, ml + mw / 2, mt + mh, C.blueLight, 1.5, "matrix-mid-v");
  line(s, ml, mt + mh / 2, ml + mw, mt + mh / 2, C.blueLight, 1.5, "matrix-mid-h");
  [0, 50, 100].forEach((v) => {
    const x = ml + (v / 100) * mw;
    text(s, String(v), x - 24, mt + mh + 12, 48, 20, { fontSize: 13, color: C.muted, alignment: "center" }, `mx-${v}`);
    const y = mt + mh - (v / 100) * mh;
    text(s, String(v), ml - 58, y - 10, 50, 20, { fontSize: 13, color: C.muted, alignment: "right" }, `my-${v}`);
  });
  text(s, "预约频次指数 →", ml + 210, 576, 180, 22, { fontSize: 16, color: C.body, alignment: "center" }, "matrix-x-title");
  text(s, "操作支持需求指数", 76, 350, 28, 150, { fontSize: 16, color: C.body, rotation: 270, alignment: "center" }, "matrix-y-title");
  text(s, "高频 · 高支持\n优先增设辅导时段", ml + mw / 2 + 18, mt + 12, 150, 44, { fontSize: 15, color: C.blueDark, bold: true }, "q1-label");
  text(s, "低频 · 高支持\n采用预约辅导", ml + 18, mt + 12, 140, 44, { fontSize: 15, color: C.body, bold: true }, "q2-label");
  text(s, "高频 · 低支持\n优先完善自助说明", ml + mw / 2 + 18, mt + mh / 2 + 12, 160, 44, { fontSize: 15, color: C.body, bold: true }, "q3-label");
  text(s, "低频 · 低支持\n维持基础服务", ml + 18, mt + mh / 2 + 12, 140, 44, { fontSize: 15, color: C.muted, bold: true }, "q4-label");
  const pts = [
    { name: "显微成像", x: 85, y: 80, dx: -90, dy: -34, fill: C.blue },
    { name: "基础检测", x: 80, y: 25, dx: -90, dy: 16, fill: C.blueDark },
    { name: "材料制备", x: 35, y: 75, dx: -94, dy: -34, fill: C.grayBlue },
    { name: "常规加工", x: 30, y: 30, dx: -94, dy: 16, fill: C.grayBlue },
  ];
  pts.forEach((pt, i) => {
    const x = ml + (pt.x / 100) * mw;
    const y = mt + mh - (pt.y / 100) * mh;
    ellipse(s, x - 10, y - 10, 20, 20, pt.fill, { style: "solid", fill: C.white, width: 2 }, `matrix-point-${i}`);
    text(s, `${pt.name}  (${pt.x},${pt.y})`, x + pt.dx, y + pt.dy, 122, 24, { fontSize: 14, color: pt.fill === C.blue ? C.blueDark : C.body, bold: true, alignment: "right" }, `matrix-point-label-${i}`);
  });
  rect(s, 856, 188, 368, 430, C.bluePale, { style: "solid", fill: C.blueLight, width: 1 }, "matrix-aside", 10);
  text(s, "如何使用这张图", 888, 220, 280, 30, { fontSize: 24, color: C.blueDark, bold: true }, "matrix-aside-title");
  text(s, "先看位置，再看行动", 888, 266, 250, 24, { fontSize: 18, color: C.body, bold: true }, "matrix-aside-lead");
  line(s, 888, 306, 1188, 306, C.blueLight, 1, "matrix-aside-rule");
  text(s, "1", 888, 334, 24, 24, { fontSize: 20, color: C.blue, bold: true }, "matrix-step1");
  text(s, "高频高支持：先增设辅导时段。", 924, 334, 240, 44, { fontSize: 17, color: C.body }, "matrix-step1-text");
  text(s, "2", 888, 394, 24, 24, { fontSize: 20, color: C.blue, bold: true }, "matrix-step2");
  text(s, "高频低支持：先完善自助说明。", 924, 394, 240, 44, { fontSize: 17, color: C.body }, "matrix-step2-text");
  text(s, "3", 888, 454, 24, 24, { fontSize: 20, color: C.blue, bold: true }, "matrix-step3");
  text(s, "低频高支持：采用预约辅导。", 924, 454, 240, 44, { fontSize: 17, color: C.body }, "matrix-step3-text");
  line(s, 888, 520, 1188, 520, C.blueLight, 1, "matrix-limit-rule");
  text(s, "边界", 888, 540, 56, 22, { fontSize: 17, color: C.blueDark, bold: true }, "matrix-limit-label");
  text(s, "50 为本次讨论分界；点位不表示成本、设备价值或真实利用率。", 952, 536, 220, 64, { fontSize: 15, color: C.body }, "matrix-limit-text");
  addFooter(s, 4);
  addSources(s, "本轮原稿 experiments/mckinsey-prompt-study/manuscript.md，第 4 节；二维点位为模拟诊断数据，0—100 仅为本次讨论尺度。");
}

async function main() {
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(p);
  slide2(p);
  slide3(p);
  slide4(p);
  for (const [i, s] of p.slides.items.entries()) {
    const n = String(i + 1).padStart(2, "0");
    await writeBlob(`${OUT}/slide-${n}.png`, await p.export({ slide: s, format: "png", scale: 1 }));
    await fs.writeFile(`${OUT}/slide-${n}.layout.json`, await (await s.export({ format: "layout" })).text());
  }
  await writeBlob(`${OUT}/montage.webp`, await p.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
