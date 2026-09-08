import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { Presentation, PresentationFile, FileBlob } from "@oai/artifact-tool";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const runtimeNode = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const runtimePython = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const runtimeNodeModules = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const buildDir = path.join(here, ".build");
const evidenceDir = path.join(here, "evidence");
const evidencePath = path.join(evidenceDir, "structure-invocations.ndjson");
const candidatePath = path.join(here, "candidate.pptx");
const finalizedPath = path.join(here, "final", "candidate.pptx");

const C = Object.freeze({ paper: "#F5F4EF", surface: "#EEECE5", ink: "#20201D", body: "#4B4A45", muted: "#85837B", line: "#D8D5CC", accent: "#A35D4F", paleAccent: "#E6D4CE", blue0: "#DDE4E3", blue1: "#B9CCD0", blue2: "#8EADB6", blue3: "#688D9A", blue4: "#416C7D", white: "#FFFFFF" });
const SERIF = "Noto Serif SC";
const SANS = "Noto Sans SC";
const frame = { left: 55, top: 166, width: 1170, height: 492 };
const skin = { id: "neutral-editorial-001", bodyFrame: frame, background: C.paper, surface: C.surface, dark: C.ink, body: C.body, muted: C.muted, line: C.line, primaryColor: C.accent, font: SANS, typography: { componentHeading: 15.75, componentTitle: 15.75, componentItemTitle: 12.75, componentLead: 12.75, componentBody: 12.75, componentLabel: 11.25, componentMeta: 11.25 } };
const noLine = () => ({ style: "solid", fill: "none", width: 0 });
function shape(slide, geometry, position, fill = "none", line = noLine(), name, extra = {}) { return slide.shapes.add({ geometry, position, fill, line, name, shadow: "shadow-none", ...extra }); }
function rect(slide, position, fill = C.surface, line = { style: "solid", fill: C.line, width: 1 }, name) { return shape(slide, "rect", position, fill, line, name); }
function roundRect(slide, position, fill = C.surface, line = { style: "solid", fill: C.line, width: 1 }, name) { return shape(slide, "roundRect", position, fill, line, name); }
function ellipse(slide, position, fill = C.surface, line = { style: "solid", fill: C.line, width: 1 }, name) { return shape(slide, "ellipse", position, fill, line, name); }
function text(slide, value, position, opts = {}) { const s = shape(slide, "textbox", position, "none", noLine(), opts.name); s.text = String(value ?? ""); s.text.style = { typeface: opts.typeface ?? SANS, fontSize: opts.fontSize ?? 16, color: opts.color ?? C.body, bold: opts.bold ?? false, alignment: opts.alignment ?? "left", verticalAlignment: opts.verticalAlignment ?? "top", lineSpacing: opts.lineSpacing ?? 1.15, autoFit: "none", insets: opts.insets ?? { top: 0, right: 0, bottom: 0, left: 0 } }; return s; }
function line(slide, x1, y1, x2, y2, color = C.line, width = 1.2, name) { return shape(slide, "line", { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1) || 1, height: Math.abs(y2 - y1) || 1, horizontalFlip: x2 < x1, verticalFlip: y2 < y1 }, "none", { style: "solid", fill: color, width }, name); }
function connect(slide, from, to, opts = {}) { return slide.shapes.connect(from, to, { kind: opts.kind ?? "straight", fromSide: opts.fromSide, toSide: opts.toSide, line: { style: "solid", fill: opts.color ?? C.muted, width: opts.width ?? 1.5 }, head: opts.head ?? { type: "triangle", width: "sm", length: "sm" }, tail: opts.tail }); }
function polygon(slide, points, fill, lineFill = C.line, width = 1, name) { const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)); const maxX = Math.max(...points.map(p => p.x)), maxY = Math.max(...points.map(p => p.y)); const commands = [{ moveTo: { x: points[0].x - minX, y: points[0].y - minY } }, ...points.slice(1).map(p => ({ lineTo: { x: p.x - minX, y: p.y - minY } })), { close: {} }]; return shape(slide, "custom", { left: minX, top: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }, fill, { style: "solid", fill: lineFill, width }, name, { customPaths: [{ width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), commands }] }); }
function header(slide, item, index) { slide.background.fill = C.paper; text(slide, item.caseId.replace("case-", ""), { left: 56, top: 47, width: 50, height: 32 }, { fontSize: 16, color: C.accent, bold: true, verticalAlignment: "middle" }); text(slide, item.title, { left: 105, top: 44, width: 790, height: 38 }, { typeface: SERIF, fontSize: 24, color: C.ink, bold: true, verticalAlignment: "middle" }); line(slide, 920, 64, 1224, 64, C.line, 1, `header-rule-${index}`); text(slide, "LUNA HIGH · 指定结构补测", { left: 930, top: 47, width: 294, height: 28 }, { fontSize: 12, color: C.muted, alignment: "right", verticalAlignment: "middle" }); text(slide, "中性编辑排版 · 原生结构按稿件重算", { left: 56, top: 116, width: 720, height: 24 }, { fontSize: 15, color: C.body, verticalAlignment: "middle" }); }
function footer(slide, index) { line(slide, 56, 672, 1224, 672, C.line, 1, `footer-rule-${index}`); text(slide, String(index + 1).padStart(2, "0"), { left: 1180, top: 681, width: 44, height: 20 }, { fontSize: 12, color: C.muted, alignment: "right", verticalAlignment: "middle" }); }
function note(slide, value) { slide.speakerNotes.textFrame.setText(value); }

