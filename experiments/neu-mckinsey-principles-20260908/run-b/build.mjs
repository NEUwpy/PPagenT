import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter, northeasternUniversitySkin } from '../../../src/runtime/skins/northeastern-university.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputPptx = path.join(here, 'neu-mckinsey-principles-run-b.pptx');
const qaDir = path.join(here, 'rendered');
const preflightDir = path.join(here, 'preflight');
const bodyFrame = northeasternUniversitySkin.bodyFrame;
const C = {
  blue: '#315F91',
  blue2: '#6E8EAF',
  paleBlue: '#E8F0F7',
  pale: '#F5F7F9',
  dark: '#2B2B2B',
  body: '#404040',
  muted: '#6F6F6F',
  orange: '#C56B31',
  paleOrange: '#F7EDE5',
  red: '#A64B43',
  paleRed: '#F7E7E5',
  green: '#5D8364',
  paleGreen: '#E9F1EA',
  line: '#D6DDE5',
};
const FONT = 'Microsoft YaHei';
const DISPLAY = 'HYWenRunSongYun U';

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, x, y, w, h, fontSize = 18, color = C.body, opts = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox', name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 },
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
  };
  return shape;
}

function addRect(slide, name, x, y, w, h, fill, line = C.line, radius = false) {
  return slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect', name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 },
    ...(radius ? { borderRadius: 'rounded-lg' } : {}),
  });
}

function addRule(slide, name, x, y, w, color = C.line, weight = 1) {
  return slide.shapes.add({
    geometry: 'rect', name,
    position: { left: x, top: y, width: w, height: weight },
    fill: color, line: { style: 'solid', fill: color, width: 0 },
  });
}

function addPill(slide, name, text, x, y, w, fill, color = C.blue) {
  addRect(slide, `${name}-bg`, x, y, w, 26, fill, fill, true);
  addText(slide, `${name}-text`, text, x + 8, y + 4, w - 16, 18, 14, color, { bold: true, align: 'center' });
}

function addPageTag(slide, text, x = 55, y = 178) {
  addPill(slide, `tag-${text}`, text, x, y, Math.max(96, text.length * 16 + 18), C.paleBlue, C.blue);
}

function addFoot(slide, text) {
  addText(slide, `foot-${Math.random()}`, text, 55, 632, 1170, 18, 12, C.muted);
}

function addHeader(slide, title, tag) {
  addPageTag(slide, tag);
  // The existing university template owns the blue title band and page title.
  // Body titles below remain within the 492px content frame.
  addText(slide, `lead-${tag}`, title, 55, 214, 1170, 34, 21, C.dark, { bold: true, typeface: FONT });
}

function addMetric(slide, name, value, label, x, y, w, accent = C.blue) {
  addText(slide, `${name}-value`, value, x, y, w, 42, 34, accent, { bold: true, typeface: DISPLAY });
  addText(slide, `${name}-label`, label, x, y + 42, w, 28, 15, C.body, { bold: true });
}

