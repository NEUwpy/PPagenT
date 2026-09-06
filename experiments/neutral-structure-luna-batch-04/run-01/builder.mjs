import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const runDir = here;
const finalizedPath = path.join(runDir, "final", "deck-v3.pptx");
const finalPath = path.join(runDir, "deck.pptx");
const candidatePath = path.join(runDir, ".codex-finalizer", "candidate.pptx");
const evidencePath = path.join(runDir, "structure-invocations.ndjson");
const inspectPath = path.join(runDir, "inspect-authoring.ndjson");
const layoutPath = path.join(runDir, "slide-01-authoring.layout.json");

const PAPER = "#F5F4EF";
const INK = "#20201D";
const BODY = "#4B4A45";
const MUTED = "#85837B";
const LINE = "#D8D5CC";
const ACCENT = "#A35D4F";
const SERIF = "Noto Serif SC";
const SANS = "Noto Sans SC";

const skin = {
  id: "neutral-editorial-001",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: {
    primaryColor: ACCENT,
    background: PAPER,
    surface: "#EEECE5",
    dark: INK,
    body: BODY,
    muted: MUTED,
    line: LINE,
    font: SANS,
    // Component CSS consumes these as pt, while native text below uses design px.
    typography: {
      componentHeading: 15.75,
      componentTitle: 15.75,
      componentItemTitle: 12.75,
      componentLead: 12.75,
      componentBody: 12.75,
      componentLabel: 11.25,
      componentMeta: 11.25,
    },
  },
};

function noLine() {
  return { style: "solid", fill: "none", width: 0 };
}

function addText(slide, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position,
    fill: "none",
    line: noLine(),
  });
  shape.text = String(text ?? "");
  shape.text.style = {
    typeface: style.typeface ?? SANS,
    fontSize: style.fontSize ?? 17,
    color: style.color ?? BODY,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    lineSpacing: style.lineSpacing ?? 1,
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addLine(slide, x1, y1, x2, y2, color = LINE, width = 1, name) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      horizontalFlip: x2 < x1,
      verticalFlip: y2 < y1,
    },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addHeader(slide) {
  addText(slide, "01", { left: 56, top: 48, width: 28, height: 24 }, {
    name: "section-number",
    typeface: SANS,
    fontSize: 18,
    color: ACCENT,
  });
  addText(slide, "三路信息共同进入交接单", { left: 96, top: 44, width: 332, height: 36 }, {
    name: "page-title",
    typeface: SERIF,
    fontSize: 25,
    color: INK,
    bold: true,
  });
  addLine(slide, 446, 60.5, 1220, 60.5, LINE, 1, "title-rule");
  addText(slide, "01", { left: 1198, top: 683, width: 26, height: 15 }, {
    name: "folio",
    typeface: SANS,
    fontSize: 11,
    color: MUTED,
    alignment: "right",
  });
}

function addNotes(slide) {
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    "- 内容：experiments/neutral-structure-luna-batch-04/inputs/01-convergence.md",
    "- 结构检索：catalog list --logic convergence；inspect convergence-many-to-one-003",
    "- 结构调用：convergence-many-to-one-003 / direct invokeStructure",
    "- 视觉：neutral-editorial-001 / magazine",
    "[/Sources]",
    "",
    "[Boundaries]",
    "- 三路资料同级、可独立准备，直接汇入共同结果，不表示先后筛选或中间归纳。",
    "- 交接双方仍需确认。材料缺失应标注待补，不能当作已核实事实。",
    "- 本页不宣称故障已经排除，也没有时间节约或完成率数据。",
    "[/Boundaries]",
  ].join("\n"));
}

