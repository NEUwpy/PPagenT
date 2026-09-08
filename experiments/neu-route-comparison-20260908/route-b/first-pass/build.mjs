import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter, northeasternUniversitySkin } from '../../../src/runtime/skins/northeastern-university.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const outputPptx = path.join(here, 'deck.pptx');
const renderDir = path.join(here, 'rendered');
const bodyFrame = northeasternUniversitySkin.bodyFrame;
const FONT = northeasternUniversitySkin.typographyRoles.bodyTypeface;
const DISPLAY = northeasternUniversitySkin.typographyRoles.displayTypeface;

const C = {
  blue: '#315F91',
  blue2: '#6E8EAF',
  paleBlue: '#E8F0F7',
  pale: '#F5F7F9',
  dark: '#2B2B2B',
  body: '#404040',
  muted: '#6F6F6F',
  line: '#D6DDE5',
  orange: '#C56B31',
  paleOrange: '#F7EDE5',
  green: '#5D8364',
  paleGreen: '#E9F1EA',
  red: '#A64B43',
  paleRed: '#F7E7E5',
  white: '#FFFFFF',
};

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, left, top, width, height, fontSize = 18, color = C.body, opts = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox', name,
    position: { left, top, width, height },
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.typeface || FONT,
    fontSize,
    color,
    bold: Boolean(opts.bold),
    alignment: opts.align || 'left',
    verticalAlignment: opts.valign || 'top',
    autoFit: 'none',
    ...opts.style,
  };
  return shape;
}

function addRect(slide, name, left, top, width, height, fill, line = C.line, radius = false) {
  return slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect', name,
    position: { left, top, width, height },
    fill,
    line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 },
    ...(radius ? { borderRadius: 'rounded-lg' } : {}),
  });
}

function addRule(slide, name, left, top, width, color = C.line, height = 1) {
  return addRect(slide, name, left, top, width, height, color, 'none', false);
}

function addSectionLead(slide, name, kicker, text, color = C.blue) {
  addText(slide, `${name}-kicker`, kicker, 55, 184, 1170, 22, 14, color, { bold: true });
  addText(slide, `${name}-lead`, text, 55, 211, 1170, 33, 21, C.dark, { bold: true });
}

function addFoot(slide, name, text) {
  addText(slide, `${name}-foot`, text, 55, 634, 1170, 18, 12, C.muted);
}

function addMetric(slide, name, value, label, left, top, width, accent) {
  addText(slide, `${name}-value`, value, left, top, width, 42, 32, accent, { bold: true, typeface: DISPLAY });
  addText(slide, `${name}-label`, label, left, top + 41, width, 28, 14, C.body, { bold: true });
}

function addLegend(slide, name, left, top, fill, label) {
  addRect(slide, `${name}-swatch`, left, top + 4, 12, 12, fill, fill, false);
  addText(slide, `${name}-label`, label, left + 19, top, 160, 20, 13, C.body);
}

