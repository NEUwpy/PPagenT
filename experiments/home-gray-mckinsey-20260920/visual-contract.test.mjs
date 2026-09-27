import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBlueprint} from './visual-contract.mjs';
const gray=JSON.parse(fs.readFileSync(new URL('../home-gray-magazine-20260919/input/gray-state.json',import.meta.url))).grayDraft.semanticPlan;
const fixture=JSON.parse(fs.readFileSync(new URL('./run-02/candidate-1/blueprint.json',import.meta.url)));
test('current model plan preserves all source blocks and binds title evidence',()=>assert.deepEqual(validateBlueprint(gray,fixture),[]));
test('long section text cannot overflow inherited narrow header',()=>assert.match(validateBlueprint(gray,{...fixture,sectionTitle:'存在的不足与感悟'}).join(' '),/inherited/));
test('missing or unknown headline evidence is rejected',()=>{
  for(const ids of [[],['implementation','invented'],['compliance','compliance']]) assert.match(validateBlueprint(gray,{...fixture,headlineEvidence:ids}).join(' '),/evidence/);
});
test('multiline or long headline cannot silently shrink',()=>{
  for(const headline of ['结论\n第二行','字'.repeat(33)]) assert.match(validateBlueprint(gray,{...fixture,headline}).join(' '),/Headline/);
});
test('new style still rejects source omissions',()=>{
  const changed=structuredClone(fixture);changed.diagrams[0].inputs.pop();
  assert.ok(validateBlueprint(gray,changed).length>0);
});
