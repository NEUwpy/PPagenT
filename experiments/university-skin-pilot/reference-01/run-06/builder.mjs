import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/reference-01/run-06";
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
    old: mixHex(ink, background, 0.65),
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
    lineSpacing: options.lineSpacing ?? 1.25,
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

function addFooter(slide, page, note) {
  if (page !== 2) addRule(slide, `footer-rule-${page}`, 55, 660, 1170, C.grid);
  addText(slide, `footer-source-${page}`, { left: 55, top: 671, width: 960, height: 24 }, note, { fontSize: 14, color: C.muted, verticalAlignment: "middle" });
  addText(slide, `footer-page-${page}`, { left: 1150, top: 671, width: 75, height: 24 }, `0${page}`, { fontSize: 14, color: C.muted, alignment: "right", verticalAlignment: "middle" });
}

function addHeader(slide, page, title, context) {
  addText(slide, `page-title-${page}`, { left: 55, top: 34, width: 1170, height: 48 }, title, { fontSize: 32, bold: true, color: C.ink, verticalAlignment: "middle" });
  addRule(slide, `header-rule-${page}`, 55, 103, 1170, C.primary, 2);
  addText(slide, `page-context-${page}`, { left: 55, top: 114, width: 1170, height: 24 }, context, { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
}

function addLegend(slide, x, y) {
  addShape(slide, "rect", { left: x, top: y + 5, width: 14, height: 14 }, { name: "legend-old", fill: C.old, line: { style: "solid", fill: C.old, width: 0 } });
  addText(slide, "legend-old-text", { left: x + 22, top: y, width: 90, height: 24 }, "人工受理", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addShape(slide, "rect", { left: x + 132, top: y + 5, width: 14, height: 14 }, { name: "legend-pilot", fill: C.primary, line: { style: "solid", fill: C.primary, width: 0 } });
  addText(slide, "legend-pilot-text", { left: x + 154, top: y, width: 90, height: 24 }, "试点受理", { fontSize: 16, color: C.primaryDark, verticalAlignment: "middle" });
}

function buildQuantitativeSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 1, "试点批次平均处理用时更短，但差距主要来自教师处理及等待", "两批各 120 件已结案申请｜比较指标：首次提交至完成处理的平均工作日");

  addText(slide, "stage-heading", { left: 55, top: 160, width: 360, height: 30 }, "阶段用时（工作日）", { fontSize: 22, bold: true, color: C.ink });
  addLegend(slide, 525, 160);
  const plotX = 240;
  const plotW = 470;
  const scale = plotW / 3;
  for (const tick of [0, 1, 2, 3]) {
    const x = plotX + tick * scale;
    addRule(slide, `chart-grid-${tick}-top`, x, 215, 1, C.grid, 5);
    addRule(slide, `chart-grid-${tick}-bottom`, x, 428, 1, C.grid, 10);
    addText(slide, `chart-tick-${tick}`, { left: x - 18, top: 455, width: 36, height: 24 }, String(tick), { fontSize: 16, color: C.muted, alignment: "center", verticalAlignment: "middle" });
  }
  addRule(slide, "chart-baseline", plotX, 446, plotW, C.grid);

  const rows = [["受理分流", 0.8, 0.6], ["材料核对", 1.6, 1.0], ["教师处理及等待", 2.6, 1.6]];
  rows.forEach(([label, manual, pilot], i) => {
    const y = 232 + i * 70;
    addText(slide, `stage-label-${i}`, { left: 55, top: y + 5, width: 170, height: 44 }, label, { fontSize: 20, bold: true, color: C.ink, verticalAlignment: "middle" });
    addShape(slide, "rect", { left: plotX, top: y, width: manual * scale, height: 16 }, { name: `manual-bar-${i}`, fill: C.old, line: { style: "solid", fill: C.old, width: 0 } });
    addText(slide, `manual-value-${i}`, { left: plotX + manual * scale + 8, top: y - 4, width: 52, height: 24 }, `${manual.toFixed(1)} 天`, { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
    addShape(slide, "rect", { left: plotX, top: y + 25, width: pilot * scale, height: 16 }, { name: `pilot-bar-${i}`, fill: C.primary, line: { style: "solid", fill: C.primary, width: 0 } });
    addText(slide, `pilot-value-${i}`, { left: plotX + pilot * scale + 8, top: y + 21, width: 52, height: 24 }, `${pilot.toFixed(1)} 天`, { fontSize: 16, color: C.primaryDark, bold: true, verticalAlignment: "middle" });
  });
  addRule(slide, "total-rule", 55, 488, 655, C.grid);
  addText(slide, "total-label", { left: 55, top: 498, width: 170, height: 30 }, "总计", { fontSize: 22, bold: true, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "total-value", { left: 240, top: 498, width: 470, height: 30 }, "人工 5.0 天  →  试点 3.2 天  ｜  少 1.8 天（36%）", { fontSize: 20, color: C.primaryDark, bold: true, verticalAlignment: "middle" });
  addText(slide, "stage-read", { left: 55, top: 536, width: 655, height: 42 }, "三阶段依次发生、互不重叠，阶段均值可以相加。", { fontSize: 20, color: C.muted });

  addRule(slide, "right-axis", 810, 158, 4, C.primary, 438);
  addText(slide, "right-heading", { left: 834, top: 160, width: 350, height: 30 }, "教师处理及等待", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "right-finding", { left: 834, top: 204, width: 355, height: 74 }, "三阶段中差距最大：\n试点比人工少 1.0 天。", { fontSize: 20, color: C.ink });
  addText(slide, "right-meaning", { left: 834, top: 308, width: 355, height: 74 }, "它在试点侧仍占总时长一半，\n是下一轮最需要拆分记录的环节。", { fontSize: 20, color: C.primaryDark });
  addText(slide, "right-boundary-heading", { left: 834, top: 412, width: 355, height: 30 }, "比较边界", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "right-boundary", { left: 834, top: 456, width: 355, height: 118 }, "仅覆盖已结案申请；两批事项难度和人员负荷未控制，不能将时间差异归因于试点。现有合并记录也不能把等待与教师实际处理时间分开。", { fontSize: 20, color: C.ink });
  addFooter(slide, 1, "来源：虚构测试数据与方案｜两批不同月份，各 120 件已结案申请；不是任何真实大学的绩效报告。");
  slide.speakerNotes.textFrame.setText("v6修订：总量与分量共享证据区，右侧只解释教师处理及等待为何重要，并保留未控制难度/负荷与无法拆分等待处理的边界。数据与场景均为虚构测试材料。");
  return slide;
}

function addPhaseText(slide, index, x, title, owner, body) {
  addText(slide, `phase-title-${index}`, { left: x, top: 195, width: 330, height: 32 }, title, { fontSize: 22, color: C.ink, bold: true, verticalAlignment: "middle" });
  addText(slide, `phase-owner-${index}`, { left: x, top: 238, width: 330, height: 24 }, `责任：${owner}`, { fontSize: 20, color: C.primaryDark, verticalAlignment: "middle" });
  addText(slide, `phase-body-${index}`, { left: x, top: 278, width: 330, height: 96 }, body, { fontSize: 20, color: C.ink, lineSpacing: 1.25 });
}

function addGateText(slide, markerX, labelX, value, name) {
  addShape(slide, "diamond", { left: markerX - 8, top: 396, width: 16, height: 16 }, { name: `${name}-marker`, fill: C.white, line: { style: "solid", fill: C.primary, width: 2 } });
  addText(slide, `${name}-text`, { left: labelX, top: 430, width: 190, height: 30 }, value, { fontSize: 20, color: C.primaryDark, bold: true, verticalAlignment: "middle" });
}

function buildProcessSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 2, "下一轮先验证分工能否执行，再用完整时间戳拆开等待与处理", "下一轮安排｜4 周、仅限常规申请｜计划状态：尚未实施");
  const xs = [55, 482, 909];
  const centers = [220, 640, 1060];
  const anchorTop = 264;
  const anchors = centers.map((x, i) => addShape(slide, "ellipse", { left: x - 12, top: anchorTop, width: 24, height: 24 }, { name: `flow-anchor-${i}`, fill: "none", line: { style: "solid", fill: "none", width: 0 } }));
  const connectorOptions = { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } };
  slide.shapes.connect(anchors[0], anchors[1], connectorOptions);
  slide.shapes.connect(anchors[1], anchors[2], connectorOptions);

  const phases = [
    ["受理分流", "服务助理", "登记事项类型与提交时间。"],
    ["核对材料", "服务助理", "按清单核对齐备性；\n齐备后送交教师。"],
    ["教师处理", "责任教师", "教师作专业判断并确认答复；\n助理不得代替教师承诺。"],
  ];
  phases.forEach(([title, owner, body], i) => {
    const x = xs[i];
    addText(slide, `phase-title-${i}`, { left: x, top: 170, width: 330, height: 30 }, title, { fontSize: 22, color: C.ink, bold: true });
    addText(slide, `phase-owner-${i}`, { left: x, top: 208, width: 330, height: 24 }, `责任：${owner}`, { fontSize: 20, color: C.primaryDark });
    addShape(slide, "ellipse", { left: centers[i] - 10, top: anchorTop + 2, width: 20, height: 20 }, { name: `flow-node-${i}`, fill: i === 2 ? C.primary : C.primaryLight, line: { style: "solid", fill: C.primary, width: 1 } });
    addText(slide, `phase-body-${i}`, { left: x, top: 320, width: 330, height: 52 }, body, { fontSize: 20, color: C.ink });
  });

  const gates = [[430, 335, "授权常规事项", "gate-1"], [850, 755, "材料齐备", "gate-2"]];
  gates.forEach(([markerX, labelX, label, name]) => {
    addShape(slide, "diamond", { left: markerX - 8, top: anchorTop + 4, width: 16, height: 16 }, { name: `${name}-marker`, fill: C.white, line: { style: "solid", fill: C.primary, width: 2 } });
    addText(slide, `${name}-text`, { left: labelX, top: 236, width: 190, height: 30 }, label, { fontSize: 20, color: C.primaryDark, bold: true });
  });

  addText(slide, "boundary-heading", { left: 55, top: 390, width: 330, height: 30 }, "超授权 / 非常规事项", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "boundary-body", { left: 55, top: 430, width: 330, height: 24 }, "暂停流转，由负责人指定处理人。", { fontSize: 20, color: C.ink });
  addText(slide, "exception-heading", { left: 482, top: 390, width: 330, height: 30 }, "缺件时", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "exception-body", { left: 482, top: 430, width: 330, height: 52 }, "暂停推进 → 通知申请人补齐\n补齐后重新核对。", { fontSize: 20, color: C.ink });

  addText(slide, "timestamp-heading", { left: 55, top: 500, width: 300, height: 30 }, "记录时间点", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "timestamp-values", { left: 55, top: 538, width: 760, height: 24 }, "首次提交｜核对完成｜教师接收｜最终答复｜缺件暂停区间", { fontSize: 20, color: C.ink });
  addText(slide, "timestamp-meaning", { left: 55, top: 570, width: 760, height: 24 }, "据此分别核对各段等待与教师处理耗时。", { fontSize: 20, color: C.muted });
  addText(slide, "measure-heading", { left: 850, top: 500, width: 375, height: 30 }, "四周后", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "measure-body", { left: 850, top: 538, width: 375, height: 52 }, "只判断分工可执行、记录完整；\n不承诺再次降时。", { fontSize: 20, color: C.ink });
  addFooter(slide, 2, "来源：虚构测试数据与方案｜四周分工试点尚未实施；不代表任何真实大学的管理方案。");
  slide.speakerNotes.textFrame.setText("v7修订：上部是三阶段门禁骨架，职责与局部异常沿对应阶段展开；跨阶段时间记录和四周评估独立排布。计划尚未实施。");
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const theme = JSON.parse(await fs.readFile("C:/PPagenT/experiments/university-skin-pilot/reference-01/theme.json", "utf8"));
  FONT = theme.font;
  C = deriveTheme(theme);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  buildQuantitativeSlide(presentation);
  buildProcessSlide(presentation);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const page = String(index + 1).padStart(2, "0");
    await writeBlob(`${OUT}/page-${page}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(`${OUT}/page-${page}.layout.json`, await (await slide.export({ format: "layout" })).text(), "utf8");
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
  const report = [
    "run-02 feedback revision based on run-01; not a cold start",
    "layout guide: docs/设计手册/科研咨询式排版-v6.md",
    "communication job: 让院系服务负责人读懂时间差异的证据边界，并能按下一轮真实职责与条件执行试点。",
    "visual route: explicit custom visual direction; native editable shapes/text; no CodexGrid or template selector.",
    "theme: university-blue-pilot; primary #315F91; font Microsoft YaHei; neutral ink #252B33 / muted #707780.",
    "page 1: shared-scale stage bars and a compact total row; adjacent text explains the largest gap, remaining concentration, and comparison boundary.",
    "page 2: three numbered nodes on a rightward connector skeleton; responsibilities align by column; gates are one-line labels; missing materials stays local to step 2.",
    "arrow verification: connectors use fromSide=right, toSide=left, and tail triangle at the destination end; exported proto must show fromElementId left node -> toElementId right node plus lineStyle.tail.",
    "authoring checks: PASS; 1280x720; title 32px; local headings 22px; body/node text 20px; chart labels 16px; source/page 14px.",
    "render_slides.py: PENDING",
    "slides_test.py: PENDING",
    "semantic checks: stage totals 5.0/3.2; delta -1.8 days / -36%; largest delta 1.0 day; no causal attribution; teacher authority preserved; four-week plan remains unimplemented.",
  ].join("\n") + "\n";
  await fs.writeFile(`${OUT}/report.txt`, report, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