function build12({ slide, frame: f }) {
  const names = ["相关性", "可解释性", "可观察性", "可验证性", "成本可承担"];
  const cx = f.left + f.width / 2;
  const top = f.top + 40, bottom = f.top + 406, gap = 8, layerH = (bottom - top - gap * (names.length - 1)) / names.length;
  const widthAt = (y) => { const p = Math.max(0, Math.min(1, (y - top) / (bottom - top))); return 410 - (410 - 180) * Math.pow(p, .82); };
  const layerFills = [C.surface, C.blue0, "#D1DDDD", C.blue1, C.accent];
  names.forEach((name, i) => { const y = top + i * (layerH + gap), y1 = y + layerH, w0 = widthAt(y), w1 = widthAt(y1), arc = Math.min(13, layerH * .22); const left0 = cx - w0 / 2, right0 = cx + w0 / 2, left1 = cx - w1 / 2, right1 = cx + w1 / 2; const sidePts = [{ x: left0, y: y + arc }, { x: left0 + 2, y: y + layerH * .38 }, { x: left1, y: y1 - arc }, { x: left1 + 8, y: y1 - 2 }, { x: cx, y: y1 + arc }, { x: right1 - 8, y: y1 - 2 }, { x: right1, y: y1 - arc }, { x: right0 - 2, y: y + layerH * .38 }, { x: right0, y: y + arc }]; polygon(slide, sidePts, layerFills[i], i === 4 ? C.accent : C.line, 1, `funnel-layer-${i + 1}`); ellipse(slide, { left: left0, top: y - arc * .35, width: w0, height: arc * 2 }, layerFills[i], { style: "solid", fill: i === 4 ? C.accent : C.line, width: 1 }, `funnel-top-cap-${i + 1}`); ellipse(slide, { left: left1, top: y1 - arc, width: w1, height: arc * 2 }, layerFills[i], { style: "solid", fill: i === 4 ? C.accent : C.line, width: 1 }, `funnel-bottom-cap-${i + 1}`); });
  const arrowColors = ["#D9E8EA", "#C8DDE0", "#B5D0D5", "#A2C2C9", "#8EADB6", "#7B9FA9"];
  const arrowTop = top - 30;
  for (let i = 0; i < 6; i++) { const y0 = i === 0 ? arrowTop : top + (bottom - top) * (i - 1) / 5; const y1 = i === 5 ? bottom + 12 : top + (bottom - top) * i / 5; const shaft0 = Math.max(6, widthAt(Math.max(top, y0)) * .035), shaft1 = Math.max(5, widthAt(Math.min(bottom, y1)) * .035); const head = i === 5 ? 17 : 9; polygon(slide, [{ x: cx - shaft0, y: y0 }, { x: cx + shaft0, y: y0 }, { x: cx + shaft1, y: y1 - head }, { x: cx + shaft1 + head, y: y1 - head }, { x: cx, y: y1 }, { x: cx - shaft1 - head, y: y1 - head }, { x: cx - shaft1, y: y1 - head }], arrowColors[i], arrowColors[i], 0, `funnel-flow-arrow-${i + 1}`); }
  names.forEach((name, i) => { const y = top + i * (layerH + gap), w0 = widthAt(y), left0 = cx - w0 / 2; const arrowHalf = Math.max(14, widthAt(y + layerH * .45) * .04); const titleLeft = cx + arrowHalf + 6; const titleWidth = Math.max(22, cx + w0 / 2 - titleLeft - 7); text(slide, `0${i + 1}`, { left: left0 + 14, top: y + 17, width: 28, height: 22 }, { fontSize: 14, color: i === 4 ? C.white : C.accent, bold: true }); text(slide, name, { left: titleLeft, top: y + 10, width: titleWidth, height: 44 }, { typeface: SERIF, fontSize: 16, color: i === 4 ? C.white : C.ink, bold: true, alignment: "left", verticalAlignment: "middle", lineSpacing: 1.05 }); });
  text(slide, "想法", { left: f.left + 16, top: f.top + 8, width: 90, height: 24 }, { fontSize: 16, color: C.muted, bold: true, alignment: "center" });
  text(slide, "可验证假设", { left: f.left + f.width - 150, top: f.top + f.height - 82, width: 140, height: 24 }, { fontSize: 16, color: C.accent, bold: true, alignment: "center" });
  text(slide, "连续筛选，范围持续收窄", { left: f.left + 355, top: f.top + 430, width: 460, height: 24 }, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["独立曲面层共享中轴并逐层收窄", "由上到下渐强的随形导流箭头", "入口想法与末端可验证假设保持清楚留白"] };
}

