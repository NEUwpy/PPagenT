import { Presentation } from '@oai/artifact-tool';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
const root = 'C:/PPagenT';
const evidencePath = 'C:/PPagenT/experiments/university-multi-structure-07/run/probe-events.jsonl';
const content = { title: '并列信息', items: [
  { key: 'a', title: '来源', body: '申请人与任务', iconQuery: 'user' },
  { key: 'b', title: '审批', body: '责任人与时间', iconQuery: 'clipboard' },
  { key: 'c', title: '结果', body: '参数与输出', iconQuery: 'file-output' },
  { key: 'd', title: '异常', body: '原因与结论', iconQuery: 'alert-triangle' },
] };
const out = [];
for (const height of [300, 304, 308, 312, 316, 320]) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  const frame = { left: 55, top: 180, width: 1170, height };
  try { const result = await invokeUniversityStructure({ root, slide, assetId: 'parallel-folded-notes-grid-002', content, targetFrame: frame, evidencePath, pageId: `probe-height-${height}`, regionId: 'probe', reason: `探测折角便签高度 ${height}px` }); out.push({ height, ok: true, result }); }
  catch (error) { out.push({ height, ok: false, message: error.message }); }
  finally { await closeStructureRuntime(); }
}
console.log(JSON.stringify(out, null, 2));
