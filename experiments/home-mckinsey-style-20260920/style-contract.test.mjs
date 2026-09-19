import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBlueprint} from './style-contract.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const gray=read('./run-06/input.json'),bp=read('./run-06/candidate-1/blueprint.json');
test('selected candidate preserves the gray content and visual bindings',()=>assert.deepEqual(validateBlueprint(gray,bp),[]));
test('reference-only explanations cannot enter a detail strip',()=>{const x=structuredClone(bp);x.detailStrips[0].parts[0].body+='原文没有的解释';assert.ok(validateBlueprint(gray,x).length);});
test('duplicate label and state excerpt is rejected',()=>{const x=structuredClone(bp);x.detailStrips[0].parts[0].body=x.detailStrips[0].parts[0].label+x.detailStrips[0].parts[0].body;assert.ok(validateBlueprint(gray,x).some(v=>v.includes('NON-OVERLAPPING')));});
test('a detail strip cannot replace the bound diagram',()=>{const x=structuredClone(bp);x.detailStrips[0].blockId=x.diagrams[0].blockId;assert.ok(validateBlueprint(gray,x).length);});
test('list guide cannot run through a structure region',()=>{const x=structuredClone(bp);x.visual.groups[0].index='rail';assert.ok(validateBlueprint(gray,x).length);});
test('visual decisions bind by IDs instead of manuscript-specific names',()=>{
 const g=structuredClone(gray),x=structuredClone(bp);
 const mapping=new Map(g.pages[0].groups.map((v,i)=>[v.id,`group-${i+10}`]));
 for(const group of g.pages[0].groups)group.id=mapping.get(group.id);
 for(const v of x.visual.groups)v.id=mapping.get(v.id);
 for(const d of [...x.diagrams,...x.detailStrips])d.groupId=mapping.get(d.groupId);
 assert.deepEqual(validateBlueprint(g,x),[]);
});
