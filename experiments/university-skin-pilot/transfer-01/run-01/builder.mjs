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
  id: "university-transfer-01-v3-local",
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
  addText(
    slide,
    `footer-source-${page}`,
    "虚构教学方案讨论稿｜拟议安排，不代表已观察到教学成效",
    { left: 55, top: 672, width: 650, height: 20 },
    { fontSize: 16, color: C.gray, verticalAlignment: "middle" },
  );
  addText(
    slide,
    `footer-page-${page}`,
    `${String(page).padStart(2, "0")} / 03`,
    { left: 1135, top: 672, width: 90, height: 20 },
    { fontSize: 16, color: C.gray, alignment: "right", verticalAlignment: "middle" },
  );
}

function addTitle(slide, page, text) {
  addText(slide, `page-${page}-title`, text, { left: 55, top: 36, width: 1030, height: 74 }, {
    fontSize: 32,
    bold: true,
    color: C.ink,
    verticalAlignment: "middle",
  });
  addText(slide, `page-${page}-label`, "中期质询试点", { left: 1080, top: 48, width: 145, height: 24 }, {
    fontSize: 16,
    color: C.blue,
    alignment: "right",
    verticalAlignment: "middle",
  });
}

function setNotes(slide) {
  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- experiments/university-skin-pilot/transfer-01/manuscript.md（虚构稿件；本页内容均为拟议安排）",
  );
  slide.speakerNotes.setVisible(true);
}

function parseLayout(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
}

function layoutElements(raw) {
  const root = parseLayout(raw);
  const out = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.id || node.name || node.bbox || node.text || node.resolvedTextStyle) out.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "elements" || key === "children" || key === "items") visit(value);
    }
  };
  visit(root);
  return out;
}

function isStructureName(name) {
  return typeof name === "string" && (
    name.startsWith("sequence-") ||
    name.startsWith("balance-") ||
    name.startsWith("benefit-") ||
    name.startsWith("risk-")
  );
}

