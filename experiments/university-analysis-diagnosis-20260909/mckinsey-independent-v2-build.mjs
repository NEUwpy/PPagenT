import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../src/runtime/skins/northeastern-university.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const outDir = path.resolve(root, "experiments/mckinsey-layout-rules-luna-20260909");
const firstPass = process.argv.includes("--first");
const outPptx = path.join(outDir, firstPass ? "mckinsey-luna-first-success.pptx" : "mckinsey-luna-final-v2.pptx");

const C = {
  blue: "#315F91",
  blueLight: "#EAF1F7",
  blueMid: "#9CB7D0",
  ink: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#C8D2DC",
  pale: "#F4F7FA",
  white: "#FFFFFF",
};
const FONT_DISPLAY = "HYWenRunSongYun U";
const FONT_BODY = "Microsoft YaHei";

function addShape(slide, geometry, position, fill = "none", line = { fill: "none", width: 0 }) {
  return slide.shapes.add({ geometry, position, fill, line });
}
function addText(slide, text, position, style = {}) {
  const shape = addShape(slide, "textbox", position);
  shape.text = text;
  shape.text.style = {
    typeface: style.typeface ?? FONT_BODY,
    fontSize: style.fontSize ?? 18,
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
  s.text.style = { typeface: FONT_BODY, fontSize: 14, bold: true, color, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  return s;
}
function addNotes(slide, text) { slide.speakerNotes.textFrame.setText(text); }

function drawPage1(slide) {
  const x = 55, y = 178, w = 1170;
  addText(slide, "先过准入关口，再按证据逐级推进", { left: x, top: y, width: w, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  line(slide, x, y + 42, w, 0, C.line, 1);

  addText(slide, "准入关口", { left: 55, top: 238, width: 260, height: 30 }, { fontSize: 21, bold: true, color: C.blue });
  addText(slide, "申请来源、责任人与记录准备缺一项则暂缓", { left: 55, top: 270, width: 310, height: 40 }, { fontSize: 16, color: C.muted });
  const gateRows = [
    ["01", "资格核对", "明确设备使用条件"],
    ["02", "责任确认", "落实一位明确负责人"],
    ["03", "记录准备", "能保存来源、参数与输出"],
  ];
  gateRows.forEach((row, i) => {
    const yy = 326 + i * 78;
    rect(slide, 55, yy, 300, 60, i === 2 ? C.blueLight : C.pale, { fill: C.line, width: 1 });
    addText(slide, row[0], { left: 70, top: yy + 13, width: 50, height: 28 }, { fontSize: 18, bold: true, color: C.blue });
    addText(slide, row[1], { left: 118, top: yy + 9, width: 210, height: 24 }, { fontSize: 18, bold: true, color: C.ink });
    addText(slide, row[2], { left: 118, top: yy + 34, width: 220, height: 20 }, { fontSize: 14, color: C.body });
  });
  addText(slide, "通过筛选不等于全面开放", { left: 55, top: 574, width: 300, height: 24 }, { fontSize: 16, bold: true, color: C.blue });

  addText(slide, "进入后的推进", { left: 430, top: 238, width: 300, height: 30 }, { fontSize: 21, bold: true, color: C.blue });
  addText(slide, "每一阶段都以可复核证据换取下一阶段", { left: 430, top: 270, width: 360, height: 40 }, { fontSize: 16, color: C.muted });
  const stages = [
    { x: 430, y: 450, w: 245, title: "可记录", body: "先留台账\n保留来源与事实" },
    { x: 675, y: 370, w: 245, title: "可追溯", body: "关联来源、参数和输出\n保留复核路径" },
    { x: 920, y: 290, w: 245, title: "可复用", body: "复核后沉淀可复用方法\n明确适用边界" },
  ];
  stages.forEach((s, i) => {
    rect(slide, s.x, s.y, s.w, 116, i === 2 ? C.blue : C.blueLight, { fill: i === 2 ? C.blue : C.blueMid, width: 1 });
    addText(slide, s.title, { left: s.x + 18, top: s.y + 14, width: s.w - 36, height: 28 }, { fontSize: 21, bold: true, color: i === 2 ? C.white : C.blue });
    addText(slide, s.body, { left: s.x + 18, top: s.y + 49, width: s.w - 34, height: 54 }, { fontSize: 16, color: i === 2 ? C.white : C.body, lineSpacing: 1.12 });
    if (i < stages.length - 1) {
      line(slide, s.x + s.w, s.y + 58, 20, 0, C.blue, 2);
    }
  });
  addText(slide, "筛选解决谁能进入，阶梯解决进入后如何推进", { left: 430, top: 590, width: 690, height: 30 }, { fontSize: 18, bold: true, color: C.ink });
  addNotes(slide, "[Sources]\n- 内容：experiments/university-multi-structure-07/manuscript.md\n- 规则：rules/排版体系/麦肯锡式.md；rules/skins/东北大学.md\n[/Sources]");
}

function drawPage2(slide) {
  const x = 55, y = 178, w = 1170;
  addText(slide, "记录保证有据可查，处置关口保证有据才关闭", { left: x, top: y, width: w, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  line(slide, x, y + 42, w, 0, C.line, 1);
  addText(slide, "四类并列记录", { left: 55, top: 238, width: 310, height: 30 }, { fontSize: 21, bold: true, color: C.blue });
  addText(slide, "不是先后步骤，不能互相替代", { left: 55, top: 270, width: 300, height: 24 }, { fontSize: 16, color: C.muted });
  const cols = [
    ["申请来源", "申请人与任务"],
    ["审批依据", "责任人与时间"],
    ["执行结果", "参数与输出"],
    ["异常处置", "原因与结论"],
  ];
  cols.forEach((c, i) => {
    const xx = 55 + i * 82;
    rect(slide, xx, 326, 72, 190, i === 3 ? C.blueLight : C.pale, { fill: C.line, width: 1 });
    rect(slide, xx, 326, 72, 8, i === 3 ? C.blue : C.blueMid);
    addText(slide, c[0], { left: xx + 10, top: 350, width: 52, height: 66 }, { fontSize: 17, bold: true, color: C.ink, alignment: "center", verticalAlignment: "middle", lineSpacing: 1.1 });
    line(slide, xx + 13, 425, 46, 0, C.line, 1);
    addText(slide, c[1], { left: xx + 10, top: 446, width: 52, height: 50 }, { fontSize: 14, color: C.body, alignment: "center", lineSpacing: 1.12 });
  });
  addText(slide, "课题负责人确认事实；平台管理者复核处理结论", { left: 55, top: 548, width: 350, height: 46 }, { fontSize: 16, color: C.body, lineSpacing: 1.1 });

  addText(slide, "异常分级处置", { left: 430, top: 238, width: 300, height: 30 }, { fontSize: 21, bold: true, color: C.blue });
  addText(slide, "任一关口不满足，补齐后再提交", { left: 430, top: 270, width: 330, height: 24 }, { fontSize: 16, color: C.muted });
  const gates = [
    ["01", "记录完整", "核对四类信息是否齐全"],
    ["02", "责任明确", "确认谁对事实负责"],
    ["03", "复核通过", "确认处理结论可关闭"],
  ];
  gates.forEach((g, i) => {
    const yy = 334 + i * 84;
    line(slide, 458, yy + 26, 0, 58, C.blueMid, 2);
    addShape(slide, "ellipse", { left: 441, top: yy, width: 36, height: 36 }, i === 2 ? C.blue : C.blueLight, { fill: C.blue, width: 1 });
    addText(slide, g[0], { left: 441, top: yy + 9, width: 36, height: 20 }, { fontSize: 13, bold: true, color: i === 2 ? C.white : C.blue, alignment: "center" });
    addText(slide, g[1], { left: 500, top: yy - 2, width: 170, height: 26 }, { fontSize: 18, bold: true, color: C.ink });
    addText(slide, g[2], { left: 500, top: yy + 26, width: 300, height: 26 }, { fontSize: 15, color: C.body });
  });
  rect(slide, 820, 334, 325, 202, C.pale, { fill: C.line, width: 1 });
  pill(slide, "分歧处理", 846, 354, 96);
  addText(slide, "两者意见不一致时", { left: 846, top: 402, width: 240, height: 26 }, { fontSize: 18, bold: true, color: C.ink });
  addText(slide, "保留异常状态，提交协调。\n“已记录”不等于“已解决”。", { left: 846, top: 438, width: 260, height: 54 }, { fontSize: 17, color: C.body, lineSpacing: 1.12 });
  addText(slide, "关闭异常的依据必须同时满足三道关口", { left: 430, top: 574, width: 690, height: 30 }, { fontSize: 18, bold: true, color: C.ink });
  addNotes(slide, "[Sources]\n- 内容：experiments/university-multi-structure-07/manuscript.md\n- 规则：rules/排版体系/麦肯锡式.md；rules/skins/东北大学.md\n[/Sources]");
}

function drawPage3(slide) {
  const x = 55, y = 178, w = 1170;
  addText(slide, "达到能力门槛才考虑扩围，条件不足则暂停", { left: x, top: y, width: w, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  line(slide, x, y + 42, w, 0, C.line, 1);
  addText(slide, "能力阶梯", { left: 55, top: 238, width: 300, height: 30 }, { fontSize: 21, bold: true, color: C.blue });
  addText(slide, "先把能力说清楚，再讨论增加多少项目", { left: 55, top: 270, width: 340, height: 24 }, { fontSize: 16, color: C.muted });
  const levels = [
    ["可记录", "基本台账齐全\n允许保留在当前试点"],
    ["可追溯", "来源、参数、输出相互关联\n形成可复核证据"],
    ["可复用", "关键步骤经复核且边界明确\n具备跨项目推广基础"],
  ];
  levels.forEach((v, i) => {
    const xx = 55 + i * 65;
    const yy = 488 - i * 82;
    rect(slide, xx, yy, 300, 82, i === 2 ? C.blue : C.blueLight, { fill: i === 2 ? C.blue : C.blueMid, width: 1 });
    addText(slide, v[0], { left: xx + 18, top: yy + 12, width: 240, height: 26 }, { fontSize: 20, bold: true, color: i === 2 ? C.white : C.blue });
    addText(slide, v[1], { left: xx + 18, top: yy + 43, width: 255, height: 32 }, { fontSize: 15, color: i === 2 ? C.white : C.body, lineSpacing: 1.1 });
  });
  addText(slide, "达到可复用前，不宣称跨项目可推广", { left: 55, top: 590, width: 400, height: 24 }, { fontSize: 16, bold: true, color: C.blue });

  addText(slide, "扩围评审的并列边界", { left: 490, top: 238, width: 360, height: 30 }, { fontSize: 21, bold: true, color: C.blue });
  addText(slide, "三项条件同时满足，才进入扩围讨论", { left: 490, top: 270, width: 360, height: 24 }, { fontSize: 16, color: C.muted });
  const boundaries = [
    ["人员条件", "责任人可持续履职"],
    ["资源条件", "设备与支持能力可覆盖"],
    ["方法条件", "适用范围与例外清楚"],
  ];
  boundaries.forEach((b, i) => {
    const yy = 330 + i * 70;
    line(slide, 490, yy + 48, 650, 0, C.line, 1);
    addText(slide, b[0], { left: 490, top: yy, width: 160, height: 28 }, { fontSize: 18, bold: true, color: C.ink });
    addText(slide, b[1], { left: 700, top: yy, width: 330, height: 28 }, { fontSize: 17, color: C.body });
    addShape(slide, "ellipse", { left: 1090, top: yy + 2, width: 24, height: 24 }, C.blueLight, { fill: C.blue, width: 1 });
    addText(slide, "✓", { left: 1090, top: yy + 1, width: 24, height: 24 }, { fontSize: 17, bold: true, color: C.blue, alignment: "center" });
  });
  rect(slide, 490, 556, 650, 62, C.pale, { fill: C.line, width: 1 });
  addText(slide, "暂停条件", { left: 510, top: 574, width: 110, height: 24 }, { fontSize: 17, bold: true, color: C.blue });
  addText(slide, "任何边界无法满足，保留当前试点规模并明确补齐任务", { left: 635, top: 574, width: 475, height: 24 }, { fontSize: 16, color: C.body });
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
  slides.forEach((slide, i) => [drawPage1, drawPage2, drawPage3][i](slide));
  await (await PresentationFile.exportPptx(presentation)).save(outPptx);
  console.log(JSON.stringify({ outPptx, firstPass, pages: slides.length }, null, 2));
}

await main();
