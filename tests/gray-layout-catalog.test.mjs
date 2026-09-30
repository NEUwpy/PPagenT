import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAY_LAYOUT_PROGRAMS, GRAY_LAYOUT_PROGRAM_VERSION, grayLayoutProgram, identifyGrayLayoutCandidate } from '../src/runner/gray-layout-catalog.mjs';
import { measuredLayoutCandidates, bindLayoutSelection } from '../src/runner/gray-layout-selection.mjs';
import { grayBodyLayout, fitGrayText } from '../src/runner/gray-draft.mjs';
const metrics = { measureBody: grayBodyLayout, fitText: fitGrayText };
const fixture = () => ({schemaVersion:'gray-plan-3',deckBrief:{title:'受控调用'},pages:[{
  pageId:'p1',title:'服务',claim:'按需提供服务',pagePurpose:'说明服务',narrative:'独立服务',
  groups:[1,2,3].map(i=>({id:`g${i}`,heading:`服务${i}`,role:'服务',importance:'primary',kind:'text',blocks:[{id:`b${i}`,text:'办理咨询、借阅与预约服务。',sourceIds:['s1']}]})),
}]});

test('measured candidates and selection receipts retain registered program identity', () => {
  const plan=fixture(), before=structuredClone(plan);
  plan.pages[0].groups[2].importance='supporting';
  before.pages[0].groups[2].importance='supporting';
  for(const area of [{width:1170,height:492},{width:780,height:328},{width:492,height:780}]){
    const measured=measuredLayoutCandidates(plan,area,metrics);
    for(const candidate of measured[0].candidates){
      const program=grayLayoutProgram(candidate.id);
      assert.equal(candidate.programVersion,GRAY_LAYOUT_PROGRAM_VERSION);
      const relation=candidate.id==='cards-support-band'?'support':'parallel';
      // Other candidates may be refused for the existing primary/support ratio.
      if(candidate.id!=='cards-support-band') continue;
      const built=bindLayoutSelection(plan,measured,{pages:[{pageId:'p1',candidateId:candidate.id,relation,reason:'共同说明在主体之后'}]});
      assert.equal(built.receipts[0].layoutId,program.id);
      assert.equal(built.receipts[0].layoutProgramVersion,program.version);
    }
  }
  assert.deepEqual(plan,before);
});

test('old template IDs and unknown IDs do not masquerade as registered measured candidates', () => {
  for(const id of ['category-container','invented']) assert.throws(()=>grayLayoutProgram(id),/未登记/);
  const program=GRAY_LAYOUT_PROGRAMS[0];
  assert.throws(()=>identifyGrayLayoutCandidate({...program,family:'album'}),/与登记不符/);
});

test('every registered program is reachable on controlled real-text inputs', () => {
  const reached=new Set();
  for(const count of [2,3,4]) for(const support of [false,true]){
    const plan=fixture();
    plan.pages[0].groups=Array.from({length:count},(_,i)=>({...structuredClone(plan.pages[0].groups[0]),id:`g${i}`,heading:'服务安排',importance:support&&i===count-1?'supporting':'primary',blocks:[{id:`b${i}`,text:'咨询、借阅和预约按规定办理。'.repeat(i+1),sourceIds:['s1']}]}));
    for(const area of [{width:1170,height:492},{width:492,height:780}]) for(const candidate of measuredLayoutCandidates(plan,area,metrics)[0].candidates) reached.add(candidate.id);
  }
  assert.deepEqual([...reached].sort(),GRAY_LAYOUT_PROGRAMS.map(p=>p.id).sort());
});
