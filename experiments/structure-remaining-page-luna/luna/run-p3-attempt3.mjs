import path from 'node:path';
import { renderCase } from '../harness.mjs';

const here = import.meta.dirname;
const out = path.join(here, 'P3');
const content = { levels: [
  { key: 'level-1', title: '被动处理', body: '故障后临时组织抢修' },
  { key: 'level-2', title: '形成记录', body: '故障原因与处理过程可查' },
  { key: 'level-3', title: '计划维护', body: '按周期检查并落实责任' },
  { key: 'level-4', title: '持续改善', body: '用复盘减少重复故障' }
], showStatus: true, currentIndex: 1 };
const frame = { left: 56, top: 230, width: 790, height: 325 };
const result = await renderCase({
  caseId: 'P3', title: '设备维护能力：从可查记录走向周期责任', chapter: '03', pageNumber: 3,
  assetId: 'progression-maturity-steps-002', content, frame,
  blocks: [
    { role: 'module', text: '从记录走向周期责任', frame: { left: 56, top: 270, width: 230, height: 32 } },
    { role: 'body', text: '故障原因与处理过程，\n转为按周期检查并落实责任。', frame: { left: 56, top: 308, width: 190, height: 68 } }
  ],
  reason: '基于 attempt-3 prepare 的真实左上自由带，模块标题完整表达行动主张，正文解释记录到周期责任的转化；删除顶部重复长句和右侧状态清单，结构内部保留四级、当前第2级和目标第4级。'
}, out, 3);
console.log(JSON.stringify({ status: result.status, error: result.error ?? null, png: path.join(out, 'P3-attempt-3.png'), pptx: path.join(out, 'P3-attempt-3.pptx') }));
