import path from 'node:path';
import { preparePage } from '../prepare.mjs';
const out = path.join(import.meta.dirname, 'P2');
const content = { inputs: [
  { key: 'interview', label: '访谈', iconQuery: 'message-circle' },
  { key: 'ticket', label: '工单', iconQuery: 'ticket' },
  { key: 'usage-record', label: '使用记录', iconQuery: 'clipboard-text' }
], steps: [
  { key: 'collect', title: '收集线索' },
  { key: 'verify-problem', title: '核对问题' },
  { key: 'validate-solution', title: '验证方案' },
  { key: 'release-scope', title: '纳入发布' }
] };
const frame = { left: 650, top: 185, width: 520, height: 420 };
const result = await preparePage({ assetId: 'convergence-simple-funnel-001', content, frame }, path.join(out, 'prepare.json'));
console.log(JSON.stringify({ actualBounds: result.occupancy.actualBounds, bands: result.remainingPage.bands.filter(b => b.height >= 20), textAnchors: result.textAnchors }));
