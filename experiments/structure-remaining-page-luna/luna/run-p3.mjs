import fs from 'node:fs/promises';
import path from 'node:path';
import { preparePage } from '../prepare.mjs';
import { renderCase } from '../harness.mjs';

const here = import.meta.dirname;
const out = path.join(here, 'P3');
const content = { levels: [
  { key: 'level-1', title: '被动处理', body: '故障后临时组织抢修' },
  { key: 'level-2', title: '形成记录', body: '故障原因与处理过程可查' },
  { key: 'level-3', title: '计划维护', body: '按周期检查并落实责任' },
  { key: 'level-4', title: '持续改善', body: '用复盘减少重复故障' }
], showStatus: true, currentIndex: 1 };
const frame = { left: 70, top: 235, width: 820, height: 320 };
const prepared = await preparePage({ assetId: 'progression-maturity-steps-002', content, frame }, path.join(out, 'prepare.json'));
console.log('prepare', JSON.stringify({ frame: prepared.frame, actualBounds: prepared.occupancy.actualBounds, bands: prepared.remainingPage.bands.filter(b => b.height >= 20), textAnchors: prepared.textAnchors }));
const result = await renderCase({
  caseId: 'P3', title: '设备维护能力：从可查记录走向周期责任', chapter: '03', pageNumber: 3,
  assetId: 'progression-maturity-steps-002', content, frame,
  blocks: [
    { role: 'body', text: '从可查记录走向按周期落实责任，是当前维护能力提升的下一步。', frame: { left: 120, top: 158, width: 1040, height: 52 } },
    { role: 'module', text: '下一步', frame: { left: 850, top: 292, width: 260, height: 32 } },
    { role: 'body', text: '当前 2级：形成记录\n→ 3级：计划维护\n按周期检查并落实责任\n目标 4级：持续改善', frame: { left: 850, top: 330, width: 350, height: 132 } }
  ],
  reason: '四级能力门槛保留在左侧并按同一投影递进；右侧真实自由带承载下一步行动，靠近第2级到第3级，同时明确目标第4级。'
}, out, 1);
console.log('render', JSON.stringify({ status: result.status, error: result.error ?? null, png: path.join(out, 'P3-attempt-1.png'), pptx: path.join(out, 'P3-attempt-1.pptx') }));
