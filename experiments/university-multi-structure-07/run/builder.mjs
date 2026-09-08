import fs from 'node:fs/promises';
import path from 'node:path';
import { createNortheasternUniversityStarter } from '../../../src/runtime/skins/northeastern-university.mjs';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
import { addText, addBox } from '../../../src/asset-runtime/component-builders.mjs';

const root = path.resolve('C:/PPagenT');
const runDir = path.resolve('C:/PPagenT/experiments/university-multi-structure-07/run');
const outputPptx = path.join(runDir, 'deck.pptx');
const starterPptx = path.join(runDir, '.runtime', 'template-starter.pptx');
const evidencePath = path.join(runDir, 'structure-events-feedback.jsonl');
const failures = [];

const bodyFrame = { left: 55, top: 166, width: 1170, height: 492 };

const pages = [
  {
    payload: { assetId: 'northeastern-university-cover-001', parameters: {
      title: '共享实验平台试点',
      subtitle: '先验证记录能力，再小步扩大开放',
      presenter: '',
      organization: '方案讨论稿',
      date: '',
    } },
    content: { pageId: 'cover', title: '共享实验平台试点' },
    meta: { sectionName: '试点方案' },
  },
  {
    payload: { assetId: 'northeastern-university-agenda-001', parameters: {
      title: '目录',
      items: [
        { title: '准入与推进', description: '先筛项目，再按证据逐级扩大开放' },
        { title: '记录与处置', description: '完整记录，异常分级复核' },
        { title: '能力与扩围', description: '能力达标后扩围，条件不足即暂停' },
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
    fontSize: 18, typeface: 'Microsoft YaHei', color: '#315F91', bold: true, autoFit: 'none',
  });
  addText(slide, text, { left: bodyFrame.left + 26, top: top + 43, width: bodyFrame.width - 52, height: 70 }, {
    name: `PPAGENT_QA|within=${pageId}-outside-evidence|role=body`,
    fontSize: 18, typeface: 'Microsoft YaHei', color: '#404040', verticalAlignment: 'top',
    autoFit: 'shrinkText',
  });
}

function restoreSectionLabel(slide, label) {
  const sectionShape = slide.shapes.items.find((shape) => shape.name === '文本框 6');
  if (!sectionShape) throw new Error(`模板正文页缺少固定 section label：${label}`);
  sectionShape.text = label;
  sectionShape.text.style = {
    fontSize: 18,
    typeface: 'Microsoft YaHei',
    color: '#404040',
    bold: true,
    alignment: 'left',
    verticalAlignment: 'middle',
    autoFit: 'shrinkText',
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
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

  const wide = { left: 55, top: 180, width: 700, height: 300 };
  const narrow = { left: 755, top: 180, width: 470, height: 300 };
  restoreSectionLabel(slides[2], '准入与推进');
  restoreSectionLabel(slides[3], '记录与处置');
  restoreSectionLabel(slides[4], '能力与扩围');

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
    targetFrame: wide,
    reason: '用逐级收窄漏斗表达三类申请进入资格、责任与记录准备筛选。',
  });
  await callStructure({
    slide: slides[2], pageId: 'body-01', regionId: 'capability-ladder',
    assetId: 'progression-maturity-steps-002',
    content: { levels: [
      { key: 'capability-1', title: '可记录', body: '先留台账' },
      { key: 'capability-2', title: '可追溯', body: '关联来源、参数、输出' },
      { key: 'capability-3', title: '可复用', body: '复核后复用' },
    ], showStatus: false, currentIndex: 0 },
    targetFrame: narrow,
    reason: '用离散能力阶梯表达进入后的证据门槛与逐级推进。',
  });
  addOutsideCallout(slides[2], { pageId: 'body-01', label: '准入规则', top: 520,
    text: '申请来自课题自荐、平台推荐与合作项目，且不按先后直接开放；资格、责任、记录缺一项则暂缓。进入后还须逐级具备证据，达可复用前不宣称跨项目推广。' });

  await callStructure({
    slide: slides[3], pageId: 'body-02', regionId: 'record-set',
    assetId: 'parallel-folded-notes-grid-002',
    content: { title: '四类并列记录', items: pages[3].content.items.map((item, index) => ({
      ...item,
      iconQuery: ['user-check', 'clipboard-check', 'file-output', 'alert-triangle'][index],
    })) },
    targetFrame: wide,
    reason: '四类记录彼此并列且不能互相替代，使用折角便签保持等权枚举。',
  });
  if (failures.some((item) => item.pageId === 'body-02' && item.regionId === 'record-set')) {
    addFallbackText(slides[3], { pageId: 'body-02', heading: '四类并列记录', frame: wide,
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
    targetFrame: narrow,
    reason: '异常处理按三个连续关口逐层收敛；条件不满足时补齐后再提交。',
  });
  addOutsideCallout(slides[3], { pageId: 'body-02', label: '责任边界', top: 520,
    text: '记录不完整、责任不明确或复核未通过时补齐后再提交，不直接关闭异常。课题负责人确认事实，平台管理者复核结论；意见不一致则保留异常状态并协调。' });

  await callStructure({
    slide: slides[4], pageId: 'body-03', regionId: 'capability-gate',
    assetId: 'progression-maturity-steps-002',
    content: { levels: pages[4].content.items.map((item) => ({ key: item.id, title: item.title, body: item.body })), showStatus: false, currentIndex: 0 },
    targetFrame: narrow,
    reason: '用离散阶梯表达扩围前必须跨越的能力门槛。',
  });
  await callStructure({
    slide: slides[4], pageId: 'body-03', regionId: 'expansion-boundaries',
    assetId: 'parallel-folded-notes-grid-002',
    content: { title: '能力证据字段', items: [
      { id: 'evidence-1', title: '台账', body: '基本记录齐全', iconQuery: 'clipboard-list' },
      { id: 'evidence-2', title: '来源', body: '来源可关联', iconQuery: 'file-description' },
      { id: 'evidence-3', title: '参数', body: '执行参数可关联', iconQuery: 'adjustments' },
      { id: 'evidence-4', title: '输出', body: '输出结果可关联', iconQuery: 'file-output' },
    ] },
    targetFrame: wide,
    reason: '并列呈现能力达标需核对的四类证据字段；三项人员、资源、方法边界另在图外说明，不把上位门槛凑成第四边界。',
  });
  if (failures.some((item) => item.pageId === 'body-03' && item.regionId === 'expansion-boundaries')) {
    addFallbackText(slides[4], { pageId: 'body-03', heading: '能力证据字段', frame: wide,
      body: '台账：基本记录齐全\n来源：来源可关联\n参数：执行参数可关联\n输出：输出结果可关联' });
  }
  addOutsideCallout(slides[4], { pageId: 'body-03', label: '暂停条件', top: 520,
    text: '扩围评审核对三项并列边界：人员（责任人可持续履职）、资源（设备与支持能力可覆盖）、方法（适用范围与例外清楚）。任一项不满足则暂停扩围，保留当前试点并明确补齐任务；达可复用前不宣称跨项目推广。本稿不预设数量、时间与收益指标。' });

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  await fs.writeFile(path.join(runDir, 'build-status.json'), JSON.stringify({
    taskId: 'university-multi-structure-07', revision: 'parent-feedback-01', model: 'gpt-5.6-luna', reasoning: 'high',
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
