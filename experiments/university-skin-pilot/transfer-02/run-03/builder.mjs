import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/transfer-02/run-03";
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
  const sizes = { title: 32, local: 22, body: 20, chart: 16, source: 14 };
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

function addLine(slide, name, left, top, width, height, color, lineWidth = 1) {
  return slide.shapes.add({ geometry: "line", name, position: { left, top, width, height }, fill: "none", line: { style: "solid", fill: color, width: lineWidth } });
}

function addRect(slide, name, position, fill) {
  return slide.shapes.add({ geometry: "rect", name, position, fill, line: { style: "solid", fill: "none", width: 0 } });
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
    barMuted: blend(primary, background, 0.46),
    axis: blend(themeInput.neutral.ink, background, 0.80),
    track: blend(themeInput.neutral.ink, background, 0.93),
  };

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = theme.background;

  addText(slide, theme, "title", `在 4.0${NBSP}GB 上限下，分批处理是下一轮试运行的可行选择`, { left: 55, top: 36, width: 1170, height: 46 }, "title", { wrap: "none" });
  addText(slide, theme, "method-line", "同一台工作站、100 个固定数据批次、固定输入顺序与线程参数；三种方式均完整处理", { left: 55, top: 91, width: 1170, height: 24 }, "chart", { color: theme.muted, bold: false, wrap: "none" });
  addLine(slide, "header-rule", 55, 131, 1170, 0, theme.primary, 2);

  addText(slide, theme, "time-heading", `单批耗时中位数（秒）`, { left: 55, top: 154, width: 390, height: 28 }, "local", { wrap: "none" });
  // Artifact Tool renders horizontal bar categories bottom-to-top, so the input is reversed
  // to make the visible order match the memory comparison below: 串行 → 分批 → 并行.
  slide.charts.add("bar", {
    position: { left: 55, top: 190, width: 745, height: 158 },
    categories: ["并行处理", "分批处理", "串行处理"],
    series: [{
      name: "单批耗时中位数",
      values: [45, 70, 120],
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

  addText(slide, theme, "memory-heading", `全程峰值内存（GB）`, { left: 55, top: 373, width: 390, height: 28 }, "local", { wrap: "none" });

  // A fully editable memory plot keeps the threshold on the real 0–8 GB scale.
  const plotLeft = 215;
  const plotWidth = 560;
  const thresholdX = plotLeft + plotWidth * (4.0 / 8.0);
  const methods = [
    { name: "串行处理", value: 2.0, y: 435, fill: theme.primarySoft, labelColor: theme.ink },
    { name: "分批处理", value: 3.6, y: 481, fill: theme.primary, labelColor: theme.background },
    { name: "并行处理", value: 7.4, y: 527, fill: theme.primarySoft, labelColor: theme.ink },
  ];
  for (const method of methods) {
    addText(slide, theme, `memory-label-${method.name}`, method.name, { left: 55, top: method.y - 3, width: 125, height: 24 }, "chart", { color: theme.ink, bold: false, wrap: "none" });
    addRect(slide, `memory-track-${method.name}`, { left: plotLeft, top: method.y, width: plotWidth, height: 18 }, theme.track);
    const barWidth = plotWidth * (method.value / 8.0);
    addRect(slide, `memory-bar-${method.name}`, { left: plotLeft, top: method.y, width: barWidth, height: 18 }, method.fill);
    // All data labels use the same right-aligned, in-bar placement at the bar end.
    addText(slide, theme, `memory-value-${method.name}`, method.value.toFixed(1), { left: plotLeft + barWidth - 42, top: method.y - 3, width: 38, height: 24 }, "chart", { color: method.labelColor, bold: false, alignment: "right", wrap: "none" });
  }

  // Add the threshold after the tracks and bars so it remains visible above the data layer.
  addLine(slide, "memory-threshold", thresholdX, 414, 0, 143, theme.primary, 2);
  addText(slide, theme, "threshold-label", `4.0${NBSP}GB 上限`, { left: thresholdX + 6, top: 389, width: 110, height: 20 }, "chart", { color: theme.primaryDark, bold: false, alignment: "left", wrap: "none" });
  addLine(slide, "memory-axis", plotLeft, 568, plotWidth, 0, theme.axis, 1);
  for (const tick of [0, 2, 4, 6, 8]) {
    const x = plotLeft + plotWidth * (tick / 8);
    addLine(slide, `memory-tick-${tick}`, x, 568, 0, 6, theme.axis, 1);
    addText(slide, theme, `memory-tick-label-${tick}`, String(tick), { left: x - 12, top: 578, width: 24, height: 20 }, "chart", { color: theme.muted, bold: false, alignment: "center", wrap: "none" });
  }

  // Open explanation column. Its text adds meaning and limits without reciting the chart.
  addLine(slide, "explanation-divider", 840, 154, 0, 430, theme.axis, 1);
  addText(slide, theme, "recommendation-heading", "推荐分批处理", { left: 875, top: 154, width: 350, height: 28 }, "local", { color: theme.primaryDark, wrap: "none" });
  addText(slide, theme, "recommendation-body", `先满足内存条件；仍有 0.4${NBSP}GB 余量。\n相对串行处理，单批少 50${NBSP}秒。`, { left: 875, top: 198, width: 350, height: 72 }, "body", { bold: false });
  addText(slide, theme, "parallel-heading", "并行处理不适用", { left: 875, top: 316, width: 350, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "parallel-body", `速度优势无法抵消 3.4${NBSP}GB 的超限；\n本机不能通过关闭必需任务扩容。`, { left: 875, top: 360, width: 350, height: 72 }, "body", { bold: false });
  addText(slide, theme, "test-status", "三种方式均完整处理，未发生失败。", { left: 875, top: 468, width: 350, height: 24 }, "chart", { color: theme.muted, bold: false, wrap: "none" });

  addText(slide, theme, "next-step-heading", "下一轮", { left: 55, top: 616, width: 120, height: 28 }, "local", { wrap: "none" });
  addText(slide, theme, "next-step-body", "仅在本机与这组固定批次上受控试运行并记录峰值；其他批次与硬件未验证，不视为正式部署。", { left: 175, top: 616, width: 1015, height: 26 }, "body", { bold: false, wrap: "none" });
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
