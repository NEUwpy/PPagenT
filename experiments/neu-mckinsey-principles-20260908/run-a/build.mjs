import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNortheasternUniversityStarter } from '../../../src/runtime/skins/northeastern-university.mjs';
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin, universityMckinseyTypography } from '../../../src/runtime/invoke-university-structure.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const outputPptx = path.join(here, 'neu-mckinsey-principles-run-a.pptx');
const qaDir = path.join(here, 'artifact-qa');
const evidencePath = path.join(here, 'structure-calls.jsonl');
const fontDisplay = universityMckinseySkin.fonts.display;
const fontBody = universityMckinseySkin.fonts.body;
const C = { dark: '#2B2B2B', body: '#404040', muted: '#6F6F6F', blue: '#315F91', pale: '#EAF1F6', line: '#C7D4DE', white: '#FFFFFF', alert: '#A64B3C', green: '#4C7B62' };
const T = { title: universityMckinseyTypography.title, heading: universityMckinseyTypography.heading, body: universityMckinseyTypography.body, meta: universityMckinseyTypography.meta };

await fs.mkdir(qaDir, { recursive: true });
await fs.writeFile(evidencePath, '');

const pages = [1, 2, 3, 4].map((n) => ({
  content: { pageId: `run-a-page-${n}`, title: '', sectionName: '服务观察' },
  meta: { sectionName: '服务观察' },
  payload: { assetId: 'northeastern-university-body-001', parameters: {} },
  intent: { intentId: `run-a-intent-${n}` },
  decision: { selectedAssetId: `run-a-layout-${n}` },
}));
pages[0].content.title = '请求量翻倍后，按时首次响应比例降至60%';
pages[1].content.title = '4月超时主要集中在材料与权限阻塞，入口规则是先手';
pages[2].content.title = 'B统一申请入口与阻塞类型最直接对应，适合先试行';
pages[3].content.title = '六周试点先验证规则可用性，再决定是否扩大范围';

