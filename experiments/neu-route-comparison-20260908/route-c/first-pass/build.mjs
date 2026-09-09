import fs from 'node:fs/promises';
import path from 'node:path';
import { PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../../src/runtime/skins/northeastern-university.mjs';
import { northeasternUniversitySkin } from '../../../src/runtime/skins/northeastern-university-contract.mjs';

const root = path.resolve(process.cwd());
const outDir = path.join(root, 'experiments', 'neu-route-comparison-20260908', 'route-c');
const runtimeDir = path.join(outDir, '.runtime');
const starterPptx = path.join(runtimeDir, 'template-starter.pptx');
const outputPptx = path.join(outDir, 'deck.pptx');
const source = 'experiments/neu-route-comparison-20260908/route-c/inputs/manuscript.txt';
const bodyFrame = northeasternUniversitySkin.bodyFrame;
const theme = northeasternUniversitySkin.componentTheme;
const font = northeasternUniversitySkin.typographyRoles.bodyTypeface;
const displayFont = northeasternUniversitySkin.typographyRoles.displayTypeface;

const C = {
  ink: theme.dark,
  body: theme.body,
  muted: theme.muted,
  primary: theme.primaryColor,
  pale: `${theme.primaryColor}/12`,
  pale2: `${theme.primaryColor}/22`,
  line: `${theme.primaryColor}/30`,
  white: theme.surface,
  risk: '#A53B3B',
  good: '#477B5A',
};

function addText(slide, text, position, style = {}, name) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name,
    position,
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: font,
    fontSize: 18,
    color: C.body,
    autoFit: 'none',
    verticalAlignment: 'top',
    ...style,
  };
  return shape;
}

function addRect(slide, position, fill = C.white, line = C.line, name) {
  return slide.shapes.add({
    geometry: 'rect',
    name,
    position,
    fill,
    line: { style: 'solid', fill: line, width: 1 },
  });
}

function addRule(slide, position, color = C.line, name) {
  return slide.shapes.add({
    geometry: 'rect',
    name,
    position,
    fill: color,
    line: { style: 'solid', fill: color, width: 0 },
  });
}

function addSmallLabel(slide, text, left, top, width = 150) {
  addText(slide, text, { left, top, width, height: 22 }, {
    fontSize: 14,
    bold: true,
    color: C.primary,
    typeface: font,
  });
}

function addSourceBand(slide, text) {
  addText(slide, text, { left: bodyFrame.left, top: 635, width: bodyFrame.width, height: 25 }, {
    fontSize: 12,
    color: C.muted,
    typeface: font,
  }, 'source-band');
}

function addSimulatedTag(slide) {
  addText(slide, '模拟数据｜排版验证稿，不代表真实运行', { left: 1040, top: 183, width: 185, height: 22 }, {
    fontSize: 12,
    color: C.muted,
    alignment: 'right',
  }, 'simulated-data-tag');
}

function addTitleGuide(slide, text, left, top, width) {
  addText(slide, text, { left, top, width, height: 26 }, {
    fontSize: 16,
    color: C.muted,
    typeface: font,
  });
}

function addLineChart(slide, config) {
  const chart = slide.charts.add('line', {
    position: config.position,
    categories: config.categories,
    series: config.series,
    hasLegend: false,
    showTitle: false,
    showValue: false,
    yAxis: {
      majorGridlines: { style: 'solid', fill: `${C.muted}/20`, width: 1 },
      minimum: config.minimum,
      maximum: config.maximum,
      majorUnit: config.majorUnit,
    },
    xAxis: { majorGridlines: { style: 'solid', fill: 'none', width: 0 } },
  });
  return chart;
}

function addColumnChart(slide, config) {
  return slide.charts.add('line', {
    position: config.position,
    categories: config.categories,
    series: config.series,
    hasLegend: false,
    showTitle: false,
    dataLabels: { showValue: true, position: 'outEnd' },
    yAxis: {
      majorGridlines: { style: 'solid', fill: `${C.muted}/20`, width: 1 },
      minimum: config.minimum,
      maximum: config.maximum,
      majorUnit: config.majorUnit,
    },
    xAxis: { majorGridlines: { style: 'solid', fill: 'none', width: 0 } },
  });
}

