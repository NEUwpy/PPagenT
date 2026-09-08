import fs from 'node:fs/promises';
import path from 'node:path';
import { preparePage } from './prepare.mjs';

const here = import.meta.dirname;
const pages = {
  P1: {
    assetId: 'parallel-folded-notes-grid-002',
    frame: { left: 205, top: 250, width: 870, height: 300 },
    content: { items: [
      { key: 'complete', title: '资料齐全', body: '关键文件集中归档', iconQuery: 'folder' },
      { key: 'version', title: '版本清楚', body: '当前版本标记明确', iconQuery: 'versions' },
      { key: 'owner', title: '责任明确', body: '后续负责人可查', iconQuery: 'user-check' },
      { key: 'exception', title: '例外有据', body: '特殊处理附上依据', iconQuery: 'file-search' }
    ] }
  },
  P2: {
    assetId: 'convergence-simple-funnel-001',
    frame: { left: 650, top: 185, width: 520, height: 420 },
    content: { inputs: [
      { key: 'interview', label: '访谈', iconQuery: 'message-circle' },
      { key: 'ticket', label: '工单', iconQuery: 'ticket' },
      { key: 'usage-record', label: '使用记录', iconQuery: 'clipboard-text' }
    ], steps: [
      { key: 'collect', title: '收集线索' },
      { key: 'verify-problem', title: '核对问题' },
      { key: 'validate-solution', title: '验证方案' },
      { key: 'release-scope', title: '纳入发布' }
    ] }
  },
  P3: {
    assetId: 'progression-maturity-steps-002',
    frame: { left: 70, top: 235, width: 820, height: 320 },
    content: { levels: [
      { key: 'level-1', title: '被动处理', body: '故障后临时组织抢修' },
      { key: 'level-2', title: '形成记录', body: '故障原因与处理过程可查' },
      { key: 'level-3', title: '计划维护', body: '按周期检查并落实责任' },
      { key: 'level-4', title: '持续改善', body: '用复盘减少重复故障' }
    ], showStatus: true, currentIndex: 1 }
  }
};

for (const [id, spec] of Object.entries(pages)) {
  const result = await preparePage(spec, path.join(here, id, 'prepare.json'));
  console.log(JSON.stringify({ page: id, areas: result.occupancy.areas.length, freeArea: result.remainingPage.freeArea, bands: result.remainingPage.bands.length, textAnchors: result.textAnchors.length }));
}
