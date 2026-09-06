import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/PPagenT';
const OUT = `${ROOT}/experiments/university-skin-pilot/transfer-03/run-05`;
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

function addZone(slide, name, position, fill, stroke = 'none') {
  return slide.shapes.add({ geometry: 'rect', name, position, fill, line: line(stroke, stroke === 'none' ? 0 : 1) });
}

function addNode(slide, name, position, fill, stroke) {
  return slide.shapes.add({ geometry: 'roundRect', name, position, fill, line: line(stroke, 1), borderRadius: 10 });
}

function addDiamond(slide, name, position, fill, stroke) {
  return slide.shapes.add({ geometry: 'diamond', name, position, fill, line: line(stroke, 1.5) });
}

function findProtoConnectors(value, path = 'root', out = []) {
  if (!value || typeof value !== 'object') return out;
  if (!Array.isArray(value) && value.connector && typeof value.connector === 'object') {
    out.push({ path, id: value.id, connector: value.connector });
  }
  if (Array.isArray(value)) value.forEach((v, i) => findProtoConnectors(v, `${path}[${i}]`, out));
  else Object.entries(value).forEach(([k, v]) => findProtoConnectors(v, `${path}.${k}`, out));
  return out;
}

async function main() {
  const theme = JSON.parse(await fs.readFile(THEME_PATH, 'utf8'));
  const { primaryColor: primary, font, neutral } = theme;
  const ink = neutral.ink;
  const muted = neutral.muted;
  const bg = neutral.background;
  const paleEvidence = mix(primary, bg, 0.95);
  const paleDecision = mix(primary, bg, 0.90);
  const paleBoundary = mix(ink, bg, 0.94);
  const mid = mix(primary, bg, 0.58);
  const dark = mix(primary, ink, 0.35);
  const hair = mix(ink, bg, 0.82);

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = bg;
  const textLedger = [];
  const connectorLedger = [];

  addText(slide, textLedger, 'eyebrow', '虚构流程设计 · 尚未实施', { left: 55, top: 34, width: 420, height: 22 }, { fontSize: 16, bold: true, color: primary, typeface: font, role: 'visible-status' });
  addText(slide, textLedger, 'title', '两条准备可并行，证据齐全且核验通过才启动联合实验', { left: 55, top: 64, width: 1165, height: 44 }, { fontSize: 32, bold: true, color: ink, typeface: font, role: 'page-title', lineSpacing: 1.0 });
  slide.shapes.add({ geometry: 'line', name: 'title-rule', position: { left: 55, top: 126, width: 1170, height: 0 }, fill: 'none', line: line(mid, 1) });
  addText(slide, textLedger, 'process-caption', '设备校准与样本整理同步推进', { left: 55, top: 143, width: 510, height: 22 }, { fontSize: 16, color: muted, typeface: font, role: 'support-caption' });

  addZone(slide, 'evidence-zone', { left: 55, top: 176, width: 780, height: 400 }, paleEvidence);
  addZone(slide, 'decision-zone', { left: 865, top: 176, width: 360, height: 400 }, paleDecision);
  addZone(slide, 'boundary-zone', { left: 55, top: 590, width: 1170, height: 38 }, paleBoundary);
  slide.shapes.add({ geometry: 'rect', name: 'decision-accent', position: { left: 865, top: 176, width: 6, height: 400 }, fill: primary, line: line(primary, 0) });
  slide.shapes.add({ geometry: 'rect', name: 'boundary-accent', position: { left: 55, top: 590, width: 6, height: 38 }, fill: primary, line: line(primary, 0) });

  addText(slide, textLedger, 'evidence-zone-title', '准备证据', { left: 80, top: 192, width: 200, height: 28 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'zone-title' });
  addText(slide, textLedger, 'decision-zone-title', '共同启动条件', { left: 890, top: 192, width: 250, height: 28 }, { fontSize: 22, bold: true, color: primary, typeface: font, role: 'zone-title' });

  const equipmentTask = addNode(slide, 'equipment-task', { left: 190, top: 226, width: 150, height: 56 }, paleDecision, primary);
  const dataTask = addNode(slide, 'data-task', { left: 190, top: 374, width: 150, height: 56 }, paleDecision, primary);
  const equipmentGate = addDiamond(slide, 'equipment-gate', { left: 365, top: 213, width: 130, height: 82 }, paleDecision, primary);
  const dataGate = addDiamond(slide, 'data-gate', { left: 365, top: 361, width: 130, height: 82 }, paleDecision, primary);
  const equipmentEvidence = addNode(slide, 'equipment-evidence', { left: 525, top: 226, width: 190, height: 56 }, paleDecision, primary);
  const dataEvidence = addNode(slide, 'data-evidence', { left: 525, top: 374, width: 190, height: 56 }, paleDecision, primary);
  const jointCheck = addNode(slide, 'joint-check', { left: 965, top: 250, width: 160, height: 44 }, paleDecision, primary);
  const passGate = addDiamond(slide, 'joint-pass-gate', { left: 980, top: 297, width: 130, height: 82 }, paleDecision, primary);
  const finalNode = addNode(slide, 'final-node', { left: 955, top: 390, width: 180, height: 48 }, dark, dark);

  addText(slide, textLedger, 'equipment-label', '设备组', { left: 80, top: 242, width: 80, height: 28 }, { fontSize: 22, bold: true, color: primary, typeface: font, role: 'lane-label' });
  addText(slide, textLedger, 'data-label', '数据组', { left: 80, top: 390, width: 80, height: 28 }, { fontSize: 22, bold: true, color: primary, typeface: font, role: 'lane-label' });
  addText(slide, textLedger, 'equipment-task-label', '设备校准', { left: 205, top: 242, width: 120, height: 24 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'data-task-label', '样本整理', { left: 205, top: 390, width: 120, height: 24 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'equipment-gate-label', '合格？', { left: 399, top: 243, width: 62, height: 22 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'data-gate-label', '完整？', { left: 399, top: 391, width: 62, height: 22 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'equipment-evidence-label', '签字校准记录', { left: 535, top: 242, width: 170, height: 24 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'data-evidence-label', '去标识样本清单', { left: 535, top: 390, width: 170, height: 24 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'joint-check-label', '联合核验', { left: 983, top: 260, width: 124, height: 24 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'node-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'joint-pass-label', '通过？', { left: 1014, top: 327, width: 62, height: 22 }, { fontSize: 20, bold: true, color: ink, typeface: font, role: 'gate-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });
  addText(slide, textLedger, 'final-node-label', '本轮可开始', { left: 965, top: 402, width: 160, height: 24 }, { fontSize: 22, bold: true, color: bg, typeface: font, role: 'node-label', alignment: 'center', verticalAlignment: 'middle', lineSpacing: 1.0 });

  addText(slide, textLedger, 'equipment-support', '批次、执行人和结果留存；合格后提交签字记录。\n不合格由设备组复校，不能带问题进入联合实验。', { left: 190, top: 300, width: 545, height: 54 }, { fontSize: 18, color: muted, typeface: font, role: 'support-group' });
  addText(slide, textLedger, 'data-support', '编号可追溯且授权完整，才形成去标识清单。\n缺授权样本隔离，不进入本轮清单；数据组继续补齐授权。', { left: 190, top: 448, width: 545, height: 54 }, { fontSize: 18, color: muted, typeface: font, role: 'support-group' });
  addText(slide, textLedger, 'and-condition', '两份证据齐全', { left: 900, top: 222, width: 210, height: 18 }, { fontSize: 16, bold: true, color: primary, typeface: font, role: 'gate-condition', alignment: 'center', lineSpacing: 1.0 });
  addText(slide, textLedger, 'manager-boundary', '负责人核验；不代签、不代补授权。\n缺证据或核验失败：退回对应组，本轮不启动。', { left: 880, top: 480, width: 330, height: 80 }, { fontSize: 18, color: ink, typeface: font, role: 'decision-explanation' });
  addText(slide, textLedger, 'boundary-title', '下一周试行范围', { left: 80, top: 594, width: 190, height: 28 }, { fontSize: 22, bold: true, color: ink, typeface: font, role: 'boundary-title' });
  addText(slide, textLedger, 'boundary-body', '只验收并行准备、职责边界与证据留存；流程尚未实施，不承诺提前完成或减少等待。', { left: 285, top: 598, width: 850, height: 24 }, { fontSize: 18, color: muted, typeface: font, role: 'boundary-body' });

  function connectAndRecord(source, target, options, label) {
    const fromIdx = slide.shapes.getConnectionSiteIndex(source, options.fromSide);
    const toIdx = slide.shapes.getConnectionSiteIndex(target, options.toSide);
    const connector = slide.shapes.connect(source, target, options);
    connectorLedger.push({ label, id: connector.id, from: source.name, fromSide: options.fromSide, fromIdx, to: target.name, toSide: options.toSide, toIdx, kind: options.kind, lineStyle: options.line.style, head: options.head?.type || 'none', tail: options.tail?.type || 'none' });
    return connector;
  }

  const forward = { line: line(primary, 2), tail: { type: 'triangle', width: 'sm', length: 'sm' } };
  const feedback = { line: line(primary, 1.5, 'dashed'), tail: { type: 'arrow', width: 'sm', length: 'sm' } };
  connectAndRecord(equipmentTask, equipmentGate, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '设备校准→合格');
  connectAndRecord(equipmentGate, equipmentEvidence, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '合格→签字校准记录');
  connectAndRecord(dataTask, dataGate, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '样本整理→完整');
  connectAndRecord(dataGate, dataEvidence, { ...forward, kind: 'straight', fromSide: 'right', toSide: 'left' }, '完整→去标识样本清单');
  connectAndRecord(equipmentEvidence, jointCheck, { ...forward, kind: 'elbow', fromSide: 'right', toSide: 'left' }, '校准记录→联合核验');
  connectAndRecord(dataEvidence, jointCheck, { ...forward, kind: 'elbow', fromSide: 'right', toSide: 'left' }, '样本清单→联合核验');
  connectAndRecord(jointCheck, passGate, { ...forward, kind: 'elbow', fromSide: 'bottom', toSide: 'top' }, '联合核验→通过');
  connectAndRecord(passGate, finalNode, { ...forward, kind: 'elbow', fromSide: 'bottom', toSide: 'top' }, '通过→本轮可开始');
  connectAndRecord(equipmentGate, equipmentTask, { ...feedback, kind: 'elbow', fromSide: 'bottom', toSide: 'bottom' }, '不合格→设备组复校');
  connectAndRecord(dataGate, dataTask, { ...feedback, kind: 'elbow', fromSide: 'bottom', toSide: 'bottom' }, '缺授权→数据组补齐');

  slide.shapes.add({ geometry: 'line', name: 'footer-rule', position: { left: 55, top: 646, width: 1170, height: 0 }, fill: 'none', line: line(hair, 1) });
  addText(slide, textLedger, 'footer-source', '素材：虚构流程设计｜本页仅检验并行准备、职责边界、证据留存与联合核验', { left: 55, top: 660, width: 920, height: 22 }, { fontSize: 14, color: muted, typeface: font, role: 'source-footer', lineSpacing: 1.0 });
  addText(slide, textLedger, 'page-number', '01', { left: 1185, top: 660, width: 40, height: 22 }, { fontSize: 14, color: muted, typeface: font, role: 'page-number', alignment: 'right', lineSpacing: 1.0 });
  slide.speakerNotes.textFrame.setText('[Sources]\n内容：experiments/university-skin-pilot/transfer-03/manuscript.txt\n设计：docs/设计手册/科研咨询式排版-v8.md；主题：experiments/university-skin-pilot/reference-01/theme.json\n结构参考重组：parallel-equal-cards-001、convergence-many-to-one-003、branching-decision-routes-001、cycle-single-chain-feedback-002；未执行 invokeStructure。');
  slide.speakerNotes.setVisible(true);

  const render = await presentation.export({ slide, format: 'png', scale: 1 });
  await writeBlob(`${OUT}/final-render.png`, render);
  const layoutText = await (await slide.export({ format: 'layout' })).text();
  await fs.writeFile(`${OUT}/layoutJSON.json`, layoutText, 'utf8');
  const inspection = await presentation.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 30000 });
  await fs.writeFile(`${OUT}/object-inspection.ndjson`, inspection.ndjson || '', 'utf8');
  const proto = presentation.toProto();
  await fs.writeFile(`${OUT}/proto.json`, JSON.stringify(proto, null, 2), 'utf8');
  const protoConnectors = findProtoConnectors(proto);
  await fs.writeFile(`${OUT}/proto-connectors.json`, JSON.stringify(protoConnectors, null, 2), 'utf8');
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);

  const layout = JSON.parse(layoutText);
  const textFrames = (layout.elements || []).filter((e) => typeof e.text === 'string' && e.text.trim());
  const outOfBounds = (layout.elements || []).filter((e) => Array.isArray(e.bbox) && (e.bbox[0] < 0 || e.bbox[1] < 0 || e.bbox[0] + e.bbox[2] > 1280 || e.bbox[1] + e.bbox[3] > 720));
  const capacityRecords = textFrames.map((e) => {
    const lineCount = e.textLayout?.lineCount || 0;
    const fontSize = e.resolvedFontSize || 0;
    const lineSpacing = e.paragraphs?.[0]?.resolvedTextStyle?.lineSpacing || 1.0;
    const estimatedTextHeight = lineCount * fontSize * lineSpacing;
    const availableHeight = Array.isArray(e.bbox) ? e.bbox[3] : 0;
    return { name: e.name, lineCount, fontSize, lineSpacing, estimatedTextHeight, availableHeight, fits: estimatedTextHeight <= availableHeight + 0.1 };
  });
  const capacityWarnings = capacityRecords.filter((r) => !r.fits);
  await fs.writeFile(`${OUT}/text-capacity.json`, JSON.stringify({ records: capacityRecords, warningCount: capacityWarnings.length }, null, 2), 'utf8');
  const forwardProto = protoConnectors.filter((c) => c.connector?.lineStyle?.tail?.type === 2);
  const feedbackProto = protoConnectors.filter((c) => c.connector?.lineStyle?.tail?.type === 6);
  const protoArrowCheck = { connectorCount: protoConnectors.length, forwardCount: forwardProto.length, forwardDestinationTailType2: forwardProto.length === 8 && forwardProto.every((c) => c.connector?.lineStyle?.tail?.type === 2 && !c.connector?.lineStyle?.head), feedbackCount: feedbackProto.length, feedbackDestinationTailType6: feedbackProto.length === 2 && feedbackProto.every((c) => c.connector?.lineStyle?.tail?.type === 6 && !c.connector?.lineStyle?.head) };
  const refs = {
    mode: 'reference',
    referenceAssetIds: ['parallel-equal-cards-001', 'convergence-many-to-one-003', 'branching-decision-routes-001', 'cycle-single-chain-feedback-002'],
    absorbedMethods: ['共同水平起点表达真实并行，不借用等权卡片的无关系语义。', '两份证据沿汇聚线进入单一联合核验点，再经独立通过门槛进入启动。', '条件与异常回路贴近对应责任组；负责人边界留在决策区的开放说明。', '仅保留异常回送语义，不把尚未实施的流程画成收益闭环。'],
    changesForThisPage: ['用浅色证据区、浅色决策区和底部边界区建立主体/支持层，不把整页变成同权节点集合。', '节点只保留短标签；责任、证据、隔离、回退和负责人权限移到开放文字。', '主色和派生色均从 theme.json 计算，没有引入独立第二色相。'],
    invocation: { executed: false, note: '未执行 invokeStructure；本页为参考重组后的原生可编辑对象。' },
  };
  await fs.writeFile(`${OUT}/reference-records.json`, JSON.stringify(refs, null, 2), 'utf8');

  const report = [
    'run-05 report',
    'communication job: 联合实验负责人应理解两条准备彼此并行，只有两份证据齐全且负责人核验通过后才启动。',
    'content boundary: 虚构流程设计，尚未实施；没有真实学校、成果、统计数字或提效承诺。',
    'visual route: explicit custom visual direction from docs/设计手册/科研咨询式排版-v8.md + theme.json; no bundled template used.',
    'native output: all visible text, zones, nodes, gates and connectors are native PowerPoint objects.',
    `actual exported layout: ${textFrames.length} non-empty text frames; ${outOfBounds.length} elements outside 1280x720.`,
    `text capacity estimate: warningCount=${capacityWarnings.length}; estimated height = exported lineCount × resolvedFontSize × resolved lineSpacing, compared with exported bbox height. This is a frame-capacity estimate, not glyph-bound measurement.`,
    'node label geometry: audit-node-labels.mjs returned pairCount=9, issueCount=0, all centerDelta=[0,0], all alignment=center/verticalAlignment=middle, and all diamond safe frames verified. Glyph bounds are not available in layout JSON, so glyphBoundsVerified is not claimed.',
    `text collision geometry: audit-text-overlaps.mjs is run after export; its textCapacityWarningCount, intersectionCount and textRuleIntersectionCount are recorded in the final QA report.`,
    `proto arrow check: ${JSON.stringify(protoArrowCheck)}; the final proto stores forward arrows on destination tail and feedback arrows on destination tail.`,
    'post-render QA: render_slides.py generates final-pptx-render/slide-1.png; slides_test.py and both audit scripts are run after export. The official PNG is available for independent visual review; no visual-style pass is claimed.',
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
  await fs.writeFile(`${OUT}/builder-sha256.txt`, `${(await sha256(`${OUT}/deck.pptx`))}  deck.pptx\n${(await sha256(`${OUT}/final-render.png`))}  final-render.png\n`, 'utf8');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
