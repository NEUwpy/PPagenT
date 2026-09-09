import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";
import {
  createNortheasternUniversityStarter,
} from "../../../src/runtime/skins/northeastern-university.mjs";
import { universityMckinseySkin } from "../../../src/runtime/skins/university-mckinsey.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const finalPptx = path.join(here, "deck.pptx");
const qaDir = path.join(here, ".runtime", "authoring-preview");
const primary = universityMckinseySkin.primaryColor;
const ink = universityMckinseySkin.dark;
const body = universityMckinseySkin.body;
const muted = universityMckinseySkin.muted;
const wash = "#EAF2F9";
const pale = "#F5F8FB";
const rule = "#C9D7E5";
const accent = "#5B86B2";
const white = "#FFFFFF";
const bodyFrame = universityMckinseySkin.bodyFrame;

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function box(slide, name, position, fill = white, lineFill = rule, lineWidth = 1) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function text(slide, name, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: style.typeface || universityMckinseySkin.fonts.body,
    fontSize: style.fontSize ?? 18,
    color: style.color || body,
    bold: style.bold ?? false,
    alignment: style.alignment || "left",
    verticalAlignment: style.verticalAlignment || "top",
    autoFit: style.autoFit || "shrinkText",
    lineSpacing: style.lineSpacing ?? 1.12,
  };
  return shape;
}

function ruleLine(slide, name, x, y, width, color = rule, thickness = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left: x, top: y, width, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width: thickness },
  });
}

function panelHeader(slide, name, frame, title, meta) {
  box(slide, `${name}-header`, { left: frame.left, top: frame.top, width: frame.width, height: 38 }, wash, wash, 0);
  text(slide, `${name}-title`, title, { left: frame.left + 14, top: frame.top + 5, width: frame.width - 220, height: 28 }, { fontSize: 19, color: primary, bold: true, verticalAlignment: "middle" });
  if (meta) text(slide, `${name}-meta`, meta, { left: frame.left + frame.width - 215, top: frame.top + 7, width: 200, height: 24 }, { fontSize: 14, color: muted, alignment: "right", verticalAlignment: "middle" });
}

function setCell(cell, value, { fill = white, color = body, bold = false, size = 16, align = "left" } = {}) {
  cell.value = value;
  cell.fill = fill;
  cell.text.style = {
    typeface: universityMckinseySkin.fonts.body,
    fontSize: size,
    color,
    bold,
    alignment: align,
    verticalAlignment: "middle",
    autoFit: "shrinkText",
    lineSpacing: 1.05,
  };
}

function addNotes(slide, extra) {
  const notes = slide.speakerNotes?.textFrame;
  if (notes) notes.setText(`${extra}\n\n[Sources]\n- 内容：experiments/neu-route-comparison-20260908/inputs/manuscript.txt（模拟稿件）\n- 视觉：assets/主题/东北大学-001/runtime-template.pptx（运行模板）\n- 组织参考：route-a/inputs/mckinsey-anatomy.md、consulting-components.html、consulting-layout-grammar.md\n[/Sources]`);
}

