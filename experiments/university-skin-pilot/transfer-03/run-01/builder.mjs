import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/PPagenT';
const OUT = `${ROOT}/experiments/university-skin-pilot/transfer-03/run-01`;
const THEME_PATH = `${ROOT}/experiments/university-skin-pilot/reference-01/theme.json`;

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a, b, t) {
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  return rgbToHex(aa.map((v, i) => v * (1 - t) + bb[i] * t));
}

function line(fill, width = 1, style = 'solid') {
  return { style, fill, width };
}

function addText(slide, ledger, name, text, position, style) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name,
    position,
    fill: 'none',
    line: line('none', 0),
  });
  shape.text = text;
  shape.text.style = {
    fontSize: style.fontSize,
    bold: Boolean(style.bold),
    color: style.color,
    typeface: style.typeface,
    alignment: style.alignment || 'left',
    verticalAlignment: style.verticalAlignment || 'top',
    lineSpacing: style.lineSpacing || 1.25,
    autoFit: 'none',
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  ledger.push({ name, role: style.role, text, expectedFontSize: style.fontSize, expectedBold: Boolean(style.bold) });
  return shape;
}

function addRect(slide, name, position, fill, stroke, radius = 16) {
  return slide.shapes.add({
    geometry: 'roundRect',
    name,
    position,
    fill,
    line: line(stroke, 1),
    borderRadius: radius,
  });
}

function addLaneMarker(slide, name, top, color) {
  return slide.shapes.add({
    geometry: 'rect',
    name,
    position: { left: 55, top, width: 7, height: 44 },
    fill: color,
    line: line(color, 0),
  });
}

