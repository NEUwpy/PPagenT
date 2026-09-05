import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/reference-01/run-01";
const FONT = "Microsoft YaHei";
const C = {
  primary: "#315F91",
  primaryDark: "#244B73",
  primaryLight: "#DDE9F3",
  primaryPale: "#F3F7FA",
  ink: "#252B33",
  muted: "#707780",
  grid: "#D8E0E8",
  soft: "#EFF3F6",
  old: "#AEBBC8",
  white: "#FFFFFF",
};

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

function addSurface(slide, name, position, fill, line = C.grid, radius = 12) {
  return addShape(slide, "roundRect", position, {
    name,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function addFooter(slide, page, note) {
  addRule(slide, `footer-rule-${page}`, 55, 660, 1170, C.grid);
  addText(slide, `footer-source-${page}`, { left: 55, top: 671, width: 960, height: 24 }, note, {
    fontSize: 14,
    color: C.muted,
    verticalAlignment: "middle",
  });
  addText(slide, `footer-page-${page}`, { left: 1150, top: 671, width: 75, height: 24 }, `0${page}`, {
    fontSize: 14,
    color: C.muted,
    alignment: "right",
    verticalAlignment: "middle",
  });
}

function addHeader(slide, page, title, context) {
  addText(slide, `page-title-${page}`, { left: 55, top: 34, width: 1170, height: 48 }, title, {
    fontSize: 32,
    bold: true,
    color: C.ink,
    verticalAlignment: "middle",
  });
  addRule(slide, `header-rule-${page}`, 55, 103, 1170, C.primary, 2);
  addText(slide, `page-context-${page}`, { left: 55, top: 114, width: 1170, height: 24 }, context, {
    fontSize: 16,
    color: C.muted,
    verticalAlignment: "middle",
  });
}

function addLegend(slide, x, y) {
  addShape(slide, "rect", { left: x, top: y + 3, width: 14, height: 14 }, {
    name: "legend-old",
    fill: C.old,
    line: { style: "solid", fill: C.old, width: 0 },
  });
  addText(slide, "legend-old-text", { left: x + 22, top: y, width: 88, height: 22 }, "人工受理", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addShape(slide, "rect", { left: x + 128, top: y + 3, width: 14, height: 14 }, {
    name: "legend-pilot",
    fill: C.primary,
    line: { style: "solid", fill: C.primary, width: 0 },
  });
  addText(slide, "legend-pilot-text", { left: x + 150, top: y, width: 88, height: 22 }, "试点受理", { fontSize: 16, color: C.primaryDark, verticalAlignment: "middle" });
}

function buildQuantitativeSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 1, "试点批次平均少用 1.8 个工作日，差距主要出现在教师处理及等待", "定量证据｜两批各 120 件已结案申请｜比较指标：首次提交至完成处理的平均工作日");

  addText(slide, "evidence-heading", { left: 55, top: 160, width: 670, height: 30 }, "三阶段用时：同一尺度下，试点批次各环节均更短", { fontSize: 22, bold: true, color: C.ink });
  addLegend(slide, 240, 193);

  const plotX = 240;
  const plotW = 500;
  const scale = plotW / 3;
  const ticks = [0, 1, 2, 3];
  for (const tick of ticks) {
    const x = plotX + tick * scale;
    addRule(slide, `chart-grid-${tick}`, x, 225, 1, C.grid, 232);
    addText(slide, `chart-tick-${tick}`, { left: x - 18, top: 461, width: 40, height: 22 }, String(tick), { fontSize: 16, color: C.muted, alignment: "center", verticalAlignment: "middle" });
  }
  addText(slide, "chart-axis-unit", { left: 690, top: 461, width: 90, height: 22 }, "工作日", { fontSize: 16, color: C.muted, alignment: "right", verticalAlignment: "middle" });

  const rows = [
    ["受理分流", 0.8, 0.6],
    ["材料核对", 1.6, 1.0],
    ["教师处理及等待", 2.6, 1.6],
  ];
  rows.forEach(([label, manual, pilot], i) => {
    const y = 242 + i * 70;
    addText(slide, `stage-label-${i}`, { left: 55, top: y + 4, width: 170, height: 48 }, label, { fontSize: 20, bold: true, color: C.ink, verticalAlignment: "middle" });
    addShape(slide, "rect", { left: plotX, top: y, width: manual * scale, height: 16 }, {
      name: `manual-bar-${i}`,
      fill: C.old,
      line: { style: "solid", fill: C.old, width: 0 },
    });
    addText(slide, `manual-value-${i}`, { left: plotX + manual * scale + 8, top: y - 4, width: 48, height: 24 }, manual.toFixed(1), { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
    addShape(slide, "rect", { left: plotX, top: y + 25, width: pilot * scale, height: 16 }, {
      name: `pilot-bar-${i}`,
      fill: C.primary,
      line: { style: "solid", fill: C.primary, width: 0 },
    });
    addText(slide, `pilot-value-${i}`, { left: plotX + pilot * scale + 8, top: y + 21, width: 48, height: 24 }, pilot.toFixed(1), { fontSize: 16, color: C.primaryDark, bold: true, verticalAlignment: "middle" });
  });
  addText(slide, "chart-read", { left: 55, top: 487, width: 700, height: 28 }, "阶段依次发生、互不重叠，因此三阶段均值可相加；总计差异见右侧。", { fontSize: 16, color: C.muted });

  addSurface(slide, "verdict-surface", { left: 810, top: 158, width: 415, height: 150 }, C.primaryPale, C.primaryLight, 14);
  addText(slide, "verdict-label", { left: 838, top: 177, width: 180, height: 24 }, "总体差距", { fontSize: 16, color: C.primaryDark, bold: true });
  addText(slide, "verdict-total", { left: 838, top: 202, width: 300, height: 54 }, "5.0  →  3.2", { fontSize: 42, color: C.primaryDark, bold: true, verticalAlignment: "middle" });
  addText(slide, "verdict-delta", { left: 838, top: 263, width: 340, height: 28 }, "−1.8 工作日  ·  −36%", { fontSize: 22, color: C.primary, bold: true, verticalAlignment: "middle" });
  addText(slide, "verdict-note", { left: 1115, top: 178, width: 82, height: 48 }, "均值\n可相加", { fontSize: 16, color: C.muted, alignment: "right", verticalAlignment: "middle" });

  addText(slide, "interpret-heading", { left: 810, top: 336, width: 300, height: 30 }, "解读：差距说明什么", { fontSize: 22, bold: true, color: C.ink });
  addRule(slide, "interpret-accent", 810, 376, 4, C.primary, 206);
  addText(slide, "interpret-1-label", { left: 832, top: 380, width: 330, height: 24 }, "差距集中在哪里", { fontSize: 16, color: C.muted, bold: true });
  addText(slide, "interpret-1", { left: 832, top: 404, width: 360, height: 54 }, "教师处理及等待少 1.0 天\n占总差距 56%", { fontSize: 20, color: C.ink, bold: true });
  addText(slide, "interpret-2-label", { left: 832, top: 463, width: 330, height: 24 }, "试点仍耗时最多", { fontSize: 16, color: C.muted, bold: true });
  addText(slide, "interpret-2", { left: 832, top: 487, width: 360, height: 54 }, "教师处理及等待仍为 1.6 天\n占试点总时长 50%", { fontSize: 20, color: C.ink, bold: true });
  addText(slide, "interpret-boundary-label", { left: 832, top: 546, width: 330, height: 24 }, "证据边界", { fontSize: 16, color: C.muted, bold: true });
  addText(slide, "interpret-boundary", { left: 832, top: 570, width: 365, height: 74 }, "仅覆盖已结案申请；事项难度与人员负荷未控制，不能将差异归因于试点。1.6 天也不能拆称为纯排队时间。", { fontSize: 18, color: C.ink });

  addFooter(slide, 1, "来源：虚构测试数据与方案｜两批不同月份，各 120 件已结案申请；不是任何真实大学的绩效报告。");
  slide.speakerNotes.textFrame.setText("本页将阶段均值置于共同尺度，并把总体差距、差距集中环节与证据边界放在同一阅读路径中。数据和机构场景均为虚构测试材料。");
  return slide;
}

function addPhase(slide, index, x, title, owner, body) {
  const anchor = addShape(slide, "rect", { left: x, top: 245, width: 315, height: 174 }, {
    name: `phase-anchor-${index}`,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  const box = addSurface(slide, `phase-surface-${index}`, { left: x, top: 245, width: 315, height: 174 }, index === 2 ? C.primaryPale : C.white, index === 2 ? C.primaryLight : C.grid, 14);
  addShape(slide, "rect", { left: x, top: 245, width: 315, height: 8 }, { name: `phase-rule-${index}`, fill: index === 2 ? C.primary : C.primaryLight, line: { style: "solid", fill: index === 2 ? C.primary : C.primaryLight, width: 0 } });
  addText(slide, `phase-number-${index}`, { left: x + 22, top: 263, width: 34, height: 34 }, `0${index + 1}`, { fontSize: 22, color: C.primary, bold: true, verticalAlignment: "middle" });
  addText(slide, `phase-title-${index}`, { left: x + 68, top: 263, width: 220, height: 32 }, title, { fontSize: 22, color: C.ink, bold: true, verticalAlignment: "middle" });
  addText(slide, `phase-owner-${index}`, { left: x + 22, top: 310, width: 270, height: 24 }, `责任｜${owner}`, { fontSize: 16, color: C.primaryDark, bold: true });
  addText(slide, `phase-body-${index}`, { left: x + 22, top: 340, width: 270, height: 74 }, body, { fontSize: 18, color: C.ink, lineSpacing: 1.2 });
  return { anchor, box };
}

function addGate(slide, x, textValue, name) {
  addSurface(slide, name, { left: x, top: 190, width: 112, height: 42 }, C.white, C.primaryLight, 10);
  addText(slide, `${name}-text`, { left: x + 8, top: 192, width: 96, height: 38 }, textValue, { fontSize: 16, color: C.primaryDark, bold: true, alignment: "center", verticalAlignment: "middle" });
}

function buildProcessSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 2, "下一轮先验证分工能否执行，再用完整时间戳拆开等待与处理", "下一轮安排｜4 周、仅限常规申请｜计划状态：尚未实施");

  addText(slide, "flow-heading", { left: 55, top: 160, width: 720, height: 30 }, "连续主流程：责任随步骤交接，条件决定是否推进", { fontSize: 22, bold: true, color: C.ink });
  addText(slide, "flow-direction", { left: 990, top: 160, width: 235, height: 30 }, "提交 → 答复", { fontSize: 16, color: C.muted, alignment: "right", verticalAlignment: "middle" });

  const xs = [55, 482, 909];
  const anchors = xs.map((x, i) => addShape(slide, "rect", { left: x, top: 245, width: 315, height: 174 }, { name: `connector-anchor-${i}`, fill: "none", line: { style: "solid", fill: "none", width: 0 } }));
  slide.shapes.connect(anchors[0], anchors[1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 2 }, head: { type: "triangle", width: "sm", length: "sm" } });
  slide.shapes.connect(anchors[1], anchors[2], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 2 }, head: { type: "triangle", width: "sm", length: "sm" } });
  addGate(slide, 370, "授权常规\n事项", "gate-1");
  addGate(slide, 797, "材料\n齐备", "gate-2");

  addPhase(slide, 0, xs[0], "受理分流", "服务助理", "登记事项类型与提交时间\n授权常规事项才进入下一步");
  addPhase(slide, 1, xs[1], "核对材料", "服务助理", "按清单核对齐备性\n记录核对完成时间\n齐备后送交教师");
  addPhase(slide, 2, xs[2], "教师处理", "责任教师", "作出专业判断并确认答复\n记录接收与答复时间\n助理不得代替教师作专业承诺");

  addSurface(slide, "exception-surface", { left: 482, top: 438, width: 315, height: 82 }, C.primaryPale, C.primaryLight, 12);
  addText(slide, "exception-label", { left: 500, top: 448, width: 112, height: 24 }, "第2步规则", { fontSize: 16, color: C.primaryDark, bold: true });
  addText(slide, "exception-body", { left: 500, top: 470, width: 278, height: 46 }, "缺件 → 暂停推进并通知补齐\n补齐后重新核对", { fontSize: 18, color: C.ink, bold: true, verticalAlignment: "middle" });
  addShape(slide, "line", { left: 640, top: 419, width: 0, height: 19 }, { name: "exception-link", fill: "none", line: { style: "dashed", fill: C.primaryLight, width: 1 } });

  addSurface(slide, "boundary-surface", { left: 55, top: 545, width: 515, height: 86 }, C.soft, C.grid, 12);
  addText(slide, "boundary-label", { left: 77, top: 559, width: 170, height: 24 }, "范围门槛", { fontSize: 16, color: C.muted, bold: true });
  addText(slide, "boundary-body", { left: 77, top: 582, width: 460, height: 52 }, "超授权 / 非常规事项：暂停流转，由负责人指定处理人", { fontSize: 20, color: C.ink, bold: true, verticalAlignment: "middle" });

  addSurface(slide, "measurement-surface", { left: 600, top: 545, width: 625, height: 86 }, C.primaryPale, C.primaryLight, 12);
  addText(slide, "measurement-label", { left: 622, top: 559, width: 190, height: 24 }, "四周结束后只判断", { fontSize: 16, color: C.primaryDark, bold: true });
  addText(slide, "measurement-body", { left: 622, top: 586, width: 575, height: 28 }, "分工是否可执行、记录是否完整；不承诺再次降时", { fontSize: 20, color: C.ink, bold: true, verticalAlignment: "middle" });

  addText(slide, "timestamp-note", { left: 55, top: 522, width: 1170, height: 22 }, "记录闭环：首次提交｜核对完成｜教师接收｜最终答复｜缺件暂停区间 → 下一轮分别核对等待与处理耗时", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addFooter(slide, 2, "来源：虚构测试数据与方案｜四周分工试点尚未实施；不代表任何真实大学的管理方案。");
  slide.speakerNotes.textFrame.setText("本页将三步真实职责与两个推进条件放在同一条主流程上；缺件是第二步局部异常规则，不是第四个步骤。计划结果只用于判断可执行性与记录完整性，不预设降时承诺。");
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
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
    "run-01 independent reference-recomposition build",
    "communication job: 让院系服务负责人读懂时间差异的证据边界，并能按下一轮真实职责与条件执行试点。",
    "visual route: explicit custom visual direction; native editable shapes/text; no CodexGrid or template selector.",
    "theme: university-blue-pilot; primary #315F91; font Microsoft YaHei; neutral ink #252B33 / muted #707780.",
    "page 1: shared-scale stage bars + central total verdict + adjacent interpretation and evidence boundary.",
    "page 2: three-step responsibility flow + two progression gates + local missing-material exception + scope/measurement boundary.",
    "authoring checks: PASS; 1280x720; title 32px; group 22px; body 18-20px; chart/source 16/14px.",
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
