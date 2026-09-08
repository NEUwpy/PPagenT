import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/refined-fields/run-no-analysis";
const FONT = "Microsoft YaHei";
const BLUE = "#315F91";
const BLUE_DARK = "#25496F";
const BLUE_LIGHT = "#EAF1F7";
const BLUE_MID = "#91A9BE";
const TEXT = "#1F2933";
const MUTED = "#66717D";
const RULE = "#C9D2DA";
const PALE = "#F5F7F9";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, left, top, width, height, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: 18,
    typeface: FONT,
    color: TEXT,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    ...style,
  };
  return shape;
}

function addRect(slide, name, left, top, width, height, fill, lineFill = fill, lineWidth = 0) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addLine(slide, name, left, top, width, height, color = RULE, lineWidth = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: color, width: lineWidth },
  });
}

function addFooter(slide, page) {
  addLine(slide, `footer-rule-${page}`, 64, 674, 1152, 0, RULE, 1);
  addText(slide, `footer-note-${page}`, "模拟材料，仅用于方案讨论", 64, 682, 360, 22, {
    fontSize: 14,
    color: MUTED,
  });
  addText(slide, `footer-page-${page}`, `${String(page).padStart(2, "0")} / 02`, 1120, 682, 96, 22, {
    fontSize: 14,
    color: MUTED,
    alignment: "right",
  });
}

function addSlideChrome(slide, page, title, claim) {
  slide.background.fill = "#FFFFFF";
  addText(slide, `eyebrow-${page}`, "大学实验平台改进讨论  |  模拟材料", 64, 28, 430, 24, {
    fontSize: 14,
    bold: true,
    color: BLUE,
  });
  addText(slide, `page-marker-${page}`, `ANALYSIS  ${String(page).padStart(2, "0")}`, 1060, 30, 156, 22, {
    fontSize: 14,
    bold: true,
    color: MUTED,
    alignment: "right",
  });
  addText(slide, `title-${page}`, title, 64, 58, 1040, 42, {
    fontSize: 32,
    bold: true,
    color: TEXT,
  });
  addLine(slide, `top-rule-${page}`, 64, 108, 1152, 0, BLUE, 2);
  addText(slide, `claim-${page}`, claim, 64, 122, 1152, 32, {
    fontSize: 21,
    bold: true,
    color: BLUE_DARK,
  });
}

function buildSlideOne(presentation) {
  const slide = presentation.slides.add();
  addSlideChrome(slide, 1, "预约障碍决定服务改进的先后", "校内先看时段供给；校外先厘清审批责任与费用说明");

  const chartLeft = 64;
  const chartTop = 178;
  const chartWidth = 786;
  const labelX = 64;
  const barX = 340;
  const outsideX = 560;
  const barW = 360;
  const scale = 3.6;
  addText(slide, "chart-caption-1", "预约中遇到的主要障碍（多选，比例）", chartLeft, chartTop, chartWidth, 28, {
    fontSize: 21,
    bold: true,
    color: TEXT,
  });
  addText(slide, "chart-subnote-1", "两组各100人；多选题，比例不能相加到100%", chartLeft, chartTop + 31, chartWidth, 23, {
    fontSize: 14,
    color: MUTED,
  });
  addText(slide, "series-in-1", "校内", barX, chartTop + 62, 96, 22, { fontSize: 18, bold: true, color: BLUE });
  addText(slide, "series-out-1", "校外", outsideX, chartTop + 62, 96, 22, { fontSize: 18, bold: true, color: BLUE_MID });
  addLine(slide, "axis-1", barX, chartTop + 88, 440, 0, RULE, 1);

  const data = [
    ["时段难匹配", 62, 45],
    ["审批慢", 48, 65],
    ["费用不清", 28, 58],
    ["培训不足", 44, 32],
  ];
  const rowStart = chartTop + 116;
  const rowH = 63;
  for (let i = 0; i < data.length; i += 1) {
    const [label, inside, outside] = data[i];
    const y = rowStart + i * rowH;
    addText(slide, `cat-${i}`, label, labelX, y + 4, 245, 24, { fontSize: 18, color: TEXT });
    addRect(slide, `bar-in-${i}`, barX, y + 2, inside * scale, 18, BLUE);
    addText(slide, `val-in-${i}`, `${inside}%`, barX + inside * scale + 10, y - 1, 68, 24, { fontSize: 18, bold: true, color: BLUE });
    addRect(slide, `bar-out-${i}`, outsideX, y + 30, outside * scale, 18, BLUE_MID);
    addText(slide, `val-out-${i}`, `${outside}%`, outsideX + outside * scale + 10, y + 27, 68, 24, { fontSize: 18, bold: true, color: BLUE_MID });
    addLine(slide, `row-rule-${i}`, labelX, y + 56, chartWidth, 0, "#E6EBEF", 1);
  }
  addText(slide, "chart-axis-note-1", "0", barX - 2, rowStart + 4 * rowH + 6, 24, 20, { fontSize: 14, color: MUTED });
  addText(slide, "chart-axis-note-2", "100%", barX + 320, rowStart + 4 * rowH + 6, 70, 20, { fontSize: 14, color: MUTED, alignment: "right" });

  addLine(slide, "insight-divider-1", 884, 178, 0, 388, BLUE, 2);
  addText(slide, "insight-head-1", "讨论优先级", 914, 178, 280, 28, { fontSize: 21, bold: true, color: BLUE });
  addText(slide, "insight-in-head-1", "校内", 914, 228, 280, 24, { fontSize: 18, bold: true, color: BLUE_DARK });
  addText(slide, "insight-in-body-1", "时段难匹配为最高比例（62%）。先检查时段供给是否能覆盖预约需求。", 914, 258, 280, 78, { fontSize: 18, color: TEXT });
  addLine(slide, "insight-rule-1", 914, 352, 280, 0, RULE, 1);
  addText(slide, "insight-out-head-1", "校外", 914, 370, 280, 24, { fontSize: 18, bold: true, color: BLUE_DARK });
  addText(slide, "insight-out-body-1", "审批慢65%、费用不清58%突出。\n先厘清审批责任与费用说明。", 914, 400, 300, 78, { fontSize: 18, color: TEXT });
  addText(slide, "insight-limit-1", "这是本材料内的讨论优先级，不代表措施已有效；结果不能推广。", 914, 507, 280, 52, { fontSize: 14, color: MUTED });
  addFooter(slide, 1);
  slide.speakerNotes.textFrame.setText("[Sources]\n内部提供：experiments/mckinsey-prompt-study/refined-fields/manuscript.md（全为虚构模拟材料）");
  slide.speakerNotes.setVisible(true);
  return slide;
}

