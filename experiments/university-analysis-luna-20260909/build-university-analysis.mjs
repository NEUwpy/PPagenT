import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = "C:/PPagenT";
const outDir = path.join(root, "experiments/university-analysis-luna-20260909");
const buildDir = path.join(outDir, ".build");
const runtimeNode = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const runtimeModules = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const manuscriptSource = "experiments/university-multi-structure-07/manuscript.md";
const candidatePath = path.join(buildDir, "university-analysis-luna-high-draft-01.pptx");
const finalPath = path.join(outDir, "university-analysis-luna-high-revision-04.pptx");
const evidencePath = path.join(outDir, "structure-calls.jsonl");
const failurePath = path.join(outDir, "tool-failures.jsonl");

process.env.RUNTIME_NODE = runtimeNode;
process.env.RUNTIME_NODE_MODULES = runtimeModules;
process.env.RUNTIME_PYTHON = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outDir, { recursive: true });
try { await fs.rm(evidencePath); } catch {}
try { await fs.rm(failurePath); } catch {}
const linkPath = path.join(buildDir, "node_modules");
try { await fs.symlink(runtimeModules, linkPath, "junction"); } catch (error) { if (error.code !== "EEXIST") throw error; }

const { PresentationFile } = await import("@oai/artifact-tool");
const { createNortheasternUniversityStarter } = await import(pathToFileURL(path.join(root, "src/runtime/skins/northeastern-university.mjs")).href);
const { addText, addBox, addCircle, addLine } = await import(pathToFileURL(path.join(root, "src/asset-runtime/component-builders.mjs")).href);
const { invokeUniversityStructure, closeStructureRuntime } = await import(pathToFileURL(path.join(root, "src/runtime/invoke-university-structure.mjs")).href);