function page1(slide) {
  addSectionLead(slide, 'p1', '主证据｜四个月同口径观察', '请求量翻倍后，首响及时率降至60%');
  addText(slide, 'p1-context', '收到请求数上升与响应压力上升同步出现；指标是“结案后≤2个工作日首次给出可执行答复”，不是结案时长。', 55, 248, 1170, 28, 15, C.body);

  const tableX = 55, tableY = 294, tableW = 730, tableH = 286;
  addRect(slide, 'p1-table-bg', tableX, tableY, tableW, tableH, C.white, C.line, true);
  addText(slide, 'p1-table-title', '月度观察值（同一统计口径）', tableX + 22, tableY + 18, 280, 24, 17, C.dark, { bold: true });
  const cols = [
    { label: '月份', x: tableX + 22, w: 75 },
    { label: '收到请求数', x: tableX + 98, w: 138 },
    { label: '≤2工作日首响', x: tableX + 242, w: 172 },
    { label: '中位首次响应', x: tableX + 420, w: 150 },
  ];
  cols.forEach((c, i) => addText(slide, `p1-head-${i}`, c.label, c.x, tableY + 57, c.w, 22, 13, C.muted, { bold: true }));
  addRule(slide, 'p1-head-rule', tableX + 20, tableY + 84, tableW - 40, C.line);
  const rows = [
    ['1月', '120', '96 / 80%', '1.3工作日'],
    ['2月', '150', '114 / 76%', '1.5工作日'],
    ['3月', '180', '126 / 70%', '1.8工作日'],
    ['4月', '240', '144 / 60%', '2.4工作日'],
  ];
  rows.forEach((r, ri) => {
    const y = tableY + 98 + ri * 42;
    if (ri === 3) addRect(slide, `p1-highlight-${ri}`, tableX + 14, y - 5, tableW - 28, 34, C.paleBlue, 'none', true);
    addText(slide, `p1-r-${ri}-m`, r[0], cols[0].x, y, cols[0].w, 22, 15, ri === 3 ? C.blue : C.body, { bold: true });
    addText(slide, `p1-r-${ri}-n`, r[1], cols[1].x, y, cols[1].w, 22, 15, ri === 3 ? C.blue : C.body, { bold: ri === 3 });
    addText(slide, `p1-r-${ri}-rate`, r[2], cols[2].x, y, cols[2].w, 22, 15, ri === 3 ? C.orange : C.body, { bold: ri === 3 });
    addText(slide, `p1-r-${ri}-median`, r[3], cols[3].x, y, cols[3].w, 22, 15, ri === 3 ? C.red : C.body, { bold: ri === 3 });
  });
  addLegend(slide, 'p1-legend-blue', tableX + 22, tableY + 263, C.blue, '4月重点行');
  addText(slide, 'p1-legend-note', '1—4月无缺失记录', tableX + 300, tableY + 263, 170, 20, 13, C.muted);

  const sideX = 815, sideW = 410;
  addRect(slide, 'p1-side-bg', sideX, tableY, sideW, tableH, C.paleBlue, C.paleBlue, true);
  addText(slide, 'p1-side-title', '观察含义', sideX + 25, tableY + 22, 180, 24, 17, C.blue, { bold: true });
  addMetric(slide, 'p1-m1', '2×', '请求量：120 → 240', sideX + 25, tableY + 62, 150, C.blue);
  addMetric(slide, 'p1-m2', '−20pt', '及时率：80% → 60%', sideX + 205, tableY + 62, 170, C.orange);
  addRule(slide, 'p1-side-rule', sideX + 25, tableY + 143, sideW - 50, '#C3D4E2');
  addText(slide, 'p1-side-body', '中位首次响应时间同步由1.3天升至2.4天。', sideX + 25, tableY + 163, sideW - 50, 30, 16, C.dark, { bold: true });
  addText(slide, 'p1-side-boundary', '证据边界', sideX + 25, tableY + 214, 120, 20, 14, C.blue, { bold: true });
  addText(slide, 'p1-side-boundary-body', '工作量与压力同步上升，但无对照实验，不能断言工作量增长是响应变慢的唯一原因。', sideX + 25, tableY + 240, sideW - 50, 44, 14, C.body);
  addFoot(slide, 'p1', '模拟数据｜服务人员数量四个月保持不变；所有数值为排版验证用虚构情境。');
}