function structureTextStyle(name) {
  if (name.includes("order")) return { typeface: FONT, fontSize: 20, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("kicker")) return { typeface: FONT, fontSize: 16, bold: true, color: C.gray, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("title") || name.includes("heading")) return { typeface: FONT, fontSize: 20, bold: true, color: C.blue, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("topic")) return { typeface: FONT, fontSize: 22, bold: true, color: C.blue, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  if (name.includes("verdict")) return { typeface: FONT, fontSize: 20, color: C.ink, alignment: "left", verticalAlignment: "middle", autoFit: "none" };
  return { typeface: FONT, fontSize: 20, color: C.ink, alignment: "left", verticalAlignment: "top", autoFit: "none" };
}

async function adaptStructureSlide(deck, slide, pageId) {
  const beforeRaw = await (await slide.export({ format: "layout" })).text();
  await fs.writeFile(path.join(EVIDENCE, `${pageId}-before-adaptation.layout.json`), beforeRaw, "utf8");
  const before = layoutElements(beforeRaw);
  const changed = [];
  for (const element of before) {
    if (!isStructureName(element.name) || !element.aid) continue;
    const target = deck.resolve(element.aid);
    const beforeState = {
      id: element.aid,
      name: element.name,
      text: element.text ?? null,
      bbox: element.bbox ?? null,
      style: element.resolvedTextStyle ?? null,
      shadow: element.shadow ?? null,
    };
    if (element.text !== undefined || element.resolvedTextStyle) {
      target.text.style = structureTextStyle(element.name);
    }
    if (element.name.includes("node") || element.name.includes("pan-shadow")) {
      try { target.shadow = "shadow-none"; } catch { /* SVG path facades may not expose shadows. */ }
    }
    changed.push({ before: beforeState, target });
  }
  const afterRaw = await (await slide.export({ format: "layout" })).text();
  const after = layoutElements(afterRaw);
  const byName = new Map(after.filter((item) => item.name).map((item) => [item.name, item]));
  const invariants = changed.map(({ before: b }) => {
    const a = byName.get(b.name);
    return {
      id: b.id,
      name: b.name,
      idUnchanged: Boolean(a && a.aid === b.id),
      textUnchanged: Boolean(a && (a.text ?? null) === b.text),
      bboxUnchanged: Boolean(a && JSON.stringify(a.bbox ?? null) === JSON.stringify(b.bbox ?? null)),
      before: b,
      after: a ? { id: a.aid, name: a.name, text: a.text ?? null, bbox: a.bbox ?? null, style: a.resolvedTextStyle ?? null, shadow: a.shadow ?? null } : null,
    };
  });
  await fs.writeFile(path.join(EVIDENCE, `${pageId}-adaptation.json`), JSON.stringify({ pageId, changedCount: changed.length, invariants }, null, 2), "utf8");
  return { beforeRaw, afterRaw, invariants };
}

function pageOne(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.white;
  addTitle(slide, 1, "中期质询把关键假设带到最终展示之前");
  addText(slide, "page-1-explanation-heading", "图外解释", { left: 1017, top: 202, width: 208, height: 30 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-1-explanation-body", "质询收到不等于论证被否定。\n材料不足时，保留未解决问题，\n不强求项目组给出确定答案。", { left: 1017, top: 250, width: 208, height: 178 }, { fontSize: 20, color: C.ink });
  addRule(slide, "page-1-explanation-rule", 1000, 198, 0, C.line, 1, 248);
  setNotes(slide);
  return slide;
}

function pageTwo(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.white;
  addTitle(slide, 2, "试点值得一试，但只能以受控范围推进");
  addText(slide, "page-2-boundary-note", "边界条件：教师保留最终判断；同伴反馈不进入自动评分，也不替代教师评价。", { left: 55, top: 126, width: 1170, height: 28 }, { fontSize: 16, color: C.gray, verticalAlignment: "middle" });
  setNotes(slide);
  return slide;
}

function pageThree(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.white;
  addTitle(slide, 3, "授权边界决定哪些问题可以被提出");
  addText(slide, "page-3-left-heading", "先确认材料能否被共享", { left: 55, top: 176, width: 500, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-left-body", "涉及合作单位限制或个人信息时，项目组先改用可公开的示例，或只描述可披露的前提。", { left: 55, top: 224, width: 500, height: 96 }, { fontSize: 20, color: C.ink });
  addText(slide, "page-3-left-condition", "无法在授权范围内提出问题时，暂停该项质询，由教师协调后再决定是否继续。", { left: 55, top: 356, width: 500, height: 106 }, { fontSize: 20, color: C.ink });
  addText(slide, "page-3-right-heading", "试点范围与退出条件", { left: 651, top: 176, width: 574, height: 34 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-scope-number", "6", { left: 651, top: 226, width: 80, height: 58 }, { fontSize: 42, bold: true, color: C.blue, verticalAlignment: "middle" });
  addText(slide, "page-3-scope-label", "个自愿项目组", { left: 738, top: 242, width: 180, height: 32 }, { fontSize: 20, color: C.ink, verticalAlignment: "middle" });
  addText(slide, "page-3-duration-number", "2 周", { left: 960, top: 226, width: 110, height: 58 }, { fontSize: 32, bold: true, color: C.blue, verticalAlignment: "middle" });
  addText(slide, "page-3-duration-label", "一门课程内的拟定范围", { left: 1072, top: 242, width: 153, height: 54 }, { fontSize: 16, color: C.gray, verticalAlignment: "middle" });
  addRule(slide, "page-3-divider", 615, 184, 0, C.line, 1, 432);
  addText(slide, "page-3-check-heading", "结束后只讨论三件事", { left: 651, top: 338, width: 574, height: 32 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-check-body", "• 问题是否指向具体前提\n• 回应是否使用了对应材料\n• 组织负担是否可承受", { left: 651, top: 386, width: 574, height: 100 }, { fontSize: 20, color: C.ink });
  addText(slide, "page-3-stop-heading", "何时收窄或停止", { left: 651, top: 516, width: 574, height: 32 }, { fontSize: 22, bold: true, color: C.blue });
  addText(slide, "page-3-stop-body", "反馈持续停留在泛泛意见：先收窄问题要求。\n准备负担挤占必要项目工作：停止或缩小试点。", { left: 651, top: 564, width: 574, height: 80 }, { fontSize: 20, color: C.ink });
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
        { key: "submit", title: "提交判断", body: "提交主要判断、材料与未确定前提" },
        { key: "question", title: "提出质询", body: "围绕一个前提提出可核查问题" },
        { key: "respond", title: "回应确认", body: "据材料回应；教师确认待验证项" },
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
      topic: "中期同伴质询试点",
      pros: ["提前暴露隐含前提", "评价变成可回应问题", "留出修正论证机会"],
      cons: ["同伴可能遗漏关键问题", "占用课堂与准备时间", "意见可能被当成结论"],
      verdict: "可试点，但须范围受控且教师保留最终判断",
      balanceState: "收益侧更重",
    },
    targetFrame: BODY,
    evidencePath,
    pageId: "page-02",
    regionId: "pilot-tradeoff",
    reason: "稿件围绕同一个是否开展小范围试点的决策，同时给出收益、代价和明确的范围受控建议；天平倾向来自原稿，不由系统臆造。",
  });
  const adaptation = {
    pages: [await adaptStructureSlide(deck, slide1, "page-01"), await adaptStructureSlide(deck, slide2, "page-02")],
  };
  addFooter(slide1, 1);
  addFooter(slide2, 2);
  addFooter(slide3, 3);
  await writeSlideOutputs(deck);
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(path.join(OUT, "deck.pptx"));
  const finalInspect = await deck.inspect({ kind: "slide,textbox,shape,notes", maxChars: 30000 });
  await fs.writeFile(path.join(EVIDENCE, "final-inspect.ndjson"), finalInspect.ndjson ?? String(finalInspect), "utf8");
  await fs.writeFile(path.join(EVIDENCE, "adaptation-summary.json"), JSON.stringify({
    pages: adaptation.pages.map((page) => ({
      invariantCount: page.invariants.length,
      idUnchanged: page.invariants.every((item) => item.idUnchanged),
      textUnchanged: page.invariants.every((item) => item.textUnchanged),
      bboxUnchanged: page.invariants.every((item) => item.bboxUnchanged),
    })),
  }, null, 2), "utf8");
  await closeStructureRuntime();
}

main().catch(async (error) => {
  try { await closeStructureRuntime(); } catch { /* best effort cleanup */ }
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
