import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../../src/runtime/skins/northeastern-university.mjs';
import { universityMckinseySkin } from '../../../src/runtime/skins/university-mckinsey.mjs';
import { resolveStructureTheme } from '../../../src/visual-runtime/html-component-theme.mjs';

const RUN = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(RUN, '../../..');
const TASK = path.resolve(RUN, '..');
const DRAFT = path.join(RUN, '.build', 'candidate.pptx');
const FINAL = path.join(RUN, 'deck.pptx');
const THEME = resolveStructureTheme(universityMckinseySkin);
const F = universityMckinseySkin.fonts;
const C = {
  blue: THEME.primaryColor,
  blueDark: THEME.primaryDark,
  bluePale: THEME.primaryWash,
  blueLight: THEME.primaryPale,
  ink: THEME.dark,
  body: THEME.body,
  muted: THEME.muted,
  line: THEME.line,
  white: '#FFFFFF',
  soft: '#F4F7FA',
  green: '#3F7A67',
  greenLight: '#EAF3EF',
  amber: '#B77B24',
  amberLight: '#F7EEDC',
  red: '#A5504B',
};

function addText(slide, text, position, opts = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox', name: opts.name, position, fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.typeface ?? F.body,
    fontSize: opts.fontSize ?? 18,
    color: opts.color ?? C.body,
    bold: opts.bold ?? false,
    alignment: opts.align ?? 'left',
    verticalAlignment: opts.valign ?? 'top',
    autoFit: 'none',
  };
  return shape;
}

function addRect(slide, position, opts = {}) {
  return slide.shapes.add({
    geometry: opts.geometry ?? 'rect', name: opts.name, position,
    fill: opts.fill ?? C.white,
    line: { style: 'solid', fill: opts.line ?? 'none', width: opts.lineWidth ?? 0 },
    borderRadius: opts.radius,
  });
}

function addLine(slide, x1, y1, x2, y2, color = C.line, width = 1) {
  const left = Math.min(x1, x2); const top = Math.min(y1, y2);
  return slide.shapes.add({ geometry: 'line', position: { left, top, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }, fill: 'none', line: { style: 'solid', fill: color, width } });
}

function addPill(slide, text, position, fill, color = C.blueDark) {
  const p = addRect(slide, position, { fill, radius: 9 });
  p.text = text;
  p.text.style = { typeface: F.body, fontSize: 14, bold: true, color, alignment: 'center', verticalAlignment: 'middle', autoFit: 'none' };
  return p;
}

function addMeta(slide, text, x, y, width = 900) {
  addText(slide, text, { left: x, top: y, width, height: 26 }, { fontSize: 14, color: C.muted });
}

