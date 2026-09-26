import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bindContentMapping,composeContentCalibration} from '../src/visual-runtime/content-layout-calibration.mjs';
const mapping=JSON.parse(fs.readFileSync(new URL('../catalog/layout-calibration-procurement.json',import.meta.url)));
const source=fs.readFileSync(new URL('../'+mapping.sourcePath,import.meta.url),'utf8');
test('mapping preserves every source span exactly once and rejects omission or changed text',()=>{
  assert.equal(bindContentMapping(source,mapping).length,6);
  const missing=structuredClone(mapping); missing.blocks.pop();
  assert.throws(()=>bindContentMapping(source,missing),/未进入布局/);
  const changed=structuredClone(mapping);changed.units[1].quote+='改写';
  assert.throws(()=>bindContentMapping(source,changed),/来源片段/);
});
test('cards and album preserve content, separate same-group objects, and keep scope targets',()=>{
  for(const family of ['cards','album']){
    const result=composeContentCalibration(source,mapping,{family});
    assert.equal(result.regions.length,5);
    assert.deepEqual(result.regions[4].scopeIds,['band1','band2','band3','exception']);
    for(const r of result.regions) assert(r.x>=0&&r.y>=0&&r.x+r.width<=1170.001&&r.y+r.height<=492.001);
    assert.equal(result.regions[0].semanticGroup,result.regions[1].semanticGroup);
    assert.notEqual(result.regions[0].id,result.regions[1].id);
  }
});
