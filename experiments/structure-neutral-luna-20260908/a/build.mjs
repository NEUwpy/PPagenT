import fs from 'node:fs/promises';
import path from 'node:path';
import { renderCase, skin } from '../harness.mjs';

const outDir = import.meta.dirname;
const input = JSON.parse(await fs.readFile(path.join(outDir, 'input.json'), 'utf8'));

const commonReason = '四项或六项均为同级并列检查项，选择双排折角便签阵列以保留等权阵列、连续折页三层、标题带与居中节奏。';

const byId = Object.fromEntries(input.cases.map((item) => [item.caseId, item]));

const specs = [
  {
    caseId: 'a1',
    title: byId.a1.title,
    assetId: 'parallel-folded-notes-grid-002',
    content: byId.a1.content,
    frame: { left: 112, top: 208, width: 1056, height: 350 },
    blocks: [
      { text: byId.a1.content.conclusion, role: 'body', frame: { left: 160, top: 575, width: 960, height: 34 } },
    ],
    reason: commonReason + '结论作为结构外收束说明。',
    chapter: '01',
    pageNumber: 1,
  },
  {
    caseId: 'a2',
    title: byId.a2.title,
    assetId: 'parallel-folded-notes-grid-002',
    content: {
      items: byId.a2.content.items,
    },
    frame: { left: 56, top: 212, width: 900, height: 350 },
    blocks: [
      { text: byId.a2.content.sideNote, role: 'body', frame: { left: 990, top: 270, width: 220, height: 130 } },
    ],
    reason: commonReason + '右侧说明栏固定为220px，结构与说明分区且不重叠。',
    chapter: '01',
    pageNumber: 2,
  },
  {
    caseId: 'a3',
    title: byId.a3.title,
    assetId: 'parallel-folded-notes-grid-002',
    content: byId.a3.content,
    frame: { left: 72, top: 210, width: 1130, height: 390 },
    blocks: [
      { text: byId.a3.content.intro, role: 'body', frame: { left: 72, top: 155, width: 1080, height: 32 } },
    ],
    reason: commonReason + '上方保留简短引导，下方使用宽区六项阵列。',
    chapter: '01',
    pageNumber: 3,
  },
  {
    caseId: 'a4',
    title: byId.a4.title,
    assetId: 'parallel-folded-notes-grid-002',
    content: byId.a4.content,
    frame: { left: 315, top: 240, width: 650, height: 300 },
    blocks: [
      { text: byId.a4.content.intro, role: 'body', frame: { left: 72, top: 155, width: 1080, height: 32 } },
    ],
    reason: commonReason + '首次按要求使用650x300区域做容量压力测试，完整保留六项长说明。',
    chapter: '01',
    pageNumber: 4,
  },
];

const results = [];
for (const spec of specs) {
  const result = await renderCase(spec, outDir, 1);
  results.push(result);
}

// a4 has an explicit recovery path. The first attempt is never overwritten.
const a4 = results.find((result) => result.caseId === 'a4');
if (a4?.status === 'rejected') {
  const retrySpec = {
    ...specs.find((spec) => spec.caseId === 'a4'),
    frame: { left: 72, top: 208, width: 1130, height: 390 },
    reason: commonReason + '首次650x300调用已拒绝，保留失败证据后扩展到1130x390重试。',
  };
  results.push(await renderCase(retrySpec, outDir, 2));
}

await fs.writeFile(path.join(outDir, 'run-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ key, status, error }) => ({ key, status, error })), null, 2));
