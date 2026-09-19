import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "../../src/ppt-engine/index.mjs";
import { invokeStructure, closeStructureRuntime } from "../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "experiments/home-gray-magazine-20260919");
const BUILD = path.join(OUT, "build");
const EVIDENCE = path.join(OUT, "evidence");
const NODE = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";

const C = Object.freeze({ bg: "#F5F4EF", surface: "#EEECE5", ink: "#201F1D", body: "#4D4A42", muted: "#84827A", line: "#D7D4CA", accent: "#A35D4F", pale: "#E4C8C0", blue: "#7899A8" });
const F = Object.freeze({ display: "Noto Serif SC", body: "Noto Sans SC" });
const BODY = Object.freeze({ left: 56, top: 155, width: 1168, height: 492 });
const theme = Object.freeze({ id: "neutral-editorial-001", font: F.body, background: C.bg, surface: C.surface, dark: C.ink, body: C.body, muted: C.muted, line: C.line, primaryColor: C.accent, intensity3: "#B9796B", intensity4: "#9B5548", typography: { componentHeading: 18, componentTitle: 17, componentItemTitle: 15, componentLead: 14, componentBody: 12.75, componentLabel: 12, componentMeta: 11.25 } });

function text(slide, value, frame, style = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", name: style.name, position: frame, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = String(value ?? "");
  shape.text.style = { typeface: style.typeface ?? F.body, fontSize: style.fontSize ?? 17, color: style.color ?? C.body, bold: Boolean(style.bold), alignment: style.alignment ?? "left", verticalAlignment: style.verticalAlignment ?? "top", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return shape;
}
function rect(slide, frame, fill, line = C.line, radius = "rounded-lg", name) {
  return slide.shapes.add({ geometry: "roundRect", name, position: frame, fill, line: { style: "solid", fill: line, width: 1 }, borderRadius: radius, shadow: "shadow-none" });
}
function rule(slide, from, to, color = C.line, width = 1, name) {
  return slide.shapes.add({ geometry: "line", name, position: { left: Math.min(from.x, to.x), top: Math.min(from.y, to.y), width: Math.max(1, Math.abs(to.x - from.x)), height: Math.max(1, Math.abs(to.y - from.y)), horizontalFlip: to.x < from.x, verticalFlip: to.y < from.y }, fill: "none", line: { style: "solid", fill: color, width } });
}
function shell(slide) {
  slide.background.fill = C.bg;
  text(slide, "04", { left: 56, top: 34, width: 34, height: 28 }, { typeface: F.display, fontSize: 16, color: C.accent, name: "chapter" });
  text(slide, "从不足到感悟", { left: 104, top: 31, width: 260, height: 32 }, { typeface: F.display, fontSize: 25, color: C.ink, bold: true, name: "shell-title" });
  rule(slide, { x: 370, y: 49 }, { x: 1224, y: 49 }, C.line, 1, "shell-rule");
  text(slide, "01", { left: 1192, top: 675, width: 24, height: 18 }, { typeface: F.display, fontSize: 15, color: C.muted, name: "page-number" });
  text(slide, "内容组织 → 灰稿 → 杂志风成稿", { left: 56, top: 676, width: 310, height: 18 }, { fontSize: 14, color: C.muted, name: "footer" });
}

function buildLocalConvergence({ slide, frame, content, skin }) {
  const left = frame.left, top = frame.top, width = frame.width, height = frame.height;
  const inputW = Math.min(215, width * 0.37), inputH = 42, inputX = left + 8;
  const resultW = Math.min(156, width * 0.28), resultH = 132, resultX = left + width - resultW - 10, resultY = top + (height - resultH) / 2;
  const spineX = resultX - 32, centerY = resultY + resultH / 2;
  const inputs = content.inputs;
  const ys = inputs.map((_, i) => top + 30 + i * ((height - 60) / Math.max(1, inputs.length - 1)));
  // Connectors first: the structure's defining feature is separated lanes converging into one result.
  ys.forEach((y, i) => rule(slide, { x: inputX + inputW, y: y + inputH / 2 }, { x: spineX, y: centerY }, [C.blue, "#8BA9B4", "#A9BABF"][i] ?? C.blue, 4, `merge-lane-${i + 1}`));
  rule(slide, { x: spineX, y: centerY }, { x: resultX, y: centerY }, C.accent, 3, "merge-result-line");
  inputs.forEach((item, i) => {
    rect(slide, { left: inputX, top: ys[i], width: inputW, height: inputH }, C.surface, C.line, "rounded-lg", `merge-input-${i + 1}`);
    rect(slide, { left: inputX, top: ys[i], width: 5, height: inputH }, i === 0 ? C.accent : C.blue, "none", "rounded-lg", `merge-input-accent-${i + 1}`);
    text(slide, item.title, { left: inputX + 15, top: ys[i] + 5, width: inputW - 24, height: 18 }, { typeface: F.display, fontSize: 14, color: C.ink, bold: true, name: `merge-input-${i + 1}-title` });
    text(slide, item.body, { left: inputX + 15, top: ys[i] + 24, width: inputW - 24, height: 15 }, { fontSize: 11.5, color: C.body, name: `merge-input-${i + 1}-body` });
  });
  rect(slide, { left: resultX, top: resultY, width: resultW, height: resultH }, C.accent, C.accent, "rounded-xl", "merge-result");
  text(slide, "落地阻力", { left: resultX + 17, top: resultY + 37, width: resultW - 34, height: 30 }, { typeface: F.display, fontSize: 22, color: "#FBFAF6", bold: true, alignment: "center", name: "merge-result-title" });
  text(slide, "设计已完成，但三项障碍仍未消除", { left: resultX + 17, top: resultY + 77, width: resultW - 34, height: 36 }, { fontSize: 13, color: "#FBFAF6", alignment: "center", name: "merge-result-body" });
  return { nativeShapeDelta: slide.shapes.items.length, mode: "native-adapted", structure: "convergence-many-to-one-003" };
}

async function main() {
  await fs.mkdir(BUILD, { recursive: true }); await fs.mkdir(EVIDENCE, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add(); shell(slide);
  text(slide, "梳理两点不足，明确四点工作感悟", { left: 56, top: 92, width: 890, height: 32 }, { typeface: F.display, fontSize: 22, color: C.ink, bold: true, name: "page-claim" });
  text(slide, "问题与体会分为两类：左侧呈现落地阻力的构成，右侧展开推进变革时的四点判断。", { left: 56, top: 126, width: 1080, height: 20 }, { fontSize: 15, color: C.body, name: "page-support" });
  const left = { left: 56, top: 180, width: 520, height: 440 }, right = { left: 610, top: 180, width: 614, height: 440 };
  text(slide, "两点不足", { left: left.left, top: left.top, width: 200, height: 28 }, { typeface: F.display, fontSize: 21, color: C.ink, bold: true, name: "issues-heading" });
  text(slide, "四点感悟", { left: right.left, top: right.top, width: 200, height: 28 }, { typeface: F.display, fontSize: 21, color: C.ink, bold: true, name: "insights-heading" });
  const issueFrame = { left: left.left, top: left.top + 42, width: 520, height: 210 };
  await invokeStructure({ root: ROOT, slide, skin: { ...theme, bodyFrame: BODY }, targetFrame: issueFrame, execution: "native", references: [{ assetId: "convergence-many-to-one-003", preservedFeatures: ["分离输入、平滑汇聚路径和唯一共同结果", "所有路径真正接入结果"] }], content: { inputs: [{ key: "design", title: "顶层设计已完成", body: "设计已形成" }, { key: "climate", title: "变革氛围未形成", body: "内部氛围不足" }, { key: "system", title: "系统支撑有差距", body: "信息系统不足" }, { key: "market", title: "市场化机制不足", body: "机制仍待补齐" }], result: { title: "落地阻力", body: "三项障碍汇聚" } }, evidencePath: path.join(EVIDENCE, "structure-invocations.ndjson"), pageId: "p1", regionId: "implementation", reason: "灰稿明确该条目需要呈现设计已完成与三项障碍汇聚到落地阻力；保留多路汇聚的结构语法，按杂志风重绘为原生可编辑对象。", build: buildLocalConvergence });
  text(slide, "合规管理短板亟待提升", { left: left.left, top: 450, width: 500, height: 24 }, { typeface: F.display, fontSize: 17, color: C.ink, bold: true, name: "compliance-title" });
  text(slide, "2017年巡视整改取得一定成效，也暴露人力条线基础管理薄弱：认识待提升、作风待转变、能力待增强、协同待深化。", { left: left.left, top: 484, width: 500, height: 72 }, { fontSize: 15, color: C.body, name: "compliance-body" });
  rule(slide, { x: left.left, y: 590 }, { x: left.left + 520, y: 590 }, C.line, 1, "left-divider");
  const insightRows = [
    ["01", "统一语言，促进业务与人力协同", "沿BLM管理模型统一语言、目标、策略，贯通业务战略、人力战略规划与落地方案，达成“三个市场化”转型目标。"],
    ["02", "解决实际问题是唯一检验标准", "以能否解决实际问题检验变革成效，力求落地有实效。"],
    ["03", "顶层设计持续迭代", "加速试点、小步快跑；对标行业优秀实践，结合落地成效持续优化体系。"],
    ["04", "统筹变革、合规与作风", "变革是硬道理，合规是硬要求，作风是硬标准；以规范管理的效率强化转型力度，以优良的思想、工作和战斗作风加快转型。"],
  ];
  let y = 223;
  insightRows.forEach(([num, title, body], i) => { text(slide, num, { left: right.left, top: y + 5, width: 28, height: 22 }, { typeface: F.display, fontSize: 15, color: C.accent, name: `insight-${i + 1}-num` }); text(slide, title, { left: right.left + 42, top: y, width: 520, height: 24 }, { typeface: F.display, fontSize: 17, color: C.ink, bold: true, name: `insight-${i + 1}-title` }); text(slide, body, { left: right.left + 42, top: y + 31, width: 540, height: i === 3 ? 54 : 36 }, { fontSize: 15, color: C.body, name: `insight-${i + 1}-body` }); if (i < 3) rule(slide, { x: right.left, y: y + (i === 3 ? 80 : 70) }, { x: right.left + 590, y: y + (i === 3 ? 80 : 70) }, C.line, 1, `insight-rule-${i + 1}`); y += i === 3 ? 92 : 92; });
  slide.speakerNotes.textFrame.setText("[Sources]\n- 灰稿输入：experiments/gray-checkpoint-20260916/latest/范本原稿-分区修订灰稿.pptx\n- 计划输入：outputs/gray-block-layout-20260916/reference/state.json\n- 灰稿定义与最新共识：origin/opencode，当前 revision 8c19064e\n- 杂志风规则：rules/排版体系/杂志风.md；Skin：rules/skins/中性编辑排版.md\n- 结构参考：assets/结构图/多路汇聚结果-003（本页按其视觉语法做本次原生适配）\n[/Sources]");
  const candidate = path.join(BUILD, "candidate.pptx"); await (await PresentationFile.exportPptx(presentation)).save(candidate);
  const png = await presentation.export({ slide, format: "png", scale: 1 }); await fs.writeFile(path.join(BUILD, "slide-01.png"), new Uint8Array(await png.arrayBuffer()));
  await fs.writeFile(path.join(BUILD, "slide-01.layout.json"), await (await slide.export({ format: "layout" })).text(), "utf8");
  await fs.mkdir(path.join(OUT, "deliverables"), { recursive: true });
  await fs.copyFile(candidate, path.join(OUT, "deliverables", "gray-to-magazine.pptx"));
  const result = { status: "exported", slideCount: presentation.slides.items.length, nativeObjects: slide.shapes.items.length };
  await fs.copyFile(path.join(OUT, "deliverables", "gray-to-magazine.pptx"), path.join(OUT, "gray-to-magazine.pptx"));
  await fs.copyFile(path.join(BUILD, "slide-01.png"), path.join(OUT, "gray-to-magazine.png"));
  await fs.writeFile(path.join(EVIDENCE, "finalizer-result.json"), JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(EVIDENCE, "final-hash.txt"), `${crypto.createHash("sha256").update(await fs.readFile(path.join(OUT, "gray-to-magazine.pptx"))).digest("hex")}\n`);
  console.log(JSON.stringify({ output: path.join(OUT, "gray-to-magazine.pptx"), preview: path.join(OUT, "gray-to-magazine.png"), validation: result }, null, 2));
}
try { await main(); } finally { await closeStructureRuntime(); }
