import path from 'node:path';
import { renderCase } from '../harness.mjs';
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
const result = await renderCase({
  caseId: 'P2', title: '反馈筛选：从线索收敛到纳入发布', chapter: '02', pageNumber: 2,
  assetId: 'convergence-simple-funnel-001', content, frame: { left: 650, top: 185, width: 520, height: 420 },
  blocks: [
    { role: 'module', text: '入口来源', frame: { left: 56, top: 158, width: 260, height: 32 } },
    { role: 'body', text: '访谈 · 工单 · 使用记录', frame: { left: 56, top: 198, width: 565, height: 34 } },
    { role: 'module', text: '四层准入依据', frame: { left: 56, top: 248, width: 300, height: 32 } },
    { role: 'body', text: '保留原始反馈', frame: { left: 56, top: 292, width: 565, height: 34 } },
    { role: 'body', text: '问题可重复观察', frame: { left: 56, top: 354, width: 565, height: 34 } },
    { role: 'body', text: '小样验证有效', frame: { left: 56, top: 416, width: 565, height: 34 } },
    { role: 'body', text: '责任人与交付范围明确', frame: { left: 56, top: 478, width: 565, height: 34 } }
  ],
  reason: '读取 prepare 的真实占用后，左侧先排入口来源，再按四层漏斗阶段垂直列出准入依据；右侧结构独立承载入口图标与四层收敛，不增加页外长句或转化率。'
}, out, 1);
console.log(JSON.stringify({ status: result.status, error: result.error ?? null, png: path.join(out, 'P2-attempt-1.png'), pptx: path.join(out, 'P2-attempt-1.pptx') }));