function page2(slide) {
  addSectionLead(slide, 'p2', '原因复核｜互斥且完整的阻塞分类', '4月未达标请求中，材料与权限阻塞占75%');
  addText(slide, 'p2-context', '复核对象为4月未达到两个工作日首响标准的96个请求；每个请求只记一个主要阻塞原因。', 55, 248, 1170, 28, 15, C.body);

  const left = 55, top = 294, width = 745;
  addRect(slide, 'p2-main-bg', left, top, width, 292, C.white, C.line, true);
  addText(slide, 'p2-main-title', '96个请求的主要阻塞原因', left + 24, top + 20, 300, 24, 17, C.dark, { bold: true });
  const causes = [
    { label: '材料不全', value: 42, desc: '字段缺失或样本文件未附', fill: C.blue },
    { label: '权限确认', value: 30, desc: '授权人不明确或范围未确认', fill: C.orange },
    { label: '需求反复', value: 16, desc: '需求多轮变更', fill: C.blue2 },
    { label: '其他', value: 8, desc: '其余主要阻塞', fill: C.muted },
  ];
  const barX = left + 25, barY = top + 70, barW = width - 50, barH = 42;
  let cursor = barX;
  causes.forEach((c, i) => {
    const w = barW * c.value / 96;
    addRect(slide, `p2-bar-${i}`, cursor, barY, w, barH, c.fill, c.fill, false);
    addText(slide, `p2-bar-label-${i}`, `${c.label} ${c.value}`, cursor + 4, barY + 10, Math.max(30, w - 8), 20, 13, C.white, { bold: true, align: 'center' });
    cursor += w;
  });
  addText(slide, 'p2-total', '材料与权限：72 / 96 = 75%', left + 25, top + 133, width - 50, 30, 24, C.blue, { bold: true });
  causes.forEach((c, i) => {
    const y = top + 180 + i * 24;
    addRect(slide, `p2-dot-${i}`, left + 27, y + 4, 10, 10, c.fill, c.fill, true);
    addText(slide, `p2-cause-${i}`, `${c.label} ${c.value}｜${c.desc}`, left + 47, y, width - 72, 20, 13, C.body);
  });

  const sideX = 825, sideW = 400;
  addRect(slide, 'p2-side-bg', sideX, top, sideW, 292, C.paleOrange, C.paleOrange, true);
  addText(slide, 'p2-side-title', '这项证据能支持什么', sideX + 25, top + 22, sideW - 50, 24, 17, C.orange, { bold: true });
  addText(slide, 'p2-use-1', '① 入口先覆盖字段与授权校验。', sideX + 25, top + 75, sideW - 50, 28, 16, C.dark, { bold: true });
  addText(slide, 'p2-use-2', '② 复杂需求沟通仍需人工判断。', sideX + 25, top + 121, sideW - 50, 28, 16, C.body);
  addText(slide, 'p2-use-3', '③ 比例仅代表4月复核结果。', sideX + 25, top + 167, sideW - 50, 28, 16, C.body);
  addRule(slide, 'p2-side-rule', sideX + 25, top + 215, sideW - 50, '#E5C9B8');
  addText(slide, 'p2-side-limit', '边界', sideX + 25, top + 231, 80, 20, 14, C.orange, { bold: true });
  addText(slide, 'p2-side-limit-body', '分类用于确定先查哪里，不等于每项干预可消除的数量，也不能预测节省工时。', sideX + 25, top + 254, sideW - 50, 32, 13, C.body);
  addFoot(slide, 'p2', '模拟数据｜四类原因彼此互斥且合计完整；比例由本次复核直接计算。');
}

function addMatrixCell(slide, name, left, top, width, height, text, fill, color = C.body, opts = {}) {
  addRect(slide, `${name}-bg`, left, top, width, height, fill, C.line, false);
  addText(slide, `${name}-text`, text, left + 8, top + 5, width - 16, height - 10, opts.fontSize || 13, color, { bold: Boolean(opts.bold), align: opts.align || 'center', valign: 'middle' });
}

