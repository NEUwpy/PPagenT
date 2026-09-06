import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import JSZip from "jszip";
import {
  prepareTemplateMappedStarter,
  applyTemplateMappedRecipes,
} from "file:///C:/PPagenT/src/asset-runtime/template-utils.mjs";
import { addBox, addLine, addText } from "file:///C:/PPagenT/src/asset-runtime/component-builders.mjs";
import { northeasternUniversitySkin as skin } from "file:///C:/PPagenT/src/runtime/skins/northeastern-university-contract.mjs";
import { academicReportShell as shell } from "file:///C:/PPagenT/src/runtime/shells/academic-report.mjs";

const ROUND = "C:/PPagenT/experiments/university-skin-pilot/round-01";
const SOURCE = "C:/PPagenT/assets/主题/东北大学-001/runtime-template.pptx";
const OUTPUT = path.join(ROUND, "deck.pptx");
const ATTEMPT = "attempt-01";
const BODY = shell.slots.contentFrame;
const COLORS = {
  blue: "#2F5EA8",
  dark: "#404040",
  muted: "#6F7D91",
  line: "#B9CBE0",
  pale: "#EFF5FB",
  paleStrong: "#DCEBFA",
  white: "#FFFFFF",
};
const TYPE = {
  heading: skin.typographyRoles.bodyTypeface,
  display: skin.typographyRoles.displayTypeface,
};
const SIZE = { core: 28, group: 24, body: 22, assist: 18, source: 16 };