const C = {
  blue: "#2F5EA8", blue2: "#4C88E8", dark: "#404040", muted: "#6F7D91", line: "#AFC6E8",
  soft: "#F5F8FD", soft2: "#E9F1FC", white: "#FFFFFF", warning: "#8C5A18",
};
const body = { typeface: "Microsoft YaHei", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
function txt(slide, value, frame, style = {}) {
  return addText(slide, value, frame, { ...body, fontSize: 18, color: C.dark, verticalAlignment: "top", ...style });
}
function box(slide, frame, style = {}) {
  return addBox(slide, frame, { fill: C.white, line: { style: "solid", fill: C.line, width: 1 }, shadow: "shadow-none", ...style });
}
function heading(slide, value, frame, style = {}) {
  return txt(slide, value, frame, { fontSize: 21, bold: true, color: C.blue, verticalAlignment: "middle", ...style });
}
function line(slide, a, b, color = C.line, width = 1.5) { return addLine(slide, a, b, color, width); }

const pages = [
  { content: { pageId: "p1-admission", title: "准入先核对，推进看证据，开放再逐步扩大" }, meta: { sectionName: "准入与推进" }, intent: { intentId: "analysis-admission", }, decision: { selectedAssetId: "native-page-analysis" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
  { content: { pageId: "p2-exception", title: "完整记录与分级处置共同防止异常失去责任归属" }, meta: { sectionName: "记录与处置" }, intent: { intentId: "analysis-exception", }, decision: { selectedAssetId: "native-page-analysis" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
  { content: { pageId: "p3-expansion", title: "扩围应以能力达标为门槛，并保留明确的暂停条件" }, meta: { sectionName: "能力与扩围" }, intent: { intentId: "analysis-expansion", }, decision: { selectedAssetId: "progression-maturity-steps-002" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
];

const { presentation, slides, bodyFrame } = await createNortheasternUniversityStarter({
  sourcePptx: path.join(root, "assets/主题/东北大学-001/runtime-template.pptx"),
  starterPptx: path.join(buildDir, "template-starter.pptx"),
  pages,
  manuscriptSource,
});

function drawPage1(slide) {
  const x = bodyFrame.left, y = bodyFrame.top;
  heading(slide, "准入核对与证据推进", { left: x, top: y + 10, width: 420, height: 30 });
  txt(slide, "申请可来自课题自荐、平台推荐与合作项目，三类来源共享同一核对口径。", { left: x, top: y + 42, width: 760, height: 24 }, { fontSize: 15, color: C.muted });
  const leftW = 770;
  const cols = [{ left: x + 42, width: 174 }, { left: x + 228, width: 330 }, { left: x + 570, width: 182 }];
  ["核对项", "需要的依据", "缺失动作"].forEach((label, i) => txt(slide, label, { left: cols[i].left, top: y + 90, width: cols[i].width, height: 24 }, { fontSize: 16, bold: true, color: C.blue }));
  const checks = [["资格", "设备使用条件明确", "暂缓进入"], ["责任", "一位明确负责人", "暂缓进入"], ["记录准备", "能保存任务来源、执行参数和输出", "暂缓进入"]];
  checks.forEach(([label, evidence, action], i) => {
    const top = y + 126 + i * 86;
    box(slide, { left: x, top, width: leftW, height: 68 }, { fill: i % 2 ? C.white : C.soft, line: { style: "solid", fill: C.line, width: 1 } });
    addCircle(slide, { left: x + 10, top: top + 16, width: 34, height: 34 }, { fill: C.blue, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none", text: String(i + 1), fontSize: 14, bold: true, color: C.white, autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    txt(slide, label, { left: cols[0].left, top: top + 20, width: cols[0].width, height: 26 }, { fontSize: 18, bold: true, color: C.blue });
    txt(slide, evidence, { left: cols[1].left, top: top + 12, width: cols[1].width, height: 44 }, { fontSize: 17, color: C.dark });
    txt(slide, action, { left: cols[2].left, top: top + 20, width: cols[2].width, height: 26 }, { fontSize: 17, bold: true, color: C.warning });
  });
  txt(slide, "缺一项则暂缓，筛选解决谁能进入。", { left: x + 10, top: y + 402, width: leftW - 20, height: 28 }, { fontSize: 17, bold: true, color: C.blue });
  const rx = x + 812;
  heading(slide, "进入后的证据递进", { left: rx, top: y + 10, width: 350, height: 30 });
  txt(slide, "前一阶段证据具备，才进入下一阶段。", { left: rx, top: y + 42, width: 350, height: 24 }, { fontSize: 15, color: C.muted });
  const levels = [["可记录", "先留台账"], ["可追溯", "关联来源、参数与输出"], ["可复用", "复核后沉淀复用方法"]];
  levels.forEach(([title, detail], i) => {
    const top = y + 112 + i * 94;
    txt(slide, String(i + 1).padStart(2, "0"), { left: rx, top: top + 8, width: 32, height: 26 }, { fontSize: 18, bold: true, color: C.blue });
    txt(slide, title, { left: rx + 44, top, width: 110, height: 28 }, { fontSize: 19, bold: true, color: C.blue });
    txt(slide, detail, { left: rx + 44, top: top + 32, width: 300, height: 44 }, { fontSize: 16, color: C.dark });
    if (i < 2) line(slide, { x: rx + 14, y: top + 60 }, { x: rx + 14, y: top + 86 }, C.blue2, 2);
  });
  box(slide, { left: rx, top: y + 400, width: 358, height: 66 }, { fill: C.soft2, line: { style: "solid", fill: C.line, width: 1 } });
  txt(slide, "通过筛选不等于立即全面开放。", { left: rx + 16, top: y + 420, width: 326, height: 26 }, { fontSize: 17, bold: true, color: C.blue });
}

function drawPage2(slide) {
  const x = bodyFrame.left, y = bodyFrame.top;
  heading(slide, "四类记录必须并列保留", { left: x, top: y + 10, width: 500, height: 30 });
  txt(slide, "四类信息互相补足，不能用一类替代另一类。", { left: x, top: y + 42, width: 520, height: 24 }, { fontSize: 15, color: C.muted });
  const records = [
    ["申请来源", "申请人与任务"], ["审批依据", "责任人与时间"], ["执行结果", "参数与输出"], ["异常处置", "原因与结论"],
  ];
  const table = { left: x, top: y + 92, width: 760, height: 340 };
  box(slide, table, { fill: C.white, line: { style: "solid", fill: C.line, width: 1 } });
  txt(slide, "记录项", { left: x + 20, top: y + 108, width: 190, height: 24 }, { fontSize: 16, bold: true, color: C.blue });
  txt(slide, "必须保留的证据", { left: x + 250, top: y + 108, width: 300, height: 24 }, { fontSize: 16, bold: true, color: C.blue });
  records.forEach(([title, detail], i) => {
    const top = y + 144 + i * 70;
    if (i % 2 === 0) slide.shapes.add({ geometry: "rect", position: { left: x + 1, top, width: 758, height: 58 }, fill: C.soft, line: { style: "solid", fill: "none", width: 0 } });
    txt(slide, title, { left: x + 20, top: top + 15, width: 190, height: 26 }, { fontSize: 18, bold: true, color: C.blue });
    txt(slide, detail, { left: x + 250, top: top + 15, width: 480, height: 26 }, { fontSize: 17, color: C.dark });
    if (i < records.length - 1) line(slide, { x: x + 20, y: top + 59 }, { x: x + 740, y: top + 59 }, C.line, 1);
  });
  txt(slide, "记录内容保证有据可查。", { left: x + 20, top: y + 450, width: 320, height: 24 }, { fontSize: 17, bold: true, color: C.blue });

  const rx = x + 800;
  heading(slide, "关闭与责任", { left: rx, top: y + 10, width: 340, height: 30 });
  txt(slide, "三道关口决定是否可以关闭", { left: rx, top: y + 42, width: 340, height: 24 }, { fontSize: 15, color: C.muted });
  const gates = [["01", "记录完整", "缺项先补齐"], ["02", "责任明确", "确认归属"], ["03", "复核通过", "确认结论"]];
  gates.forEach(([num, title, detail], i) => {
    const top = y + 88 + i * 66;
    txt(slide, num, { left: rx, top, width: 34, height: 26 }, { fontSize: 16, bold: true, color: C.blue });
    txt(slide, title, { left: rx + 48, top, width: 130, height: 26 }, { fontSize: 18, bold: true, color: C.blue });
    txt(slide, detail, { left: rx + 184, top, width: 170, height: 26 }, { fontSize: 16, color: C.dark });
    if (i < 2) line(slide, { x: rx, y: top + 42 }, { x: rx + 350, y: top + 42 }, C.line, 1);
  });
  box(slide, { left: rx, top: y + 292, width: 358, height: 76 }, { fill: C.soft2, line: { style: "solid", fill: C.blue2, width: 1.2 } });
  txt(slide, "任一关口不满足：补齐后再提交，\n不直接关闭异常。", { left: rx + 16, top: y + 305, width: 326, height: 48 }, { fontSize: 17, bold: true, color: C.blue });
  txt(slide, "课题负责人：确认事实", { left: rx, top: y + 374, width: 350, height: 26 }, { fontSize: 16, bold: true, color: C.dark });
  txt(slide, "平台管理者：复核处理结论", { left: rx, top: y + 406, width: 350, height: 26 }, { fontSize: 16, bold: true, color: C.dark });
  box(slide, { left: rx, top: y + 438, width: 358, height: 54 }, { fill: C.white, line: { style: "solid", fill: C.line, width: 1 } });
  txt(slide, "意见不一致：保留异常状态\n并提交协调", { left: rx + 10, top: y + 443, width: 338, height: 44 }, { fontSize: 18, bold: true, color: C.warning });
}

function drawPage3(slide) {
  const x = bodyFrame.left, y = bodyFrame.top;
  heading(slide, "能力门槛", { left: x, top: y + 8, width: 240, height: 30 });
  txt(slide, "能力阶梯与扩围边界分别核对", { left: x, top: y + 40, width: 500, height: 24 }, { fontSize: 15, color: C.muted });
  const rx = x + 812;
  heading(slide, "扩围评审的并列边界", { left: rx, top: y + 8, width: 350, height: 30 });
  txt(slide, "三项条件同时具备，才讨论增加项目", { left: rx, top: y + 40, width: 350, height: 24 }, { fontSize: 15, color: C.muted });
  const items = [
    ["人员条件", "责任人可持续履职"],
    ["资源条件", "设备与支持能力可覆盖"],
    ["方法条件", "适用范围与例外清楚"],
  ];
  items.forEach(([title, detail], i) => {
    const f = { left: rx, top: y + 88 + i * 82, width: 358, height: 64 };
    box(slide, f, { fill: C.soft, line: { style: "solid", fill: C.line, width: 1.2 } });
    txt(slide, title, { left: f.left + 14, top: f.top + 9, width: 104, height: 26 }, { fontSize: 17, bold: true, color: C.blue });
    txt(slide, detail, { left: f.left + 124, top: f.top + 10, width: 216, height: 38 }, { fontSize: 15, color: C.dark });
  });
  box(slide, { left: rx, top: y + 342, width: 358, height: 102 }, { fill: C.soft2, line: { style: "solid", fill: C.blue2, width: 1.4 } });
  txt(slide, "任一边界无法满足，\n暂停扩围，保留当前试点规模，\n明确补齐任务。", { left: rx + 16, top: y + 355, width: 326, height: 78 }, { fontSize: 17, bold: true, color: C.blue });
  box(slide, { left: x, top: y + 434, width: 780, height: 36 }, { fill: C.white, line: { style: "solid", fill: C.line, width: 1 } });
  txt(slide, "达到可复用前不宣称跨项目可推广。", { left: x + 16, top: y + 441, width: 748, height: 24 }, { fontSize: 16, bold: true, color: C.blue });
}

drawPage1(slides[0]);
drawPage2(slides[1]);

let p3Structure = "not-attempted";
try {
  p3Structure = "attempted";
  await invokeUniversityStructure({
    root,
    slide: slides[2],
    assetId: "progression-maturity-steps-002",
    targetFrame: { left: bodyFrame.left, top: bodyFrame.top + 62, width: 780, height: 360 },
    content: { levels: [
      { key: "recordable", title: "可记录", body: "基本台账齐全" },
      { key: "traceable", title: "可追溯", body: "来源参数输出相互关联" },
      { key: "reusable", title: "可复用", body: "关键步骤复核且边界明确" },
    ], showStatus: false },
    evidencePath,
    pageId: "p3-expansion",
    regionId: "capability-ladder",
    reason: "稿件明确给出三阶能力门槛，保留成熟度阶梯的离散等级与共同投影关系。",
  });
  p3Structure = "success";
} catch (error) {
  p3Structure = `failure:${error.code ?? "unknown"}:${error.message}`;
  await fs.appendFile(failurePath, JSON.stringify({ at: new Date().toISOString(), tool: "invokeUniversityStructure", pageId: "p3-expansion", assetId: "progression-maturity-steps-002", error: p3Structure }) + "\n");
  // The ladder is a useful preserved-design reference, but it cannot be accepted
  // if the real target area rejects its capacity. Keep the evidence visible in a
  // compact native fallback rather than deleting the source conditions.
  const levels = [["可记录", "基本台账齐全"], ["可追溯", "来源、参数、输出相互关联"], ["可复用", "关键步骤复核且边界明确"]];
  levels.forEach(([title, detail], i) => {
    const f = { left: x + 18 + i * 228, top: y + 290 - i * 74, width: 210, height: 82 };
    box(slides[2], f, { fill: i === 2 ? C.blue : C.soft, line: { style: "solid", fill: i === 2 ? C.blue : C.line, width: 1.2 } });
    txt(slides[2], title, { left: f.left + 14, top: f.top + 10, width: 182, height: 26 }, { fontSize: 19, bold: true, color: i === 2 ? C.white : C.blue });
    txt(slides[2], detail, { left: f.left + 14, top: f.top + 42, width: 182, height: 30 }, { fontSize: 15, color: i === 2 ? C.white : C.dark });
    if (i < 2) line(slides[2], { x: f.left + f.width, y: f.top + f.height / 2 }, { x: f.left + f.width + 18, y: f.top + f.height / 2 - 22 }, C.blue2, 2);
  });
}
drawPage3(slides[2]);

for (const [index, slide] of slides.entries()) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- 内容：${manuscriptSource}\n- 视觉：assets/主题/东北大学-001/runtime-template.pptx\n- 结构调用：${index === 2 ? p3Structure : "本页按稿件关系自主原生编排"}\n[/Sources]`);
}

await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
const receiptPath = path.join(root, ".build-validation", "university-analysis-luna-high-revision-04.validation.json");
await fs.mkdir(path.dirname(receiptPath), { recursive: true });
const result = await finalizePresentation({
  workspaceDir: root,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requirements: { explicitTotalSlideCount: 3, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [] },
  explicitTotalSlideCount: 3,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["Microsoft YaHei", "HYWenRunSongYun U", "汉仪粗宋简"] },
  verifyArtifactToolImport: true,
  receiptPath,
});
await fs.writeFile(path.join(outDir, "build-status.json"), JSON.stringify({ candidatePath, finalPath, p3Structure, finalizer: result }, null, 2));
await closeStructureRuntime();
console.log(JSON.stringify({ candidatePath, finalPath, p3Structure, receiptPath }, null, 2));
