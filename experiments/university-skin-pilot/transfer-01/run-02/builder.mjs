import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../");
const OUT = HERE;
const EVIDENCE = path.join(OUT, "evidence");
const W = 1280;
const H = 720;
const BODY = { left: 55, top: 166, width: 1170, height: 492 };
const C = Object.freeze({
  white: "#FFFFFF",
  ink: "#252B33",
  gray: "#707780",
  blue: "#24578C",
  pale: "#E7EEF4",
  paleBlue: "#F1F6FA",
  line: "#B8C7D2",
});
const FONT = "Microsoft YaHei";
const SKIN = Object.freeze({
  id: "university-transfer-01-v3-local-run-02",
  bodyFrame: BODY,
  componentTheme: Object.freeze({
    background: C.white,
    surface: C.white,
    accent: C.blue,
    accentAlt: "#527D99",
    accentSoft: C.pale,
    dark: C.ink,
    body: C.ink,
    muted: C.gray,
    line: C.line,
    font: FONT,
    typography: Object.freeze({
      componentHeading: 16,
      componentTitle: 16.5,
      componentItemTitle: 15,
      componentLead: 15,
      componentBody: 15,
      componentLabel: 15,
      componentMeta: 12,
    }),
  }),
});

function addText(slide, name, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: FONT,
    fontSize: 20,
    color: C.ink,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    ...style,
  };
  return box;
}

function addRule(slide, name, left, top, width, color = C.line, weight = 1, height = 0) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: color, width: weight },
  });
}

function addFooter(slide, page) {
  addRule(slide, `footer-rule-${page}`, 55, 658, 1170, C.line, 1);
  addText(slide, `footer-source-${page}`, "虚构教学方案讨论稿｜拟议安排，不代表已观察到教学成效", { left: 55, top: 672, width: 650, height: 20 }, { fontSize: 16, color: C.gray, verticalAlignment: "middle" });
  addText(slide, `footer-page-${page}`, `${String(page).padStart(2, "0")} / 03`, { left: 1135, top: 672, width: 90, height: 20 }, { fontSize: 16, color: C.gray, alignment: "right", verticalAlignment: "middle" });
}

function addTitle(slide, page, text) {
  addText(slide, `page-${page}-title`, text, { left: 55, top: 36, width: 1170, height: 88 }, { fontSize: 32, bold: true, color: C.ink, verticalAlignment: "middle" });
}

function setNotes(slide) {
  slide.speakerNotes.textFrame.setText("[Sources]\n- experiments/university-skin-pilot/transfer-01/manuscript.md（虚构稿件；本页内容均为拟议安排）");
  slide.speakerNotes.setVisible(true);
}

function parseLayout(raw) {
  try { return JSON.parse(raw); } catch { return raw.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
}

function layoutElements(raw) {
  const root = parseLayout(raw);
  const out = [];
  const visit = (node) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    if (node.id || node.aid || node.name || node.bbox || node.text || node.resolvedTextStyle) out.push(node);
    for (const [key, value] of Object.entries(node)) if (key === "elements" || key === "children" || key === "items") visit(value);
  };
  visit(root);
  return out;
}

function isStructureName(name) {
  return typeof name === "string" && (name.startsWith("sequence-") || name.startsWith("balance-") || name.startsWith("benefit-") || name.startsWith("risk-"));
}

