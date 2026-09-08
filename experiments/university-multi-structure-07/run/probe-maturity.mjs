import { Presentation } from '@oai/artifact-tool';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
const root = 'C:/PPagenT';
const evidencePath = 'C:/PPagenT/experiments/university-multi-structure-07/run/probe-events.jsonl';
const candidates = [140, 160, 180, 200, 220, 240];
const content = { levels: [
  { key: 'a', title: '可记录', body: '基本台账齐全' },
  { key: 'b', title: '可追溯', body: '来源、参数、输出相互关联' },
  { key: 'c', title: '可复用', body: '关键步骤经复核，边界明确' },
] };
const out = [];
for (const height of candidates) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  const frame = { left: 55, top: 180, width: 1170, height };
  try {
    const result = await invokeUniversityStructure({
      root, slide, assetId: 'progression-maturity-steps-002', content,
      targetFrame: frame, evidencePath, pageId: `probe-maturity-${height}`, regionId: 'probe',
      reason: `探测成熟度阶梯候选区域 ${height}px`,
    });
    out.push({ height, ok: true, result });
  } catch (error) {
    out.push({ height, ok: false, message: error.message });
  } finally {
    await closeStructureRuntime();
  }
}
console.log(JSON.stringify(out, null, 2));