function build18({ slide, frame: f }) {
  const center = ellipse(slide, { left: f.left + 465, top: f.top + 160, width: 240, height: 150 }, C.ink, { style: "solid", fill: C.ink, width: 0 }, "hub-center");
  text(slide, "统一知识入口", { left: f.left + 487, top: f.top + 199, width: 196, height: 30 }, { typeface: SERIF, fontSize: 22, color: C.white, bold: true, alignment: "center" });
  text(slide, "唯一中心", { left: f.left + 514, top: f.top + 239, width: 140, height: 20 }, { fontSize: 14, color: C.paleAccent, alignment: "center" });
  const items = ["新人培训", "问题定位", "方案复用", "变更查询", "经验检索", "责任查找", "合规检查"];
  const pos = [[f.left + 22, f.top + 32], [f.left + 355, f.top + 4], [f.left + 805, f.top + 34], [f.left + 930, f.top + 190], [f.left + 820, f.top + 350], [f.left + 310, f.top + 386], [f.left + 28, f.top + 258]];
  const cc = { x: f.left + 585, y: f.top + 235 };
  pos.forEach(([x, y], i) => { const nc = { x: x + 89, y: y + 30 }; const dx = nc.x - cc.x, dy = nc.y - cc.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d; const start = { x: cc.x + ux * 118, y: cc.y + uy * 78 }; const tip = { x: nc.x - ux * 94, y: nc.y - uy * 34 }; const base = { x: tip.x - ux * 16, y: tip.y - uy * 16 }; const px = -uy * 7, py = ux * 7; const spokeColor = [C.blue4, C.blue3, C.blue2, C.blue1, C.blue3, C.blue2, C.blue1][i]; line(slide, start.x, start.y, base.x, base.y, spokeColor, 2, `hub-outward-spoke-${i + 1}`); polygon(slide, [tip, { x: base.x + px, y: base.y + py }, { x: base.x - px, y: base.y - py }], spokeColor, spokeColor, 0, `hub-outward-arrow-${i + 1}`); const n = roundRect(slide, { left: x, top: y, width: 178, height: 60 }, C.surface, { style: "solid", fill: C.line, width: 1 }, `hub-node-${i + 1}`); text(slide, items[i], { left: x + 12, top: y + 17, width: 154, height: 24 }, { fontSize: 16, color: C.ink, alignment: "center", verticalAlignment: "middle" }); });
  text(slide, "中心向外提供支持，外围七项工作彼此同级", { left: f.left + 290, top: f.top + 438, width: 590, height: 24 }, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["唯一中心连接同级外围节点", "中心向外的连续径向箭头承担支持语义", "七项外围工作不形成先后流程"] };
}

