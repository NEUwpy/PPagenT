import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/transfer-02/run-02";
const THEME_PATH = "C:/PPagenT/experiments/university-skin-pilot/reference-01/theme.json";

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function blend(a, b, amount) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r * (1 - amount) + y.r * amount,
    g: x.g * (1 - amount) + y.g * amount,
    b: x.b * (1 - amount) + y.b * amount,
  });
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, theme, name, text, position, role, options = {}) {
  const sizes = { title: 32, local: 22, body: 20, chart: 16, source: 14 };
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
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

function addLine(slide, name, left, top, width, height, color, lineWidth = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: color, width: lineWidth },
  });
}

function addRect(slide, name, position, fill, lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
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
    primaryDark: blend(primary, themeInput.neutral.ink, 0.35),
    primarySoft: blend(primary, background, 0.72),
    primaryPale: blend(primary, background, 0.91),
    barMuted: blend(primary, background, 0.46),
    axis: blend(themeInput.neutral.ink, background, 0.80),
    track: blend(themeInput.neutral.ink, background, 0.93),
  };

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = theme.background;

  // Header: the decision is visible before the evidence.
  addText(slide, theme, "title", "在 4.0 GB 上限下，分批处理是下一轮试运行的可行选择", { left: 55, top: 36, width: 1170, height: 46 }, "title", { wrap: "none" });
  addText(slide, theme, "method-line", "同一台工作站、同一套 100 个数据批次、固定线程参数｜耗时为单批中位数，内存为全程峰值", { left: 55, top: 91, width: 1170, height: 24 }, "chart", { color: theme.muted, bold: false, wrap: "none" });
  addLine(slide, "header-rule", 55, 131, 1170, 0, theme.primary, 2);

  addText(slide, theme, "main-claim", "内存先筛选，速度再排序", { left: 55, top: 154, width: 760, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "time-heading", "单批耗时中位数（秒）", { left: 55, top: 197, width: 360, height: 28 }, "local", { wrap: "none" });

  // Native editable chart for the speed comparison.
  slide.charts.add("bar", {
    position: { left: 55, top: 228, width: 745, height: 148 },
    categories: ["串行处理", "分批处理", "并行处理"],
    series: [{
      name: "单批耗时中位数",
      values: [120, 70, 45],
      fill: theme.barMuted,
      points: [
        { idx: 0, fill: theme.primarySoft },
        { idx: 1, fill: theme.primary },
        { idx: 2, fill: theme.primarySoft },
      ],
    }],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 58 },
    chartFill: theme.background,
    chartLine: { style: "solid", fill: "none", width: 0 },
    plotAreaFill: theme.background,
    plotAreaLine: { style: "solid", fill: "none", width: 0 },
    xAxis: {
      min: 0,
      max: 120,
      majorUnit: 30,
      textStyle: { fontSize: 16, fill: theme.muted },
      line: { style: "solid", fill: theme.axis, width: 1 },
      majorGridlines: { style: "solid", fill: theme.axis, width: 1 },
    },
    yAxis: {
      textStyle: { fontSize: 16, fill: theme.ink },
      line: { style: "solid", fill: "none", width: 0 },
      majorGridlines: null,
    },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 16, fill: theme.ink } },
  });

  // Editable memory comparison with the 4.0 GB threshold drawn on the actual scale.
  addText(slide, theme, "memory-heading", "全程峰值内存（GB）", { left: 55, top: 399, width: 360, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "memory-note", "可用上限 = 4.0 GB", { left: 55, top: 428, width: 260, height: 20 }, "chart", { color: theme.muted, bold: false, wrap: "none" });

  const plotLeft = 215;
  const plotWidth = 560;
  const plotRight = plotLeft + plotWidth;
  const thresholdX = plotLeft + plotWidth * (4.0 / 8.0);
  addLine(slide, "memory-threshold", thresholdX, 421, 0, 163, theme.primary, 2);
  addText(slide, theme, "threshold-label", "4.0 GB 上限", { left: thresholdX - 52, top: 397, width: 110, height: 20 }, "chart", { color: theme.primaryDark, bold: false, alignment: "center", wrap: "none" });

  const methods = [
    { name: "串行处理", value: 2.0, y: 461, fill: theme.primarySoft },
    { name: "分批处理", value: 3.6, y: 507, fill: theme.primary },
    { name: "并行处理", value: 7.4, y: 553, fill: theme.primarySoft },
  ];
  for (const method of methods) {
    addText(slide, theme, `memory-label-${method.name}`, method.name, { left: 55, top: method.y - 4, width: 125, height: 24 }, "chart", { color: theme.ink, bold: false, wrap: "none" });
    addRect(slide, `memory-track-${method.name}`, { left: plotLeft, top: method.y, width: plotWidth, height: 18 }, theme.track);
    addRect(slide, `memory-bar-${method.name}`, { left: plotLeft, top: method.y, width: plotWidth * (method.value / 8.0), height: 18 }, method.fill);
    const valueLeft = method.name === "分批处理"
      ? thresholdX - 86
      : plotLeft + plotWidth * (method.value / 8.0) + 10;
    const valueTop = method.name === "分批处理" ? method.y - 25 : method.y - 4;
    addText(slide, theme, `memory-value-${method.name}`, `${method.value.toFixed(1)} GB`, { left: valueLeft, top: valueTop, width: 80, height: 24 }, "chart", { color: theme.ink, bold: false, wrap: "none" });
  }
  addLine(slide, "memory-axis", plotLeft, 585, plotWidth, 0, theme.axis, 1);
  for (const tick of [0, 2, 4, 6, 8]) {
    const x = plotLeft + plotWidth * (tick / 8);
    addLine(slide, `memory-tick-${tick}`, x, 585, 0, 6, theme.axis, 1);
    addText(slide, theme, `memory-tick-label-${tick}`, String(tick), { left: x - 12, top: 595, width: 24, height: 20 }, "chart", { color: theme.muted, bold: false, alignment: "center", wrap: "none" });
  }

  // Flat explanation column: short titled groups, normal-weight support copy.
  addLine(slide, "explanation-divider", 840, 197, 0, 388, theme.axis, 1);
  addText(slide, theme, "recommendation-heading", "推荐分批处理", { left: 875, top: 197, width: 300, height: 28 }, "local", { color: theme.primaryDark, wrap: "none" });
  addText(slide, theme, "recommendation-body", "先过 4.0 GB 门槛，再看耗时。\n分批处理峰值 3.6 GB，满足上限；\n相对串行处理少 50 秒/批，\n余量 0.4 GB。", { left: 875, top: 239, width: 350, height: 104 }, "body", { bold: false });
  addText(slide, theme, "parallel-heading", "并行处理为何不适用", { left: 875, top: 371, width: 300, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "parallel-body", "45 秒/批虽最快，但峰值内存 7.4 GB，\n超过本机上限 3.4 GB；\n本机不能通过关闭必需任务扩容。", { left: 875, top: 413, width: 350, height: 100 }, "body", { bold: false });
  addText(slide, theme, "test-status", "三种方式均完整处理，未发生失败。", { left: 875, top: 535, width: 350, height: 52 }, "chart", { color: theme.muted, bold: false });

  addText(slide, theme, "next-step-heading", "下一轮", { left: 55, top: 616, width: 120, height: 24 }, "local", { wrap: "none" });
  addText(slide, theme, "next-step-body", "仅在这台工作站、这组固定批次上做受控试运行并记录峰值；其他批次与硬件未验证，不视为正式部署。", { left: 175, top: 616, width: 1015, height: 26 }, "body", { bold: false, wrap: "none" });
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
