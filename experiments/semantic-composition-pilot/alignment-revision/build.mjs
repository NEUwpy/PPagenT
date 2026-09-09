import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../../src/runtime/skins/northeastern-university.mjs";
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin, universityMckinseyTypography } from "../../../src/runtime/invoke-university-structure.mjs";
import { resolveComposition, buildComposition } from "../../../src/composition/resolve.mjs";
import { addBox, addLine, addText, qaElementName } from "../../../src/asset-runtime/component-builders.mjs";
import { resolveStructureTheme } from "../../../src/visual-runtime/html-component-theme.mjs";

const here = path.resolve(import.meta.dirname);
const root = path.resolve(here, "../../..");
const plan = JSON.parse(await fs.readFile(path.join(here, "composition-intent.json"), "utf8"));
const config = JSON.parse(await fs.readFile(path.join(here, "run-config.json"), "utf8"));
const bodyFrame = universityMckinseySkin.bodyFrame;
const typography = universityMckinseyTypography;
const theme = resolveStructureTheme(universityMckinseySkin);
const evidencePath = path.join(here, "structure-calls.ndjson");
const outDir = path.join(here, "final");
const outPptx = path.join(outDir, "semantic-composition-pilot-alignment-revision-20260909.pptx");
const renderDir = path.join(here, "renders-alignment-revision-20260909");

const pages = [
  { payload: { assetId: "northeastern-university-body-001", parameters: {} }, content: { pageId: "P1", title: "分级准入兼顾速度、记录与可回退性" }, meta: { sectionName: "比较决策" }, intent: { intentId: "semantic-composition-pilot" }, decision: { selectedAssetId: "northeastern-university-body-001" } },
  { payload: { assetId: "northeastern-university-body-001", parameters: {} }, content: { pageId: "P2", title: "每一步都产生下一道关口需要的证据" }, meta: { sectionName: "过程与门槛" }, intent: { intentId: "semantic-composition-pilot" }, decision: { selectedAssetId: "northeastern-university-body-001" } },
  { payload: { assetId: "northeastern-university-body-001", parameters: {} }, content: { pageId: "P3", title: "三类证据支持限量试点，但不证明成效" }, meta: { sectionName: "多证据论证" }, intent: { intentId: "semantic-composition-pilot" }, decision: { selectedAssetId: "northeastern-university-body-001" } },
];

const pageById = new Map(plan.pages.map((page) => [page.pageId, page.compositionIntent]));

function name(groupId, role) {
  return qaElementName({ parent: "semantic-composition-pilot", within: groupId, role });
}

function text(slide, value, frame, groupId, role, style = {}) {
  return addText(slide, value, frame, {
    name: name(groupId, role),
    typeface: universityMckinseySkin.fonts.body,
    fontSize: style.fontSize ?? typography.body,
    color: style.color ?? theme.body,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    autoFit: "none",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
    ...style,
  });
}

function box(slide, frame, groupId, role, style = {}) {
  return addBox(slide, frame, {
    name: name(groupId, role),
    geometry: style.geometry ?? "rect",
    fill: style.fill ?? theme.primaryWash,
    line: style.line ?? { style: "solid", fill: theme.line, width: 1 },
    shadow: style.shadow ?? "shadow-none",
    borderRadius: 0,
  });
}

function inset(frame, pad = 16) {
  return { left: frame.left + pad, top: frame.top + pad, width: frame.width - pad * 2, height: frame.height - pad * 2 };
}

function estimateLineCount(value, width, fontSize = 18) {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.95)));
  return String(value).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / charsPerLine)), 0);
}