function build30({ slide, frame: f }) {
  const titles = ["基础操作", "独立处理", "跨组协作", "系统优化", "带教复用"];
  const bodies = ["熟悉基本工具", "可独立完成任务", "能在接口处协同", "主动改善系统", "把能力传给他人"];
  const baseY = f.top + 404;
  const peaks = titles.map((_, i) => ({ x: f.left + 105 + i * 230, y: baseY - 85 - i * 54 - (i === 2 ? 10 : i === 3 ? -4 : 0) }));
  const ridge = [{ x: f.left + 18, y: baseY }, ...peaks.flatMap((p, i) => [{ x: p.x - 78, y: p.y + 50 }, p, { x: p.x + 72, y: p.y + 58 }]), { x: f.left + 1138, y: baseY }];
  polygon(slide, ridge, "#D6E1E2", C.line, 1, "mountain-silhouette");
  peaks.forEach((p, i) => { const leftBase = { x: p.x - 78, y: baseY }, rightBase = { x: p.x + 72, y: baseY }; const seam = { x: p.x - 6, y: Math.min(baseY - 18, p.y + 118) }; polygon(slide, [leftBase, { x: p.x - 78, y: p.y + 50 }, p, seam, { x: p.x + 18, y: p.y + 84 }, rightBase], [C.blue0, "#CADBDD", "#BDCFD2", "#AEC4C9", "#9EB9C0"][i], "none", 0, `mountain-light-face-${i + 1}`); polygon(slide, [seam, p, { x: p.x + 72, y: p.y + 58 }, rightBase], ["#B5CACE", "#A8C0C7", "#99B4BC", "#8EAAB4", C.blue3][i], "none", 0, `mountain-shade-face-${i + 1}`); });
  for (let i = 0; i < peaks.length - 1; i++) line(slide, peaks[i].x, peaks[i].y, peaks[i + 1].x, peaks[i + 1].y, C.accent, 3, `mountain-route-${i + 1}`);
  peaks.forEach((p, i) => { ellipse(slide, { left: p.x - 15, top: p.y - 15, width: 30, height: 30 }, i === peaks.length - 1 ? C.accent : C.white, { style: "solid", fill: i === peaks.length - 1 ? C.accent : C.accent, width: 2 }, `mountain-milestone-${i + 1}`); text(slide, String(i + 1).padStart(2, "0"), { left: p.x - 15, top: p.y - 8, width: 30, height: 16 }, { fontSize: 10, color: i === peaks.length - 1 ? C.white : C.accent, bold: true, alignment: "center", verticalAlignment: "middle" }); const x = i === 0 ? p.x - 62 : i === 4 ? p.x - 154 : p.x - 84; const y = Math.max(f.top + 2, p.y - 94); text(slide, titles[i], { left: x, top: y, width: 170, height: 24 }, { typeface: SERIF, fontSize: 17, color: C.ink, bold: true, alignment: "center" }); text(slide, bodies[i], { left: x, top: y + 28, width: 170, height: 22 }, { fontSize: 13, color: C.body, alignment: "center" }); });
  line(slide, peaks.at(-1).x, peaks.at(-1).y - 20, peaks.at(-1).x, peaks.at(-1).y - 64, C.accent, 1.5, "summit-flag-pole"); polygon(slide, [{ x: peaks.at(-1).x, y: peaks.at(-1).y - 64 }, { x: peaks.at(-1).x + 28, y: peaks.at(-1).y - 56 }, { x: peaks.at(-1).x, y: peaks.at(-1).y - 47 }], C.accent, C.accent, 0, "summit-flag");
  text(slide, "能力要求持续提高，里程点落在连续上山路径", { left: f.left + 300, top: f.top + 438, width: 570, height: 24 }, { fontSize: 15, color: C.muted, alignment: "center" });
  return { preserved: ["同色阶多边形构成共享山脉", "上山路径连接五个关键峰顶", "里程点与局部峰节点对应并持续抬升"] };
}

const specs = [
  { caseId: "case-12", assetId: "convergence-simple-funnel-001", build: build12, reason: "五道筛选连续收窄，漏斗比阶段门禁更贴合稿件的范围收敛语义。", preservedFeatures: ["独立曲面层共享中轴并逐层收窄", "由上到下渐强的随形导流箭头", "入口想法与末端可验证假设保持清楚留白"] },
  { caseId: "case-18", assetId: "hub-directed-outcomes-002", build: build18, reason: "唯一知识入口向七项并列工作提供支持，外围之间没有流程。", preservedFeatures: ["唯一中心连接同级外围节点", "中心向外的连续径向箭头承担支持语义", "七项外围工作不形成先后流程"] },
  { caseId: "case-30", assetId: "progression-growth-curve-004", build: build30, reason: "稿件强调连续攀升和里程点，采用共享山脊与上山路径，而非离散矩形阶梯。", preservedFeatures: ["同色阶多边形构成共享山脉", "上山路径连接五个关键峰顶", "里程点与局部峰节点对应并持续抬升"] },
];

