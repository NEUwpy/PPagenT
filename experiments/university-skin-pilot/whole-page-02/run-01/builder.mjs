import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../");
const OUT = HERE;
const PPTX = path.join(OUT, "deck.pptx");
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

function adaptStructure(slide, beforeIds) {
  const adapted = [];
  for (const shape of (slide.shapes.items ?? [])) {
    if (!beforeIds.has(shape.id)) {
      if (shape.text?.style) {
        shape.text.style = { ...shape.text.style, typeface: "Microsoft YaHei" };
      }
      try { shape.shadow = "shadow-none"; } catch { /* unsupported on this primitive */ }
      adapted.push(shape.id);
    }
  }
  return adapted;
}

async function layoutText(slide) {
  return await (await slide.export({ format: "layout" })).text();
}

async function build() {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const structureLog = path.join(OUT, "structure-invocations.ndjson");

  const slide1 = presentation.slides.add();
  slide1.background.fill = COLORS.white;
  addText(slide1, "title-01", "先让一次结果可以被理解，再决定是否长期保存", { left: 55, top: 36, width: 1170, height: 70 }, { fontSize: 32, bold: true });
  addRect(slide1, "title-rule-01", { left: 55, top: 126, width: 64, height: 4 }, COLORS.blue);
  addText(slide1, "lead-01", "一条可复核的结果记录，按这个顺序进入可讨论版本", { left: 55, top: 136, width: 760, height: 30 }, { fontSize: 22, bold: true });

  const beforeIds1 = collectShapeIds(slide1);
  await invokeStructure({
    root: ROOT,
    slide: slide1,
    skin: SKIN,
    assetId: "sequence-flow-001",
    parameters: {
      items: [
        { key: "submit", title: "提交记录", body: "执行者提交结果记录及受控引用" },
        { key: "locate", title: "尝试定位", body: "定位数据、脚本\n和条件" },
        { key: "supplement", title: "补充缺项", body: "执行者补充缺项并说明异常与排除" },
        { key: "confirm", title: "负责人确认", body: "确认后进入可讨论版本" },
      ],
    },
    targetFrame: { left: 55, top: 166, width: 1060, height: 382 },
    evidencePath: structureLog,
    pageId: "whole-page-02-run-01-page-01",
    regionId: "record-review-sequence",
    reason: "稿件明确给出从提交、定位、补充到负责人确认的真实先后关系；授权暂停条件不作为额外步骤，而放在图外解释。",
  });
  const structureBefore1 = await layoutText(slide1);
  const adaptedIds1 = adaptStructure(slide1, beforeIds1);
  const structureAfter1 = await layoutText(slide1);

  addRect(slide1, "condition-rule-01", { left: 55, top: 580, width: 5, height: 62 }, COLORS.blue);
  addText(slide1, "condition-label-01", "边界条件", { left: 78, top: 580, width: 100, height: 28 }, { fontSize: 20, bold: true, color: COLORS.blue });
  addText(slide1, "condition-body-01", "若出现新的访问授权，先暂停共享；复核先判断能否理解来源，不代替科学结论审查。", { left: 190, top: 580, width: 1035, height: 62 }, { fontSize: 20 });
  addFooter(slide1, 1);

  const slide2 = presentation.slides.add();
  slide2.background.fill = COLORS.white;
  addText(slide2, "title-02", "记录完整，也不等于所有人都能看到全部文件", { left: 55, top: 36, width: 1170, height: 70 }, { fontSize: 32, bold: true });
  addRect(slide2, "title-rule-02", { left: 55, top: 126, width: 64, height: 4 }, COLORS.blue);

  addText(slide2, "principle-02", "归档保存的是“结果—依据—责任边界”的联系，不是一次共享扩权。", { left: 55, top: 166, width: 1170, height: 58 }, { fontSize: 24, bold: true, color: COLORS.blue });
  addRect(slide2, "principle-rule-02", { left: 55, top: 239, width: 1170, height: 1 }, COLORS.line);

  addText(slide2, "left-heading-02", "可以进入讨论材料", { left: 55, top: 270, width: 470, height: 30 }, { fontSize: 22, bold: true });
  addText(slide2, "left-body-02", "结果图，以及可公开的解释。\n它们帮助成员先理解结果是怎么产生的。", { left: 55, top: 316, width: 470, height: 92, fontSize: 20 });

  addRect(slide2, "middle-rule-02", { left: 590, top: 270, width: 1, height: 258 }, COLORS.line);
  addText(slide2, "middle-heading-02", "仍留在原授权位置", { left: 630, top: 270, width: 470, height: 30 }, { fontSize: 22, bold: true });
  addText(slide2, "middle-body-02", "受限原始数据不因归档而改变授权。\n记录只保留受控引用和访问条件。", { left: 630, top: 316, width: 470, height: 92 }, { fontSize: 20 });

  addRect(slide2, "key-rule-02", { left: 55, top: 456, width: 5, height: 72 }, COLORS.blue);
  addText(slide2, "key-label-02", "关键判断", { left: 78, top: 456, width: 120, height: 28 }, { fontSize: 20, bold: true, color: COLORS.blue });
  addText(slide2, "key-body-02", "记录表里出现一个路径，不代表其他成员已经取得访问权。", { left: 215, top: 456, width: 900, height: 48 }, { fontSize: 20, bold: true });

  addRect(slide2, "decision-surface-02", { left: 55, top: 560, width: 1170, height: 82 }, COLORS.pale);
  addText(slide2, "decision-label-02", "试点取舍", { left: 78, top: 576, width: 120, height: 28 }, { fontSize: 20, bold: true, color: COLORS.blue });
  addText(slide2, "decision-body-02", "先从新增实验试行，验证可理解性；历史结果按真正需要复核的项目逐项补充。", { left: 215, top: 576, width: 980, height: 52 }, { fontSize: 20 });
  addFooter(slide2, 2);

  await fs.writeFile(path.join(OUT, "style-adaptation.json"), JSON.stringify({
    page: "whole-page-02-run-01-page-01",
    assetId: "sequence-flow-001",
    targetFrame: { left: 55, top: 166, width: 1060, height: 382 },
    adaptedIds: adaptedIds1,
    preservedByProcedure: ["object IDs", "object count", "text fields", "positions", "direction", "path/source asset"],
    beforeLayout: JSON.parse(structureBefore1),
    afterLayout: JSON.parse(structureAfter1),
    adaptation: "仅为调用生成的原生对象补 Microsoft YaHei 与无阴影属性；未改核心资产、节点数量、文字、坐标、路径或方向。",
  }, null, 2));

  const slideLayouts = [];
  for (const [index, slide] of presentation.slides.items.entries()) {
    const number = String(index + 1).padStart(2, "0");
    await writeBlob(path.join(OUT, `slide-${number}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await layoutText(slide);
    await fs.writeFile(path.join(OUT, `slide-${number}.layout.json`), layout);
    slideLayouts.push({ slide: index + 1, file: `slide-${number}.layout.json`, layout: JSON.parse(layout) });
  }
  await fs.writeFile(path.join(OUT, "layout.json"), JSON.stringify({ slideSize: { width: 1280, height: 720 }, slides: slideLayouts }, null, 2));
  await writeBlob(path.join(OUT, "deck-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(PPTX);
  await fs.writeFile(path.join(OUT, "report.txt"), [
    "whole-page-02 / run-01",
    "",
    "沟通任务：让课题组教师与研究生理解，归档试点首先验证结果是否可被复核与解释，再讨论长期保存范围；不把拟定方案写成已证实成效。",
    "",
    "第 1 页｜信息分工",
    "- 标题：先理解一次结果，再决定长期保存。",
    "- 主体结构：调用 sequence-flow-001，承载稿件中真实的四步先后关系：提交记录 → 尝试定位 → 补充缺项 → 负责人确认。",
    "- 图外解释：新的访问授权触发暂停共享；复核只先判断来源是否可理解，不代替科学结论审查。",
    "- 空间预算：版心 1170×492；结构 targetFrame 1060×382（契约 4 步自然占用至少 1060×382）；结构底部 548，外部说明从 580 开始，通道 32；页脚位于 672–696。",
    "",
    "第 2 页｜信息分工",
    "- 标题：记录完整不等于访问开放。",
    "- 原生文字组织：左侧说明可公开讨论材料，中部说明受限原始数据与受控引用，底部判断明确“路径不等于访问权”，最后给出新增实验优先的有限试点取舍。",
    "- 空间预算：版心 1170×492；主体按 55/590/630 的对齐轴组织，两组主体说明共享顶部 270 起点；底部取舍区从 560 开始，页脚位于 672–696。",
    "",
    "实际检查",
    "- 结构调用日志已追加 attempt 与 success 事件；调用原因、页码、区域、targetFrame 和参数均留存。",
    "- 导出每页 PNG、每页 layout.json 与汇总 layout.json；结构图外说明与 targetFrame 按最终设计坐标保持不相交，通道为 32。",
    "- 结构样式适配前后证据保存于 style-adaptation.json；适配仅补字体与去阴影，未编辑核心资产或重画结构。",
    "- 已按结构契约保留四步、有序、左向右连续轨道；授权暂停没有被伪装成额外步骤。",
    "",
    "限制与未检查项",
    "- 本次只依据指定指南与 manuscript.md；未读取历史试做、其他设计手册、图片或既有 builder。",
    "- 执行者未读取 PNG/截图；视觉细节（实际观感、裁切美观度、字体渲染差异）留给父任务审阅。",
    "- layout.json 可核对文本、行、样式与 bbox；未将调用 success、样式传入或几何无重叠等同于整页风格通过。",
    "- 稿件中的四周、两名成员、周次安排及停止信号没有全部塞入本两页，避免把第二个完整议题嵌入页面；它们仍是试点讨论时需要保留的范围条件。",
  ].join("\n"));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await closeStructureRuntime();
});