function buildSlideTwo(presentation) {
  const slide = presentation.slides.add();
  addSlideChrome(slide, 2, "先试新增记录，历史记录按需求补齐", "先建立可持续的最小记录链，再对明确需要的历史结果定向追溯");

  const x = 64;
  const y = 178;
  const w = 1152;
  const headH = 54;
  const labelW = 196;
  const colW = (w - labelW) / 2;
  addRect(slide, "table-head-label", x, y, labelW, headH, BLUE_DARK);
  addRect(slide, "table-head-full", x + labelW, y, colW, headH, BLUE_DARK);
  addRect(slide, "table-head-new", x + labelW + colW, y, colW, headH, BLUE);
  addText(slide, "table-head-label-text", "评价维度", x + 16, y + 15, labelW - 32, 26, { fontSize: 18, bold: true, color: "#FFFFFF" });
  addText(slide, "table-head-full-text", "全面补历史记录", x + labelW + 16, y + 15, colW - 32, 26, { fontSize: 18, bold: true, color: "#FFFFFF" });
  addText(slide, "table-head-new-text", "先规范新增记录  ·  建议先试", x + labelW + colW + 16, y + 15, colW - 32, 26, { fontSize: 18, bold: true, color: "#FFFFFF" });

  const rows = [
    ["投入", "需追查旧文件和人员记忆。", "从每次新增结果登记，投入随新增任务发生。"],
    ["可追溯性", "可覆盖旧结果，但缺失上下文难补。", "能从生成时保留来源、脚本、参数与输出。"],
    ["启动条件", "需要明确追溯对象和可用资料。", "需约定责任人及最小记录清单。"],
  ];
  const heights = [82, 116, 94];
  let cy = y + headH;
  for (let i = 0; i < rows.length; i += 1) {
    const [label, full, fresh] = rows[i];
    const h = heights[i];
    addRect(slide, `row-label-${i}`, x, cy, labelW, h, i % 2 === 0 ? PALE : "#FFFFFF", RULE, 1);
    addRect(slide, `row-full-${i}`, x + labelW, cy, colW, h, i % 2 === 0 ? "#FFFFFF" : PALE, RULE, 1);
    addRect(slide, `row-new-${i}`, x + labelW + colW, cy, colW, h, i % 2 === 0 ? BLUE_LIGHT : "#F1F6FA", RULE, 1);
    addText(slide, `row-label-text-${i}`, label, x + 16, cy + 18, labelW - 32, 28, { fontSize: 18, bold: true, color: BLUE_DARK });
    addText(slide, `row-full-text-${i}`, full, x + labelW + 16, cy + 16, colW - 32, h - 24, { fontSize: 18, color: TEXT });
    addText(slide, `row-new-text-${i}`, fresh, x + labelW + colW + 16, cy + 16, colW - 32, h - 24, { fontSize: 18, color: TEXT });
    cy += h;
  }
  addText(slide, "matrix-footnote-2", "两种范围都需要明确责任与资料边界；本材料没有投入金额、工时或成功率，因此不做量化优劣。", x, 493, w, 28, { fontSize: 14, color: MUTED });

  addRect(slide, "recommendation-strip-2", 64, 546, 1152, 100, BLUE_LIGHT, BLUE_LIGHT, 0);
  addRect(slide, "recommendation-accent-2", 64, 546, 10, 100, BLUE, BLUE, 0);
  addText(slide, "recommendation-label-2", "建议", 94, 562, 92, 30, { fontSize: 21, bold: true, color: BLUE_DARK });
  addText(slide, "recommendation-body-2", "先试新增记录；对已有明确追溯需求的历史结果定向补齐。代价是历史覆盖仍不完整。", 190, 559, 984, 58, { fontSize: 18, color: TEXT });
  addFooter(slide, 2);
  slide.speakerNotes.textFrame.setText("[Sources]\n内部提供：experiments/mckinsey-prompt-study/refined-fields/manuscript.md（全为虚构模拟材料）");
  slide.speakerNotes.setVisible(true);
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  buildSlideOne(presentation);
  buildSlideTwo(presentation);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