function page1(slide) {
  addHeader(slide, '请求量翻倍后，首响及时率降至60%', '运行观察');
  addText(slide, 'p1-sub', '1—4月同口径观察：服务人员数量不变；指标衡量“结案后首次给出可执行答复是否≤2个工作日”，不是结案时长。', 55, 252, 1170, 30, 15, C.body);
  addRect(slide, 'p1-main', 55, 300, 735, 300, '#FFFFFF', C.line, true);
  addText(slide, 'p1-chart-title', '月度请求量与首响及时率', 78, 318, 340, 24, 17, C.dark, { bold: true });
  const months = ['1月', '2月', '3月', '4月'];
  const received = [120, 150, 180, 240];
  const timely = [80, 76, 70, 60];
  const median = [1.3, 1.5, 1.8, 2.4];
  const x0 = 100, colW = 150, chartX = 190, maxW = 420;
  addText(slide, 'p1-label-volume', '收到请求数', 78, 358, 95, 20, 14, C.muted, { bold: true });
  addText(slide, 'p1-label-rate', '≤2工作日首响', 78, 430, 110, 20, 14, C.muted, { bold: true });
  addText(slide, 'p1-label-median', '中位时间', 78, 502, 95, 20, 14, C.muted, { bold: true });
  months.forEach((m, i) => {
    const x = chartX + i * colW;
    addText(slide, `p1-m-${i}`, m, x, 346, 78, 22, 15, C.dark, { bold: true, align: 'center' });
    const rw = received[i] / 240 * maxW / 4;
    addRect(slide, `p1-r-${i}`, x, 377, rw, 22, i === 3 ? C.blue : C.blue2, i === 3 ? C.blue : C.blue2, true);
    addText(slide, `p1-rv-${i}`, `${received[i]}`, x + rw + 8, 378, 46, 20, 14, C.body, { bold: true });
    const tw = timely[i] / 100 * maxW / 4;
    addRect(slide, `p1-t-${i}`, x, 449, tw, 22, i === 3 ? C.orange : '#AFC3D5', i === 3 ? C.orange : '#AFC3D5', true);
    addText(slide, `p1-tv-${i}`, `${timely[i]}%`, x + tw + 8, 450, 50, 20, 14, C.body, { bold: true });
    const mw = median[i] / 2.4 * maxW / 4;
    addRect(slide, `p1-mb-${i}`, x, 521, mw, 22, i === 3 ? C.red : '#B9B9B9', i === 3 ? C.red : '#B9B9B9', true);
    addText(slide, `p1-mv-${i}`, `${median[i]}日`, x + mw + 8, 522, 72, 20, 14, C.body, { bold: true });
  });
  addRule(slide, 'p1-rule', 78, 570, 650, C.line, 1);
  addText(slide, 'p1-caveat', '工作量与响应压力同步上升，但无对照实验，不能断言工作量增长是响应变慢的唯一原因。', 78, 580, 650, 34, 14, C.muted);
  addRect(slide, 'p1-side', 820, 300, 405, 300, C.paleBlue, C.paleBlue, true);
  addText(slide, 'p1-side-title', '本页判断', 848, 326, 120, 24, 16, C.blue, { bold: true });
  addMetric(slide, 'p1-metric-a', '2×', '请求量：120 → 240', 848, 364, 165, C.blue);
  addMetric(slide, 'p1-metric-b', '−20pt', '及时率：80% → 60%', 1025, 364, 165, C.orange);
  addText(slide, 'p1-side-body1', '中位首次响应时间同步由1.3天升至2.4天。', 848, 486, 335, 28, 16, C.dark, { bold: true });
  addText(slide, 'p1-side-body2', '观察结果支持“压力上升”的判断；不支持单一因果归因。', 848, 532, 335, 38, 15, C.body);
  addFoot(slide, '模拟数据｜月度收到请求数：120 / 150 / 180 / 240；每月无缺失记录。');
}

function page2(slide) {
  addHeader(slide, '4月未达标请求中，材料与权限阻塞占75%', '原因复核');
  addText(slide, 'p2-sub', '对4月未达到两个工作日首响标准的96个请求逐一复核；每个请求只记一个主要阻塞原因。', 55, 252, 1170, 28, 15, C.body);
  addRect(slide, 'p2-chart', 55, 300, 700, 300, '#FFFFFF', C.line, true);
  addText(slide, 'p2-chart-title', '96个未达标请求的互斥完整分类', 78, 318, 360, 24, 17, C.dark, { bold: true });
  const causes = [
    ['材料不全', 42, C.blue, '字段缺失或样本文件未附'],
    ['权限确认', 30, C.orange, '授权人不明确或范围未确认'],
    ['需求反复', 16, C.blue2, '需求多轮变更'],
    ['其他', 8, C.muted, '其余主要阻塞'],
  ];
  const barX = 90, barY = 390, barW = 590, barH = 44;
  let cursor = barX;
  causes.forEach(([label, value, color]) => {
    const w = value / 96 * barW;
    addRect(slide, `p2-seg-${label}`, cursor, barY, w, barH, color, color, false);
    if (w > 60) addText(slide, `p2-seg-t-${label}`, `${label} ${value}`, cursor + 5, barY + 11, w - 10, 22, 14, '#FFFFFF', { bold: true, align: 'center' });
    else addText(slide, `p2-seg-v-${label}`, `${value}`, cursor + 4, barY + 11, w - 8, 22, 14, '#FFFFFF', { bold: true, align: 'center' });
    cursor += w;
  });
  addText(slide, 'p2-total', '材料与权限：72 / 96 = 75%', 90, 458, 590, 30, 23, C.blue, { bold: true });
  addText(slide, 'p2-caveat', '主要阻塞分类说明“先查哪里”，不等于每项干预可消除的数量，也不能预测节省工时。', 90, 510, 590, 48, 14, C.muted);
  addRect(slide, 'p2-side', 790, 300, 435, 300, C.paleOrange, C.paleOrange, true);
  addText(slide, 'p2-side-title', '如何使用这项证据', 818, 326, 250, 24, 17, C.orange, { bold: true });
  addText(slide, 'p2-side-1', '① 入口先覆盖字段与授权校验。', 818, 374, 360, 30, 17, C.dark, { bold: true });
  addText(slide, 'p2-side-2', '② 复杂需求沟通仍需人工判断。', 818, 446, 360, 30, 16, C.body);
  addText(slide, 'p2-side-3', '③ 比例仅代表4月复核结果。', 818, 516, 360, 30, 16, C.body);
  addFoot(slide, '模拟数据｜原因合计96个，互斥且完整；比例由本次复核直接计算。');
}