function structureTextStyle(name) {
  if (name.includes("order")) return { typeface: FONT, fontSize: 20, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("kicker")) return { typeface: FONT, fontSize: 16, bold: true, color: C.gray, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("title") || name.includes("heading")) return { typeface: FONT, fontSize: 20, bold: true, color: C.blue, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("topic")) return { typeface: FONT, fontSize: 22, bold: true, color: C.blue, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("verdict")) return { typeface: FONT, fontSize: 20, color: C.ink, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  return { typeface: FONT, fontSize: 20, color: C.ink, alignment: "left", verticalAlignment: "top", autoFit: "none" };
}

function visualAdaptation(name) {
  if (name === "sequence-direction-rail") return { fill: C.paleBlue, line: { style: "solid", fill: C.pale, width: 1 } };
  if (name === "sequence-direction-highlight") return { fill: C.line, line: { style: "solid", fill: "none", width: 0 } };
  if (name.startsWith("sequence-node-halo")) return { fill: C.pale, line: { style: "solid", fill: C.line, width: 1 } };
  if (name.startsWith("sequence-node-")) return { fill: C.blue, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none" };
  if (name.startsWith("sequence-connector")) return { fill: C.line, line: { style: "solid", fill: "none", width: 0 } };
  if (name.startsWith("sequence-body-underlay")) return { fill: C.pale, line: { style: "solid", fill: C.line, width: 1 }, shadow: "shadow-none" };
  if (name.startsWith("sequence-body-surface")) return { fill: C.paleBlue, line: { style: "solid", fill: C.line, width: 1 }, shadow: "shadow-none" };
  if (name.startsWith("sequence-body-accent")) return { fill: C.blue, line: { style: "solid", fill: "none", width: 0 } };
  if (name.startsWith("benefit-pan-shadow") || name.startsWith("risk-pan-shadow")) return { fill: "none", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none" };
  if (name === "benefit-pan") return { fill: C.paleBlue, line: { style: "solid", fill: C.blue, width: 2 } };
  if (name === "risk-pan") return { fill: C.pale, line: { style: "solid", fill: C.line, width: 2 } };
  if (name === "benefit-rim-highlight" || name === "risk-rim-highlight") return { fill: "none", line: { style: "solid", fill: C.white, width: 3 } };
  if (name === "balance-fulcrum") return { fill: C.pale, line: { style: "solid", fill: C.line, width: 2 } };
  if (name === "balance-fulcrum-facet") return { fill: C.line, line: { style: "solid", fill: "none", width: 0 } };
  if (name === "balance-beam") return { fill: C.blue, line: { style: "solid", fill: "none", width: 0 } };
  if (name === "balance-joint-ring") return { fill: C.white, line: { style: "solid", fill: C.line, width: 1 } };
  if (name === "balance-joint-core") return { fill: C.blue, line: { style: "solid", fill: "none", width: 0 } };
  if (name.includes("hanger")) return { fill: "none", line: { style: "solid", fill: C.line, width: 2 } };
  if (name.includes("separator")) return { fill: C.line, line: { style: "solid", fill: "none", width: 0 } };
  return null;
}

function safeProto(target) {
  if (typeof target?.toProto !== "function") return null;
  try { return target.toProto(); } catch (error) { return { readError: error.message }; }
}

function pathCommandCount(proto) {
  return (proto?.shape?.customPaths ?? []).reduce((total, pathItem) => total + (pathItem.commands?.length ?? 0), 0);
}

function visualState(element, target) {
  return {
    id: element.aid,
    name: element.name,
    bbox: element.bbox ?? null,
    geometry: element.geometry ?? null,
    fillColor: element.fillColor ?? null,
    lineColor: element.lineColor ?? null,
      lineWidth: element.lineWidth ?? null,
      text: element.text ?? null,
      resolvedTextStyle: element.resolvedTextStyle ?? null,
      proto: safeProto(target),
  };
}

async function adaptStructureSlide(deck, slide, pageId) {
  const beforeRaw = await (await slide.export({ format: "layout" })).text();
  await fs.writeFile(path.join(EVIDENCE, `${pageId}-before-adaptation.layout.json`), beforeRaw, "utf8");
  const before = layoutElements(beforeRaw);
  const adapted = [];
  for (const element of before) {
    if (!isStructureName(element.name) || !element.aid) continue;
    const target = deck.resolve(element.aid);
    const beforeState = visualState(element, target);
    const textChanged = element.text !== undefined || element.resolvedTextStyle;
    if (textChanged) target.text.style = structureTextStyle(element.name);
    const visual = visualAdaptation(element.name);
    const operationErrors = [];
    if (visual) {
      try { target.fill = visual.fill; } catch (error) { operationErrors.push(`fill: ${error.message}`); }
      try { target.line = visual.line; } catch (error) { operationErrors.push(`line: ${error.message}`); }
      if (visual.shadow) {
        try { target.shadow = visual.shadow; } catch (error) { operationErrors.push(`shadow: ${error.message}`); }
      }
    }
    adapted.push({ before: beforeState, requested: visual, operationErrors, target });
  }
  const afterRaw = await (await slide.export({ format: "layout" })).text();
  const after = layoutElements(afterRaw);
  const byName = new Map(after.filter((item) => item.name).map((item) => [item.name, item]));
  const invariants = adapted.map(({ before: b, requested, operationErrors, target }) => {
    const element = byName.get(b.name);
    const afterTarget = element?.aid ? deck.resolve(element.aid) : null;
    const afterState = element ? visualState(element, afterTarget) : null;
    return {
      id: b.id,
      name: b.name,
      idUnchanged: Boolean(element && element.aid === b.id),
      textUnchanged: Boolean(element && (element.text ?? null) === b.text),
      bboxUnchanged: Boolean(element && JSON.stringify(element.bbox ?? null) === JSON.stringify(b.bbox ?? null)),
      geometryUnchanged: Boolean(element && (element.geometry ?? null) === b.geometry),
      pathEvidenceAvailable: pathCommandCount(b.proto) > 0 || pathCommandCount(afterState?.proto) > 0,
      pathCommandCountBefore: pathCommandCount(b.proto),
      pathCommandCountAfter: pathCommandCount(afterState?.proto),
      requested,
      operationErrors,
      before: b,
      after: afterState,
    };
  });
  await fs.writeFile(path.join(EVIDENCE, `${pageId}-adaptation.json`), JSON.stringify({ pageId, adaptedCount: adapted.length, invariants }, null, 2), "utf8");
  return { beforeRaw, afterRaw, invariants };
}

function pageOne(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.white;
  addTitle(slide, 1, "中期质询把关键假设带到最终展示之前");
  addText(slide, "page-1-explanation-heading", "未决问题可保留", { left: 1017, top: 202, width: 208, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-1-explanation-body", "质询不等于否定。\n材料不足时，\n问题可以保留，\n不要求给出\n确定答案。", { left: 1017, top: 278, width: 208, height: 164 }, { fontSize: 20, color: C.ink });
  addRule(slide, "page-1-explanation-rule", 1000, 198, 0, C.line, 1, 248);
  setNotes(slide);
  return slide;
}

function pageTwo(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.white;
  addTitle(slide, 2, "试点可以开展，但教师必须保留最终判断；\n同伴反馈不进入自动评分，也不替代教师评价");
  setNotes(slide);
  return slide;
}

function pageThree(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.white;
  addTitle(slide, 3, "能否开展试点，要同时守住授权边界并控制复盘负担");
  addText(slide, "page-3-left-heading", "先确认材料能否被共享", { left: 55, top: 176, width: 500, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-left-body", "涉及合作单位限制或个人信息时，项目组先改用可公开的示例，或只描述可披露的前提。", { left: 55, top: 224, width: 500, height: 96 }, { fontSize: 20, color: C.ink });
  addText(slide, "page-3-left-subheading", "无法授权时先暂停", { left: 55, top: 352, width: 500, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-left-condition", "无法在授权范围内提出问题时，暂停该项质询，由教师协调后再决定是否继续。试点不能扩大原有授权，也不能要求学生披露受限材料。", { left: 55, top: 400, width: 500, height: 116 }, { fontSize: 20, color: C.ink });
  addRule(slide, "page-3-divider", 615, 176, 0, C.line, 1, 464);
  addText(slide, "page-3-right-heading", "试点范围与复盘条件", { left: 651, top: 176, width: 574, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-scope-body", "拟定范围：一门课程内，6 个自愿项目组，持续 2 周。这是范围设定，不代表已有提升率、完成率或评分结果。", { left: 651, top: 224, width: 574, height: 82 }, { fontSize: 20, color: C.ink });
  addText(slide, "page-3-review-heading", "结束后只讨论三件事", { left: 651, top: 336, width: 574, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-review-body", "问题是否指向具体前提；回应是否使用对应材料；组织负担是否可承受。", { left: 651, top: 384, width: 574, height: 78 }, { fontSize: 20, color: C.ink });
  addText(slide, "page-3-stop-heading", "何时收窄或停止", { left: 651, top: 504, width: 574, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-stop-body", "反馈停留在泛泛意见：先收窄问题要求。准备负担挤占必要项目工作：停止或缩小试点。", { left: 651, top: 552, width: 574, height: 88 }, { fontSize: 20, color: C.ink });
  setNotes(slide);
  return slide;
}

async function writeSlideOutputs(deck) {
  for (const [index, slide] of deck.slides.items.entries()) {
    const page = String(index + 1).padStart(2, "0");
    const png = await deck.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(OUT, `slide-${page}.png`), new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(OUT, `slide-${page}.layout.json`), await layout.text(), "utf8");
  }
}

async function writeFinalLayoutAudit(deck) {
  const slides = [];
  for (const [index, slide] of deck.slides.items.entries()) {
    const raw = await (await slide.export({ format: "layout" })).text();
    const elements = layoutElements(raw).map((element) => ({
      aid: element.aid ?? null,
      name: element.name ?? null,
      bbox: element.bbox ?? null,
      geometry: element.geometry ?? null,
      text: element.text ?? null,
      textPreview: element.textPreview ?? null,
      lineCount: element.textLayout?.lineCount ?? null,
      lines: element.textLayout?.lines?.map((line) => line.text) ?? [],
      resolvedFontSize: element.resolvedFontSize ?? null,
      resolvedTextStyle: element.resolvedTextStyle ?? null,
      fillColor: element.fillColor ?? null,
      lineColor: element.lineColor ?? null,
      lineWidth: element.lineWidth ?? null,
    }));
    slides.push({ slide: index + 1, elements });
  }
  await fs.writeFile(path.join(EVIDENCE, "final-layout-audit.json"), JSON.stringify({ slideSize: { width: W, height: H }, slides }, null, 2), "utf8");
}

async function main() {
  await fs.mkdir(EVIDENCE, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: W, height: H } });
  const slide1 = pageOne(deck);
  const slide2 = pageTwo(deck);
  const slide3 = pageThree(deck);
  const evidencePath = path.join(OUT, "structure-invocations.ndjson");
  await invokeStructure({
    root: ROOT,
    slide: slide1,
    skin: SKIN,
    assetId: "sequence-flow-001",
    parameters: {
      items: [
        { key: "submit", title: "提交判断", body: "提交主要判断；\n材料与未定前提" },
        { key: "question", title: "提出质询", body: "围绕一个前提；\n提出可核查问题" },
        { key: "respond", title: "回应确认", body: "据材料回应；\n教师确认待验证项" },
      ],
    },
    targetFrame: { left: 55, top: 166, width: 930, height: 382 },
    evidencePath,
    pageId: "page-01",
    regionId: "question-sequence",
    reason: "稿件明确给出三个相继发生的质询环节；结构表达方向、顺序和步骤归属，右侧文字保留不否定与不强求确定答案的解释边界。",
  });
  await invokeStructure({
    root: ROOT,
    slide: slide2,
    skin: SKIN,
    assetId: "comparison-pros-cons-balance-005",
    parameters: {
      topic: "中期同伴质询",
      pros: ["提前暴露隐含前提", "评价变成可回应问题", "留出修正论证机会"],
      cons: ["同伴可能遗漏关键问题", "占用课堂与准备时间", "意见可能被当成结论"],
      verdict: "先做一次范围受控试点",
      balanceState: "收益侧更重",
    },
    targetFrame: BODY,
    evidencePath,
    pageId: "page-02",
    regionId: "pilot-tradeoff",
    reason: "稿件围绕同一个是否开展小范围试点的决策，同时给出收益、代价和明确的范围受控建议；教师责任和评分边界由页标题完整承担。",
  });
  const adaptation = { pages: [await adaptStructureSlide(deck, slide1, "page-01"), await adaptStructureSlide(deck, slide2, "page-02")] };
  addFooter(slide1, 1);
  addFooter(slide2, 2);
  addFooter(slide3, 3);
  await writeSlideOutputs(deck);
  await writeFinalLayoutAudit(deck);
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(path.join(OUT, "deck.pptx"));
  const finalInspect = await deck.inspect({ kind: "slide,textbox,shape,notes", maxChars: 40000 });
  await fs.writeFile(path.join(EVIDENCE, "final-inspect.ndjson"), finalInspect.ndjson ?? String(finalInspect), "utf8");
  await fs.writeFile(path.join(EVIDENCE, "adaptation-summary.json"), JSON.stringify({ pages: adaptation.pages.map((page) => ({
    invariantCount: page.invariants.length,
    idUnchanged: page.invariants.every((item) => item.idUnchanged),
    textUnchanged: page.invariants.every((item) => item.textUnchanged),
    bboxUnchanged: page.invariants.every((item) => item.bboxUnchanged),
    geometryUnchanged: page.invariants.every((item) => item.geometryUnchanged),
    operationErrors: page.invariants.flatMap((item) => item.operationErrors),
    pathBearingObjectCount: page.invariants.filter((item) => item.pathEvidenceAvailable).length,
    pathCommandCountBefore: page.invariants.reduce((sum, item) => sum + item.pathCommandCountBefore, 0),
    pathCommandCountAfter: page.invariants.reduce((sum, item) => sum + item.pathCommandCountAfter, 0),
  })) }, null, 2), "utf8");
  await closeStructureRuntime();
}

main().catch(async (error) => {
  try { await closeStructureRuntime(); } catch { /* best effort cleanup */ }
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
