import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = "C:/PPagenT";
const WORKSPACE = path.join(ROOT, "experiments", "neutral-magazine-close-structure-03");
const BUILD = path.join(WORKSPACE, "build");
const EVIDENCE = path.join(WORKSPACE, "evidence");
const FINAL_STAGED = path.join(WORKSPACE, "deliverables", "deck.pptx");
const FINAL = path.join(WORKSPACE, "deck.pptx");
const RUNTIME_NODE = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const SKILL_DIR = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations";

const C = Object.freeze({
  bg: "#F5F4EF", surface: "#EEECE5", ink: "#20201D", body: "#4B4A45",
  muted: "#85837B", line: "#D8D5CC", brick: "#A35D4F", white: "#FBFAF6",
});
const F = Object.freeze({ display: "Noto Serif SC", body: "Noto Sans SC" });
const BODY_FRAME = Object.freeze({ left: 55, top: 166, width: 1170, height: 492 });
const theme = Object.freeze({
  font: F.body,
  background: C.bg,
  surface: C.surface,
  dark: C.ink,
  body: C.body,
  muted: C.muted,
  line: C.line,
  primaryColor: C.brick,
  typography: {
    componentHeading: 18,
    componentTitle: 17,
    componentItemTitle: 15,
    componentLead: 14,
    componentBody: 12.75,
    componentLabel: 12,
    componentMeta: 11.25,
  },
});

const { Presentation, PresentationFile } = await import("@oai/artifact-tool");
const { invokeStructure, closeStructureRuntime } = await import(pathToFileURL(
  path.join(ROOT, ".codex", "skills", "ppagent-structure", "scripts", "invoke.mjs"),
).href);
const { finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs"),
).href);

