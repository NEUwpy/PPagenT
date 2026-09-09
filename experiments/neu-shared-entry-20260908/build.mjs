import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin, universityMckinseyTypography } from '../../src/runtime/invoke-university-structure.mjs';
import { addBox, addText } from '../../src/asset-runtime/component-builders.mjs';
import { resolveStructureTheme } from '../../src/visual-runtime/html-component-theme.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'experiments', 'neu-shared-entry-20260908');
const runtimeDir = path.join(outDir, '.runtime');
const outputPptx = path.join(outDir, 'northeastern-shared-entry.pptx');
const evidencePath = path.join(outDir, 'invoke-log-revision.ndjson');
const manuscriptSource = '用户提供模拟业务稿件：共享仪器平台预约试点';

const bodyFrame = universityMckinseySkin.bodyFrame;
const theme = resolveStructureTheme(universityMckinseySkin);
const type = universityMckinseyTypography;

const pages = [
  {
    content: { pageId: 'neu-p1', title: '登记口径先覆盖四类信息，后续追溯才有据可查' },
    meta: { sectionName: '追溯闭环' },
    intent: { intentId: 'claim-traceability-fields' },
    decision: { selectedAssetId: 'parallel-folded-notes-grid-002' },
    payload: {
      assetId: 'parallel-folded-notes-grid-002',
      parameters: {
        items: [
          { key: 'source', title: '申请来源', body: '申请人、课题与来源渠道', iconKey: 'user-check' },
          { key: 'approval', title: '审批依据', body: '责任人、确认时间与依据', iconKey: 'clipboard-check' },
          { key: 'result', title: '执行结果', body: '参数、输出记录', iconKey: 'chart-line' },
          { key: 'exception', title: '异常处置', body: '原因与处置结论', iconKey: 'alert-triangle' },
        ],
      },
    },
  },
  {
    content: { pageId: 'neu-p2', title: '三类来源进入试点，都要依次通过三道纳入关' },
    meta: { sectionName: '纳入机制' },
    intent: { intentId: 'claim-admission-gates' },
    decision: { selectedAssetId: 'convergence-simple-funnel-001' },
    payload: {
      assetId: 'convergence-simple-funnel-001',
      parameters: {
        inputs: [
          { key: 'self', label: '自荐', iconQuery: 'users' },
          { key: 'platform', label: '推荐', iconQuery: 'building-community' },
          { key: 'cross', label: '合作', iconQuery: 'arrows-left-right' },
        ],
        steps: [
          { key: 'eligibility', title: '资格核对' },
          { key: 'accountability', title: '责任确认' },
          { key: 'recording', title: '记录准备' },
        ],
      },
    },
  },
  {
    content: { pageId: 'neu-p3', title: '当前处于统一登记级，下一步先关联执行与异常记录' },
    meta: { sectionName: '能力建设' },
    intent: { intentId: 'claim-capability-roadmap' },
    decision: { selectedAssetId: 'progression-maturity-steps-002' },
    payload: {
      assetId: 'progression-maturity-steps-002',
      parameters: {
        levels: [
          { key: 'communicate', title: '临时沟通', body: '临时沟通依赖' },
          { key: 'register', title: '统一登记', body: '统一字段登记' },
          { key: 'trace', title: '过程追溯', body: '执行异常关联' },
          { key: 'improve', title: '持续改进', body: '复盘优化机制' },
        ],
        showStatus: true,
        currentIndex: 1,
      },
    },
  },
];

function text(slide, value, frame, style = {}) {
  return addText(slide, value, frame, {
    typeface: universityMckinseySkin.fonts.body,
    autoFit: 'none',
    verticalAlignment: 'top',
    ...style,
  });
}

function accent(slide, left, top, height) {
  addBox(slide, { left, top, width: 6, height }, {
    geometry: 'rect', fill: theme.primaryColor, line: { style: 'solid', fill: 'none', width: 0 }, shadow: 'shadow-none', borderRadius: 0,
  });
}

function separator(slide, left, top, width) {
  addBox(slide, { left, top, width, height: 1 }, {
    geometry: 'rect', fill: theme.line, line: { style: 'solid', fill: 'none', width: 0 }, shadow: 'shadow-none', borderRadius: 0,
  });
}

