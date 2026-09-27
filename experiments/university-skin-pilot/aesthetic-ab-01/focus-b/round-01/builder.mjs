import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/focus-b/round-01";
const FONT = "Microsoft YaHei";
const C = {
  blue: "#315F91",
  ink: "#252B33",
  muted: "#707780",
  bg: "#FFFFFF",
  pale: "#F3F6F9",
  paleBlue: "#E8F0F7",
  line: "#CBD3DB",
  white: "#FFFFFF",
};

const roles = [];
const lines = [];
const connections = [];
const textBySlide = [];

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function rect(slide, name, left, top, width, height, fill, lineFill = "none", lineWidth = 0, radius = 0) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addText(slide, slideNo, name, text, role, left, top, width, height, opts = {}) {
  const s = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  const sizes = { claim: 30, group: 21, body: 18, note: 16, footer: 12, metric: 36 };
  const bold = role === "claim" || role === "group" || role === "metric" || opts.bold === true;
  const color = opts.color || (role === "note" || role === "footer" ? C.muted : C.ink);
  s.text = text;
  s.text.style = {
    typeface: FONT,
    fontSize: sizes[role],
    bold,
    color,
    alignment: opts.alignment || "left",
    verticalAlignment: opts.verticalAlignment || "top",
    lineSpacing: opts.lineSpacing || 1.25,
    insets: opts.insets || { top: 0, right: 0, bottom: 0, left: 0 },
    autoFit: "none",
    wrap: "square",
  };
  roles.push({ slide: slideNo, shape: s.id, name, role, fontSize: sizes[role], bold, text });
  if (!textBySlide[slideNo - 1]) textBySlide[slideNo - 1] = [];
  textBySlide[slideNo - 1].push({ name, text, role, shape: s.id });
  return s;
}

