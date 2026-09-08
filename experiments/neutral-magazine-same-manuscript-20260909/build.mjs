import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import asset from '../../assets/主题/中性编辑排版-001/asset.json' with { type: 'json' };
import { neutralEditorialTheme as theme } from '../../src/runtime/skins/neutral-editorial-theme.mjs';

const OUT = 'C:/PPagenT/experiments/neutral-magazine-same-manuscript-20260909';
const pptxPath = `${OUT}/deck.pptx`;
const W = 1280;
const H = 720;
const D = {
  bg: theme.background,
  surface: theme.surface,
  dark: theme.dark,
  body: theme.body,
  muted: theme.muted,
  line: theme.line,
  primary: theme.primaryColor,
  display: asset.fonts.display,
  bodyFont: asset.fonts.body,
};
const ROLE = Object.freeze({
  title: { font: D.display, size: 25, bold: true, color: D.dark },
  module: { font: D.display, size: 21, bold: true, color: D.dark },
  node: { font: D.display, size: 17, bold: true, color: D.dark },
  body: { font: D.bodyFont, size: 17, bold: false, color: D.body },
  meta: { font: D.bodyFont, size: 15, bold: false, color: D.muted },
  number: { font: D.display, size: 48, bold: false, color: D.dark },
  chapter: { font: D.display, size: 25, bold: true, color: D.primary },
});