function addTraceabilityNote(slide) {
  const left = 895;
  accent(slide, left, 228, 286);
  text(slide, '字段范围', { left: left + 24, top: 230, width: 270, height: 25 }, { fontSize: type.meta, bold: true, color: theme.primaryColor });
  text(slide, '四类信息各有追溯作用', { left: left + 24, top: 272, width: 270, height: 54 }, { fontSize: type.heading, bold: true, color: theme.dark });
  text(slide, '申请来源与审批依据说明入口。\n执行结果与异常处置保留后续核查依据。', { left: left + 24, top: 356, width: 270, height: 90 }, { fontSize: type.body, color: theme.body });
  separator(slide, left + 24, 470, 270);
  text(slide, '保留字段，才能积累可追溯证据', { left: left + 24, top: 490, width: 270, height: 46 }, { fontSize: type.body, bold: true, color: theme.primaryColor });
}

function addSourceLabels(slide) {
  const labels = [
    ['课题组自荐', 300, 260, 110],
    ['平台推荐', 425, 242, 100],
    ['跨团队合作', 535, 258, 120],
  ];
  labels.forEach(([value, left, top, width]) => text(slide, value, { left, top, width, height: 30 }, {
    fontSize: type.body, bold: true, color: theme.primaryColor, alignment: 'center',
  }));
}

function addAdmissionNote(slide) {
  const left = 895;
  accent(slide, left, 218, 332);
  text(slide, '三类来源', { left: left + 24, top: 220, width: 270, height: 24 }, { fontSize: type.meta, bold: true, color: theme.primaryColor });
  text(slide, '三类来源共用纳入路径', { left: left + 24, top: 262, width: 270, height: 58 }, { fontSize: type.heading, bold: true, color: theme.dark });
  text(slide, '完成记录准备后，才纳入试点。', { left: left + 24, top: 376, width: 270, height: 58 }, { fontSize: type.body, color: theme.body });
}

function addCapabilityNote(slide) {
  const left = 895;
  accent(slide, left, 236, 264);
  text(slide, '下一步', { left: left + 24, top: 238, width: 270, height: 24 }, { fontSize: type.meta, bold: true, color: theme.primaryColor });
  text(slide, '先关联执行与异常记录', { left: left + 24, top: 280, width: 270, height: 58 }, { fontSize: type.heading, bold: true, color: theme.dark });
  text(slide, '先把执行与异常记录连起来。\n再用积累数据定期复盘。', { left: left + 24, top: 366, width: 270, height: 78 }, { fontSize: type.body, color: theme.body });
  separator(slide, left + 24, 470, 270);
  text(slide, '近期形成关联记录，后续再设复盘周期', { left: left + 24, top: 490, width: 270, height: 48 }, { fontSize: type.body, bold: true, color: theme.primaryColor });
}

async function main() {
  await fs.mkdir(runtimeDir, { recursive: true });
  try { await fs.access(evidencePath); } catch { await fs.writeFile(evidencePath, ''); }
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx: path.join(runtimeDir, 'template-starter.pptx'),
    pages,
    manuscriptSource,
  });

  const structureFrames = [
    { left: 55, top: 202, width: 805, height: 415 },
    { left: 55, top: 202, width: 805, height: 415 },
    { left: 55, top: 202, width: 805, height: 415 },
  ];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    await invokeUniversityStructure({
      root,
      slide: slides[index],
      assetId: page.payload.assetId,
      content: page.payload.parameters,
      targetFrame: structureFrames[index],
      evidencePath,
      pageId: page.content.pageId,
      regionId: `body-structure-${index + 1}`,
      reason: `本页核心关系需要已登记结构表达：${page.content.title}`,
    });
    if (index === 0) addTraceabilityNote(slides[index]);
    if (index === 1) {
      addSourceLabels(slides[index]);
      addAdmissionNote(slides[index]);
    }
    if (index === 2) addCapabilityNote(slides[index]);
  }

  try {
    const pptx = await PresentationFile.exportPptx(presentation);
    await pptx.save(outputPptx);
  } finally {
    await closeStructureRuntime();
  }
  await fs.writeFile(path.join(outDir, 'build-meta.json'), JSON.stringify({
    model: 'gpt-5.6-luna', reasoning: 'high',
    skin: 'northeastern-university-001', layout: 'mckinsey',
    pages: pages.map((page, i) => ({ page: i + 1, title: page.content.title, assetId: page.payload.assetId, targetFrame: structureFrames[i] })),
    bodyFrame,
    outputPptx,
    invokeLog: evidencePath,
    failureRetries: 2,
  }, null, 2));
  console.log(outputPptx);
}

main().catch(async (error) => {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'build-error.json'), JSON.stringify({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }, null, 2));
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