function page3(slide) {
  addSectionLead(slide, 'p3', '方案对照｜作用环节 × 实施约束', '建议先试行统一申请入口，因其直接对应主要阻塞且投入可控');
  addText(slide, 'p3-context', '三种应对措施的投入与周期均为内部方案估计，不能换算为已验证的响应改善。', 55, 248, 1170, 28, 15, C.body);

  const x = 55, y = 292, labelW = 150, colW = 250, totalW = 930, rowH = 39, headH = 38;
  addMatrixCell(slide, 'p3-h-label', x, y, labelW, headH, '比较维度', C.blue, C.white, { bold: true });
  const headers = [
    { key: 'a', text: 'A 临时增加值班', fill: C.muted },
    { key: 'b', text: 'B 统一申请入口', fill: C.blue },
    { key: 'c', text: 'C 批量自动预检', fill: C.orange },
  ];
  headers.forEach((h, i) => addMatrixCell(slide, `p3-h-${h.key}`, x + labelW + i * colW, y, colW, headH, h.text, h.fill, C.white, { bold: true }));
  const rows = [
    ['直接作用环节', '人工响应排队', '提交时字段与授权校验', '重复性材料格式检查'],
    ['初期投入', '8人日', '12人日', '30人日'],
    ['预计上线周期', '1周', '2周', '6周'],
    ['持续维护', '每周2人日值班', '每周0.5人日规则维护', '每周1人日规则维护'],
    ['当前依赖', '可调配值班人员', '三类请求字段达成一致', '稳定字段及可机器判断的规则'],
    ['主要限制', '不直接解决材料缺失', '不消除复杂需求沟通', '不替代人工授权判断'],
  ];
  rows.forEach((r, ri) => {
    const ry = y + headH + ri * rowH;
    const base = ri % 2 === 0 ? C.white : C.pale;
    addMatrixCell(slide, `p3-r-${ri}-label`, x, ry, labelW, rowH, r[0], base, C.dark, { bold: true, align: 'left' });
    addMatrixCell(slide, `p3-r-${ri}-a`, x + labelW, ry, colW, rowH, r[1], base, ri === 1 || ri === 2 ? C.muted : C.body, { bold: ri === 1 || ri === 2 });
    addMatrixCell(slide, `p3-r-${ri}-b`, x + labelW + colW, ry, colW, rowH, r[2], ri === 0 || ri === 1 || ri === 2 ? C.paleBlue : base, ri === 1 || ri === 2 ? C.blue : C.body, { bold: ri === 1 || ri === 2 });
    addMatrixCell(slide, `p3-r-${ri}-c`, x + labelW + 2 * colW, ry, colW, rowH, r[3], base, ri === 1 || ri === 2 ? C.orange : C.body, { bold: ri === 1 || ri === 2 });
  });

  const sx = 975, sy = y, sw = 250;
  addRect(slide, 'p3-side', sx, sy, sw, 274, C.paleBlue, C.blue, true);
  addText(slide, 'p3-side-title', '选择 B', sx + 18, sy + 18, sw - 36, 30, 21, C.blue, { bold: true, typeface: DISPLAY });
  addText(slide, 'p3-side-why', '材料与权限类阻塞占75%；B直接对应。', sx + 18, sy + 62, sw - 36, 70, 15, C.dark, { bold: true });
  addRule(slide, 'p3-side-rule', sx + 18, sy + 145, sw - 36, '#C3D4E2');
  addText(slide, 'p3-side-next', 'A保留为高峰应急；C待入口规则稳定后再评估。', sx + 18, sy + 160, sw - 36, 54, 14, C.body);
  addText(slide, 'p3-side-limit', 'B尚未实施，暂不宣称改善。', sx + 18, sy + 228, sw - 36, 28, 14, C.blue, { bold: true });
  addFoot(slide, 'p3', '模拟方案估计｜“人日”表示实施工作量；持续维护为周期性投入；不承诺消除全部阻塞。');
}

function page4(slide) {
  addSectionLead(slide, 'p4', '工作计划｜门槛决定是否扩围', '六周试点应以数据完整和规则可用为门槛，再决定是否扩围');
  addText(slide, 'p4-context', '第3—4周只覆盖数据提取请求；通过后才考虑扩展到数据清洗和权限开通。', 55, 248, 1170, 28, 15, C.body);

  const x = 55, y = 300, labelW = 280, gridX = x + labelW, gridW = 500, colW = gridW / 6, rowH = 59, headH = 32;
  addRect(slide, 'p4-grid-bg', x, y, labelW + gridW, headH + rowH * 3, C.white, C.line, true);
  addText(slide, 'p4-grid-label', '阶段与交付', x + 16, y + 6, labelW - 24, 20, 14, C.blue, { bold: true });
  ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周'].forEach((w, i) => {
    addRect(slide, `p4-week-${i}-bg`, gridX + i * colW, y, colW, headH, C.blue, C.blue, false);
    addText(slide, `p4-week-${i}`, w, gridX + i * colW, y + 6, colW, 20, 12, C.white, { bold: true, align: 'center' });
  });
  const rows = [
    { id: '1', label: '统一字段与授权责任\n字段字典、授权清单、统一入口', start: 0, span: 2, fill: C.blue, note: '三类请求共同参与' },
    { id: '2', label: '小范围试用\n缺失字段、退回原因、首次响应记录', start: 2, span: 2, fill: C.orange, note: '仅数据提取请求' },
    { id: '3', label: '复核后决定扩围\n数据清洗、权限开通', start: 4, span: 2, fill: C.green, note: '负责人复核后决定' },
  ];
  rows.forEach((r, ri) => {
    const ry = y + headH + ri * rowH;
    addRule(slide, `p4-row-${ri}`, x, ry + rowH - 1, labelW + gridW, C.line);
    addText(slide, `p4-row-label-${ri}`, r.label, x + 16, ry + 8, labelW - 28, 42, 14, C.dark, { bold: true });
    for (let i = 0; i < 6; i += 1) addRule(slide, `p4-v-${ri}-${i}`, gridX + i * colW, ry, 1, C.line, rowH);
    addRect(slide, `p4-bar-${ri}`, gridX + r.start * colW + 6, ry + 12, r.span * colW - 12, 30, r.fill, r.fill, true);
    addText(slide, `p4-bar-note-${ri}`, r.note, gridX + r.start * colW + 10, ry + 18, r.span * colW - 20, 20, 13, C.white, { bold: true, align: 'center' });
  });

  const sx = 850, sy = 300, sw = 375;
  addRect(slide, 'p4-side-bg', sx, sy, sw, 210, C.paleBlue, C.paleBlue, true);
  addText(slide, 'p4-side-title', '进入下一阶段的条件', sx + 22, sy + 20, sw - 44, 24, 17, C.blue, { bold: true });
  addText(slide, 'p4-g1', '1—2周：三类请求均完成一轮实际样本填写检查，无关键必填缺失。', sx + 22, sy + 58, sw - 44, 44, 14, C.body);
  addText(slide, 'p4-g2', '3—4周：记录完整，且未发现阻断提交的高频规则错误；否则回到字段/规则修订。', sx + 22, sy + 110, sw - 44, 50, 14, C.body);
  addText(slide, 'p4-g3', '5—6周：负责人复核数据后，再决定是否扩围。', sx + 22, sy + 168, sw - 44, 28, 14, C.blue, { bold: true });

  addRect(slide, 'p4-metrics-bg', 55, 548, 1170, 64, C.paleGreen, C.paleGreen, true);
  addText(slide, 'p4-metrics-title', '统一评估口径', 76, 564, 130, 22, 15, C.green, { bold: true });
  addText(slide, 'p4-m1', '两个工作日内响应比例', 230, 564, 220, 22, 15, C.dark, { bold: true });
  addText(slide, 'p4-m2', '材料退回比例', 510, 564, 150, 22, 15, C.dark, { bold: true });
  addText(slide, 'p4-m3', '经办人维护时间', 720, 564, 165, 22, 15, C.dark, { bold: true });
  addText(slide, 'p4-m4', '目标值由试点基线确定', 940, 564, 230, 22, 14, C.muted, { bold: true });
  addFoot(slide, 'p4', '模拟计划｜阶段存在回流条件；未预设未经论证的百分比目标。');
}