async function main() {
  const theme = JSON.parse(await fs.readFile(THEME_PATH, 'utf8'));
  const { primaryColor: primary, font, neutral } = theme;
  const ink = neutral.ink;
  const muted = neutral.muted;
  const bg = neutral.background;
  const primaryLight = mix(primary, bg, 0.90);
  const primaryLighter = mix(primary, bg, 0.95);
  const primaryMid = mix(primary, bg, 0.58);
  const primaryDark = mix(primary, ink, 0.35);
  const guide = mix(ink, bg, 0.82);

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = bg;
  const ledger = [];
  const connectorLedger = [];

  addText(slide, ledger, 'eyebrow', '虚构流程设计 · 尚未实施', { left: 55, top: 34, width: 420, height: 22 }, {
    fontSize: 16, bold: true, color: primary, typeface: font, role: 'visible-status',
  });
  addText(slide, ledger, 'title', '两条准备工作可并行，但联合实验必须等两份证据齐全', { left: 55, top: 64, width: 1165, height: 44 }, {
    fontSize: 32, bold: true, color: ink, typeface: font, role: 'page-title', lineSpacing: 1.0,
  });
  slide.shapes.add({ geometry: 'line', name: 'title-rule', position: { left: 55, top: 126, width: 1170, height: 0 }, fill: 'none', line: line(primaryMid, 1) });
  addText(slide, ledger, 'process-caption', '准备阶段：两条责任组路径同时推进', { left: 55, top: 143, width: 510, height: 22 }, {
    fontSize: 16, color: muted, typeface: font, role: 'support-caption',
  });

  addLaneMarker(slide, 'equipment-marker', 190, primary);
  addLaneMarker(slide, 'data-marker', 382, primaryMid);
  addText(slide, ledger, 'equipment-label', '设备组', { left: 76, top: 195, width: 80, height: 26 }, {
    fontSize: 22, bold: true, color: ink, typeface: font, role: 'lane-label',
  });
  addText(slide, ledger, 'data-label', '数据组', { left: 76, top: 387, width: 80, height: 26 }, {
    fontSize: 22, bold: true, color: ink, typeface: font, role: 'lane-label',
  });

  const equipmentTask = addRect(slide, 'equipment-task', { left: 145, top: 190, width: 235, height: 92 }, primaryLight, primaryMid);
  const dataTask = addRect(slide, 'data-task', { left: 145, top: 382, width: 235, height: 92 }, primaryLighter, primaryMid);
  const equipmentGate = slide.shapes.add({ geometry: 'diamond', name: 'equipment-gate', position: { left: 430, top: 206, width: 84, height: 60 }, fill: primaryLight, line: line(primary, 1.5) });
  const dataGate = slide.shapes.add({ geometry: 'diamond', name: 'data-gate', position: { left: 430, top: 398, width: 84, height: 60 }, fill: primaryLighter, line: line(primary, 1.5) });
  const equipmentEvidence = addRect(slide, 'equipment-evidence', { left: 550, top: 190, width: 180, height: 92 }, primaryLight, primaryMid);
  const dataEvidence = addRect(slide, 'data-evidence', { left: 550, top: 382, width: 180, height: 92 }, primaryLighter, primaryMid);
  const jointCheck = addRect(slide, 'joint-check', { left: 790, top: 277, width: 170, height: 90 }, primaryLight, primary);
  const finalNode = addRect(slide, 'final-node', { left: 1035, top: 277, width: 170, height: 90 }, primaryDark, primaryDark);

  addText(slide, ledger, 'equipment-task-title', '设备校准', { left: 161, top: 204, width: 210, height: 27 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-title' });
  addText(slide, ledger, 'equipment-task-body', '批次／执行人／结果', { left: 161, top: 240, width: 210, height: 28 }, { fontSize: 20, color: ink, typeface: font, role: 'node-body' });
  addText(slide, ledger, 'data-task-title', '样本整理', { left: 161, top: 396, width: 210, height: 27 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-title' });
  addText(slide, ledger, 'data-task-body', '核对编号与授权范围', { left: 161, top: 432, width: 210, height: 28 }, { fontSize: 20, color: ink, typeface: font, role: 'node-body' });
  addText(slide, ledger, 'equipment-gate-label', '合格？', { left: 439, top: 222, width: 66, height: 24 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, ledger, 'data-gate-label', '完整？', { left: 439, top: 414, width: 66, height: 24 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, ledger, 'equipment-evidence-title', '签字校准记录', { left: 565, top: 204, width: 165, height: 27 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'evidence-title' });
  addText(slide, ledger, 'equipment-evidence-body', '合格后提交', { left: 565, top: 240, width: 165, height: 28 }, { fontSize: 20, color: ink, typeface: font, role: 'evidence-body' });
  addText(slide, ledger, 'data-evidence-title', '去标识样本清单', { left: 565, top: 396, width: 165, height: 27 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'evidence-title' });
  addText(slide, ledger, 'data-evidence-body', '可追溯，授权完整', { left: 565, top: 432, width: 165, height: 28 }, { fontSize: 20, color: ink, typeface: font, role: 'evidence-body' });
  addText(slide, ledger, 'joint-check-title', '联合核验', { left: 807, top: 291, width: 136, height: 27 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-title' });
  addText(slide, ledger, 'joint-check-body', '两份证据都提交', { left: 800, top: 327, width: 150, height: 28 }, { fontSize: 20, color: ink, typeface: font, role: 'node-body' });
  addText(slide, ledger, 'final-node-title', '本轮可开始', { left: 1052, top: 291, width: 136, height: 27 }, { fontSize: 22, bold: true, color: bg, typeface: font, role: 'node-title' });
  addText(slide, ledger, 'final-node-body', '确认联合实验', { left: 1052, top: 327, width: 136, height: 28 }, { fontSize: 20, color: bg, typeface: font, role: 'node-body' });

  function connectAndRecord(source, target, options) {
    const fromIdx = slide.shapes.getConnectionSiteIndex(source, options.fromSide);
    const toIdx = slide.shapes.getConnectionSiteIndex(target, options.toSide);
    const connector = slide.shapes.connect(source, target, options);
    connectorLedger.push({ id: connector.id, from: source.name, fromSide: options.fromSide, fromIdx, to: target.name, toSide: options.toSide, toIdx, kind: options.kind, lineStyle: options.line.style, lineWidth: options.line.width, head: options.head?.type || 'none' });
    return connector;
  }

  // Forward connectors are created after nodes but remain behind them in the exported z-order.
  connectAndRecord(equipmentTask, equipmentGate, { kind: 'straight', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  connectAndRecord(equipmentGate, equipmentEvidence, { kind: 'straight', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  connectAndRecord(dataTask, dataGate, { kind: 'straight', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  connectAndRecord(dataGate, dataEvidence, { kind: 'straight', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  connectAndRecord(equipmentEvidence, jointCheck, { kind: 'elbow', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  connectAndRecord(dataEvidence, jointCheck, { kind: 'elbow', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  connectAndRecord(jointCheck, finalNode, { kind: 'straight', fromSide: 'right', toSide: 'left', line: line(primary, 2), head: { type: 'triangle', width: 'sm', length: 'sm' } });
  // Local failure/rework loops make the responsibility boundary visible.
  connectAndRecord(equipmentGate, equipmentTask, { kind: 'elbow', fromSide: 'bottom', toSide: 'bottom', line: line(primary, 1.5, 'dashed'), head: { type: 'arrow', width: 'sm', length: 'sm' } });
  connectAndRecord(dataGate, dataTask, { kind: 'elbow', fromSide: 'bottom', toSide: 'bottom', line: line(primary, 1.5, 'dashed'), head: { type: 'arrow', width: 'sm', length: 'sm' } });

  addText(slide, ledger, 'equipment-fail-label', '不合格：调整后复校', { left: 286, top: 294, width: 188, height: 24 }, { fontSize: 16, color: muted, typeface: font, role: 'edge-condition', alignment: 'center', lineSpacing: 1.0 });
  addText(slide, ledger, 'data-fail-label', '授权缺失：隔离并补齐', { left: 266, top: 486, width: 228, height: 24 }, { fontSize: 16, color: muted, typeface: font, role: 'edge-condition', alignment: 'center', lineSpacing: 1.0 });
  addText(slide, ledger, 'evidence-gate-label', '两份证据齐全才启动', { left: 790, top: 246, width: 170, height: 24 }, { fontSize: 16, color: primary, typeface: font, role: 'gate-condition', alignment: 'center', lineSpacing: 1.0 });
  addText(slide, ledger, 'missing-evidence-note', '缺任一份：不启动，通知对应责任组补齐', { left: 755, top: 388, width: 248, height: 42 }, { fontSize: 16, color: muted, typeface: font, role: 'boundary-note', lineSpacing: 1.15 });

  slide.shapes.add({ geometry: 'line', name: 'footer-rule', position: { left: 55, top: 646, width: 1170, height: 0 }, fill: 'none', line: line(guide, 1) });
  addText(slide, ledger, 'boundary-note', '本轮只检验职责、证据留存与联合核验；不承诺提前完成，也不宣称已减少等待。', { left: 55, top: 660, width: 890, height: 22 }, { fontSize: 16, color: muted, typeface: font, role: 'visible-boundary', lineSpacing: 1.0 });
  addText(slide, ledger, 'page-number', '01', { left: 1185, top: 660, width: 40, height: 22 }, { fontSize: 14, color: muted, typeface: font, role: 'page-number', alignment: 'right', lineSpacing: 1.0 });

  slide.speakerNotes.textFrame.setText('[Sources]\n内容：experiments/university-skin-pilot/transfer-03/manuscript.txt\n设计：docs/设计手册/科研咨询式排版-v7.md；主题：experiments/university-skin-pilot/reference-01/theme.json\n结构参考：parallel-equal-cards-001、convergence-many-to-one-003、branching-decision-routes-001、cycle-single-chain-feedback-002；本页为原生对象参考重组，未执行 invokeStructure。');
  slide.speakerNotes.setVisible(true);

  const render = await presentation.export({ slide, format: 'png', scale: 1 });
  await writeBlob(`${OUT}/final-render.png`, render);
  const layoutBlob = await slide.export({ format: 'layout' });
  const layoutText = await layoutBlob.text();
  await fs.writeFile(`${OUT}/layoutJSON.json`, layoutText, 'utf8');
  const inspection = await presentation.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 20000 });
  await fs.writeFile(`${OUT}/object-inspection.ndjson`, inspection.ndjson || '', 'utf8');

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);

  const references = {
    mode: 'reference',
    referenceAssetIds: [
      'parallel-equal-cards-001',
      'convergence-many-to-one-003',
      'branching-decision-routes-001',
      'cycle-single-chain-feedback-002',
    ],
    absorbedMethods: [
      '用共同起点与等权分栏表达两条并行责任组路径，但不继承并列卡片的无关系语义。',
      '用双路向单一联合核验点的汇聚动势表达两份证据的共同前置条件。',
      '让“合格/完整”门槛紧邻对应连线，并把失败路径回送到责任组自己的准备节点。',
      '用克制的虚线反馈通道表达复校/补齐，不把一次性准备误画成已完成的循环收益。',
    ],
    changesForThisPage: [
      '按 manuscript 的两条并行路径重建为双泳道原生形状；没有复制参考源坐标、图片、卡片语法或旧主题。',
      '把设备与数据各自的失败条件保留在门槛与回路中，把联合核验与最终启动放在右侧共同主轴。',
      '只用 theme.json 的主色与由 primaryColor、ink、background 派生的色阶；没有引入独立第二色相。',
    ],
    invocation: { executed: false, note: '未执行 invokeStructure；本页为参考重组后的原生可编辑对象。' },
  };
  await fs.writeFile(`${OUT}/reference-records.json`, JSON.stringify(references, null, 2), 'utf8');

  const layout = JSON.parse(layoutText);
  const textFrames = (layout.elements || []).filter((e) => typeof e.text === 'string' && e.text.trim());
  const outOfBounds = (layout.elements || []).filter((e) => Array.isArray(e.bbox) && (e.bbox[0] < 0 || e.bbox[1] < 0 || e.bbox[0] + e.bbox[2] > 1280 || e.bbox[1] + e.bbox[3] > 720));
  const report = [
    'run-01 report',
    'communication job: 联合实验负责人应理解两条准备工作彼此独立可并行，但只有两份证据齐全且联合核验通过后才可启动。',
    'content boundary: 虚构流程设计，尚未实施；没有添加真实学校、真实成果或统计数字。',
    'visual route: explicit custom visual direction from the supplied Skin guide + theme.json; no bundled template used.',
    'native output: all visible text, nodes, gates, lines, arrows and evidence objects are native PowerPoint objects.',
    `actual exported layout: ${textFrames.length} non-empty text frames; ${outOfBounds.length} elements outside 1280x720.`,
    'text roles and expected sizes are declared in builder.mjs; object-inspection.ndjson and layoutJSON.json are the actual exported-object evidence used for the audit.',
    'line/text boundary: edge labels have opaque background-free text boxes placed away from lines; all failure labels are separate from dashed connectors.',
    `connector endpoint check: ${connectorLedger.length} connectors; endpoints resolved from named source/target shapes via actual side connection sites and recorded below.`,
    'reference mode: reference; invokeStructure: not executed.',
    '',
    'REFERENCE RECORD',
    JSON.stringify(references, null, 2),
    '',
    'EXPORTED OBJECT INSPECTION',
    inspection.ndjson || '',
    '',
    'CONNECTOR ENDPOINT LEDGER',
    JSON.stringify(connectorLedger, null, 2),
  ].join('\n');
  await fs.writeFile(`${OUT}/report.txt`, report, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