function buildPage1(slide) {
  addMeta(slide, '口径一致：每月当月收到的请求，回看是否在两个工作日内首次给出可执行答复。', 55, 194, 850);
  addPill(slide, '模拟数据', { left: 1080, top: 174, width: 145, height: 28 }, C.blueLight);

  addRect(slide, { left: 55, top: 246, width: 800, height: 352 }, { fill: C.bluePale, line: C.line, lineWidth: 1 });
  addText(slide, '请求量上升，及时响应比例下降', { left: 82, top: 268, width: 400, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  addText(slide, '每月请求量与其中及时首次响应的数量', { left: 82, top: 304, width: 410, height: 24 }, { fontSize: 14, color: C.muted });
  addText(slide, '数量', { left: 610, top: 302, width: 70, height: 22 }, { fontSize: 14, color: C.muted, align: 'right' });
  addText(slide, '中位首次响应时间', { left: 700, top: 302, width: 126, height: 22 }, { fontSize: 14, color: C.muted, align: 'right' });
  const rows = [
    ['1月', 120, 96, '80%', '1.3'],
    ['2月', 150, 114, '76%', '1.5'],
    ['3月', 180, 126, '70%', '1.8'],
    ['4月', 240, 144, '60%', '2.4'],
  ];
  const scale = 2.35;
  rows.forEach(([month, total, timely, pct, median], i) => {
    const y = 350 + i * 55;
    addText(slide, month, { left: 82, top: y + 4, width: 48, height: 24 }, { fontSize: 18, bold: i === 3, color: C.ink });
    addRect(slide, { left: 140, top: y + 2, width: total * scale, height: 18 }, { fill: '#B9C9D8', radius: 4 });
    addRect(slide, { left: 140, top: y + 2, width: timely * scale, height: 18 }, { fill: i === 3 ? C.blueDark : C.blue, radius: 4 });
    addText(slide, `${timely}/${total}`, { left: 515, top: y - 1, width: 88, height: 24 }, { fontSize: 18, bold: true, color: C.ink, align: 'right' });
    addText(slide, pct, { left: 608, top: y - 1, width: 62, height: 24 }, { fontSize: 18, bold: true, color: i === 3 ? C.blueDark : C.body, align: 'right' });
    addText(slide, `${median} 日`, { left: 704, top: y - 1, width: 112, height: 24 }, { fontSize: 18, bold: i === 3, color: i === 3 ? C.red : C.body, align: 'right' });
    if (i < rows.length - 1) addLine(slide, 82, y + 38, 820, y + 38, C.line, 1);
  });
  addText(slide, '蓝色：两工作日内首次可执行答复', { left: 140, top: 555, width: 300, height: 22 }, { fontSize: 14, color: C.blueDark });
  addText(slide, '灰色部分：其余请求', { left: 458, top: 555, width: 190, height: 22 }, { fontSize: 14, color: C.muted });

  addRect(slide, { left: 890, top: 246, width: 335, height: 352 }, { fill: C.white, line: C.line, lineWidth: 1 });
  addText(slide, '读图结论', { left: 918, top: 268, width: 180, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, '工作量翻倍', { left: 918, top: 320, width: 200, height: 28 }, { fontSize: 21, bold: true, color: C.ink });
  addText(slide, '120 → 240 个请求', { left: 918, top: 351, width: 240, height: 25 }, { fontSize: 18, color: C.body });
  addLine(slide, 918, 390, 1197, 390, C.line, 1);
  addText(slide, '及时比例下降', { left: 918, top: 410, width: 220, height: 28 }, { fontSize: 21, bold: true, color: C.ink });
  addText(slide, '80% → 60%（下降20个百分点）', { left: 918, top: 441, width: 280, height: 25 }, { fontSize: 18, color: C.blueDark });
  addText(slide, '中位时间升至2.4个工作日', { left: 918, top: 486, width: 270, height: 25 }, { fontSize: 18, bold: true, color: C.red });
  addText(slide, '人员数保持不变；无对照实验，不能断言工作量增长是响应变慢的唯一原因。', { left: 918, top: 532, width: 278, height: 50 }, { fontSize: 14, color: C.body });
  addMeta(slide, '注：该指标不是结案时长；每月无缺失记录。', 55, 620, 600);
}

function buildPage2(slide) {
  addMeta(slide, '复核对象：4月未达到两个工作日响应标准的96个请求；分类互斥且合计完整。', 55, 194, 850);
  addPill(slide, '模拟数据', { left: 1080, top: 174, width: 145, height: 28 }, C.blueLight);
  addRect(slide, { left: 55, top: 246, width: 800, height: 352 }, { fill: C.bluePale, line: C.line, lineWidth: 1 });
  addText(slide, '阻塞原因集中在材料与权限环节', { left: 82, top: 268, width: 430, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  addText(slide, '96个未达标请求，每个请求只记一个主要原因', { left: 82, top: 304, width: 440, height: 24 }, { fontSize: 14, color: C.muted });
  const causes = [['材料不全', 42, C.blueDark], ['权限确认', 30, C.blue], ['需求反复', 16, C.amber], ['其他', 8, '#9CA7B3']];
  let x = 82;
  const barY = 360; const barW = 720 / 96;
  causes.forEach(([label, n, color], i) => {
    const w = n * barW;
    addRect(slide, { left: x, top: barY, width: w, height: 64 }, { fill: color });
    if (w > 90) addText(slide, `${label}\n${n}（${Math.round(n / 96 * 100)}%）`, { left: x + 4, top: barY + 10, width: w - 8, height: 46 }, { fontSize: 17, bold: true, color: C.white, align: 'center', valign: 'middle' });
    else addText(slide, `${label} ${n}`, { left: x, top: barY + 72, width: w, height: 24 }, { fontSize: 14, color: C.body, align: 'center' });
    x += w;
  });
  addText(slide, '材料与权限', { left: 82, top: 458, width: 250, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, '42 + 30 = 72 个请求', { left: 82, top: 493, width: 280, height: 28 }, { fontSize: 21, bold: true, color: C.ink });
  addText(slide, '占未达标请求 75%', { left: 530, top: 480, width: 270, height: 44 }, { fontSize: 32, bold: true, color: C.blueDark, align: 'right' });
  addText(slide, '4月请求构成（全部240个）', { left: 82, top: 548, width: 260, height: 22 }, { fontSize: 14, color: C.muted });
  const mix = [['数据提取', 120], ['数据清洗', 72], ['权限开通', 48]];
  let mx = 340;
  mix.forEach(([label, n], i) => { const w = n * 1.55; addRect(slide, { left: mx, top: 548, width: w, height: 20 }, { fill: [C.blueDark, C.blue, '#AFC1D0'][i] }); addText(slide, `${label} ${n}`, { left: mx, top: 573, width: w, height: 22 }, { fontSize: 14, color: C.body, align: 'center' }); mx += w; });

  addRect(slide, { left: 890, top: 246, width: 335, height: 352 }, { fill: C.white, line: C.line, lineWidth: 1 });
  addText(slide, '这组数据支持的判断', { left: 918, top: 268, width: 270, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, '材料与权限是主要阻塞环节，统一入口与这两个环节有直接对应关系。', { left: 918, top: 320, width: 270, height: 76 }, { fontSize: 18, color: C.ink });
  addLine(slide, 918, 420, 1197, 420, C.line, 1);
  addText(slide, '边界', { left: 918, top: 440, width: 100, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  addText(slide, '复核分类不等于措施可消除的数量，也不能据此预测节省工时。', { left: 918, top: 478, width: 270, height: 66 }, { fontSize: 18, color: C.body });
}

function buildPage3(slide) {
  addMeta(slide, '投入与周期为内部方案估计；B尚未实施，人日是实施工作量，不能换算响应改善。', 55, 194, 900);
  addPill(slide, '模拟估计', { left: 1080, top: 174, width: 145, height: 28 }, C.amberLight, C.amber);
  addRect(slide, { left: 55, top: 246, width: 1170, height: 54 }, { fill: C.greenLight, line: C.green, lineWidth: 1 });
  addText(slide, '建议先试行 B 统一申请入口', { left: 78, top: 258, width: 320, height: 28 }, { fontSize: 21, bold: true, color: C.green });
  addText(slide, '72/96 个未达标请求属于材料或权限阻塞，B直接作用于提交时字段与授权校验', { left: 410, top: 261, width: 760, height: 24 }, { fontSize: 18, color: C.body });
  const cols = [{ x: 235, w: 310, title: 'A 临时增加值班', fill: C.bluePale, color: C.blueDark }, { x: 545, w: 310, title: 'B 统一申请入口', fill: C.greenLight, color: C.green }, { x: 855, w: 370, title: 'C 批量自动预检', fill: C.bluePale, color: C.blueDark }];
  addText(slide, '比较项', { left: 55, top: 319, width: 160, height: 28 }, { fontSize: 21, bold: true, color: C.blueDark });
  cols.forEach(c => { addRect(slide, { left: c.x, top: 310, width: c.w, height: 48 }, { fill: c.fill, line: C.line, lineWidth: 1 }); addText(slide, c.title, { left: c.x + 10, top: 321, width: c.w - 20, height: 26 }, { fontSize: 21, bold: true, color: c.color, align: 'center' }); });
  const rows = [
    ['直接作用环节', '人工响应排队', '提交时字段与授权校验', '重复性材料格式检查'],
    ['初期投入', '8人日', '12人日', '30人日'],
    ['预计上线周期', '1周', '2周', '6周'],
    ['持续维护', '每周2人日值班', '每周0.5人日规则维护', '每周1人日规则维护'],
    ['当前依赖', '可调配值班人员', '三类请求字段达成一致', '稳定字段及可机器判断的规则'],
    ['主要限制', '不直接解决材料缺失', '不消除复杂需求沟通', '不替代人工授权判断'],
  ];
  rows.forEach((row, i) => { const y = 358 + i * 43; addRect(slide, { left: 55, top: y, width: 1170, height: 43 }, { fill: i % 2 ? C.white : C.soft, line: C.line, lineWidth: 1 }); addText(slide, row[0], { left: 67, top: y + 9, width: 155, height: 26 }, { fontSize: 18, bold: true, color: C.body }); addText(slide, row[1], { left: 247, top: y + 8, width: 280, height: 28 }, { fontSize: 18, color: C.body }); addText(slide, row[2], { left: 557, top: y + 8, width: 280, height: 28 }, { fontSize: 18, color: C.green, bold: i === 0 }); addText(slide, row[3], { left: 867, top: y + 8, width: 340, height: 28 }, { fontSize: 18, color: C.body }); });
  addText(slide, 'A保留为短期高峰应急；C待入口规则稳定后再评估。', { left: 55, top: 625, width: 800, height: 22 }, { fontSize: 14, color: C.muted });
}

function buildPage4(slide) {
  addMeta(slide, '六周试点按先统一字段、再单类试用、后复核扩围推进；每阶段都有进入条件。', 55, 194, 900);
  addPill(slide, '模拟计划', { left: 1080, top: 174, width: 145, height: 28 }, C.blueLight);
  const phases = [
    { x: 55, w: 355, weeks: '第1—2周', title: '统一字段与授权责任', body: '负责人联合三类请求经办人，形成字段字典、授权清单和统一入口。', gate: '进入下一阶段：三类请求均完成一轮实际样本填写检查，无关键必填字段缺失。', fill: C.bluePale, color: C.blueDark },
    { x: 435, w: 355, weeks: '第3—4周', title: '只在数据提取请求试用', body: '保存缺失字段、退回原因和首次响应记录，不同时覆盖其他两类。', gate: '扩大条件：记录完整，且未发现会阻断提交的高频规则错误。否则回到字段和规则修订。', fill: C.greenLight, color: C.green },
    { x: 815, w: 410, weeks: '第5—6周', title: '负责人复核后决定扩围', body: '复核试点数据，再决定是否扩大到数据清洗和权限开通。', gate: '评估：两工作日内响应比例、材料退回比例、经办人维护时间。目标值根据试点基线确定。', fill: C.amberLight, color: C.amber },
  ];
  phases.forEach((p, i) => { addRect(slide, { left: p.x, top: 252, width: p.w, height: 298 }, { fill: p.fill, line: C.line, lineWidth: 1 }); addText(slide, p.weeks, { left: p.x + 22, top: 272, width: p.w - 44, height: 28 }, { fontSize: 21, bold: true, color: p.color }); addText(slide, p.title, { left: p.x + 22, top: 320, width: p.w - 44, height: 32 }, { fontSize: 21, bold: true, color: C.ink }); addText(slide, p.body, { left: p.x + 22, top: 368, width: p.w - 44, height: 68 }, { fontSize: 18, color: C.body }); addLine(slide, p.x + 22, 450, p.x + p.w - 22, 450, C.line, 1); addText(slide, p.gate, { left: p.x + 22, top: 466, width: p.w - 44, height: 68 }, { fontSize: 17, color: C.body }); });
  addLine(slide, 410, 401, 435, 401, C.blueDark, 2); addRect(slide, { left: 421, top: 395, width: 12, height: 12 }, { geometry: 'rightArrow', fill: C.blueDark });
  addLine(slide, 790, 401, 815, 401, C.blueDark, 2); addRect(slide, { left: 801, top: 395, width: 12, height: 12 }, { geometry: 'rightArrow', fill: C.blueDark });
  addText(slide, '若出现高频规则错误，回到字段和规则修订', { left: 390, top: 566, width: 430, height: 22 }, { fontSize: 14, color: C.red, align: 'center' });
  addLine(slide, 610, 550, 610, 590, C.red, 2); addLine(slide, 610, 590, 230, 590, C.red, 2); addLine(slide, 230, 590, 230, 550, C.red, 2); addRect(slide, { left: 224, top: 550, width: 12, height: 12 }, { geometry: 'leftArrow', fill: C.red });
  addMeta(slide, '边界：B尚未实施，不能宣称已有改善，也不能承诺消除所有材料与权限阻塞。', 55, 620, 1100);
}

function setNotes(slide, pageNumber) {
  const source = ['[Sources]', '- 内容：experiments/neu-mckinsey-fixed-rules-20260909/inputs/manuscript.txt', '- 视觉：assets/主题/东北大学-001/runtime-template.pptx（大学 Skin＋麦肯锡式）', `- PPagenT：fixed-rules-p${pageNumber} → northeastern-university-body-001`, '[/Sources]'];
  const method = pageNumber === 1 ? '本页采纳参考观察：将密集表格转为共同口径的横向比较，直接显示数量、比例和中位时间。' : pageNumber === 2 ? '本页采纳参考观察：把原因复核变成完整构成条，并保留4月请求构成作为上下文。' : pageNumber === 3 ? '本页采纳参考观察：比较页保留共同维度表，用强调列标出推荐依据，不把估计改成结果。' : '本页采纳参考观察：用真实阶段和门槛组织流程，保留回退条件与评估指标的区别。';
  slide.speakerNotes.textFrame.setText([...source, method].join('\n')); slide.speakerNotes.setVisible(true);
}

async function main() {
  const pages = [
    { intent: { intentId: 'reference-study-p1' }, decision: { selectedAssetId: 'northeastern-university-body-001' }, meta: { sectionName: '历史观察' }, content: { pageId: 'p1', title: '工作量翻倍，及时首次响应比例降至60%' }, payload: { assetId: 'northeastern-university-body-001', parameters: {} } },
    { intent: { intentId: 'reference-study-p2' }, decision: { selectedAssetId: 'northeastern-university-body-001' }, meta: { sectionName: '原因复核' }, content: { pageId: 'p2', title: '4月超时请求中，材料与权限阻塞占75%' }, payload: { assetId: 'northeastern-university-body-001', parameters: {} } },
    { intent: { intentId: 'reference-study-p3' }, decision: { selectedAssetId: 'northeastern-university-body-001' }, meta: { sectionName: '方案比较' }, content: { pageId: 'p3', title: '应对措施先选B，因其直接作用于主要阻塞环节' }, payload: { assetId: 'northeastern-university-body-001', parameters: {} } },
    { intent: { intentId: 'reference-study-p4' }, decision: { selectedAssetId: 'northeastern-university-body-001' }, meta: { sectionName: '有限试点' }, content: { pageId: 'p4', title: '先用6周验证统一入口，再决定是否扩大范围' }, payload: { assetId: 'northeastern-university-body-001', parameters: {} } },
  ];
  const starter = await createNortheasternUniversityStarter({ pages, starterPptx: path.join(RUN, '.build', 'template-starter.pptx'), manuscriptSource: 'experiments/neu-mckinsey-fixed-rules-20260909/inputs/manuscript.txt' });
  buildPage1(starter.slides[0]); buildPage2(starter.slides[1]); buildPage3(starter.slides[2]); buildPage4(starter.slides[3]);
  starter.slides.forEach((slide, index) => setNotes(slide, index + 1));
  await fs.mkdir(path.dirname(DRAFT), { recursive: true });
  await (await PresentationFile.exportPptx(starter.presentation)).save(DRAFT);
  const inspect = await starter.presentation.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 50000 });
  await fs.writeFile(path.join(RUN, 'inspect-final.ndjson'), inspect.ndjson, 'utf8');
  const skillDir = 'C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
  const stagingDir = path.join(TASK, '.codex-finalizer'); await fs.mkdir(stagingDir, { recursive: true });
  await finalizePresentation({
    explicitTotalSlideCount: 4,
    sourceTemplatePath: path.join(ROOT, 'assets/主题/东北大学-001/runtime-template.pptx'),
    requiredTemplateReferenceSlides: [1, 2, 3, 4],
    minimumTemplateCoverageRatio: 1,
    workspaceDir: TASK,
    candidatePath: DRAFT,
    finalPath: FINAL,
    pythonExecutable: 'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
    integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
    layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
    layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit'],
    fontPolicy: { basis: 'design', families: ['HYWenRunSongYun U', 'Microsoft YaHei', '汉仪粗宋简'] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, 'deck.pptx.validation.json'),
  });
  console.log(FINAL);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
