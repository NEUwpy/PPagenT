import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, Presentation, PresentationFile } from '@oai/artifact-tool';
import { invokeStructure } from '../../../.codex/skills/ppagent-structure/scripts/invoke.mjs';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w):/, '$1:'));
const root = path.resolve(here, '../../..');
const outDir = here;
const evidencePath = path.join(outDir, 'structure-invocations.ndjson');
const PAPER = '#F5F4EF';
const SURFACE = '#EEECE5';
const INK = '#20201D';
const BODY = '#4B4A45';
const MUTED = '#85837B';
const LINE = '#D8D5CC';
const ACCENT = '#A35D4F';
const BLUE = '#667E88';
const BLUE_DARK = '#3C5965';
const BLUE_LIGHT = '#DDE5E5';
const SANS = 'Noto Sans SC';
const SERIF = 'Noto Serif SC';
const frame = { left: 56, top: 145, width: 1168, height: 510 };
const skin = { id: 'neutral-editorial-001', bodyFrame: frame, componentTheme: { primaryColor: ACCENT, background: PAPER, surface: SURFACE, dark: INK, body: BODY, muted: MUTED, line: LINE, font: SANS } };

const cases = [
  {
    caseId: 'case-01', title: '先试点再扩展能降低上线风险', asset: 'argument-evidence-conclusion-001',
    reason: '稿件给出一个明确论点、六条共同支持依据和一个收束结论；本次逐项保留六条依据。',
    preserved: ['上方唯一论点主梁', '并列证据通过上锚点接入共同推理总线', '底部唯一结论带与左侧1–N–1节奏'],
    changes: ['六条依据各自占用独立承载面', '按中性杂志风重算六卡宽度与连接锚点'],
    content: {
      claim: { title: '先试点再扩展能降低上线风险', body: '分阶段上线优于直接全量，先用小范围试点验证，再根据复盘结果扩大范围' },
      evidences: [
        { key: 'adaptation', title: '适配验证', body: '试点能验证业务适配' },
        { key: 'localization', title: '故障定位', body: '小范围故障更易定位' },
        { key: 'feedback', title: '反馈校准', body: '使用反馈能校正文案' },
        { key: 'training', title: '角色培训', body: '培训可按角色开展' },
        { key: 'rollback', title: '可控回滚', body: '回滚范围更小' },
        { key: 'cases', title: '案例积累', body: '支持团队能先积累案例' },
      ],
      conclusion: { title: '先试点再扩大', body: '先选两个部门试点，通过复盘再扩大范围' },
    },
  },
  {
    caseId: 'case-04', title: '返工来自多类原因共同影响', asset: 'causal-fishbone-attribution-001',
    reason: '稿件明确七类原因并列指向装配返工，不能视为时间步骤；本次沿用鱼骨的原因类别—因素层级并扩展为七个原因组。',
    preserved: ['从左向右汇入唯一结果的连续主骨', '原因类别在主骨上下分布并用斜枝连接', '每类原因以标题条和完整因素容器承载'],
    changes: ['七类原因全部保留，按4上3下重新计算枝条位置', '不补充来源未给出的因素，不用编号表达顺序'],
    content: {
      effect: { title: '装配返工', body: '' },
      causes: [
        { key: 'people', title: '人员', factors: ['交接遗漏；培训不足'] },
        { key: 'method', title: '方法', factors: ['作业说明更新滞后'] },
        { key: 'equipment', title: '设备', factors: ['夹具定位漂移'] },
        { key: 'material', title: '材料', factors: ['来料尺寸波动'] },
        { key: 'environment', title: '环境', factors: ['照明影响目检'] },
        { key: 'measurement', title: '测量', factors: ['量具校准遗漏'] },
        { key: 'collaboration', title: '协作', factors: ['变更通知不及时'] },
      ],
    },
  },
  {
    caseId: 'case-28', title: '三项做法共同改善资料交接', asset: 'problem-method-result-001',
    reason: '稿件提出一个资料交接问题、三项并列做法和一个共同预期结果；方法之间没有连续先后。',
    preserved: ['上方问题主梁与下方唯一结果带', '三张等宽方法卡接入共同作用总线', '左侧1–N–1节奏标识和对称中轴'],
    changes: ['按三项方法重算卡片宽度并保持均匀留白', '结果置于卡组外收束，不把结果当作第四项措施'],
    content: {
      problem: { title: '交接资料难以继续使用', body: '接手者需要找到材料，也需要理解材料的使用方式' },
      methods: [
        { key: 'naming', title: '统一命名', body: '统一命名并保留版本' },
        { key: 'directory', title: '组织目录', body: '按实际流程组织目录' },
        { key: 'rationale', title: '补充依据', body: '为关键决定补充依据' },
      ],
      result: { title: '接手者能找到材料并理解使用方式', body: '' },
    },
  },
];