function page3(slide) {
  addHeader(slide, '建议先试行统一申请入口，因其直接对应主要阻塞且投入可控', '方案取舍');
  addText(slide, 'p3-sub', '三种应对措施的投入与周期均为内部方案估计，不能换算为已验证的响应改善。', 55, 252, 1170, 28, 15, C.body);
  const x0 = 55, top = 302, gap = 18, colW = 368;
  const opts = [
    { key: 'A', name: '临时增加值班', fill: '#F5F7F9', accent: C.muted, action: '人工响应排队', effort: '8人日', cycle: '1周', maintain: '每周2人日值班', dep: '可调配值班人员', limit: '不直接解决材料缺失' },
    { key: 'B', name: '统一申请入口', fill: C.paleBlue, accent: C.blue, action: '字段与授权校验', effort: '12人日', cycle: '2周', maintain: '每周0.5人日规则维护', dep: '三类请求字段达成一致', limit: '不消除复杂需求沟通' },
    { key: 'C', name: '批量自动预检', fill: '#F7EDE5', accent: C.orange, action: '材料格式检查', effort: '30人日', cycle: '6周', maintain: '每周1人日规则维护', dep: '稳定字段及机器规则', limit: '不替代人工授权判断' },
  ];
  opts.forEach((o, i) => {
    const x = x0 + i * (colW + gap);
    addRect(slide, `p3-${o.key}-bg`, x, top, colW, 284, o.fill, o.key === 'B' ? C.blue : C.line, true);
    addText(slide, `p3-${o.key}-key`, o.key, x + 20, top + 18, 36, 34, 24, o.accent, { bold: true, typeface: DISPLAY });
    addText(slide, `p3-${o.key}-name`, o.name, x + 66, top + 20, 270, 26, 18, C.dark, { bold: true });
    if (o.key === 'B') addPill(slide, 'p3-recommend', '建议先试行', x + 210, top + 46, 120, C.blue, '#FFFFFF');
    addRule(slide, `p3-${o.key}-rule`, x + 20, top + 62, colW - 40, C.line, 1);
    const rows = [
      ['直接作用', o.action], ['初期投入', o.effort], ['上线周期', o.cycle], ['持续维护', o.maintain], ['当前依赖', o.dep], ['主要限制', o.limit],
    ];
    rows.forEach(([label, value], j) => {
      const y = top + 76 + j * 31;
      addText(slide, `p3-${o.key}-l-${j}`, label, x + 20, y, 75, 20, 13, C.muted, { bold: true });
      addText(slide, `p3-${o.key}-v-${j}`, value, x + 98, y, 245, 25, 14, j === 1 || j === 2 ? o.accent : C.body, { bold: j === 1 || j === 2 });
    });
  });
  addRect(slide, 'p3-decision', 55, 590, 1170, 35, C.paleGreen, C.paleGreen, true);
  addText(slide, 'p3-decision-text', '决策条件：先试行B；高峰期保留A应急；C待入口规则稳定后再评估。B尚未实施，不能宣称已有改善或承诺消除全部阻塞。', 76, 597, 1125, 20, 14, C.green, { bold: true });
  addFoot(slide, '模拟方案估计｜“人日”仅表示实施工作量；持续维护为周期性投入。');
}

