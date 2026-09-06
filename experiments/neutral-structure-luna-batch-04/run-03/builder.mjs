import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations";
const runtimeNode = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const runtimePython = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const runtimeNodeModules = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const finalPath = path.join(here, "deliverables", "deck-v3.pptx");
const publicDeckPath = path.join(here, "deck.pptx");
const buildDir = path.join(here, ".build");
const evidenceDir = path.join(here, "evidence");
const evidencePath = path.join(evidenceDir, "structure-invocations.ndjson");
const inspectPath = path.join(evidenceDir, "inspect.ndjson");
const layoutPath = path.join(evidenceDir, "slide-1.layout.json");
const SERIF = "Noto Serif SC";
const SANS = "Noto Sans SC";
const PAPER = "#F5F4EF";
const SURFACE = "#EEECE5";
const INK = "#20201D";
const BODY = "#4B4A45";
const MUTED = "#85837B";
const LINE = "#D8D5CC";
const ACCENT = "#A35D4F";

const skin = Object.freeze({
  id: "neutral-editorial-001",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  background: PAPER,
  surface: SURFACE,
  dark: INK,
  body: BODY,
  muted: MUTED,
  line: LINE,
  primaryColor: ACCENT,
  font: SANS,
  typography: {
    componentHeading: 15.75,
    componentTitle: 15.75,
    componentItemTitle: 12.75,
    componentLead: 12.75,
    componentBody: 12.75,
    componentLabel: 11.25,
    componentMeta: 11.25,
  },
  componentTheme: {
    background: PAPER,
    surface: SURFACE,
    dark: INK,
    body: BODY,
    muted: MUTED,
    line: LINE,
    primaryColor: ACCENT,
    font: SANS,
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
});

function noLine() { return { style: "solid", fill: "none", width: 0 }; }
function addText(slide, text, position, options = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name: options.name, position, fill: "none", line: noLine() });
  shape.text = String(text ?? "");
  shape.text.style = {
    typeface: options.typeface ?? SANS,
    fontSize: options.fontSize ?? 17,
    color: options.color ?? INK,
    bold: options.bold ?? false,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    lineSpacing: options.lineSpacing ?? 1,
    autoFit: "none",
    insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}
function addLine(slide, x1, y1, x2, y2, color = LINE, width = 1, name) {
  return slide.shapes.add({
    geometry: "line", name,
    position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), horizontalFlip: x2 < x1, verticalFlip: y2 < y1 },
    fill: "none", line: { style: "solid", fill: color, width },
  });
}