function addP1Comparison(slide, frame, groupId) {
  box(slide, frame, groupId, "surface");
  const x = frame.left + 16;
  const y = frame.top + 12;
  const w = frame.width - 32;
  text(slide, "同口径比较｜模拟估计", { left: x, top: y, width: w, height: 24 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true });
  const cols = [0, 0.19, 0.46, 0.73].map((ratio) => x + w * ratio);
  const widths = [w * 0.19, w * 0.27, w * 0.27, w * 0.27];
  const headers = ["维度", "A 直接开放", "B 分级准入", "C 全预约制"];
  const rows = [
    ["进入方式", "提交后自动获得环境", "资格核对→两周试点→按门槛扩围", "每次运行先预约、人工确认"],
    ["首次可用时间", "约 1 个工作日", "约 3 个工作日；固定名单后约 1 个工作日", "约 4 个工作日；取决于预约空档"],
    ["初期人工投入", "管理员工作日/周：1.5", "管理员工作日/周：试点 2.6；稳定后估计 1.4", "管理员工作日/周：5.0"],
    ["记录与回溯", "低：缺入场和异常字段", "中高：申请、参数、输出、异常分阶段记录", "高：每次由管理员登记"],
    ["预估未闭环/季度", "12 份", "5 份", "3 份"],
    ["失败时动作", "难回收已开放权限", "暂停新申请，留在试点内修规则", "缩减预约时段并重新排队"],
  ];
  const headerY = y + 30;
  const headerH = 32;
  const fittedRowHeights = rows.map((row, rowIndex) => {
    const lines = Math.max(...row.map((value, i) => estimateLineCount(value, widths[i] - 16)));
    const natural = lines * 20 + 6;
    const floorByContent = [34, 48, 54, 48, 34, 48][rowIndex];
    return Math.max(floorByContent, natural);
  });
  headers.forEach((value, i) => {
    box(slide, { left: cols[i], top: headerY, width: widths[i], height: headerH }, groupId, `header-${i}`, { fill: theme.primaryPale, line: { style: "solid", fill: theme.line, width: 1 } });
    text(slide, value, { left: cols[i] + 8, top: headerY + 5, width: widths[i] - 16, height: headerH - 8 }, groupId, `header-text-${i}`, { fontSize: 18, bold: true, color: theme.dark, verticalAlignment: "middle" });
  });
  let cursor = headerY + headerH;
  rows.forEach((row, r) => {
    const rowH = fittedRowHeights[r];
    row.forEach((value, c) => {
      const top = cursor;
    const emphasize = c === 2;
    box(slide, { left: cols[c], top, width: widths[c], height: rowH }, groupId, `cell-${r}-${c}`, { fill: emphasize ? "#F0F5FD" : theme.surface, line: { style: "solid", fill: theme.line, width: 1 } });
      text(slide, value, { left: cols[c] + 8, top: top + 3, width: widths[c] - 16, height: rowH - 6 }, groupId, `cell-text-${r}-${c}`, { fontSize: 18, bold: c === 0, color: emphasize ? theme.dark : theme.body, verticalAlignment: "middle" });
    });
    cursor += rowH;
  });
}

function addP1Decision(slide, frame, groupId) {
  const x = frame.left;
  text(slide, "支持的选择", { left: x, top: frame.top, width: frame.width, height: 24 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true });
  box(slide, { left: x, top: frame.top + 34, width: 5, height: 64 }, groupId, "accent", { fill: theme.primaryColor, line: { style: "solid", fill: "none", width: 0 } });
  text(slide, "先试行 B。A 只作高峰期临时应急入口，C 保留给高风险项目。", { left: x + 16, top: frame.top + 34, width: frame.width - 16, height: 66 }, groupId, "decision", { fontSize: 21, bold: true, color: theme.dark });
  text(slide, "选择 B 只牺牲少量首次访问速度，换取可检查记录和可逆的暂停动作。", { left: x, top: frame.top + 96, width: frame.width, height: 28 }, groupId, "detail", { fontSize: 18, color: theme.body });
}

function addP1Assumptions(slide, frame, groupId) {
  text(slide, "前提与边界", { left: frame.left, top: frame.top, width: frame.width, height: 24 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true });
  text(slide, "三种模型共享模拟需求和管理员容量假设。\n估计尚未由真实运行验证；需求结构变化或高风险申请增加，都可能改变排序。", { left: frame.left, top: frame.top + 36, width: frame.width, height: 80 }, groupId, "body", { fontSize: typography.body, color: theme.body });
}

