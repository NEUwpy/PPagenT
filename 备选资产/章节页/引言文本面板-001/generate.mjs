import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PARAMETERS = {
  variant: "panel",
  title: "章节引言",
  subtitle: "SECTION INTRODUCTION",
  body: "在这里用两到三行文字交代本章节的背景、范围或阅读提示。内容应当简洁，并为后续页面建立清晰的上下文。",
  background: "#F7FAFC",
  panelColor: "#1677C8",
  accentColor: "#00A8D8",
  fontFamily: "Microsoft YaHei",
};

function addText(slide, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = String(text ?? "");
  box.text.style = {
    fontSize: style.fontSize ?? 18,
    typeface: style.typeface ?? "Microsoft YaHei",
    color: style.color ?? "#FFFFFF",
    bold: style.bold ?? false,
    alignment: style.alignment ?? "center",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: style.autoFit ?? "shrinkText",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return box;
}

export function buildIntroPanelSlide(presentation, parameters = {}) {
  const params = { ...DEFAULT_PARAMETERS, ...parameters };
  const slide = presentation.slides.add();
  slide.background.fill = params.background;

  if (params.variant === "minimal") {
    addText(slide, params.title, { left: 94, top: 146, width: 900, height: 64 }, {
      fontSize: 36,
      bold: true,
      color: params.panelColor,
      alignment: "left",
    });
    addText(slide, params.subtitle, { left: 96, top: 216, width: 760, height: 30 }, {
      fontSize: 14,
      color: "#7C8A9A",
      alignment: "left",
    });
    slide.shapes.add({
      geometry: "rect",
      position: { left: 94, top: 274, width: 1092, height: 2 },
      fill: params.accentColor,
      line: { style: "solid", fill: "none", width: 0 },
    });
    addText(slide, params.body, { left: 94, top: 316, width: 1020, height: 170 }, {
      fontSize: 20,
      color: "#475569",
      alignment: "left",
      verticalAlignment: "top",
    });
    return slide;
  }
  if (params.variant !== "panel") throw new Error(`不支持的 variant：${params.variant}`);

  slide.shapes.add({
    geometry: "roundRect",
    name: "intro-panel",
    position: { left: 134, top: 114, width: 1012, height: 496 },
    fill: params.panelColor,
    line: { style: "solid", fill: params.panelColor, width: 0 },
    borderRadius: "rounded-2xl",
    shadow: "shadow-lg",
  });

  addText(slide, params.title, { left: 244, top: 177, width: 792, height: 56 }, {
    fontSize: 34,
    bold: true,
  });
  addText(slide, params.subtitle, { left: 300, top: 239, width: 680, height: 30 }, {
    fontSize: 13,
    color: "#DCEEFF",
  });
  slide.shapes.add({
    geometry: "rect",
    position: { left: 520, top: 291, width: 240, height: 3 },
    fill: params.accentColor,
    line: { style: "solid", fill: "none", width: 0 },
  });
  addText(slide, params.body, { left: 254, top: 326, width: 772, height: 154 }, {
    fontSize: 20,
    verticalAlignment: "middle",
  });

  const marker = slide.shapes.add({
    geometry: "ellipse",
    name: "continuation-marker",
    position: { left: 610, top: 578, width: 60, height: 60 },
    fill: params.accentColor,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
  });
  marker.text = "↓";
  marker.text.style = {
    fontSize: 24,
    typeface: params.fontFamily,
    color: "#FFFFFF",
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return slide;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values = { output: path.join(moduleDir, "example.pptx"), config: null };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${name || "<empty>"}`);
    const key = name.slice(2);
    if (!(key in values)) throw new Error(`不支持的参数：--${key}`);
    values[key] = value;
  }
  return values;
}

async function main() {
  const args = parseArgs();
  const config = args.config
    ? JSON.parse(await fs.readFile(path.resolve(args.config), "utf8"))
    : {};
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  if (args.config) {
    buildIntroPanelSlide(presentation, config);
  } else {
    buildIntroPanelSlide(presentation, { variant: "panel" });
  }
  await fs.mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.resolve(args.output));
  console.log(path.resolve(args.output));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}