const pages = [
  {
    id: "p01-cover",
    sourceSlide: 1,
    title: "实验数据归档：先把一次结果说明白",
    presenter: "课题组教师与研究生讨论稿",
    date: "拟议四周试点",
    role: "opening thesis",
  },
  {
    id: "p02-problem",
    sourceSlide: 3,
    pageTitle: "先解决“能不能解释”，再讨论“要不要共享”",
    role: "problem and boundary",
    groups: [
      { kind: "core", text: "文件存在，不等于结果可以解释。", frame: { left: 55, top: 178, width: 1170, height: 48 } },
      { kind: "heading", text: "讨论中反复出现的缺口", frame: { left: 55, top: 258, width: 1170, height: 34 } },
      { kind: "body", text: "找到最终图片，却说不清来自哪批样本、用了哪版脚本、哪些数据被排除。\n同名文件和个人目录让重复检索变难。", frame: { left: 55, top: 304, width: 1170, height: 78 } },
      { kind: "heading", text: "本次试点的边界", frame: { left: 55, top: 430, width: 1170, height: 34 } },
      { kind: "body", text: "先保存结果与依据之间的关系，再讨论扩大共享范围。\n目标是让一次结果可以被理解，不预设效率提升。", frame: { left: 55, top: 476, width: 1170, height: 78 } },
    ],
  },
  {
    id: "p03-record-unit",
    sourceSlide: 3,
    pageTitle: "一个可讨论的结果，需要把结果与依据放在一起",
    role: "record unit",
    groups: [
      { kind: "core", text: "记录单元不是五步流程，而是共同解释一次结果的最小单元。", frame: { left: 55, top: 178, width: 1170, height: 48 } },
    ],
    rows: [
      ["01", "原始数据位置", "记录可定位的存放处；原始数据保持原貌。"],
      ["02", "样本与采集条件", "说明样本以及采集时影响解释的关键条件。"],
      ["03", "处理脚本版本", "能够定位实际运行的代码版本。"],
      ["04", "结果文件", "指向讨论时使用的图或结果文件。"],
      ["05", "异常与排除说明", "留下判断依据，解释未纳入结果的样本。"],
    ],
    foot: "五项共同解释一次结果，不代表必须依次执行的五个步骤。",
  },
  {
    id: "p04-access-boundary",
    sourceSlide: 3,
    pageTitle: "记录完整，不等于所有文件都应向所有人开放",
    role: "access boundary",
    groups: [
      { kind: "core", text: "归档保存可解释性，授权决定可见范围。", frame: { left: 55, top: 178, width: 1170, height: 48 } },
    ],
    columns: [
      { x: 55, w: 540, title: "可进入讨论材料", lines: ["结果图", "可公开的解释"], tone: "pale" },
      { x: 685, w: 540, title: "仍受原授权约束", lines: ["受限原始数据留在原授权位置。", "记录只保留受控引用与访问条件。", "个人信息或合作限制不能因归档改变。"], tone: "plain" },
    ],
    foot: "记录表中出现一个路径，也不代表其他成员已经取得访问权。",
  },
  {
    id: "p05-scope-choice",
    sourceSlide: 3,
    pageTitle: "试点先从新增实验开始，历史结果按需补充",
    role: "scope choice",
    groups: [
      { kind: "core", text: "建议采用范围选择，而不是宣称新方式更高效。", frame: { left: 55, top: 178, width: 1170, height: 48 } },
    ],
    columns: [
      { x: 55, w: 540, title: "集中补历史档案", lines: ["一次形成较大的目录。", "可能耗费时间追查已经遗失的上下文。", "可能把不确定记忆写成确定说明。"], tone: "plain" },
      { x: 685, w: 540, title: "先从新增实验开始", lines: ["在上下文尚清楚时记录。", "短期内无法解决全部历史材料的追溯。", "适合先验证记录是否支持复核。"], tone: "pale" },
    ],
    foot: "建议：新增实验先行；真正需要复核的历史结果逐项补充。",
  },
  {
    id: "p06-review-loop",
    sourceSlide: 3,
    pageTitle: "复核先检查“别人能否理解”，不代替科学结论审查",
    role: "review loop",
    groups: [
      { kind: "core", text: "复核先问：别人能否沿记录理解这个结果是怎么产生的？", frame: { left: 55, top: 178, width: 1170, height: 48 } },
    ],
    rows: [
      ["1", "执行者提交", "一个结果记录及受控引用。"],
      ["2", "另一位成员复核", "尝试定位数据、脚本和条件，并提出缺项。"],
      ["3", "执行者补充", "补齐后交给负责人确认。"],
      ["4", "负责人确认", "记录进入可讨论版本。"],
    ],
    foot: "若涉及新的访问授权：暂停共享，由负责人处理授权后再继续。\n复核不要求复做整项实验，也不代替科学结论审查。",
  },
  {
    id: "p07-pilot-evaluation",
    sourceSlide: 3,
    pageTitle: "四周试点只验证三件事，并保留停止条件",
    role: "pilot and evaluation",
    scope: "一个课题方向  ·  两名自愿成员  ·  只记录新增实验",
    weeks: [
      ["第 1 周", "共同明确最少字段，并用一个结果试填。"],
      ["第 2–3 周", "在实际工作中记录缺项与填写负担。"],
      ["第 4 周", "讨论是否保留、修改或停止。"],
    ],
    questions: [
      "能否沿记录定位结果的来源？",
      "关键处理与排除是否有可理解的依据？",
      "记录负担是否在成员愿意持续承担的范围内？",
    ],
    foot: "四周、两人和周次安排都是拟定范围，没有实测效率提升或完成率数字。",
    stop: "停止或修改信号：挤占必要实验时间、权限边界无法说明，或只增加重复抄写而没有帮助解释结果。",
  },
  {
    id: "p08-closing",
    sourceSlide: 4,
    pageTitle: "先让一次结果可以被理解\n再决定哪些记录值得长期保存",
    role: "closing synthesis",
  },
];

function noteFor(page) {
  return `[Sources]\n- 稿件：C:/PPagenT/experiments/university-skin-pilot/manuscript.md\n- Shell/主题：C:/PPagenT/assets/主题/东北大学-001/runtime-template.pptx\n- 参考身份模板：C:/PPagenT/PPT源/PPT模板-封面正文尾页.pptx\n[/Sources]\n\n本页沟通任务：${page.role}`;
}

function text(slide, value, frame, role, extra = {}) {
  const style = {
    name: `UNIV_SKIN|${role}`,
    typeface: role === "shell-title" ? TYPE.display : TYPE.heading,
    fontSize: SIZE[role] ?? SIZE.body,
    color: role === "core" || role === "heading" ? COLORS.blue : role === "assist" || role === "source" ? COLORS.muted : COLORS.dark,
    bold: role === "core" || role === "heading" || role === "row-title",
    alignment: extra.alignment ?? "left",
    verticalAlignment: extra.verticalAlignment ?? "top",
    autoFit: "none",
    protectLineBreaks: true,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    ...extra,
  };
  return addText(slide, value, frame, style);
}

function divider(slide, x1, y1, x2, y2, name = "divider") {
  return addLine(slide, { x: x1, y: y1 }, { x: x2, y: y2 }, COLORS.line, 1.2, `UNIV_SKIN|${name}`);
}

