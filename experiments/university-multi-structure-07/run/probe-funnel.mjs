import { Presentation } from '@oai/artifact-tool';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
const root = 'C:/PPagenT';
const evidencePath = 'C:/PPagenT/experiments/university-multi-structure-07/run/probe-events.jsonl';
const content = { inputs: [], steps: [
  { key: 'a', title: '记录完整' }, { key: 'b', title: '责任明确' }, { key: 'c', title: '复核通过' },
] };
const out = [];
for (const frame of [
  { name: 'half-560x172', left: 55, top: 486, width: 560, height: 172 },
  { name: 'half-560x200', left: 55, top: 458, width: 560, height: 200 },
  { name: 'full-1170x172', left: 55, top: 486, width: 1170, height: 172 },
]) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  try { const result = await invokeUniversityStructure({ root, slide, assetId: 'convergence-simple-funnel-001', content, targetFrame: frame, evidencePath, pageId: `probe-${frame.name}`, regionId: 'probe', reason: `探测漏斗候选区域 ${frame.name}` }); out.push({ ...frame, ok: true, result }); }
  catch (error) { out.push({ ...frame, ok: false, message: error.message }); }
  finally { await closeStructureRuntime(); }
}
console.log(JSON.stringify(out, null, 2));
