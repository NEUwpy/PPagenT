import path from 'node:path';
import { preparePage } from '../prepare.mjs';

const here = import.meta.dirname;
const out = path.join(here, 'P3');
const content = { levels: [
  { key: 'level-1', title: '被动处理', body: '故障后临时组织抢修' },
  { key: 'level-2', title: '形成记录', body: '故障原因与处理过程可查' },
  { key: 'level-3', title: '计划维护', body: '按周期检查并落实责任' },
  { key: 'level-4', title: '持续改善', body: '用复盘减少重复故障' }
], showStatus: true, currentIndex: 1 };
const frame = { left: 56, top: 230, width: 790, height: 325 };
const result = await preparePage({ assetId: 'progression-maturity-steps-002', content, frame }, path.join(out, 'prepare-attempt-3.json'));
console.log(JSON.stringify({ actualBounds: result.occupancy.actualBounds, bands: result.remainingPage.bands.filter(b => b.height >= 18), textAnchors: result.textAnchors }));
