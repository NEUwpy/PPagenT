import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../");
const OUT = HERE;
const COLORS = {
  white: "#FFFFFF",
  ink: "#252B33",
  gray: "#707780",
  blue: "#24578C",
  pale: "#E9F0F6",
  line: "#C6D1DB",
};
const BODY = { left: 55, top: 166, width: 1170, height: 492 };
const SKIN = {
  bodyFrame: BODY,
  componentTheme: {
    font: "Microsoft YaHei",
    background: COLORS.white,
    surface: COLORS.white,
    accent: COLORS.blue,
    accentAlt: COLORS.blue,
    accentSoft: COLORS.pale,
    dark: COLORS.ink,
    body: COLORS.ink,
    muted: COLORS.gray,
    line: COLORS.line,
    typography: {
      componentHeading: 16.5,
      componentTitle: 15,
      componentItemTitle: 15,
      componentLead: 15,
      componentBody: 15,
      componentLabel: 15,
      componentMeta: 12,
    },
  },
};

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

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
    typeface: "Microsoft YaHei",
    fontSize: 20,
    color: COLORS.ink,
    alignment: "left",
    verticalAlignment: "top",
    ...style,
  };
  return box;
}

function addRect(slide, name, position, fill, lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addFooter(slide, page) {
  addRect(slide, `footer-rule-${page}`, { left: 55, top: 665, width: 1170, height: 1 }, COLORS.line);
  addText(slide, `source-${page}`, "稿件：实验数据归档｜虚构大学试点讨论稿", { left: 55, top: 672, width: 700, height: 20 }, { fontSize: 16, color: COLORS.gray });
  addText(slide, `page-${page}`, `${String(page).padStart(2, "0")} / 02`, { left: 1145, top: 672, width: 80, height: 20 }, { fontSize: 16, color: COLORS.gray, alignment: "right" });
}

function collectShapeIds(slide) {
  return new Set((slide.shapes.items ?? []).map((shape) => shape.id));
}

function adaptStructure(slide, beforeIds, namesById) {
  const adapted = [];
  for (const shape of (slide.shapes.items ?? [])) {
    if (beforeIds.has(shape.id)) continue;
    const name = String(namesById.get(String(shape.id)) ?? shape.name ?? "");
    if (shape.text) {
      if (name.startsWith("sequence-order-")) {
        shape.text.fontSize = 20;
        shape.text.color = COLORS.white;
        shape.text.alignment = "center";
        shape.text.verticalAlignment = "middle";
        shape.text.style = { typeface: "Microsoft YaHei", fontSize: 20, color: COLORS.white, alignment: "center", verticalAlignment: "middle" };
      } else if (name.startsWith("sequence-title-")) {
        shape.text.fontSize = 20;
        shape.text.color = COLORS.ink;
        shape.text.alignment = "left";
        shape.text.verticalAlignment = "middle";
        shape.text.style = { typeface: "Microsoft YaHei", fontSize: 20, color: COLORS.ink, alignment: "left", verticalAlignment: "middle" };
      } else if (name.startsWith("sequence-body-")) {
        shape.text.fontSize = 20;
        shape.text.color = COLORS.ink;
        shape.text.alignment = "left";
        shape.text.verticalAlignment = "middle";
        shape.text.style = { typeface: "Microsoft YaHei", fontSize: 20, color: COLORS.ink, alignment: "left", verticalAlignment: "middle" };
      }
    }
    if (name === "sequence-direction-rail") shape.line = { style: "solid", fill: COLORS.line, width: 1 };
    if (name === "sequence-direction-highlight") shape.fill = COLORS.blue;
    if (name.startsWith("sequence-node-halo-")) {
      shape.fill = "none";
      shape.line = { style: "solid", fill: COLORS.line, width: 1 };
    }
    if (name.startsWith("sequence-node-") && !name.startsWith("sequence-node-halo-")) {
      shape.fill = COLORS.blue;
      shape.line = { style: "solid", fill: "none", width: 0 };
    }
    if (name.startsWith("sequence-connector-")) {
      shape.fill = COLORS.blue;
      shape.line = { style: "solid", fill: "none", width: 0 };
    }
    if (name.startsWith("sequence-body-underlay-")) {
      shape.fill = COLORS.white;
      shape.line = { style: "solid", fill: "none", width: 0 };
    }
    if (name.startsWith("sequence-body-surface-")) {
      shape.fill = COLORS.white;
      shape.line = { style: "solid", fill: COLORS.line, width: 1 };
    }
    if (name.startsWith("sequence-body-accent-")) {
      shape.fill = COLORS.blue;
      shape.line = { style: "solid", fill: "none", width: 0 };
    }
    try { shape.shadow = "shadow-none"; } catch { /* unsupported on this primitive */ }
    adapted.push(shape.id);
  }
  return adapted;
}

async function layoutText(slide) {
  return await (await slide.export({ format: "layout" })).text();
}

function structureElements(layoutTextValue) {
  const layout = JSON.parse(layoutTextValue);
  return layout.elements
    .filter((element) => String(element.name ?? "").startsWith("sequence-"))
    .map((element) => ({
      id: element.id,
      name: element.name,
      bbox: element.bbox,
      text: element.text ?? null,
      resolvedFontSize: element.resolvedFontSize ?? null,
      resolvedTextStyle: element.resolvedTextStyle ?? null,
      lineWidth: element.lineWidth ?? null,
    }));
}

function compareInvariants(before, after) {
  const issues = [];
  if (before.length !== after.length) issues.push(`object-count ${before.length} != ${after.length}`);
  for (let i = 0; i < Math.min(before.length, after.length); i += 1) {
    for (const field of ["id", "name", "text"]) {
      if (JSON.stringify(before[i][field]) !== JSON.stringify(after[i][field])) issues.push(`${field}-changed:${before[i].name}`);
    }
    if (JSON.stringify(before[i].bbox) !== JSON.stringify(after[i].bbox)) issues.push(`bbox-changed:${before[i].name}`);
  }
  return issues;
}

async function build() {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const structureLog = path.join(OUT, "structure-invocations.ndjson");

  const slide1 = presentation.slides.add();
  slide1.background.fill = COLORS.white;
  addText(slide1, "title-01", "一条记录能否被他人复核，取决于责任闭环", { left: 55, top: 36, width: 1170, height: 70 }, { fontSize: 32, bold: true });
  addRect(slide1, "title-rule-01", { left: 55, top: 126, width: 64, height: 4 }, COLORS.blue);

  const beforeIds1 = collectShapeIds(slide1);
  await invokeStructure({
    root: ROOT,
    slide: slide1,
    skin: SKIN,
    assetId: "sequence-flow-001",
    parameters: {
      items: [
        { key: "submit", title: "提交记录", body: "执行者提交结果记录及受控引用" },
        { key: "locate", title: "另一位成员复核", body: "另一位成员依据记录\n定位数据、脚本和条件" },
        { key: "supplement", title: "补充缺项", body: "执行者补充缺项并说明异常与排除" },
        { key: "confirm", title: "负责人确认", body: "确认后进入可讨论版本" },
      ],
    },
    targetFrame: { left: 55, top: 166, width: 1060, height: 382 },
    evidencePath: structureLog,
    pageId: "whole-page-02-run-02-page-01",
    regionId: "record-review-sequence",
    reason: "稿件明确给出提交、另一位成员定位、执行者补充、负责人确认的真实先后关系；授权触发的暂停与负责人处置作为图外条件保留。",
  });
  const structureBefore1 = await layoutText(slide1);
  const namesById1 = new Map(structureElements(structureBefore1).map((element) => [String(element.id), element.name]));
  const adaptedIds1 = adaptStructure(slide1, beforeIds1, namesById1);
  const structureAfter1 = await layoutText(slide1);

  addRect(slide1, "condition-rule-01", { left: 55, top: 580, width: 5, height: 62 }, COLORS.blue);
  addText(slide1, "condition-label-01", "授权触发", { left: 78, top: 580, width: 120, height: 28 }, { fontSize: 20, bold: true, color: COLORS.blue });
  addText(slide1, "condition-body-01", "若出现新的访问授权，先暂停共享；由负责人处理授权后再继续。", { left: 215, top: 580, width: 1010, height: 62 }, { fontSize: 20 });
  addFooter(slide1, 1);

  const slide2 = presentation.slides.add();
  slide2.background.fill = COLORS.white;
  addText(slide2, "title-02", "归档时先把可见范围和授权条件说清楚", { left: 55, top: 36, width: 1170, height: 70 }, { fontSize: 32, bold: true });
  addRect(slide2, "title-rule-02", { left: 55, top: 126, width: 64, height: 4 }, COLORS.blue);

  addText(slide2, "left-heading-02", "讨论材料怎么用", { left: 55, top: 180, width: 470, height: 30 }, { fontSize: 22, bold: true });
  addText(slide2, "left-body-02", "结果图和可公开的解释可以进入讨论材料。\n它们解释结果如何产生；访问授权另行处理。", { left: 55, top: 226, width: 470, height: 104 }, { fontSize: 20 });

  addRect(slide2, "middle-rule-02", { left: 590, top: 180, width: 1, height: 180 }, COLORS.line);
  addText(slide2, "middle-heading-02", "授权问题怎么处置", { left: 630, top: 180, width: 470, height: 30 }, { fontSize: 22, bold: true });
  addText(slide2, "middle-body-02", "受限原始数据留在原授权位置；\n记录只保留受控引用和访问条件。\n出现新的访问授权时，负责人先处理授权，\n再决定是否继续共享。", { left: 630, top: 226, width: 470, height: 130 }, { fontSize: 20 });

  addRect(slide2, "action-surface-02", { left: 55, top: 478, width: 1170, height: 164 }, COLORS.pale);
  addText(slide2, "action-label-02", "行动条件", { left: 78, top: 500, width: 120, height: 28 }, { fontSize: 20, bold: true, color: COLORS.blue });
  addText(slide2, "action-body-02", "如果权限边界无法说明，先缩小要求或停止试点；不要为了完成试点目标强行推广。", { left: 215, top: 500, width: 980, height: 70 }, { fontSize: 20 });
  addText(slide2, "action-note-02", "记录的作用是让责任边界可被复核。", { left: 78, top: 590, width: 1040, height: 28 }, { fontSize: 20, color: COLORS.gray });
  addFooter(slide2, 2);

  const beforeStructure = structureElements(structureBefore1);
  const afterStructure = structureElements(structureAfter1);
  const invariantIssues = compareInvariants(beforeStructure, afterStructure);
  await fs.writeFile(path.join(OUT, "style-adaptation.json"), JSON.stringify({
    page: "whole-page-02-run-02-page-01",
    assetId: "sequence-flow-001",
    targetFrame: { left: 55, top: 166, width: 1060, height: 382 },
    adaptedIds: adaptedIds1,
    before: beforeStructure,
    after: afterStructure,
    invariants: {
      objectCountEqual: beforeStructure.length === afterStructure.length,
      idsEqual: invariantIssues.filter((issue) => issue.startsWith("id-changed:")).length === 0,
      textEqual: invariantIssues.filter((issue) => issue.startsWith("text-changed:")).length === 0,
      bboxEqual: invariantIssues.filter((issue) => issue.startsWith("bbox-changed:")).length === 0,
      pathAndDirectionPreservedByAsset: true,
      issues: invariantIssues,
    },
    styleAdaptation: {
      nodeTitles: { fontSize: 20, typeface: "Microsoft YaHei", color: COLORS.ink, alignment: "left", verticalAlignment: "middle" },
      structureBodies: { fontSize: 20, typeface: "Microsoft YaHei", color: COLORS.ink, alignment: "left", verticalAlignment: "middle" },
      orderNumbers: { fontSize: 20, typeface: "Microsoft YaHei", color: COLORS.white, alignment: "center", verticalAlignment: "middle" },
      nonSemanticSurfaces: { bodySurfaceFill: COLORS.white, bodySurfaceLine: COLORS.line, underlayLine: "none", shadows: "shadow-none" },
    },
    note: "适配作用于本次 invoke 生成的原生对象；不修改核心资产，不改变节点文本、数量、几何、路径或左向右方向。",
  }, null, 2));

  const slideLayouts = [];
  for (const [index, slide] of presentation.slides.items.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const layout = await layoutText(slide);
    await writeBlob(path.join(OUT, `slide-${number}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(OUT, `slide-${number}.layout.json`), layout);
    slideLayouts.push({ slide: index + 1, file: `slide-${number}.layout.json`, layout: JSON.parse(layout) });
  }
  await fs.writeFile(path.join(OUT, "layout.json"), JSON.stringify({ slideSize: { width: 1280, height: 720 }, slides: slideLayouts }, null, 2));
  await writeBlob(path.join(OUT, "deck-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.join(OUT, "deck.pptx"));

  const afterStyleByName = Object.fromEntries(afterStructure.filter((item) => item.resolvedTextStyle).map((item) => [item.name, {
    fontSize: item.resolvedFontSize,
    typeface: item.resolvedTextStyle.typeface,
    color: item.resolvedTextStyle.color,
    alignment: item.resolvedTextStyle.alignment,
    verticalAlignment: item.resolvedTextStyle.verticalAlignment,
  }]));
  await fs.writeFile(path.join(OUT, "report.txt"), [
    "whole-page-02 / run-02（反馈修订）",
    "",
    "第 1 页",
    "- 标题直接服务复核流程：一条记录能否被他人复核，取决于责任闭环。",
    "- 调用 sequence-flow-001，四步为：提交记录 → 另一位成员复核 → 补充缺项 → 负责人确认。",
    "- 图外条件保留授权闭环：出现新的访问授权时先暂停共享，由负责人处理授权后再继续。",
    "- targetFrame=(55,166,1060,382)；结构契约四步 footprint=1060×382；图外说明 y=580，结构底部 y=548，通道=32。",
    "",
    "第 2 页",
    "- 仅组织同一授权问题：讨论材料的可用范围、受限原始数据的原授权位置、授权触发后的负责人处置，以及权限边界不清时的停止条件。",
    "- 删除重复授权结论与历史补档议题；竖向分隔线只覆盖上方两组说明（y=180–360），不穿过下方行动区。",
    "- 全页正文字号统一为 20；组标题为 22；标题为 32；页脚为 16；未使用 24。",
    "",
    "实际读回",
    `- 结构适配对象：${adaptedIds1.length} 个；适配前后对象数相同，ID、节点文本与 bbox 比较：${invariantIssues.length === 0 ? "PASS" : invariantIssues.join("；")}。`,
    `- 结构实际文本样式：${JSON.stringify(afterStyleByName)}`,
    "- 节点标题与结构正文：Microsoft YaHei、20、#252B33、左对齐；编号：Microsoft YaHei、20、#FFFFFF、居中反白。",
    "- 非语义承载面：白色填充、#C6D1DB 细线；下层承载面无描边；阴影去除。结构轨道/节点/连接方向和几何保持不变。",
    "- PNG、逐页 layout.json、汇总 layout.json、PPTX、调用日志与适配证据均已导出；slides_test 由外部命令复核。",
    "",
    "限制与未检查项",
    "- 保留 run-01 原样；未修改核心资产、正式 Skin、指南、Git 或其他目录。",
    "- 执行者未读取 PNG/截图；预览供父任务审阅。layout.json 的字号、对齐、颜色、文本与 bbox 已读回。",
    "- 调用 success 与几何不重叠只证明相应运行事实，不等同于整页风格通过；最终视觉判断仍由父任务完成。",
  ].join("\n"));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await closeStructureRuntime();
});
