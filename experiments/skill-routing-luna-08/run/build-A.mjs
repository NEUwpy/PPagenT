import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const buildDir = path.join(here, "build-A");
const finalPath = path.join(here, "deliverables-A", "A-repair-handoff.pptx");
const candidatePath = path.join(buildDir, "candidate-A.pptx");
const evidencePath = path.join(here, "A-structure-invocations.ndjson");
const inspectPath = path.join(here, "A-inspect-authoring.ndjson");
const layoutPath = path.join(here, "A-slide-01-authoring.layout.json");
const SKILL_DIR = "C:\\Users\\ilove\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.904.11930\\skills\\presentations";
const RUNTIME_PYTHON = "C:\\Users\\ilove\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

const PAPER = "#F5F4EF";
const INK = "#20201D";
const BODY = "#4B4A45";
const MUTED = "#85837B";
const LINE = "#D8D5CC";
const ACCENT = "#A35D4F";
const SANS = "Noto Sans SC";
const SERIF = "Noto Serif SC";

const skin = {
  id: "neutral-editorial-001",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: {
    primaryColor: ACCENT, background: PAPER, surface: "#EEECE5", dark: INK,
    body: BODY, muted: MUTED, line: LINE, font: SANS,
    typography: { componentHeading: 15.75, componentTitle: 15.75, componentItemTitle: 12.75,
      componentLead: 12.75, componentBody: 12.75, componentLabel: 11.25, componentMeta: 11.25 },
  },
};

function noLine() { return { style: "solid", fill: "none", width: 0 }; }
function addText(slide, text, position, style = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name: style.name, position, fill: "none", line: noLine() });
  shape.text = String(text ?? "");
  shape.text.style = { typeface: style.typeface ?? SANS, fontSize: style.fontSize ?? 17,
    color: style.color ?? BODY, bold: style.bold ?? false, alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle", lineSpacing: style.lineSpacing ?? 1,
    autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return shape;
}
function addLine(slide, x1, y1, x2, y2, color = LINE, width = 1, name) {
  return slide.shapes.add({ geometry: "line", name, position: { left: Math.min(x1, x2), top: Math.min(y1, y2),
    width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), horizontalFlip: x2 < x1, verticalFlip: y2 < y1 },
    fill: "none", line: { style: "solid", fill: color, width } });
}
function addShell(slide) {
  addText(slide, "01", { left: 56, top: 44, width: 28, height: 30 }, { name: "section-number", fontSize: 18, color: ACCENT });
  addText(slide, "三路资料汇入维修交接单", { left: 96, top: 42, width: 360, height: 38 }, { name: "page-title", typeface: SERIF, fontSize: 25, color: INK, bold: true });
  addLine(slide, 470, 60, 1220, 60, LINE, 1, "title-rule");
  addText(slide, "01", { left: 1198, top: 683, width: 26, height: 15 }, { name: "folio", fontSize: 11, color: MUTED, alignment: "right" });
}
function addNotes(slide) {
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    "- 内容：experiments/skill-routing-luna-08/input.md（模拟稿）",
    "- 结构检索：catalog list；list --logic convergence；inspect convergence-many-to-one-003",
    "- 结构调用：convergence-many-to-one-003 / invokeStructure",
    "- 视觉规则：rules/skins/中性编辑排版.md；rules/排版体系/杂志风.md",
    "[/Sources]", "", "[Boundaries]",
    "- 三路资料同级、独立准备，直接汇入共同结果，不表示筛选或先后。",
    "- 材料缺失标为待补；交接双方确认。稿件不提供故障已排除等额外结论。",
    "[/Boundaries]",
  ].join("\n"));
}
async function adaptStructure(presentation) {
  const names = new Set(["merge-input-1", "merge-input-2", "merge-input-3", "merge-result"]);
  const snapshot = await presentation.inspect({ kind: "textbox,shape", maxChars: 200000 });
  for (const line of (snapshot.ndjson ?? "").split(/\r?\n/).filter(Boolean)) {
    const el = JSON.parse(line);
    if (el.slide !== 1 || !names.has(el.name ?? "")) continue;
    const shape = presentation.resolve(el.id);
    if (!shape) continue;
    if ((el.name ?? "").startsWith("merge-input-")) {
      shape.fill = PAPER; shape.line = { style: "solid", fill: LINE, width: 1 }; shape.shadow = "shadow-none";
    } else {
      shape.fill = "#EEECE5"; shape.line = { style: "solid", fill: ACCENT, width: 2 }; shape.shadow = "shadow-none";
    }
  }
  const textSnapshot = await presentation.inspect({ kind: "textbox", maxChars: 200000 });
  for (const line of (textSnapshot.ndjson ?? "").split(/\r?\n/).filter(Boolean)) {
    const el = JSON.parse(line);
    if (el.slide !== 1 || !/^merge-(input-[1-3]|result)-(title|body|label)$/.test(el.name ?? "")) continue;
    const shape = presentation.resolve(el.id);
    if (!shape) continue;
    const name = el.name;
    const title = name.endsWith("-title"); const label = name.endsWith("-label");
    shape.text.style = { ...shape.text.style, typeface: title ? SERIF : SANS, fontSize: title ? 21 : label ? 15 : 17,
      color: title ? INK : label ? MUTED : BODY, bold: title, alignment: name.startsWith("merge-result-") || label ? "center" : "left",
      verticalAlignment: "middle", autoFit: "none" };
  }
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add(); slide.background.fill = PAPER; addShell(slide); addNotes(slide);
  try {
    await invokeStructure({ root, slide, skin, assetId: "convergence-many-to-one-003",
      parameters: { inputs: [
        { key: "现场记录", title: "现场记录", body: "故障现象与发生时间" },
        { key: "检测记录", title: "检测记录", body: "测量读数与测试条件" },
        { key: "备件记录", title: "备件记录", body: "替换型号与领用数量" },
      ], result: { title: "维修交接单", body: "接班追溯；材料缺失标为待补\n交接双方确认" } },
      targetFrame: skin.bodyFrame, evidencePath, pageId: "A-page-01", regionId: "A-convergence-region",
      reason: "稿件明确给出三路同级资料，独立准备、不经筛选，共同汇入一份维修交接单，完全匹配多路汇聚结果契约。" });
    await adaptStructure(presentation);
    const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 240000 });
    await fs.writeFile(inspectPath, inspect.ndjson, "utf8");
    await fs.writeFile(layoutPath, await slide.export({ format: "layout" }).then(v => v.text()), "utf8");
    await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
    const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);
    await finalizePresentation({ explicitTotalSlideCount: 1, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [],
      workspaceDir: here, candidatePath, finalPath, pythonExecutable: RUNTIME_PYTHON,
      integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
      layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
      layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
      fontPolicy: { basis: "design", families: [SERIF, SANS] }, verifyArtifactToolImport: true,
      receiptPath: path.join(buildDir, "A-validation.json") });
    const imported = await PresentationFile.importPptx(await FileBlob.load(finalPath));
    const importedInspect = await imported.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 240000 });
    await fs.writeFile(path.join(here, "A-inspect-imported.ndjson"), importedInspect.ndjson, "utf8");
    await fs.writeFile(path.join(here, "A-slide-01-imported.layout.json"), await imported.slides.items[0].export({ format: "layout" }).then(v => v.text()), "utf8");
    console.log(JSON.stringify({ status: "passed", finalPath, evidencePath }, null, 2));
  } finally { await closeStructureRuntime(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
