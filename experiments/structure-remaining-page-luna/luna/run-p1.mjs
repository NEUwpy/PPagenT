import path from 'node:path';
import { renderCase } from '../harness.mjs';
const out = path.join(import.meta.dirname, 'P1');
const content = { items: [
  { key: 'complete', title: '资料齐全', body: '关键文件集中归档', iconQuery: 'folder' },
  { key: 'version', title: '版本清楚', body: '当前版本标记明确', iconQuery: 'versions' },
  { key: 'owner', title: '责任明确', body: '后续负责人可查', iconQuery: 'user-check' },
  { key: 'exception', title: '例外有据', body: '特殊处理附上依据', iconQuery: 'file-search' }
] };
const result = await renderCase({
  caseId: 'P1', title: '交接验收：接手者能独立继续工作', chapter: '01', pageNumber: 1,
  assetId: 'parallel-folded-notes-grid-002', content, frame: { left: 205, top: 250, width: 870, height: 300 },
  blocks: [
    { role: 'module', text: '验收口径', frame: { left: 180, top: 158, width: 240, height: 32 } },
    { role: 'body', text: '接手者能独立继续工作，才算完成交接。', frame: { left: 180, top: 198, width: 700, height: 38 } },
    { role: 'aux', text: '发送文件只是交接动作。', frame: { left: 470, top: 575, width: 340, height: 38 } }
  ],
  reason: '读取 prepare 的真实占用后，将验收口径放在结构上方，四项条件由便签承载；底部辅助句补足发送文件与验收完成之间的边界，不复述四项事实。'
}, out, 1);
console.log(JSON.stringify({ status: result.status, error: result.error ?? null, png: path.join(out, 'P1-attempt-1.png'), pptx: path.join(out, 'P1-attempt-1.pptx') }));
