import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const runDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(runDir, "build");
const outDir = runDir;
const evidencePath = path.join(runDir, "structure-invocations.ndjson");
const candidatePath = path.join(buildDir, "candidate.pptx");
const finalizedPath = path.join(outDir, "final", "deck.pptx");
const finalPath = path.join(outDir, "deck.pptx");

const colors = {
  background: "#F5F4EF",
  surface: "#EEECE5",
  dark: "#20201D",
  body: "#4B4A45",
  muted: "#85837B",
  line: "#D8D5CC",
  accent: "#A35D4F",
};

const skin = {
  id: "neutral-editorial-001",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentSourceFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: {
    background: colors.background,
    surface: colors.surface,
    dark: colors.dark,
    body: colors.body,
    muted: colors.muted,
    line: colors.line,
    primaryColor: colors.accent,
    font: "Noto Sans SC",
    typography: {
      componentHeading: 21,
      componentTitle: 18,
      componentItemTitle: 17,
      componentBody: 14,
      componentLabel: 16,
      componentMeta: 13,
    },
  },
};

function addText(slide, text, position, style) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: style.typeface,
    fontSize: style.fontSize,
    bold: style.bold ?? false,
    color: style.color,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

async function writeBlob(blob, output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, Buffer.from(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = colors.background;

  // Skin page header: chapter marker, title, and a thin editorial rule.
  addText(slide, "02", { left: 56, top: 47, width: 42, height: 27 }, {
    name: "shell-chapter-number",
    typeface: "Noto Sans SC",
    fontSize: 17,
    bold: true,
    color: colors.accent,
  });
  addText(slide, "预约方式的取舍", { left: 108, top: 45, width: 270, height: 33 }, {
    name: "shell-page-title",
    typeface: "Noto Serif SC",
    fontSize: 25,
    bold: true,
    color: colors.dark,
  });
  slide.shapes.add({
    geometry: "rect",
    name: "shell-title-rule",
    position: { left: 400, top: 62, width: 823, height: 1 },
    fill: colors.line,
    line: { style: "solid", fill: "none", width: 0 },
  });
  addText(slide, "当前问题集中在时间冲突与通知遗漏", { left: 56, top: 112, width: 520, height: 24 }, {
    name: "lead-constraint",
    typeface: "Noto Sans SC",
    fontSize: 15,
    color: colors.muted,
  });

  const content = {
    title: "预约方式的取舍",
    items: [
      {
        id: "ad-hoc-coordination",
        title: "临时协调",
        polarity: "negative",
        points: ["逐人询问", "口头确认", "重复转告"],
      },
      {
        id: "unified-booking",
        title: "统一预约",
        polarity: "positive",
        emphasis: true,
        points: ["查看空闲时段", "保留调整记录", "集中展示停机"],
      },
    ],
  };

  try {
    await invokeStructure({
      root,
      slide,
      skin,
      assetId: "comparison-dual-verdict-001",
      parameters: {
        comparisonLabel: "VS",
        sides: [
          { title: "临时协调", tone: "negative", items: ["逐人询问", "口头确认", "重复转告"] },
          { title: "统一预约", tone: "positive", items: ["查看空闲时段", "保留调整记录", "集中展示停机"] },
        ],
      },
      targetFrame: skin.bodyFrame,
      evidencePath,
      pageId: "page-01",
      regionId: "comparison-main",
      reason: "原稿是两个方案围绕三个共同维度的逐行对比，且明确建议统一预约",
    });
  } catch (error) {
    await fs.appendFile(evidencePath, JSON.stringify({
      at: new Date().toISOString(),
      event: "builder-abort",
      pageId: "page-01",
      regionId: "comparison-main",
      message: error.message,
    }) + "\n");
    throw error;
  } finally {
    await closeStructureRuntime();
  }

  // Native style adaptation: the neutral Skin reserves brick red for the
  // recommended option and keeps the comparison side visibly neutral.
  const byName = new Map(slide.shapes.items.map((shape) => [shape.name, shape]));
  const recolor = (name, fill) => {
    const shape = byName.get(name);
    if (shape) shape.fill = fill;
  };
  recolor("comparison-stage-outer", "#D8B8AF");
  recolor("comparison-stage-inner", colors.background);
  recolor("comparison-shadow-0", "#DDDAD2");
  recolor("comparison-surface-0", "#EEECE5");
  recolor("comparison-cap-top-0", "#85837B");
  recolor("comparison-cap-bottom-0", "#85837B");
  recolor("comparison-shadow-1", "#DECAC4");
  recolor("comparison-surface-1", "#EEECE5");
  recolor("comparison-cap-top-1", colors.accent);
  recolor("comparison-cap-bottom-1", colors.accent);
  for (let row = 0; row < 3; row += 1) {
    recolor(`comparison-row-0-${row}`, "#E7E5DE");
    recolor(`comparison-marker-0-${row}`, "#85837B");
    recolor(`comparison-row-1-${row}`, "#F0E3DF");
    recolor(`comparison-marker-1-${row}`, colors.accent);
    const leftText = byName.get(`comparison-row-text-0-${row}`);
    const rightText = byName.get(`comparison-row-text-1-${row}`);
    if (leftText) leftText.text.color = colors.body;
    if (rightText) rightText.text.color = colors.body;
  }
  const knot = byName.get("comparison-knot-core");
  if (knot) knot.fill = colors.accent;
  for (const name of ["comparison-surface-0", "comparison-surface-1", "comparison-knot-core"]) {
    const shape = byName.get(name);
    if (shape) shape.shadow = "shadow-none";
  }

  addText(slide, "建议来自本方案讨论；两种方式均保留必要的紧急插单。实施时仍需有人维护预约信息并处理插单。", {
    left: 56, top: 676, width: 1110, height: 23,
  }, {
    name: "footer-constraint-note",
    typeface: "Noto Sans SC",
    fontSize: 15,
    color: colors.muted,
  });
  addText(slide, "1", { left: 1177, top: 678, width: 28, height: 20 }, {
    name: "shell-page-number",
    typeface: "Noto Sans SC",
    fontSize: 13,
    color: colors.muted,
    alignment: "right",
  });
  slide.speakerNotes.textFrame.setText(
    "来源：experiments/neutral-structure-luna-batch-04/inputs/02-comparison.md。\n"
      + "沟通目的：说明实验室统一预约与临时协调的取舍，支持优先选择统一预约。\n"
      + "内容关系：两个对象围绕三个共同维度逐行对应，统一预约为方案讨论中的推荐方向；并保留紧急插单和维护预约信息的实施代价。\n"
      + "结构选型：直接调用 comparison-dual-verdict-001。三条要点满足两侧等数、一正一负、每条不超过16字的契约。\n"
      + "排版：neutral-editorial-001 / magazine；原生文字 fontSize 使用设计像素，组件 theme.typography 使用 CSS pt。",
  );

  await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
  await writeBlob(await presentation.export({ slide, format: "png", scale: 1 }), path.join(buildDir, "candidate.png"));
  await fs.writeFile(path.join(buildDir, "slide-01.layout.json"), await (await slide.export({ format: "layout" })).text(), "utf8");
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 200000 });
  await fs.writeFile(path.join(buildDir, "inspect.ndjson"), inspect.ndjson, "utf8");
  const skillDir = process.env.SKILL_DIR;
  if (!path.isAbsolute(skillDir ?? "")) throw new Error("SKILL_DIR must be absolute for finalization");
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
  await fs.mkdir(path.dirname(finalizedPath), { recursive: true });
  await finalizePresentation({
    explicitTotalSlideCount: 1,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir: root,
    candidatePath,
    finalPath: finalizedPath,
    pythonExecutable: process.env.RUNTIME_PYTHON,
    integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
    fontPolicy: { basis: "design", families: ["Noto Serif SC", "Noto Sans SC"] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(buildDir, "deck.pptx.validation.json"),
  });
  await fs.copyFile(finalizedPath, finalPath);
  const finalPresentation = await PresentationFile.importPptx(await FileBlob.load(finalPath));
  const finalSlide = finalPresentation.slides.items[0];
  await writeBlob(await finalPresentation.export({ slide: finalSlide, format: "png", scale: 1 }), path.join(outDir, "deck-rendered.png"));
  await fs.writeFile(path.join(outDir, "inspect-final.ndjson"), (await finalPresentation.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 200000 })).ndjson, "utf8");
  await fs.writeFile(path.join(outDir, "layout-final.json"), await (await finalSlide.export({ format: "layout" })).text(), "utf8");
  console.log(JSON.stringify({ candidatePath, evidencePath, inspectPath: path.join(buildDir, "inspect.ndjson") }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