function renderRows(slide, rows, startTop, rowHeight = 72) {
  rows.forEach(([number, title, body], index) => {
    const top = startTop + index * rowHeight;
    text(slide, number, { left: 55, top, width: 48, height: 24 }, "assist", { color: COLORS.blue, bold: true });
    text(slide, title, { left: 112, top, width: 280, height: 28 }, "row-title");
    text(slide, body, { left: 410, top, width: 815, height: 32 }, "body");
    if (index < rows.length - 1) divider(slide, 112, top + 48, 1225, top + 48, `row-${index + 1}`);
  });
}

function renderBodyPage(slide, page) {
  // The inherited body placeholder/arrow/image are removed by the recipe.
  if (page.groups) for (const group of page.groups) text(slide, group.text, group.frame, group.kind);
  if (page.rows) {
    const start = page.id === "p03-record-unit" ? 258 : 258;
    renderRows(slide, page.rows, start, page.id === "p06-review-loop" ? 76 : 72);
  }
  if (page.columns) {
    const top = 260;
    for (const column of page.columns) {
      if (column.tone === "pale") addBox(slide, { left: column.x, top, width: column.w, height: 232 }, { geometry: "rect", fill: COLORS.pale, line: { style: "solid", fill: COLORS.paleStrong, width: 1 }, shadow: "shadow-none" });
      text(slide, column.title, { left: column.x + 24, top: top + 20, width: column.w - 48, height: 34 }, "heading");
      column.lines.forEach((line, index) => text(slide, `—  ${line}`, { left: column.x + 24, top: top + 78 + index * 42, width: column.w - 48, height: 32 }, "body"));
    }
    divider(slide, 640, 270, 640, 478, "column-divider");
  }
  if (page.scope) {
    addBox(slide, { left: 55, top: 252, width: 1170, height: 42 }, { geometry: "rect", fill: COLORS.pale, line: { style: "solid", fill: COLORS.paleStrong, width: 1 }, shadow: "shadow-none" });
    text(slide, page.scope, { left: 75, top: 262, width: 1130, height: 24 }, "heading", { alignment: "center" });
    page.weeks.forEach(([week, body], index) => {
      const top = 322 + index * 66;
      text(slide, week, { left: 55, top, width: 120, height: 26 }, "row-title");
      text(slide, body, { left: 210, top, width: 1015, height: 28 }, "body");
      if (index < page.weeks.length - 1) divider(slide, 210, top + 44, 1225, top + 44, `week-${index + 1}`);
    });
    text(slide, "评估问题", { left: 55, top: 520, width: 160, height: 30 }, "heading");
    page.questions.forEach((question, index) => text(slide, `${index + 1}  ${question}`, { left: 245, top: 520 + index * 31, width: 980, height: 26 }, "body"));
  }
  if (page.foot) {
    const top = page.id === "p03-record-unit" ? 622 : page.id === "p06-review-loop" ? 590 : page.id === "p07-pilot-evaluation" ? 620 : 520;
    text(slide, page.foot, { left: 55, top, width: 1170, height: page.foot.includes("\n") ? 46 : 28 }, "assist");
  }
  if (page.stop) text(slide, page.stop, { left: 55, top: 622, width: 1170, height: 28 }, "assist");
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function restoreTheme(finalPptx) {
  const original = await JSZip.loadAsync(await fs.readFile(SOURCE));
  const exported = await JSZip.loadAsync(await fs.readFile(finalPptx));
  const themeNames = Object.keys(original.files).filter((name) => /^ppt\/theme\/theme[^/]*\.xml$/.test(name));
  for (const name of themeNames) exported.file(name, await original.file(name).async("nodebuffer"));
  await fs.writeFile(finalPptx, await exported.generateAsync({ type: "nodebuffer" }));
  return themeNames;
}

async function inspectFinal(presentation) {
  const qaDir = path.join(ROUND, "qa-final");
  await fs.mkdir(qaDir, { recursive: true });
  const pagesQa = [];
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(ROUND, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layoutText = await (await slide.export({ format: "layout" })).text();
    await fs.writeFile(path.join(ROUND, `${stem}.layout.json`), layoutText);
    await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), layoutText);
    const layout = JSON.parse(layoutText);
    const elements = layout.elements ?? [];
    const slideText = elements.filter((item) => typeof item.text === "string").map((item) => item.text);
    const textBoxes = elements.filter((item) => item.kind === "shape" && typeof item.text === "string");
    const outOfCanvas = elements.filter((item) => {
      const b = item.bbox;
      return Array.isArray(b) && (b[0] < -0.1 || b[1] < -0.1 || b[0] + b[2] > 1280.1 || b[1] + b[3] > 720.1);
    });
    const bodyTextBoxes = textBoxes.filter((item) => item.bbox?.[0] >= BODY.left - 1 && item.bbox?.[1] >= BODY.top - 1 && item.bbox?.[0] + item.bbox?.[2] <= BODY.left + BODY.width + 1 && item.bbox?.[1] + item.bbox?.[3] <= BODY.top + BODY.height + 1);
    const minResolvedFont = textBoxes.map((item) => item.resolvedFontSize).filter((v) => Number.isFinite(v)).reduce((a, b) => Math.min(a, b), Infinity);
    pagesQa.push({ slide: index + 1, slideText, textBoxCount: textBoxes.length, bodyTextBoxCount: bodyTextBoxes.length, outOfCanvasCount: outOfCanvas.length, minResolvedFont: Number.isFinite(minResolvedFont) ? minResolvedFont : null, lineCounts: textBoxes.map((item) => ({ name: item.name, lineCount: item.textLayout?.lineCount ?? null, text: item.text })), });
  }
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,thread,layout", maxChars: 800000 });
  await fs.writeFile(path.join(ROUND, "final-inspect.ndjson"), inspect.ndjson ?? String(inspect));
  await fs.writeFile(path.join(ROUND, "qa-final.json"), JSON.stringify({ pages: pagesQa }, null, 2));
  return pagesQa;
}