function drawSlide1(slide) {
  addSimulatedTag(slide);
  addSmallLabel(slide, 'C14 · TREND', bodyFrame.left, 184);
  addText(slide, '1—4月工作量翻倍后，两日内首次响应比例降至60%', { left: 70, top: 214, width: 730, height: 36 }, {
    fontSize: 24,
    bold: true,
    color: C.ink,
    typeface: displayFont,
  }, 'slide-1-claim');
  addText(slide, '响应压力同步上升，但仅凭观察不能把工作量增长认定为唯一原因。', { left: 70, top: 253, width: 720, height: 28 }, {
    fontSize: 17,
    color: C.body,
  });
  addRect(slide, { left: 70, top: 300, width: 540, height: 260 }, C.white, C.line, 'response-rate-exhibit');
  addRect(slide, { left: 645, top: 300, width: 540, height: 260 }, C.white, C.line, 'median-time-exhibit');
  addTitleGuide(slide, '两日内首次给出可执行答复（比例）', 95, 320, 440);
  addTitleGuide(slide, '首次响应中位时间（工作日）', 670, 320, 420);
  addLineChart(slide, {
    position: { left: 100, top: 355, width: 480, height: 165 },
    categories: ['1月', '2月', '3月', '4月'],
    series: [{ name: '响应比例', values: [80, 76, 70, 60], fill: C.primary }],
    minimum: 0, maximum: 100, majorUnit: 20,
  });
  addLineChart(slide, {
    position: { left: 675, top: 355, width: 480, height: 165 },
    categories: ['1月', '2月', '3月', '4月'],
    series: [{ name: '中位时间', values: [1.3, 1.5, 1.8, 2.4], fill: C.primary }],
    minimum: 0, maximum: 3, majorUnit: 1,
  });
  addText(slide, '120 → 240 件／月', { left: 100, top: 525, width: 230, height: 24 }, { fontSize: 15, bold: true, color: C.primary });
  addText(slide, '1.3 → 2.4 个工作日', { left: 675, top: 525, width: 250, height: 24 }, { fontSize: 15, bold: true, color: C.primary });
  addSourceBand(slide, '口径：当月收到的请求，观察结案后是否在两个工作日内首次给出可执行答复；该指标不是结案时长。每月无缺失记录。');
}

function drawSlide2(slide) {
  addSimulatedTag(slide);
  addSmallLabel(slide, 'C16 · COMPOSITION', bodyFrame.left, 184, 300);
  addText(slide, '4月未达标请求中，材料与权限问题占75%，入口规则是首要改善点', { left: 70, top: 214, width: 920, height: 36 }, {
    fontSize: 24,
    bold: true,
    color: C.ink,
    typeface: displayFont,
  }, 'slide-2-claim');
  addText(slide, '96个请求逐一复核，每个请求只记一个主要阻塞原因，彼此互斥且合计完整。', { left: 70, top: 253, width: 820, height: 28 }, { fontSize: 17 });
  const bar = { left: 100, top: 342, width: 790, height: 68 };
  addText(slide, '4月未达标请求（n=96）', { left: 100, top: 310, width: 250, height: 25 }, { fontSize: 18, bold: true, color: C.ink });
  const segments = [
    { label: '材料不全', count: 42, fill: C.primary },
    { label: '权限确认', count: 30, fill: `${C.primary}/70` },
    { label: '需求反复', count: 16, fill: `${C.primary}/45` },
    { label: '其他', count: 8, fill: `${C.primary}/25` },
  ];
  let x = bar.left;
  for (const segment of segments) {
    const w = bar.width * segment.count / 96;
    addRect(slide, { left: x, top: bar.top, width: w, height: bar.height }, segment.fill, segment.fill, `blocker-${segment.label}`);
    const segmentText = w < 90 ? `${segment.count}` : `${segment.label}\n${segment.count}（${Math.round(segment.count / 96 * 100)}%）`;
    addText(slide, segmentText, { left: x + 6, top: w < 90 ? bar.top + 22 : bar.top + 13, width: Math.max(w - 12, 34), height: 48 }, {
      fontSize: w > 150 ? 17 : (w < 90 ? 16 : 14),
      bold: true,
      color: segment.count >= 30 ? C.white : C.ink,
      alignment: 'center',
      verticalAlignment: 'middle',
    });
    x += w;
  }
  addRect(slide, { left: 945, top: 300, width: 255, height: 190 }, C.pale, C.line, 'implication-box');
  addText(slide, '这支持什么判断', { left: 970, top: 322, width: 190, height: 28 }, { fontSize: 20, bold: true, color: C.primary });
  addText(slide, '入口前置字段与授权校验，和主要阻塞环节直接对应。', { left: 970, top: 365, width: 190, height: 64 }, { fontSize: 17, color: C.ink });
  addText(slide, '但复核分类不等于干预可消除数量，也不能预测节省工时。', { left: 970, top: 438, width: 190, height: 45 }, { fontSize: 15, color: C.body });
  addRule(slide, { left: 100, top: 456, width: 790, height: 1 }, C.line);
  addText(slide, '材料不全：字段缺失或样本文件未附  ｜  权限确认：授权人或授权范围未确认  ｜  其他：8（8%）', { left: 100, top: 474, width: 1040, height: 28 }, { fontSize: 15, color: C.body });
  addSourceBand(slide, '证据性质：4月未达标请求的互斥复核分类；不是因果实验，也不是方案效果预测。');
}