function addP2Conditions(slide, frame, groupId) {
  text(slide, "阶段证据与进入条件", { left: frame.left, top: frame.top, width: frame.width, height: 26 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true, lineSpacing: 1.05 });
  const lines = [
    "阶段一（第 1—2 天）：登记与资格核对，\n六项信息齐全，确认责任与低风险范围。",
    "阶段二（第 1—2 周）：限量运行与异常记录；\n最多 5 个项目，记录参数、输出位置和异常处理人。",
    "阶段三（第 3 周评审）：复核两周记录、异常闭环和管理员工作量；\n决定是否有限扩围。",
    "交付物：登记记录、运行记录和评审结论；缺项时不进入下一阶段。",
  ];
  let cursor = frame.top + 38;
  lines.forEach((line, i) => {
    const lineCount = estimateLineCount(line, frame.width - 20, 18);
    const textHeight = lineCount * 21.5;
    text(slide, "•", { left: frame.left, top: cursor, width: 16, height: textHeight }, groupId, `bullet-${i}`, { fontSize: 18, color: theme.primaryColor, bold: true, lineSpacing: 1.15 });
    text(slide, line, { left: frame.left + 20, top: cursor, width: frame.width - 20, height: textHeight }, groupId, `condition-${i}`, { fontSize: 18, color: theme.body, lineSpacing: 1.15 });
    cursor += textHeight + 7;
  });
}

function addP2Gates(slide, frame, groupId) {
  box(slide, frame, groupId, "surface");
  text(slide, "三个关口｜目标门槛，不是已取得结果", { left: frame.left + 16, top: frame.top + 14, width: frame.width - 32, height: 26 }, groupId, "heading", { fontSize: 21, color: theme.primaryColor, bold: true, lineSpacing: 1.05 });
  const rows = [["01", "可进入", "六项登记信息齐全，责任人与低风险范围确认。"], ["02", "可追溯", "完整率 ≥90%，高风险异常在 1 个工作日内有责任人和结论。"], ["03", "可扩围", "连续两周完整率 ≥95%，无未关闭异常，负荷 ≤3 个工作日/周。"]];
  let cursor = frame.top + 48;
  rows.forEach((row, i) => {
    const detailWidth = frame.width - 166;
    const rowH = Math.max(30, estimateLineCount(row[2], detailWidth, 18) * 21.5 + 6);
    const top = cursor;
    text(slide, row[0], { left: frame.left + 16, top, width: 34, height: 28 }, groupId, `no-${i}`, { fontSize: 18, color: theme.primaryColor, bold: true, lineSpacing: 1.15 });
    text(slide, row[1], { left: frame.left + 58, top, width: 82, height: 28 }, groupId, `name-${i}`, { fontSize: 18, color: theme.dark, bold: true, lineSpacing: 1.15 });
    text(slide, row[2], { left: frame.left + 150, top, width: detailWidth, height: rowH }, groupId, `detail-${i}`, { fontSize: 18, color: theme.body, lineSpacing: 1.15 });
    cursor += rowH + 8;
  });
}

function addP2Fallback(slide, frame, groupId) {
  const textLeft = frame.left + 16;
  const textWidth = frame.width - 16;
  text(slide, "关口失败后的动作", { left: textLeft, top: frame.top, width: textWidth, height: 26 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true, lineSpacing: 1.05 });
  box(slide, { left: frame.left, top: frame.top + 36, width: 5, height: 72 }, groupId, "accent", { fill: theme.primaryColor, line: { style: "solid", fill: "none", width: 0 } });
  const decision = "暂停新申请，保留当前规模，修订字段、模板或异常规则。";
  const decisionHeight = Math.max(30, estimateLineCount(decision, textWidth, 18) * 21.5 + 6);
  text(slide, decision, { left: textLeft, top: frame.top + 36, width: textWidth, height: decisionHeight }, groupId, "decision", { fontSize: 18, color: theme.dark, bold: true, lineSpacing: 1.15 });
  text(slide, "已有记录保留，不把失败项目静默删除；修订后再决定是否重启评审。", { left: textLeft, top: frame.top + 36 + decisionHeight + 20, width: textWidth, height: 48 }, groupId, "detail", { fontSize: 18, color: theme.body, lineSpacing: 1.15 });
}

