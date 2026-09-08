import fs from "node:fs/promises";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/field-test/run-paragraph";
const W = 1280;
const H = 720;
const C = {
  bg: "#FFFFFF",
  ink: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#D9DEE5",
  line2: "#EEF1F4",
  blue: "#315F91",
  blue2: "#5A84AE",
  blueSoft: "#E7EEF5",
  pale: "#F7F9FB",
};
const FONT = "Microsoft YaHei";

function shape(slide, geometry, position, fill = "none", lineFill = "none", lineWidth = 0, extra = {}) {
  return slide.shapes.add({ geometry, position, fill, line: { style: "solid", fill: lineFill, width: lineWidth }, ...extra });
}

function text(slide, value, position, fontSize, opts = {}) {
  const s = slide.shapes.add({ geometry: "textbox", position, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  s.text = value;
  s.text.style = {
    fontSize,
    typeface: FONT,
    color: opts.color ?? C.body,
    bold: opts.bold ?? false,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    italic: opts.italic ?? false,
  };
  if (opts.margin !== undefined) s.text.margin = opts.margin;
  return s;
}

function footer(slide, page) {
  shape(slide, "rect", { left: 56, top: 672, width: 1168, height: 1 }, C.line, C.line, 0);
  text(slide, "模拟数据，仅用于方案讨论", { left: 56, top: 684, width: 360, height: 20 }, 14, { color: C.muted });
  text(slide, "大学共享仪器服务改进 · 讨论稿", { left: 450, top: 684, width: 380, height: 20 }, 14, { color: C.muted, align: "center" });
  text(slide, String(page).padStart(2, "0"), { left: 1170, top: 682, width: 54, height: 22 }, 14, { color: C.muted, align: "right" });
}

function header(slide, title, kicker) {
  text(slide, kicker.toUpperCase(), { left: 56, top: 36, width: 500, height: 22 }, 14, { color: C.blue, bold: true });
  text(slide, title, { left: 56, top: 66, width: 1120, height: 44 }, 32, { color: C.ink, bold: true });
  shape(slide, "rect", { left: 56, top: 122, width: 1168, height: 2 }, C.blue, C.blue, 0);
}

function addLegend(slide, label, x, y, color) {
  shape(slide, "rect", { left: x, top: y + 5, width: 12, height: 12 }, color, color, 0);
  text(slide, label, { left: x + 20, top: y, width: 150, height: 22 }, 14, { color: C.muted });
}

function line(slide, x1, y1, x2, y2, color = C.line, width = 1) {
  return shape(slide, "line", { left: x1, top: y1, width: x2 - x1, height: y2 - y1 }, "none", color, width);
}

function slide1(pres) {
  const s = pres.slides.add();
  s.background.fill = C.bg;
  header(s, "使用量上升与等待下降同时出现，仍需拆分高峰拥堵", "01 / 使用增长与等待");
  text(s, "预约完成量增加的同时，中位等待时间缩短；这组趋势描述现象，不足以归因于单一措施。", { left: 56, top: 142, width: 900, height: 28 }, 18, { color: C.body });
  addLegend(s, "预约完成量（单）", 720, 183, C.blue);
  addLegend(s, "中位等待（天）", 930, 183, C.blue2);

  // Left evidence: volume bars, exact values 1200 / 1560 / 1920.
  const x0 = 148, chartTop = 238, chartBottom = 548, chartH = chartBottom - chartTop;
  text(s, "预约完成量", { left: 56, top: 206, width: 160, height: 26 }, 21, { color: C.ink, bold: true });
  text(s, "单", { left: 56, top: 234, width: 40, height: 20 }, 14, { color: C.muted });
  line(s, x0, chartTop, x0, chartBottom, C.line, 1);
  line(s, x0, chartBottom, 620, chartBottom, C.line, 1);
  const ticks = [0, 600, 1200, 1800, 2400];
  for (const v of ticks) {
    const yy = chartBottom - (v / 2400) * chartH;
    line(s, x0, yy, 620, yy, C.line2, 1);
    text(s, String(v), { left: 70, top: yy - 10, width: 62, height: 20 }, 14, { color: C.muted, align: "right" });
  }
  const years = ["2023", "2024", "2025"];
  const volumes = [1200, 1560, 1920];
  const barX = [230, 360, 490];
  for (let i = 0; i < years.length; i += 1) {
    const h = (volumes[i] / 2400) * chartH;
    shape(s, "rect", { left: barX[i], top: chartBottom - h, width: 72, height: h }, C.blue, C.blue, 0);
    text(s, String(volumes[i]), { left: barX[i] - 10, top: chartBottom - h - 26, width: 92, height: 22 }, 16, { color: C.blue, bold: true, align: "center" });
    text(s, years[i], { left: barX[i] - 10, top: chartBottom + 14, width: 92, height: 22 }, 16, { color: C.body, align: "center" });
  }
  text(s, "+60%（2023→2025）", { left: 250, top: 578, width: 230, height: 28 }, 18, { color: C.blue, bold: true, align: "center" });

  // Right evidence: waiting line, exact values 8 / 7 / 6 days.
  text(s, "中位等待时间", { left: 700, top: 206, width: 190, height: 26 }, 21, { color: C.ink, bold: true });
  text(s, "天", { left: 700, top: 234, width: 40, height: 20 }, 14, { color: C.muted });
  const rx = 770, rbottom = 548, rtop = 268, rw = 320;
  line(s, rx, rtop, rx, rbottom, C.line, 1);
  line(s, rx, rbottom, rx + rw, rbottom, C.line, 1);
  for (const v of [0, 2, 4, 6, 8, 10]) {
    const yy = rbottom - (v / 10) * (rbottom - rtop);
    line(s, rx, yy, rx + rw, yy, C.line2, 1);
    text(s, String(v), { left: rx - 52, top: yy - 10, width: 46, height: 20 }, 14, { color: C.muted, align: "right" });
  }
  const px = [830, 940, 1050];
  const wait = [8, 7, 6];
  const points = wait.map((v, i) => ({ x: px[i], y: rbottom - (v / 10) * (rbottom - rtop) }));
  line(s, points[0].x, points[0].y, points[1].x, points[1].y, C.blue2, 3);
  line(s, points[1].x, points[1].y, points[2].x, points[2].y, C.blue2, 3);
  for (let i = 0; i < points.length; i += 1) {
    shape(s, "ellipse", { left: points[i].x - 8, top: points[i].y - 8, width: 16, height: 16 }, C.bg, C.blue2, 3);
    text(s, `${wait[i]}`, { left: points[i].x - 30, top: points[i].y - 34, width: 60, height: 24 }, 18, { color: C.blue2, bold: true, align: "center" });
    text(s, years[i], { left: points[i].x - 35, top: rbottom + 14, width: 70, height: 22 }, 16, { color: C.body, align: "center" });
  }
  text(s, "-2天（2023→2025）", { left: 860, top: 578, width: 230, height: 28 }, 18, { color: C.blue2, bold: true, align: "center" });
  footer(s, 1);
}

function slide2(pres) {
  const s = pres.slides.add();
  s.background.fill = C.bg;
  header(s, "校内与校外的首要障碍不同，供给与规则应分开处理", "02 / 两类用户的预约障碍");
  text(s, "模拟问卷为多选题，各项比例不相加为100%；两组各100人，仅用于讨论优先级。", { left: 56, top: 142, width: 1000, height: 28 }, 18, { color: C.body });
  addLegend(s, "校内", 885, 183, C.blue);
  addLegend(s, "校外", 1000, 183, C.blue2);
  const labels = ["时段难匹配", "审批慢", "费用不清", "操作培训不足"];
  const inside = [62, 48, 28, 44];
  const outside = [45, 65, 58, 32];
  const xLabel = 56, xBar = 310, scale = 8.2, y0 = 246, rowH = 84;
  text(s, "选择比例（%）", { left: xBar, top: 203, width: 240, height: 24 }, 14, { color: C.muted });
  line(s, xBar, 232, xBar + 70 * scale, 232, C.line, 1);
  for (const v of [0, 20, 40, 60, 70]) {
    const xx = xBar + v * scale;
    line(s, xx, 228, xx, 560, C.line2, 1);
    text(s, String(v), { left: xx - 24, top: 204, width: 48, height: 22 }, 14, { color: C.muted, align: "center" });
  }
  for (let i = 0; i < labels.length; i += 1) {
    const y = y0 + i * rowH;
    text(s, labels[i], { left: xLabel, top: y + 8, width: 225, height: 28 }, 18, { color: C.ink, bold: true });
    shape(s, "rect", { left: xBar, top: y, width: inside[i] * scale, height: 20 }, C.blue, C.blue, 0);
    shape(s, "rect", { left: xBar, top: y + 30, width: outside[i] * scale, height: 20 }, C.blue2, C.blue2, 0);
    text(s, `${inside[i]}%`, { left: xBar + inside[i] * scale + 10, top: y - 2, width: 58, height: 22 }, 16, { color: C.blue, bold: true });
    text(s, `${outside[i]}%`, { left: xBar + outside[i] * scale + 10, top: y + 28, width: 58, height: 22 }, 16, { color: C.blue2, bold: true });
  }
  shape(s, "rect", { left: 56, top: 586, width: 1168, height: 1 }, C.line, C.line, 0);
  text(s, "讨论判断", { left: 56, top: 602, width: 120, height: 24 }, 18, { color: C.blue, bold: true });
  text(s, "校内先看时段供给；校外先看审批与费用说明。两组共享四个维度，样本不支持推广。", { left: 190, top: 602, width: 980, height: 28 }, 18, { color: C.body });
  footer(s, 2);
}

function slide3(pres) {
  const s = pres.slides.add();
  s.background.fill = C.bg;
  header(s, "试点按入口、责任、说明依次推进，每阶段先完成记录再进入下一步", "03 / 分阶段试点与可观察指标");
  text(s, "阶段有先后，但指标不预设改善数值；平台负责人在记录完整、责任明确后确认推进。", { left: 56, top: 142, width: 1080, height: 28 }, 18, { color: C.body });

  const xs = [56, 438, 820];
  const widths = [320, 320, 404];
  const titles = ["统一预约入口", "明确审批责任", "发布费用与培训说明"];
  const deliver = ["统一设备与时段目录", "责任人与时限表", "费用清单及培训入口"];
  const metric = ["信息完整率", "审批时长", "重复咨询量"];
  const color = [C.blue, C.blue2, C.blue];
  // connectors first
  line(s, 374, 322, 438, 322, C.blue, 3);
  line(s, 756, 322, 820, 322, C.blue, 3);
  shape(s, "triangle", { left: 426, top: 314, width: 14, height: 16 }, C.blue, C.blue, 0, { rotation: 90 });
  shape(s, "triangle", { left: 808, top: 314, width: 14, height: 16 }, C.blue, C.blue, 0, { rotation: 90 });
  for (let i = 0; i < 3; i += 1) {
    const x = xs[i];
    shape(s, "rect", { left: x, top: 226, width: widths[i], height: 2 }, color[i], color[i], 0);
    shape(s, "ellipse", { left: x, top: 272, width: 76, height: 76 }, C.blueSoft, C.blue, 2);
    text(s, `0${i + 1}`, { left: x + 4, top: 288, width: 68, height: 40 }, 28, { color: C.blue, bold: true, align: "center" });
    text(s, titles[i], { left: x, top: 370, width: widths[i], height: 30 }, 21, { color: C.ink, bold: true, align: "center" });
    text(s, "交付", { left: x + 22, top: 426, width: 60, height: 22 }, 14, { color: C.blue, bold: true });
    text(s, deliver[i], { left: x + 22, top: 452, width: widths[i] - 44, height: 26 }, 18, { color: C.body });
    text(s, "观察", { left: x + 22, top: 496, width: 60, height: 22 }, 14, { color: C.blue, bold: true });
    text(s, metric[i], { left: x + 22, top: 522, width: widths[i] - 44, height: 26 }, 18, { color: C.body });
  }
  shape(s, "rect", { left: 56, top: 592, width: 1168, height: 44 }, C.pale, C.line, 1);
  text(s, "控制点：涉及新访问授权时暂停共享，授权处理后恢复。", { left: 78, top: 604, width: 1080, height: 22 }, 16, { color: C.body });
  footer(s, 3);
}

function slide4(pres) {
  const s = pres.slides.add();
  s.background.fill = C.bg;
  header(s, "支持优先级由频次与支持需求共同定位，四类设备落在四个讨论象限", "04 / 四类设备的支持优先级");
  text(s, "横纵轴均为0—100指数，50为本次讨论分界；点的位置不表示成本、设备价值或真实利用率。", { left: 56, top: 142, width: 1120, height: 28 }, 18, { color: C.body });
  const L = 168, T = 226, S = 320, R = L + S, B = T + S;
  // grid and axes
  line(s, L, T, L, B, C.ink, 2);
  line(s, L, B, R, B, C.ink, 2);
  line(s, L + S / 2, T, L + S / 2, B, C.line, 1);
  line(s, L, T + S / 2, R, T + S / 2, C.line, 1);
  for (const v of [0, 25, 50, 75, 100]) {
    const xx = L + (v / 100) * S;
    const yy = B - (v / 100) * S;
    line(s, xx, B, xx, B + 8, C.ink, 1);
    line(s, L - 8, yy, L, yy, C.ink, 1);
    text(s, String(v), { left: xx - 24, top: B + 14, width: 48, height: 20 }, 14, { color: C.muted, align: "center" });
    text(s, String(v), { left: L - 58, top: yy - 10, width: 48, height: 20 }, 14, { color: C.muted, align: "right" });
  }
  text(s, "预约频次指数", { left: 270, top: 574, width: 220, height: 24 }, 16, { color: C.ink, bold: true, align: "center" });
  text(s, "操作支持需求指数", { left: 46, top: 300, width: 120, height: 24 }, 16, { color: C.ink, bold: true, align: "center" });
  text(s, "50", { left: L + S / 2 + 8, top: B - S / 2 - 25, width: 32, height: 20 }, 14, { color: C.muted });
  text(s, "50", { left: L - 40, top: B - S / 2 - 10, width: 32, height: 20 }, 14, { color: C.muted, align: "right" });

  const pts = [
    { name: "显微成像", x: 85, y: 80, dx: 10, dy: -28 },
    { name: "基础检测", x: 80, y: 25, dx: 10, dy: 10 },
    { name: "材料制备", x: 35, y: 75, dx: -116, dy: -28 },
    { name: "常规加工", x: 30, y: 30, dx: -116, dy: 10 },
  ];
  for (const p of pts) {
    const px = L + (p.x / 100) * S;
    const py = B - (p.y / 100) * S;
    shape(s, "ellipse", { left: px - 9, top: py - 9, width: 18, height: 18 }, C.blue, C.blue, 0);
    text(s, `${p.name}  (${p.x},${p.y})`, { left: px + p.dx, top: py + p.dy, width: 150, height: 24 }, 16, { color: C.ink, bold: true });
  }
  // Implications as compact right-side reading rail.
  text(s, "讨论动作", { left: 650, top: 224, width: 160, height: 28 }, 21, { color: C.ink, bold: true });
  const actions = [
    ["高频 × 高支持", "显微成像", "优先增设辅导时段"],
    ["高频 × 低支持", "基础检测", "优先完善自助说明"],
    ["低频 × 高支持", "材料制备", "采用预约辅导"],
    ["低频 × 低支持", "常规加工", "维持基础服务"],
  ];
  for (let i = 0; i < actions.length; i += 1) {
    const y = 272 + i * 76;
    line(s, 650, y + 58, 1198, y + 58, C.line2, 1);
    text(s, actions[i][0], { left: 650, top: y, width: 180, height: 22 }, 16, { color: C.blue, bold: true });
    text(s, actions[i][1], { left: 850, top: y, width: 130, height: 22 }, 16, { color: C.ink, bold: true });
    text(s, actions[i][2], { left: 1000, top: y, width: 198, height: 22 }, 16, { color: C.body });
  }
  text(s, "分界仅帮助讨论，不构成统计分类结论。", { left: 650, top: 600, width: 520, height: 22 }, 14, { color: C.muted, italic: true });
  footer(s, 4);
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const pres = Presentation.create({ slideSize: { width: W, height: H } });
  slide1(pres);
  slide2(pres);
  slide3(pres);
  slide4(pres);
  const finalPptx = `${OUT}/deck.pptx`;
  const pptx = await PresentationFile.exportPptx(pres);
  await pptx.save(finalPptx);
  const imported = await PresentationFile.importPptx(await FileBlob.load(finalPptx));
  for (const [i, slide] of imported.slides.items.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    await writeBlob(`${OUT}/${stem}.png`, await imported.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(`${OUT}/deck-montage.webp`, await imported.export({ format: "webp", montage: true, scale: 1 }));
  const inspect = await imported.inspect({ kind: "slide,textbox,shape", maxChars: 20000 });
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson ?? String(inspect));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