async function main() {
  process.env.RUNTIME_NODE_MODULES = runtimeNodeModules; process.env.RUNTIME_NODE = runtimeNode;
  await fs.mkdir(buildDir, { recursive: true }); await fs.mkdir(evidenceDir, { recursive: true }); await fs.rm(evidencePath, { force: true });
  const input = JSON.parse(await fs.readFile(path.join(here, "input.json"), "utf8"));
  const { invokeStructure, closeStructureRuntime } = await import(pathToFileURL(path.join(root, ".codex/skills/ppagent-structure/scripts/invoke.mjs")).href);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } }); const choices = [];
  for (let i = 0; i < input.length; i++) { const item = input[i], spec = specs.find(s => s.caseId === item.caseId), slide = presentation.slides.add(); header(slide, item, i); let status = "failed"; let changes = [];
    try { const result = await invokeStructure({ root, slide, skin, targetFrame: { left: frame.left + 15, top: frame.top, width: frame.width - 30, height: frame.height - 18 }, content: { caseId: item.caseId, title: item.title, manuscript: item.manuscript }, references: [{ assetId: spec.assetId, preservedFeatures: spec.preservedFeatures }], evidencePath, pageId: `${item.caseId}-targeted-c-page-01`, regionId: `${item.caseId}-targeted-c-structure`, reason: spec.reason, build: async args => spec.build(args) }); status = result.validation; changes = ["按 neutral-editorial-001 中性杂志风适配", "按稿件数量与角色重新求解原生几何", "保留参考资产的轮廓、层次和关系语法"]; note(slide, `来源稿件：${item.caseId} ${item.title}\n结构 Skill：${spec.assetId}\n本次保留：${spec.preservedFeatures.join("；")}\n指定补测原因：${spec.reason}\n验证：invokeStructure 返回 ${result.validation}，随后导出、重新导入、layout 与 PNG 检查。`); } catch (error) { status = `failed: ${error.message}`; note(slide, `来源稿件：${item.caseId} ${item.title}\n结构 Skill：${spec.assetId}\n调用失败：${error.stack ?? error}`); } footer(slide, i); choices.push({ caseId: item.caseId, selectedAssetIds: [spec.assetId], reason: spec.reason, preservedFeatures: spec.preservedFeatures, changes, invocationStatus: status, unresolved: status === "rendered-unreviewed" ? ["guide validation 状态仍为 not-validated，已完成本次独立重导入与视觉复核"] : ["需要修复结构调用或构建错误"] }); }
  await fs.writeFile(path.join(here, "choice.json"), JSON.stringify(choices, null, 2), "utf8");
  const draftPath = path.join(buildDir, "draft.pptx"); await (await PresentationFile.exportPptx(presentation)).save(draftPath); await fs.mkdir(path.dirname(finalizedPath), { recursive: true }); await fs.rm(finalizedPath, { force: true });
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
  await fs.rm(path.join(buildDir, "validation.json"), { force: true });
  const validation = await finalizePresentation({ explicitTotalSlideCount: 3, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [], workspaceDir: here, candidatePath: draftPath, finalPath: finalizedPath, pythonExecutable: runtimePython, integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"), layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"), layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"], fontPolicy: { basis: "design", families: [SERIF, SANS] }, verifyArtifactToolImport: true, receiptPath: path.join(buildDir, "validation.json") });
  await fs.copyFile(finalizedPath, candidatePath); const imported = await PresentationFile.importPptx(await FileBlob.load(candidatePath));
  for (let i = 0; i < imported.slides.items.length; i++) { const s = imported.slides.items[i]; const png = await s.export({ format: "png", scale: 1 }); await fs.writeFile(path.join(here, `rendered-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer())); const lay = await s.export({ format: "layout" }); await fs.writeFile(path.join(here, `layout-${String(i + 1).padStart(2, "0")}.json`), await lay.text(), "utf8"); }
  const inspect = await imported.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,layout", maxChars: 120000 }); await fs.writeFile(path.join(here, "layout.ndjson"), inspect.ndjson, "utf8"); await fs.writeFile(path.join(here, "build-result.json"), JSON.stringify({ candidatePath, validation, slideCount: imported.slides.items.length }, null, 2), "utf8"); await closeStructureRuntime(); console.log(JSON.stringify({ candidatePath, slideCount: imported.slides.items.length, validation }, null, 2));
}
main().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