function drawSlide3(slide) {
  addSimulatedTag(slide);
  addSmallLabel(slide, 'C09 · MULTI-OPTION COMPARISON', bodyFrame.left, 184, 300);
  addText(slide, 'B统一申请入口最贴近主要阻塞，但需先完成三类请求字段共识', { left: 70, top: 214, width: 930, height: 36 }, {
    fontSize: 24,
    bold: true,
    color: C.ink,
    typeface: displayFont,
  }, 'slide-3-claim');
  addText(slide, '投入与周期均为内部方案估计，不能与后续响应改善直接换算。', { left: 70, top: 253, width: 720, height: 28 }, { fontSize: 17 });
  const x0 = 70, y0 = 305, rowH = 38, labelW = 190, colW = 300;
  const cols = [
    { name: 'A 临时增加值班', fill: `${C.muted}/10`, color: C.ink },
    { name: 'B 统一申请入口', fill: C.pale, color: C.primary },
    { name: 'C 批量自动预检', fill: `${C.primary}/10`, color: C.ink },
  ];
  addRect(slide, { left: x0, top: y0, width: labelW, height: rowH }, C.white, C.line);
  addText(slide, '比较项', { left: x0 + 12, top: y0 + 12, width: labelW - 24, height: 20 }, { fontSize: 17, bold: true, color: C.ink });
  cols.forEach((col, i) => {
    const left = x0 + labelW + i * colW;
    addRect(slide, { left, top: y0, width: colW, height: rowH }, col.fill, C.line);
    addText(slide, col.name, { left: left + 10, top: y0 + 11, width: colW - 20, height: 22 }, { fontSize: 17, bold: true, color: col.color, alignment: 'center' });
  });
  const rows = [
    ['直接作用环节', '人工响应排队', '提交时字段与授权校验', '重复性材料格式检查'],
    ['初期投入', '8人日', '12人日', '30人日'],
    ['预计上线周期', '1周', '2周', '6周'],
    ['持续维护', '每周2人日值班', '每周0.5人日规则维护', '每周1人日规则维护'],
    ['当前依赖', '可调配值班人员', '三类请求字段达成一致', '稳定字段及可机器判断的规则'],
    ['主要限制', '不直接解决材料缺失', '不消除复杂需求沟通', '不替代人工授权判断'],
  ];
  rows.forEach((row, r) => {
    const y = y0 + rowH + r * rowH;
    row.forEach((cell, c) => {
      const left = c === 0 ? x0 : x0 + labelW + (c - 1) * colW;
      const width = c === 0 ? labelW : colW;
      const fill = c === 2 ? C.pale : C.white;
      addRect(slide, { left, top: y, width, height: rowH }, fill, C.line);
      addText(slide, cell, { left: left + 10, top: y + 5, width: width - 20, height: 28 }, {
        fontSize: c === 0 ? 14 : 15,
        bold: c === 0 || (c === 2 && (r === 1 || r === 2)),
        color: c === 2 ? C.primary : (c === 0 ? C.ink : C.body),
        verticalAlignment: 'middle',
        alignment: c === 0 ? 'left' : 'center',
      });
    });
  });
  addText(slide, '建议：先试行 B；保留 A 作为短期高峰应急；C 等入口规则稳定后再评估。', { left: 70, top: 574, width: 930, height: 30 }, { fontSize: 18, bold: true, color: C.primary });
  addSourceBand(slide, '方案状态：A/B/C均未实施；所有投入、周期和维护量均为内部估计，尚无效果证据。');
}

