import fs from 'node:fs/promises';
import path from 'node:path';
import { renderCase } from '../harness.mjs';

const outDir = import.meta.dirname;
const input = JSON.parse(await fs.readFile(path.join(outDir, 'input.json'), 'utf8'));
const byId = Object.fromEntries(input.cases.map((item) => [item.caseId, item]));
const reason = '父任务修复共享 Skin 标题带样式优先级后，使用原首轮 spec 重跑；保留原结构、稿件、区域与文字。';

const specs = [
  {
    caseId: 'a1', title: byId.a1.title, assetId: 'parallel-folded-notes-grid-002', content: byId.a1.content,
    frame: { left: 112, top: 208, width: 1056, height: 350 },
    blocks: [{ text: byId.a1.content.conclusion, role: 'body', frame: { left: 160, top: 575, width: 960, height: 34 } }],
    reason, chapter: '01', pageNumber: 1,
  },
  {
    caseId: 'a2', title: byId.a2.title, assetId: 'parallel-folded-notes-grid-002', content: { items: byId.a2.content.items },
    frame: { left: 56, top: 212, width: 900, height: 350 },
    blocks: [{ text: byId.a2.content.sideNote, role: 'body', frame: { left: 990, top: 270, width: 220, height: 130 } }],
    reason, chapter: '01', pageNumber: 2,
  },
  {
    caseId: 'a3', title: byId.a3.title, assetId: 'parallel-folded-notes-grid-002', content: byId.a3.content,
    frame: { left: 72, top: 210, width: 1130, height: 390 },
    blocks: [{ text: byId.a3.content.intro, role: 'body', frame: { left: 72, top: 155, width: 1080, height: 32 } }],
    reason, chapter: '01', pageNumber: 3,
  },
];

const results = [];
for (const spec of specs) results.push(await renderCase(spec, outDir, 2));
await fs.writeFile(path.join(outDir, 'rerun-fixed-skin-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ key, status, error }) => ({ key, status, error })), null, 2));
