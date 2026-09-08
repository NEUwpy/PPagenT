import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/ablation/run-a";
const W = 1280;
const H = 720;
const C = {
  navy: "#0B2239",
  blue: "#315F91",
  blue2: "#6D94B8",
  pale: "#EAF1F7",
  pale2: "#F5F7F9",
  ink: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#D7DDE3",
  white: "#FFFFFF",
  orange: "#D9822B",
  orangePale: "#F8EBDD",
};
const F_TITLE = "HYWenRunSongYun U";
const F_BODY = "Microsoft YaHei";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, text, left, top, width, height, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.typeface || F_BODY,
    fontSize: opts.fontSize || 18,
    color: opts.color || C.body,
    bold: Boolean(opts.bold),
    alignment: opts.align || "left",
    verticalAlignment: opts.valign || "middle",
    autoFit: "none",
    italic: Boolean(opts.italic),
  };
  return shape;
}

function addRect(slide, left, top, width, height, fill, line = "none", radius = "rounded-none", name) {
  return slide.shapes.add({
    geometry: radius === "rounded-none" ? "rect" : "roundRect",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
    ...(radius === "rounded-none" ? {} : { borderRadius: radius }),
  });
}

function addLine(slide, x1, y1, x2, y2, color = C.line, width = 1, name) {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addCircle(slide, cx, cy, r, fill, line = fill, name) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left: cx - r, top: cy - r, width: r * 2, height: r * 2 },
    fill,
    line: { style: "solid", fill: line, width: 1 },
  });
}

function addHeader(slide, number, title, kicker) {
  slide.background.fill = C.white;
  addText(slide, `东北大学｜大学共享仪器服务`, 56, 28, 410, 24, { fontSize: 14, color: C.blue, bold: true });
  addText(slide, kicker, 1010, 28, 214, 24, { fontSize: 14, color: C.muted, align: "right" });
  addText(slide, title, 56, 68, 1168, 56, { fontSize: 32, color: C.navy, typeface: F_TITLE, bold: true, name: `title-${number}` });
  addLine(slide, 56, 140, 1224, 140, C.blue, 2);
  addText(slide, String(number).padStart(2, "0"), 1170, 658, 54, 24, { fontSize: 14, color: C.blue, bold: true, align: "right" });
  addText(slide, "模拟数据，仅用于方案讨论", 56, 658, 420, 24, { fontSize: 13, color: C.muted });
}

