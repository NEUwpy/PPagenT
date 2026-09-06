import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/transfer-02/run-04";
const THEME_PATH = "C:/PPagenT/experiments/university-skin-pilot/reference-01/theme.json";
const NBSP = "\u00A0";

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function blend(a, b, amount) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r * (1 - amount) + y.r * amount, g: x.g * (1 - amount) + y.g * amount, b: x.b * (1 - amount) + y.b * amount });
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, theme, name, text, position, role, options = {}) {
  const sizes = { title: 32, local: 22, body: 20, secondary: 18, chart: 16, source: 14, delta: 40 };
  const shape = slide.shapes.add({ geometry: "textbox", name, position, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = text;
  shape.text.style = {
    fontSize: sizes[role],
    color: options.color ?? theme.ink,
    bold: options.bold ?? (role === "title" || role === "local"),
    typeface: theme.font,
    lineSpacing: 1.25,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    autoFit: "none",
    wrap: options.wrap ?? "square",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addRect(slide, name, position, fill, lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({ geometry: "rect", name, position, fill, line: { style: "solid", fill: lineFill, width: lineWidth } });
}

function addLine(slide, name, position, color, lineWidth = 1) {
  return slide.shapes.add({ geometry: "line", name, position, fill: "none", line: { style: "solid", fill: color, width: lineWidth } });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const themeInput = JSON.parse(await fs.readFile(THEME_PATH, "utf8"));
  const primary = themeInput.primaryColor;
  const background = themeInput.neutral.background;
  const theme = {
    font: themeInput.font,
    ink: themeInput.neutral.ink,
    muted: themeInput.neutral.muted,
    background,
    primary,
    primaryDark: blend(primary, themeInput.neutral.ink, 0.40),
    primaryPale: blend(primary, background, 0.90),
    evidenceFill: blend(themeInput.neutral.ink, background, 0.95),
    track: blend(themeInput.neutral.ink, background, 0.91),
    mutedBar: blend(themeInput.neutral.ink, background, 0.52),
    axis: blend(themeInput.neutral.ink, background, 0.78),
  };

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = theme.background;

  // Semantic title band: the decision question and answer occupy the first visual layer.
  addRect(slide, "title-band", { left: 0, top: 0, width: 1280, height: 126 }, theme.background);
  addText(slide, theme, "title", `4.0${NBSP}GB 上限下，分批处理是下一轮试运行的可行选择`, { left: 55, top: 35, width: 1170, height: 46 }, "title", { color: theme.ink, wrap: "none" });
  addText(slide, theme, "method-line", "同一台工作站｜100 个固定数据批次｜相同输入顺序与线程参数｜三种方式均完整处理", { left: 55, top: 87, width: 1170, height: 24 }, "chart", { color: theme.muted, bold: false, wrap: "none" });
  addLine(slide, "header-rule", { left: 55, top: 126, width: 1170, height: 0 }, theme.primary, 2);

  // Main evidence region: larger than any explanation group, with a real semantic surface.
  addRect(slide, "evidence-region", { left: 55, top: 153, width: 790, height: 475 }, theme.evidenceFill);
  addText(slide, theme, "evidence-criteria", "同一批次、同一线程参数；耗时看中位数，内存看峰值", { left: 85, top: 178, width: 610, height: 22 }, "chart", { color: theme.muted, bold: false, wrap: "none" });

  const plotLeft = 245;
  const plotWidth = 535;
  addText(slide, theme, "time-heading", "单批耗时中位数（秒）", { left: 85, top: 211, width: 390, height: 28 }, "local", { wrap: "none" });
  // Use the same native editable bar geometry as the memory plot below so both views share one grid.
  const timeMethods = [
    { name: "串行处理", value: 120, y: 259, fill: theme.mutedBar },
    { name: "分批处理", value: 70, y: 298, fill: theme.primary },
    { name: "并行处理", value: 45, y: 337, fill: theme.mutedBar },
  ];
  for (const method of timeMethods) {
    addText(slide, theme, `time-label-${method.name}`, method.name, { left: 85, top: method.y - 3, width: 125, height: 24 }, "chart", { color: theme.ink, bold: false, wrap: "none" });
    addRect(slide, `time-track-${method.name}`, { left: plotLeft, top: method.y, width: plotWidth, height: 18 }, theme.track);
    const barWidth = plotWidth * (method.value / 120.0);
    addRect(slide, `time-bar-${method.name}`, { left: plotLeft, top: method.y, width: barWidth, height: 18 }, method.fill);
    addText(slide, theme, `time-value-${method.name}`, `${method.value}${NBSP}秒`, { left: plotLeft + barWidth - 74, top: method.y - 3, width: 68, height: 24 }, "chart", { color: theme.background, bold: false, alignment: "right", wrap: "none" });
  }
  addLine(slide, "time-axis", { left: plotLeft, top: 369, width: plotWidth, height: 0 }, theme.axis, 1);
  for (const tick of [0, 30, 60, 90, 120]) {
    const x = plotLeft + plotWidth * (tick / 120);
    addLine(slide, `time-tick-${tick}`, { left: x, top: 369, width: 0, height: 6 }, theme.axis, 1);
    addText(slide, theme, `time-tick-label-${tick}`, String(tick), { left: x - 12, top: 379, width: 24, height: 20 }, "chart", { color: theme.muted, bold: false, alignment: "center", wrap: "none" });
  }

  addText(slide, theme, "memory-heading", "全程峰值内存（GB）", { left: 85, top: 407, width: 390, height: 28 }, "local", { wrap: "none" });
  const thresholdX = plotLeft + plotWidth * 0.5;
  const methods = [
    { name: "串行处理", value: 2.0, y: 446, fill: theme.mutedBar, labelColor: theme.background },
    { name: "分批处理", value: 3.6, y: 486, fill: theme.primary, labelColor: theme.background },
    { name: "并行处理", value: 7.4, y: 526, fill: theme.mutedBar, labelColor: theme.background },
  ];
  for (const method of methods) {
    addText(slide, theme, `memory-label-${method.name}`, method.name, { left: 85, top: method.y - 3, width: 125, height: 24 }, "chart", { color: theme.ink, bold: false, wrap: "none" });
    addRect(slide, `memory-track-${method.name}`, { left: plotLeft, top: method.y, width: plotWidth, height: 18 }, theme.track);
    const barWidth = plotWidth * (method.value / 8.0);
    addRect(slide, `memory-bar-${method.name}`, { left: plotLeft, top: method.y, width: barWidth, height: 18 }, method.fill);
    // Labels are consistently placed inside the right end of every bar.
    addText(slide, theme, `memory-value-${method.name}`, `${method.value.toFixed(1)}${NBSP}GB`, { left: plotLeft + barWidth - 74, top: method.y - 3, width: 68, height: 24 }, "chart", { color: method.labelColor, bold: false, alignment: "right", wrap: "none" });
  }
  // Draw after tracks/bars so the 4.0 GB threshold is visually continuous and on top.
  addLine(slide, "memory-threshold", { left: thresholdX, top: 434, width: 0, height: 114 }, theme.primary, 2);
  addRect(slide, "threshold-tag", { left: thresholdX + 7, top: 419, width: 108, height: 24 }, theme.evidenceFill);
  addText(slide, theme, "threshold-label", `4.0${NBSP}GB 上限`, { left: thresholdX + 10, top: 420, width: 100, height: 20 }, "chart", { color: theme.primaryDark, bold: false, wrap: "none" });
  addLine(slide, "memory-axis", { left: plotLeft, top: 558, width: plotWidth, height: 0 }, theme.axis, 1);
  for (const tick of [0, 2, 4, 6, 8]) {
    const x = plotLeft + plotWidth * (tick / 8);
    addLine(slide, `memory-tick-${tick}`, { left: x, top: 558, width: 0, height: 6 }, theme.axis, 1);
    addText(slide, theme, `memory-tick-label-${tick}`, String(tick), { left: x - 12, top: 568, width: 24, height: 20 }, "chart", { color: theme.muted, bold: false, alignment: "center", wrap: "none" });
  }

  // Secondary semantic region: decision and limits, visibly smaller than the evidence region.
  addRect(slide, "decision-region", { left: 875, top: 153, width: 350, height: 475 }, theme.primaryPale);
  addRect(slide, "decision-band", { left: 875, top: 153, width: 350, height: 64 }, theme.primary);
  addText(slide, theme, "decision-heading", "本轮建议：分批处理", { left: 905, top: 173, width: 290, height: 28 }, "local", { color: theme.background, wrap: "none" });
  addText(slide, theme, "delta-value", `少 50${NBSP}秒/批`, { left: 905, top: 242, width: 280, height: 48 }, "delta", { color: theme.primaryDark, bold: true, wrap: "none" });
  addText(slide, theme, "delta-caption", "相对当前串行处理", { left: 905, top: 292, width: 260, height: 20 }, "chart", { color: theme.muted, bold: false, wrap: "none" });
  addLine(slide, "decision-rule-1", { left: 905, top: 332, width: 290, height: 0 }, theme.primarySoft, 1);
  addText(slide, theme, "headroom", `内存余量：0.4${NBSP}GB`, { left: 905, top: 350, width: 280, height: 28 }, "local", { color: theme.primaryDark, wrap: "none" });
  addText(slide, theme, "parallel-heading", "并行处理不适用", { left: 905, top: 412, width: 280, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "parallel-body", "超出内存上限；\n关闭必需任务也不能扩容。", { left: 905, top: 454, width: 300, height: 56 }, "body", { bold: false });
  addText(slide, theme, "scope-heading", "适用条件", { left: 905, top: 545, width: 280, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "scope-body", "仅验证本机与这组固定批次。", { left: 905, top: 582, width: 300, height: 24 }, "secondary", { bold: false, wrap: "none" });

  addRect(slide, "boundary-band", { left: 55, top: 636, width: 1170, height: 28 }, theme.track);
  addText(slide, theme, "boundary-line", "边界：其他批次与硬件未验证；下一轮受控试运行并记录峰值；不承诺所有数据保持当前耗时，不视为正式部署。", { left: 70, top: 640, width: 1140, height: 20 }, "chart", { color: theme.ink, bold: false, wrap: "none" });
  addText(slide, theme, "source", "来源：虚构测试数据｜设计验证素材，非真实算法性能报告", { left: 55, top: 674, width: 900, height: 18 }, "source", { color: theme.muted, bold: false, wrap: "none" });
  addText(slide, theme, "page-number", "01", { left: 1170, top: 674, width: 55, height: 18 }, "source", { color: theme.muted, bold: false, alignment: "right", wrap: "none" });
  slide.speakerNotes.textFrame.setText("[Sources]\n- No external sources. All values and conditions come from the user-provided manuscript and are explicitly labeled as fictional test data.\n[/Sources]");
  slide.speakerNotes.setVisible(true);

  await writeBlob(`${OUT}/slide-01.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${OUT}/slide-01.layout.json`, await (await slide.export({ format: "layout" })).text());
  await writeBlob(`${OUT}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,chart,notes", maxChars: 30000 });
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
