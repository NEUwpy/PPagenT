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
const frame = { left: 56, top: 230, width: 790, height: 325 };
const prepareFile = path.join(out, 'prepare-attempt-2.json');
await preparePage({ assetId: 'progression-maturity-steps-002', content, frame }, prepareFile);
const evidence = JSON.parse(await fs.readFile(prepareFile, 'utf8'));
console.log('prepare-attempt-2-read', JSON.stringify({ actualBounds: evidence.occupancy.actualBounds, rightFreeBands: evidence.remainingPage.bands.filter(b => b.height >= 20 && b.free.some(f => f.left >= 800)) }));

const result = await renderCase({
  caseId: 'P3', title: '设备维护能力：从可查记录走向周期责任', chapter: '03', pageNumber: 3,
  assetId: 'progression-maturity-steps-002', content, frame,
  blocks: [
    { role: 'body', text: '从可查记录走向按周期落实责任，是当前维护能力提升的下一步。', frame: { left: 120, top: 158, width: 1040, height: 52 } },
    { role: 'module', text: '行动焦点', frame: { left: 850, top: 318, width: 260, height: 32 } },
    { role: 'body', text: '把可查的故障记录转为按周期检查与责任落实。', frame: { left: 850, top: 360, width: 350, height: 72 } }
  ],
  reason: '读取 attempt-2 prepare 结果后，使用阶梯斜线外的连续自由带组织行动说明；结构内部保留四级内容与 currentIndex=1/target 状态，页外文字只解释从记录到周期责任的动作，不重复状态清单。'
}, out, 2);
console.log('render', JSON.stringify({ status: result.status, error: result.error ?? null, png: path.join(out, 'P3-attempt-2.png'), pptx: path.join(out, 'P3-attempt-2.pptx') }));