function drawSlide4(slide) {
  addSimulatedTag(slide);
  addSmallLabel(slide, 'C30 · ROADMAP', bodyFrame.left, 184);
  addText(slide, '六周试点先锁定字段，再验证数据提取，最后决定是否扩围', { left: 70, top: 214, width: 900, height: 36 }, {
    fontSize: 24,
    bold: true,
    color: C.ink,
    typeface: displayFont,
  }, 'slide-4-claim');
  addText(slide, '每一阶段都有进入条件；规则错误时回到字段和规则修订，而不是直接扩围。', { left: 70, top: 253, width: 840, height: 28 }, { fontSize: 17 });
  const boxes = [
    { x: 70, title: '第1—2周 统一入口', body: '负责人 + 三类经办人\n统一字段与授权责任\n形成字段字典、授权清单和入口', gate: '进入条件：三类请求完成一轮实际样本填写检查，无关键必填字段缺失。' },
    { x: 430, title: '第3—4周 数据提取试用', body: '只在数据提取请求试用\n保存缺失字段、退回原因、首次响应记录\n先验证记录是否完整', gate: '扩大条件：无阻断提交的高频规则错误；否则回到字段和规则修订。' },
    { x: 790, title: '第5—6周 复核后扩围', body: '负责人复核试点数据\n再决定是否扩到清洗、权限开通\n保留暂停与修订选项', gate: '评估：两日响应比例、材料退回比例、经办人维护时间。' },
  ];
  const shapes = [];
  for (const box of boxes) {
    const card = addRect(slide, { left: box.x, top: 315, width: 310, height: 210 }, box.x === 430 ? C.pale : C.white, C.line, `roadmap-${box.x}`);
    shapes.push(card);
    addText(slide, box.title, { left: box.x + 18, top: 334, width: 274, height: 26 }, { fontSize: 20, bold: true, color: box.x === 430 ? C.primary : C.ink });
    addText(slide, box.body, { left: box.x + 18, top: 374, width: 274, height: 84 }, { fontSize: 17, color: C.body });
    addText(slide, box.gate, { left: box.x + 18, top: 464, width: 274, height: 48 }, { fontSize: 14, color: C.muted });
  }
  addText(slide, '→', { left: 385, top: 382, width: 30, height: 34 }, { fontSize: 26, bold: true, color: C.primary, alignment: 'center' });
  addText(slide, '→', { left: 745, top: 382, width: 30, height: 34 }, { fontSize: 26, bold: true, color: C.primary, alignment: 'center' });
  addText(slide, '← 高频规则错误时回到第1—2周修订', { left: 430, top: 532, width: 330, height: 24 }, { fontSize: 14, color: C.risk, alignment: 'center' });
  addText(slide, '目标值根据试点基线确定；本稿不预设未经论证的百分比目标。', { left: 70, top: 574, width: 800, height: 28 }, { fontSize: 17, bold: true, color: C.ink });
  addSourceBand(slide, '计划性质：未来拟用六周完成有限试点；不是已发生结果，也不承诺消除所有材料与权限阻塞。');
}

