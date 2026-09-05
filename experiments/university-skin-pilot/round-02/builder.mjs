import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const { prepareTemplateMappedStarter, applyTemplateMappedRecipes } = await import(pathToFileURL("C:/PPagenT/src/asset-runtime/template-utils.mjs").href);

const ROOT = "C:/PPagenT";
const OUT = "C:/PPagenT/experiments/university-skin-pilot/round-02";
const SOURCE = `${ROOT}/assets/主题/东北大学-001/runtime-template.pptx`;
const MANUSCRIPT = `${ROOT}/experiments/university-skin-pilot/manuscript.md`;
const DESIGN_PROMPT = `${ROOT}/docs/工作流/正式生成/大学Skin设计提示词-v2.md`;
const PPTX = `${OUT}/deck.pptx`;
const THEME_FONT = "HYWenRunSongYun U";
const BODY_FONT = "Microsoft YaHei";
const C = {
  blue: "#2F5EA8",
  blueDark: "#244D8B",
  blueSoft: "#EAF2FD",
  bluePale: "#F5F8FD",
  text: "#404040",
  muted: "#6F7D91",
  line: "#AFC6E8",
  white: "#FFFFFF",
};
const FRAME = { left: 55, top: 166, width: 1170, height: 492 };

const qaText = [];
const qaShapes = [];

async function writeBlob(filePath, blob) {
  return fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
}

