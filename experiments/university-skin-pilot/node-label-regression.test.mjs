import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { auditNodeLabels } from './audit-node-labels.mjs';

test('rejected historical sample exposes off-center labels and unsafe diamonds', async () => {
  const layout = JSON.parse(await fs.readFile(new URL('./transfer-03/run-04/layoutJSON.json', import.meta.url),'utf8'));
  const result = auditNodeLabels(layout, { pairs: [
    { node:'equipment-task',label:'equipment-task-title' },
    { node:'equipment-gate',label:'equipment-gate-label' },
  ] });
  assert.ok(result.results[0].issues.includes('HORIZONTAL_ALIGNMENT'));
  assert.ok(result.results[0].issues.includes('VERTICAL_ALIGNMENT'));
  assert.ok(result.results[1].issues.includes('UNSAFE_DIAMOND_TEXT_FRAME'));
  assert.equal(result.glyphBoundsVerified, false);
});

test('unknown shape is not reported geometrically verified', () => {
  const result = auditNodeLabels({elements:[
    {name:'node',geometry:'cloud',bbox:[0,0,200,100]},
    {name:'label',text:'条件',bbox:[40,30,120,40],resolvedTextStyle:{alignment:'center',verticalAlignment:'middle'}},
  ]}, {pairs:[{node:'node',label:'label'}]});
  assert.equal(result.results[0].safeFrameVerified,false);
  assert.ok(result.results[0].issues.includes('UNSUPPORTED_NODE_GEOMETRY'));
});