function text(slide, name, value, position, style = {}) {
  const shape = slide.shapes.add({ geometry: 'textbox', name, position, fill: 'none', line: { style: 'solid', fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { typeface: style.typeface ?? fontBody, autoFit: 'none', insets: { left: 0, right: 0, top: 0, bottom: 0 }, color: C.body, ...style };
  return shape;
}
function box(slide, name, position, fill = C.white, line = C.line) {
  return slide.shapes.add({ geometry: 'rect', name, position, fill, line: { style: 'solid', fill: line, width: 1 } });
}
function rule(slide, name, position, color = C.line, width = 1) {
  return slide.shapes.add({ geometry: 'line', name, position, line: { style: 'solid', fill: color, width } });
}
function pill(slide, name, value, position, fill = C.pale, color = C.blue) {
  const s = slide.shapes.add({ geometry: 'roundRect', name, position, fill, line: { style: 'solid', fill, width: 0 } });
  s.text = value;
  s.text.style = { typeface: fontBody, fontSize: T.meta, bold: true, color, alignment: 'center', verticalAlignment: 'middle', autoFit: 'none', insets: { left: 8, right: 8, top: 0, bottom: 0 } };
  return s;
}

function pageOne(slide) {
  text(slide, 'p1-lead', '历史观察：工作量与响应压力同步上升，但观察本身不识别唯一原因。', { left: 55, top: 181, width: 820, height: 30 }, { fontSize: T.body, color: C.body });
  pill(slide, 'p1-sim', '模拟数据', { left: 1060, top: 180, width: 110, height: 28 }, '#F3E6E2', C.alert);
  text(slide, 'p1-chart-label-1', '收到请求数', { left: 75, top: 226, width: 260, height: 25 }, { fontSize: T.heading, bold: true, color: C.dark });
  slide.charts.add('bar', { position: { left: 60, top: 250, width: 560, height: 260 }, categories: ['1月', '2月', '3月', '4月'], series: [{ name: '请求数', values: [120, 150, 180, 240], fill: C.blue }], barOptions: { direction: 'column', grouping: 'clustered', gapWidth: 60 }, hasLegend: false, xAxis: { textStyle: { typeface: fontBody, fontSize: 14, fill: C.muted }, line: { style: 'solid', fill: C.line, width: 1 } }, yAxis: { min: 0, max: 260, majorUnit: 50, textStyle: { typeface: fontBody, fontSize: 12, fill: C.muted }, majorGridlines: { style: 'solid', fill: '#E8EEF2', width: 1 }, line: { style: 'solid', fill: C.line, width: 1 } }, dataLabels: { showValue: true, position: 'outEnd', textStyle: { typeface: fontBody, fontSize: 13, fill: C.dark, bold: true } } });
  text(slide, 'p1-chart-label-2', '两个工作日内首次可执行答复比例', { left: 678, top: 226, width: 430, height: 25 }, { fontSize: T.heading, bold: true, color: C.dark });
  slide.charts.add('line', { position: { left: 665, top: 250, width: 520, height: 250 }, categories: ['1月', '2月', '3月', '4月'], series: [{ name: '按时首次响应比例', values: [0.8, 0.76, 0.7, 0.6], line: { style: 'solid', fill: C.alert, width: 3 }, marker: { symbol: 'circle', size: 7 } }], hasLegend: false, yAxis: { min: 0.5, max: 0.9, majorUnit: 0.1, numberFormatCode: '0%', textStyle: { typeface: fontBody, fontSize: 12, fill: C.muted }, majorGridlines: { style: 'solid', fill: '#E8EEF2', width: 1 }, line: { style: 'solid', fill: C.line, width: 1 } }, xAxis: { textStyle: { typeface: fontBody, fontSize: 14, fill: C.muted }, line: { style: 'solid', fill: C.line, width: 1 } } });
  [['80%', 752], ['76%', 873], ['70%', 994], ['60%', 1115]].forEach(([v, x], i) => text(slide, `p1-rate-${i}`, v, { left: x - 26, top: 264 + (i === 0 ? 0 : i === 1 ? 26 : i === 2 ? 66 : 112), width: 52, height: 20 }, { fontSize: 13, bold: true, color: C.dark, alignment: 'center' }));
  box(slide, 'p1-bottom', { left: 665, top: 525, width: 520, height: 90 }, '#F7F9FA', '#DDE5EA');
  text(slide, 'p1-bottom-main', '首次响应中位时间：1.3 → 2.4 个工作日', { left: 685, top: 542, width: 480, height: 28 }, { fontSize: 20, bold: true, color: C.dark });
  text(slide, 'p1-bottom-sub', '指标口径：当月收到的请求，观察结案后是否在两日内首次给出可执行答复；不是结案时长。', { left: 685, top: 578, width: 480, height: 28 }, { fontSize: T.meta, color: C.muted });
}

async function pageTwo(slide) {
  text(slide, 'p2-lead', '96个未达标准请求逐一复核，四类主要阻塞彼此互斥且合计完整。', { left: 55, top: 181, width: 840, height: 30 }, { fontSize: T.body, color: C.body });
  pill(slide, 'p2-sim', '模拟数据｜4月', { left: 1025, top: 180, width: 145, height: 28 }, '#F3E6E2', C.alert);
  await invokeUniversityStructure({ root, slide, assetId: 'parallel-folded-notes-grid-002', targetFrame: { left: 55, top: 230, width: 1170, height: 335 }, content: { items: [
    { key: 'missing', title: '材料不全｜42', body: '字段缺失或样本文件未附', iconKey: 'file-alert' },
    { key: 'permission', title: '权限确认｜30', body: '授权人不明确或范围未确认', iconKey: 'lock-question' },
    { key: 'rework', title: '需求反复｜16', body: '需求说明多次变化', iconKey: 'refresh-alert' },
    { key: 'other', title: '其他｜8', body: '未归入以上三类', iconKey: 'dots' },
  ] }, evidencePath, pageId: 'run-a-page-2', regionId: 'blocker-notes', reason: '四类互斥阻塞的并列复核结果' });
  text(slide, 'p2-foot', '对应边界：阻塞分类用于定位问题，不等于某项干预可消除的数量，也不能直接预测节省工时。', { left: 70, top: 590, width: 1110, height: 28 }, { fontSize: T.meta, color: C.muted });
}

function pageThree(slide) {
  text(slide, 'p3-lead', '方案投入与周期是内部估计；建议先验证与主要阻塞环节直接相连的B。', { left: 55, top: 181, width: 900, height: 30 }, { fontSize: T.body, color: C.body });
  pill(slide, 'p3-sim', '方案估计｜未验证效果', { left: 985, top: 180, width: 185, height: 28 }, '#F3E6E2', C.alert);
  const x0 = 55, y0 = 235, w = 1170, labelW = 190, colW = (w - labelW) / 3, rowH = 62;
  const cols = [{ key: 'A', name: 'A 临时增加值班', accent: '#E6EFF5' }, { key: 'B', name: 'B 统一申请入口', accent: '#D8E7F1' }, { key: 'C', name: 'C 批量自动预检', accent: '#E6EFF5' }];
  box(slide, 'p3-head-label', { left: x0, top: y0, width: labelW, height: 56 }, '#F3F5F6', '#D7E0E6');
  text(slide, 'p3-head-label-t', '比较维度', { left: x0 + 16, top: y0 + 16, width: labelW - 20, height: 24 }, { fontSize: T.body, bold: true, color: C.dark });
  cols.forEach((c, i) => { const x = x0 + labelW + i * colW; box(slide, `p3-head-${c.key}`, { left: x, top: y0, width: colW, height: 56 }, c.key === 'B' ? C.blue : c.accent, c.key === 'B' ? C.blue : '#D7E0E6'); text(slide, `p3-head-${c.key}-t`, c.name, { left: x + 14, top: y0 + 13, width: colW - 28, height: 30 }, { fontSize: 18, bold: true, color: c.key === 'B' ? C.white : C.dark, alignment: 'center' }); });
  const rows = [
    ['直接作用环节', '人工响应排队', '提交时字段与授权校验', '重复性材料格式检查'],
    ['初期投入 / 周期', '8人日｜1周', '12人日｜2周', '30人日｜6周'],
    ['持续维护', '每周2人日值班', '每周0.5人日规则维护', '每周1人日规则维护'],
    ['当前依赖', '可调配值班人员', '三类请求字段达成一致', '稳定字段及可机器判断规则'],
    ['主要限制', '不直接解决材料缺失', '不消除复杂需求沟通', '不替代人工授权判断'],
  ];
  rows.forEach((row, ri) => { const y = y0 + 56 + ri * rowH; box(slide, `p3-label-${ri}`, { left: x0, top: y, width: labelW, height: rowH }, '#F7F9FA', '#D7E0E6'); text(slide, `p3-label-${ri}-t`, row[0], { left: x0 + 16, top: y + 18, width: labelW - 25, height: 25 }, { fontSize: 16, bold: true, color: C.dark }); for (let ci = 0; ci < 3; ci++) { const x = x0 + labelW + ci * colW; const fill = ci === 1 ? '#F1F7FA' : C.white; box(slide, `p3-cell-${ri}-${ci}`, { left: x, top: y, width: colW, height: rowH }, fill, '#D7E0E6'); text(slide, `p3-cell-${ri}-${ci}-t`, row[ci + 1], { left: x + 14, top: y + 15, width: colW - 28, height: rowH - 20 }, { fontSize: 16, color: C.body, alignment: 'center', verticalAlignment: 'middle' }); } });
  text(slide, 'p3-recommend', '决策条件：先试行B；保留A应对短期高峰；C待入口字段和规则稳定后再评估。B尚未实施，不能宣称已改善。', { left: 70, top: 620, width: 1110, height: 30 }, { fontSize: T.body, bold: true, color: C.blue });
}

function pageFour(slide) {
  text(slide, 'p4-lead', '试点先限定在数据提取请求，先验证记录完整与规则可用，再决定是否扩展。', { left: 55, top: 181, width: 900, height: 30 }, { fontSize: T.body, color: C.body });
  pill(slide, 'p4-sim', '计划｜目标值待基线确定', { left: 950, top: 180, width: 220, height: 28 }, '#F3E6E2', C.alert);
  const y = 265, h = 170, gap = 26, x1 = 70, w = 330;
  const nodes = [
    { x: x1, title: '第1—2周｜统一规则', body: '负责人＋三类经办人\n字段字典、授权清单、统一入口\n进入条件：三类请求各完成一轮样本检查', fill: '#EAF1F6' },
    { x: x1 + w + gap, title: '第3—4周｜限定试用', body: '仅数据提取请求\n保存缺失字段、退回原因、首次响应\n扩大条件：记录完整且无高频规则错误', fill: '#D8E7F1' },
    { x: x1 + 2 * (w + gap), title: '第5—6周｜复核扩展', body: '负责人复核试点数据\n再决定是否覆盖清洗与权限开通\n同步看响应、退回、维护时间', fill: '#C8DCE9' },
  ];
  nodes.forEach((n, i) => { box(slide, `p4-node-${i}`, { left: n.x, top: y, width: w, height: h }, n.fill, '#AFC4D1'); text(slide, `p4-node-${i}-title`, n.title, { left: n.x + 18, top: y + 18, width: w - 36, height: 30 }, { fontSize: 19, bold: true, color: C.dark }); n.body.split('\n').forEach((line, j) => text(slide, `p4-node-${i}-body-${j}`, line, { left: n.x + 18, top: y + 60 + j * 28, width: w - 36, height: 22 }, { fontSize: 15, color: C.body })); });
  text(slide, 'p4-arrow-1', '→', { left: 401, top: 321, width: 22, height: 40 }, { fontSize: 26, bold: true, color: C.blue, alignment: 'center' });
  text(slide, 'p4-arrow-2', '→', { left: 757, top: 321, width: 22, height: 40 }, { fontSize: 26, bold: true, color: C.blue, alignment: 'center' });
  box(slide, 'p4-gate', { left: 95, top: 480, width: 1090, height: 125 }, '#F7F9FA', '#DDE5EA');
  text(slide, 'p4-gate-title', '若第3—4周出现会阻断提交的高频规则错误 → 回到字段与规则修订', { left: 120, top: 502, width: 1030, height: 28 }, { fontSize: 18, bold: true, color: C.alert });
  text(slide, 'p4-gate-body', '评估指标：两个工作日内首次响应比例、材料退回比例、经办人维护时间。目标值根据试点基线确定；本稿不预设未经论证的百分比目标。', { left: 120, top: 544, width: 1030, height: 42 }, { fontSize: 16, color: C.body });
}

const { presentation, slides } = await createNortheasternUniversityStarter({ pages, starterPptx: path.join(here, '.runtime', 'template-starter.pptx'), manuscriptSource: 'experiments/neu-mckinsey-principles-20260908/inputs/manuscript.txt' });
pageOne(slides[0]);
await pageTwo(slides[1]);
pageThree(slides[2]);
pageFour(slides[3]);

for (const [i, slide] of slides.entries()) {
  const stem = `slide-${String(i + 1).padStart(2, '0')}`;
  const png = await presentation.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(qaDir, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await layout.text());
}
const montage = await presentation.export({ format: 'webp', montage: true, scale: 1 });
await fs.writeFile(path.join(qaDir, 'montage.webp'), new Uint8Array(await montage.arrayBuffer()));
const inspect = await presentation.inspect({ kind: 'slide,textbox,shape,chart,notes', maxChars: 30000 });
await fs.writeFile(path.join(qaDir, 'inspect.ndjson'), inspect.ndjson ?? String(inspect));
const pptx = await (await import('@oai/artifact-tool')).PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);
await closeStructureRuntime();
console.log(JSON.stringify({ outputPptx, qaDir, slides: slides.length, titleFont: fontDisplay, bodyFont: fontBody, roles: T }, null, 2));