function addLine(slide, slideNo, name, x1, y1, x2, y2, color = C.line, width = 1, purpose = "divider") {
  const s = slide.shapes.add({
    geometry: "line",
    name,
    position: { left: x1, top: y1, width: x2 - x1, height: y2 - y1 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
  lines.push({ slide: slideNo, shape: s.id, name, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, relation: purpose, separator: purpose === "divider" });
  return s;
}

function addConnector(slide, slideNo, name, source, target, evidence) {
  const c = slide.shapes.connect(source, target, {
    kind: "straight",
    fromSide: "right",
    toSide: "left",
    line: { style: "solid", fill: C.blue, width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });
  connections.push({ slide: slideNo, connector: c.id, name, source: source.id, target: target.id, arrowAt: "target", implementation: "tail", evidence });
  return c;
}

function header(slide, no, title, kicker) {
  addText(slide, no, `s${no}-kicker`, kicker, "note", 55, 28, 350, 24, { color: C.blue, bold: true });
  addText(slide, no, `s${no}-title`, title, "claim", 55, 55, 1130, 46);
  addLine(slide, no, `s${no}-header-divider`, 55, 116, 1225, 116, C.line, 1, "divider");
}

function footer(slide, no) {
  addText(slide, no, `s${no}-footer-left`, "大学课题组试点提案 · 内容分析页", "footer", 55, 688, 360, 18);
  addText(slide, no, `s${no}-footer-right`, `${String(no).padStart(2, "0")} / 04 · 拟定范围`, "footer", 1080, 688, 145, 18, { alignment: "right" });
}

function buildSlide1(presentation) {
  const n = 1;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, n, "一次结果应由一组依据共同解释", "01 记录单元");

  rect(slide, "s1-analysis-surface", 55, 148, 790, 480, C.pale);
  addText(slide, n, "s1-analysis-heading", "五类记录共同解释同一个结果", "group", 78, 166, 480, 30, { color: C.blue });
  addText(slide, n, "s1-analysis-caption", "并列依据，不是五个先后步骤", "note", 570, 170, 240, 24, { alignment: "right" });
  const rows = [
    ["原始数据位置", "让结果可回到来源；原始数据保持原貌。"],
    ["样本与采集条件", "说明样本处在什么采集条件下，便于理解结果上下文。"],
    ["处理脚本版本", "定位实际运行代码；清洗处理另存。"],
    ["结果文件", "保留讨论所依据的图表或结果文件。"],
    ["异常及排除说明", "未纳入结果的样本也保留排除依据。"],
  ];
  rows.forEach((row, i) => {
    const y = 216 + i * 72;
    if (i > 0) addLine(slide, n, `s1-row-line-${i}`, 78, y - 12, 820, y - 12, C.line, 1, "table-row-separator");
    addText(slide, n, `s1-row-label-${i}`, row[0], "group", 78, y, 188, 28, { color: C.blue });
    addText(slide, n, `s1-row-body-${i}`, row[1], "body", 282, y, 520, 52);
  });

  rect(slide, "s1-boundary-surface", 875, 148, 350, 480, C.paleBlue);
  addText(slide, n, "s1-boundary-heading", "完整记录的边界", "group", 900, 170, 280, 30, { color: C.blue });
  addText(slide, n, "s1-boundary-body", "记录完整，不等于全部文件开放。", "body", 900, 215, 280, 48, { bold: true });
  addText(slide, n, "s1-boundary-details", "讨论材料含结果图与可公开解释。\n\n受限数据保留原授权位置。\n\n记录只含受控引用与访问条件；路径不代表访问权。", "body", 900, 292, 280, 195);
  addLine(slide, n, "s1-boundary-rule", 900, 510, 1180, 510, C.blue, 2, "boundary-divider");
  addText(slide, n, "s1-boundary-takeaway", "记录解释链，访问权另行受控。", "group", 900, 532, 300, 58, { color: C.blue });
  footer(slide, n);
  return slide;
}

function buildSlide2(presentation) {
  const n = 2;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, n, "新增记录优先，历史结果按需补回", "02 范围取舍");

  rect(slide, "s2-comparison-surface", 55, 148, 820, 480, C.pale);
  addText(slide, n, "s2-table-heading", "两种范围选择，代价落在不同位置", "group", 78, 166, 620, 30, { color: C.blue });
  addText(slide, n, "s2-col-option", "选择", "note", 78, 214, 160, 22, { color: C.muted, bold: true });
  addText(slide, n, "s2-col-gain", "能得到什么", "note", 260, 214, 240, 22, { color: C.muted, bold: true });
  addText(slide, n, "s2-col-cost", "需要付出什么", "note", 525, 214, 305, 22, { color: C.muted, bold: true });
  addLine(slide, n, "s2-header-rule", 78, 242, 830, 242, C.line, 1, "table-header-separator");

  rect(slide, "s2-row-history", 78, 260, 752, 130, C.bg);
  addText(slide, n, "s2-history-label", "集中补历史", "group", 96, 282, 150, 30, { color: C.blue });
  addText(slide, n, "s2-history-gain", "可一次形成较大目录。", "body", 260, 282, 235, 72);
  addText(slide, n, "s2-history-cost", "追查遗失上下文耗时；也可能把不确定记忆写成确定说明。", "body", 525, 282, 285, 84);
  addLine(slide, n, "s2-row-rule", 78, 410, 830, 410, C.line, 1, "table-row-separator");
  rect(slide, "s2-row-new", 78, 428, 752, 144, C.paleBlue);
  addText(slide, n, "s2-new-label", "先记新增", "group", 96, 452, 150, 30, { color: C.blue });
  addText(slide, n, "s2-new-gain", "新增实验在上下文清楚时即可记录。", "body", 260, 452, 235, 72);
  addText(slide, n, "s2-new-cost", "短期无法解决全部历史材料追溯。", "body", 525, 452, 285, 72);
  addText(slide, n, "s2-recommend-mark", "提案建议", "note", 96, 540, 150, 22, { color: C.blue, bold: true });

  rect(slide, "s2-note-surface", 905, 148, 320, 480, C.paleBlue);
  addText(slide, n, "s2-note-heading", "建议的动作顺序", "group", 930, 170, 260, 30, { color: C.blue });
  addText(slide, n, "s2-note-main", "先记录新增，\n再对真正需要复核的历史结果逐项补充。", "group", 930, 225, 260, 118, { color: C.ink });
  addLine(slide, n, "s2-note-rule", 930, 372, 1190, 372, C.blue, 2, "note-divider");
  addText(slide, n, "s2-note-boundary", "这是范围选择。\n目前没有证明效率提升。", "body", 930, 400, 260, 84, { color: C.blue, bold: true });
  addText(slide, n, "s2-note-why", "先记新增让上下文清楚的实验先进入记录；历史材料只为真正复核需要而补回。", "body", 930, 520, 260, 86);
  footer(slide, n);
  return slide;
}

function buildSlide3(presentation) {
  const n = 3;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, n, "复核把结果产生过程变成可讨论记录", "03 复核路径");

  addText(slide, n, "s3-flow-heading", "四个阶段共享同一份记录", "group", 55, 150, 520, 30, { color: C.blue });
  addText(slide, n, "s3-flow-caption", "定位依据与补充缺项，直到负责人确认。", "note", 600, 154, 335, 24, { alignment: "right" });

  const nodeData = [
    { x: 78, name: "submit", title: "提交", desc: "结果记录\n及受控引用", evidence: "执行者提交结果记录及受控引用" },
    { x: 292, name: "locate", title: "定位", desc: "数据、脚本、条件\n提出缺项", evidence: "另一成员依据记录定位数据、脚本和条件并提出缺项" },
    { x: 506, name: "supplement", title: "补充", desc: "执行者\n补齐记录", evidence: "执行者补充" },
    { x: 720, name: "confirm", title: "确认", desc: "负责人确认\n→ 可讨论版本", evidence: "负责人确认后进入可讨论版本" },
  ];
  const nodes = [];
  for (const d of nodeData) nodes.push({ ...d, shape: rect(slide, `s3-node-${d.name}`, d.x, 245, 170, 92, C.paleBlue, C.blue, 1, 10) });
  for (let i = 0; i < nodes.length - 1; i++) addConnector(slide, n, `s3-edge-${i + 1}`, nodes[i].shape, nodes[i + 1].shape, nodes[i + 1].evidence);
  for (const d of nodes) {
    addText(slide, n, `s3-${d.name}-title`, d.title, "group", d.x + 12, 258, 146, 28, { color: C.blue, alignment: "center", verticalAlignment: "middle" });
    addText(slide, n, `s3-${d.name}-desc`, d.desc, "body", d.x + 10, 286, 150, 38, { alignment: "center", verticalAlignment: "middle", lineSpacing: 1.1 });
  }
  addText(slide, n, "s3-process-limit", "复核检查结果如何产生，不要求复做实验，也不代替科学结论审查。", "body", 78, 388, 812, 52, { color: C.ink });

  rect(slide, "s3-auth-surface", 945, 148, 280, 208, C.pale);
  addText(slide, n, "s3-auth-heading", "新增访问授权", "group", 970, 170, 230, 30, { color: C.blue });
  addText(slide, n, "s3-auth-body", "暂停共享\n负责人处理授权\n处理后继续", "body", 970, 220, 230, 102, { color: C.ink });
  addText(slide, n, "s3-auth-note", "授权是继续共享的条件。", "note", 970, 330, 230, 22, { color: C.muted });

  rect(slide, "s3-boundary-surface", 945, 382, 280, 246, C.paleBlue);
  addText(slide, n, "s3-boundary-heading", "复核边界", "group", 970, 404, 230, 30, { color: C.blue });
  addText(slide, n, "s3-boundary-body", "检查结果如何产生。\n\n不要求复做实验，\n也不代替科学结论审查。", "body", 970, 454, 240, 132);
  footer(slide, n);
  return slide;
}

function buildSlide4(presentation) {
  const n = 4;
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  header(slide, n, "四周试点以过程反馈决定去留", "04 去留条件");

  rect(slide, "s4-scope-surface", 55, 148, 1170, 76, C.pale);
  addText(slide, n, "s4-scope-heading", "拟定范围", "group", 80, 169, 130, 30, { color: C.blue });
  addText(slide, n, "s4-scope-body", "一个课题方向  ·  两名自愿成员  ·  只记录新增实验", "body", 235, 170, 720, 30);
  addText(slide, n, "s4-scope-note", "不是全量历史归档", "note", 1010, 173, 170, 24, { alignment: "right", color: C.muted });

  addText(slide, n, "s4-timeline-heading", "四周安排先验证记录负担，再决定范围", "group", 55, 252, 660, 30, { color: C.blue });
  const weeks = [
    { x: 100, name: "w1", title: "第1周", desc: "确认最少字段\n试填一个结果" },
    { x: 340, name: "w23", title: "第2–3周", desc: "记录缺项\n填写负担" },
    { x: 580, name: "w4", title: "第4周", desc: "决定：保留 / 修改 / 停止" },
  ];
  const wnodes = weeks.map(d => ({ ...d, shape: rect(slide, `s4-week-${d.name}`, d.x, 310, 180, 94, C.paleBlue, C.blue, 1, 10) }));
  addConnector(slide, n, "s4-edge-w1-w23", wnodes[0].shape, wnodes[1].shape, "第一周后进入第二三周记录缺项和填写负担");
  addConnector(slide, n, "s4-edge-w23-w4", wnodes[1].shape, wnodes[2].shape, "第二三周后进入第四周去留决定");
  for (const d of wnodes) {
    addText(slide, n, `s4-${d.name}-title`, d.title, "group", d.x + 12, 323, 156, 28, { color: C.blue, alignment: "center", verticalAlignment: "middle" });
    addText(slide, n, `s4-${d.name}-desc`, d.desc, "body", d.x + 10, 358, 160, 44, { alignment: "center", verticalAlignment: "middle", lineSpacing: 1.08 });
  }
  addLine(slide, n, "s4-timeline-base", 100, 442, 760, 442, C.line, 1, "timeline-rule");
  addText(slide, n, "s4-timeline-foot", "具体复核过程和成员反馈，决定是否继续。", "note", 100, 460, 660, 26, { color: C.muted });

  rect(slide, "s4-eval-surface", 825, 248, 400, 380, C.paleBlue);
  addText(slide, n, "s4-eval-heading", "评估与停止条件", "group", 850, 270, 340, 30, { color: C.blue });
  addText(slide, n, "s4-eval-body", "评估看三件事\n来源能否定位\n处理与排除依据能否理解\n负担是否愿意长期承担\n\n依据具体复核过程及成员反馈，\n不设统一分数。", "body", 850, 320, 340, 178);
  addLine(slide, n, "s4-eval-rule", 850, 520, 1195, 520, C.blue, 2, "condition-divider");
  addText(slide, n, "s4-stop-body", "持续挤占实验时间、权限不明，或只有重复抄写而不帮助解释结果时：缩小要求或停止。", "body", 850, 540, 340, 72, { color: C.ink });

  rect(slide, "s4-boundary-strip", 55, 644, 1170, 34, C.blue);
  addText(slide, n, "s4-boundary-text", "范围为拟定：没有实测效率或完成率。", "note", 75, 651, 1120, 22, { color: C.white, bold: true });
  footer(slide, n);
  return slide;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  buildSlide1(p);
  buildSlide2(p);
  buildSlide3(p);
  buildSlide4(p);

  for (const [i, slide] of p.slides.items.entries()) {
    const stem = `slide-${i + 1}`;
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await fs.writeFile(`${OUT}/text-roles.json`, JSON.stringify(roles, null, 2), "utf8");
  await fs.writeFile(`${OUT}/connections.json`, JSON.stringify(connections, null, 2), "utf8");
  await fs.writeFile(`${OUT}/line-paths.json`, JSON.stringify(lines, null, 2), "utf8");
  await fs.writeFile(`${OUT}/text-inventory.json`, JSON.stringify(textBySlide, null, 2), "utf8");
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
  console.log(JSON.stringify({ slides: p.slides.items.length, pptx: `${OUT}/deck.pptx`, connectors: connections.length, lines: lines.length }, null, 2));
}

main().catch(err => { console.error(err); process.exitCode = 1; });
