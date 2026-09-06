import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/reference-01/run-09";
const THEME_PATH = "C:/PPagenT/experiments/university-skin-pilot/reference-01/theme.json";
let FONT = "Microsoft YaHei";
let C = null;

function hexRgb(value) {
  const hex = String(value).replace("#", "");
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function mixHex(a, b, amount) {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const mix = (x, y) => Math.round(x * (1 - amount) + y * amount).toString(16).padStart(2, "0");
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`.toUpperCase();
}

function deriveTheme(theme) {
  const primary = theme.primaryColor;
  const ink = theme.neutral.ink;
  const muted = theme.neutral.muted;
  const background = theme.neutral.background;
  return {
    primary,
    primaryDark: mixHex(primary, ink, 0.35),
    primaryLight: mixHex(primary, background, 0.82),
    primaryPale: mixHex(primary, background, 0.94),
    ink,
    muted,
    grid: mixHex(ink, background, 0.83),
    old: mixHex(ink, background, 0.62),
    secondaryBg: mixHex(ink, background, 0.95),
    white: background,
  };
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addShape(slide, geometry, position, options = {}) {
  return slide.shapes.add({ geometry, position, ...options });
}

function addText(slide, name, position, value, options = {}) {
  const shape = addShape(slide, "textbox", position, {
    name,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    fontSize: options.fontSize ?? 20,
    color: options.color ?? C.ink,
    bold: options.bold ?? false,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    typeface: FONT,
    lineSpacing: options.lineSpacing ?? 1.18,
    wrap: options.wrap ?? "square",
    autoFit: "none",
    insets: options.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return shape;
}

function addRule(slide, name, x, y, width, color = C.grid, height = 1) {
  return addShape(slide, "rect", { left: x, top: y, width, height }, {
    name,
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function addHeader(slide) {
  addText(slide, "page-title", { left: 55, top: 34, width: 1170, height: 48 }, "两批已结案记录相差1.8个工作日，最大差距在教师处理及等待", {
    fontSize: 32,
    bold: true,
    color: C.ink,
    verticalAlignment: "middle",
  });
  addRule(slide, "header-rule", 55, 103, 1170, C.primary, 2);
  addText(slide, "page-context", { left: 55, top: 114, width: 1170, height: 24 }, "人工 vs 试点｜各120件已结案申请｜仅描述差异，不作因果归因", {
    fontSize: 16,
    color: C.muted,
    verticalAlignment: "middle",
  });
}

function addFooter(slide) {
  addRule(slide, "footer-rule", 55, 660, 1170, C.grid);
  addText(slide, "footer-source", { left: 55, top: 671, width: 1040, height: 24 }, "来源：虚构测试数据与方案｜两批来自不同月份；事项难度与人员负荷未控制；不代表任何真实大学的绩效报告。", {
    fontSize: 14,
    color: C.muted,
    verticalAlignment: "middle",
  });
  addText(slide, "footer-page", { left: 1150, top: 671, width: 75, height: 24 }, "定量", {
    fontSize: 14,
    color: C.muted,
    alignment: "right",
    verticalAlignment: "middle",
  });
}

function addLegend(slide) {
  addShape(slide, "rect", { left: 258, top: 207, width: 14, height: 14 }, { name: "legend-manual", fill: C.old, line: { style: "solid", fill: C.old, width: 0 } });
  addText(slide, "legend-manual-text", { left: 280, top: 202, width: 90, height: 24 }, "人工受理", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addShape(slide, "rect", { left: 390, top: 207, width: 14, height: 14 }, { name: "legend-pilot", fill: C.primary, line: { style: "solid", fill: C.primary, width: 0 } });
  addText(slide, "legend-pilot-text", { left: 412, top: 202, width: 90, height: 24 }, "试点受理", { fontSize: 16, color: C.primaryDark, verticalAlignment: "middle" });
}

function buildQuantitativeSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide);

  // Main evidence zone: a shared-axis comparison occupies the largest area.
  addShape(slide, "rect", { left: 55, top: 156, width: 780, height: 470 }, {
    name: "main-evidence-zone",
    fill: C.primaryPale,
    line: { style: "solid", fill: C.primaryPale, width: 0 },
  });
  addText(slide, "chart-heading", { left: 85, top: 174, width: 520, height: 24 }, "各阶段平均用时（工作日）", {
    fontSize: 22,
    bold: true,
    color: C.ink,
    verticalAlignment: "middle",
  });
  addLegend(slide);

  const plotX = 260;
  const scale = 150;
  const ticks = [0, 1, 2, 3];
  ticks.forEach((tick) => {
    const x = plotX + tick * scale;
    addRule(slide, `axis-grid-${tick}`, x, 261, 1, C.grid, 211);
    addText(slide, `axis-tick-${tick}`, { left: x - 18, top: 228, width: 36, height: 24 }, String(tick), {
      fontSize: 16,
      color: C.muted,
      alignment: "center",
      verticalAlignment: "middle",
      wrap: "none",
    });
  });
  addRule(slide, "axis-baseline", plotX, 472, 450, C.grid, 2);
  addText(slide, "axis-unit", { left: 735, top: 228, width: 55, height: 24 }, "工作日", { fontSize: 16, color: C.muted, alignment: "right", verticalAlignment: "middle" });

  const rows = [
    ["受理分流", 0.8, 0.6],
    ["材料核对", 1.6, 1.0],
    ["教师处理及等待", 2.6, 1.6],
  ];
  rows.forEach(([label, manual, pilot], i) => {
    const y = 268 + i * 72;
    addText(slide, `stage-label-${i}`, { left: 85, top: y + 10, width: 155, height: 42 }, label, { fontSize: 20, bold: true, color: C.ink, verticalAlignment: "middle" });
    addShape(slide, "rect", { left: plotX, top: y, width: manual * scale, height: 18 }, { name: `manual-bar-${i}`, fill: C.old, line: { style: "solid", fill: C.old, width: 0 } });
    const manualLabelLeft = manual <= 1.0 ? 420 : manual <= 1.6 ? 570 : 720;
    addText(slide, `manual-value-${i}`, { left: manualLabelLeft, top: y - 3, width: 60, height: 24 }, `${manual.toFixed(1)} 天`, { fontSize: 16, color: C.muted, verticalAlignment: "middle", wrap: "none" });
    addShape(slide, "rect", { left: plotX, top: y + 28, width: pilot * scale, height: 18 }, { name: `pilot-bar-${i}`, fill: C.primary, line: { style: "solid", fill: C.primary, width: 0 } });
    const pilotLabelLeft = pilot <= 1.0 ? 420 : pilot <= 1.6 ? 570 : 720;
    addText(slide, `pilot-value-${i}`, { left: pilotLabelLeft, top: y + 25, width: 60, height: 24 }, `${pilot.toFixed(1)} 天`, { fontSize: 16, color: C.primaryDark, bold: true, verticalAlignment: "middle", wrap: "none" });
  });

  addRule(slide, "total-rule", 85, 488, 680, C.grid, 1);
  addText(slide, "total-heading", { left: 85, top: 500, width: 155, height: 30 }, "总计", { fontSize: 22, bold: true, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "total-value", { left: 260, top: 500, width: 480, height: 30 }, "人工 5.0 天 → 试点 3.2 天", { fontSize: 20, bold: true, color: C.primaryDark, verticalAlignment: "middle", wrap: "none" });
  addText(slide, "total-read", { left: 85, top: 544, width: 680, height: 26 }, "三阶段依次发生、互不重叠，所以总计可相加。", { fontSize: 18, color: C.muted, verticalAlignment: "middle" });

  // Explanation zone: smaller and lower-contrast than the chart, with one emphasized delta.
  addShape(slide, "rect", { left: 875, top: 156, width: 350, height: 145 }, {
    name: "delta-zone",
    fill: C.primaryLight,
    line: { style: "solid", fill: C.primaryLight, width: 0 },
  });
  addText(slide, "delta-heading", { left: 900, top: 176, width: 260, height: 24 }, "总计差异", { fontSize: 18, bold: true, color: C.primaryDark, verticalAlignment: "middle" });
  addText(slide, "delta-value", { left: 900, top: 204, width: 300, height: 48 }, "少 1.8 天", { fontSize: 40, bold: true, color: C.primary, verticalAlignment: "middle", wrap: "none" });
  addText(slide, "delta-percent", { left: 902, top: 260, width: 300, height: 24 }, "相对人工少 36%（5.0 → 3.2）", { fontSize: 18, color: C.primaryDark, verticalAlignment: "middle", wrap: "none" });

  addShape(slide, "rect", { left: 875, top: 325, width: 350, height: 301 }, {
    name: "interpretation-zone",
    fill: C.secondaryBg,
    line: { style: "solid", fill: C.secondaryBg, width: 0 },
  });
  addRule(slide, "interpretation-rule", 900, 345, 4, C.primary, 255);
  addText(slide, "finding-heading", { left: 920, top: 342, width: 270, height: 28 }, "最大差距", { fontSize: 20, bold: true, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "finding-body", { left: 920, top: 378, width: 275, height: 60 }, "教师处理及等待：少 1.0 天\n试点仍占总时长一半。", { fontSize: 18, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "boundary-heading", { left: 920, top: 454, width: 270, height: 28 }, "读法限制", { fontSize: 20, bold: true, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "boundary-body", { left: 920, top: 488, width: 275, height: 72 }, "教师处理与等待合并\n不能把这段全部写成排队。\n难度与负荷未控制\n无随机分组，不作因果归因。", { fontSize: 16, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "decision-note", { left: 920, top: 586, width: 275, height: 24 }, "下一轮不承诺再次降时。", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });

  addFooter(slide);
  slide.speakerNotes.textFrame.setText("v8定量页：主区用共享尺度呈现三阶段人工/试点均值与总计，右侧只保留差值、最大差距和解释边界。数据来自两批不同月份的已结案申请，未控制事项难度和人员负荷，不能将差异归因于试点，也不能把教师处理及等待的1.6天全部称为排队。");
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const theme = JSON.parse(await fs.readFile(THEME_PATH, "utf8"));
  FONT = theme.font;
  C = deriveTheme(theme);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = buildQuantitativeSlide(presentation);
  await writeBlob(`${OUT}/page-01.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${OUT}/page-01.layout.json`, await (await slide.export({ format: "layout" })).text(), "utf8");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
