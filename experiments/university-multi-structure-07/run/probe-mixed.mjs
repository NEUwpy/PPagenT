import { Presentation } from '@oai/artifact-tool';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
const root = 'C:/PPagenT';
const evidencePath = 'C:/PPagenT/experiments/university-multi-structure-07/run/probe-events.jsonl';
const candidates = [
  { name: 'half-560x172', frame: { left: 55, top: 486, width: 560, height: 172 } },
  { name: 'half-560x200', frame: { left: 55, top: 458, width: 560, height: 200 } },
  { name: 'wide-560x220', frame: { left: 665, top: 438, width: 560, height: 220 } },
  { name: 'half-560x240', frame: { left: 55, top: 418, width: 560, height: 240 } },
  { name: 'third-350x300', frame: { left: 875, top: 180, width: 350, height: 300 } },
];
const content = { levels: [
  { key: 'a', title: '可记录', body: '台账齐全' },
  { key: 'b', title: '可追溯', body: '来源参数输出关联' },
  { key: 'c', title: '可复用', body: '复核后边界明确' },
] };
const out = [];
for (const item of candidates) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  try {
    const result = await invokeUniversityStructure({ root, slide, assetId: 'progression-maturity-steps-002', content,
      targetFrame: item.frame, evidencePath, pageId: `probe-${item.name}`, regionId: 'probe', reason: `探测混排成熟度阶梯 ${item.name}` });
    out.push({ ...item, ok: true, result });
  } catch (error) { out.push({ ...item, ok: false, message: error.message }); }
  finally { await closeStructureRuntime(); }
}
console.log(JSON.stringify(out, null, 2));