function addNotes(slide, body) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- 内容：experiments/mckinsey-prompt-study/manuscript.md\n- 视觉：大学 Skin（northeastern-university-001）\n- ${body}\n[/Sources]`);
  slide.speakerNotes.setVisible(true);
}

function slide1(p) {
  const s = p.slides.add();
  addHeader(s, 1, "使用增长与等待下降同时出现，原因仍需继续观察", "现象｜2023—2025");
  addText(s, "预约完成量", 74, 166, 170, 26, { fontSize: 21, color: C.navy, bold: true });
  addText(s, "单", 720, 166, 40, 26, { fontSize: 16, color: C.muted });
  const chart = { left: 74, top: 206, width: 704, height: 360 };
  addRect(s, chart.left, chart.top, chart.width, chart.height, C.pale2, C.line, "rounded-xl", "trend-frame");
  const baseY = 510;
  const chartTop = 244;
  [0, 500, 1000, 1500, 2000].forEach((v) => {
    const y = baseY - (v / 2000) * 230;
    addLine(s, 136, y, 714, y, C.line, 1);
    addText(s, String(v), 70, y - 11, 58, 22, { fontSize: 13, color: C.muted, align: "right" });
  });
  const years = ["2023", "2024", "2025"];
  const orders = [1200, 1560, 1920];
  const waits = [8, 7, 6];
  const xs = [246, 422, 598];
  xs.forEach((x, i) => {
    const barH = (orders[i] / 2000) * 230;
    addRect(s, x - 34, baseY - barH, 68, barH, i === 2 ? C.blue : C.blue2, "none", "rounded-sm", `bar-${years[i]}`);
    addText(s, String(orders[i]), x - 52, baseY - barH - 28, 104, 22, { fontSize: 16, color: C.navy, bold: true, align: "center" });
    addText(s, years[i], x - 44, baseY + 12, 88, 22, { fontSize: 16, color: C.body, align: "center" });
    const wy = chartTop + ((waits[i] - 5) / 4) * 168;
    if (i > 0) {
      const prevY = chartTop + ((waits[i - 1] - 5) / 4) * 168;
      addLine(s, xs[i - 1], prevY, x, wy, C.orange, 3, `wait-line-${i}`);
    }
    addCircle(s, x, wy, 7, C.orange, C.white, `wait-dot-${years[i]}`);
    addText(s, `${waits[i]}天`, x - 36, wy - 30, 72, 22, { fontSize: 15, color: C.orange, bold: true, align: "center" });
  });
  addText(s, "中位等待时间", 532, 220, 160, 22, { fontSize: 14, color: C.orange, bold: true, align: "right" });
  addText(s, "预约完成量与等待时间共享年份，便于直接对照；两条序列仅呈现同时观察到的变化。", 126, 538, 604, 20, { fontSize: 14, color: C.muted, italic: true });
  addRect(s, 836, 206, 388, 360, C.pale, "none", "rounded-xl", "interpretation");
  addText(s, "这组现象说明什么", 868, 232, 300, 32, { fontSize: 22, color: C.navy, bold: true });
  addText(s, "01", 868, 292, 34, 24, { fontSize: 16, color: C.blue, bold: true });
  addText(s, "使用量持续上升", 916, 288, 250, 28, { fontSize: 20, color: C.ink, bold: true });
  addText(s, "三年完成量从 1,200 单增至 1,920 单。", 916, 320, 268, 48, { fontSize: 16, color: C.body });
  addLine(s, 868, 386, 1180, 386, C.line, 1);
  addText(s, "02", 868, 414, 34, 24, { fontSize: 16, color: C.blue, bold: true });
  addText(s, "平均改善可能掩盖局部拥堵", 916, 410, 260, 56, { fontSize: 20, color: C.ink, bold: true });
  addText(s, "继续观察高峰时段及分设备等待，避免把总体均值当作完整答案。", 916, 470, 266, 66, { fontSize: 16, color: C.body });
  addNotes(s, "趋势图为原生形状：柱体表示预约完成量，橙色折线表示中位等待时间；单位与条件按原稿保留。");
}

function slide2(p) {
  const s = p.slides.add();
  addHeader(s, 2, "预约障碍在两类用户之间分化：供给与流程是不同优先项", "对照｜模拟问卷 n=100/组");
  addText(s, "选择比例（多选）", 74, 166, 230, 26, { fontSize: 21, color: C.navy, bold: true });
  addRect(s, 74, 204, 756, 358, C.pale2, C.line, "rounded-xl", "bar-frame");
  const x0 = 330, plotW = 430;
  [0, 25, 50, 75, 100].forEach((v) => {
    const x = x0 + (v / 100) * plotW;
    addLine(s, x, 252, x, 526, C.line, 1);
    addText(s, `${v}%`, x - 22, 228, 44, 22, { fontSize: 13, color: C.muted, align: "center" });
  });
  addRect(s, 628, 168, 16, 16, C.blue, "none", "rounded-sm");
  addText(s, "校内", 650, 162, 58, 26, { fontSize: 15, color: C.body });
  addRect(s, 722, 168, 16, 16, C.orange, "none", "rounded-sm");
  addText(s, "校外", 744, 162, 58, 26, { fontSize: 15, color: C.body });
  const cats = ["时段难匹配", "审批慢", "费用不清", "操作培训不足"];
  const inn = [62, 48, 28, 44];
  const out = [45, 65, 58, 32];
  cats.forEach((cat, i) => {
    const y = 280 + i * 60;
    addText(s, cat, 98, y - 2, 210, 24, { fontSize: 17, color: C.ink, bold: true });
    addRect(s, x0, y, inn[i] / 100 * plotW, 16, C.blue, "none", "rounded-sm");
    addRect(s, x0, y + 23, out[i] / 100 * plotW, 16, C.orange, "none", "rounded-sm");
    addText(s, `${inn[i]}%`, x0 + inn[i] / 100 * plotW + 8, y - 5, 44, 24, { fontSize: 15, color: C.blue, bold: true });
    addText(s, `${out[i]}%`, x0 + out[i] / 100 * plotW + 8, y + 18, 44, 24, { fontSize: 15, color: C.orange, bold: true });
  });
  addText(s, "每组各 100 人；多选比例不相加为 100%。", 98, 534, 560, 20, { fontSize: 14, color: C.muted, italic: true });
  addRect(s, 878, 204, 346, 358, C.white, C.line, "rounded-xl", "priority");
  addText(s, "管理含义", 910, 232, 260, 32, { fontSize: 22, color: C.navy, bold: true });
  addRect(s, 910, 292, 8, 78, C.blue, "none", "rounded-sm");
  addText(s, "校内用户", 936, 288, 240, 26, { fontSize: 19, color: C.blue, bold: true });
  addText(s, "优先看时段供给：62% 的人反馈时段难匹配。", 936, 322, 248, 48, { fontSize: 16, color: C.body });
  addRect(s, 910, 412, 8, 78, C.orange, "none", "rounded-sm");
  addText(s, "校外用户", 936, 408, 240, 26, { fontSize: 19, color: C.orange, bold: true });
  addText(s, "优先看流程透明度：审批慢与费用不清分别为 65%、58%。", 936, 442, 248, 70, { fontSize: 16, color: C.body });
  addNotes(s, "横向条形比较使用原生形状，四个障碍维度对齐；两组共享 0—100% 比例尺度，模拟样本不作推广。");
}

function slide3(p) {
  const s = p.slides.add();
  addHeader(s, 3, "分阶段试点把问题定位到入口、审批、说明三个环节", "试点｜三阶段拟议路径");
  addText(s, "每一步先形成可记录的交付，再观察对应指标；不预设改善数值。", 74, 166, 710, 28, { fontSize: 19, color: C.body });
  const cols = [74, 416, 758];
  const stage = [
    { n: "01", t: "统一预约入口", d: "统一设备与时段目录", m: "信息完整率", color: C.blue },
    { n: "02", t: "明确审批责任", d: "责任人与时限表", m: "审批时长", color: C.blue2 },
    { n: "03", t: "发布费用与培训说明", d: "费用清单及培训入口", m: "重复咨询量", color: C.orange },
  ];
  stage.forEach((st, i) => {
    const x = cols[i];
    addRect(s, x, 224, 294, 276, C.pale2, C.line, "rounded-xl", `stage-${i + 1}`);
    addRect(s, x, 224, 294, 54, st.color, "none", "rounded-xl");
    addRect(s, x, 260, 294, 18, st.color, "none", "rounded-none");
    addText(s, st.n, x + 18, 237, 40, 26, { fontSize: 17, color: C.white, bold: true });
    addText(s, st.t, x + 66, 233, 214, 34, { fontSize: 20, color: C.white, bold: true });
    addText(s, "交付", x + 24, 306, 60, 22, { fontSize: 14, color: C.muted, bold: true });
    addText(s, st.d, x + 24, 332, 246, 34, { fontSize: 19, color: C.ink, bold: true });
    addLine(s, x + 24, 384, x + 270, 384, C.line, 1);
    addText(s, "观察", x + 24, 402, 60, 22, { fontSize: 14, color: C.muted, bold: true });
    addText(s, st.m, x + 24, 428, 246, 30, { fontSize: 19, color: st.color, bold: true });
    if (i < 2) {
      addRect(s, x + 306, 336, 26, 10, C.line, "none", "rounded-sm");
      addRect(s, x + 328, 328, 16, 26, C.line, "none", "rounded-sm");
    }
  });
  addText(s, "推进门槛", 74, 534, 100, 22, { fontSize: 16, color: C.navy, bold: true });
  const gates = ["记录完整", "责任明确", "负责人确认"];
  gates.forEach((g, i) => {
    const x = 210 + i * 240;
    addCircle(s, x, 544, 12, i === 2 ? C.orange : C.blue, C.white);
    addText(s, g, x + 22, 532, 112, 26, { fontSize: 17, color: C.body, bold: true });
    if (i < 2) addLine(s, x + 36, 544, x + 218, 544, C.line, 2);
  });
  addRect(s, 824, 532, 400, 64, C.orangePale, "none", "rounded-xl");
  addText(s, "新访问授权：暂停共享 → 授权处理后恢复", 850, 548, 350, 28, { fontSize: 16, color: C.orange, bold: true, align: "center" });
  addNotes(s, "阶段顺序、交付、观察指标均按原稿保留；指标无预设数值，不绘制量化改善曲线。授权处理规则作为底部决策门槛呈现。");
}

function slide4(p) {
  const s = p.slides.add();
  addHeader(s, 4, "支持优先级由频次与支持需求共同决定，四类设备落入四种动作", "诊断｜模拟二维分界");
  addText(s, "操作支持需求指数", 74, 166, 220, 26, { fontSize: 21, color: C.navy, bold: true });
  const plot = { left: 116, top: 220, width: 600, height: 330 };
  addRect(s, plot.left, plot.top, plot.width, plot.height, C.pale2, C.line, "rounded-xl", "scatter-frame");
  addRect(s, plot.left + plot.width / 2, plot.top, plot.width / 2, plot.height / 2, C.pale, "none", "rounded-none");
  addRect(s, plot.left, plot.top + plot.height / 2, plot.width / 2, plot.height / 2, C.orangePale, "none", "rounded-none");
  addLine(s, plot.left + plot.width / 2, plot.top, plot.left + plot.width / 2, plot.top + plot.height, C.muted, 1);
  addLine(s, plot.left, plot.top + plot.height / 2, plot.left + plot.width, plot.top + plot.height / 2, C.muted, 1);
  [0, 50, 100].forEach((v) => {
    const x = plot.left + (v / 100) * plot.width;
    const y = plot.top + plot.height - (v / 100) * plot.height;
    addText(s, String(v), x - 25, plot.top + plot.height + 10, 50, 20, { fontSize: 12, color: C.muted, align: "center" });
    addText(s, String(v), plot.left - 54, y - 10, 42, 20, { fontSize: 12, color: C.muted, align: "right" });
  });
  addText(s, "预约频次指数", 308, 578, 220, 24, { fontSize: 16, color: C.body, bold: true, align: "center" });
  addText(s, "高频 / 高支持", 504, 236, 170, 22, { fontSize: 14, color: C.blue, bold: true, align: "right" });
  addText(s, "低频 / 高支持", 136, 236, 170, 22, { fontSize: 14, color: C.orange, bold: true });
  const points = [
    { name: "显微成像", x: 85, y: 80, color: C.blue, dx: -112, dy: -30 },
    { name: "基础检测", x: 80, y: 25, color: C.blue2, dx: 12, dy: -10 },
    { name: "材料制备", x: 35, y: 75, color: C.orange, dx: -110, dy: -4 },
    { name: "常规加工", x: 30, y: 30, color: C.muted, dx: -110, dy: 6 },
  ];
  points.forEach((pt) => {
    const cx = plot.left + (pt.x / 100) * plot.width;
    const cy = plot.top + plot.height - (pt.y / 100) * plot.height;
    addCircle(s, cx, cy, 12, pt.color, C.white, `point-${pt.name}`);
    addText(s, `${pt.name} ${pt.x},${pt.y}`, cx + pt.dx, cy + pt.dy, 108, 24, { fontSize: 15, color: pt.color, bold: true, align: pt.dx < 0 ? "right" : "left" });
  });
  addRect(s, 790, 204, 434, 358, C.white, C.line, "rounded-xl", "action-map");
  addText(s, "四种动作", 824, 232, 270, 30, { fontSize: 22, color: C.navy, bold: true });
  const actions = [
    ["高频 × 高支持", "增设辅导时段", C.blue],
    ["高频 × 低支持", "完善自助说明", C.blue2],
    ["低频 × 高支持", "采用预约辅导", C.orange],
    ["低频 × 低支持", "维持基础服务", C.muted],
  ];
  actions.forEach((a, i) => {
    const y = 286 + i * 61;
    addRect(s, 824, y + 6, 8, 38, a[2], "none", "rounded-sm");
    addText(s, a[0], 850, y, 168, 24, { fontSize: 16, color: C.muted, bold: true });
    addText(s, a[1], 1020, y, 174, 26, { fontSize: 18, color: C.ink, bold: true, align: "right" });
  });
  addText(s, "50 为本次讨论分界，无外部行业含义；点位不表示成本、设备价值或真实利用率。", 824, 504, 364, 48, { fontSize: 13, color: C.muted, italic: true });
  addNotes(s, "二维诊断使用原生形状：横纵轴均为 0—100，50 为本次讨论分界；点位与四种动作严格对应原稿，不作统计分类结论。");
}

async function main() {
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(p); slide2(p); slide3(p); slide4(p);
  for (const [i, slide] of p.slides.items.entries()) {
    const n = String(i + 1).padStart(2, "0");
    await writeBlob(`${OUT}/slide-${n}.png`, await p.export({ slide, format: "png", scale: 1 }));
  }
  const inspect = await p.inspect({ kind: "slide,textbox,shape,notes", maxChars: 16000 });
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson);
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
