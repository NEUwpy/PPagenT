import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBlueprint} from './visual-contract.mjs';
const source=JSON.parse(fs.readFileSync(new URL('./input/gray-state.json',import.meta.url)));
const gray=source.grayDraft.semanticPlan;
const bp=JSON.parse(fs.readFileSync(new URL('./run-02/candidate-1/blueprint.json',import.meta.url)));
test('actual model blueprint preserves gray excerpts and bindings',()=>assert.deepEqual(validateBlueprint(gray,bp),[]));
test('losing a causal input fails rather than appearing as a successful structure',()=>{
 const b=structuredClone(bp);b.diagrams[0].inputs.pop();assert.ok(validateBlueprint(gray,b).length);
});
test('duplicate diagram bindings and omitted placeholder are rejected',()=>{
 const b=structuredClone(bp);b.diagrams.push(structuredClone(b.diagrams[0]));assert.ok(validateBlueprint(gray,b).length);
 b.diagrams=[];assert.ok(validateBlueprint(gray,b).length);
});
test('changed gray text invalidates stale diagram content',()=>{
 const g=structuredClone(gray);g.pages[0].groups[0].blocks[0].text+='仍需持续观察。';
 assert.ok(validateBlueprint(g,bp).some(x=>x.includes('cover')));
});
test('unimplemented structure cannot silently use the convergence adapter',()=>{
 const b=structuredClone(bp);b.diagrams[0].assetId='causal-fishbone-attribution-001';assert.ok(validateBlueprint(gray,b).some(x=>x.includes('Unsupported')));
});
test('group-level diagrams are not silently rendered as prose',()=>{
 const g=structuredClone(gray);g.pages[0].groups[0].kind='flow';assert.ok(validateBlueprint(g,bp).length);
});