function addText(slide, name, text, x, y, w, h, role = 'body', opts = {}) {
  const r = ROLE[role];
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.font ?? r.font,
    fontSize: opts.size ?? r.size,
    bold: opts.bold ?? r.bold,
    color: opts.color ?? r.color,
    alignment: opts.align ?? 'left',
    verticalAlignment: opts.valign ?? 'top',
    lineSpacing: opts.lineSpacing ?? (role === 'body' || role === 'meta' ? 1.15 : 1.0),
    wrap: 'square',
    autoFit: 'none',
    insets: opts.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addRect(slide, name, x, y, w, h, fill = D.surface, lineFill = 'none', lineWidth = 0) {
  return slide.shapes.add({
    geometry: 'rect',
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
  });
}

function addCircle(slide, name, x, y, d, fill = D.bg, lineFill = D.line, lineWidth = 1) {
  return slide.shapes.add({
    geometry: 'ellipse',
    name,
    position: { left: x, top: y, width: d, height: d },
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
  });
}

function rule(slide, name, x, y, w, h = 1, fill = D.line) {
  return addRect(slide, name, x, y, w, h, fill);
}

function addHeader(slide, chapter, title, page, lineStart = 560) {
  addText(slide, `chapter-${chapter}`, chapter, 56, 32, 36, 32, 'chapter');
  addText(slide, `page-title-${chapter}`, title, 100, 32, 580, 34, 'title');
  rule(slide, `title-rule-${chapter}`, lineStart, 49, 1005 - lineStart, 1, D.line);
  addText(slide, `page-marker-${page}`, `${page} / 4`, 1140, 671, 84, 20, 'meta', { align: 'right' });
  addText(slide, `simulated-${page}`, '模拟数据｜排版验证用', 1020, 34, 204, 22, 'meta', { align: 'right', color: D.primary });
}

function addNotes(slide, pagePurpose) {
  slide.speakerNotes.textFrame.setText([
    `[Sources]`,
    `- 内容来源：input-manuscript.txt（模拟稿件；单位、数据及情境全部为排版验证而虚构）。`,
    `- 外部素材：无；本页仅使用可编辑原生文字与形状。`,
    `- 页面职责：${pagePurpose}`,
  ]);
  slide.speakerNotes.setVisible(true);
}

function addMetric(slide, name, x, label, value, delta, width = 330) {
  addText(slide, `${name}-value`, value, x, 174, width, 56, 'number');
  addText(slide, `${name}-delta`, delta, x, 231, width, 24, 'meta', { color: D.primary });
  rule(slide, `${name}-line`, x, 264, width, 1, D.line);
  addText(slide, `${name}-label`, label, x, 275, width, 44, 'meta');
}

function addTableCell(slide, name, text, x, y, w, h, opts = {}) {
  return addText(slide, name, text, x + 10, y + 8, w - 20, h - 16, opts.role ?? 'body', {
    align: opts.align ?? 'left',
    valign: 'middle',
    lineSpacing: opts.lineSpacing ?? 1.05,
    color: opts.color,
    bold: opts.bold,
  });
}

function makeSlide1(p) {
  const slide = p.slides.add();
  slide.background.fill = D.bg;
  addHeader(slide, '01', '1—4月观察：响应压力随请求量上升', 1, 595);
  addText(slide, 'lead-1', '统一口径下，需求量翻倍，两个工作日内首次可执行答复比例从 80% 降至 60%。', 56, 94, 760, 36, 'body');
  addMetric(slide, 'requests', 56, '月收到请求数', '120 → 240', '+100%');
  addMetric(slide, 'rate', 382, '两个工作日内首次可执行答复', '80% → 60%', '−20 个百分点');
  addMetric(slide, 'median', 708, '首次响应中位时间（工作日）', '1.3 → 2.4', '+1.1 工作日');

  const tx = 56; const ty = 332;
  const cols = [92, 158, 282, 178];
  const labels = ['月份', '收到请求数', '两个工作日内首次\n可执行答复数', '首次响应中位时间\n（工作日）'];
  addRect(slide, 'table-1-header', tx, ty, cols.reduce((a, b) => a + b, 0), 54, D.surface);
  let cx = tx;
  labels.forEach((label, i) => { addTableCell(slide, `table-1-h-${i}`, label, cx, ty, cols[i], 54, { role: 'meta', bold: true }); cx += cols[i]; });
  const rows = [
    ['1月', '120', '96', '1.3'],
    ['2月', '150', '114', '1.5'],
    ['3月', '180', '126', '1.8'],
    ['4月', '240', '144', '2.4'],
  ];
  rows.forEach((row, ri) => {
    const y = ty + 54 + ri * 45;
    if (ri % 2 === 1) addRect(slide, `table-1-rowfill-${ri}`, tx, y, cols.reduce((a, b) => a + b, 0), 45, '#F0EFE9');
    let x = tx;
    row.forEach((cell, ci) => { addTableCell(slide, `table-1-${ri}-${ci}`, cell, x, y, cols[ci], 45, { align: ci === 0 ? 'left' : 'right' }); x += cols[ci]; });
  });
  let xline = tx;
  cols.forEach((c, i) => { xline += c; if (i < cols.length - 1) rule(slide, `table-1-v-${i}`, xline, ty, 1, 234, D.line); });
  for (let i = 0; i <= 4; i++) rule(slide, `table-1-hline-${i}`, tx, ty + 54 + i * 45, cols.reduce((a, b) => a + b, 0), 1, D.line);
  addText(slide, 'table-1-caption', '观察口径：统计当月收到的请求，从收到起观察是否在两个工作日内首次给出可执行答复，结案后回看统计；该指标不是结案时长。每月无缺失记录。', 56, 579, 740, 64, 'meta');

  addRect(slide, 'boundary-1', 836, 332, 388, 280, D.surface);
  addText(slide, 'boundary-1-head', '4月请求量构成', 864, 356, 300, 28, 'module');
  addText(slide, 'boundary-1-body', '数据提取 120\n数据清洗 72\n权限开通 48', 864, 399, 324, 84, 'body');
  rule(slide, 'boundary-1-divider', 864, 496, 324, 1, D.line);
  addText(slide, 'boundary-1-subhead', '解读边界', 864, 512, 300, 24, 'meta', { color: D.primary });
  addText(slide, 'boundary-1-note', '工作量和响应压力同时上升，但没有对照实验，不能断言工作量增长是响应变慢的唯一原因。四个月服务人员数量保持不变。', 864, 540, 324, 62, 'meta');
  addNotes(slide, '历史观察与指标口径，明确可见趋势及因果边界。');
}

function makeSlide2(p) {
  const slide = p.slides.add();
  slide.background.fill = D.bg;
  addHeader(slide, '02', '4月复核：材料与权限类占未达标请求的 75%', 2, 640);
  addText(slide, 'lead-2', '对4月未达到两个工作日响应标准的 96 个请求逐件复核；每个请求只记一个主要阻塞原因。', 56, 94, 820, 36, 'body');
  addText(slide, 'bar-title', '主要阻塞原因（互斥且合计完整）', 56, 165, 500, 28, 'module');
  const barX = 56; const barY = 208; const barW = 760; const barH = 54;
  const segs = [
    { label: '材料不全', n: 42, color: D.primary },
    { label: '权限确认', n: 30, color: D.intensity3 },
    { label: '需求反复', n: 16, color: D.intensity4 },
    { label: '其他', n: 8, color: D.muted },
  ];
  let bx = barX;
  segs.forEach((s, i) => {
    const w = barW * s.n / 96;
    addRect(slide, `segment-${i}`, bx, barY, w, barH, s.color);
    addText(slide, `segment-label-${i}`, `${s.n}`, bx, barY + 13, w, 28, 'meta', { align: 'center', color: i === 0 ? D.bg : D.dark, bold: true });
    bx += w;
    if (i < segs.length - 1) rule(slide, `segment-divider-${i}`, bx - 1, barY, 2, barH, D.bg);
  });
  let ly = 297;
  segs.forEach((s, i) => {
    addRect(slide, `legend-dot-${i}`, 56, ly + 7, 10, 10, s.color);
    addText(slide, `legend-${i}`, `${s.label}｜${s.n} 个（${(s.n / 96 * 100).toFixed(1)}%）`, 78, ly, 280, 26, 'body');
    ly += 40;
  });
  addText(slide, 'combined-stat', '72 / 96', 492, 302, 276, 62, 'number', { color: D.primary });
  addText(slide, 'combined-label', '材料与权限类合计 75.0%', 494, 366, 286, 30, 'module');
  addText(slide, 'combined-sub', '这是复核分类占比，不是可由某一措施消除的数量。', 494, 410, 300, 50, 'meta');

  addRect(slide, 'definitions-2', 836, 165, 388, 440, D.surface);
  addText(slide, 'definitions-head', '分类说明', 864, 190, 300, 28, 'module');
  addText(slide, 'definitions-body', '材料不全\n字段缺失或样本文件未附\n\n权限确认\n授权人不明确或授权范围未确认\n\n需求反复\n同一请求的需求多次变化', 864, 238, 324, 224, 'body');
  rule(slide, 'definitions-divider', 864, 486, 324, 1, D.line);
  addText(slide, 'definitions-limit', '分类彼此互斥且合计完整；不能据此预测节省工时，也不等于各措施可以消除的数量。', 864, 509, 324, 76, 'meta');
  addNotes(slide, '原因复核与分类边界，支撑下一页的方案对应关系。');
}

function makeSlide3(p) {
  const slide = p.slides.add();
  slide.background.fill = D.bg;
  addHeader(slide, '03', '方案比较：先试行 B，A 保留作高峰应急', 3, 620);
  addText(slide, 'lead-3', '以下投入与周期均为内部方案估计；人日表示实施工作量，不能与后续响应改善直接换算。', 56, 94, 880, 36, 'body');
  const tx = 56; const ty = 156; const widths = [190, 326, 326, 326]; const tableW = widths.reduce((a, b) => a + b, 0);
  addRect(slide, 'compare-header', tx, ty, tableW, 54, D.surface);
  const heads = ['比较项', 'A｜临时增加值班', 'B｜统一申请入口', 'C｜批量自动预检'];
  let x = tx;
  heads.forEach((h, i) => { addTableCell(slide, `compare-head-${i}`, h, x, ty, widths[i], 54, { role: 'module', align: i === 0 ? 'left' : 'center', color: i === 2 ? D.primary : D.dark }); x += widths[i]; });
  const rows = [
    ['直接作用环节', '人工响应排队', '提交时字段与授权校验', '重复性材料格式检查'],
    ['初期投入', '8人日', '12人日', '30人日'],
    ['预计上线周期', '1周', '2周', '6周'],
    ['持续维护', '每周2人日值班', '每周0.5人日规则维护', '每周1人日规则维护'],
    ['当前依赖', '可调配值班人员', '三类请求字段达成一致', '稳定字段及可机器判断的规则'],
    ['主要限制', '不直接解决材料缺失', '不消除复杂需求沟通', '不替代人工授权判断'],
  ];
  const heights = [54, 48, 48, 58, 72, 64];
  let y = ty + 54;
  rows.forEach((row, ri) => {
    const h = heights[ri];
    if (ri % 2 === 1) addRect(slide, `compare-fill-${ri}`, tx, y, tableW, h, '#F0EFE9');
    let cx = tx;
    row.forEach((cell, ci) => {
      addTableCell(slide, `compare-${ri}-${ci}`, cell, cx, y, widths[ci], h, { role: ci === 0 ? 'meta' : 'body', bold: ci === 0, align: ci === 0 ? 'left' : 'left', color: ci === 2 ? D.dark : undefined });
      cx += widths[ci];
    });
    rule(slide, `compare-rowline-${ri}`, tx, y, tableW, 1, D.line);
    y += h;
  });
  let vx = tx;
  widths.forEach((cw, i) => { vx += cw; if (i < widths.length - 1) rule(slide, `compare-v-${i}`, vx, ty, 1, y - ty, D.line); });
  rule(slide, 'compare-bottom', tx, y, tableW, 1, D.line);
  addText(slide, 'recommendation-3', '依据：4月复核中的材料与权限类阻塞占主要部分，B的作用环节与其对应；C依赖稳定字段，适合在入口规则稳定后再评估。', 56, 610, 960, 50, 'body');
  addText(slide, 'recommendation-3-limit', 'B 尚未实施，不能宣称已有改善，也不能承诺消除所有材料与权限阻塞。', 56, 664, 960, 26, 'meta', { color: D.primary });
  addNotes(slide, '对三种应对措施做同口径比较，给出有条件的优先级判断。');
}

function addPhase(slide, phase, x, title, body, condition, accent = false, conditionLabel = '进入条件') {
  addCircle(slide, `phase-circle-${phase}`, x, 176, 58, accent ? D.primary : D.bg, accent ? D.primary : D.line, 1);
  addText(slide, `phase-number-${phase}`, phase, x, 187, 58, 32, 'number', { size: 25, align: 'center', color: accent ? D.bg : D.dark });
  addText(slide, `phase-title-${phase}`, title, x + 78, 178, 270, 28, 'module');
  rule(slide, `phase-rule-${phase}`, x + 78, 217, 270, 1, D.line);
  addText(slide, `phase-body-${phase}`, body, x, 247, 348, 116, 'body');
  addText(slide, `phase-condition-label-${phase}`, conditionLabel, x, 390, 120, 24, 'meta', { color: D.primary });
  addText(slide, `phase-condition-${phase}`, condition, x, 419, 348, 96, 'meta');
}

function makeSlide4(p) {
  const slide = p.slides.add();
  slide.background.fill = D.bg;
  addHeader(slide, '04', '六周试点：先验证入口规则，再决定是否扩围', 4, 640);
  addText(slide, 'lead-4', 'B 尚未实施；以下是有限试点计划，不是已有改善承诺。', 56, 94, 760, 36, 'body');
  addPhase(slide, '1—2', 56, '统一字段与责任', '负责人联合三类请求经办人，形成字段字典、授权清单和统一入口。', '三类请求均完成一轮实际样本填写检查，且无关键必填字段缺失。', true);
  rule(slide, 'phase-connector-1', 412, 204, 36, 2, D.line);
  addPhase(slide, '3—4', 466, '先在数据提取试用', '只覆盖数据提取请求；保存缺失字段、退回原因和首次响应记录。', '记录完整，且未发现会阻断提交的高频规则错误；否则回到字段和规则修订。');
  rule(slide, 'phase-connector-2', 822, 204, 36, 2, D.line);
  addPhase(slide, '5—6', 876, '复核后决定扩围', '负责人复核试点数据，再决定是否扩大到数据清洗和权限开通。', '同时看两个工作日内响应比例、材料退回比例、经办人维护时间；目标值根据试点基线确定。', false, '评估口径');
  addRect(slide, 'evaluation-band', 56, 566, 1168, 72, D.surface);
  addText(slide, 'evaluation-head', '决策条件', 80, 584, 130, 24, 'module');
  addText(slide, 'evaluation-body', '先完成规则可用性验证，再判断扩围；本稿不设未经论证的百分比目标。', 230, 584, 930, 28, 'body');
  addNotes(slide, '六周有限试点计划，明确阶段依赖、回退条件和评估口径。');
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  makeSlide1(p);
  makeSlide2(p);
  makeSlide3(p);
  makeSlide4(p);
  await fs.writeFile(`${OUT}/layout-snapshot.json`, JSON.stringify(p.toProto(), null, 2));
  const inspection = await p.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 50000 });
  await fs.writeFile(`${OUT}/inspection.ndjson`, inspection.ndjson);
  const montage = await p.export({ format: 'webp', montage: true, scale: 1 });
  await writeBlob(`${OUT}/deck-montage.webp`, montage);
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(pptxPath);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