async function main() {
  await fs.mkdir(renderDir, { recursive: true });
  await fs.mkdir(path.join(here, '.runtime'), { recursive: true });
  const pages = [
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '请求量翻倍后，首响及时率降至60%' }, meta: { sectionName: '运行观察' }, intent: { intentId: 'route-b-evidence' }, decision: { selectedAssetId: 'route-b-c01-multi-evidence' } },
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '4月未达标请求中，材料与权限阻塞占75%' }, meta: { sectionName: '原因复核' }, intent: { intentId: 'route-b-decomposition' }, decision: { selectedAssetId: 'route-b-evidence-decomposition' } },
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '建议先试行统一申请入口，因其直接对应主要阻塞且投入可控' }, meta: { sectionName: '方案取舍' }, intent: { intentId: 'route-b-eval-grid' }, decision: { selectedAssetId: 'route-b-c03-eval-grid' } },
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '六周试点应以数据完整和规则可用为门槛，再决定是否扩围' }, meta: { sectionName: '试点计划' }, intent: { intentId: 'route-b-workplan' }, decision: { selectedAssetId: 'route-b-c06-workplan' } },
  ];
  const starterPptx = path.join(here, '.runtime', 'template-starter.pptx');
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx,
    pages,
    manuscriptSource: 'inputs/manuscript.txt（模拟数据）',
  });
  [page1, page2, page3, page4].forEach((fn, i) => fn(slides[i]));
  for (let i = 0; i < slides.length; i += 1) {
    const n = String(i + 1).padStart(2, '0');
    await writeBlob(path.join(renderDir, `slide-${n}.png`), await presentation.export({ slide: slides[i], format: 'png', scale: 1 }));
    await fs.writeFile(path.join(renderDir, `slide-${n}.layout.json`), await (await slides[i].export({ format: 'layout' })).text(), 'utf8');
  }
  await writeBlob(path.join(renderDir, 'montage.webp'), await presentation.export({ format: 'webp', montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  await fs.writeFile(path.join(here, 'build-inspect.ndjson'), (await presentation.inspect({ kind: 'slide,textbox,shape,notes,layout', maxChars: 250000 })).ndjson, 'utf8');
  console.log(JSON.stringify({ outputPptx, renderDir, bodyFrame, slideCount: slides.length }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
