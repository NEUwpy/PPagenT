import path from 'node:path';
import { preparePage } from '../prepare.mjs';
const out = path.join(import.meta.dirname, 'P1');
const content = { items: [
  { key: 'complete', title: '资料齐全', body: '关键文件集中归档', iconQuery: 'folder' },
  { key: 'version', title: '版本清楚', body: '当前版本标记明确', iconQuery: 'versions' },
  { key: 'owner', title: '责任明确', body: '后续负责人可查', iconQuery: 'user-check' },
  { key: 'exception', title: '例外有据', body: '特殊处理附上依据', iconQuery: 'file-search' }
] };
const frame = { left: 205, top: 250, width: 870, height: 300 };
const result = await preparePage({ assetId: 'parallel-folded-notes-grid-002', content, frame }, path.join(out, 'prepare.json'));
console.log(JSON.stringify({ actualBounds: result.occupancy.actualBounds, bands: result.remainingPage.bands.filter(b => b.height >= 20), textAnchors: result.textAnchors }));