function buildSlide1(slide) {
  const left = { left: 55, top: 180, width: 745, height: 462 };
  const right = { left: 825, top: 180, width: 400, height: 462 };
  panelHeader(slide, "obs", left, "请求量上升，首次响应变慢", "模拟数据 · 1—4月");
  box(slide, "obs-exhibit", { left: left.left, top: left.top + 38, width: left.width, height: left.height - 38 }, white, rule, 1);
  text(slide, "obs-chart-label", "收到请求数（件）", { left: 80, top: 226, width: 240, height: 24 }, { fontSize: 16, color: muted, bold: true });
  slide.charts.add("bar", {
    position: { left: 85, top: 252, width: 685, height: 184 },
    categories: ["1月", "2月", "3月", "4月"],
    series: [{ name: "收到请求数", values: [120, 150, 180, 240], fill: primary }],
    hasLegend: false,
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 55 },
    xAxis: { textStyle: { fill: body, fontSize: 15 }, line: { style: "solid", fill: rule, width: 1 } },
    yAxis: { min: 0, max: 260, majorUnit: 50, textStyle: { fill: muted, fontSize: 13 }, majorGridlines: { style: "solid", fill: "#E5ECF2", width: 1 }, line: { style: "solid", fill: rule, width: 1 } },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: ink, fontSize: 15, bold: true } },
    chartFill: white,
    plotAreaFill: white,
    chartLine: { style: "solid", fill: "none", width: 0 },
    plotAreaLine: { style: "solid", fill: "none", width: 0 },
  });
  ruleLine(slide, "obs-divider", 80, 456, 690, rule, 1);
  text(slide, "obs-trend-label", "首次响应中位时间（工作日）", { left: 80, top: 468, width: 320, height: 22 }, { fontSize: 16, color: muted, bold: true });
  slide.charts.add("line", {
    position: { left: 90, top: 493, width: 675, height: 132 },
    categories: ["1月", "2月", "3月", "4月"],
    series: [{ name: "中位时间", values: [1.3, 1.5, 1.8, 2.4], line: { style: "solid", fill: accent, width: 3 }, marker: { symbol: "circle", size: 7 } }],
    hasLegend: false,
    xAxis: { textStyle: { fill: body, fontSize: 14 }, line: { style: "solid", fill: rule, width: 1 } },
    yAxis: { min: 1, max: 2.6, majorUnit: 0.4, numberFormatCode: "0.0", textStyle: { fill: muted, fontSize: 12 }, majorGridlines: { style: "solid", fill: "#E5ECF2", width: 1 }, line: { style: "solid", fill: rule, width: 1 } },
    dataLabels: { showValue: true, position: "above", textStyle: { fill: accent, fontSize: 14, bold: true } },
    chartFill: white,
    plotAreaFill: white,
    chartLine: { style: "solid", fill: "none", width: 0 },
    plotAreaLine: { style: "solid", fill: "none", width: 0 },
  });

  panelHeader(slide, "obs-side", right, "这组数据支持什么", "口径先固定");
  box(slide, "obs-side-body", { left: right.left, top: right.top + 38, width: right.width, height: right.height - 38 }, pale, rule, 1);
  text(slide, "obs-kpi", "60%", { left: 850, top: 245, width: 170, height: 72 }, { fontSize: 58, color: primary, bold: true, typeface: universityMckinseySkin.fonts.display, verticalAlignment: "middle" });
  text(slide, "obs-kpi-label", "4月两工作日内首次可执行答复比例\n144 / 240", { left: 850, top: 318, width: 330, height: 54 }, { fontSize: 18, color: ink, bold: true, lineSpacing: 1.05 });
  ruleLine(slide, "obs-side-rule", 850, 388, 345, rule, 1);
  text(slide, "obs-side-p1", "比例从1月的80%降至4月的60%；同时中位首次响应时间从1.3升至2.4个工作日。", { left: 850, top: 404, width: 340, height: 76 }, { fontSize: 18, color: body });
  text(slide, "obs-side-p2", "服务人员数量四个月保持不变，工作量与响应压力同步上升。", { left: 850, top: 493, width: 340, height: 48 }, { fontSize: 18, color: body });
  text(slide, "obs-side-limit", "解释边界\n无对照实验，不能断言工作量增长是响应变慢的唯一原因。", { left: 850, top: 556, width: 340, height: 66 }, { fontSize: 16, color: muted, bold: true });
  addNotes(slide, "页面判断：历史观察显示负荷与响应压力同步上升，但不构成唯一因果解释。图表沿用统一月份口径；首次响应不是结案时长。每月无缺失记录。");
}

function buildSlide2(slide) {
  const left = { left: 55, top: 180, width: 745, height: 462 };
  const right = { left: 825, top: 180, width: 400, height: 462 };
  panelHeader(slide, "block", left, "材料与权限是主要阻塞，但不是可消除量", "模拟数据 · 4月复核");
  box(slide, "block-exhibit", { left: left.left, top: left.top + 38, width: left.width, height: left.height - 38 }, white, rule, 1);
  text(slide, "block-label", "4月未达标的96个请求：每个请求仅记一个主要阻塞原因", { left: 80, top: 228, width: 650, height: 28 }, { fontSize: 17, color: muted, bold: true });
  slide.charts.add("bar", {
    position: { left: 105, top: 270, width: 655, height: 285 },
    categories: ["材料不全", "权限确认", "需求反复", "其他"],
    series: [{ name: "请求数", values: [42, 30, 16, 8], fill: primary }],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 55 },
    xAxis: { min: 0, max: 50, majorUnit: 10, textStyle: { fill: muted, fontSize: 13 }, majorGridlines: { style: "solid", fill: "#E5ECF2", width: 1 }, line: { style: "solid", fill: rule, width: 1 } },
    yAxis: { textStyle: { fill: body, fontSize: 16 }, line: { style: "solid", fill: rule, width: 1 } },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: ink, fontSize: 16, bold: true } },
    chartFill: white,
    plotAreaFill: white,
    chartLine: { style: "solid", fill: "none", width: 0 },
    plotAreaLine: { style: "solid", fill: "none", width: 0 },
  });
  text(slide, "block-foot", "材料不全与权限确认合计72个，占96个未达标请求的75%", { left: 90, top: 584, width: 650, height: 30 }, { fontSize: 18, color: primary, bold: true });

  panelHeader(slide, "block-side", right, "解释与边界", "分类≠预测");
  box(slide, "block-side-body", { left: right.left, top: right.top + 38, width: right.width, height: right.height - 38 }, pale, rule, 1);
  text(slide, "block-kpi", "72 / 96", { left: 850, top: 246, width: 280, height: 68 }, { fontSize: 48, color: primary, bold: true, typeface: universityMckinseySkin.fonts.display, verticalAlignment: "middle" });
  text(slide, "block-kpi-label", "材料与权限类阻塞的复核占比\n75%", { left: 850, top: 315, width: 330, height: 54 }, { fontSize: 18, color: ink, bold: true, lineSpacing: 1.05 });
  ruleLine(slide, "block-rule", 850, 385, 345, rule, 1);
  text(slide, "block-defs", "材料不全：字段缺失或未附样本文件\n权限确认：授权人或授权范围未确认", { left: 850, top: 402, width: 340, height: 72 }, { fontSize: 18, color: body });
  text(slide, "block-limit", "四类原因彼此互斥且合计完整；复核分类不等于各措施可以消除的数量，也不能直接预测节省工时。", { left: 850, top: 504, width: 340, height: 100 }, { fontSize: 17, color: muted, bold: true });
  addNotes(slide, "页面判断：材料与权限类阻塞占主要部分，为方案选择提供方向，但复核分类不能直接转换为干预效果或节省工时。数据来自4月未达标请求的互斥完整复核。");
}

