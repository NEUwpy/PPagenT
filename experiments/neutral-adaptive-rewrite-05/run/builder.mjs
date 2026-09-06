import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { buildAdaptiveConvergence, CONTENT, TARGET, laneGeometry } from "./adaptive-component.mjs";

const runDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(runDir, "build");
const evidenceDir = path.join(runDir, "evidence");
const candidatePath = path.join(buildDir, "candidate.pptx");

const COLORS = Object.freeze({
  bg: "#F5F4EF",
  surface: "#EEECE5",
  dark: "#20201D",
  body: "#4B4A45",
  muted: "#85837B",
  line: "#D8D5CC",
  primary: "#A35D4F",
});

function text(slide, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(value ?? "");
  shape.text.style = {
    fontSize: style.fontSize ?? 17,
    typeface: style.typeface ?? "Noto Sans SC",
    color: style.color ?? COLORS.body,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function line(slide, from, to, name, color = COLORS.line, width = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: {
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
      horizontalFlip: to.x < from.x,
      verticalFlip: to.y < from.y,
    },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addRightNote(slide, y, index, title, body) {
  text(slide, String(index).padStart(2, "0"), {
    left: 850, top: y, width: 30, height: 24,
  }, {
    name: `right-note-${index}-index`, fontSize: 15, color: COLORS.primary,
  });
  text(slide, title, {
    left: 892, top: y - 1, width: 270, height: 27,
  }, {
    name: `right-note-${index}-title`, fontSize: 21, typeface: "Noto Serif SC", bold: true, color: COLORS.dark,
  });
  text(slide, body, {
    left: 892, top: y + 31, width: 330, height: 48,
  }, {
    name: `right-note-${index}-body`, fontSize: 17, color: COLORS.body, verticalAlignment: "top",
  });
  line(slide, { x: 850, y: y + 92 }, { x: 1222, y: y + 92 }, `right-note-${index}-rule`);
}

export function buildDeck() {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.bg;

  text(slide, "01", { left: 56, top: 48, width: 28, height: 24 }, {
    name: "section-number", fontSize: 18, color: COLORS.primary,
  });
  text(slide, "三路信息共同进入交接单", { left: 96, top: 42, width: 365, height: 42 }, {
    name: "page-title", fontSize: 25, bold: true, typeface: "Noto Serif SC", color: COLORS.dark,
  });
  line(slide, { x: 480, y: 63 }, { x: 1222, y: 63 }, "title-rule");
  text(slide, "01", { left: 1198, top: 680, width: 26, height: 15 }, {
    name: "folio", fontSize: 11, color: COLORS.muted, alignment: "right",
  });

  text(slide, "三路资料地位相同，独立准备，直接汇入同一份交接单", {
    left: 78, top: 132, width: 650, height: 26,
  }, { name: "left-kicker", fontSize: 17, color: COLORS.body });
  line(slide, { x: 806, y: 132 }, { x: 806, y: 625 }, "column-divider", COLORS.line, 1);

  const model = buildAdaptiveConvergence(slide, { target: TARGET });

  text(slide, "交接单的使用边界", { left: 850, top: 137, width: 350, height: 34 }, {
    name: "right-heading", fontSize: 21, bold: true, typeface: "Noto Serif SC", color: COLORS.dark,
  });
  text(slide, "共同结果进入交接环节前，仍需保留确认动作与事实边界。", {
    left: 850, top: 181, width: 360, height: 50,
  }, { name: "right-intro", fontSize: 17, color: COLORS.body, verticalAlignment: "top" });
  line(slide, { x: 850, y: 246 }, { x: 1222, y: 246 }, "right-intro-rule");
  addRightNote(slide, 264, 1, "交接确认", "交接单仍需由交接双方确认。");
  addRightNote(slide, 370, 2, "缺失待补", "材料缺失时，明确标注“待补”。");
  addRightNote(slide, 476, 3, "事实边界", "待补内容不能当作已核实事实。");
  text(slide, "本页未宣称故障已经排除，也没有时间节约或完成率数据。", {
    left: 850, top: 596, width: 360, height: 38,
  }, { name: "right-disclosure", fontSize: 17, color: COLORS.muted, verticalAlignment: "top" });

  slide.speakerNotes.textFrame.setText(
    "来源：experiments/neutral-structure-luna-batch-04/inputs/01-convergence.md。\n"
    + "本页采用 adapted-source：沿用 assets/结构图/多路汇聚结果-003 的三路独立输入、同一点汇流、唯一结果语法，"
    + "并将其局部改写到左栏；未执行 invokeStructure，不声称原库调用成功。\n"
    + "页面为设备维修协作演示场景，不代表实际企业成效。",
  );
  return { presentation, slide, model };
}

function measurementFromLayout(layout) {
  const elements = layout.elements ?? [];
  const names = new Map(elements.map((element) => [element.name, element]));
  const bbox = (name) => names.get(name)?.bbox ?? null;
  const allSizes = elements.flatMap((element) => (element.paragraphs ?? [])
    .map((paragraph) => paragraph.resolvedTextStyle?.fontSize)
    .filter((size) => Number.isFinite(size)));
  const bodyElements = elements.filter((element) => /(?:title|body|kicker|heading|intro|disclosure)/u.test(element.name ?? ""));
  const bodySizes = bodyElements.flatMap((element) => (element.paragraphs ?? [])
    .map((paragraph) => paragraph.resolvedTextStyle?.fontSize)
    .filter((size) => Number.isFinite(size)));
  const structureNames = [
    "adaptive-merge-input-1", "adaptive-merge-input-2", "adaptive-merge-input-3",
    "adaptive-merge-result", "adaptive-merge-lane-1", "adaptive-merge-lane-2", "adaptive-merge-lane-3",
  ];
  const structureBoxes = structureNames.map((name) => ({ name, bbox: bbox(name) }));
  const rightNames = ["right-heading", "right-intro", "right-note-1-body", "right-note-2-body", "right-note-3-body", "right-disclosure"];
  const rightBoxes = rightNames.map((name) => ({ name, bbox: bbox(name) }));
  return {
    source: "candidate.pptx layout export",
    slideFrame: layout.slide?.frame ?? null,
    structureFrame: TARGET,
    structureAreaRatio: Number(((TARGET.width * TARGET.height) / (1280 * 720)).toFixed(4)),
    structureBoxes,
    rightBoxes,
    minResolvedParagraphFontSize: Math.min(...allSizes),
    minSemanticBodyParagraphFontSize: Math.min(...bodySizes),
    shellAndLabelParagraphFontSizes: [...new Set(allSizes.filter((size) => size < 17))].sort((a, b) => a - b),
    requiredBodyFontSize: 17,
    requiredModuleFontSize: 21,
    lineCounts: Object.fromEntries(elements.filter((element) => element.name && element.text)
      .map((element) => [element.name, element.textLayout?.lineCount ?? null])),
    checks: {
      hasThreeIndependentInputs: structureNames.slice(0, 3).every((name) => Boolean(bbox(name))),
      hasThreeConvergenceLanes: structureNames.slice(4).every((name) => Boolean(bbox(name))),
      hasUniqueResult: Boolean(bbox("adaptive-merge-result")),
      hasIndependentRightColumn: rightBoxes.every((item) => Boolean(item.bbox)),
      structureSmallerThanFullBody: TARGET.width < 1170 && TARGET.height < 492,
      noTextBelow17: Math.min(...bodySizes) >= 17,
    },
  };
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  const { presentation, slide, model } = buildDeck();
  await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
  const preview = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(buildDir, "candidate.png"), new Uint8Array(await preview.arrayBuffer()));
  const layout = JSON.parse(await (await slide.export({ format: "layout" })).text());
  await fs.writeFile(path.join(buildDir, "candidate.layout.json"), JSON.stringify(layout, null, 2));
  await fs.writeFile(path.join(evidenceDir, "measurement-candidate.json"), JSON.stringify(measurementFromLayout(layout), null, 2));
  await fs.writeFile(path.join(evidenceDir, "geometry-model.json"), JSON.stringify({ target: TARGET, model }, null, 2));
  console.log(candidatePath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
