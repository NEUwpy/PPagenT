import { Presentation } from '@oai/artifact-tool';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';

const root = 'C:/PPagenT';
const evidencePath = 'C:/PPagenT/experiments/university-multi-structure-07/run/probe-events.jsonl';
const candidates = [
  { name: 'full-240', frame: { left: 55, top: 180, width: 1170, height: 240 } },
  { name: 'full-280', frame: { left: 55, top: 180, width: 1170, height: 280 } },
  { name: 'full-320', frame: { left: 55, top: 180, width: 1170, height: 320 } },
  { name: 'full-344', frame: { left: 55, top: 180, width: 1170, height: 344 } },
  { name: 'wide-400', frame: { left: 55, top: 180, width: 900, height: 400 } },
];
const content = { title: '并列信息', items: [
  { key: 'a', title: '来源', body: '申请人与任务', iconQuery: 'user' },
  { key: 'b', title: '审批', body: '责任人与时间', iconQuery: 'clipboard' },
  { key: 'c', title: '结果', body: '参数与输出', iconQuery: 'file-output' },
  { key: 'd', title: '异常', body: '原因与结论', iconQuery: 'alert-triangle' },
] };
const out = [];
for (const item of candidates) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  try {
    const result = await invokeUniversityStructure({
      root, slide, assetId: 'parallel-folded-notes-grid-002', content,
      targetFrame: item.frame, evidencePath, pageId: `probe-${item.name}`, regionId: 'probe',
      reason: `探测折角便签候选区域 ${item.name}`,
    });
    out.push({ ...item, ok: true, result });
  } catch (error) {
    out.push({ ...item, ok: false, message: error.message });
  } finally {
    await closeStructureRuntime();
  }
}
console.log(JSON.stringify(out, null, 2));