function addP3Evidence(slide, frame, groupId, kind) {
  box(slide, frame, groupId, "surface", { fill: theme.primaryWash, line: { style: "solid", fill: theme.line, width: 1 } });
  box(slide, { left: frame.left, top: frame.top, width: frame.width, height: 5 }, groupId, "accent", { fill: theme.primaryColor, line: { style: "solid", fill: "none", width: 0 } });
  const content = {
    demand: { title: "证据一｜需求集中", meta: "8 周模拟观察", value: "74 / 120", unit: "份申请", bars: [["三集群", 0.617, "61.7%"], ["相同 GPU", 0.433, "43.3%"]], body: "其中相同 GPU 为 52/120。集中度提示模板可能复用，不等于权限范围可直接合并。" },
    incidents: { title: "证据二｜记录缺口", meta: "8 周模拟复核", value: "14 / 78", unit: "份完成运行", bars: [["缺口率", 0.179, "17.9%"]], body: "其中 9/14 来自两个项目集群（分母为 14）。缺口集中支持先补字段与责任人，不能归因于单一申请人。" },
    capacity: { title: "证据三｜管理员容量", meta: "8 周模拟估算", value: "5.0 vs 3.5", unit: "管理员工作日 / 周", bars: [["全量审核", 1, "5.0"], ["可支配", 0.70, "3.5"], ["限量试点", 0.52, "2.6"]], body: "模板稳定后预计 1.4 个管理员工作日/周。上述人日为模拟工作量估计，需用阶段二记录校准。" },
  }[kind];
  text(slide, content.title, { left: frame.left + 14, top: frame.top + 14, width: frame.width - 28, height: 24 }, groupId, "heading", { fontSize: 21, color: theme.primaryColor, bold: true });
  text(slide, content.meta, { left: frame.left + 14, top: frame.top + 38, width: frame.width - 28, height: 18 }, groupId, "meta", { fontSize: 14, color: theme.muted });
  text(slide, content.value, { left: frame.left + 14, top: frame.top + 56, width: 170, height: 42 }, groupId, "value", { fontSize: 36, color: theme.primaryColor, bold: true });
  text(slide, content.unit, { left: frame.left + 190, top: frame.top + 68, width: frame.width - 204, height: 24 }, groupId, "unit", { fontSize: 14, color: theme.muted });
  content.bars.forEach(([label, ratio, value], i) => {
    const top = frame.top + 108 + i * 30;
    text(slide, label, { left: frame.left + 14, top, width: 100, height: 22 }, groupId, `bar-label-${i}`, { fontSize: 18, color: theme.body });
    box(slide, { left: frame.left + 120, top: top + 4, width: 135, height: 12 }, groupId, `bar-track-${i}`, { fill: "#E6EDF8", line: { style: "solid", fill: "none", width: 0 } });
    box(slide, { left: frame.left + 120, top: top + 4, width: 135 * ratio, height: 12 }, groupId, `bar-fill-${i}`, { fill: i === 0 && kind === "incidents" ? theme.dark : theme.primaryColor, line: { style: "solid", fill: "none", width: 0 } });
    text(slide, value, { left: frame.left + 262, top, width: 90, height: 22 }, groupId, `bar-value-${i}`, { fontSize: 18, color: theme.dark, bold: true });
  });
  text(slide, content.body, { left: frame.left + 14, top: frame.top + frame.height - 78, width: frame.width - 28, height: 68 }, groupId, "body", { fontSize: 18, color: theme.body });
}

function addP3Conclusion(slide, frame, groupId) {
  text(slide, "综合判断｜三证据共同支撑", { left: frame.left, top: frame.top, width: frame.width, height: 24 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true });
  box(slide, { left: frame.left, top: frame.top + 34, width: 5, height: 58 }, groupId, "accent", { fill: theme.primaryColor, line: { style: "solid", fill: "none", width: 0 } });
  text(slide, "先做 B 的限量试点，再用三周评审决定是否扩大范围。", { left: frame.left + 16, top: frame.top + 34, width: frame.width - 16, height: 56 }, groupId, "decision", { fontSize: 21, color: theme.dark, bold: true });
  text(slide, "需求回答入口是否可能复用，记录缺口回答哪里需要先补证据，容量约束回答为什么不能一次全量开放。三类证据的交集支持行动方案，但不支持宣称已经提升效率。", { left: frame.left, top: frame.top + 108, width: frame.width, height: 90 }, groupId, "body", { fontSize: 18, color: theme.body });
}