function page4(slide) {
  addHeader(slide, '六周试点应以数据完整和规则可用为门槛，再决定是否扩围', '试点计划');
  addText(slide, 'p4-sub', '阶段有前后依赖；第3—4周只覆盖数据提取请求，评估通过后才考虑扩展到另外两类。', 55, 252, 1170, 28, 15, C.body);
  const stages = [
    { week: '第1—2周', title: '统一字段与责任', body: '负责人联合三类经办人\n形成字段字典、授权清单、统一入口', gate: '三类请求完成一轮实际样本填写检查，且无关键必填缺失', fill: C.paleBlue, accent: C.blue },
    { week: '第3—4周', title: '小范围试用', body: '仅在数据提取请求中试用\n保存缺失字段、退回原因、首次响应记录', gate: '记录完整且无阻断提交的高频规则错误；否则回到字段/规则修订', fill: '#F7EDE5', accent: C.orange },
    { week: '第5—6周', title: '复核后决定扩围', body: '负责人复核试点数据\n再决定是否覆盖数据清洗、权限开通', gate: '同时看首响比例、材料退回比例、经办人维护时间；目标值由基线确定', fill: C.paleGreen, accent: C.green },
  ];
  const xs = [55, 441, 827];
  stages.forEach((s, i) => {
    const x = xs[i];
    addRect(slide, `p4-stage-${i}`, x, 304, 350, 234, s.fill, s.accent, true);
    addText(slide, `p4-week-${i}`, s.week, x + 22, 322, 105, 24, 16, s.accent, { bold: true });
    addText(slide, `p4-title-${i}`, s.title, x + 22, 354, 300, 28, 19, C.dark, { bold: true });
    addText(slide, `p4-body-${i}`, s.body, x + 22, 396, 300, 58, 16, C.body);
    addRule(slide, `p4-rule-${i}`, x + 22, 466, 300, s.accent, 2);
    addText(slide, `p4-gate-label-${i}`, '进入下一阶段的条件', x + 22, 480, 300, 20, 13, s.accent, { bold: true });
    addText(slide, `p4-gate-${i}`, s.gate, x + 22, 502, 300, 30, 13, C.body);
    if (i < 2) addText(slide, `p4-arrow-${i}`, '→', x + 354, 402, 28, 28, 25, C.blue, { bold: true, align: 'center' });
  });
  addRect(slide, 'p4-bottom', 55, 554, 1122, 62, '#FFFFFF', C.line, true);
  addText(slide, 'p4-metrics-label', '统一评估口径', 76, 568, 125, 22, 15, C.blue, { bold: true });
  addText(slide, 'p4-metrics-1', '两个工作日内响应比例', 220, 568, 220, 22, 15, C.dark, { bold: true });
  addText(slide, 'p4-metrics-2', '材料退回比例', 510, 568, 150, 22, 15, C.dark, { bold: true });
  addText(slide, 'p4-metrics-3', '经办人维护时间', 730, 568, 165, 22, 15, C.dark, { bold: true });
  addText(slide, 'p4-metrics-note', '目标值由试点基线确定', 930, 568, 220, 22, 14, C.muted, { bold: true });
  addFoot(slide, '模拟计划｜第3—4周发现高频规则错误时回到字段与规则修订；未预设未经论证的百分比目标。');
}

async function createPreflight() {
  const test = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = test.slides.add();
  addText(slide, 'preflight-title', '最长标题：建议先试行统一申请入口，因其直接对应主要阻塞且投入可控', 55, 100, 1170, 42, 21, C.dark, { bold: true });
  addText(slide, 'preflight-narrow', '两位编号 04｜字段字典与授权清单｜≤2工作日｜数据提取', 55, 190, 280, 90, 18, C.body);
  addText(slide, 'preflight-mixed', '中英文混排：Response ≤ 2 working days；模拟数据。', 55, 320, 620, 35, 18, C.body);
  await fs.mkdir(preflightDir, { recursive: true });
  await writeBlob(path.join(preflightDir, 'text-preflight.png'), await test.export({ slide, format: 'png', scale: 1 }));
}

async function main() {
  await fs.mkdir(qaDir, { recursive: true });
  await createPreflight();
  const pages = [
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '请求量翻倍后，首响及时率降至60%' }, meta: { sectionName: '运行观察' }, intent: { intentId: 'run-b-page-1' }, decision: { selectedAssetId: 'manual-evidence-view' } },
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '4月未达标请求中，材料与权限阻塞占75%' }, meta: { sectionName: '原因复核' }, intent: { intentId: 'run-b-page-2' }, decision: { selectedAssetId: 'manual-cause-view' } },
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '建议先试行统一申请入口，因其直接对应主要阻塞且投入可控' }, meta: { sectionName: '方案取舍' }, intent: { intentId: 'run-b-page-3' }, decision: { selectedAssetId: 'manual-comparison-view' } },
    { payload: { assetId: 'northeastern-university-body-001', parameters: {} }, content: { title: '六周试点应以数据完整和规则可用为门槛，再决定是否扩围' }, meta: { sectionName: '试点计划' }, intent: { intentId: 'run-b-page-4' }, decision: { selectedAssetId: 'manual-sequence-view' } },
  ];
  const starterPptx = path.join(here, '.runtime', 'starter.pptx');
  await fs.mkdir(path.dirname(starterPptx), { recursive: true });
  const { presentation, slides } = await createNortheasternUniversityStarter({ starterPptx, pages, manuscriptSource: 'inputs/manuscript.txt（模拟数据）' });
  [page1, page2, page3, page4].forEach((fn, i) => fn(slides[i]));
  for (let i = 0; i < slides.length; i += 1) {
    await writeBlob(path.join(qaDir, `slide-${String(i + 1).padStart(2, '0')}.png`), await presentation.export({ slide: slides[i], format: 'png', scale: 1 }));
    await fs.writeFile(path.join(qaDir, `slide-${String(i + 1).padStart(2, '0')}.layout.json`), await (await slides[i].export({ format: 'layout' })).text(), 'utf8');
  }
  await writeBlob(path.join(qaDir, 'montage.webp'), await presentation.export({ format: 'webp', montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  console.log(JSON.stringify({ outputPptx, qaDir, slideCount: slides.length }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
