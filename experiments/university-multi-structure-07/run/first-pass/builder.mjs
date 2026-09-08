import fs from 'node:fs/promises';
import path from 'node:path';
import { createNortheasternUniversityStarter } from '../../../src/runtime/skins/northeastern-university.mjs';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
import { addText, addBox } from '../../../src/asset-runtime/component-builders.mjs';

const root = path.resolve('C:/PPagenT');
const runDir = path.resolve('C:/PPagenT/experiments/university-multi-structure-07/run');
const outputPptx = path.join(runDir, 'deck.pptx');
const starterPptx = path.join(runDir, '.runtime', 'template-starter.pptx');
const evidencePath = path.join(runDir, 'structure-events.jsonl');
const failures = [];

const bodyFrame = { left: 55, top: 166, width: 1170, height: 492 };

const pages = [
  {
    payload: { assetId: 'northeastern-university-cover-001', parameters: {
      title: '共享实验平台试点',
      subtitle: '先验证记录能力，再小步扩大开放',
      presenter: '平台管理者与课题负责人',
      organization: '方案讨论稿',
      date: '2026.09',
    } },
    content: { pageId: 'cover', title: '共享实验平台试点' },
    meta: { sectionName: '试点方案' },
  },
  {
    payload: { assetId: 'northeastern-university-agenda-001', parameters: {
      title: '目录',
      items: [
        { title: '01 准入与推进', description: '先筛项目，再按证据逐级扩大开放' },
        { title: '02 记录与处置', description: '完整记录，异常分级复核' },
        { title: '03 能力与扩围', description: '能力达标后扩围，条件不足即暂停' },
      ],
    } },
    content: { pageId: 'agenda', title: '目录' },
    meta: { sectionName: '目录' },
  },
  {
    payload: { assetId: 'northeastern-university-body-001', parameters: {} },
    content: {
      pageId: 'body-01',
      title: '先筛项目，再按证据逐级扩大开放',
      items: [
        { id: 'screen-1', title: '资格核对' },
        { id: 'screen-2', title: '责任确认' },
        { id: 'screen-3', title: '记录准备' },
      ],
      structuredData: { type: 'convergence', inputs: [
        { id: 'input-1', label: '课题自荐' },
        { id: 'input-2', label: '平台推荐' },
        { id: 'input-3', label: '合作项目' },
      ] },
    },
    meta: { sectionName: ' ' },
  },
  {
    payload: { assetId: 'northeastern-university-body-002', parameters: {} },
    content: {
      pageId: 'body-02',
      title: '完整记录与分级处置，守住异常责任归属',
      items: [
      { id: 'record-1', title: '来源', body: '申请人与任务' },
      { id: 'record-2', title: '审批', body: '责任人与时间' },
      { id: 'record-3', title: '结果', body: '参数与输出' },
      { id: 'record-4', title: '异常', body: '原因与结论' },
      ],
    },
    meta: { sectionName: ' ' },
  },
  {
    payload: { assetId: 'northeastern-university-body-003', parameters: {} },
    content: {
      pageId: 'body-03',
      title: '扩围以能力达标为门槛，并保留暂停条件',
      items: [
        { id: 'cap-1', title: '可记录', body: '基本台账齐全' },
        { id: 'cap-2', title: '可追溯', body: '来源、参数、输出相互关联' },
        { id: 'cap-3', title: '可复用', body: '关键步骤经复核，边界明确' },
      ],
    },
    meta: { sectionName: ' ' },
  },
  {
    payload: { assetId: 'northeastern-university-closing-001', parameters: {
      text: '请讨论并确认\n准入条件、异常复核责任及扩围门槛',
    } },
    content: { pageId: 'closing', title: '请讨论并确认' },
    meta: { sectionName: '收束' },
  },
];

for (const page of pages) {
  page.intent = { intentId: `university-multi-structure-07-${page.content.pageId}` };
  page.decision = { selectedAssetId: page.payload.assetId };
}