function addP3Limit(slide, frame, groupId) {
  text(slide, "证据边界与验证", { left: frame.left, top: frame.top, width: frame.width, height: 24 }, groupId, "heading", { fontSize: typography.heading, color: theme.primaryColor, bold: true });
  text(slide, "观察没有随机对照，8 周窗口可能受课程周期影响。阶段二需记录字段完整率、首次可用时间、实际工时和异常闭环时间，再按预先写明的门槛复核。", { left: frame.left, top: frame.top + 36, width: frame.width, height: 108 }, groupId, "body", { fontSize: 18, color: theme.body });
  addLine(slide, { x: frame.left, y: frame.top + 154 }, { x: frame.left + frame.width, y: frame.top + 154 }, theme.line, 1, name(groupId, "rule"));
  text(slide, "若记录不完整或工作量超过容量，暂停扩围并保留当前规模。", { left: frame.left, top: frame.top + 166, width: frame.width, height: 48 }, groupId, "meta", { fontSize: 18, color: theme.body });
}

async function buildPage(page, slide) {
  const intent = pageById.get(page.content.pageId);
  const contracts = config.pages[page.content.pageId].contracts;
  const resolved = resolveComposition({ pageId: page.content.pageId, intent, bodyFrame, contracts, style: config.style });
  const builders = {
    "p1-comparison": async ({ frame }) => { addP1Comparison(slide, frame, "p1-comparison"); },
    "p1-decision": async ({ frame }) => { addP1Decision(slide, frame, "p1-decision"); },
    "p1-assumptions": async ({ frame }) => { addP1Assumptions(slide, frame, "p1-assumptions"); },
    "p2-stages": async ({ frame }) => invokeUniversityStructure({ root, slide, assetId: "progression-maturity-steps-002", targetFrame: frame, content: { levels: [{ key: "intake", title: "登记", body: "" }, { key: "pilot", title: "限量运行", body: "" }, { key: "scale", title: "有限扩围", body: "" }], showStatus: false }, evidencePath, pageId: "P2", regionId: "p2-stages", reason: "过程页仅让成熟度阶梯承载三个短阶段名，完整定义与条件由相邻语义组承载" }),
    "p2-conditions": async ({ frame }) => { addP2Conditions(slide, frame, "p2-conditions"); },
    "p2-gates": async ({ frame }) => { addP2Gates(slide, frame, "p2-gates"); },
    "p2-fallback": async ({ frame }) => { addP2Fallback(slide, frame, "p2-fallback"); },
    "p3-demand": async ({ frame }) => { addP3Evidence(slide, frame, "p3-demand", "demand"); },
    "p3-incidents": async ({ frame }) => { addP3Evidence(slide, frame, "p3-incidents", "incidents"); },
    "p3-capacity": async ({ frame }) => { addP3Evidence(slide, frame, "p3-capacity", "capacity"); },
    "p3-conclusion": async ({ frame }) => { addP3Conclusion(slide, frame, "p3-conclusion"); },
    "p3-limit": async ({ frame }) => { addP3Limit(slide, frame, "p3-limit"); },
  };
  const selectedBuilders = Object.fromEntries(intent.readingOrder.map((id) => [id, builders[id]]));
  const receipt = await buildComposition({ resolved, builders: selectedBuilders });
  await fs.writeFile(path.join(here, `resolved-${page.content.pageId}.json`), JSON.stringify(resolved, null, 2));
  await fs.writeFile(path.join(here, `receipt-${page.content.pageId}.json`), JSON.stringify(receipt, null, 2));
}

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(renderDir, { recursive: true });
await fs.rm(evidencePath, { force: true });
const starter = await createNortheasternUniversityStarter({
  starterPptx: path.join(outDir, "template-starter-final-20260909.pptx"),
  pages,
  manuscriptSource: "experiments/semantic-composition-pilot/manuscript.md",
});
try {
  for (const [index, page] of pages.entries()) await buildPage(page, starter.slides[index]);
  const exported = await PresentationFile.exportPptx(starter.presentation);
  await exported.save(outPptx);
} finally {
  await closeStructureRuntime();
}

const imported = await PresentationFile.importPptx(await FileBlob.load(outPptx));
for (const [index, slide] of imported.slides.items.entries()) {
  const png = await imported.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(renderDir, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(renderDir, `slide-${index + 1}.layout.json`), await layout.text());
}
console.log(JSON.stringify({ outPptx, renderDir, evidencePath, slides: imported.slides.items.length }, null, 2));
