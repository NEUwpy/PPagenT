import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../../src/runtime/skins/northeastern-university.mjs";

const RUN = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(RUN, "deck.pptx");
const ROOT = path.resolve(RUN, "../../..");

const C = {
  blue: "#315F91",
  blueDark: "#244568",
  blueLight: "#DCE8F3",
  bluePale: "#EEF4F8",
  ink: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#C8D3DE",
  red: "#B65353",
  redLight: "#F4E1E1",
  amber: "#C98732",
  amberLight: "#F5EAD7",
  green: "#4F7963",
  greenLight: "#E2EEE6",
  white: "#FFFFFF",
};

const F = { display: "HYWenRunSongYun U", body: "Microsoft YaHei" };
const bodyFrame = { left: 55, top: 166, width: 1170, height: 492 };

function addText(slide, text, position, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.typeface ?? F.body,
    fontSize: opts.fontSize ?? 18,
    color: opts.color ?? C.body,
    bold: opts.bold ?? false,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: "none",
  };
  return shape;
}

function addRect(slide, position, opts = {}) {
  return slide.shapes.add({
    geometry: opts.geometry ?? "rect",
    name: opts.name,
    position,
    fill: opts.fill ?? C.white,
    line: { style: "solid", fill: opts.line ?? "none", width: opts.lineWidth ?? 0 },
    borderRadius: opts.radius,
  });
}

