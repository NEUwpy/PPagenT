import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { invokeStructure } from '../../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
import { northeasternUniversitySkin } from '../../../src/runtime/skins/northeastern-university-contract.mjs';
import { loadRules } from '../../../src/runtime/rules-loader.mjs';

const ROOT = path.resolve('../../../');
const RUN = path.resolve('.');
const OUT = path.join(RUN, 'deck.pptx');
const EVIDENCE = path.join(RUN, 'invoke-evidence.ndjson');

const C = {
  blue: '#315F91',
  blueDark: '#244A73',
  blueLight: '#EAF1F8',
  bluePale: '#F4F7FA',
  ink: '#2B2B2B',
  body: '#404040',
  muted: '#6F6F6F',
  line: '#C9D5E1',
  white: '#FFFFFF',
  amber: '#B77A2A',
  amberPale: '#FBF4E8',
  green: '#3F7656',
  greenPale: '#EDF5EF',
};

function addText(slide, name, text, left, top, width, height, size = 18, color = C.body, opts = {}) {
  const s = slide.shapes.add({
    geometry: 'textbox', name,
    position: { left, top, width, height },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 },
  });
  s.text = text;
  s.text.style = {
    fontSize: size, color, typeface: opts.typeface ?? northeasternUniversitySkin.typographyRoles.bodyTypeface,
    bold: opts.bold ?? false, alignment: opts.align ?? 'left',
    verticalAlignment: opts.valign ?? 'top', wrap: 'square', autoFit: 'none',
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return s;
}

function addBox(slide, name, left, top, width, height, fill, line = C.line, radius = 10) {
  return slide.shapes.add({
    geometry: 'roundRect', name, position: { left, top, width, height },
    fill, line: { style: 'solid', fill: line, width: 1 }, borderRadius: radius,
  });
}

function addRect(slide, name, left, top, width, height, fill, line = 'none', rotation = 0) {
  return slide.shapes.add({ geometry: 'rect', name, position: { left, top, width, height, rotation }, fill,
    line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 } });
}

function addLine(slide, name, left, top, width, height, color = C.line, widthPx = 2, style = 'solid') {
  return slide.shapes.add({ geometry: 'line', name, position: { left, top, width, height }, fill: 'none', line: { style, fill: color, width: widthPx } });
}

function addPoly(slide, name, left, top, width, height, commands, fill, line = 'none') {
  return slide.shapes.add({ geometry: 'custom', name, position: { left, top, width, height },
    customPaths: [{ width, height, commands }], fill, line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 } });
}

function addHeader(slide, pageNo, title, kicker) {
  slide.background.fill = C.white;
  addText(slide, `page-${pageNo}`, String(pageNo).padStart(2, '0'), 55, 31, 42, 28, 16, C.blue, { bold: true });
  addText(slide, `kicker-${pageNo}`, kicker, 102, 31, 250, 28, 14, C.muted, { bold: true });
  addText(slide, `title-${pageNo}`, title, 55, 93, 1140, 46, 32, C.ink, { bold: true, typeface: northeasternUniversitySkin.typographyRoles.displayTypeface });
  addLine(slide, `title-rule-${pageNo}`, 55, 150, 1170, 0, C.blue, 2);
}

function addFooter(slide, pageNo) {
  addLine(slide, `footer-rule-${pageNo}`, 55, 681, 1170, 0, C.line, 1);
  addText(slide, `footer-${pageNo}`, '模拟测试材料｜不代表东北大学实际情况', 55, 687, 500, 18, 12, C.muted);
  addText(slide, `footer-no-${pageNo}`, String(pageNo), 1192, 687, 30, 18, 12, C.muted, { align: 'right' });
}