function buildSlide3(slide) {
  const frame = { left: 55, top: 180, width: 1170, height: 462 };
  panelHeader(slide, "options", frame, "B先试行更贴近主要阻塞，A保留作高峰应急，C等待规则稳定", "模拟数据 · 内部方案估计");
  const table = slide.tables.add({
    rows: 7,
    columns: 4,
    left: 55,
    top: 218,
    width: 1170,
    height: 328,
    columnWidths: [220, 300, 300, 350],
    values: [
      ["比较项", "A 临时增加值班", "B 统一申请入口", "C 批量自动预检"],
      ["直接作用环节", "人工响应排队", "提交时字段与授权校验", "重复性材料格式检查"],
      ["初期投入", "8人日", "12人日", "30人日"],
      ["预计上线周期", "1周", "2周", "6周"],
      ["持续维护", "每周2人日值班", "每周0.5人日规则维护", "每周1人日规则维护"],
      ["当前依赖", "可调配值班人员", "三类请求字段达成一致", "稳定字段及可机器判断的规则"],
      ["主要限制", "不直接解决材料缺失", "不消除复杂需求沟通", "不替代人工授权判断"],
    ],
  });
  table.styleOptions = { headerRow: true, bandedRows: false };
  table.borders.assign({ style: "solid", fill: rule, width: 1 });
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const cell = table.getCell(r, c);
      const isHeader = r === 0;
      const isB = c === 2;
      setCell(cell, table.getCell(r, c).value, {
        fill: isHeader ? (isB ? primary : "#DCEAF5") : (isB ? "#F0F6FB" : (r % 2 ? white : pale)),
        color: isHeader ? (isB ? white : primary) : (c === 0 ? ink : body),
        bold: isHeader || c === 0,
        size: isHeader ? 16 : 15,
        align: c === 0 ? "left" : "center",
      });
    }
  }
  ruleLine(slide, "options-bottom-rule", 55, 564, 1170, rule, 1);
  text(slide, "options-foot", "建议条件：B尚未实施，不能宣称已有改善；投入、周期与维护均为内部方案估计，不能与响应改善直接换算。", { left: 65, top: 580, width: 1150, height: 45 }, { fontSize: 17, color: muted, bold: true });
  addNotes(slide, "页面判断：B的作用环节与主要阻塞更对应，适合作为先行试点；A可承担短期峰值，C需等字段与机器规则稳定。所有投入、周期和维护数据均为内部方案估计。");
}

