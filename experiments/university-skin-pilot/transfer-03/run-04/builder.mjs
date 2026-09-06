import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/PPagenT';
const OUT = `${ROOT}/experiments/university-skin-pilot/transfer-03/run-04`;
const THEME_PATH = `${ROOT}/experiments/university-skin-pilot/reference-01/theme.json`;

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function sha256(path) {
  const bytes = await fs.readFile(path);
  return crypto.createHash('sha256').update(bytes).digest('hex');
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

function addText(slide, textLedger, name, text, position, style) {
  const shape = slide.shapes.add({ geometry: 'textbox', name, position, fill: 'none', line: line('none', 0) });
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
  textLedger.push({ name, role: style.role, text, expectedFontSize: style.fontSize, expectedBold: Boolean(style.bold) });
  return shape;
}

function addNode(slide, name, position, fill, stroke) {
  return slide.shapes.add({ geometry: 'roundRect', name, position, fill, line: line(stroke, 1), borderRadius: 12 });
}

function addDiamond(slide, name, position, fill, stroke) {
  return slide.shapes.add({ geometry: 'diamond', name, position, fill, line: line(stroke, 1.5) });
}

function collectConnectorNodes(value, path = 'root', out = []) {
  if (!value || typeof value !== 'object') return out;
  if (!Array.isArray(value) && value.connector && typeof value.connector === 'object') {
    out.push({ path, id: value.id, name: value.name, shape: value.shape, connector: value.connector });
  }
  if (Array.isArray(value)) value.forEach((v, i) => collectConnectorNodes(v, `${path}[${i}]`, out));
  else Object.entries(value).forEach(([k, v]) => collectConnectorNodes(v, `${path}.${k}`, out));
  return out;
}

async function main() {
  const theme = JSON.parse(await fs.readFile(THEME_PATH, 'utf8'));
  const { primaryColor: primary, font, neutral } = theme;
  const ink = neutral.ink;
  const muted = neutral.muted;
  const bg = neutral.background;
  const pale = mix(primary, bg, 0.91);
  const pale2 = mix(primary, bg, 0.96);
  const mid = mix(primary, bg, 0.58);
  const dark = mix(primary, ink, 0.35);
  const hair = mix(ink, bg, 0.82);

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = bg;
  const textLedger = [];
  const connectorLedger = [];

  addText(slide, textLedger, 'eyebrow', '虚构流程设计 · 尚未实施', { left: 55, top: 34, width: 420, height: 22 }, { fontSize: 16, bold: true, color: primary, typeface: font, role: 'visible-status' });
  addText(slide, textLedger, 'title', '两条准备工作可并行，但联合实验必须等证据齐全且核验通过', { left: 55, top: 64, width: 1165, height: 44 }, { fontSize: 32, bold: true, color: ink, typeface: font, role: 'page-title', lineSpacing: 1.0 });
  slide.shapes.add({ geometry: 'line', name: 'title-rule', position: { left: 55, top: 126, width: 1170, height: 0 }, fill: 'none', line: line(mid, 1) });
  addText(slide, textLedger, 'process-caption', '准备阶段：两条责任组路径同时推进', { left: 55, top: 143, width: 510, height: 22 }, { fontSize: 16, color: muted, typeface: font, role: 'support-caption' });

  addText(slide, textLedger, 'equipment-label', '设备组', { left: 55, top: 206, width: 76, height: 28 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'lane-label' });
  addText(slide, textLedger, 'data-label', '数据组', { left: 55, top: 354, width: 76, height: 28 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'lane-label' });

  const equipmentTask = addNode(slide, 'equipment-task', { left: 160, top: 198, width: 150, height: 56 }, pale, primary);
  const dataTask = addNode(slide, 'data-task', { left: 160, top: 346, width: 150, height: 56 }, pale2, primary);
  const equipmentGate = addDiamond(slide, 'equipment-gate', { left: 370, top: 201, width: 70, height: 50 }, pale, primary);
  const dataGate = addDiamond(slide, 'data-gate', { left: 370, top: 349, width: 70, height: 50 }, pale2, primary);
  const equipmentEvidence = addNode(slide, 'equipment-evidence', { left: 505, top: 198, width: 155, height: 56 }, pale, primary);
  const dataEvidence = addNode(slide, 'data-evidence', { left: 505, top: 346, width: 155, height: 56 }, pale2, primary);
  const jointCheck = addNode(slide, 'joint-check', { left: 730, top: 276, width: 160, height: 54 }, pale, primary);
  const passGate = addDiamond(slide, 'joint-pass-gate', { left: 930, top: 277, width: 70, height: 52 }, pale, primary);
  const finalNode = addNode(slide, 'final-node', { left: 1040, top: 276, width: 170, height: 54 }, dark, dark);

  addText(slide, textLedger, 'equipment-task-title', '设备校准', { left: 178, top: 214, width: 114, height: 26 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-title' });
  addText(slide, textLedger, 'data-task-title', '样本整理', { left: 178, top: 362, width: 114, height: 26 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-title' });
  addText(slide, textLedger, 'equipment-gate-label', '合格？', { left: 370, top: 214, width: 70, height: 24 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'data-gate-label', '完整？', { left: 370, top: 362, width: 70, height: 24 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'equipment-evidence-title', '校准记录', { left: 515, top: 214, width: 140, height: 26 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'evidence-title' });
  addText(slide, textLedger, 'data-evidence-title', '去标识清单', { left: 515, top: 362, width: 140, height: 26 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'evidence-title' });
  addText(slide, textLedger, 'joint-check-title', '联合核验', { left: 748, top: 290, width: 124, height: 26 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-title' });
  addText(slide, textLedger, 'joint-pass-label', '通过？', { left: 930, top: 289, width: 70, height: 24 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'final-node-title', '本轮可开始', { left: 1058, top: 290, width: 134, height: 26 }, { fontSize: 22, bold: true, color: bg, typeface: font, role: 'node-title' });

  addText(slide, textLedger, 'equipment-evidence-note', '记录批次、执行人和结果；合格后提交签字校准记录。\n不合格由设备组调整后复校，不带问题进入联合实验。', { left: 160, top: 270, width: 550, height: 56 }, { fontSize: 20, color: ink, typeface: font, role: 'open-explanation' });
  addText(slide, textLedger, 'data-evidence-note', '编号可追溯且授权完整，才形成去标识清单。\n缺授权样本隔离，不进入本轮清单；数据组继续补齐授权。', { left: 160, top: 418, width: 550, height: 70 }, { fontSize: 20, color: ink, typeface: font, role: 'open-explanation' });
  addText(slide, textLedger, 'and-label', '两份证据齐全', { left: 690, top: 238, width: 240, height: 22 }, { fontSize: 16, bold: true, color: primary, typeface: font, role: 'gate-condition' });
  addText(slide, textLedger, 'manager-boundary-note', '负责人做联合核验，不代签校准，也不代替数据组补授权。\n缺任一证据或核验未通过，就退回对应责任组，不启动本轮实验。', { left: 725, top: 360, width: 380, height: 92 }, { fontSize: 20, color: ink, typeface: font, role: 'role-boundary' });

  addText(slide, textLedger, 'next-week-title', '下一周试行范围', { left: 80, top: 532, width: 200, height: 26 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'open-section-title' });
  addText(slide, textLedger, 'next-week-body', '只验收两条准备可并行、职责边界清楚、两份证据留存完整；不承诺提前完成或减少等待。', { left: 80, top: 562, width: 1050, height: 52 }, { fontSize: 20, color: ink, typeface: font, role: 'open-section-body' });

  function connectAndRecord(source, target, options, label) {
    const fromIdx = slide.shapes.getConnectionSiteIndex(source, options.fromSide);
    const toIdx = slide.shapes.getConnectionSiteIndex(target, options.toSide);
    const connector = slide.shapes.connect(source, target, options);
    connectorLedger.push({ label, id: connector.id, from: source.name, fromSide: options.fromSide, fromIdx, to: target.name, toSide: options.toSide, toIdx, kind: options.kind, lineStyle: options.line.style, lineWidth: options.line.width, head: options.head?.type || 'none', tail: options.tail?.type || 'none' });
    return connector;
  }

  const forward = { line: line(primary, 2), tail: { type: 'triangle', width: 'sm', length: 'sm' } };
  const feedback = { line: line(primary, 1.5, 'dashed'), tail: { type: 'arrow', width: 'sm', length: 'sm' } };
  connectAndRecord(equipmentTask, equipmentGate, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '设备校准→合格门槛');
  connectAndRecord(equipmentGate, equipmentEvidence, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '合格门槛→签字校准记录');
  connectAndRecord(dataTask, dataGate, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '样本整理→完整门槛');
  connectAndRecord(dataGate, dataEvidence, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '完整门槛→去标识样本清单');
  connectAndRecord(equipmentEvidence, jointCheck, { ...forward, kind: 'elbow', fromSide: 'right', toSide: 'left' }, '校准记录→联合核验');
  connectAndRecord(dataEvidence, jointCheck, { ...forward, kind: 'elbow', fromSide: 'right', toSide: 'left' }, '样本清单→联合核验');
  connectAndRecord(jointCheck, passGate, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '联合核验→通过门槛');
  connectAndRecord(passGate, finalNode, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '通过门槛→确认可开始');
  connectAndRecord(equipmentGate, equipmentTask, { ...feedback, kind: 'elbow', fromSide: 'bottom', toSide: 'bottom' }, '不合格→设备组复校');
  connectAndRecord(dataGate, dataTask, { ...feedback, kind: 'elbow', fromSide: 'bottom', toSide: 'bottom' }, '授权缺失→数据组补齐');

  slide.shapes.add({ geometry: 'line', name: 'footer-rule', position: { left: 55, top: 646, width: 1170, height: 0 }, fill: 'none', line: line(hair, 1) });
  addText(slide, textLedger, 'footer-source', '素材：虚构流程设计｜本页仅检验并行准备、职责边界、证据留存与联合核验', { left: 55, top: 660, width: 920, height: 22 }, { fontSize: 14, color: muted, typeface: font, role: 'source-footer', lineSpacing: 1.0 });
  addText(slide, textLedger, 'page-number', '01', { left: 1185, top: 660, width: 40, height: 22 }, { fontSize: 14, color: muted, typeface: font, role: 'page-number', alignment: 'right', lineSpacing: 1.0 });
  slide.speakerNotes.textFrame.setText('[Sources]\n内容：experiments/university-skin-pilot/transfer-03/manuscript.txt\n设计：docs/设计手册/科研咨询式排版-v7.md；主题：experiments/university-skin-pilot/reference-01/theme.json\n结构参考重组：parallel-equal-cards-001、convergence-many-to-one-003、branching-decision-routes-001、cycle-single-chain-feedback-002；未执行 invokeStructure。');
  slide.speakerNotes.setVisible(true);

  const render = await presentation.export({ slide, format: 'png', scale: 1 });
  await writeBlob(`${OUT}/final-render.png`, render);
  const layoutText = await (await slide.export({ format: 'layout' })).text();
  await fs.writeFile(`${OUT}/layoutJSON.json`, layoutText, 'utf8');
  const inspection = await presentation.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 24000 });
  await fs.writeFile(`${OUT}/object-inspection.ndjson`, inspection.ndjson || '', 'utf8');

  const proto = presentation.toProto();
  const protoConnectors = collectConnectorNodes(proto);
  const forwardProto = protoConnectors.filter((c) => c.connector?.lineStyle?.tail?.type === 2);
  const feedbackProto = protoConnectors.filter((c) => c.connector?.lineStyle?.tail?.type === 6);
  const protoArrowCheck = {
    connectorCount: protoConnectors.length,
    forwardCount: forwardProto.length,
    forwardDestinationTailType2: forwardProto.length === 8 && forwardProto.every((c) => c.connector?.lineStyle?.tail?.type === 2 && !c.connector?.lineStyle?.head),
    feedbackCount: feedbackProto.length,
    feedbackDestinationTailType6: feedbackProto.length === 2 && feedbackProto.every((c) => c.connector?.lineStyle?.tail?.type === 6 && !c.connector?.lineStyle?.head),
  };
  await fs.writeFile(`${OUT}/proto.json`, JSON.stringify(proto, null, 2), 'utf8');
  await fs.writeFile(`${OUT}/proto-connectors.json`, JSON.stringify(protoConnectors, null, 2), 'utf8');
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);

  const layout = JSON.parse(layoutText);
  const textFrames = (layout.elements || []).filter((e) => typeof e.text === 'string' && e.text.trim());
  const outOfBounds = (layout.elements || []).filter((e) => Array.isArray(e.bbox) && (e.bbox[0] < 0 || e.bbox[1] < 0 || e.bbox[0] + e.bbox[2] > 1280 || e.bbox[1] + e.bbox[3] > 720));
  const oneLine = textFrames.filter((e) => e.textLayout?.lineCount === 1).length;
  const twoLine = textFrames.filter((e) => e.textLayout?.lineCount === 2).length;
  const refs = {
    mode: 'reference',
    referenceAssetIds: ['parallel-equal-cards-001', 'convergence-many-to-one-003', 'branching-decision-routes-001', 'cycle-single-chain-feedback-002'],
    absorbedMethods: ['共同起点与双轨对齐表达并行，但把说明从节点中移到开放文字。', '双路证据向单一联合核验点收束，再经过独立的“通过？”门槛。', '条件紧邻局部门槛；不合格与授权缺失分别回送设备组/数据组。', '只保留局部反馈通道，不将准备工作画成已实现的收益循环。'],
    changesForThisPage: ['压缩结构骨架，普通职责、证据解释、异常处理与负责人边界采用开放文字。', '补入项目负责人职责限制、授权缺失样本隔离、不进入本轮清单，以及“证据齐全且联合核验通过”双重启动条件。', '整页使用 theme.json 的 primaryColor 与派生色阶；不引入独立第二色相。'],
    invocation: { executed: false, note: '未执行 invokeStructure；本页为参考重组后的原生可编辑对象。' },
  };
  await fs.writeFile(`${OUT}/reference-records.json`, JSON.stringify(refs, null, 2), 'utf8');

  const report = [
    'run-04 report',
    'communication job: 联合实验负责人应看懂两条准备可并行，但启动条件是两份证据齐全且项目负责人联合核验通过。',
    'content boundary: 虚构流程设计，尚未实施；没有添加真实学校、真实成果或统计数字。',
    'visual route: explicit custom visual direction from the supplied Skin guide + theme.json; no bundled template used.',
    'native output: visible text, nodes, gates, connectors and open explanations are native PowerPoint objects.',
    `actual exported layout: ${textFrames.length} non-empty text frames; ${oneLine} one-line frames; ${twoLine} two-line frames; ${outOfBounds.length} elements outside 1280x720.`,
    'text sizing/bounds evidence: layoutJSON.json records resolvedFontSize, resolvedTextStyle, textLayout.lines and bbox for each exported text object.',
    'connector evidence: proto-connectors.json is extracted from presentation.toProto(); connector endpoint side/index records are in this report.',
    `proto arrow check: ${JSON.stringify(protoArrowCheck)}; forward arrows are encoded on destination tail, with no head arrow in proto.`,
    'helper-render sha256: pending post-render verification.',
    'reference mode: reference; invokeStructure: not executed.',
    '',
    'REFERENCE RECORD',
    JSON.stringify(refs, null, 2),
    '',
    'CONNECTOR ENDPOINT LEDGER',
    JSON.stringify(connectorLedger, null, 2),
    '',
    'PROTO CONNECTOR OBJECTS',
    JSON.stringify(protoConnectors, null, 2),
    '',
    'EXPORTED OBJECT INSPECTION',
    inspection.ndjson || '',
  ].join('\n');
  await fs.writeFile(`${OUT}/report.txt`, report, 'utf8');
  await fs.writeFile(`${OUT}/builder-sha256.txt`, `${await sha256(`${OUT}/deck.pptx`)}  deck.pptx\n${await sha256(`${OUT}/final-render.png`)}  final-render.png\n`, 'utf8');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

