import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin } from '../../src/runtime/invoke-university-structure.mjs';
import { addBox, addText } from '../../src/asset-runtime/component-builders.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'experiments', 'neu-shared-entry-20260908');
const runtimeDir = path.join(outDir, '.runtime');
const outputPptx = path.join(outDir, 'northeastern-shared-entry.pptx');
const evidencePath = path.join(outDir, 'invoke-log.ndjson');
const manuscriptSource = '用户提供模拟业务稿件：共享仪器平台预约试点';

const bodyFrame = universityMckinseySkin.bodyFrame;

const pages = [
  {
    content: { pageId: 'neu-p1', title: '试点先把四类追溯信息一次登记齐全' },
    meta: { sectionName: '追溯闭环' },
    intent: { intentId: 'claim-traceability-fields' },
    decision: { selectedAssetId: 'parallel-folded-notes-grid-002' },
    payload: {
      assetId: 'parallel-folded-notes-grid-002',
      parameters: {
        items: [
          { key: 'source', title: '申请来源', body: '申请人、课题与来源渠道', iconKey: 'user-check' },
          { key: 'approval', title: '审批依据', body: '责任人、确认时间与依据', iconKey: 'clipboard-check' },
          { key: 'result', title: '执行结果', body: '关键参数、输出与记录', iconKey: 'chart-line' },
          { key: 'exception', title: '异常处置', body: '原因、处理动作与结论', iconKey: 'alert-triangle' },
        ],
      },
    },
  },
  {
    content: { pageId: 'neu-p2', title: '试点申请必须依次通过三道纳入关' },
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
    content: { pageId: 'neu-p3', title: '当前停在统一登记级，先用记录关联支撑持续改进' },
    meta: { sectionName: '能力建设' },
    intent: { intentId: 'claim-capability-roadmap' },
    decision: { selectedAssetId: 'progression-maturity-steps-002' },
    payload: {
      assetId: 'progression-maturity-steps-002',
      parameters: {
        levels: [
          { key: 'communicate', title: '临时沟通', body: '信息依赖临时对接' },
          { key: 'register', title: '统一登记', body: '当前：申请与审批留痕' },
          { key: 'trace', title: '过程追溯', body: '关联执行与异常记录' },
          { key: 'improve', title: '持续改进', body: '定期复盘并优化机制' },
        ],
        showStatus: true,
        currentIndex: 1,
      },
    },
  },
];

function text(slide, value, frame, style = {}) {
  return addText(slide, value, frame, {
    typeface: 'Microsoft YaHei',
    autoFit: 'none',
    verticalAlignment: 'top',
    ...style,
  });
}

function addAside(slide, { eyebrow, title, body, action }) {
  const left = 895;
  const top = 218;
  const width = 300;
  addBox(slide, { left, top, width: 6, height: 332 }, {
    geometry: 'rect', fill: '#315F91', line: { style: 'solid', fill: 'none', width: 0 }, shadow: 'shadow-none', borderRadius: 0,
  });
  text(slide, eyebrow, { left: left + 24, top: top + 2, width: width - 28, height: 26 }, { fontSize: 14, bold: true, color: '#315F91' });
  text(slide, title, { left: left + 24, top: top + 40, width: width - 28, height: 88 }, { fontSize: 21, bold: true, color: '#2B2B2B' });
  text(slide, body, { left: left + 24, top: top + 142, width: width - 28, height: 88 }, { fontSize: 18, color: '#404040' });
  addBox(slide, { left: left + 24, top: top + 246, width: width - 28, height: 1 }, {
    geometry: 'rect', fill: '#D4DCE5', line: { style: 'solid', fill: 'none', width: 0 }, shadow: 'shadow-none', borderRadius: 0,
  });
  text(slide, action, { left: left + 24, top: top + 264, width: width - 28, height: 62 }, { fontSize: 18, bold: true, color: '#315F91' });
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
  const asides = [
    {
      eyebrow: '完整证据链',
      title: '四项信息共同回答“谁、为何、做了什么、如何收尾”',
      body: '当前没有实施成效数据，因此先固定记录口径，不把试点设想写成结果。',
      action: '行动：登记表一次覆盖四类字段',
    },
    {
      eyebrow: '纳入边界',
      title: '三类申请来源共用同一条资格路径',
      body: '来源包括课题组自荐、平台推荐、跨团队合作；漏斗只表达进入顺序，不推出申请量或转化率。',
      action: '行动：先跑通核对、确认、准备',
    },
    {
      eyebrow: '近期重点',
      title: '先把执行记录与异常记录关联起来',
      body: '统一登记是当前基础；积累可追溯数据后，再定期复盘并优化机制。',
      action: '行动：关联记录，再设复盘周期',
    },
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
    addAside(slides[index], asides[index]);
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
