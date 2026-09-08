import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, "")));
const W = 1280;
const H = 720;
const FONT = "Microsoft YaHei";
const BLUE = "#315F91";
const BLUE_DARK = "#24466B";
const BLUE_LIGHT = "#AFC5D9";
const BLUE_PALE = "#EAF1F7";
const INK = "#20252B";
const GRAY = "#5E6873";
const MID = "#AEB7C1";
const GRID = "#D9E0E6";
const PAPER = "#FFFFFF";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function box(slide, x, y, w, h, fill = "none", lineFill = "none", lineWidth = 0, geometry = "rect") {
  return slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function text(slide, value, x, y, w, h, style = {}) {
  const s = box(slide, x, y, w, h, "none", "none", 0, "textbox");
  s.text = value;
  s.text.style = {
    typeface: FONT,
    fontSize: style.fontSize ?? 18,
    color: style.color ?? INK,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    lineSpacing: style.lineSpacing ?? 1.08,
    wrap: style.wrap ?? "square",
    autoFit: style.autoFit ?? "shrinkText",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return s;
}

function rule(slide, x, y, w, color = GRID, h = 1) {
  return box(slide, x, y, w, h, color, "none", 0, "rect");
}

function footer(slide, pageNo, sourceText) {
  rule(slide, 72, 664, 1136, GRID, 1);
  text(slide, sourceText, 72, 675, 980, 22, { fontSize: 14, color: GRAY, verticalAlignment: "middle" });
  text(slide, String(pageNo).padStart(2, "0"), 1164, 675, 44, 22, { fontSize: 14, color: GRAY, alignment: "right", verticalAlignment: "middle" });
}

function titleBlock(slide, titleText, kicker) {
  text(slide, kicker, 72, 36, 1136, 22, { fontSize: 14, color: BLUE, bold: true, verticalAlignment: "middle" });
  text(slide, titleText, 72, 65, 1136, 42, { fontSize: 32, color: INK, bold: true, wrap: "none", verticalAlignment: "middle" });
  rule(slide, 72, 123, 1136, BLUE, 2);
}

function addSlideOne(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = PAPER;
  titleBlock(slide, "预约障碍决定服务改进的先后", "大学实验平台改进讨论  ·  模拟材料，仅用于方案讨论");

  // Chart heading and legend
  text(slide, "多选问卷中，校内与校外的首要障碍不同", 72, 145, 684, 30, { fontSize: 21, bold: true, color: INK, verticalAlignment: "middle" });
  text(slide, "选择该项的受访者占比（%）", 72, 179, 684, 22, { fontSize: 14, color: GRAY, verticalAlignment: "middle" });
  box(slide, 544, 149, 14, 14, BLUE, "none", 0);
  text(slide, "校内", 565, 144, 56, 24, { fontSize: 14, color: GRAY, verticalAlignment: "middle" });
  box(slide, 633, 149, 14, 14, BLUE_LIGHT, "none", 0);
  text(slide, "校外", 654, 144, 56, 24, { fontSize: 14, color: GRAY, verticalAlignment: "middle" });

  const labels = ["按时段难匹配", "审批慢", "费用不清", "培训不足"];
  const inside = [62, 48, 28, 44];
  const outside = [45, 65, 58, 32];
  const xLabel = 72;
  const xBar = 230;
  const barW = 520;
  const scale = barW / 80;
  const y0 = 224;
  const rowH = 79;
  const barH = 14;

  [0, 20, 40, 60, 80].forEach((tick) => {
    const x = xBar + tick * scale;
    rule(slide, x, 215, 1, GRID, 296);
    text(slide, String(tick), x - 12, 194, 28, 18, { fontSize: 14, color: GRAY, alignment: "center", verticalAlignment: "middle" });
  });
  labels.forEach((label, i) => {
    const y = y0 + i * rowH;
    text(slide, label, xLabel, y + 4, 142, 24, { fontSize: 18, color: INK, verticalAlignment: "middle" });
    box(slide, xBar, y + 2, inside[i] * scale, barH, BLUE, "none", 0);
    text(slide, `${inside[i]}%`, xBar + inside[i] * scale + 9, y - 1, 42, 22, { fontSize: 18, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
    box(slide, xBar, y + 27, outside[i] * scale, barH, BLUE_LIGHT, "none", 0);
    text(slide, `${outside[i]}%`, xBar + outside[i] * scale + 9, y + 24, 42, 22, { fontSize: 18, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
    rule(slide, xLabel, y + 61, 680, GRID, 1);
  });

  // Action panel, aligned to evidence.
  const panelX = 804;
  box(slide, panelX, 145, 404, 386, BLUE_PALE, "none", 0, "roundRect");
  text(slide, "讨论优先级", panelX + 28, 171, 340, 30, { fontSize: 21, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
  rule(slide, panelX + 28, 211, 348, BLUE, 2);
  text(slide, "校内", panelX + 28, 235, 80, 24, { fontSize: 18, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
  text(slide, "先检查时段供给\n（难匹配 62%）", panelX + 28, 264, 336, 52, { fontSize: 18, color: INK, lineSpacing: 1.14 });
  text(slide, "校外", panelX + 28, 339, 80, 24, { fontSize: 18, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
  text(slide, "先检查审批责任和费用说明\n（审批慢 65%；费用不清 58%）", panelX + 28, 368, 340, 56, { fontSize: 18, color: INK, lineSpacing: 1.14 });
  text(slide, "本页判断是材料内的讨论优先级，不代表措施已有效。", panelX + 28, 466, 340, 45, { fontSize: 14, color: GRAY, lineSpacing: 1.08 });

  text(slide, "注：四个维度可多选，比例不能相加到 100%；校内、校外各 n=100，结果不作推广。", 72, 562, 1136, 26, { fontSize: 14, color: GRAY, verticalAlignment: "middle" });
  footer(slide, 1, "来源：模拟多选问卷；四维为按时段难匹配、审批慢、费用不清、培训不足。");
}

function addSlideTwo(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = PAPER;
  titleBlock(slide, "先试新增记录，历史记录按需求补齐", "大学实验平台改进讨论  ·  模拟材料，仅用于方案讨论");

  text(slide, "两种归档范围的取舍集中在投入方式、可追溯性与启动条件", 72, 145, 1136, 30, { fontSize: 21, bold: true, color: INK, verticalAlignment: "middle" });

  const left = 72;
  const top = 193;
  const labelW = 126;
  const colW = 468;
  const gap = 24;
  const right = left + labelW + gap + colW + gap;
  const rowYs = [273, 376, 479];
  const rowH = 89;

  // Column headers.
  text(slide, "评价维度", left, top + 16, labelW, 30, { fontSize: 18, color: GRAY, bold: true, verticalAlignment: "middle" });
  box(slide, left + labelW + gap, top, colW, 66, BLUE, "none", 0, "roundRect");
  box(slide, right, top, colW, 66, BLUE_DARK, "none", 0, "roundRect");
  text(slide, "全面补历史记录", left + labelW + gap + 22, top + 14, colW - 44, 34, { fontSize: 21, color: PAPER, bold: true, verticalAlignment: "middle", wrap: "none" });
  text(slide, "先规范新增记录", right + 22, top + 14, colW - 44, 34, { fontSize: 21, color: PAPER, bold: true, verticalAlignment: "middle", wrap: "none" });

  const dims = ["投入", "可追溯性", "启动条件"];
  const leftText = [
    "需追查旧文件和人员记忆。",
    "可覆盖旧结果，但缺失上下文难补。",
    "需要明确追溯对象和可用资料。",
  ];
  const rightText = [
    "从每次新增结果登记，投入随新增任务发生。",
    "生成时保留来源、脚本、参数与输出。",
    "需约定责任人及最小记录清单。",
  ];

  dims.forEach((dim, i) => {
    const y = rowYs[i];
    text(slide, dim, left, y + 26, labelW, 30, { fontSize: 18, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
    rule(slide, left + labelW + gap, y - 10, colW, GRID, 1);
    rule(slide, right, y - 10, colW, GRID, 1);
    text(slide, leftText[i], left + labelW + gap + 22, y + 8, colW - 44, rowH - 16, { fontSize: 18, color: INK, lineSpacing: 1.16, verticalAlignment: "middle" });
    text(slide, rightText[i], right + 22, y + 8, colW - 44, rowH - 16, { fontSize: 18, color: INK, lineSpacing: 1.16, verticalAlignment: "middle" });
  });
  rule(slide, left + labelW + gap, 578, colW, GRID, 1);
  rule(slide, right, 578, colW, GRID, 1);

  // Recommendation band.
  box(slide, 72, 595, 1136, 48, BLUE_PALE, "none", 0, "roundRect");
  text(slide, "建议", 92, 607, 56, 24, { fontSize: 18, color: BLUE_DARK, bold: true, verticalAlignment: "middle" });
  text(slide, "先试新增；对已有明确追溯需求的历史结果定向补齐。代价是历史覆盖仍不完整。", 158, 607, 994, 24, { fontSize: 18, color: INK, verticalAlignment: "middle", wrap: "none" });
  text(slide, "本材料未提供投入金额、工时或成功率，因此不作数字化优劣判断。", 72, 626, 1136, 23, { fontSize: 14, color: GRAY, verticalAlignment: "middle" });
  footer(slide, 2, "来源：模拟归档方案讨论材料；评价维度为投入、可追溯性、启动条件。");
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  addSlideOne(presentation);
  addSlideTwo(presentation);

  const pptxPath = path.join(OUT, "deck.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(pptxPath);

  // Re-import the final PPTX and render the deliverable PNGs from that file.
  const imported = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  for (const [index, slide] of imported.slides.items.entries()) {
    const png = await imported.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(OUT, `slide-${String(index + 1).padStart(2, "0")}.png`), png);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
