import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../src/runtime/skins/northeastern-university.mjs";
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin, universityMckinseyTypography } from "../../src/runtime/invoke-university-structure.mjs";
import { resolveStructureTheme } from "../../src/visual-runtime/html-component-theme.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const outDir = path.resolve(root, "experiments/mckinsey-layout-rules-luna-20260909");
const firstPass = process.argv.includes("--first");
const outPptx = path.join(outDir, firstPass ? "mckinsey-luna-first-success.pptx" : "mckinsey-luna-reviewed.pptx");

const T = universityMckinseyTypography;
const THEME = resolveStructureTheme(universityMckinseySkin);
const C = {
  blue: THEME.primaryColor,
  blueLight: THEME.primaryWash,
  blueMid: THEME.line,
  ink: THEME.dark,
  body: THEME.body,
  muted: THEME.muted,
  line: THEME.line,
  pale: THEME.primaryPale,
  white: THEME.background,
};
const FONT_DISPLAY = universityMckinseySkin.fonts.display;
const FONT_BODY = universityMckinseySkin.fonts.body;

function addShape(slide, geometry, position, fill = "none", line = { fill: "none", width: 0 }) {
  return slide.shapes.add({ geometry, position, fill, line });
}
function addText(slide, text, position, style = {}) {
  const shape = addShape(slide, "textbox", position);
  shape.text = text;
  shape.text.style = {
    typeface: style.typeface ?? FONT_BODY,
    fontSize: style.fontSize ?? T.body,
    bold: style.bold ?? false,
    color: style.color ?? C.body,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    autoFit: "none",
    lineSpacing: style.lineSpacing ?? 1.05,
  };
  return shape;
}
function rect(slide, x, y, w, h, fill, line = { fill: "none", width: 0 }) {
  return addShape(slide, "rect", { left: x, top: y, width: w, height: h }, fill, line);
}
function line(slide, x, y, w, h, color = C.line, width = 1) {
  return addShape(slide, "line", { left: x, top: y, width: w, height: h }, "none", { style: "solid", fill: color, width });
}
function pill(slide, text, x, y, w, fill = C.blueLight, color = C.blue) {
  const s = addShape(slide, "roundRect", { left: x, top: y, width: w, height: 28 }, fill, { fill: "none", width: 0 });
  s.text = text;
  s.text.style = { typeface: FONT_BODY, fontSize: T.meta, bold: true, color, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  return s;
}
function addNotes(slide, text) { slide.speakerNotes.textFrame.setText(text); }

function drawPage1(slide) {
  const x = 55, y = 182, w = 1170;
  line(slide, x, y + 32, w, 0, C.line, 1);

  addText(slide, "准入", { left: 55, top: 230, width: 220, height: 30 }, { fontSize: T.heading, bold: true, color: C.blue });
  addText(slide, "申请来源", { left: 55, top: 274, width: 130, height: 26 }, { fontSize: T.body, bold: true, color: C.ink });
  const sources = ["课题自荐", "平台推荐", "合作项目"];
  sources.forEach((item, i) => {
    addText(slide, item, { left: 55 + i * 105, top: 306, width: 95, height: 26 }, { fontSize: T.body, color: C.body, alignment: "center" });
    if (i < sources.length - 1) line(slide, 154 + i * 105, 318, 10, 0, C.blueMid, 1);
  });
  addText(slide, "三项条件逐项核对，缺一项则暂缓", { left: 55, top: 352, width: 360, height: 28 }, { fontSize: T.body, color: C.muted });
  const gateRows = [
    ["01", "资格核对", "明确设备使用条件"],
    ["02", "责任确认", "落实一位明确负责人"],
    ["03", "记录准备", "能保存任务来源与\n执行参数和输出"],
  ];
  gateRows.forEach((row, i) => {
    const yy = 394 + i * 67;
    line(slide, 55, yy + 56, 430, 0, C.line, 1);
    addText(slide, row[0], { left: 55, top: yy, width: 42, height: 28 }, { fontSize: T.body, bold: true, color: C.blue });
    addText(slide, row[1], { left: 108, top: yy, width: 125, height: 28 }, { fontSize: T.body, bold: true, color: C.ink });
    addText(slide, row[2], { left: 245, top: yy, width: 225, height: 54 }, { fontSize: T.body, color: C.body });
  });

  addText(slide, "推进", { left: 500, top: 230, width: 220, height: 30 }, { fontSize: T.heading, bold: true, color: C.blue });
  addText(slide, "进入试点后，前一阶段证据具备才进入下一阶段", { left: 500, top: 274, width: 620, height: 28 }, { fontSize: T.body, color: C.muted });
  const stages = [
    ["可记录", "先留台账，记录任务来源与基本事实"],
    ["可追溯", "关联来源、参数与输出，保留复核路径"],
    ["可复用", "复核后沉淀方法，明确适用边界"],
  ];
  stages.forEach((s, i) => {
    const yy = 330 + i * 86;
    line(slide, 500, yy + 56, 660, 0, C.line, 1);
    addText(slide, String(i + 1).padStart(2, "0"), { left: 500, top: yy, width: 42, height: 28 }, { fontSize: T.body, bold: true, color: C.blue });
    addText(slide, s[0], { left: 566, top: yy, width: 140, height: 28 }, { fontSize: T.body, bold: true, color: C.ink });
    addText(slide, s[1], { left: 735, top: yy, width: 390, height: 54 }, { fontSize: T.body, color: C.body });
  });
  addText(slide, "通过筛选不等于立即全面开放", { left: 500, top: 600, width: 360, height: 28 }, { fontSize: T.body, bold: true, color: C.blue });
  addNotes(slide, "[Sources]\n- 内容：experiments/university-multi-structure-07/manuscript.md\n- 规则：rules/排版体系/麦肯锡式.md；rules/skins/东北大学.md\n[/Sources]");
}

function drawPage2(slide) {
  const x = 55, y = 182, w = 1170;
  line(slide, x, y + 32, w, 0, C.line, 1);
  addText(slide, "四类并列记录", { left: 55, top: 230, width: 310, height: 30 }, { fontSize: T.heading, bold: true, color: C.blue });
  addText(slide, "不是先后步骤，不能互相替代", { left: 55, top: 270, width: 330, height: 26 }, { fontSize: 18, color: C.muted });
  const cols = [
    ["申请来源", "申请人与任务"],
    ["审批依据", "责任人与时间"],
    ["执行结果", "参数与输出"],
    ["异常处置", "原因与结论"],
  ];
  cols.forEach((c, i) => {
    const xx = 55 + i * 158;
    line(slide, xx, 326, 142, 0, i === 3 ? C.blue : C.blueMid, 3);
    addText(slide, c[0], { left: xx, top: 346, width: 142, height: 28 }, { fontSize: 18, bold: true, color: C.ink });
    addText(slide, c[1], { left: xx, top: 386, width: 142, height: 54 }, { fontSize: 18, color: C.body });
    line(slide, xx, 458, 142, 0, C.line, 1);
  });
  addText(slide, "课题负责人确认事实；平台管理者复核处理结论", { left: 55, top: 490, width: 610, height: 28 }, { fontSize: 18, color: C.body });

  addText(slide, "异常分级处置", { left: 730, top: 230, width: 300, height: 30 }, { fontSize: T.heading, bold: true, color: C.blue });
  addText(slide, "任一关口不满足，补齐后再提交", { left: 730, top: 270, width: 390, height: 26 }, { fontSize: 18, color: C.muted });
  const gates = [
    ["01", "记录完整", "核对四类信息是否齐全"],
    ["02", "责任明确", "确认谁对事实负责"],
    ["03", "复核通过", "确认处理结论可关闭"],
  ];
  gates.forEach((g, i) => {
    const yy = 330 + i * 66;
    line(slide, 730, yy + 48, 400, 0, C.line, 1);
    addText(slide, g[0], { left: 730, top: yy, width: 42, height: 28 }, { fontSize: 18, bold: true, color: C.blue });
    addText(slide, g[1], { left: 790, top: yy, width: 150, height: 28 }, { fontSize: 18, bold: true, color: C.ink });
    addText(slide, g[2], { left: 950, top: yy, width: 220, height: 54 }, { fontSize: T.body, color: C.body });
  });
  line(slide, 730, 532, 400, 0, C.blueMid, 2);
  addText(slide, "意见不一致时", { left: 730, top: 548, width: 180, height: 28 }, { fontSize: 18, bold: true, color: C.blue });
  addText(slide, "保留异常状态，\n提交协调。\n“已记录”不等于\n“已解决”", { left: 930, top: 540, width: 250, height: 106 }, { fontSize: T.body, color: C.body, lineSpacing: 1.02 });
  addNotes(slide, "[Sources]\n- 内容：experiments/university-multi-structure-07/manuscript.md\n- 规则：rules/排版体系/麦肯锡式.md；rules/skins/东北大学.md\n[/Sources]");
}

async function drawPage3(slide) {
  const x = 55, y = 182, w = 1170;
  line(slide, x, y + 32, w, 0, C.line, 1);
  addText(slide, "扩围评审", { left: 55, top: 230, width: 300, height: 30 }, { fontSize: T.heading, bold: true, color: C.blue });
  addText(slide, "三项边界需同时具备，任一缺失则暂停", { left: 55, top: 270, width: 430, height: 26 }, { fontSize: 18, color: C.muted });
  const boundaries = [
    ["人员条件", "责任人可持续履职"],
    ["资源条件", "设备与支持能力可覆盖"],
    ["方法条件", "适用范围与例外清楚"],
  ];
  boundaries.forEach((b, i) => {
    const xx = 55 + i * 385;
    line(slide, xx, 316, 350, 0, C.blueMid, 2);
    addText(slide, b[0], { left: xx, top: 332, width: 150, height: 28 }, { fontSize: 18, bold: true, color: C.ink });
    addText(slide, b[1], { left: xx, top: 370, width: 330, height: 30 }, { fontSize: 18, color: C.body });
  });
  addText(slide, "能力阶梯", { left: 55, top: 420, width: 180, height: 28 }, { fontSize: T.heading, bold: true, color: C.blue });
  await invokeUniversityStructure({
    root,
    slide,
    assetId: "progression-maturity-steps-002",
    content: {
      levels: [
        { key: "recordable", title: "可记录", body: "基本台账齐全" },
        { key: "traceable", title: "可追溯", body: "来源参数输出相互关联" },
        { key: "reusable", title: "可复用", body: "关键步骤复核且边界明确" },
      ],
      showStatus: false,
    },
    targetFrame: { left: 55, top: 448, width: 700, height: 190 },
    evidencePath: path.join(outDir, "structure-calls.jsonl"),
    pageId: "body-3",
    regionId: "capability-ladder",
    reason: "原稿明确表达三阶能力门槛，匹配已登记成熟度能力阶梯；保留连续阶台、共同消失点和随形承托面。",
  });
  await closeStructureRuntime();
  addText(slide, "达到可复用前，不宣称跨项目可推广", { left: 805, top: 420, width: 370, height: 28 }, { fontSize: T.body, bold: true, color: C.blue, alignment: "right" });
  addText(slide, "可记录：基本台账齐全", { left: 805, top: 458, width: 370, height: 28 }, { fontSize: T.body, color: C.body });
  addText(slide, "可追溯：来源、参数、输出相互关联", { left: 805, top: 492, width: 370, height: 28 }, { fontSize: T.body, color: C.body });
  addText(slide, "可复用：关键步骤经复核且边界明确", { left: 805, top: 526, width: 370, height: 28 }, { fontSize: T.body, color: C.body });
  addText(slide, "暂停扩围", { left: 805, top: 568, width: 160, height: 28 }, { fontSize: T.body, bold: true, color: C.blue });
  addText(slide, "任何边界无法满足，保留当前试点规模并明确补齐任务。", { left: 805, top: 602, width: 370, height: 58 }, { fontSize: T.body, color: C.body });
  addNotes(slide, "[Sources]\n- 内容：experiments/university-multi-structure-07/manuscript.md\n- 规则：rules/排版体系/麦肯锡式.md；rules/skins/东北大学.md\n[/Sources]");
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const pages = [
    { content: { pageId: "body-1", title: "先筛出可追溯项目，再小步扩大开放" }, meta: { sectionName: "准入与推进" }, intent: { intentId: "mckinsey-body-1" }, decision: { selectedAssetId: "native-editorial-layout" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
    { content: { pageId: "body-2", title: "完整记录与分级处置共同防止异常失去责任归属" }, meta: { sectionName: "记录与处置" }, intent: { intentId: "mckinsey-body-2" }, decision: { selectedAssetId: "native-editorial-layout" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
    { content: { pageId: "body-3", title: "扩围应以能力达标为门槛，并保留明确的暂停条件" }, meta: { sectionName: "能力与扩围" }, intent: { intentId: "mckinsey-body-3" }, decision: { selectedAssetId: "native-editorial-layout" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
  ];
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx: path.join(outDir, ".runtime", firstPass ? "starter-first.pptx" : "starter-final.pptx"),
    pages,
    manuscriptSource: "experiments/university-multi-structure-07/manuscript.md",
  });
  drawPage1(slides[0]);
  drawPage2(slides[1]);
  await drawPage3(slides[2]);
  await (await PresentationFile.exportPptx(presentation)).save(outPptx);
  console.log(JSON.stringify({ outPptx, firstPass, pages: slides.length }, null, 2));
}

await main();