const pages = [
  { content: { pageId: 'route-c-01', title: '1—4月工作量翻倍后，两日内首次响应比例降至60%' }, meta: { sectionName: '服务中心' }, payload: { assetId: 'route-c-body-001', parameters: {} }, intent: { intentId: 'route-c-C14-trend' }, decision: { selectedAssetId: 'route-c-body-001' } },
  { content: { pageId: 'route-c-02', title: '4月未达标请求中，材料与权限问题占75%，入口规则是首要改善点' }, meta: { sectionName: '服务中心' }, payload: { assetId: 'route-c-body-001', parameters: {} }, intent: { intentId: 'route-c-C16-composition' }, decision: { selectedAssetId: 'route-c-body-001' } },
  { content: { pageId: 'route-c-03', title: 'B统一申请入口最贴近主要阻塞，但需先完成三类请求字段共识' }, meta: { sectionName: '服务中心' }, payload: { assetId: 'route-c-body-001', parameters: {} }, intent: { intentId: 'route-c-C09-comparison' }, decision: { selectedAssetId: 'route-c-body-001' } },
  { content: { pageId: 'route-c-04', title: '六周试点先锁定字段，再验证数据提取，最后决定是否扩围' }, meta: { sectionName: '服务中心' }, payload: { assetId: 'route-c-body-001', parameters: {} }, intent: { intentId: 'route-c-C30-roadmap' }, decision: { selectedAssetId: 'route-c-body-001' } },
];

await fs.mkdir(runtimeDir, { recursive: true });
const { presentation, slides } = await createNortheasternUniversityStarter({
  starterPptx,
  pages,
  manuscriptSource: source,
});

drawSlide1(slides[0]);
drawSlide2(slides[1]);
drawSlide3(slides[2]);
drawSlide4(slides[3]);

const inspect = await presentation.inspect({ kind: 'slide,textbox,shape,chart,notes,layout', maxChars: 300000 });
await fs.writeFile(path.join(outDir, 'reference-snapshot.json'), inspect.ndjson ?? String(inspect), 'utf8');
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);

await fs.writeFile(path.join(outDir, 'slides.json'), JSON.stringify({
  presentation_mode: 'Executive Story / reading-first',
  source_boundary: source,
  slides: [
    { slide_id: 'S01', layout_id: 'C14', title: pages[0].content.title, question: '工作量与响应压力如何变化？', evidence: '四个月响应比例与中位时间趋势', limitation: '无对照实验' },
    { slide_id: 'S02', layout_id: 'C16', title: pages[1].content.title, question: '未达标请求主要卡在哪里？', evidence: '96个请求的互斥阻塞原因构成', limitation: '分类不等于可消除量' },
    { slide_id: 'S03', layout_id: 'C09', title: pages[2].content.title, question: '三种应对措施如何比较？', evidence: '统一维度的投入、周期、依赖与限制', limitation: '均为内部估计' },
    { slide_id: 'S04', layout_id: 'C30', title: pages[3].content.title, question: '如何把建议变成受控试点？', evidence: '六周阶段依赖、进入条件与回退路径', limitation: '目标值待试点基线确定' },
  ],
}, null, 2), 'utf8');

await fs.writeFile(path.join(outDir, 'charts.json'), JSON.stringify([
  { chart_id: 'CH01', slide_id: 'S01', question: '响应压力如何变化？', conclusion: '两日内响应比例从80%降至60%', family: 'time', subtype: 'line', unit: '%', period: '1—4月', sample: '每月当月收到请求', encoding: { x: 'month', y: 'response_rate', color: 'focal' }, focal_marks: ['4月'], annotations: ['120→240件/月', '1.3→2.4个工作日'], renderer: 'native-pptx', editability: 'native-chart', reconciliation: 'passed' },
  { chart_id: 'CH02', slide_id: 'S02', question: '未达标请求主要卡在哪里？', conclusion: '材料与权限阻塞占75%', family: 'part-to-whole', subtype: '100%-stacked-bar', unit: 'requests', period: '4月', sample: '96个未达标请求', encoding: { x: 'cause', y: 'count', color: 'cause' }, focal_marks: ['材料不全', '权限确认'], annotations: ['75%'], renderer: 'native-shapes', editability: 'native-shapes', reconciliation: '42+30+16+8=96' },
], null, 2), 'utf8');

console.log(JSON.stringify({ outputPptx, slides: slides.length, bodyFrame }, null, 2));
