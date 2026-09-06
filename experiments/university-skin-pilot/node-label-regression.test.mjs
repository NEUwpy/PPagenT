import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditNodeLabels } from './audit-node-labels.mjs';

test('empty manifest cannot count as a successful node check', () => {
  assert.equal(auditNodeLabels({elements:[]},{pairs:[]}).issueCount,1);
});

test('exported line capacity exposes overflow missed by frame intersections', () => {
  const report = JSON.parse(execFileSync(process.execPath,[
    fileURLToPath(new URL('./audit-text-overlaps.mjs',import.meta.url)),
    fileURLToPath(new URL('./transfer-03/run-04/layoutJSON.json',import.meta.url)),
  ],{encoding:'utf8'}))[0];
  assert.equal(report.intersectionCount,0);
  const warning = report.textCapacityWarnings.find(w => w.name === 'manager-boundary-note');
  assert.ok(warning);
  assert.ok(warning.estimatedMinimumHeight > warning.availableHeight);
});

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

test('multi-role label group is centered as a whole and every line stays centered', () => {
  const style = {alignment:'center',verticalAlignment:'middle'};
  const layout = {elements:[
    {name:'node',geometry:'rect',bbox:[0,0,200,100]},
    {name:'title',text:'受理',bbox:[20,20,160,28],resolvedTextStyle:style},
    {name:'owner',text:'助理',bbox:[20,60,160,20],resolvedTextStyle:style},
  ]};
  const manifest = {pairs:[{node:'node',labels:['title','owner']}]};
  assert.equal(auditNodeLabels(layout,manifest).issueCount,0);
  layout.elements[2].resolvedTextStyle = {...style,alignment:'left'};
  assert.ok(auditNodeLabels(layout,manifest).results[0].issues.includes('HORIZONTAL_ALIGNMENT'));
});
