import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { academicReportShell } from "../../src/runtime/shells/academic-report.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");
const sourcePptx = path.join(projectRoot, "PPT源", "PPT模板-封面正文尾页.pptx");
const outputDir = path.join(here, "output");
const outputPptx = path.join(outputDir, "shell-content-frame-contract.pptx");
const qaDir = path.join(outputDir, "qa");

const { contentFrame, bottomReserve, logo, pageNumber, sectionLabel } = academicReportShell.slots;
const font = "Microsoft YaHei";

function addText(slide, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(value ?? "");
  shape.text.style = {
    fontSize: style.fontSize ?? 16,
    typeface: style.typeface ?? font,
    color: style.color ?? "#22313F",
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: style.autoFit ?? "shrinkText",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addBox(slide, position, options = {}) {
  const shape = slide.shapes.add({
    geometry: options.geometry ?? "roundRect",
    name: options.name,
    position,
    fill: options.fill ?? "#FFFFFF",
    line: options.line ?? { style: "solid", fill: "#CBD5E1", width: 1 },
    shadow: options.shadow ?? "shadow-none",
    borderRadius: options.borderRadius,
  });
  if (options.text !== undefined) {
    shape.text = String(options.text);
    shape.text.style = {
      fontSize: options.fontSize ?? 16,
      typeface: options.typeface ?? font,
      color: options.color ?? "#22313F",
      bold: options.bold ?? false,
      alignment: options.alignment ?? "center",
      verticalAlignment: options.verticalAlignment ?? "middle",
      autoFit: options.autoFit ?? "shrinkText",
      insets: options.insets ?? { top: 4, right: 8, bottom: 4, left: 8 },
    };
  }
  return shape;
}

function addLine(slide, from, to, color, width = 1) {
  return slide.shapes.add({
    geometry: "line",
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

async function exactRecord(presentation, kind, predicate, labelText) {
  const snapshot = await presentation.inspect({
    kind: "textbox,shape,image",
    include: "id,slide,kind,name,text",
    maxChars: 100000,
  });
  const records = snapshot.ndjson.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const matches = records.filter((record) => record.slide === 1 && record.kind === kind && predicate(record));
  if (matches.length !== 1) throw new Error(`${labelText} 匹配失败：${matches.length}`);
  return presentation.resolve(matches[0].id);
}

async function exportQa(presentation) {
  await fs.mkdir(qaDir, { recursive: true });
  const slide = presentation.slides.items[0];
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  const pngBuffer = Buffer.from(await png.arrayBuffer());
  await fs.writeFile(path.join(qaDir, "slide-01.png"), pngBuffer);
  await fs.writeFile(path.join(outputDir, "shell-content-frame-contract.png"), pngBuffer);
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(qaDir, "slide-01.layout.json"), await layout.text(), "utf8");
  const inspect = await presentation.inspect({
    kind: "slide,textbox,shape,image,notes,layout",
    maxChars: 200000,
  });
  await fs.writeFile(path.join(qaDir, "inspect.ndjson"), inspect.ndjson, "utf8");
}

function label(slide, value, position, color = "#24568F", fill = "#EAF4FF") {
  return addBox(slide, position, {
    geometry: "roundRect",
    fill,
    line: { style: "solid", fill: color, width: 1 },
    shadow: "shadow-none",
    borderRadius: 8,
    text: value,
    fontSize: 15,
    typeface: font,
    color,
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    insets: { top: 2, right: 6, bottom: 2, left: 6 },
  });
}

function outline(slide, name, frame, color, width = 2) {
  return addBox(slide, frame, {
    name,
    geometry: "rect",
    fill: "none",
    line: { style: "solid", fill: color, width },
    shadow: "shadow-none",
    borderRadius: 0,
  });
}

await fs.mkdir(outputDir, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePptx));
const originalSlides = [...presentation.slides.items];
const slide = originalSlides[2].duplicate();
for (const original of originalSlides) original.delete();
slide.moveTo(0);

const pageNumberText = await exactRecord(presentation, "textbox", (item) => item.text === "01", "页码");
pageNumberText.text.replace("01", "01");
const sectionText = await exactRecord(presentation, "textbox", (item) => item.text === "正文页", "栏目");
sectionText.text.replace("正文页", "规范说明");
const titleText = await exactRecord(presentation, "textbox", (item) => item.text === "主旨句", "页面标题");
titleText.text.replace("主旨句", "Shell 与 Content Frame 固定契约");
titleText.position = { ...academicReportShell.slots.pageTitle };
titleText.text.style = {
  ...titleText.text.style,
  typeface: font,
  fontSize: 30,
  bold: true,
  autoFit: "none",
  alignment: "left",
  verticalAlignment: "middle",
};
const bodyText = await exactRecord(presentation, "textbox", (item) => item.text === "正文", "正文占位符");
bodyText.text = "";
const sourceArrow = await exactRecord(presentation, "shape", (item) => item.name === "箭头: 下 9", "来源箭头");
sourceArrow.delete();
const sourceImage = await exactRecord(presentation, "image", (item) => item.name === "图片 10", "来源图片");
sourceImage.delete();
slide.speakerNotes.textFrame.setText([
  "[Sources]",
  "- 视觉与几何：PPT源/PPT模板-封面正文尾页.pptx 第 3 页",
  "- Content Frame：src/runtime/shells/academic-report.mjs",
  "[/Sources]",
].join("\n"));

outline(slide, "Shell slot: page number", pageNumber, "#A64D79", 2);
outline(slide, "Shell slot: section label", sectionLabel, "#A64D79", 2);
outline(slide, "Shell slot: logo", logo, "#7447A8", 2);
outline(slide, "Shell slot: content frame", contentFrame, "#0A78C8", 3);
outline(slide, "Shell slot: bottom reserve", bottomReserve, "#B7791F", 2);

label(slide, "页码 + 栏目 / Shell", { left: 286, top: 35, width: 172, height: 30 }, "#8A315F", "#FCECF4");
addLine(slide, { x: 286, y: 50 }, { x: 178, y: 50 }, "#A64D79", 1.5);

label(slide, "Logo / Skin 可替换", { left: 804, top: 35, width: 164, height: 30 }, "#633B92", "#F2ECFA");
addLine(slide, { x: 968, y: 50 }, { x: 984, y: 50 }, "#7447A8", 1.5);

label(slide, "页面标题 / Shell", { left: 54, top: 111, width: 164, height: 28 }, "#173D73", "#EAF1FA");

addBox(slide, {
  left: contentFrame.left + 18,
  top: contentFrame.top + 18,
  width: contentFrame.width - 36,
  height: contentFrame.height - 36,
}, {
  name: "Content Frame explanation",
  geometry: "roundRect",
  fill: "#F5FAFF",
  line: { style: "solid", fill: "#B6D7F0", width: 1 },
  shadow: "shadow-none",
  borderRadius: 14,
});

addText(slide, "Visual Skill / Style Group 唯一可绘制区域", {
  left: contentFrame.left + 46,
  top: contentFrame.top + 70,
  width: contentFrame.width - 92,
  height: 48,
}, {
  name: "Content Frame title",
  typeface: font,
  fontSize: 28,
  bold: true,
  color: "#0A5E9E",
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
});

addText(slide, "x = 55  ·  y = 166  ·  width = 1170  ·  height = 492  ·  aspect = 2.38 : 1", {
  left: contentFrame.left + 80,
  top: contentFrame.top + 134,
  width: contentFrame.width - 160,
  height: 32,
}, {
  name: "Content Frame metrics",
  typeface: font,
  fontSize: 18,
  bold: true,
  color: "#24568F",
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
});

addText(slide, "组件只接收父容器宽高；HTML 使用 width: 100% / height: 100%；不得内置整页 16:9。", {
  left: contentFrame.left + 96,
  top: contentFrame.top + 204,
  width: contentFrame.width - 192,
  height: 50,
}, {
  name: "Content Frame rule",
  typeface: font,
  fontSize: 20,
  color: "#34495E",
  alignment: "center",
  verticalAlignment: "middle",
  autoFit: "none",
});

const flowY = contentFrame.top + 310;
const flowFrames = [
  { left: 244, top: flowY, width: 196, height: 56, text: "Visual Skill\n语义能力" },
  { left: 542, top: flowY, width: 196, height: 56, text: "Style Group\n具体视觉语法" },
  { left: 840, top: flowY, width: 196, height: 56, text: "State\n数量 / 密度状态" },
];
for (const frame of flowFrames) {
  addBox(slide, frame, {
    geometry: "roundRect",
    fill: "#FFFFFF",
    line: { style: "solid", fill: "#5D91C7", width: 1.5 },
    shadow: "shadow-none",
    borderRadius: 12,
    text: frame.text,
    typeface: font,
    fontSize: 17,
    color: "#234F7D",
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "none",
  });
}
addLine(slide, { x: 440, y: flowY + 28 }, { x: 542, y: flowY + 28 }, "#5D91C7", 2);
addLine(slide, { x: 738, y: flowY + 28 }, { x: 840, y: flowY + 28 }, "#5D91C7", 2);

label(slide, "1170 px", { left: 550, top: contentFrame.top - 13, width: 180, height: 26 });
label(slide, "492 px", { left: contentFrame.left + 8, top: contentFrame.top + 220, width: 88, height: 26 });

label(slide, "底部预留 62 px：底线 / 页脚 / 页注", {
  left: 482,
  top: 678,
  width: 316,
  height: 28,
}, "#8A5A13", "#FFF7E6");

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);
await exportQa(presentation);

console.log(JSON.stringify({
  outputPptx,
  previewPng: path.join(qaDir, "slide-01.png"),
  contentFrame,
}, null, 2));