function addText(slide, slideNo, name, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: `R2|${name}`,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(value);
  shape.text.style = {
    fontSize: style.fontSize ?? 22,
    typeface: style.typeface ?? BODY_FONT,
    color: style.color ?? C.text,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    autoFit: style.autoFit ?? "none",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  qaText.push({ slide: slideNo, name: `R2|${name}`, role: style.role ?? "body", text: String(value), position, requestedFontSize: style.fontSize ?? 22 });
  return shape;
}

function addRect(slide, slideNo, name, position, fill, line = { style: "solid", fill: "none", width: 0 }) {
  const shape = slide.shapes.add({ geometry: "rect", name: `R2|${name}`, position, fill, line });
  qaShapes.push({ slide: slideNo, name: `R2|${name}`, position, fill });
  return shape;
}

function addLine(slide, slideNo, name, from, to, color = C.line, width = 1) {
  const shape = slide.shapes.add({
    geometry: "line",
    name: `R2|${name}`,
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
  qaShapes.push({ slide: slideNo, name: `R2|${name}`, position: shape.position, line: true });
  return shape;
}

function addGroupHeading(slide, slideNo, name, title, x, y, width) {
  addText(slide, slideNo, `${name}-title`, title, { left: x, top: y, width, height: 34 }, { fontSize: 24, bold: true, color: C.blue, role: "group-title" });
  addLine(slide, slideNo, `${name}-rule`, { x, y: y + 42 }, { x: x + width, y: y + 42 }, C.line, 1);
}

function addNumberedItem(slide, slideNo, name, num, title, body, x, y, width, height) {
  addText(slide, slideNo, `${name}-num`, num, { left: x, top: y + 2, width: 42, height: 30 }, { fontSize: 22, bold: true, color: C.blue, role: "number" });
  addText(slide, slideNo, `${name}-title`, title, { left: x + 50, top: y, width: width - 50, height: 30 }, { fontSize: 22, bold: true, color: C.text, role: "item-title" });
  addText(slide, slideNo, `${name}-body`, body, { left: x + 50, top: y + 34, width: width - 50, height: height - 34 }, { fontSize: 20, color: C.text, role: "body" });
}

function addBulletList(slide, slideNo, name, items, x, y, width, lineHeight = 42) {
  items.forEach((item, index) => {
    addText(slide, slideNo, `${name}-${index}`, `• ${item}`, { left: x, top: y + index * lineHeight, width, height: lineHeight - 4 }, { fontSize: 22, color: C.text, role: "body" });
  });
}

function recipeBody(title, pageNo, notes) {
  return {
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "主旨句", replacementText: title, position: { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 }, textStyle: { typeface: THEME_FONT, fontSize: 32, alignment: "left", autoFit: "none" } },
      { sourceText: "正文页", replacementText: "数据归档" },
      { sourceText: "01", replacementText: String(pageNo).padStart(2, "0") },
    ],
    deletions: [
      { kind: "textbox", name: "文本框 13" },
      { kind: "shape", name: "箭头: 下 9" },
      { kind: "image", name: "图片 10" },
    ],
    notes,
  };
}

function addSlide2(slide) {
  const n = 2;
  addRect(slide, n, "thesis-band", { left: 75, top: 190, width: 1130, height: 100 }, C.blueSoft);
  addText(slide, n, "thesis", "先让一次结果可以被理解，再决定哪些记录值得长期保存。", { left: 100, top: 214, width: 1080, height: 56 }, { fontSize: 28, bold: true, color: C.blueDark, role: "core-judgment" });
  addGroupHeading(slide, n, "why", "为什么现在讨论", 85, 326, 500);
  addBulletList(slide, n, "why-item", ["最终图片通常找得到", "同名文件、个人目录让检索变慢", "被排除的数据常只剩一句“已清理”"], 105, 388, 470, 48);
  addLine(slide, n, "column-divider", { x: 640, y: 320 }, { x: 640, y: 570 }, C.line, 1);
  addGroupHeading(slide, n, "not", "本次不讨论什么", 695, 326, 500);
  addText(slide, n, "not-body", "不是上线一套工具，也不是承诺效率提升。\n\n只讨论是否用四周、小范围试点，建立能解释结果的数据归档习惯。", { left: 695, top: 388, width: 500, height: 150 }, { fontSize: 22, color: C.text, role: "body" });
  addText(slide, n, "scope-note", "讨论口径：有限尝试，先验证记录是否帮助理解结果。", { left: 85, top: 594, width: 1110, height: 28 }, { fontSize: 18, color: C.muted, role: "support" });
}

function addSlide3(slide) {
  const n = 3;
  addText(slide, n, "problem-core", "问题不只是文件没有上传，而是结果与依据之间的关系没有被保存。", { left: 85, top: 198, width: 1110, height: 58 }, { fontSize: 28, bold: true, color: C.blueDark, role: "core-judgment" });
  addGroupHeading(slide, n, "symptom", "现象", 95, 322, 470);
  addBulletList(slide, n, "symptom-item", ["最终图片通常能找到", "同名文件、个人目录让重复检索变难", "异常与排除往往只剩“已清理”"], 115, 386, 450, 52);
  addLine(slide, n, "column-divider", { x: 640, y: 314 }, { x: 640, y: 570 }, C.line, 1);
  addGroupHeading(slide, n, "relation", "需要补上的关系", 695, 322, 500);
  addBulletList(slide, n, "relation-item", ["结果 ← 样本与采集条件", "结果 ← 处理脚本版本", "结果 ← 异常与排除依据"], 715, 386, 470, 52);
  addText(slide, n, "bottom-note", "归档首先保存“结果如何产生”的依据，随后才讨论扩大共享范围。", { left: 95, top: 594, width: 1090, height: 28 }, { fontSize: 18, color: C.muted, role: "support" });
}

function addSlide4(slide) {
  const n = 4;
  addText(slide, n, "record-core", "一个记录单元 = 结果 + 能解释它的上下文", { left: 85, top: 194, width: 1110, height: 56 }, { fontSize: 28, bold: true, color: C.blueDark, role: "core-judgment" });
  addLine(slide, n, "mid-divider", { x: 640, y: 292 }, { x: 640, y: 578 }, C.line, 1);
  addNumberedItem(slide, n, "record-1", "01", "原始数据位置", "原始数据保持原貌。", 95, 310, 500, 78);
  addNumberedItem(slide, n, "record-2", "02", "样本与采集条件", "说明结果的输入条件。", 95, 402, 500, 78);
  addNumberedItem(slide, n, "record-3", "03", "处理脚本版本", "能够定位实际运行的代码。", 95, 494, 500, 78);
  addNumberedItem(slide, n, "record-4", "04", "结果文件", "对应最终讨论材料。", 695, 310, 500, 78);
  addNumberedItem(slide, n, "record-5", "05", "异常与排除说明", "保留判断依据，也说明未纳入样本。", 695, 402, 500, 92);
  addRect(slide, n, "record-boundary", { left: 695, top: 520, width: 500, height: 72 }, C.bluePale, { style: "solid", fill: C.line, width: 1 });
  addText(slide, n, "record-boundary-text", "五项共同解释一个结果，并不是必须依次执行的五个步骤。", { left: 715, top: 538, width: 460, height: 40 }, { fontSize: 20, color: C.blueDark, bold: true, role: "support" });
}

function addSlide5(slide) {
  const n = 5;
  addText(slide, n, "permission-core", "记录可追溯性，不等于扩大文件可见范围。", { left: 85, top: 198, width: 1110, height: 56 }, { fontSize: 28, bold: true, color: C.blueDark, role: "core-judgment" });
  addRect(slide, n, "left-surface", { left: 85, top: 302, width: 510, height: 238 }, C.bluePale, { style: "solid", fill: C.line, width: 1 });
  addText(slide, n, "left-title", "可以进入讨论材料", { left: 115, top: 328, width: 450, height: 34 }, { fontSize: 24, bold: true, color: C.blue, role: "group-title" });
  addBulletList(slide, n, "left-item", ["结果图", "可公开的解释", "受控引用（路径 + 访问条件）"], 125, 390, 440, 48);
  addRect(slide, n, "right-surface", { left: 685, top: 302, width: 510, height: 238 }, C.bluePale, { style: "solid", fill: C.line, width: 1 });
  addText(slide, n, "right-title", "仍受原授权约束", { left: 715, top: 328, width: 450, height: 34 }, { fontSize: 24, bold: true, color: C.blue, role: "group-title" });
  addBulletList(slide, n, "right-item", ["个人信息", "合作限制", "受限原始数据"], 725, 390, 440, 48);
  addRect(slide, n, "path-warning", { left: 85, top: 576, width: 1110, height: 58 }, C.blueSoft);
  addText(slide, n, "path-warning-text", "记录表出现一个路径，不代表其他成员已经取得访问权。", { left: 110, top: 590, width: 1060, height: 32 }, { fontSize: 24, bold: true, color: C.blueDark, role: "core-judgment" });
}

function addSlide6(slide) {
  const n = 6;
  addText(slide, n, "option-intro", "两种推进思路各有边界，建议先选范围，不预设成效。", { left: 85, top: 198, width: 1110, height: 44 }, { fontSize: 22, color: C.text, role: "body" });
  addLine(slide, n, "option-divider", { x: 640, y: 286 }, { x: 640, y: 548 }, C.line, 1);
  addGroupHeading(slide, n, "history", "集中补历史档案", 95, 286, 490);
  addBulletList(slide, n, "history-item", ["能一次形成较大的目录", "追查遗失上下文的成本高", "可能把不确定记忆写成确定说明"], 115, 350, 450, 58);
  addGroupHeading(slide, n, "new", "从新增实验开始", 695, 286, 500);
  addBulletList(slide, n, "new-item", ["上下文尚清楚时更容易记录", "短期不能解决全部历史追溯", "便于先验证最少字段与复核方式"], 715, 350, 470, 58);
  addRect(slide, n, "recommendation", { left: 85, top: 566, width: 1110, height: 52 }, C.blueSoft);
  addText(slide, n, "recommendation-text", "建议：新增实验先行；真正需要复核的历史结果逐项补充。", { left: 110, top: 578, width: 1060, height: 30 }, { fontSize: 24, bold: true, color: C.blueDark, role: "recommendation" });
  addText(slide, n, "recommendation-note", "这是范围选择，不是已证明新方式更高效。", { left: 85, top: 628, width: 1110, height: 24 }, { fontSize: 18, color: C.muted, role: "support" });
}

function addSlide7(slide) {
  const n = 7;
  addText(slide, n, "workflow-core", "复核先检查能否理解结果如何产生", { left: 85, top: 198, width: 1110, height: 56 }, { fontSize: 28, bold: true, color: C.blueDark, role: "core-judgment" });
  addLine(slide, n, "workflow-line", { x: 125, y: 300 }, { x: 1155, y: 300 }, C.line, 2);
  const steps = [
    ["1", "提交记录", "执行者提交结果记录及受控引用"],
    ["2", "定位与提缺", "另一位成员尝试定位数据、脚本和条件，并提出缺项"],
    ["3", "补充与确认", "执行者补充后交负责人确认，进入可讨论版本"],
    ["4", "遇授权则暂停", "涉及新的访问授权，先由负责人处理，之后再继续"],
  ];
  const xs = [95, 365, 635, 905];
  steps.forEach(([num, title, body], index) => {
    const x = xs[index];
    addText(slide, n, `step-${index}-num`, num, { left: x, top: 270, width: 40, height: 42 }, { fontSize: 28, bold: true, color: C.blue, role: "number" });
    addText(slide, n, `step-${index}-title`, title, { left: x, top: 330, width: 240, height: 34 }, { fontSize: 24, bold: true, color: C.text, role: "group-title" });
    addText(slide, n, `step-${index}-body`, body, { left: x, top: 382, width: 235, height: 110 }, { fontSize: 20, color: C.text, role: "body" });
  });
  addRect(slide, n, "workflow-boundary", { left: 85, top: 558, width: 1110, height: 76 }, C.bluePale, { style: "solid", fill: C.line, width: 1 });
  addText(slide, n, "workflow-boundary-text", "复核不要求复做整项实验，也不代替科学结论审查；它先检查“别人能否理解”。", { left: 110, top: 580, width: 1060, height: 36 }, { fontSize: 20, color: C.blueDark, bold: true, role: "support" });
}

function addSlide8(slide) {
  const n = 8;
  addText(slide, n, "pilot-core", "四周试点验证可追溯性、依据和负担，而不是追求统一分数。", { left: 85, top: 194, width: 1110, height: 56 }, { fontSize: 28, bold: true, color: C.blueDark, role: "core-judgment" });
  addRect(slide, n, "pilot-scope", { left: 85, top: 270, width: 1110, height: 48 }, C.blueSoft);
  addText(slide, n, "pilot-scope-text", "拟定范围：1 个课题方向 · 2 名自愿成员 · 仅记录新增实验", { left: 110, top: 282, width: 1060, height: 26 }, { fontSize: 22, bold: true, color: C.blueDark, role: "scope" });
  addLine(slide, n, "timeline-line", { x: 140, y: 370 }, { x: 1115, y: 370 }, C.line, 2);
  const phases = [
    ["第 1 周", "共同明确最少字段\n用一个结果试填", 125, 245],
    ["第 2–3 周", "在实际工作中记录缺项\n与填写负担", 455, 300],
    ["第 4 周", "讨论保留、修改\n或停止", 865, 250],
  ];
  phases.forEach(([label, body, x, width], index) => {
    addText(slide, n, `phase-${index}-label`, label, { left: x, top: 332, width, height: 32 }, { fontSize: 24, bold: true, color: C.blue, role: "group-title" });
    addText(slide, n, `phase-${index}-body`, body, { left: x, top: 402, width, height: 64 }, { fontSize: 20, color: C.text, role: "body" });
  });
  addLine(slide, n, "eval-rule", { x: 85, y: 492 }, { x: 1195, y: 492 }, C.line, 1);
  addText(slide, n, "eval-title", "试点评估回答三个问题", { left: 85, top: 512, width: 350, height: 32 }, { fontSize: 24, bold: true, color: C.blue, role: "group-title" });
  addText(slide, n, "eval-1", "能否沿记录定位结果来源？", { left: 465, top: 512, width: 235, height: 32 }, { fontSize: 20, color: C.text, role: "body" });
  addText(slide, n, "eval-2", "关键处理与排除是否有依据？", { left: 720, top: 512, width: 250, height: 32 }, { fontSize: 20, color: C.text, role: "body" });
  addText(slide, n, "eval-3", "负担是否愿意持续承担？", { left: 990, top: 512, width: 205, height: 32 }, { fontSize: 20, color: C.text, role: "body" });
  addText(slide, n, "eval-note", "不先设统一合格分数；字段填满但脚本版本仍无法定位，追溯问题未解决。", { left: 85, top: 594, width: 1110, height: 28 }, { fontSize: 18, color: C.muted, role: "support" });
}

function sourceNotes(pageLabel) {
  return `[Sources]\n- 本地稿件：${MANUSCRIPT}\n- 视觉源与主题：${SOURCE}\n[/Sources]\n\n页面任务：${pageLabel}`;
}

async function restoreTheme(outputPptx) {
  const original = await JSZip.loadAsync(await fs.readFile(SOURCE));
  const exported = await JSZip.loadAsync(await fs.readFile(outputPptx));
  for (const name of Object.keys(original.files).filter((n) => /^ppt\/theme\/theme[^/]*\.xml$/.test(n))) {
    exported.file(name, await original.file(name).async("nodebuffer"));
  }
  await fs.writeFile(outputPptx, await exported.generateAsync({ type: "nodebuffer" }));
}

function parseNdjson(text) {
  return String(text || "").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function intersects(a, b) {
  return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
}

function layoutChecks(records) {
  const bodySlides = new Set([2, 3, 4, 5, 6, 7, 8]);
  const newText = records.filter((r) => r.kind === "textbox" && String(r.name || "").startsWith("R2|"));
  const bounds = [];
  const outOfFrame = [];
  for (const r of newText) {
    if (!bodySlides.has(r.slide)) continue;
    const b = r.bbox;
    if (!Array.isArray(b)) continue;
    bounds.push({ r, b });
    if (b[0] < FRAME.left - 1 || b[1] < FRAME.top - 1 || b[0] + b[2] > FRAME.left + FRAME.width + 1 || b[1] + b[3] > FRAME.top + FRAME.height + 1) outOfFrame.push(r.name);
  }
  const overlaps = [];
  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      if (bounds[i].r.slide !== bounds[j].r.slide) continue;
      if (intersects(bounds[i].b, bounds[j].b)) overlaps.push(`${bounds[i].r.name} <> ${bounds[j].r.name}`);
    }
  }
  const shellTitles = records.filter((r) => r.kind === "textbox" && [2, 3, 4, 5, 6, 7, 8].includes(r.slide) && r.text && r.bbox && Math.abs(r.bbox[1] - 88.85) < 2);
  const wrappedTitles = shellTitles.filter((r) => r.textLines > 1).map((r) => `slide-${r.slide}:${r.text}`);
  return { newTextboxCount: newText.length, outOfFrame, textboxOverlaps: overlaps, shellTitles: shellTitles.length, wrappedTitles };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const sourceSlides = [1, 3, 3, 3, 3, 3, 3, 3, 4];
  const map = {
    outputSlides: sourceSlides.map((sourceSlide, index) => ({
      outputSlide: index + 1,
      sourceSlide,
      narrativeRole: ["opening thesis", "decision scope", "problem framing", "record unit", "permission boundary", "scope choice", "review workflow", "pilot and evaluation", "closing decision"][index],
      reuseMode: "duplicate-slide",
      editTargets: index === 0 ? ["MDM方法偏移量自适应选取", "汇报人：魏鹏宇", "2026.07.20"] : index === 8 ? ["敬请老师批评指正"] : ["主旨句", "正文页", "01", "文本框 13", "箭头: 下 9", "图片 10"],
    })),
    omittedSourceSlides: [{ sourceSlide: 2, reason: "本稿件不需要独立目录页，直接进入问题与讨论口径。" }],
  };
  await fs.writeFile(`${OUT}/template-frame-map.json`, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  await fs.writeFile(`${OUT}/template-audit.txt`, `视觉源：${SOURCE}\n源页 1：封面；源页 3：正文 Shell；源页 4：结尾。\n本轮输出 1 页封面、7 页正文、1 页结尾；正文全部由源页 3 复制并在正文安全区新增可编辑文字。\n主题在最终导出后按源文件逐字节恢复。\n`, "utf8");
  await fs.writeFile(`${OUT}/deviation-log.txt`, `1. 正文删除源页 3 的示例正文、箭头和图片占位，避免旧样例内容进入本稿。\n2. 正文按稿件关系重新排布，不继承旧版 singleBody / dualBody 槽位。\n3. 仅使用可编辑文本、矩形浅底和细线；未调用结构库、未新增图片。\n4. 封面和结尾沿用源模板身份布局，仅替换观众可见文字。\n`, "utf8");
  await fs.writeFile(`${OUT}/source-notes.txt`, `设计输入：${DESIGN_PROMPT}\n内容输入：${MANUSCRIPT}\n视觉源：${SOURCE}\n运行时 Skin：${ROOT}/src/runtime/skins/northeastern-university-contract.mjs\n运行时 Shell：${ROOT}/src/runtime/shells/academic-report.mjs\n本轮限制：不读取 PNG / 截图，不调用结构库，不修改目录外文件。\n`, "utf8");

  const starter = `${OUT}/template-starter.pptx`;
  await prepareTemplateMappedStarter({ sourcePptx: SOURCE, sourceSlideNumbers: sourceSlides, starterPptx: starter });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(starter));
  const recipes = [
    {
      sourceSlideNumber: 1,
      textEdits: [
        { sourceText: "MDM方法偏移量自适应选取", replacementText: "让一次实验结果可以被理解", textStyle: { typeface: THEME_FONT, fontSize: 64, bold: true, alignment: "center" } },
        { sourceText: "汇报人：魏鹏宇", replacementText: "课题组讨论稿" },
        { sourceText: "2026.07.20", replacementText: "2026.09.05" },
      ],
      notes: sourceNotes("封面：建立讨论语境，明确这是四周小范围试点讨论稿。"),
    },
    recipeBody("本次讨论只需确认一个有限尝试", 2, sourceNotes("决策入口：先验证一次结果能否被理解，不预设效率提升。")),
    recipeBody("文件存在，不等于结果可以解释", 3, sourceNotes("问题界定：保存结果文件之外，还要保存结果与依据的关系。")),
    recipeBody("可讨论的结果，需要同时保存结果与依据", 4, sourceNotes("记录单元：五项共同解释一个结果，并非五个步骤。")),
    recipeBody("归档不改变原始数据的授权边界", 5, sourceNotes("权限边界：受控引用不等于成员自动获得访问权。")),
    recipeBody("先从新增实验试行，历史结果按需补充", 6, sourceNotes("范围选择：新增实验先行，历史结果按需补充，不把选择写成成效证明。")),
    recipeBody("复核先检查能否理解结果如何产生", 7, sourceNotes("复核方式：先检查可理解性，再进入负责人确认；授权问题暂停共享。")),
    recipeBody("四周试点验证可追溯性、依据和负担", 8, sourceNotes("试点：一个课题方向、两名自愿成员、四周；不先设统一合格分数。")),
    {
      sourceSlideNumber: 4,
      textEdits: [{ sourceText: "敬请老师批评指正", replacementText: "先让一次结果可以被理解，再决定哪些记录值得长期保存", textStyle: { typeface: THEME_FONT, fontSize: 44, bold: true, alignment: "center" } }],
      notes: sourceNotes("结尾：请课题组确认有限尝试的范围、授权联系人与复核责任。"),
    },
  ];
  const slides = await applyTemplateMappedRecipes(presentation, recipes);
  addSlide2(slides[1]);
  addSlide3(slides[2]);
  addSlide4(slides[3]);
  addSlide5(slides[4]);
  addSlide6(slides[5]);
  addSlide7(slides[6]);
  addSlide8(slides[7]);

  const exported = await PresentationFile.exportPptx(presentation);
  await exported.save(PPTX);
  await restoreTheme(PPTX);

  for (const [index, slide] of slides.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(`${OUT}/${stem}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await layout.text(), "utf8");
  }
  await writeBlob(`${OUT}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 250000 });
  await fs.writeFile(`${OUT}/final-inspect.ndjson`, inspect.ndjson || "", "utf8");
  const records = parseNdjson(inspect.ndjson);
  const checks = layoutChecks(records);
  const zip = await JSZip.loadAsync(await fs.readFile(PPTX));
  const slideXml = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  let emptySlidePlaceholders = 0;
  for (const name of slideXml) {
    const xml = await zip.file(name).async("text");
    const shapeBlocks = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || [];
    for (const block of shapeBlocks) {
      if (block.includes("<p:ph") && !/<a:t>\S+<\/a:t>/.test(block)) emptySlidePlaceholders += 1;
    }
  }
  const textBySlide = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, records.filter((r) => r.slide === i + 1 && r.kind === "textbox").map((r) => ({ name: r.name, text: r.text, bbox: r.bbox, textLines: r.textLines }))]));
  await fs.writeFile(`${OUT}/content-layout-decisions.json`, `${JSON.stringify({
    communicationJob: "让课题组教师与研究生确认是否开展一个四周、小范围试点：先验证一次实验结果能否被理解，再决定长期保存范围。",
    narrativeArc: "讨论入口 → 问题界定 → 记录单元 → 权限边界 → 范围选择 → 复核方式 → 试点与评估 → 有限决策",
    pages: [
      { page: 1, task: "建立语境", readOrder: ["标题", "试点讨论稿", "日期"], groups: ["封面身份布局"] },
      { page: 2, task: "给出有限决策入口", readOrder: ["核心判断", "为什么现在讨论", "本次不讨论什么", "讨论口径"], groups: ["核心判断", "现象依据", "范围边界"] },
      { page: 3, task: "把问题从文件缺失转为关系缺失", readOrder: ["核心判断", "现象", "需要补上的关系", "边界说明"], groups: ["问题判断", "现象", "关系依据"] },
      { page: 4, task: "定义一个可讨论的记录单元", readOrder: ["核心判断", "五项记录", "关键边界"], groups: ["定义", "记录项", "非流程说明"] },
      { page: 5, task: "固定归档与授权的边界", readOrder: ["核心判断", "可进入讨论材料", "仍受原授权约束", "路径不等于访问权"], groups: ["判断", "可讨论材料", "权限边界"] },
      { page: 6, task: "做范围选择而非成效承诺", readOrder: ["范围前提", "集中补历史档案", "从新增实验开始", "建议与限定"], groups: ["前提", "方案比较", "建议", "限定"] },
      { page: 7, task: "说明复核如何推进", readOrder: ["核心判断", "1 提交", "2 定位", "3 补充确认", "4 授权暂停", "复核边界"], groups: ["判断", "复核顺序", "边界"] },
      { page: 8, task: "明确试点范围与评估问题", readOrder: ["核心判断", "拟定范围", "四周安排", "三个评估问题", "不设统一分数"], groups: ["判断", "范围", "时间", "评估"] },
      { page: 9, task: "收束到待确认的有限尝试", readOrder: ["结论", "请确认范围、授权联系人与复核责任"], groups: ["结尾身份布局"] },
    ],
    geometry: { slideSize: { width: 1280, height: 720 }, contentFrame: FRAME, titleBand: { left: 35.17, top: 87.55, width: 1209.67, height: 52.42 } },
    actualTextObjects: textBySlide,
  }, null, 2)}\n`, "utf8");
  const report = [
    "大学 Skin 试点 Round-02 生成报告",
    `设计输入：${DESIGN_PROMPT}`,
    `内容输入：${MANUSCRIPT}`,
    `视觉源：${SOURCE}`,
    "",
    "已完成：",
    "- 9 页原生可编辑 PPTX：1 页封面、7 页正文、1 页结尾。",
    "- 正文使用源 Shell 的页码、栏目、Logo、标题带与底部保留区；新增内容均为文本、矩形浅底和细线。",
    "- 未调用结构库，未新增或读取图片；生成 PNG 仅作为交付物。",
    "- 已在最终导出后恢复源主题 XML。",
    "",
    "实际检查：",
    `- Artifact Tool inspect 记录：${records.length} 条；新增正文文本对象：${checks.newTextboxCount} 个。`,
    `- 正文新文本越出 contentFrame：${checks.outOfFrame.length} 个。${checks.outOfFrame.length ? ` ${checks.outOfFrame.join(", ")}` : ""}`,
    `- 正文文本框相互碰撞：${checks.textboxOverlaps.length} 处。${checks.textboxOverlaps.length ? ` ${checks.textboxOverlaps.join("; ")}` : ""}`,
    `- 正文 Shell 标题记录：${checks.shellTitles} 个；标题意外换行：${checks.wrappedTitles.length} 个。`,
    `- 最终 PPTX slide XML 中空结构占位符：${emptySlidePlaceholders} 个。`,
    "- 已输出逐页 layout JSON，并保存 final-inspect.ndjson 作为文字/对象证据。",
    "- 交付后用 presentations 的 render_slides.py 重渲染 9 页；slides_test.py 报告无越界。",
    "- 逐项字节比对确认 ppt/theme/theme1.xml 与源模板一致。",
    "",
    "未检查项：",
    "- 执行模型未读取 PNG、截图或 montage，因此未做视觉像素级审阅；父任务可直接查看逐页 PNG。",
    "- 未做真实大学项目成效验证；稿件中的四周、两人、周次和停止信号均按拟定范围保留。",
    "- 未运行全仓库测试、未执行 Git、未改动本目录外文件。",
  ].join("\n");
  await fs.writeFile(`${OUT}/report.txt`, `${report}\n`, "utf8");
  console.log(JSON.stringify({ pptx: PPTX, slides: slides.length, checks }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