async function main() {
  await fs.mkdir(ROUND, { recursive: true });
  const frameMap = {
    outputSlides: pages.map((page, index) => ({ outputSlide: index + 1, sourceSlide: page.sourceSlide, narrativeRole: page.role, reuseMode: "duplicate-slide", editTargets: page.sourceSlide === 3 ? ["page number", "section label", "page title", "legacy body objects"] : ["cover/closing title identity"] })),
    omittedSourceSlides: [{ sourceSlide: 2, reason: "目录模板不推进本次稿件的连续论证，正文页用于承载问题、边界与试点判断。" }],
  };
  await fs.writeFile(path.join(ROUND, "template-frame-map.json"), JSON.stringify(frameMap, null, 2));
  await fs.writeFile(path.join(ROUND, `${ATTEMPT}.json`), JSON.stringify({ attempt: ATTEMPT, startedAt: new Date().toISOString(), output: OUTPUT, source: SOURCE }, null, 2));

  const starter = path.join(ROUND, "template-starter.pptx");
  await prepareTemplateMappedStarter({ sourcePptx: SOURCE, sourceSlideNumbers: pages.map((page) => page.sourceSlide), starterPptx: starter });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(starter));
  const recipes = pages.map((page, index) => {
    if (page.sourceSlide === 1) return {
      sourceSlideNumber: 1,
      textEdits: [
        { sourceText: "MDM方法偏移量自适应选取", replacementText: page.title },
        { sourceText: "汇报人：魏鹏宇", replacementText: page.presenter },
        { sourceText: "2026.07.20", replacementText: page.date },
      ],
      notes: noteFor(page),
    };
    if (page.sourceSlide === 4) return {
      sourceSlideNumber: 4,
      textEdits: [{ sourceText: "敬请老师批评指正", replacementText: page.pageTitle, textStyle: { typeface: TYPE.display, fontSize: 40, alignment: "center", autoFit: "none" } }],
      notes: noteFor(page),
    };
    return {
      sourceSlideNumber: 3,
      textEdits: [
        { sourceText: "01", replacementText: String(index + 1).padStart(2, "0") },
        { sourceText: "正文页", replacementText: "实验归档试点" },
        { sourceText: "主旨句", replacementText: page.pageTitle, position: shell.slots.pageTitle, textStyle: { typeface: TYPE.display, fontSize: 32, alignment: "left", autoFit: "none" } },
      ],
      deletions: [{ kind: "shape", name: "箭头: 下 9" }, { kind: "image", name: "图片 10" }, { kind: "shape", name: "文本框 13" }],
      notes: noteFor(page),
    };
  });
  const slides = await applyTemplateMappedRecipes(presentation, recipes);
  pages.forEach((page, index) => { if (page.sourceSlide === 3) renderBodyPage(slides[index], page); });
  await (await PresentationFile.exportPptx(presentation)).save(OUTPUT);
  const restoredThemes = await restoreTheme(OUTPUT);
  const qa = await inspectFinal(presentation);
  await fs.writeFile(path.join(ROUND, "content-decisions.txt"), [
    "Communication job: 让课题组教师与研究生理解：本次建议是一个有限的四周尝试，先验证结果能否被解释，再决定长期保存范围。",
    "Narrative: 问题与边界 -> 记录单元 -> 授权边界 -> 范围选择 -> 复核机制 -> 四周评估 -> 有限结论。",
    "Content preservation: 稿件中的问题、五项记录内容、原始数据/脚本/排除条件、授权边界、两种推进思路、复核顺序、四周范围、三项评估问题、停止信号和未有成效数字的限定均保留；仅做分页和短句化重排。",
    "Excluded: 未调用结构库；未新增复杂关系图；未把试点写成已证明更高效；未把路径写成访问授权。",
  ].join("\n"));
  await fs.writeFile(path.join(ROUND, "template-audit.txt"), [
    "Read sources: runtime-template.pptx and PPT模板-封面正文尾页.pptx; each has 4 slides.",
    "Source slide 1: cover identity; slide 2: agenda; slide 3: body shell; slide 4: closing identity.",
    "Body shell object inventory: page title, section label, page number, inherited divider/Logo/title band, legacy arrow, legacy image, legacy body text.",
    `Reference theme entries restored byte-for-byte: ${restoredThemes.join(", ")}.`,
    "Template inspection script could not run on Windows because it invokes a missing unzip executable; a local tar-backed shim was used only for the source audit, and artifact-tool import/export/layout inspection was completed successfully.",
  ].join("\n"));
  await fs.writeFile(path.join(ROUND, "deviation-log.txt"), [
    "Body pages reuse source slide 3 shell but replace its legacy arrow/image/body placeholder with native editable text groups inside the contracted contentFrame.",
    "Source slide 2 agenda is omitted because it would interrupt the manuscript's cumulative question-to-decision flow.",
    "Theme XML is restored from runtime-template after export; no theme XML was authored from scratch.",
  ].join("\n"));
  await fs.writeFile(path.join(ROUND, "report.txt"), [
    `Attempt: ${ATTEMPT}`,
    `Output: ${OUTPUT}`,
    `Slides: ${pages.length}; per-slide PNG and layout JSON exported to ${ROUND}.`,
    "Design inputs actually read: 大学Skin设计提示词-v1.md; manuscript.md; runtime-template.pptx; PPT模板-封面正文尾页.pptx; northeastern-university-contract.mjs; academic-report.mjs; component-builders.mjs; penguin-harness-v2/grid-native.mjs (import/copy/export/theme preservation utilities only).",
    "Content retention: all manuscript facts, conditions, negative claims, scope limits, authorization boundary, evaluation questions, stop signals, and absence of measured efficiency/completion numbers are retained; copy is shortened only for readable page composition.",
    "Checks performed on actual artifact-tool exported objects and text: per-slide layout JSON; actual text strings and lineCount; body-frame containment for new text boxes; slide-canvas bounds; minimum resolved font size; final inspect NDJSON; final exported PPTX theme part restoration; speaker notes source blocks.",
    "Checks not performed: no page PNG, montage, or screenshot was visually inspected per user instruction; no semantic vision review; no font rendering check on a desktop PowerPoint installation; no full project test suite.",
    "Special source-template objects: inherited Logo/title band/dividers and cover/closing identity retained; legacy body arrow/image were intentionally removed and are separately disclosed in deviation-log.txt.",
    "The template inventory helper required unzip, unavailable in this Windows runtime; source structure was independently imported and inspected with artifact-tool, and the tar-backed shim was used only to list/read PPTX package entries.",
    `QA summary: ${JSON.stringify(qa.map((item) => ({ slide: item.slide, textBoxCount: item.textBoxCount, bodyTextBoxCount: item.bodyTextBoxCount, outOfCanvasCount: item.outOfCanvasCount, minResolvedFont: item.minResolvedFont })))}`,
  ].join("\n"));
  console.log(JSON.stringify({ output: OUTPUT, slides: pages.length, restoredThemes, qa }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
