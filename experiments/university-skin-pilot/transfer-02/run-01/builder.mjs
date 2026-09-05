import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/transfer-02/run-01";
const NODE_MODULES = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";

const C = {
  blue: "#315F91",
  blueDark: "#23486F",
  bluePale: "#EAF1F7",
  blueSoft: "#C4D1DE",
  blueMid: "#8EA6BD",
  ink: "#252B33",
  muted: "#707780",
  line: "#D7DDE3",
  light: "#F5F7F9",
  white: "#FFFFFF",
};

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, position, fontSize, color = C.ink, bold = false, options = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize,
    color,
    bold,
    typeface: "Microsoft YaHei",
    lineSpacing: options.lineSpacing ?? 1.18,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    autoFit: "none",
    wrap: options.wrap ?? "square",
    insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addRule(slide, name, left, top, width, color = C.line, lineWidth = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width: lineWidth },
  });
}

function addSurface(slide, name, position, fill, line = C.line, radius = 12) {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = C.white;

  // Header: one short judgement, then the common test frame.
  addText(slide, "title", "4.0 GB 上限下，先筛内存，再选分批处理", { left: 55, top: 36, width: 1170, height: 46 }, 32, C.ink, true, { wrap: "none" });
  addText(slide, "test-frame", "同一工作站 × 同一套 100 批次 × 固定线程参数｜单批耗时报告中位数，内存报告全程峰值", { left: 55, top: 91, width: 1170, height: 24 }, 16, C.muted, false, { wrap: "none" });
  addRule(slide, "header-rule", 55, 131, 1170, C.blue, 2);

  // Main evidence column.
  addText(slide, "evidence-heading", "两项指标，共享三种运行方式", { left: 55, top: 154, width: 500, height: 28 }, 22, C.ink, true, { wrap: "none" });
  addText(slide, "evidence-note", "三种方式均完整处理固定批次，未发生处理失败", { left: 55, top: 187, width: 700, height: 22 }, 16, C.muted, false, { wrap: "none" });

  addText(slide, "time-label", "单批耗时中位数（秒）", { left: 55, top: 218, width: 330, height: 24 }, 20, C.ink, true, { wrap: "none" });
  slide.charts.add("bar", {
    name: "time-chart",
    position: { left: 55, top: 247, width: 800, height: 142 },
    categories: ["串行处理", "分批处理", "并行处理"],
    series: [{
      name: "单批耗时中位数",
      values: [120, 70, 45],
      fill: C.blueMid,
      points: [
        { idx: 0, fill: C.blueSoft },
        { idx: 1, fill: C.blue },
        { idx: 2, fill: C.blueSoft },
      ],
    }],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 58 },
    chartFill: C.white,
    chartLine: { style: "solid", fill: "none", width: 0 },
    plotAreaFill: C.white,
    plotAreaLine: { style: "solid", fill: "none", width: 0 },
    xAxis: {
      min: 0,
      max: 120,
      majorUnit: 30,
      textStyle: { fontSize: 14, fill: C.muted },
      line: { style: "solid", fill: C.line, width: 1 },
      majorGridlines: { style: "solid", fill: C.line, width: 1 },
    },
    yAxis: {
      textStyle: { fontSize: 16, fill: C.ink },
      line: { style: "solid", fill: "none", width: 0 },
      majorGridlines: null,
    },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 16, fill: C.ink, bold: true } },
  });

  addText(slide, "memory-label", "全程峰值内存（GB）", { left: 55, top: 409, width: 330, height: 24 }, 20, C.ink, true, { wrap: "none" });
  slide.charts.add("bar", {
    name: "memory-chart",
    position: { left: 55, top: 438, width: 800, height: 142 },
    categories: ["串行处理", "分批处理", "并行处理"],
    series: [{
      name: "全程峰值内存",
      values: [2.0, 3.6, 7.4],
      fill: C.blueMid,
      points: [
        { idx: 0, fill: C.blueSoft },
        { idx: 1, fill: C.blue },
        { idx: 2, fill: C.blueSoft },
      ],
    }],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 58 },
    chartFill: C.white,
    chartLine: { style: "solid", fill: "none", width: 0 },
    plotAreaFill: C.white,
    plotAreaLine: { style: "solid", fill: "none", width: 0 },
    xAxis: {
      min: 0,
      max: 8,
      majorUnit: 2,
      numberFormatCode: "0.0",
      textStyle: { fontSize: 14, fill: C.muted },
      line: { style: "solid", fill: C.line, width: 1 },
      majorGridlines: { style: "solid", fill: C.line, width: 1 },
    },
    yAxis: {
      textStyle: { fontSize: 16, fill: C.ink },
      line: { style: "solid", fill: "none", width: 0 },
      majorGridlines: null,
    },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 16, fill: C.ink, bold: true } },
  });
  addText(slide, "chart-reading-note", "主色标出候选方案；其余颜色保留为对照。两张图的行顺序一致，便于先看门槛、再看速度。", { left: 55, top: 596, width: 800, height: 24 }, 14, C.muted, false, { wrap: "none" });

  // Decision column: one continuous bounded surface, not a card grid.
  addSurface(slide, "decision-surface", { left: 900, top: 154, width: 325, height: 470 }, C.bluePale, C.blueSoft, 10);
  addText(slide, "decision-kicker", "本轮试运行建议", { left: 925, top: 181, width: 250, height: 26 }, 20, C.blueDark, true, { wrap: "none" });
  addText(slide, "decision-choice", "分批处理", { left: 925, top: 216, width: 250, height: 40 }, 28, C.blue, true, { wrap: "none" });
  addText(slide, "decision-gate", "先过内存门槛：峰值 3.6 GB ≤ 4.0 GB", { left: 925, top: 263, width: 270, height: 42 }, 18, C.ink, true, { wrap: "square" });
  addRule(slide, "decision-rule-1", 925, 320, 270, C.blueSoft, 1);
  addText(slide, "decision-speed", "相对当前串行处理", { left: 925, top: 338, width: 220, height: 22 }, 18, C.muted, false, { wrap: "none" });
  addText(slide, "decision-speed-value", "120 − 70 = 50 秒/批更快", { left: 925, top: 365, width: 270, height: 30 }, 20, C.ink, true, { wrap: "none" });
  addText(slide, "decision-headroom", "剩余内存空间：4.0 − 3.6 = 0.4 GB", { left: 925, top: 403, width: 270, height: 28 }, 18, C.ink, true, { wrap: "none" });
  addRule(slide, "decision-rule-2", 925, 449, 270, C.blueSoft, 1);
  addText(slide, "parallel-title", "为何不选最快的并行处理？", { left: 925, top: 467, width: 275, height: 28 }, 18, C.ink, true, { wrap: "none" });
  addText(slide, "parallel-explain", "45 秒/批虽最快，但峰值 7.4 GB，超过上限 3.4 GB；本机不能通过关闭必需任务来扩容。", { left: 925, top: 501, width: 270, height: 66 }, 16, C.ink, false, { lineSpacing: 1.22 });

  addText(slide, "boundary", "边界：仅验证这台工作站与这组固定批次。下一轮做受控试运行并记录峰值；不承诺所有数据保持当前耗时，也不视为正式部署。", { left: 55, top: 636, width: 1140, height: 25 }, 14, C.muted, false, { wrap: "none" });
  addText(slide, "source", "来源：虚构测试数据｜设计验证素材，非真实算法性能报告", { left: 55, top: 674, width: 900, height: 18 }, 14, C.muted, false, { wrap: "none" });
  addText(slide, "page-number", "01", { left: 1170, top: 674, width: 55, height: 18 }, 14, C.muted, false, { alignment: "right", wrap: "none" });

  slide.speakerNotes.textFrame.setText("[Sources]\n- No external sources. All values and conditions are from the user-provided manuscript and are explicitly labeled as fictional test data.\n[/Sources]");
  slide.speakerNotes.setVisible(true);

  await writeBlob(`${OUT}/slide-01.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${OUT}/slide-01.layout.json`, await (await slide.export({ format: "layout" })).text());
  await writeBlob(`${OUT}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,chart,notes", maxChars: 20000 });
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