function addLine(slide, x1, y1, x2, y2, color = C.line, width = 1) {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  return slide.shapes.add({
    geometry: "line",
    position: { left, top, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addSectionLabel(slide, text, x, y, width = 250) {
  addText(slide, text, { left: x, top: y, width, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
}

function addMeta(slide, text, x, y, width = 700) {
  addText(slide, text, { left: x, top: y, width, height: 24 }, { fontSize: 14, color: C.muted });
}

function addPill(slide, text, position, fill, color = C.blueDark) {
  const p = addRect(slide, position, { fill, radius: 9 });
  p.text = text;
  p.text.style = { typeface: F.body, fontSize: 14, bold: true, color, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  return p;
}

function buildPage1(slide) {
  addSectionLabel(slide, "历史观察（1—4月）", 55, 174, 230);
  addMeta(slide, "口径一致：当月收到的请求中，观察结案后是否在两个工作日内首次给出可执行答复。", 55, 205, 720);
  addPill(slide, "模拟数据", { left: 1080, top: 174, width: 145, height: 28 }, C.blueLight);

  addRect(slide, { left: 55, top: 246, width: 765, height: 350 }, { fill: C.bluePale, line: C.line, lineWidth: 1 });
  addText(slide, "月度工作量与及时首次响应", { left: 79, top: 266, width: 370, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  addText(slide, "收到请求数", { left: 182, top: 308, width: 120, height: 24 }, { fontSize: 14, color: C.muted, align: "center" });
  addText(slide, "两日内首次答复", { left: 462, top: 308, width: 140, height: 24 }, { fontSize: 14, color: C.muted, align: "center" });
  const rows = [
    ["1月", 120, 96, "80%", "1.3"],
    ["2月", 150, 114, "76%", "1.5"],
    ["3月", 180, 126, "70%", "1.8"],
    ["4月", 240, 144, "60%", "2.4"],
  ];
  rows.forEach((r, i) => {
    const y = 342 + i * 52;
    addText(slide, r[0], { left: 79, top: y + 4, width: 52, height: 26 }, { fontSize: 18, bold: i === 3, color: C.ink });
    addRect(slide, { left: 142, top: y + 5, width: r[1] * 1.35, height: 22 }, { fill: i === 3 ? C.blueDark : C.blue, radius: 5 });
    addText(slide, String(r[1]), { left: 142 + r[1] * 1.35 + 8, top: y + 1, width: 60, height: 30 }, { fontSize: 17, bold: true, color: C.ink });
    addRect(slide, { left: 436, top: y + 5, width: r[2] * 1.35, height: 22 }, { fill: i === 3 ? C.red : C.amber, radius: 5 });
    addText(slide, r[3], { left: 446 + r[2] * 1.35, top: y + 1, width: 62, height: 30 }, { fontSize: 17, bold: true, color: i === 3 ? C.red : C.ink });
    addText(slide, r[4], { left: 700, top: y + 1, width: 80, height: 30 }, { fontSize: 17, color: C.body, align: "right" });
    if (i < rows.length - 1) addLine(slide, 79, y + 39, 780, y + 39, C.line, 1);
  });
  addText(slide, "中位时长·工作日", { left: 640, top: 308, width: 140, height: 24 }, { fontSize: 14, color: C.muted, align: "right" });

  addRect(slide, { left: 850, top: 246, width: 375, height: 350 }, { fill: C.white, line: C.line, lineWidth: 1 });
  addText(slide, "判断", { left: 878, top: 268, width: 80, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, "请求量从120增至240，\n及时首次响应比例从80%降至60%，\n中位时间从1.3增至2.4工作日。", { left: 878, top: 310, width: 315, height: 112 }, { fontSize: 20, color: C.ink });
  addLine(slide, 878, 438, 1195, 438, C.line, 1);
  addText(slide, "边界", { left: 878, top: 456, width: 80, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, "服务人员数四个月不变；\n无对照实验，不能断言工作量增长\n是响应变慢的唯一原因。", { left: 878, top: 496, width: 315, height: 76 }, { fontSize: 18, color: C.body });
  addMeta(slide, "注：该指标不是结案时长；每月无缺失记录。", 55, 620, 650);
}

function buildPage2(slide) {
  addSectionLabel(slide, "原因复核（4月）", 55, 174, 220);
  addMeta(slide, "对未达到两个工作日首次响应标准的96个请求复核；每个请求仅记一个主要阻塞原因。", 55, 205, 820);
  addPill(slide, "模拟数据", { left: 1080, top: 174, width: 145, height: 28 }, C.blueLight);

  addRect(slide, { left: 55, top: 252, width: 760, height: 306 }, { fill: C.bluePale, line: C.line, lineWidth: 1 });
  addText(slide, "96个未达标请求的主要阻塞原因", { left: 82, top: 272, width: 410, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  const causes = [
    ["材料不全", 42, C.blueDark],
    ["权限确认", 30, C.blue],
    ["需求反复", 16, C.amber],
    ["其他", 8, C.muted],
  ];
  let x = 82;
  causes.forEach(([label, n, color]) => {
    const w = n * 7.2;
    addRect(slide, { left: x, top: 345, width: w, height: 62 }, { fill: color });
    if (n >= 30) addText(slide, `${label}\n${n}（${Math.round(n / 96 * 100)}%）`, { left: x + 6, top: 356, width: w - 12, height: 45 }, { fontSize: 16, bold: true, color: C.white, align: "center", valign: "middle" });
    x += w;
  });
  addText(slide, "需求反复 16（17%） · 其他 8（8%）", { left: 82, top: 420, width: 430, height: 24 }, { fontSize: 16, color: C.body });
  addText(slide, "材料不全 + 权限确认 = 72个，占75%", { left: 82, top: 458, width: 570, height: 32 }, { fontSize: 24, bold: true, color: C.blueDark });
  addText(slide, "分类互斥且合计完整", { left: 82, top: 506, width: 250, height: 24 }, { fontSize: 14, color: C.muted });

  addRect(slide, { left: 850, top: 252, width: 375, height: 306 }, { fill: C.white, line: C.line, lineWidth: 1 });
  addText(slide, "这组数据支持什么", { left: 878, top: 272, width: 280, height: 30 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, "主要阻塞集中在材料与权限环节，\n因此统一入口具有明确的对应关系。", { left: 878, top: 316, width: 315, height: 66 }, { fontSize: 20, color: C.ink });
  addLine(slide, 878, 404, 1195, 404, C.line, 1);
  addText(slide, "不能直接推出什么", { left: 878, top: 422, width: 280, height: 30 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, "复核分类不等于各措施可消除的数量，\n也不能据此预测节省工时。", { left: 878, top: 466, width: 315, height: 66 }, { fontSize: 18, color: C.body });
  addMeta(slide, "定义：材料不全含字段缺失或未附样本；权限确认含授权人或范围未确认。", 55, 620, 860);
}

function buildPage3(slide) {
  addSectionLabel(slide, "方案比较", 55, 174, 160);
  addMeta(slide, "投入与周期均为内部方案估计；人日表示实施工作量，不能与响应改善直接换算。", 55, 205, 850);
  addPill(slide, "模拟估计", { left: 1080, top: 174, width: 145, height: 28 }, C.amberLight, C.amber);

  addText(slide, "比较项", { left: 55, top: 254, width: 180, height: 30 }, { fontSize: 21, bold: true, color: C.blueDark });
  const cols = [
    { x: 240, w: 292, title: "A 临时增加值班", fill: C.bluePale },
    { x: 548, w: 292, title: "B 统一申请入口", fill: C.greenLight },
    { x: 856, w: 369, title: "C 批量自动预检", fill: C.bluePale },
  ];
  cols.forEach((c, i) => {
    addRect(slide, { left: c.x, top: 246, width: c.w, height: 46 }, { fill: c.fill, line: C.line, lineWidth: 1 });
    addText(slide, c.title, { left: c.x + 12, top: 256, width: c.w - 24, height: 26 }, { fontSize: 21, bold: true, color: i === 1 ? C.green : C.blueDark, align: "center" });
  });
  const tableRows = [
    ["直接作用环节", "人工响应排队", "提交时字段与授权校验", "重复性材料格式检查"],
    ["初期投入", "8人日", "12人日", "30人日"],
    ["预计上线周期", "1周", "2周", "6周"],
    ["持续维护", "每周2人日值班", "每周0.5人日规则维护", "每周1人日规则维护"],
    ["当前依赖", "可调配值班人员", "三类请求字段达成一致", "稳定字段及可机器判断的规则"],
    ["主要限制", "不直接解决材料缺失", "不消除复杂需求沟通", "不替代人工授权判断"],
  ];
  tableRows.forEach((row, i) => {
    const y = 292 + i * 49;
    addRect(slide, { left: 55, top: y, width: 1170, height: 49 }, { fill: i % 2 ? C.white : "#F7F9FB", line: C.line, lineWidth: 1 });
    addText(slide, row[0], { left: 67, top: y + 11, width: 160, height: 28 }, { fontSize: 18, bold: true, color: C.body });
    addText(slide, row[1], { left: 252, top: y + 8, width: 268, height: 32 }, { fontSize: 18, color: C.body });
    addText(slide, row[2], { left: 560, top: y + 8, width: 268, height: 32 }, { fontSize: 18, color: C.green, bold: i === 0 });
    addText(slide, row[3], { left: 868, top: y + 8, width: 340, height: 32 }, { fontSize: 18, color: C.body });
  });
  addRect(slide, { left: 55, top: 594, width: 1170, height: 42 }, { fill: C.greenLight, line: C.green, lineWidth: 1 });
  addText(slide, "判断：先试行B，保留A作为短期高峰应急；C待入口规则稳定后再评估。", { left: 72, top: 603, width: 1120, height: 26 }, { fontSize: 21, bold: true, color: C.green });
}

function buildPage4(slide) {
  addSectionLabel(slide, "有限试点（六周）", 55, 174, 220);
  addMeta(slide, "先验证统一入口能否形成完整记录，再决定是否扩大到其他两类请求。", 55, 205, 800);
  addPill(slide, "模拟计划", { left: 1080, top: 174, width: 145, height: 28 }, C.blueLight);

  const phases = [
    { x: 55, w: 350, weeks: "第1—2周", title: "统一字段与授权责任", body: "负责人联合三类请求经办人\n形成字段字典、授权清单和统一入口。", gate: "进入条件：三类请求均完成一轮实际样本填写检查，且无关键必填字段缺失。", fill: C.bluePale },
    { x: 430, w: 350, weeks: "第3—4周", title: "只在数据提取请求试用", body: "保存缺失字段、退回原因和首次响应记录。\n不同时覆盖其他两类。", gate: "扩大条件：记录完整，且未发现会阻断提交的高频规则错误。否则回到字段和规则修订。", fill: C.greenLight },
    { x: 805, w: 420, weeks: "第5—6周", title: "复核试点数据后再决策", body: "负责人复核后，决定是否扩大到\n数据清洗和权限开通。", gate: "同时评估：两日内响应比例、材料退回比例、经办人维护时间。目标值由试点基线确定。", fill: C.amberLight },
  ];
  phases.forEach((p, i) => {
    addRect(slide, { left: p.x, top: 254, width: p.w, height: 290 }, { fill: p.fill, line: C.line, lineWidth: 1 });
    addText(slide, p.weeks, { left: p.x + 22, top: 274, width: p.w - 44, height: 28 }, { fontSize: 21, bold: true, color: i === 1 ? C.green : C.blueDark });
    addText(slide, p.title, { left: p.x + 22, top: 322, width: p.w - 44, height: 32 }, { fontSize: 21, bold: true, color: C.ink });
    addText(slide, p.body, { left: p.x + 22, top: 370, width: p.w - 44, height: 62 }, { fontSize: 18, color: C.body });
    addLine(slide, p.x + 22, 448, p.x + p.w - 22, 448, C.line, 1);
    addText(slide, p.gate, { left: p.x + 22, top: 466, width: p.w - 44, height: 60 }, { fontSize: 16, color: C.body });
  });
  addLine(slide, 405, 398, 430, 398, C.blueDark, 2);
  addLine(slide, 780, 398, 805, 398, C.blueDark, 2);
  addText(slide, "回到字段和规则修订", { left: 503, top: 566, width: 248, height: 25 }, { fontSize: 16, color: C.red, align: "center" });
  addLine(slide, 628, 544, 628, 590, C.red, 2);
  addLine(slide, 628, 590, 280, 590, C.red, 2);
  addLine(slide, 280, 590, 280, 544, C.red, 2);
  addMeta(slide, "边界：B尚未实施，不能宣称已有改善，也不能承诺消除所有材料与权限阻塞。", 55, 620, 1080);
}

async function main() {
  const pages = [
    { intent: { intentId: "fixed-rules-p1" }, decision: { selectedAssetId: "northeastern-university-body-001" }, meta: { sectionName: "历史观察" }, content: { pageId: "p1", title: "工作量翻倍，及时首次响应比例降至60%" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
    { intent: { intentId: "fixed-rules-p2" }, decision: { selectedAssetId: "northeastern-university-body-001" }, meta: { sectionName: "原因复核" }, content: { pageId: "p2", title: "4月超时请求中，材料与权限阻塞占75%" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
    { intent: { intentId: "fixed-rules-p3" }, decision: { selectedAssetId: "northeastern-university-body-001" }, meta: { sectionName: "方案比较" }, content: { pageId: "p3", title: "应对措施先选B，因其直接作用于主要阻塞环节" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
    { intent: { intentId: "fixed-rules-p4" }, decision: { selectedAssetId: "northeastern-university-body-001" }, meta: { sectionName: "有限试点" }, content: { pageId: "p4", title: "先用6周验证统一入口，再决定是否扩大范围" }, payload: { assetId: "northeastern-university-body-001", parameters: {} } },
  ];
  const starter = await createNortheasternUniversityStarter({
    pages,
    starterPptx: path.join(RUN, ".runtime", "template-starter.pptx"),
    manuscriptSource: "experiments/neu-mckinsey-fixed-rules-20260909/inputs/manuscript.txt",
  });
  buildPage1(starter.slides[0]);
  buildPage2(starter.slides[1]);
  buildPage3(starter.slides[2]);
  buildPage4(starter.slides[3]);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const pptx = await PresentationFile.exportPptx(starter.presentation);
  await pptx.save(OUT);
  const inspect = await starter.presentation.inspect({ kind: "slide,textbox,shape,notes", maxChars: 50000 });
  await fs.writeFile(path.join(RUN, "inspect-final.ndjson"), inspect.ndjson, "utf8");
  console.log(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
