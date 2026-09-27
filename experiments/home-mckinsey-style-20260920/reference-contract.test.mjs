import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBlueprint} from './reference-contract.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const gray=read('./run-06/input.json'),bp=read('./run-06/candidate-1/blueprint.json');
test('new index and surface options retain existing source checks',()=>{
 const x=structuredClone(bp);x.visual.groups[1].index='circle-rail';x.visual.groups[1].heading='taper';x.detailStrips[0].lead='manifestations';
 assert.deepEqual(validateBlueprint(gray,x),[]);
 x.detailStrips[0].parts[0].body+='参考图额外解释';assert.ok(validateBlueprint(gray,x).length);
});
test('circle rail cannot run through diagram groups',()=>{
 const x=structuredClone(bp);x.visual.groups[0].index='circle-rail';assert.ok(validateBlueprint(gray,x).some(s=>s.includes('diagram')));
});
test('structural captions cannot be arbitrary factual claims',()=>{
 const x=structuredClone(bp);x.detailStrips[0].lead='全部整改完成';assert.ok(validateBlueprint(gray,x).length);
});
