import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/reference-01/run-08";
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

function addFooter(slide) {
  addRule(slide, "footer-rule", 55, 660, 1170, C.grid);
  addText(slide, "footer-source", { left: 55, top: 671, width: 1040, height: 24 }, "来源：虚构测试数据与方案｜四周分工试点尚未实施；不代表任何真实大学的管理方案。", {
    fontSize: 14,
    color: C.muted,
    verticalAlignment: "middle",
  });
  addText(slide, "footer-page", { left: 1150, top: 671, width: 75, height: 24 }, "流程", {
    fontSize: 14,
    color: C.muted,
    alignment: "right",
    verticalAlignment: "middle",
  });
}

function addHeader(slide) {
  addText(slide, "page-title", { left: 55, top: 34, width: 1170, height: 48 }, "下一轮先把三步分工跑通，再用时间记录判断哪里在等待", {
    fontSize: 32,
    bold: true,
    color: C.ink,
    verticalAlignment: "middle",
  });
  addRule(slide, "header-rule", 55, 103, 1170, C.primary, 2);
  addText(slide, "page-context", { left: 55, top: 114, width: 1170, height: 24 }, "四周、仅限常规申请｜主流程尚未实施，先验证分工与记录是否可执行", {
    fontSize: 16,
    color: C.muted,
    verticalAlignment: "middle",
  });
}

function addCenteredNode(slide, nodeName, titleName, ownerName, x, title, owner, fill, titleColor = C.ink, ownerColor = C.primaryDark) {
  addText(slide, titleName, { left: x + 16, top: 270, width: 258, height: 32 }, title, {
    fontSize: 22,
    bold: true,
    color: titleColor,
    alignment: "center",
    verticalAlignment: "middle",
    insets: { left: 8, right: 8, top: 4, bottom: 4 },
  });
  addText(slide, ownerName, { left: x + 16, top: 310, width: 258, height: 28 }, owner, {
    fontSize: 16,
    color: ownerColor,
    alignment: "center",
    verticalAlignment: "middle",
    insets: { left: 8, right: 8, top: 4, bottom: 4 },
  });
}

function buildProcessSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide);

  // Main evidence zone: one continuous process band, deliberately larger than support zones.
  addShape(slide, "rect", { left: 55, top: 156, width: 1170, height: 318 }, {
    name: "main-process-zone",
    fill: C.primaryPale,
    line: { style: "solid", fill: C.primaryPale, width: 0 },
  });
  addText(slide, "main-zone-label", { left: 82, top: 174, width: 340, height: 24 }, "主流程｜满足条件，才继续", {
    fontSize: 18,
    bold: true,
    color: C.primaryDark,
    verticalAlignment: "middle",
  });
  addText(slide, "main-zone-note", { left: 860, top: 174, width: 335, height: 24 }, "常规事项沿主线；例外另行处理", {
    fontSize: 16,
    color: C.muted,
    alignment: "right",
    verticalAlignment: "middle",
  });

  const node1 = addShape(slide, "rect", { left: 95, top: 254, width: 290, height: 104 }, {
    name: "phase-node-1",
    fill: C.white,
    line: { style: "solid", fill: C.primary, width: 2 },
  });
  const node2 = addShape(slide, "rect", { left: 470, top: 254, width: 290, height: 104 }, {
    name: "phase-node-2",
    fill: C.white,
    line: { style: "solid", fill: C.primary, width: 2 },
  });
  const node3 = addShape(slide, "rect", { left: 845, top: 254, width: 290, height: 104 }, {
    name: "phase-node-3",
    fill: C.primary,
    line: { style: "solid", fill: C.primary, width: 2 },
  });
  const connectorOptions = {
    kind: "straight",
    fromSide: "right",
    toSide: "left",
    line: { style: "solid", fill: C.primary, width: 4 },
    tail: { type: "triangle", width: "sm", length: "sm" },
  };
  slide.shapes.connect(node1, node2, connectorOptions);
  slide.shapes.connect(node2, node3, connectorOptions);

  // Explicit visible arrowheads keep the main path legible in the rendered PPTX,
  // while the native connectors above preserve the editable relationship metadata.
  addShape(slide, "rightArrow", { left: 385, top: 292, width: 85, height: 28 }, {
    name: "visible-arrow-1",
    fill: C.primary,
    line: { style: "solid", fill: C.primary, width: 0 },
  });
  addShape(slide, "rightArrow", { left: 760, top: 292, width: 85, height: 28 }, {
    name: "visible-arrow-2",
    fill: C.primary,
    line: { style: "solid", fill: C.primary, width: 0 },
  });

  // Gate markers sit on the path; their labels are centered condition tags, not body prose.
  addShape(slide, "diamond", { left: 418, top: 296, width: 20, height: 20 }, {
    name: "gate-1-marker",
    fill: C.white,
    line: { style: "solid", fill: C.primary, width: 2 },
  });
  addShape(slide, "diamond", { left: 793, top: 296, width: 20, height: 20 }, {
    name: "gate-2-marker",
    fill: C.white,
    line: { style: "solid", fill: C.primary, width: 2 },
  });
  addText(slide, "gate-1-label", { left: 382, top: 212, width: 92, height: 26 }, "授权常规", {
    fontSize: 16,
    color: C.primaryDark,
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    insets: { left: 8, right: 8, top: 4, bottom: 4 },
  });
  addText(slide, "gate-2-label", { left: 757, top: 212, width: 92, height: 26 }, "材料齐备", {
    fontSize: 16,
    color: C.primaryDark,
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    insets: { left: 8, right: 8, top: 4, bottom: 4 },
  });
  // The three node labels are intentionally separate from their shapes so their usable padding is auditable.
  addText(slide, "phase-1-title", { left: 111, top: 270, width: 258, height: 32 }, "受理分流", { fontSize: 22, bold: true, color: C.ink, alignment: "center", verticalAlignment: "middle", insets: { left: 8, right: 8, top: 4, bottom: 4 } });
  addText(slide, "phase-1-owner", { left: 111, top: 310, width: 258, height: 28 }, "责任：服务助理", { fontSize: 16, color: C.primaryDark, alignment: "center", verticalAlignment: "middle", insets: { left: 8, right: 8, top: 4, bottom: 4 } });
  addText(slide, "phase-2-title", { left: 486, top: 270, width: 258, height: 32 }, "核对材料", { fontSize: 22, bold: true, color: C.ink, alignment: "center", verticalAlignment: "middle", insets: { left: 8, right: 8, top: 4, bottom: 4 } });
  addText(slide, "phase-2-owner", { left: 486, top: 310, width: 258, height: 28 }, "责任：服务助理", { fontSize: 16, color: C.primaryDark, alignment: "center", verticalAlignment: "middle", insets: { left: 8, right: 8, top: 4, bottom: 4 } });
  addText(slide, "phase-3-title", { left: 861, top: 270, width: 258, height: 32 }, "教师处理", { fontSize: 22, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle", insets: { left: 8, right: 8, top: 4, bottom: 4 } });
  addText(slide, "phase-3-owner", { left: 861, top: 310, width: 258, height: 28 }, "责任：责任教师", { fontSize: 16, color: C.white, alignment: "center", verticalAlignment: "middle", insets: { left: 8, right: 8, top: 4, bottom: 4 } });

  addRule(slide, "exception-1-rule", 95, 386, 4, C.primary, 56);
  addText(slide, "exception-1", { left: 111, top: 384, width: 258, height: 26 }, "登记事项类型＋提交时间", { fontSize: 18, color: C.ink, alignment: "left", verticalAlignment: "middle" });
  addText(slide, "phase-1-detail", { left: 111, top: 416, width: 258, height: 42 }, "非常规 / 超授权：暂停\n负责人指定处理人", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addRule(slide, "exception-2-rule", 470, 386, 4, C.primary, 56);
  addText(slide, "exception-2", { left: 486, top: 384, width: 258, height: 26 }, "按清单核对齐备性", { fontSize: 18, color: C.ink, alignment: "left", verticalAlignment: "middle" });
  addText(slide, "phase-2-detail", { left: 486, top: 416, width: 258, height: 42 }, "缺件：暂停→通知补齐→复核\n齐备后才送教师", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addRule(slide, "exception-3-rule", 845, 386, 4, C.primary, 56);
  addText(slide, "exception-3", { left: 861, top: 384, width: 258, height: 26 }, "教师判断并确认答复", { fontSize: 18, color: C.ink, alignment: "left", verticalAlignment: "middle" });
  addText(slide, "phase-3-detail", { left: 861, top: 418, width: 258, height: 24 }, "助理不得代替教师承诺。", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });

  // Independent secondary zone: cross-stage records and the four-week acceptance boundary.
  addShape(slide, "rect", { left: 55, top: 500, width: 1170, height: 130 }, {
    name: "secondary-zone",
    fill: C.secondaryBg,
    line: { style: "solid", fill: C.secondaryBg, width: 0 },
  });
  addRule(slide, "records-rule", 80, 520, 4, C.primary, 88);
  addText(slide, "records-heading", { left: 100, top: 516, width: 300, height: 28 }, "跨阶段记录", { fontSize: 20, bold: true, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "records-values", { left: 100, top: 552, width: 690, height: 26 }, "首次提交 → 核对完成 → 教师接收 → 最终答复", { fontSize: 18, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "records-gap", { left: 100, top: 586, width: 690, height: 22 }, "另记：缺件暂停区间｜分别核对等待与教师处理耗时", { fontSize: 16, color: C.muted, verticalAlignment: "middle" });
  addRule(slide, "acceptance-rule", 850, 520, 4, C.primary, 88);
  addText(slide, "acceptance-heading", { left: 870, top: 516, width: 330, height: 28 }, "四周后只验收", { fontSize: 20, bold: true, color: C.primaryDark, verticalAlignment: "middle" });
  addText(slide, "acceptance-body", { left: 870, top: 552, width: 330, height: 54 }, "分工可执行｜记录完整\n不承诺再次降时", { fontSize: 18, color: C.ink, verticalAlignment: "middle" });

  addFooter(slide);
  slide.speakerNotes.textFrame.setText("v8流程页重做：主区只保留一条三阶段主路径，推进条件贴近门禁，异常贴回所属阶段；跨阶段记录与四周验收降级为独立次区。计划尚未实施，不能承诺降时。");
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const theme = JSON.parse(await fs.readFile(THEME_PATH, "utf8"));
  FONT = theme.font;
  C = deriveTheme(theme);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = buildProcessSlide(presentation);
  await writeBlob(`${OUT}/page-01.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${OUT}/page-01.layout.json`, await (await slide.export({ format: "layout" })).text(), "utf8");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