function adaptStructureTypography(slide) {
  let adapted = 0;
  for (const shape of slide.shapes.items) {
    const name = String(shape.name ?? "");
    if (!shape.text || typeof shape.text !== "object") continue;
    if (/cycle-stage-node-/.test(name)) {
      shape.text.style = { typeface: SERIF, fontSize: 17, color: "#FFFFFF", bold: true, alignment: "center", verticalAlignment: "middle", lineSpacing: 1, autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
      adapted += 1;
    } else if (/cycle-stage-title-|cycle-center-title/.test(name)) {
      shape.text.style = { typeface: SERIF, fontSize: name.includes("center") ? 21 : 17, color: INK, bold: true, alignment: "center", verticalAlignment: "middle", lineSpacing: 1.1, autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
      adapted += 1;
    } else if (/cycle-stage-body-|cycle-center-body/.test(name)) {
      shape.text.style = { typeface: SANS, fontSize: name.includes("center") ? 15 : 17, color: BODY, bold: false, alignment: "center", verticalAlignment: "middle", lineSpacing: 1.45, autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
      adapted += 1;
    }
  }
  return adapted;
}

async function main() {
  process.env.RUNTIME_NODE_MODULES = runtimeNodeModules;
  process.env.RUNTIME_NODE = runtimeNode;
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  const { invokeStructure, closeStructureRuntime } = await import(pathToFileURL(path.join(root, ".codex/skills/ppagent-structure/scripts/invoke.mjs")).href);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = PAPER;

  addText(slide, "01", { left: 56, top: 52, width: 44, height: 34 }, { name: "chapter-number", typeface: SANS, fontSize: 17, color: ACCENT, bold: true, verticalAlignment: "middle" });
  addText(slide, "每周小改进", { left: 106, top: 48, width: 198, height: 40 }, { name: "page-title", typeface: SERIF, fontSize: 25, color: INK, bold: true, verticalAlignment: "middle" });
  addLine(slide, 326, 68, 1224, 68, LINE, 1, "header-rule");
  addText(slide, "四阶段依次运行，复盘问题回到下一周的“收集问题”", { left: 56, top: 111, width: 720, height: 28 }, { name: "lead", typeface: SANS, fontSize: 17, color: BODY, verticalAlignment: "middle" });
  addText(slide, "每轮只改一项 · 试行可停止 · 未验证不强制推广", { left: 56, top: 139, width: 720, height: 22 }, { name: "scope-note", typeface: SANS, fontSize: 15, color: ACCENT, verticalAlignment: "middle" });

  await invokeStructure({
    root,
    slide,
    skin,
    assetId: "cycle-racetrack-loop-005",
    parameters: {
      center: { title: "每周小改进", body: "复盘问题进入下一轮" },
      items: [
        { key: "collect", title: "收集问题", body: "记录本周反复遇到的困难" },
        { key: "choose", title: "选择一项", body: "看影响与范围，只定一事" },
        { key: "pilot", title: "小范围试行", body: "自愿成员在约定场景尝试" },
        { key: "review", title: "复盘结果", body: "记录有效做法与新增负担" },
      ],
    },
    targetFrame: skin.bodyFrame,
    evidencePath,
    pageId: "run-03-page-01",
    regionId: "weekly-improvement-cycle",
    reason: "原稿明确要求四阶段按顺序反复运行，复盘问题返回第一阶段；直接调用与该循环语义和四阶段数量匹配。",
  });
  const adapted = adaptStructureTypography(slide);
  addText(slide, "复盘得到的问题与未解决事项，作为下一轮输入", { left: 56, top: 675, width: 700, height: 22 }, { name: "footer-note", typeface: SANS, fontSize: 15, color: MUTED, verticalAlignment: "middle" });
  addText(slide, "01", { left: 1187, top: 675, width: 37, height: 22 }, { name: "folio", typeface: SANS, fontSize: 15, color: MUTED, alignment: "right", verticalAlignment: "middle" });

  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(layoutPath, await layout.text(), "utf8");
  const snapshot = await presentation.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,layout", maxChars: 50000 });
  await fs.writeFile(inspectPath, snapshot.ndjson, "utf8");
  slide.speakerNotes.textFrame.setText("来源：experiments/neutral-structure-luna-batch-04/inputs/03-cycle.md。结构调用：cycle-racetrack-loop-005。页面规则：每轮只选择一项，试行可停止，未验证的新做法不强制推广；复盘问题回到下一轮的收集问题。结构文字样式按 neutral-editorial-001 / 杂志风角色适配。\n本页检查记录见 evidence/qa.md。");

  const candidatePath = path.join(buildDir, "candidate-v3.pptx");
  await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
  const result = await finalizePresentation({
    explicitTotalSlideCount: 1,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir: root,
    candidatePath,
    finalPath,
    pythonExecutable: runtimePython,
    integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
    fontPolicy: { basis: "design", families: [SERIF, SANS] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(buildDir, "deck-v3.validation.json"),
  });
  await fs.copyFile(finalPath, publicDeckPath);
  const finalPresentation = await PresentationFile.importPptx(await (await import("@oai/artifact-tool")).FileBlob.load(finalPath));
  const finalInspect = await finalPresentation.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,layout", maxChars: 50000 });
  await fs.writeFile(path.join(evidenceDir, "final-import-inspect.ndjson"), finalInspect.ndjson, "utf8");
  const finalLayout = await finalPresentation.slides.items[0].export({ format: "layout" });
  await fs.writeFile(path.join(evidenceDir, "final-slide-1.layout.json"), await finalLayout.text(), "utf8");
  await fs.writeFile(path.join(evidenceDir, "build-result.json"), JSON.stringify({ finalPath, publicDeckPath, candidatePath, adaptedTypographyShapes: adapted, result }, null, 2), "utf8");
  await closeStructureRuntime();
  console.log(JSON.stringify({ finalPath, publicDeckPath, candidatePath, adaptedTypographyShapes: adapted, result }, null, 2));
}

main().catch(async (error) => {
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.appendFile(path.join(evidenceDir, "builder-errors.log"), `${new Date().toISOString()} ${error.stack ?? error}\n`);
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
