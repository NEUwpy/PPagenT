import fs from 'node:fs/promises';
import path from 'node:path';
import { renderCase, skin } from '../../structure-neutral-luna-20260908/harness.mjs';

const here = import.meta.dirname;
const plan = JSON.parse(await fs.readFile(path.join(here, 'layout-plan.json'), 'utf8'));
const pageId = process.argv[2] ?? 'all';
const attempt = Number(process.argv[3] ?? 1);
if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw new Error('attempt must be 1, 2, or 3');

const pages = {
  P1: {
    title: '交接验收：接手者能独立继续工作', chapter: '01', pageNumber: 1,
    assetId: 'parallel-folded-notes-grid-002',
    content: { items: [
      { key: 'complete', title: '资料齐全', body: '关键文件集中归档', iconQuery: 'folder' },
      { key: 'version', title: '版本清楚', body: '当前版本标记明确', iconQuery: 'versions' },
      { key: 'owner', title: '责任明确', body: '后续负责人可查', iconQuery: 'user-check' },
      { key: 'exception', title: '例外有据', body: '特殊处理附上依据', iconQuery: 'file-search' }
    ] },
    specs: [
      { frame: { left: 150, top: 218, width: 980, height: 305 }, blocks: [
        { role: 'body', text: '交接验收以接手者能独立继续工作为准，而不是以发送文件为准。', frame: { left: 155, top: 575, width: 970, height: 38 } }
      ] },
      { frame: { left: 130, top: 190, width: 1020, height: 345 }, blocks: [
        { role: 'body', text: '验收看接手者能独立继续工作，而不是以发送文件为准。', frame: { left: 240, top: 575, width: 800, height: 38 } }
      ] },
      { frame: { left: 100, top: 215, width: 1080, height: 350 }, blocks: [
        { role: 'body', text: '验收看接手者能否独立继续工作：发送文件只是交接动作。', frame: { left: 140, top: 155, width: 1000, height: 38 } }
      ] }
    ],
    reason: '四项交接条件是无顺序关系的同级验收依据，调用双排折角便签阵列；保留连续折页三层、通栏标题带、同级阵列与末行居中。'
  },
  P2: {
    title: '反馈筛选：从线索收敛到纳入发布', chapter: '02', pageNumber: 2,
    assetId: 'convergence-simple-funnel-001',
    content: { inputs: [
      { key: 'interview', label: '访谈', iconQuery: 'message-circle' },
      { key: 'ticket', label: '工单', iconQuery: 'ticket' },
      { key: 'usage-record', label: '使用记录', iconQuery: 'clipboard-text' }
    ], steps: [
      { key: 'collect', title: '收集线索' },
      { key: 'verify-problem', title: '核对问题' },
      { key: 'validate-solution', title: '验证方案' },
      { key: 'release-scope', title: '纳入发布' }
    ] },
    specs: [
      { frame: { left: 640, top: 175, width: 555, height: 420 }, blocks: [
        { role: 'body', text: '入口\n访谈 · 工单 · 使用记录', frame: { left: 56, top: 195, width: 490, height: 70 } },
        { role: 'aux', text: '准入依据\n保留原始反馈\n问题可重复观察\n小样验证有效\n责任人与交付范围明确', frame: { left: 56, top: 300, width: 490, height: 170 } }
      ] },
      { frame: { left: 620, top: 165, width: 575, height: 435 }, blocks: [
        { role: 'body', text: '入口：访谈 · 工单 · 使用记录；四个阶段逐层收敛，最后纳入发布。', frame: { left: 56, top: 190, width: 495, height: 58 } },
        { role: 'body', text: '准入依据：保留原始反馈 → 问题可重复观察 → 小样验证有效 → 责任人与交付范围明确', frame: { left: 56, top: 285, width: 495, height: 104 } }
      ] },
      { frame: { left: 640, top: 170, width: 555, height: 425 }, blocks: [
        { role: 'body', text: '入口：访谈 · 工单 · 使用记录', frame: { left: 56, top: 190, width: 520, height: 42 } },
        { role: 'body', text: '保留原始反馈', frame: { left: 56, top: 268, width: 520, height: 36 } },
        { role: 'body', text: '问题可重复观察', frame: { left: 56, top: 345, width: 520, height: 36 } },
        { role: 'body', text: '小样验证有效', frame: { left: 56, top: 422, width: 520, height: 36 } },
        { role: 'body', text: '责任人与交付范围明确', frame: { left: 56, top: 499, width: 520, height: 36 } }
      ] }
    ],
    reason: '三个入口经过四个连续收敛阶段进入发布范围，调用简明输入转化漏斗；结构承载入口与阶段，图外说明保留四条准入依据，不添加数字化转化率。'
  },
  P3: {
    title: '设备维护能力：从可查记录走向周期责任', chapter: '03', pageNumber: 3,
    assetId: 'progression-maturity-steps-002',
    content: { levels: [
      { key: 'level-1', title: '被动处理', body: '故障后临时组织抢修' },
      { key: 'level-2', title: '形成记录', body: '故障原因与处理过程可查' },
      { key: 'level-3', title: '计划维护', body: '按周期检查并落实责任' },
      { key: 'level-4', title: '持续改善', body: '用复盘减少重复故障' }
    ], showStatus: true, currentIndex: 1 },
    specs: [
      { frame: { left: 70, top: 176, width: 1140, height: 390 }, blocks: [
        { role: 'body', text: '下一步：从“可查记录”走向“按周期落实责任”。', frame: { left: 245, top: 595, width: 790, height: 38 } }
      ] },
      { frame: { left: 70, top: 150, width: 1140, height: 420 }, blocks: [
        { role: 'body', text: '下一步：从“故障原因与处理过程可查”走向“按周期检查并落实责任”。', frame: { left: 160, top: 600, width: 960, height: 38 } }
      ] },
      { frame: { left: 56, top: 165, width: 800, height: 390 }, blocks: [
        { role: 'body', text: '下一步\n当前 2级：形成记录\n→ 3级：计划维护\n按周期检查并落实责任', frame: { left: 880, top: 325, width: 340, height: 145 } }
      ] }
    ],
    reason: '四级内容是同一维护能力维度上的离散门槛，调用成熟度能力阶梯；保留连续阶台、踏面与立面投影、随透视承托面，并标出当前第2级与目标第4级。'
  }
};

const chosen = pageId === 'all' ? Object.keys(pages) : [pageId];
for (const id of chosen) {
  const page = pages[id];
  if (!page) throw new Error(`unknown page ${id}`);
  const pagePlan = plan.pages.find((entry) => entry.pageId === id);
  const spec = page.specs[attempt - 1];
  const result = await renderCase({
    caseId: id,
    title: page.title,
    assetId: page.assetId,
    content: page.content,
    frame: spec.frame,
    blocks: spec.blocks,
    reason: page.reason,
    purpose: pagePlan.purpose,
    readingOrder: pagePlan.readingOrder,
    contentAssignments: pagePlan.contentAssignments,
    chapter: page.chapter,
    pageNumber: page.pageNumber,
    attemptNote: pagePlan.attempts[attempt - 1].note,
  }, path.join(here, id), attempt);
  console.log(JSON.stringify({ page: id, attempt, status: result.status, error: result.error ?? null }));
}