function addNote(slide, text) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- 模拟稿：大学共享实验平台预约改进试点（本页内容与数字均为虚构测试材料）\n\n${text}`);
  slide.speakerNotes.setVisible(true);
}

function stageRiver(slide, frame) {
  const x = frame.left + 24; const y = frame.top + 98;
  const h = 132;
  const parts = [
    { x, w: 230, fill: '#DDEAF4', label: '准备', body: '责任名单\n记录清单' },
    { x: x + 210, w: 260, fill: '#B9D1E5', label: '小范围试行', body: '两间自愿实验室\n预约台账可追溯' },
    { x: x + 450, w: 285, fill: '#86AFCF', label: '复盘', body: '完整性＋责任确认\n满足后才讨论扩围' },
  ];
  const shapes = [];
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    const nextW = i === parts.length - 1 ? 190 : parts[i + 1].w;
    const cmds = [
      { moveTo: { x: 0, y: 24 } }, { lineTo: { x: p.w - 24, y: 24 } },
      { lineTo: { x: nextW, y: 108 } }, { lineTo: { x: 24, y: 108 } }, { close: {} },
    ];
    shapes.push(addPoly(slide, `river-${i + 1}`, p.x, y, p.w, h, cmds, p.fill));
    addText(slide, `river-title-${i + 1}`, p.label, p.x + 25, y + 42, p.w - 55, 24, 21, C.ink, { bold: true, align: 'center' });
    addText(slide, `river-body-${i + 1}`, p.body, p.x + 26, y + 71, p.w - 70, 46, 16, C.body, { align: 'center' });
  }
  const gates = [
    { x: x + 202, label: '责任明确', sub: '未满足→补责任→复核' },
    { x: x + 442, label: '记录完整', sub: '未满足→补记录→复核' },
  ];
  for (let i = 0; i < gates.length; i += 1) {
    const g = gates[i];
    const gate = addRect(slide, `gate-${i + 1}`, g.x, y + 35, 14, 86, C.blueDark, 'none', 0);
    gate.shadow = 'shadow-sm';
    addText(slide, `gate-label-${i + 1}`, g.label, g.x - 47, y + 6, 110, 22, 14, C.blueDark, { bold: true, align: 'center' });
    addText(slide, `gate-sub-${i + 1}`, g.sub, g.x - 72, y + 137, 170, 38, 12, C.muted, { align: 'center' });
  }
  addText(slide, 'river-direction', '满足条件才向右推进', x + 548, y + 183, 190, 22, 13, C.blueDark, { bold: true, align: 'right' });
  return shapes;
}

async function buildPage1({ slide, frame }) {
  addBox(slide, 'evidence-box-1', 890, 270, 315, 228, C.bluePale, C.line, 12);
  addText(slide, 'evidence-head-1', '旧预约抽查｜仅说明记录缺口', 914, 292, 260, 28, 18, C.blueDark, { bold: true });
  addText(slide, 'evidence-big-1', '7', 920, 340, 75, 58, 48, C.blue, { bold: true, align: 'center' });
  addText(slide, 'evidence-big-2', '5', 1048, 340, 75, 58, 48, C.blue, { bold: true, align: 'center' });
  addText(slide, 'evidence-label-1', '缺审批时间', 900, 397, 115, 24, 15, C.body, { align: 'center' });
  addText(slide, 'evidence-label-2', '缺执行记录', 1030, 397, 115, 24, 15, C.body, { align: 'center' });
  addText(slide, 'evidence-note-1', '两类可能重叠，不能相加为 12 笔问题预约。', 914, 438, 270, 42, 14, C.muted);
  addBox(slide, 'pause-box-1', 890, 520, 315, 92, C.amberPale, '#E7C997', 12);
  addText(slide, 'pause-head-1', '授权问题出现时', 912, 538, 250, 22, 16, C.amber, { bold: true });
  addText(slide, 'pause-body-1', '暂停相关预约；授权确认后恢复，不停止全部试点。', 912, 566, 265, 35, 14, C.body);
  await invokeStructure({ root: ROOT, slide, skin: northeasternUniversitySkin,
    targetFrame: { left: 72, top: 252, width: 790, height: 292 },
    content: { phases: ['准备', '小范围试行', '复盘'], gates: ['责任明确', '记录完整'] },
    references: [{ assetId: 'sequence-phase-gates-004', preservedFeatures: ['蜿蜒收窄的箭形河道与阅读方向', '横跨河道的阶段门闸拓扑', '阶段失败后补齐再复核的门禁语义'], changes: ['按大学 Skin 蓝灰色阶适配', '将证据与暂停边界放入结构外侧说明区'] }],
    evidencePath: EVIDENCE, pageId: 'slide-01', regionId: 'pilot-gate-river', reason: '表达准备→试行→复盘及未满足条件时补齐后复核的放行关系',
    async build() { stageRiver(slide, frame); return { objectPlan: 'native-river-gates' }; },
  });
}

function causalRibbon(slide, frame) {
  const x = frame.left + 46; const y = frame.top + 118;
  const ribbon = addPoly(slide, 'causal-ribbon', x, y + 30, 760, 172,
    [{ moveTo: { x: 0, y: 122 } }, { lineTo: { x: 660, y: 0 } }, { lineTo: { x: 760, y: 36 } }, { lineTo: { x: 90, y: 172 } }, { close: {} }], '#D8E7F2');
  addPoly(slide, 'causal-ribbon-top', x, y + 30, 760, 172,
    [{ moveTo: { x: 0, y: 122 } }, { lineTo: { x: 660, y: 0 } }, { lineTo: { x: 698, y: 18 } }, { lineTo: { x: 36, y: 142 } }, { close: {} }], '#93B8D5');
  const nodes = [
    { cx: x + 165, cy: y + 120, title: '反复追问', body: '管理员补充样品条件' },
    { cx: x + 360, cy: y + 88, title: '材料补齐', body: '补齐后才能进入审批' },
    { cx: x + 555, cy: y + 54, title: '等待增加', body: '待检验机制假设' },
  ];
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    const c = slide.shapes.add({ geometry: 'ellipse', name: `causal-node-${i + 1}`, position: { left: n.cx - 34, top: n.cy - 34, width: 68, height: 68 }, fill: C.white, line: { style: 'solid', fill: C.blue, width: 4 }, shadow: 'shadow-sm' });
    addText(slide, `causal-node-title-${i + 1}`, n.title, n.cx - 62, n.cy + 41, 124, 24, 16, C.blueDark, { bold: true, align: 'center' });
    addText(slide, `causal-node-body-${i + 1}`, n.body, n.cx - 84, n.cy + 67, 168, 32, 13, C.muted, { align: 'center' });
    if (i < nodes.length - 1) addLine(slide, `causal-link-${i + 1}`, n.cx + 35, n.cy - 40, 125, 24, C.blueDark, 2);
  }
  addText(slide, 'causal-start', '申请字段不全', x - 4, y + 184, 170, 24, 18, C.ink, { bold: true });
  addText(slide, 'causal-start-note', '机制假设起点', x + 6, y + 210, 150, 20, 13, C.muted);
}

async function buildPage2({ slide, frame }) {
  addBox(slide, 'device-path', 820, 350, 365, 154, C.amberPale, '#E7C997', 12);
  addText(slide, 'device-path-head', '另一条路径：设备时段不足', 845, 374, 300, 26, 18, C.amber, { bold: true });
  addText(slide, 'device-path-body', '即使材料完整，也可能直接增加等待。\n不归为申请字段问题。', 845, 411, 300, 50, 16, C.body);
  addText(slide, 'device-path-tag', '独立路径', 1045, 469, 100, 20, 13, C.amber, { bold: true, align: 'right' });
  addBox(slide, 'validation-box-2', 55, 546, 1130, 82, C.bluePale, C.line, 12);
  addText(slide, 'validation-head-2', '验证链条', 78, 563, 110, 22, 16, C.blueDark, { bold: true });
  addText(slide, 'validation-body-2', '台账分别记录首次提交、材料补齐、审批完成、执行时间，并记录设备等待；复盘时区分两种等待。访谈 4/6 与 3/6 只能作为观察线索，不能推出总体发生率。', 188, 560, 960, 42, 15, C.body);
  await invokeStructure({ root: ROOT, slide, skin: northeasternUniversitySkin,
    targetFrame: { left: 72, top: 268, width: 750, height: 260 },
    content: { trigger: '申请字段不全', mediators: ['反复追问', '材料补齐', '审批等待'], outcome: '等待增加' },
    references: [{ assetId: 'causal-mediator-chain-003', preservedFeatures: ['近端隐式起势', '单条有顶面与侧面的上升箭带', '圆形节点与阶梯说明块成对连接'], changes: ['将箭带压缩到左侧主区', '把设备等待作为结构外独立路径', '在底部加入验证台账说明'] }],
    evidencePath: EVIDENCE, pageId: 'slide-02', regionId: 'mechanism-ribbon', reason: '区分申请字段机制假设与设备时段独立路径，并保留验证链条',
    async build() { causalRibbon(slide, frame); return { objectPlan: 'native-causal-ribbon' }; },
  });
}

function compareStructure(slide) {
  const left = 90; const top = 270; const cardW = 475; const gap = 150; const right = left + cardW + gap;
  slide.shapes.add({ geometry: 'ellipse', name: 'compare-platform', position: { left: 170, top: 528, width: 940, height: 56 }, fill: '#D5E1EC', line: { style: 'solid', fill: 'none', width: 0 } });
  addBox(slide, 'compare-left-shell', left, top, cardW, 290, C.bluePale, C.line, 14);
  addBox(slide, 'compare-right-shell', right, top, cardW, 290, C.greenPale, '#B7D5C1', 14);
  addBox(slide, 'compare-left-head', left, top, cardW, 58, C.blue, C.blue, 14);
  addBox(slide, 'compare-right-head', right, top, cardW, 58, C.green, C.green, 14);
  addText(slide, 'compare-left-title', '全面补历史记录', left + 24, top + 14, cardW - 48, 28, 22, C.white, { bold: true });
  addText(slide, 'compare-right-title', '先规范新增记录', right + 24, top + 14, cardW - 48, 28, 22, C.white, { bold: true });
  addBox(slide, 'vs-ring', 626, 363, 60, 60, C.white, C.blue, 30);
  addText(slide, 'vs-label', 'VS', 626, 380, 60, 24, 17, C.blueDark, { bold: true, align: 'center' });
  const rows = [
    ['投入方式', '追查旧文件与人员记忆', '随新增任务发生'],
    ['可追溯性', '可覆盖旧结果；缺上下文难补', '生成时保留来源、脚本、参数、输出'],
    ['启动条件', '先明确追溯对象与可用资料', '先约定责任人和最小清单'],
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const yy = top + 83 + i * 66;
    addText(slide, `compare-dim-${i + 1}`, rows[i][0], 526, yy + 15, 130, 22, 14, C.muted, { bold: true, align: 'center' });
    addLine(slide, `compare-row-${i + 1}`, 108, yy + 58, 1040, 0, C.line, 1);
    addText(slide, `compare-l-${i + 1}`, rows[i][1], left + 25, yy + 12, cardW - 50, 42, 15, C.body);
    addText(slide, `compare-r-${i + 1}`, rows[i][2], right + 25, yy + 12, cardW - 50, 42, 15, C.body);
  }
}

async function buildPage3({ slide, frame }) {
  await invokeStructure({ root: ROOT, slide, skin: northeasternUniversitySkin,
    targetFrame: { left: 82, top: 255, width: 1115, height: 350 },
    content: { sides: ['全面补历史记录', '先规范新增记录'], dimensions: ['投入方式', '可追溯性', '启动条件'] },
    references: [{ assetId: 'comparison-dual-verdict-001', preservedFeatures: ['两个镜像比较舱、中央比较节点和连续中缝', '底部低矮椭圆平台共同收束两侧', '两侧对应要点严格共线', '颜色、符号、标题帽和要点承载面共同表达正负语义'], changes: ['将三行比较维度置于同一水平扫描轴', '把推荐与历史代价放入页底说明区', '增加独立职责行，避免误读为三级审批流程'] }],
    evidencePath: EVIDENCE, pageId: 'slide-03', regionId: 'plan-comparison', reason: '按投入方式、可追溯性、启动条件比较两方案，并落到先试新增记录的建议与代价',
    async build() { compareStructure(slide); return { objectPlan: 'native-mirrored-comparison' }; },
  });
  addBox(slide, 'recommendation-3', 90, 585, 1090, 56, C.blue, C.blue, 10);
  addText(slide, 'recommendation-head-3', '建议先试新增记录', 112, 600, 205, 24, 19, C.white, { bold: true });
  addText(slide, 'recommendation-body-3', '对已有明确追溯需求的历史结果定向补齐；代价是历史覆盖仍不完整。', 340, 600, 800, 24, 16, C.white);
  addText(slide, 'roles-3', '分工：研究人员提交｜管理员核对清单｜平台负责人处理跨实验室责任争议', 90, 650, 1000, 20, 14, C.muted);
}

async function main() {
  await fs.writeFile(path.join(RUN, 'rules-runtime-check.txt'), JSON.stringify(await loadRules(ROOT, { profile: 'generation', skin: 'northeastern-university-001' }), null, 2), 'utf8');
  await fs.rm(EVIDENCE, { force: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const s1 = presentation.slides.add(); addHeader(s1, 1, '试点应分阶段推进，扩围以记录完整和责任确认为条件', '预约试点｜推进边界'); addText(s1, 'lead-1', '首轮先验证记录和责任能否执行；目前没有等待时间改善的证据。', 55, 188, 1140, 30, 19, C.body); addFooter(s1, 1); addNote(s1, '第一页保留阶段顺序、门禁条件、20 笔抽查的重叠限制及授权暂停边界。'); await buildPage1({ slide: s1, frame: northeasternUniversitySkin.bodyFrame });
  const s2 = presentation.slides.add(); addHeader(s2, 2, '信息缺口可能拉长等待，试点需要保留验证链条', '预约试点｜机制与证据'); addText(s2, 'lead-2', '待检验机制：申请字段不全 → 反复补充材料 → 审批等待增加。', 55, 188, 1140, 30, 19, C.body); addText(s2, 'hypothesis-2', '这是机制假设，不是已证实因果。', 55, 220, 400, 22, 15, C.amber, { bold: true }); addFooter(s2, 2); addNote(s2, '第二页区分申请字段机制假设、设备时段独立路径与访谈线索，保留可验证台账字段。'); await buildPage2({ slide: s2, frame: northeasternUniversitySkin.bodyFrame });
  const s3 = presentation.slides.add(); addHeader(s3, 3, '先规范新增记录更易启动，但必须接受历史覆盖不完整', '预约试点｜方案取舍'); addText(s3, 'lead-3', '两方案按同一三个维度比较，再把建议、代价和职责落到执行。', 55, 188, 1140, 30, 19, C.body); addFooter(s3, 3); addNote(s3, '第三页保持投入方式、可追溯性、启动条件三维对应，并明确职责不是先后审批三级。'); await buildPage3({ slide: s3, frame: northeasternUniversitySkin.bodyFrame });
  const pptx = await PresentationFile.exportPptx(presentation); await pptx.save(OUT);
  for (const [idx, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(idx + 1).padStart(2, '0')}`;
    await fs.writeFile(path.join(RUN, `${stem}.layout.json`), await (await slide.export({ format: 'layout' })).text(), 'utf8');
  }
  const inspect = await presentation.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 60000 });
  await fs.writeFile(path.join(RUN, 'inspect.ndjson'), inspect.ndjson, 'utf8');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