function addOutsideCallout(slide, { pageId, label, text, top = 520 }) {
  addBox(slide, { left: bodyFrame.left, top, width: bodyFrame.width, height: 112 }, {
    name: `PPAGENT_QA|parent=${pageId}-outside-evidence|role=container`,
    fill: '#F6F8FB',
    line: { style: 'solid', fill: '#D6E1EC', width: 1 },
    shadow: 'shadow-none',
  });
  slide.shapes.add({
    geometry: 'rect',
    name: `PPAGENT_QA|parent=${pageId}-outside-evidence|role=accent`,
    position: { left: bodyFrame.left, top, width: 8, height: 112 },
    fill: '#315F91',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  addText(slide, label, { left: bodyFrame.left + 26, top: top + 16, width: 160, height: 24 }, {
    name: `PPAGENT_QA|within=${pageId}-outside-evidence|role=label`,
    fontSize: 14, typeface: 'Microsoft YaHei', color: '#315F91', bold: true, autoFit: 'none',
  });
  addText(slide, text, { left: bodyFrame.left + 26, top: top + 43, width: bodyFrame.width - 52, height: 52 }, {
    name: `PPAGENT_QA|within=${pageId}-outside-evidence|role=body`,
    fontSize: 16, typeface: 'Microsoft YaHei', color: '#404040', verticalAlignment: 'top',
    autoFit: 'shrinkText',
  });
}

function addFallbackText(slide, { pageId, heading, body, frame }) {
  addText(slide, heading, { left: frame.left + 28, top: frame.top + 44, width: frame.width - 56, height: 34 }, {
    name: `PPAGENT_QA|parent=${pageId}-fallback|role=heading`,
    fontSize: 21, typeface: 'Microsoft YaHei', color: '#315F91', bold: true, autoFit: 'none',
  });
  addText(slide, body, { left: frame.left + 28, top: frame.top + 94, width: frame.width - 56, height: 155 }, {
    name: `PPAGENT_QA|parent=${pageId}-fallback|role=body`,
    fontSize: 18, typeface: 'Microsoft YaHei', color: '#404040', verticalAlignment: 'top',
    autoFit: 'shrinkText',
  });
}

async function callStructure({ slide, pageId, regionId, assetId, content, targetFrame, reason }) {
  try {
    return await invokeUniversityStructure({
      root, slide, assetId, content, targetFrame,
      evidencePath, pageId, regionId, reason,
    });
  } catch (error) {
    failures.push({ pageId, regionId, assetId, targetFrame, message: error.message });
    return null;
  }
}

async function build() {
  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx, pages, manuscriptSource: 'experiments/university-multi-structure-07/manuscript.md',
  });

  const left = { left: 55, top: 180, width: 560, height: 300 };
  const right = { left: 665, top: 180, width: 560, height: 300 };

  await callStructure({
    slide: slides[2], pageId: 'body-01', regionId: 'screening-funnel',
    assetId: 'convergence-simple-funnel-001',
    content: {
      inputs: pages[2].content.structuredData.inputs.map((item, index) => ({
        key: item.id,
        label: item.label,
        iconQuery: ['user-check', 'building', 'handshake'][index],
      })),
      steps: pages[2].content.items.map((item) => ({ key: item.id, title: item.title })),
    },
    targetFrame: left,
    reason: '用逐级收窄漏斗表达三类申请进入资格、责任与记录准备筛选。',
  });
  await callStructure({
    slide: slides[2], pageId: 'body-01', regionId: 'capability-ladder',
    assetId: 'progression-maturity-steps-002',
    content: { levels: [
      { key: 'capability-1', title: '可记录', body: '先留台账' },
      { key: 'capability-2', title: '可追溯', body: '关联来源、参数、输出' },
      { key: 'capability-3', title: '可复用', body: '复核后沉淀方法' },
    ], showStatus: false, currentIndex: 0 },
    targetFrame: right,
    reason: '用离散能力阶梯表达进入后的证据门槛与逐级推进。',
  });
  addOutsideCallout(slides[2], { pageId: 'body-01', label: '图外说明', top: 520,
    text: '申请可来自课题自荐、平台推荐与合作项目；筛选决定谁能进入，阶梯决定进入后如何推进。只有前一阶段证据具备，才进入下一阶段。' });

  await callStructure({
    slide: slides[3], pageId: 'body-02', regionId: 'record-set',
    assetId: 'parallel-folded-notes-grid-002',
    content: { title: '四类并列记录', items: pages[3].content.items.map((item, index) => ({
      ...item,
      iconQuery: ['user-check', 'clipboard-check', 'file-output', 'alert-triangle'][index],
    })) },
    targetFrame: left,
    reason: '四类记录彼此并列且不能互相替代，使用折角便签保持等权枚举。',
  });
  if (failures.some((item) => item.pageId === 'body-02' && item.regionId === 'record-set')) {
    addFallbackText(slides[3], { pageId: 'body-02', heading: '四类并列记录', frame: left,
      body: '来源：申请人与任务\n审批：责任人与时间\n结果：参数与输出\n异常：原因与结论' });
  }
  await callStructure({
    slide: slides[3], pageId: 'body-02', regionId: 'anomaly-funnel',
    assetId: 'convergence-simple-funnel-001',
    content: { inputs: [], steps: [
      { key: 'gate-1', title: '记录完整' },
      { key: 'gate-2', title: '责任明确' },
      { key: 'gate-3', title: '复核通过' },
    ] },
    targetFrame: right,
    reason: '异常处理按三个连续关口逐层收敛；条件不满足时补齐后再提交。',
  });
  addOutsideCallout(slides[3], { pageId: 'body-02', label: '责任边界', top: 520,
    text: '课题负责人确认事实，平台管理者复核处理结论；意见不一致时保留异常状态并提交协调，不把“已记录”当成“已解决”。' });

  await callStructure({
    slide: slides[4], pageId: 'body-03', regionId: 'capability-gate',
    assetId: 'progression-maturity-steps-002',
    content: { levels: pages[4].content.items.map((item) => ({ key: item.id, title: item.title, body: item.body })), showStatus: false, currentIndex: 0 },
    targetFrame: left,
    reason: '用离散阶梯表达扩围前必须跨越的能力门槛。',
  });
  await callStructure({
    slide: slides[4], pageId: 'body-03', regionId: 'expansion-boundaries',
    assetId: 'parallel-folded-notes-grid-002',
    content: { title: '扩围评审边界', items: [
      { id: 'boundary-1', title: '人员', body: '责任人可持续履职', iconQuery: 'users' },
      { id: 'boundary-2', title: '资源', body: '设备与支持能力可覆盖', iconQuery: 'building' },
      { id: 'boundary-3', title: '方法', body: '适用范围与例外清楚', iconQuery: 'route' },
      { id: 'boundary-4', title: '证据', body: '先检查证据是否达标', iconQuery: 'clipboard-check' },
    ] },
    targetFrame: right,
    reason: '并列呈现扩围评审所需的边界条件与证据前置检查，四项保持同级。',
  });
  if (failures.some((item) => item.pageId === 'body-03' && item.regionId === 'expansion-boundaries')) {
    addFallbackText(slides[4], { pageId: 'body-03', heading: '扩围评审边界', frame: right,
      body: '人员：责任人可持续履职\n资源：设备与支持能力可覆盖\n方法：适用范围与例外清楚\n证据：先检查证据是否达标' });
  }
  addOutsideCallout(slides[4], { pageId: 'body-03', label: '暂停条件', top: 520,
    text: '任何边界无法满足则暂停扩围，保留当前试点规模并明确补齐任务。本稿不预设项目数量、时间或收益指标。' });

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  await fs.writeFile(path.join(runDir, 'build-status.json'), JSON.stringify({
    taskId: 'university-multi-structure-07', model: 'gpt-5.6-luna', reasoning: 'high',
    outputPptx, failures,
  }, null, 2));
  await closeStructureRuntime();
  return outputPptx;
}

import { PresentationFile } from '@oai/artifact-tool';
build().then((output) => console.log(output)).catch(async (error) => {
  try { await closeStructureRuntime(); } catch {}
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