function addText(slide, value, frame, { typeface = F.body, fontSize = 17, color = C.body, bold = false, alignment = "left", verticalAlignment = "top", name } = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name, position: frame, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = String(value ?? "");
  shape.text.style = {
    typeface, fontSize, color, bold, alignment, verticalAlignment, autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addLine(slide, from, to, { color = C.line, width = 1, name } = {}) {
  return slide.shapes.add({
    geometry: "line", name,
    position: { left: Math.min(from.x, to.x), top: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y), horizontalFlip: to.x < from.x, verticalFlip: to.y < from.y },
    fill: "none", line: { style: "solid", fill: color, width },
  });
}

function addDoubleDigit(slide, value, x, y, { color = C.brick, size = 15, prefix } = {}) {
  String(value).padStart(2, "0").slice(-2).split("").forEach((char, index) => addText(slide, char, { left: x + index * 11, top: y, width: 10, height: 22 }, {
    typeface: F.display, fontSize: size, color, name: `${prefix}-${index}`,
  }));
}

function shell(slide) {
  slide.background.fill = C.bg;
  addDoubleDigit(slide, 4, 56, 36, { prefix: "chapter-04" });
  addText(slide, "记录进入讨论", { left: 104, top: 35, width: 260, height: 34 }, { typeface: F.display, fontSize: 25, color: C.ink, bold: true, verticalAlignment: "middle", name: "shell-title" });
  addLine(slide, { x: 395, y: 52 }, { x: 1224, y: 52 }, { color: C.line, width: 1, name: "shell-rule" });
  addDoubleDigit(slide, 6, 1195, 678, { color: C.muted, size: 15, prefix: "page-06" });
  addText(slide, "课题组讨论  ·  数据归档试点", { left: 56, top: 676, width: 300, height: 18 }, { fontSize: 15, color: C.muted, name: "shell-footer" });
}

function sourceNotes() {
  return [
    "[Sources]",
    "- 内容真源：experiments/neutral-magazine-luna-01/inputs/manuscript.md（虚构大学场景，非真实项目或实测成效）",
    "- 视觉参考：experiments/neutral-magazine-reference-02/parent-final/slide-06.png（已认可旧页 shell 与文字节奏）",
    "- 结构资产：assets/结构图/阶段门禁流程-004/{asset.json,runtime.mjs,review.mjs,component.css}",
    "- 结构语义：提交记录→尝试定位→补充缺项→可讨论版本；门禁为受控引用、缺项明确、负责人确认",
    "- 限定：复核先检查别人能否理解结果如何产生，不要求复做整项实验，也不代替科学结论审查；新访问授权出现时暂停共享，由负责人处理后再继续。",
    "[/Sources]",
  ].join("\n");
}

const parameters = {
  phases: [
    { key: "submit", title: "提交记录", body: "提交记录与受控引用", points: [] },
    { key: "locate", title: "尝试定位", body: "成员定位数据、脚本与条件", points: [] },
    { key: "supplement", title: "补充缺项", body: "执行者补充上下文", points: [] },
    { key: "discuss", title: "可讨论版本", body: "负责人确认后进入讨论", points: [] },
  ],
  gates: [
    { key: "controlled-reference", title: "引用可控", body: "" },
    { key: "missing-fields", title: "缺项明确", body: "" },
    { key: "owner-confirmed", title: "负责人确认", body: "" },
  ],
};

async function main() {
  await fs.mkdir(BUILD, { recursive: true });
  await fs.mkdir(EVIDENCE, { recursive: true });
  const evidencePath = path.join(EVIDENCE, "structure-invocations.ndjson");
  await fs.appendFile(evidencePath, `${JSON.stringify({ at: new Date().toISOString(), event: "run-start", run: "neutral-magazine-close-structure-03-B" })}\n`, "utf8");

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  shell(slide);
  addText(slide, "记录版本沿着复核与补充逐步成形", { left: 56, top: 100, width: 840, height: 34 }, { typeface: F.display, fontSize: 21, color: C.ink, bold: true, name: "lead-title" });
  addText(slide, "复核先看别人能否理解结果如何产生，不要求复做整项实验，也不代替科学结论审查。出现新访问授权时暂停共享，由负责人处理后再继续。", { left: 56, top: 145, width: 1168, height: 20 }, { fontSize: 15, color: C.body, name: "lead-support" });

  try {
    await invokeStructure({
      root: ROOT,
      slide,
      skin: { id: "neutral-editorial-001", bodyFrame: BODY_FRAME, componentTheme: theme },
      assetId: "sequence-phase-gates-004",
      parameters,
      targetFrame: BODY_FRAME,
      evidencePath,
      pageId: "workflow-review",
      regionId: "phase-gates",
      reason: "稿件明确要求提交、定位、补充、负责人确认的真实先后关系，并在相邻阶段之间保留受控引用、缺项明确、负责人确认三道推进门禁；直接调用以保留河道与门闸几何。",
    });
    slide.speakerNotes.textFrame.setText(sourceNotes());

    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(BUILD, "slide-01.layout.json"), await layout.text(), "utf8");
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(BUILD, "slide-01.png"), new Uint8Array(await preview.arrayBuffer()));

    const candidate = path.join(BUILD, "candidate.pptx");
    await (await PresentationFile.exportPptx(presentation)).save(candidate);
    const inspect = await presentation.inspect({ kind: "slide,textbox,shape,notes,layout", maxChars: 200000 });
    await fs.writeFile(path.join(EVIDENCE, "candidate.inspect.ndjson"), inspect.ndjson, "utf8");

    const requirements = {
      explicitTotalSlideCount: 1,
      requiredNativeTableOwnerSlides: [],
      requiredNativeChartOwnerSlides: [],
    };
    const finalizerResult = await finalizePresentation({
      ...requirements,
      workspaceDir: WORKSPACE,
      candidatePath: candidate,
      finalPath: FINAL_STAGED,
      pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
      integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
      layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
      layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
      requiredNativeTableOwnerSlides: [],
      fontPolicy: { basis: "design", families: [F.display, F.body] },
      verifyArtifactToolImport: true,
      receiptPath: path.join(EVIDENCE, "deck.validation.json"),
    });
    await fs.writeFile(path.join(EVIDENCE, "finalizer-result.json"), JSON.stringify(finalizerResult, null, 2), "utf8");
    await fs.copyFile(path.join(BUILD, "slide-01.png"), path.join(WORKSPACE, "preview-draft.png"));
    await fs.writeFile(path.join(WORKSPACE, "design-note.md"), [
      "# B版设计说明",
      "",
      "本页直接调用 `sequence-phase-gates-004`，保留蜿蜒收窄河道、横跨河道的三道门闸、阶段编号和门禁标牌；阶段文案来自 manuscript.md 的记录复核流程。",
      "",
      "中性 Skin 只替换组件主题用途色：纸色背景、浅承载、炭黑／正文灰文字、分隔线与低饱和砖红强调。结构主题中的 typography 数值按 CSS pt 传入；页首和页脚的原生文字按设计 px 传入。",
      "",
      "结构调用事件、参数与成功记录见 `evidence/structure-invocations.ndjson`；候选布局见 `evidence/candidate.inspect.ndjson`。输出为一页可编辑 PPTX，最终导入渲染由仓库 `src/tools/render-pptx-evidence.mjs` 生成并复核。",
      "",
      "参考方式：保留结构库几何与视觉语法，改变阶段文字、门禁文字、颜色和页首 shell；没有使用库示例事实。",
    ].join("\n"), "utf8");
    await fs.copyFile(FINAL_STAGED, FINAL);
    const hash = crypto.createHash("sha256").update(await fs.readFile(FINAL)).digest("hex");
    await fs.writeFile(path.join(EVIDENCE, "final-hash.txt"), `${hash}\n`, "utf8");
    console.log(JSON.stringify({ final: FINAL, hash, evidencePath, preview: path.join(WORKSPACE, "preview-draft.png") }));
  } finally {
    await closeStructureRuntime();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
