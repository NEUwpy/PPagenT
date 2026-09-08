import path from 'node:path';
import { renderCase } from './harness.mjs';

const here = import.meta.dirname;
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
    specs: {
      1: {
        frame: { left: 205, top: 250, width: 870, height: 300 },
        blocks: [
          { role: 'body', text: '验收看的是接手者能否独立继续工作，发送文件只是交接动作。', frame: { left: 180, top: 158, width: 920, height: 58 } },
          { role: 'aux', text: '完成标准：接手者可以独立继续工作。', frame: { left: 390, top: 575, width: 500, height: 38 } }
        ],
        reason: '四项条件无顺序且同级，结构放在页面中段形成主视觉；主张占据上方整页阅读轴，底部短句只收束验收标准，不复述四张便签。'
      },
      2: {
        frame: { left: 180, top: 242, width: 920, height: 310 },
        blocks: [
          { role: 'body', text: '验收以接手者能否独立继续工作为准；发送文件只是交接动作。', frame: { left: 178, top: 158, width: 924, height: 58 } },
          { role: 'aux', text: '完成标准：接手者可以独立继续工作。', frame: { left: 395, top: 575, width: 490, height: 38 } }
        ],
        reason: '首轮视觉复核后略扩大并上移折页阵列，使上方主张、四项依据和底部收束形成更紧的垂直节奏。'
      }
    }
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
    specs: {
      1: {
        frame: { left: 650, top: 185, width: 520, height: 420 },
        blocks: [
          { role: 'body', text: '来自多个入口的反馈按准入依据逐步收敛成发布范围。', frame: { left: 56, top: 158, width: 565, height: 52 } },
          { role: 'module', text: '入口来源', frame: { left: 56, top: 225, width: 300, height: 32 } },
          { role: 'body', text: '访谈 · 工单 · 使用记录', frame: { left: 56, top: 260, width: 565, height: 34 } },
          { role: 'module', text: '准入依据', frame: { left: 56, top: 300, width: 300, height: 32 } },
          { role: 'body', text: '保留原始反馈', frame: { left: 56, top: 336, width: 565, height: 34 } },
          { role: 'body', text: '问题可重复观察', frame: { left: 56, top: 402, width: 565, height: 34 } },
          { role: 'body', text: '小样验证有效', frame: { left: 56, top: 468, width: 565, height: 34 } },
          { role: 'body', text: '责任人与交付范围明确', frame: { left: 56, top: 534, width: 565, height: 34 } }
        ],
        reason: '三个入口和四个筛选阶段是明确收敛关系；漏斗位于右侧，左侧把来源与四条准入依据按结构层级的垂直节奏排版，不制造转化率。'
      },
      2: {
        frame: { left: 665, top: 178, width: 505, height: 427 },
        blocks: [
          { role: 'body', text: '来自多个入口的反馈按准入依据逐步收敛成发布范围。', frame: { left: 56, top: 158, width: 575, height: 52 } },
          { role: 'module', text: '入口来源', frame: { left: 56, top: 224, width: 280, height: 32 } },
          { role: 'body', text: '访谈 · 工单 · 使用记录', frame: { left: 56, top: 258, width: 575, height: 34 } },
          { role: 'module', text: '准入依据', frame: { left: 56, top: 298, width: 280, height: 32 } },
          { role: 'body', text: '保留原始反馈', frame: { left: 56, top: 334, width: 575, height: 34 } },
          { role: 'body', text: '问题可重复观察', frame: { left: 56, top: 400, width: 575, height: 34 } },
          { role: 'body', text: '小样验证有效', frame: { left: 56, top: 466, width: 575, height: 34 } },
          { role: 'body', text: '责任人与交付范围明确', frame: { left: 56, top: 532, width: 575, height: 34 } }
        ],
        reason: '复核后将漏斗略向右收紧并上移，左列保持来源、准入依据和四条条件的单一对齐轴，让末条与最窄层的高度关系更清楚。'
      },
      3: {
        frame: { left: 675, top: 180, width: 495, height: 423 },
        blocks: [
          { role: 'body', text: '来自多个入口的反馈按准入依据逐步收敛成发布范围。', frame: { left: 56, top: 158, width: 575, height: 52 } },
          { role: 'module', text: '入口来源', frame: { left: 56, top: 224, width: 280, height: 32 } },
          { role: 'body', text: '访谈 · 工单 · 使用记录', frame: { left: 56, top: 258, width: 575, height: 34 } },
          { role: 'module', text: '四层准入依据', frame: { left: 56, top: 298, width: 280, height: 32 } },
          { role: 'body', text: '保留原始反馈', frame: { left: 56, top: 334, width: 575, height: 34 } },
          { role: 'body', text: '问题可重复观察', frame: { left: 56, top: 400, width: 575, height: 34 } },
          { role: 'body', text: '小样验证有效', frame: { left: 56, top: 466, width: 575, height: 34 } },
          { role: 'body', text: '责任人与交付范围明确', frame: { left: 56, top: 532, width: 575, height: 34 } }
        ],
        reason: '复核后把漏斗向右微调并把依据标题明确为四层准入依据，左列四条事实与漏斗四层保持同一竖向节奏。'
      }
    }
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
    specs: {
      1: {
        frame: { left: 70, top: 235, width: 820, height: 320 },
        blocks: [
          { role: 'body', text: '从可查记录走向按周期落实责任，是当前维护能力提升的下一步。', frame: { left: 120, top: 158, width: 1040, height: 52 } },
          { role: 'module', text: '下一步', frame: { left: 850, top: 292, width: 260, height: 32 } },
          { role: 'body', text: '当前 2级：形成记录\n→ 3级：计划维护\n按周期检查并落实责任\n目标 4级：持续改善', frame: { left: 850, top: 330, width: 350, height: 132 } }
        ],
        reason: '四级能力门槛保留在左侧并按同一投影递进；右侧真实自由带承载下一步行动，靠近第2级到第3级，同时明确目标第4级。'
      },
      2: {
        frame: { left: 60, top: 226, width: 830, height: 328 },
        blocks: [
          { role: 'body', text: '从可查记录走向按周期落实责任，是当前维护能力提升的下一步。', frame: { left: 120, top: 158, width: 1040, height: 52 } },
          { role: 'module', text: '下一步', frame: { left: 850, top: 292, width: 260, height: 32 } },
          { role: 'body', text: '当前 2级：形成记录\n→ 3级：计划维护\n按周期检查并落实责任\n目标 4级：持续改善', frame: { left: 850, top: 330, width: 350, height: 132 } }
        ],
        reason: '复核后阶梯略向左上扩展，保留右侧行动栏的独立阅读宽度，当前2级到3级行动与目标4级形成同一垂直语义组。'
      }
    }
  }
};

const pageId = process.argv[2] ?? 'all';
const attempt = Number(process.argv[3] ?? 1);
if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw new Error('attempt must be 1, 2, or 3');
const chosen = pageId === 'all' ? Object.keys(pages) : [pageId];
for (const id of chosen) {
  const page = pages[id];
  if (!page) throw new Error(`unknown page ${id}`);
  const spec = page.specs[attempt];
  if (!spec) throw new Error(`no spec for ${id} attempt ${attempt}`);
  const result = await renderCase({
    caseId: id,
    title: page.title,
    assetId: page.assetId,
    content: page.content,
    frame: spec.frame,
    blocks: spec.blocks,
    reason: spec.reason,
    chapter: page.chapter,
    pageNumber: page.pageNumber,
    attemptNote: attempt === 1 ? '初稿：依据 preparePage 的真实占用与自由带完成语义排版。' : '修订稿：根据首轮 PNG 视觉检查调整结构区域与文字节奏。'
  }, path.join(here, id), attempt);
  console.log(JSON.stringify({ page: id, attempt, status: result.status, error: result.error ?? null }));
}
