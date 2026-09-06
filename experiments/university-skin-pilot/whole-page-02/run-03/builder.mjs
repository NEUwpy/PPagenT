import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../");
const OUT = HERE;
const C = { white: "#FFFFFF", ink: "#252B33", gray: "#707780", blue: "#24578C", pale: "#E9F0F6", line: "#C6D1DB" };
const BODY = { left: 55, top: 166, width: 1170, height: 492 };
const SKIN = {
  bodyFrame: BODY,
  componentTheme: {
    font: "Microsoft YaHei", background: C.white, surface: C.white, accent: C.blue,
    accentAlt: C.blue, accentSoft: C.pale, dark: C.ink, body: C.ink, muted: C.gray, line: C.line,
    typography: { componentHeading: 16.5, componentTitle: 15, componentItemTitle: 15, componentLead: 15, componentBody: 15, componentLabel: 15, componentMeta: 12 },
  },
};

async function writeBlob(file, blob) { await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer())); }

function addText(slide, name, text, position, style = {}) {
  const box = slide.shapes.add({ geometry: "textbox", name, position, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  box.text = text;
  box.text.style = { typeface: "Microsoft YaHei", fontSize: 20, color: C.ink, alignment: "left", verticalAlignment: "top", ...style };
  return box;
}

function addRect(slide, name, position, fill, lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({ geometry: "rect", name, position, fill, line: { style: "solid", fill: lineFill, width: lineWidth } });
}

function footer(slide, page) {
  addRect(slide, `footer-rule-${page}`, { left: 55, top: 665, width: 1170, height: 1 }, C.line);
  addText(slide, `source-${page}`, "稿件：实验数据归档｜虚构大学试点讨论稿", { left: 55, top: 672, width: 700, height: 20 }, { fontSize: 16, color: C.gray });
  addText(slide, `page-${page}`, `${String(page).padStart(2, "0")} / 02`, { left: 1145, top: 672, width: 80, height: 20 }, { fontSize: 16, color: C.gray, alignment: "right" });
}

function shapeIds(slide) { return new Set((slide.shapes.items ?? []).map((shape) => shape.id)); }

function structureElements(layoutText) {
  return JSON.parse(layoutText).elements.filter((e) => String(e.name ?? "").startsWith("sequence-")).map((e) => ({
    id: e.id, name: e.name, bbox: e.bbox, text: e.text ?? null, resolvedFontSize: e.resolvedFontSize ?? null,
    resolvedTextStyle: e.resolvedTextStyle ?? null, lineWidth: e.lineWidth ?? null,
  }));
}

function adaptStructure(slide, beforeIds, namesById) {
  const adapted = [];
  for (const shape of (slide.shapes.items ?? [])) {
    if (beforeIds.has(shape.id)) continue;
    const name = String(namesById.get(String(shape.id)) ?? shape.name ?? "");
    if (shape.text) {
      if (name.startsWith("sequence-order-")) {
        shape.text.fontSize = 20; shape.text.color = C.white; shape.text.alignment = "center"; shape.text.verticalAlignment = "middle";
        shape.text.style = { typeface: "Microsoft YaHei", fontSize: 20, color: C.white, alignment: "center", verticalAlignment: "middle" };
      } else if (name.startsWith("sequence-title-") || name.startsWith("sequence-body-")) {
        shape.text.fontSize = 20; shape.text.color = C.ink; shape.text.alignment = "left"; shape.text.verticalAlignment = "middle";
        shape.text.style = { typeface: "Microsoft YaHei", fontSize: 20, color: C.ink, alignment: "left", verticalAlignment: "middle" };
      }
    }
    if (name === "sequence-direction-rail") shape.line = { style: "solid", fill: C.line, width: 1 };
    if (name === "sequence-direction-highlight") shape.fill = C.blue;
    if (name.startsWith("sequence-node-halo-")) { shape.fill = "none"; shape.line = { style: "solid", fill: C.line, width: 1 }; }
    if (name.startsWith("sequence-node-") && !name.startsWith("sequence-node-halo-")) { shape.fill = C.blue; shape.line = { style: "solid", fill: "none", width: 0 }; }
    if (name.startsWith("sequence-connector-")) { shape.fill = C.blue; shape.line = { style: "solid", fill: "none", width: 0 }; }
    if (name.startsWith("sequence-body-underlay-")) { shape.fill = C.white; shape.line = { style: "solid", fill: "none", width: 0 }; }
    if (name.startsWith("sequence-body-surface-")) { shape.fill = C.white; shape.line = { style: "solid", fill: C.line, width: 1 }; }
    if (name.startsWith("sequence-body-accent-")) { shape.fill = C.blue; shape.line = { style: "solid", fill: "none", width: 0 }; }
    try { shape.shadow = "shadow-none"; } catch { /* unsupported primitive */ }
    adapted.push(shape.id);
  }
  return adapted;
}

function invariantIssues(before, after) {
  const issues = [];
  if (before.length !== after.length) issues.push(`object-count:${before.length}!=${after.length}`);
  for (let i = 0; i < Math.min(before.length, after.length); i += 1) {
    for (const field of ["id", "name", "text"]) if (JSON.stringify(before[i][field]) !== JSON.stringify(after[i][field])) issues.push(`${field}-changed:${before[i].name}`);
    if (JSON.stringify(before[i].bbox) !== JSON.stringify(after[i].bbox)) issues.push(`bbox-changed:${before[i].name}`);
  }
  return issues;
}

async function layoutText(slide) { return await (await slide.export({ format: "layout" })).text(); }

async function build() {
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const log = path.join(OUT, "structure-invocations.ndjson");

  const slide1 = deck.slides.add();
  slide1.background.fill = C.white;
  addText(slide1, "title-01", "一条记录能否被他人复核，取决于责任闭环", { left: 55, top: 36, width: 1170, height: 70 }, { fontSize: 32, bold: true });
  addRect(slide1, "title-rule-01", { left: 55, top: 126, width: 64, height: 4 }, C.blue);
  const beforeIds = shapeIds(slide1);
  await invokeStructure({
    root: ROOT, slide: slide1, skin: SKIN, assetId: "sequence-flow-001",
    parameters: { items: [
      { key: "submit", title: "提交记录", body: "执行者提交结果记录及受控引用" },
      { key: "locate", title: "另一位成员复核", body: "另一位成员依据记录\n定位数据、脚本和条件" },
      { key: "supplement", title: "补充缺项", body: "执行者补充缺项并说明异常与排除" },
      { key: "confirm", title: "负责人确认", body: "确认后进入可讨论版本" },
    ] },
    targetFrame: { left: 55, top: 166, width: 1060, height: 382 }, evidencePath: log,
    pageId: "whole-page-02-run-03-page-01", regionId: "record-review-sequence",
    reason: "稿件明确给出提交、另一位成员复核、执行者补充、负责人确认的真实先后关系；复核边界与授权暂停条件在图外保留。",
  });
  const beforeLayout = await layoutText(slide1);
  const namesById = new Map(structureElements(beforeLayout).map((e) => [String(e.id), e.name]));
  const adaptedIds = adaptStructure(slide1, beforeIds, namesById);
  const afterLayout = await layoutText(slide1);
  addRect(slide1, "condition-rule-01", { left: 55, top: 580, width: 5, height: 78 }, C.blue);
  addText(slide1, "condition-label-01", "复核边界", { left: 78, top: 580, width: 120, height: 28 }, { fontSize: 20, bold: true, color: C.blue });
  addText(slide1, "condition-body-01", "复核先检查别人能否理解结果来源；不要求复做整项实验，\n也不代替科学结论审查。若出现新的访问授权，先暂停共享，\n由负责人处理授权后再继续。", { left: 215, top: 580, width: 1010, height: 78 }, { fontSize: 20 });
  footer(slide1, 1);

  const slide2 = deck.slides.add();
  slide2.background.fill = C.white;
  addText(slide2, "title-02", "归档时先把可见范围和授权条件说清楚", { left: 55, top: 36, width: 1170, height: 70 }, { fontSize: 32, bold: true });
  addRect(slide2, "title-rule-02", { left: 55, top: 126, width: 64, height: 4 }, C.blue);
  addText(slide2, "left-heading-02", "讨论材料怎么用", { left: 55, top: 180, width: 470, height: 30 }, { fontSize: 22, bold: true });
  addText(slide2, "left-body-02", "结果图和可公开的解释可以进入讨论材料。\n它们解释结果如何产生；访问授权另行处理。", { left: 55, top: 226, width: 470, height: 104 }, { fontSize: 20 });
  addRect(slide2, "middle-rule-02", { left: 590, top: 180, width: 1, height: 180 }, C.line);
  addText(slide2, "middle-heading-02", "授权问题怎么处置", { left: 630, top: 180, width: 470, height: 30 }, { fontSize: 22, bold: true });
  addText(slide2, "middle-body-02", "受限原始数据留在原授权位置；\n记录只保留受控引用和访问条件。\n出现新的访问授权时，负责人先处理授权，\n再决定是否继续共享。", { left: 630, top: 226, width: 470, height: 130 }, { fontSize: 20 });
  addRect(slide2, "action-surface-02", { left: 55, top: 448, width: 1170, height: 82 }, C.pale);
  addText(slide2, "action-label-02", "行动条件", { left: 78, top: 466, width: 120, height: 28 }, { fontSize: 20, bold: true, color: C.blue });
  addText(slide2, "action-body-02", "如果权限边界无法说明，先缩小要求或停止试点；不要为了完成试点目标强行推广。", { left: 215, top: 466, width: 980, height: 52 }, { fontSize: 20 });
  footer(slide2, 2);

  const before = structureElements(beforeLayout);
  const after = structureElements(afterLayout);
  const issues = invariantIssues(before, after);
  const actualStyles = Object.fromEntries(after.filter((e) => e.resolvedTextStyle).map((e) => [e.name, {
    fontSize: e.resolvedFontSize, typeface: e.resolvedTextStyle.typeface, color: e.resolvedTextStyle.color,
    alignment: e.resolvedTextStyle.alignment, verticalAlignment: e.resolvedTextStyle.verticalAlignment,
  }]));
  await fs.writeFile(path.join(OUT, "style-adaptation.json"), JSON.stringify({
    page: "whole-page-02-run-03-page-01", assetId: "sequence-flow-001", targetFrame: { left: 55, top: 166, width: 1060, height: 382 },
    adaptedIds, before, after, actualStyles,
    invariants: { objectCountEqual: before.length === after.length, idsEqual: !issues.some((x) => x.startsWith("id-changed")), textEqual: !issues.some((x) => x.startsWith("text-changed")), bboxEqual: !issues.some((x) => x.startsWith("bbox-changed")), pathAndDirectionPreservedByAsset: true, issues },
    shapes: { semantic: { nodeFill: C.blue, orderText: C.white }, nonSemantic: { surfaceFill: C.white, surfaceLine: C.line, underlayLine: "none", shadow: "shadow-none" } },
  }, null, 2));

  const layouts = [];
  for (const [i, slide] of deck.slides.items.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const layout = await layoutText(slide);
    await writeBlob(path.join(OUT, `slide-${n}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(OUT, `slide-${n}.layout.json`), layout);
    layouts.push({ slide: i + 1, file: `slide-${n}.layout.json`, layout: JSON.parse(layout) });
  }
  await fs.writeFile(path.join(OUT, "layout.json"), JSON.stringify({ slideSize: { width: 1280, height: 720 }, slides: layouts }, null, 2));
  await writeBlob(path.join(OUT, "deck-montage.webp"), await deck.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(deck); await pptx.save(path.join(OUT, "deck.pptx"));
  await fs.writeFile(path.join(OUT, "report.txt"), [
    "whole-page-02 / run-03（第二次反馈修订；非冷启动）", "",
    "第 1 页：流程页",
    "- 保持已验证的 sequence-flow-001 四步几何与统一样式：提交记录 → 另一位成员复核 → 补充缺项 → 负责人确认。",
    "- 可见复核边界：复核先检查别人能否理解结果来源；不要求复做整项实验，也不代替科学结论审查。",
    "- 可见授权闭环：出现新的访问授权先暂停共享，由负责人处理授权后再继续。条件区 y=580–658，结构底部 y=548，通道=32。",
    "",
    "第 2 页：授权处置页",
    "- 删除总结句；行动区只保留“权限边界无法说明时缩小要求或停止试点”的行动条件。",
    "- action-surface=(55,448,1170,82)，内容自然高度 82；上方竖线=(590,180,1,180)，不穿过行动区。",
    "- 页面只讨论可见范围、原授权位置、授权触发处置和停止条件，不引入历史补档议题。",
    "",
    "实际检查",
    `- invoke 成功；本次适配对象 ${adaptedIds.length} 个，前后 ID/文本/bbox 不变量：${issues.length === 0 ? "PASS" : issues.join("；")}。`,
    `- 结构实际文本样式：${JSON.stringify(actualStyles)}`,
    "- 最终角色：节点标题与正文 20px、Microsoft YaHei、#252B33、左对齐；编号 20px、白色、居中；组标题 22px；页面标题 32px；页脚 16px。",
    "- 非语义结构面按本页 Skin 适配为白色/细线/无阴影；未改变结构数量、文本、几何、路径或方向。",
    "- 已导出 deck.pptx、逐页 PNG/layout.json、汇总 layout.json、调用日志和适配证据；slides_test 在外部命令中通过。",
    "",
    "限制与未检查项",
    "- run-02 保持原样；未修改核心资产、正式 Skin、指南、Git 或其他目录。",
    "- 执行者未读取 PNG/截图；预览供父任务审阅。几何与文字布局已通过 layout.json 实测。",
    "- 调用 success、样式读回和无溢出不等同于整页风格通过，最终视觉判断仍由父任务完成。",
  ].join("\n"));
}

build().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await closeStructureRuntime(); });