async function adaptNativeStructure(presentation, slide) {
  const structureNames = new Set([
    "merge-input-1", "merge-input-2", "merge-input-3", "merge-result",
  ]);
  const snapshot = await presentation.inspect({ kind: "textbox,shape", maxChars: 200000 });
  const elements = (snapshot.ndjson ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((element) => element.slide === 1);
  for (const element of elements) {
    const name = element.name ?? "";
    const isInputBox = structureNames.has(name) && name.startsWith("merge-input-");
    const isResultBox = name === "merge-result";
    const isStructureText = /^merge-(input-[1-3]|result)-(title|body|label)$/.test(name);
    if (!isInputBox && !isResultBox && !isStructureText) continue;
    const shape = presentation.resolve(element.id);
    if (!shape) continue;
    if (isInputBox) {
      shape.fill = PAPER;
      shape.line = { style: "solid", fill: LINE, width: 1 };
      shape.shadow = "shadow-none";
    } else if (isResultBox) {
      shape.fill = "#EEECE5";
      shape.line = { style: "solid", fill: ACCENT, width: 2 };
      shape.shadow = "shadow-none";
    } else {
      const isTitle = name.endsWith("-title");
      const isLabel = name.endsWith("-label");
      shape.text.style = {
        ...shape.text.style,
        typeface: isTitle ? SERIF : SANS,
        fontSize: isTitle ? 21 : isLabel ? 15 : 17,
        color: isTitle ? INK : isLabel ? MUTED : BODY,
        bold: isTitle,
        alignment: isLabel || name.startsWith("merge-result-") ? "center" : "left",
        verticalAlignment: "middle",
        autoFit: "none",
      };
    }
  }
}

async function writeBlob(output, blob) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, Buffer.from(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(path.join(runDir, ".codex-finalizer"), { recursive: true });
  await fs.mkdir(path.dirname(finalizedPath), { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = PAPER;
  addHeader(slide);
  addNotes(slide);

  const parameters = {
    inputs: [
      { key: "现场记录", title: "现场记录", body: "故障现象与发生时间" },
      { key: "检测记录", title: "检测记录", body: "测量读数与测试条件" },
      { key: "备件记录", title: "备件记录", body: "替换型号与领用数量" },
    ],
    result: {
      title: "维修交接单",
      body: "接班追溯；双方确认\n材料缺失标注待补",
    },
  };

  try {
    await invokeStructure({
      root,
      slide,
      skin,
      assetId: "convergence-many-to-one-003",
      parameters,
      targetFrame: skin.bodyFrame,
      evidencePath,
      pageId: "page-01",
      regionId: "convergence-region",
      reason: "原稿明确要求三路同级资料不经筛选直接共同汇入一份维修交接单，契合多路汇聚结果的语义契约。",
    });

    await adaptNativeStructure(presentation, slide);

    const inspect = await presentation.inspect({
      kind: "slide,textbox,shape,image,notes,layout",
      maxChars: 200000,
    });
    await fs.writeFile(inspectPath, inspect.ndjson, "utf8");
    await fs.writeFile(layoutPath, await slide.export({ format: "layout" }).then((value) => value.text()), "utf8");

    await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
    const { finalizePresentation } = await import(pathToFileURL(
      path.join("C:\\Users\\ilove\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.904.11930\\skills\\presentations\\container_tools\\artifact_tool_utils.mjs"),
    ).href);
    await finalizePresentation({
      explicitTotalSlideCount: 1,
      requiredNativeTableOwnerSlides: [],
      requiredNativeChartOwnerSlides: [],
      workspaceDir: runDir,
      candidatePath,
      finalPath: finalizedPath,
      pythonExecutable: "C:\\Users\\ilove\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
      integrityValidatorPath: "C:\\Users\\ilove\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.904.11930\\skills\\presentations\\container_tools\\inspect_presentation_package_integrity.py",
      layoutValidatorPath: "C:\\Users\\ilove\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.904.11930\\skills\\presentations\\container_tools\\inspect_presentation_layout_geometry.py",
      layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
      fontPolicy: { basis: "design", families: [SERIF, SANS] },
      verifyArtifactToolImport: true,
      receiptPath: path.join(runDir, ".codex-finalizer", "deck-v3.validation.json"),
    });

    await fs.copyFile(finalizedPath, finalPath);

    const imported = await PresentationFile.importPptx(await FileBlob.load(finalPath));
    const importedInspect = await imported.inspect({
      kind: "slide,textbox,shape,image,notes,layout",
      maxChars: 200000,
    });
    await fs.writeFile(path.join(runDir, "inspect-imported.ndjson"), importedInspect.ndjson, "utf8");
    await fs.writeFile(path.join(runDir, "slide-01-imported.layout.json"), await imported.slides.items[0].export({ format: "layout" }).then((value) => value.text()), "utf8");
    console.log(JSON.stringify({ status: "passed", finalPath, candidatePath, evidencePath }, null, 2));
  } finally {
    await closeStructureRuntime();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