function buildSlide4(slide) {
  const frame = { left: 55, top: 180, width: 1170, height: 462 };
  panelHeader(slide, "pilot", frame, "六周试点按依赖推进，先验证入口规则再决定扩大范围", "模拟数据 · 未来计划");
  const steps = [
    { x: 55, w: 350, title: "第1—2周 统一规则", body: "负责人联合三类经办人统一字段与授权责任；形成字段字典、授权清单和统一入口。\n\n进入条件：三类请求完成一轮实际样本填写检查，无关键必填字段缺失。" },
    { x: 465, w: 350, title: "第3—4周 先试数据提取", body: "仅在数据提取请求中试用；保存缺失字段、退回原因和首次响应记录。\n\n扩大条件：记录完整，且未发现阻断提交的高频规则错误；否则回到规则修订。" },
    { x: 875, w: 350, title: "第5—6周 复核后扩面", body: "负责人复核试点数据，再决定是否扩大到数据清洗和权限开通。\n\n评估：两工作日内响应比例、材料退回比例、经办人维护时间。目标值由试点基线确定。" },
  ];
  // Connectors first so they remain behind the stage boxes.
  for (let i = 0; i < steps.length - 1; i += 1) {
    slide.shapes.add({ geometry: "rightArrow", name: `pilot-arrow-${i + 1}`, position: { left: steps[i].x + steps[i].w + 14, top: 300, width: 44, height: 26 }, fill: accent, line: { style: "solid", fill: accent, width: 0 } });
  }
  for (const [i, step] of steps.entries()) {
    box(slide, `pilot-box-${i + 1}`, { left: step.x, top: 232, width: step.w, height: 254 }, i === 1 ? "#F0F6FB" : white, rule, 1);
    box(slide, `pilot-head-${i + 1}`, { left: step.x, top: 232, width: step.w, height: 50 }, i === 1 ? primary : wash, i === 1 ? primary : wash, 0);
    text(slide, `pilot-title-${i + 1}`, step.title, { left: step.x + 16, top: 244, width: step.w - 32, height: 28 }, { fontSize: 20, color: i === 1 ? white : primary, bold: true, verticalAlignment: "middle" });
    text(slide, `pilot-body-${i + 1}`, step.body, { left: step.x + 18, top: 302, width: step.w - 36, height: 168 }, { fontSize: 17, color: body, lineSpacing: 1.12 });
  }
  box(slide, "pilot-eval", { left: 55, top: 512, width: 1170, height: 108 }, pale, rule, 1);
  text(slide, "pilot-eval-label", "扩大前共同门槛", { left: 75, top: 528, width: 180, height: 26 }, { fontSize: 18, color: primary, bold: true });
  text(slide, "pilot-eval-body", "先确保样本可追踪、规则不阻断提交，再根据试点基线判断是否扩面；不把响应速度单独当作成功标准。", { left: 285, top: 526, width: 910, height: 60 }, { fontSize: 18, color: ink, bold: true });
  addNotes(slide, "页面判断：试点的核心是依赖顺序与门禁条件。先统一规则，再在单一请求类型中留痕验证，最后由负责人依据多项指标决定扩面；本稿不设未经论证的百分比目标。");
}

async function main() {
  const pages = [
    { payload: { assetId: "northeastern-university-body-001" }, intent: { intentId: "route-a-observation" }, decision: { selectedAssetId: "route-a-observation" }, content: { title: "请求量翻倍使首次响应同时变慢，但数据不支持唯一归因" }, meta: { sectionName: "历史观察" } },
    { payload: { assetId: "northeastern-university-body-001" }, intent: { intentId: "route-a-blockers" }, decision: { selectedAssetId: "route-a-blockers" }, content: { title: "材料与权限问题占4月未达标请求的75%，但不能直接等同于可消除量" }, meta: { sectionName: "原因复核" } },
    { payload: { assetId: "northeastern-university-body-001" }, intent: { intentId: "route-a-options" }, decision: { selectedAssetId: "route-a-options" }, content: { title: "B先试行更贴近主要阻塞环节，A仅作高峰应急；C留到规则稳定后" }, meta: { sectionName: "方案比较" } },
    { payload: { assetId: "northeastern-university-body-001" }, intent: { intentId: "route-a-pilot" }, decision: { selectedAssetId: "route-a-pilot" }, content: { title: "六周试点必须按依赖推进，先验证入口规则再决定扩大范围" }, meta: { sectionName: "试点计划" } },
  ];
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx: path.join(here, ".runtime", "template-starter.pptx"),
    pages,
    manuscriptSource: "experiments/neu-route-comparison-20260908/inputs/manuscript.txt（模拟稿件）",
  });
  buildSlide1(slides[0]);
  buildSlide2(slides[1]);
  buildSlide3(slides[2]);
  buildSlide4(slides[3]);

  await fs.mkdir(qaDir, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    await writeBlob(path.join(qaDir, `slide-${String(index + 1).padStart(2, "0")}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(qaDir, `slide-${String(index + 1).padStart(2, "0")}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(qaDir, "deck-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await fs.writeFile(path.join(here, "inspect.ndjson"), (await presentation.inspect({ kind: "slide,textbox,shape,table,chart,notes,layout", maxChars: 24000 })).ndjson);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
  console.log(`Wrote ${finalPptx}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