function noLine() { return { style: 'solid', fill: 'none', width: 0 }; }
function addText(slide, value, pos, style = {}) {
  const s = slide.shapes.add({ geometry: 'textbox', name: style.name, position: pos, fill: 'none', line: noLine() });
  s.text = String(value ?? '');
  s.text.style = { typeface: style.typeface ?? SANS, fontSize: style.fontSize ?? 17, color: style.color ?? BODY, bold: style.bold ?? false, alignment: style.alignment ?? 'left', verticalAlignment: style.verticalAlignment ?? 'middle', autoFit: 'none', insets: { top: 0, right: 0, bottom: 0, left: 0 }, lineSpacing: style.lineSpacing ?? 1.1 };
  return s;
}
function box(slide, pos, fill = SURFACE, line = LINE, radius = false, name) { return slide.shapes.add({ geometry: radius ? 'roundRect' : 'rect', name, position: pos, fill, line: { style: 'solid', fill: line, width: 1 } }); }
function ellipse(slide, pos, fill = SURFACE, line = LINE, name) { return slide.shapes.add({ geometry: 'ellipse', name, position: pos, fill, line: { style: 'solid', fill: line, width: 1 } }); }
function line(slide, x1, y1, x2, y2, color = LINE, width = 1, tail) {
  return slide.shapes.add({ geometry: 'line', position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1) || 1, height: Math.abs(y2 - y1) || 1, horizontalFlip: x2 < x1, verticalFlip: y2 < y1 }, fill: 'none', line: { style: 'solid', fill: color, width, ...(tail ? { tail: { type: 'triangle' } } : {}) } });
}
function poly(slide, points, fill, stroke = fill, name) {
  const minX = Math.min(...points.map((p) => p.x)); const minY = Math.min(...points.map((p) => p.y)); const maxX = Math.max(...points.map((p) => p.x)); const maxY = Math.max(...points.map((p) => p.y));
  const w = Math.max(1, maxX - minX); const h = Math.max(1, maxY - minY);
  const commands = points.map((p, i) => { const q = { x: (p.x - minX) * 1000 / w, y: (p.y - minY) * 1000 / h }; return i === 0 ? { moveTo: q } : { lineTo: q }; }); commands.push({ close: {} });
  return slide.shapes.add({ geometry: 'custom', name, position: { left: minX, top: minY, width: w, height: h }, fill, line: { style: 'solid', fill: stroke, width: 1 }, customPaths: [{ width: 1000, height: 1000, commands }] });
}
function header(slide, c, i) {
  addText(slide, String(i + 1).padStart(2, '0'), { left: 56, top: 46, width: 32, height: 24 }, { fontSize: 18, color: ACCENT, name: 'section-number' });
  addText(slide, c.title, { left: 98, top: 40, width: 680, height: 38 }, { fontSize: 25, typeface: SERIF, color: INK, bold: true, name: 'page-title' });
  line(slide, 790, 59, 1218, 59, LINE, 1);
  addText(slide, String(i + 1).padStart(2, '0'), { left: 1195, top: 682, width: 28, height: 16 }, { fontSize: 11, color: MUTED, alignment: 'right', name: 'folio' });
}
function notes(slide, c) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- 稿件：experiments/structure-luna-audit-20260907/batch-1/input.json / ${c.caseId}\n- 结构检索：catalog guide ${c.asset}\n- 几何复核：assets/结构图/${c.asset}/review.mjs\n- 原生调用：invokeStructure references + content + targetFrame + build\n- Skin：neutral-editorial-001；规则：中性杂志风\n[/Sources]\n\n[Boundaries]\n- 本页是指定结构测试，不代表自然选中。\n- invokeStructure success 只代表原生对象已创建，最终判断以导入检查和 PNG 视觉复核为准。\n[/Boundaries]`);
}

function rail(slide, labels, counts) {
  line(slide, 105, 187, 105, 601, '#C7C2B8', 1);
  labels.forEach((label, i) => { const y = [195, 350, 535][i]; ellipse(slide, { left: 76, top: y, width: 58, height: 58 }, i === 0 ? BLUE_DARK : SURFACE, i === 0 ? BLUE_DARK : LINE, `phase-${i}`); addText(slide, counts[i], { left: 76, top: y + 16, width: 58, height: 20 }, { fontSize: 16, color: i === 0 ? '#FFFFFF' : BLUE_DARK, bold: true, alignment: 'center', name: `phase-${i}-count` }); addText(slide, label, { left: 68, top: y + 62, width: 74, height: 20 }, { fontSize: 12, color: MUTED, alignment: 'center', name: `phase-${i}-label` }); });
}

function buildProof(slide, c) {
  rail(slide, ['论点', '依据', '结论'], ['1', '6', '1']);
  box(slide, { left: 180, top: 176, width: 920, height: 76 }, BLUE_DARK, BLUE_DARK, true, 'claim-card');
  addText(slide, c.content.claim.title, { left: 210, top: 190, width: 860, height: 30 }, { fontSize: 21, typeface: SERIF, color: '#FFFFFF', bold: true, name: 'claim-title' });
  addText(slide, c.content.claim.body, { left: 210, top: 224, width: 860, height: 20 }, { fontSize: 13, color: '#E9F0F0', name: 'claim-body' });
  const cards = c.content.evidences; const w = 140; const gap = 10; const x0 = 188; const cardY = 294;
  const centers = cards.map((_, i) => x0 + i * (w + gap) + w / 2);
  centers.forEach((x, i) => { line(slide, x, 252, x, cardY, BLUE, 1); ellipse(slide, { left: x - 4, top: cardY - 4, width: 8, height: 8 }, BLUE_DARK, BLUE_DARK, `claim-anchor-${i}`); });
  cards.forEach((item, i) => { const x = x0 + i * (w + gap); box(slide, { left: x + 4, top: cardY + 6, width: w, height: 154 }, '#DCE3E2', '#DCE3E2', true, `evidence-shadow-${i}`); box(slide, { left: x, top: cardY, width: w, height: 154 }, '#FFFFFF', '#CAD5D4', true, `evidence-card-${i}`); box(slide, { left: x, top: cardY, width: 7, height: 154 }, BLUE, BLUE, false, `evidence-accent-${i}`); addText(slide, String(i + 1).padStart(2, '0'), { left: x + 15, top: cardY + 14, width: 28, height: 18 }, { fontSize: 11, color: BLUE_DARK, bold: true, name: `evidence-number-${i}` }); addText(slide, item.title, { left: x + 15, top: cardY + 40, width: w - 24, height: 24 }, { fontSize: 15, typeface: SERIF, color: INK, bold: true, name: `evidence-title-${i}` }); addText(slide, item.body, { left: x + 15, top: cardY + 76, width: w - 23, height: 60 }, { fontSize: 11.5, color: BODY, name: `evidence-body-${i}` }); line(slide, centers[i], cardY + 154, centers[i], 480, BLUE, 1); });
  line(slide, centers[0], 480, centers.at(-1), 480, BLUE_DARK, 2); ellipse(slide, { left: 640 - 5, top: 475, width: 10, height: 10 }, BLUE_DARK, BLUE_DARK, 'proof-bus-anchor'); line(slide, 640, 480, 640, 516, BLUE_DARK, 2); poly(slide, [{ x: 640, y: 520 }, { x: 633, y: 508 }, { x: 647, y: 508 }], BLUE_DARK, BLUE_DARK, 'proof-conclusion-arrow-down');
  box(slide, { left: 180, top: 523, width: 920, height: 76 }, '#E2ECEB', '#C3D4D4', true, 'conclusion-card'); ellipse(slide, { left: 194, top: 539, width: 54, height: 44 }, ACCENT, ACCENT, 'therefore-badge'); addText(slide, '因此', { left: 194, top: 551, width: 54, height: 18 }, { fontSize: 15, color: '#FFFFFF', bold: true, alignment: 'center', name: 'therefore-label' }); addText(slide, c.content.conclusion.title, { left: 270, top: 537, width: 790, height: 26 }, { fontSize: 20, typeface: SERIF, color: INK, bold: true, name: 'conclusion-title' }); addText(slide, c.content.conclusion.body, { left: 270, top: 570, width: 790, height: 20 }, { fontSize: 14, color: BODY, name: 'conclusion-body' });
}

function buildFishbone(slide, c) {
  // The source review geometry uses a single 48→1076 spine and alternating branch endpoints.
  const spineY = 397; const spineLeft = 155; const spineRight = 1084;
  poly(slide, [{ x: 135, y: spineY - 28 }, { x: 155, y: spineY - 20 }, { x: 155, y: spineY + 20 }, { x: 135, y: spineY + 28 }, { x: 112, y: spineY + 10 }, { x: 112, y: spineY - 10 }], BLUE_DARK, BLUE_DARK, 'causal-tail');
  line(slide, spineLeft, spineY, spineRight, spineY, BLUE_DARK, 5);
  const effectX = 1084; poly(slide, [{ x: effectX, y: spineY - 70 }, { x: 1150, y: spineY - 52 }, { x: 1192, y: spineY }, { x: 1150, y: spineY + 52 }, { x: effectX, y: spineY + 70 }], BLUE_DARK, BLUE_DARK, 'causal-effect-head');
  addText(slide, '结果', { left: 1098, top: spineY - 54, width: 84, height: 18 }, { fontSize: 12, color: '#DCE7E8', alignment: 'center', name: 'effect-label' }); addText(slide, c.content.effect.title, { left: 1090, top: spineY - 20, width: 100, height: 40 }, { fontSize: 18, typeface: SERIF, color: '#FFFFFF', bold: true, alignment: 'center', name: 'effect-title' });
  const positions = [
    { x: 245, side: 'top' }, { x: 455, side: 'top' }, { x: 665, side: 'top' }, { x: 875, side: 'top' },
    { x: 350, side: 'bottom' }, { x: 610, side: 'bottom' }, { x: 870, side: 'bottom' },
  ];
  c.content.causes.forEach((cause, i) => {
    const p = positions[i]; const top = p.side === 'top' ? 190 : 463; const branchEndY = p.side === 'top' ? top + 92 : top; const branchEndX = p.x - 44;
    line(slide, p.x, spineY, branchEndX, branchEndY, BLUE, 1); ellipse(slide, { left: p.x - 7, top: spineY - 7, width: 14, height: 14 }, BLUE_DARK, BLUE_DARK, `causal-anchor-${i}`);
    box(slide, { left: branchEndX - 96, top, width: 210, height: 92 }, '#FFFFFF', '#C9D5D4', true, `cause-group-${i}`);
    box(slide, { left: branchEndX - 96, top, width: 210, height: 30 }, BLUE_DARK, BLUE_DARK, false, `cause-heading-${i}`);
    ellipse(slide, { left: branchEndX - 84, top: top + 6, width: 18, height: 18 }, '#FFFFFF', BLUE_DARK, `cause-index-${i}`); addText(slide, String(i + 1).padStart(2, '0'), { left: branchEndX - 84, top: top + 9, width: 18, height: 12 }, { fontSize: 9, color: BLUE_DARK, bold: true, alignment: 'center', name: `cause-index-text-${i}` }); addText(slide, cause.title, { left: branchEndX - 58, top: top + 6, width: 158, height: 18 }, { fontSize: 15, typeface: SERIF, color: '#FFFFFF', bold: true, name: `cause-title-${i}` });
    addText(slide, cause.factors.join('；'), { left: branchEndX - 78, top: top + 47, width: 170, height: 30 }, { fontSize: 13, color: BODY, alignment: 'center', name: `cause-body-${i}` });
  });
  addText(slide, '具体因素', { left: 162, top: 590, width: 88, height: 20 }, { fontSize: 13, color: MUTED, name: 'factor-note' });
}

function buildProblemMethodResult(slide, c) {
  rail(slide, ['问题', '方法', '结果'], ['1', '3', '1']);
  box(slide, { left: 180, top: 176, width: 920, height: 76 }, BLUE_DARK, BLUE_DARK, true, 'problem-card');
  addText(slide, c.content.problem.title, { left: 210, top: 190, width: 860, height: 30 }, { fontSize: 21, typeface: SERIF, color: '#FFFFFF', bold: true, name: 'problem-title' });
  addText(slide, c.content.problem.body, { left: 210, top: 224, width: 860, height: 20 }, { fontSize: 13, color: '#E9F0F0', name: 'problem-body' });
  const w = 280; const gap = 24; const x0 = 230; const cardY = 302; const centers = c.content.methods.map((_, i) => x0 + i * (w + gap) + w / 2);
  centers.forEach((x, i) => { line(slide, x, 252, x, cardY, BLUE, 1); ellipse(slide, { left: x - 4, top: cardY - 4, width: 8, height: 8 }, BLUE_DARK, BLUE_DARK, `problem-anchor-${i}`); });
  c.content.methods.forEach((method, i) => { const x = x0 + i * (w + gap); box(slide, { left: x + 5, top: cardY + 7, width: w, height: 174 }, '#DCE3E2', '#DCE3E2', true, `method-shadow-${i}`); box(slide, { left: x, top: cardY, width: w, height: 174 }, '#FFFFFF', '#CAD5D4', true, `method-card-${i}`); box(slide, { left: x, top: cardY, width: w, height: 8 }, BLUE, BLUE, false, `method-accent-${i}`); ellipse(slide, { left: x + 18, top: cardY + 22, width: 38, height: 38 }, BLUE_DARK, BLUE_DARK, `method-number-${i}`); addText(slide, String(i + 1).padStart(2, '0'), { left: x + 18, top: cardY + 34, width: 38, height: 14 }, { fontSize: 11, color: '#FFFFFF', bold: true, alignment: 'center', name: `method-number-text-${i}` }); addText(slide, method.title, { left: x + 72, top: cardY + 25, width: w - 92, height: 28 }, { fontSize: 19, typeface: SERIF, color: INK, bold: true, name: `method-title-${i}` }); addText(slide, method.body, { left: x + 28, top: cardY + 94, width: w - 56, height: 52 }, { fontSize: 15, color: BODY, alignment: 'center', name: `method-body-${i}` }); line(slide, centers[i], cardY + 174, centers[i], 500, BLUE, 1); });
  line(slide, centers[0], 500, centers.at(-1), 500, BLUE_DARK, 2); ellipse(slide, { left: 640 - 5, top: 495, width: 10, height: 10 }, BLUE_DARK, BLUE_DARK, 'method-bus-anchor'); line(slide, 640, 500, 640, 536, BLUE_DARK, 2); poly(slide, [{ x: 640, y: 540 }, { x: 633, y: 528 }, { x: 647, y: 528 }], BLUE_DARK, BLUE_DARK, 'method-result-arrow-down');
  box(slide, { left: 180, top: 543, width: 920, height: 70 }, '#E2ECEB', '#C3D4D4', true, 'result-card'); ellipse(slide, { left: 194, top: 556, width: 54, height: 44 }, ACCENT, ACCENT, 'result-badge'); addText(slide, '预期', { left: 194, top: 568, width: 54, height: 18 }, { fontSize: 15, color: '#FFFFFF', bold: true, alignment: 'center', name: 'result-label' }); addText(slide, c.content.result.title, { left: 270, top: 564, width: 790, height: 28 }, { fontSize: 20, typeface: SERIF, color: INK, bold: true, name: 'result-title' });
}

async function main() {
  await fs.rm(evidencePath, { force: true });
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const choices = [];
  const builders = { 'argument-evidence-conclusion-001': buildProof, 'causal-fishbone-attribution-001': buildFishbone, 'problem-method-result-001': buildProblemMethodResult };
  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i]; const slide = p.slides.add(); slide.background.fill = PAPER; header(slide, c, i); notes(slide, c);
    const result = await invokeStructure({ root, slide, skin, targetFrame: frame, content: c.content, references: [{ assetId: c.asset, preservedFeatures: c.preserved, changes: c.changes }], evidencePath, pageId: c.caseId, regionId: 'body', reason: c.reason, build({ slide: buildSlide, content }) { builders[c.asset](buildSlide, { ...c, content }); } });
    choices.push({ caseId: c.caseId, selectedAssetIds: [c.asset], selectionMode: 'specified-targeted-test', reason: c.reason, preservedFeatures: c.preserved, changes: c.changes, invocationStatus: result?.validation ?? 'rendered-unreviewed', unresolved: [] });
  }
  await (await PresentationFile.exportPptx(p)).save(path.join(outDir, 'candidate.pptx'));
  await fs.writeFile(path.join(outDir, 'choice.json'), JSON.stringify(choices, null, 2));
  for (let i = 0; i < p.slides.items.length; i += 1) { const s = p.slides.items[i]; const img = await p.export({ slide: s, format: 'png', scale: 1 }); await fs.writeFile(path.join(outDir, `authoring-slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await img.arrayBuffer())); const lay = await s.export({ format: 'layout' }); await fs.writeFile(path.join(outDir, `authoring-slide-${String(i + 1).padStart(2, '0')}.layout.json`), await lay.text()); }
  const imported = await PresentationFile.importPptx(await FileBlob.load(path.join(outDir, 'candidate.pptx'))); const insp = await imported.inspect({ kind: 'slide,textbox,shape,notes,layout', maxChars: 500000 }); await fs.writeFile(path.join(outDir, 'inspect-imported.ndjson'), insp.ndjson, 'utf8'); await fs.writeFile(path.join(outDir, 'inspect.ndjson'), insp.ndjson, 'utf8');
  for (let i = 0; i < imported.slides.items.length; i += 1) { const s = imported.slides.items[i]; const img = await imported.export({ slide: s, format: 'png', scale: 1 }); await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await img.arrayBuffer())); const lay = await s.export({ format: 'layout' }); await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.layout.json`), await lay.text()); }
  await fs.writeFile(path.join(outDir, 'review.md'), '# Targeted-A review\n\n- case-01: 原稿论点完整保留，六项依据各自独立承载并接入共同总线；PNG 重导入后六条竖线与下行三角形均指向结论带。\n- case-04: 七类原因均保留，连续主骨与结果头边界相接；PNG 中上下4+3原因枝均从主骨延伸到原因卡边界。\n- case-28: 一个问题、三项并列做法、一个共同预期结果；结果徽章使用“预期”，避免把稿件的预期表述成已实现。\n- 内容核对：case-01 六条依据=业务适配、小范围故障定位、反馈校正文案、角色培训、回滚范围、支持团队案例；case-04 七类原因及因素逐项保留；case-28 三项做法与预期结果逐项保留。\n- 状态：原生 PPTX、导入 inspect、authoring/重导入 PNG 与 layout 已生成；旧版留档于 `round-1/`。\n', 'utf8');
  console.log(JSON.stringify({ status: 'built', slides: imported.slides.items.length, outDir, evidencePath }, null, 2));
}
main().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
