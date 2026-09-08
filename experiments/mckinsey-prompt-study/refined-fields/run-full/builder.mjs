import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/mckinsey-prompt-study/refined-fields/run-full";
const W = 1280;
const H = 720;
const FONT = "Microsoft YaHei";
const C = {
  navy: "#315F91",
  navyDark: "#24496F",
  navyLight: "#DDE8F2",
  navyPale: "#F1F5F9",
  ink: "#1F2933",
  mid: "#5F6B76",
  light: "#A7B2BC",
  rule: "#CBD5DF",
  white: "#FFFFFF",
  amber: "#A96B24",
  amberPale: "#F7EFE5",
};

function box(slide, geometry, left, top, width, height, fill = "none", lineFill = "none", lineWidth = 0, name) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function text(slide, value, left, top, width, height, opts = {}) {
  const shape = box(slide, "textbox", left, top, width, height, "none", "none", 0, opts.name);
  shape.text = value;
  shape.text.style = {
    fontSize: opts.size ?? 18,
    typeface: FONT,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    lineSpacing: opts.lineSpacing ?? 1.05,
    wrap: opts.wrap ?? "square",
    autoFit: "shrinkText",
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return shape;
}

function rule(slide, left, top, width, color = C.rule, thickness = 1) {
  return box(slide, "rect", left, top, width, thickness, color, color, 0);
}

function footer(slide, page) {
  text(slide, "模拟材料，仅用于方案讨论", 60, 686, 300, 18, { size: 14, color: C.mid });
  text(slide, `大学实验平台改进讨论  ·  ${page}/2`, 960, 686, 260, 18, { size: 14, color: C.mid, align: "right" });
}

function addSlideOne(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  text(slide, "预约障碍呈现分化：校内先看时段，校外先看审批与费用", 60, 34, 1160, 48, { size: 32, color: C.navyDark, bold: true, name: "s1-title" });
  text(slide, "两组模拟多选问卷，各100人", 60, 88, 420, 24, { size: 18, color: C.mid });
  text(slide, "比例不可相加到100%", 1020, 88, 200, 24, { size: 18, color: C.amber, align: "right", bold: true });
  rule(slide, 60, 126, 1160, C.navy, 2);

  text(slide, "障碍维度（选择比例）", 60, 148, 640, 28, { size: 21, color: C.ink, bold: true });
  // Legend
  box(slide, "rect", 550, 155, 14, 14, C.navy, C.navy, 0);
  text(slide, "校内", 570, 148, 60, 24, { size: 18, color: C.mid });
  box(slide, "rect", 650, 155, 14, 14, C.navyLight, C.navyLight, 0);
  text(slide, "校外", 670, 148, 60, 24, { size: 18, color: C.mid });

  const chartLeft = 60;
  const labelW = 155;
  const barLeft = 245;
  const barW = 445;
  const rowTop = 202;
  const rowGap = 82;
  const data = [
    ["时段难匹配", 62, 45],
    ["审批慢", 48, 65],
    ["费用不清", 28, 58],
    ["培训不足", 44, 32],
  ];
  const scale = barW / 100;
  data.forEach(([label, inside, outside], i) => {
    const y = rowTop + i * rowGap;
    text(slide, label, chartLeft, y + 10, labelW, 24, { size: 18, color: C.ink });
    // shared 0–100% track; same x scale across all rows
    box(slide, "roundRect", barLeft, y + 6, barW, 16, C.navyPale, C.navyPale, 0);
    box(slide, "roundRect", barLeft, y + 6, inside * scale, 16, C.navy, C.navy, 0);
    text(slide, `${inside}%`, barLeft + inside * scale + 10, y + 1, 54, 24, { size: 18, color: C.navyDark, bold: true });
    box(slide, "roundRect", barLeft, y + 36, barW, 16, C.navyPale, C.navyPale, 0);
    box(slide, "roundRect", barLeft, y + 36, outside * scale, 16, C.navyLight, C.navyLight, 0);
    text(slide, `${outside}%`, barLeft + outside * scale + 10, y + 31, 54, 24, { size: 18, color: C.navyDark, bold: true });
    text(slide, "校内", barLeft - 55, y + 0, 46, 20, { size: 14, color: C.mid, align: "right" });
    text(slide, "校外", barLeft - 55, y + 30, 46, 20, { size: 14, color: C.mid, align: "right" });
    rule(slide, chartLeft, y + 67, 630, C.rule, 1);
  });
  text(slide, "0", barLeft, 555, 30, 20, { size: 14, color: C.mid });
  text(slide, "50", barLeft + barW / 2 - 14, 555, 30, 20, { size: 14, color: C.mid, align: "center" });
  text(slide, "100%", barLeft + barW - 38, 555, 42, 20, { size: 14, color: C.mid, align: "right" });

  // Interpretation column: each claim sits next to the evidence it interprets.
  box(slide, "rect", 770, 148, 450, 182, C.navyPale, "none", 0);
  box(slide, "rect", 770, 148, 6, 182, C.navy, C.navy, 0);
  text(slide, "校内优先检查时段供给", 800, 169, 390, 30, { size: 21, color: C.navyDark, bold: true });
  text(slide, "“时段难匹配”是校内最高项（62%）\n高于审批慢（48%），先看供给侧。", 800, 215, 380, 60, { size: 18, color: C.ink, lineSpacing: 1.15 });
  text(slide, "本材料内的讨论优先级", 800, 286, 300, 22, { size: 14, color: C.mid });

  box(slide, "rect", 770, 350, 450, 182, C.amberPale, "none", 0);
  box(slide, "rect", 770, 350, 6, 182, C.amber, C.amber, 0);
  text(slide, "校外优先检查审批责任和费用说明", 800, 371, 390, 32, { size: 21, color: C.navyDark, bold: true });
  text(slide, "审批慢（65%）与费用不清（58%）\n高于时段难匹配（45%），先看规则与说明。", 800, 417, 380, 60, { size: 18, color: C.ink, lineSpacing: 1.15 });
  text(slide, "不代表措施已有效；比例不能推广", 800, 488, 340, 22, { size: 14, color: C.mid });
  footer(slide, 1);
  slide.speakerNotes.textFrame.setText("[Sources]\n稿件事实与数值：experiments/mckinsey-prompt-study/refined-fields/manuscript.md（全为虚构模拟材料）。\n图形为本页原生可编辑形状，无外部资产。\n[/Sources]");
  slide.speakerNotes.setVisible(true);
  return slide;
}

function addSlideTwo(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  text(slide, "归档建议先规范新增记录，再按需求补齐历史记录", 60, 34, 1160, 48, { size: 32, color: C.navyDark, bold: true, name: "s2-title" });
  text(slide, "两种归档范围的定性权衡", 60, 88, 420, 24, { size: 18, color: C.mid });
  text(slide, "共同评价维度：投入 · 可追溯性 · 启动条件", 700, 88, 520, 24, { size: 18, color: C.mid, align: "right" });
  rule(slide, 60, 126, 1160, C.navy, 2);

  const x1 = 60;
  const x2 = 650;
  const colW = 570;
  const headerY = 150;
  box(slide, "rect", x1, headerY, colW, 54, C.navyPale, C.rule, 1);
  box(slide, "rect", x2, headerY, colW, 54, C.navy, C.navy, 0);
  text(slide, "全面补历史记录", x1 + 24, headerY + 13, colW - 48, 30, { size: 21, color: C.navyDark, bold: true });
  text(slide, "先规范新增记录", x2 + 24, headerY + 13, colW - 48, 30, { size: 21, color: C.white, bold: true });

  const rows = [
    { label: "投入", left: "需追查旧文件和人员记忆", right: "从每次新增结果登记；投入随新增任务发生" },
    { label: "可追溯性", left: "可覆盖旧结果，但缺失上下文难补", right: "从生成时保留来源、脚本、参数与输出" },
    { label: "启动条件", left: "需明确追溯对象和可用资料", right: "需约定责任人及最小记录清单" },
  ];
  const y0 = 204;
  const rowH = 98;
  rows.forEach((row, i) => {
    const y = y0 + i * rowH;
    box(slide, "rect", x1, y, 108, rowH, C.navyPale, C.rule, 1);
    box(slide, "rect", x1 + 108, y, colW - 108, rowH, C.white, C.rule, 1);
    box(slide, "rect", x2, y, 108, rowH, C.navyPale, C.rule, 1);
    box(slide, "rect", x2 + 108, y, colW - 108, rowH, C.white, C.rule, 1);
    text(slide, row.label, x1 + 16, y + 34, 76, 28, { size: 18, color: C.navyDark, bold: true, align: "center", valign: "middle" });
    text(slide, row.label, x2 + 16, y + 34, 76, 28, { size: 18, color: C.navyDark, bold: true, align: "center", valign: "middle" });
    text(slide, row.left, x1 + 132, y + 23, colW - 156, 56, { size: 18, color: C.ink, valign: "middle", lineSpacing: 1.12 });
    text(slide, row.right, x2 + 132, y + 23, colW - 156, 56, { size: 18, color: C.ink, valign: "middle", lineSpacing: 1.12 });
  });

  box(slide, "rect", 60, 520, 1160, 102, C.navyPale, "none", 0);
  box(slide, "rect", 60, 520, 8, 102, C.navy, C.navy, 0);
  text(slide, "建议", 88, 539, 70, 26, { size: 21, color: C.navyDark, bold: true });
  text(slide, "先试新增；对已有明确追溯需求的历史结果定向补齐。", 165, 535, 820, 32, { size: 21, color: C.navyDark, bold: true });
  text(slide, "边界：历史记录的覆盖仍不完整。材料未提供投入金额、工时或成功率，不能据此量化优劣。", 165, 577, 1010, 24, { size: 14, color: C.mid });
  footer(slide, 2);
  slide.speakerNotes.textFrame.setText("[Sources]\n稿件事实与定性权衡：experiments/mckinsey-prompt-study/refined-fields/manuscript.md（全为虚构模拟材料）。\n未使用外部资产或外部数值。\n[/Sources]");
  slide.speakerNotes.setVisible(true);
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  addSlideOne(presentation);
  addSlideTwo(presentation);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,notes", maxChars: 12000 });
  await fs.writeFile(`${OUT}/build-inspect.ndjson`, inspect.ndjson, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
