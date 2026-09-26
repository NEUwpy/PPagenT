import test from 'node:test';
import assert from 'node:assert/strict';
import { measuredLayoutCandidates, bindLayoutSelection } from '../src/runner/gray-layout-selection.mjs';
import { grayBodyLayout, fitGrayText } from '../src/runner/gray-draft.mjs';

const metrics = { measureBody: grayBodyLayout, fitText: fitGrayText };
const area = { width: 1170, height: 492 };
const plan = { schemaVersion:'gray-plan-3', deckBrief:{title:'布局接口检查'}, pages:[{
  pageId:'p1',title:'服务安排',claim:'各项服务按需提供',pagePurpose:'介绍服务',narrative:'独立并列服务',
  groups:['咨询','借阅','预约'].map((heading,i)=>({id:`g${i}`,heading,role:'服务',importance:'primary',kind:'text',blocks:[{id:`b${i}`,text:`提供${heading}服务。`,sourceIds:[`s${i}`]}]})),
}]};

test('candidate geometry uses real text measurement and preserves content on binding',()=>{
  const original=structuredClone(plan), measured=measuredLayoutCandidates(plan,area,metrics);
  assert(measured[0].candidates.some(c=>c.family==='cards'));
  assert(measured[0].candidates.some(c=>c.family==='album'));
  for(const c of measured[0].candidates){
    for(const r of c.regions){
      assert(r.x>=0&&r.y>=0&&r.x+r.width<=area.width+1e-6&&r.y+r.height<=area.height+1e-6);
      assert(c.contentMinimums[r.itemId].minHeight<=r.height);
    }
  }
  const candidate=measured[0].candidates[0];
  const built=bindLayoutSelection(plan,measured,{pages:[{pageId:'p1',relation:'parallel',candidateId:candidate.id,reason:'三项服务独立阅读'}]});
  assert.deepEqual(plan,original);
  assert.deepEqual(built.plan.pages[0].items.map(x=>x.blocks),plan.pages[0].groups.map(x=>x.blocks));
  assert.deepEqual(built.plan.pages[0].composition.regions,candidate.regions);
});

test('unsupported cross-group logic and fabricated candidate cannot pass',()=>{
  const measured=measuredLayoutCandidates(plan,area,metrics);
  const choose=(relation,candidateId)=>({pages:[{pageId:'p1',relation,candidateId,reason:'检查拒绝路径'}]});
  assert.throws(()=>bindLayoutSelection(plan,measured,choose('causal',measured[0].candidates[0].id)),/跨组关系/);
  assert.throws(()=>bindLayoutSelection(plan,measured,choose('parallel','invented')),/没有合适/);
  assert.throws(()=>bindLayoutSelection(plan,measured,{pages:[]}),/页数/);
});

test('oversized body does not produce candidate by shrinking font',()=>{
  const dense=structuredClone(plan);
  dense.pages[0].groups[0].blocks[0].text='这是需要完整保留的正文说明。'.repeat(40);
  const measured=measuredLayoutCandidates(dense,area,metrics);
  assert.equal(measured[0].candidates.length,0);
  assert(measured[0].rejected.length>0);
});

test('single region has one geometric candidate and explicit measured width-height requirements',()=>{
  const single=structuredClone(plan);
  single.pages[0].groups=single.pages[0].groups.slice(0,1);
  const result=measuredLayoutCandidates(single,area,metrics)[0];
  assert.equal(result.candidates.length,1);
  assert.equal(result.requirements.length,1);
  for(const sample of result.requirements[0].samples){
    const item={...single.pages[0].groups[0]};
    const body=grayBodyLayout(item,sample.width-32,22);
    assert.equal(sample.height,Math.ceil(70+body.height));
  }
});

test('support band keeps source order, gives primary more height, and binds support explicitly',()=>{
  const mixed=structuredClone(plan);
  mixed.pages[0].groups[2].importance='supporting';
  const measured=measuredLayoutCandidates(mixed,area,metrics);
  const c=measured[0].candidates.find(c=>c.id==='cards-support-band');
  assert(c);
  assert(c.regions[0].height>c.regions[2].height);
  assert.deepEqual(c.regions.map(r=>r.itemId),mixed.pages[0].groups.map(g=>g.id));
  assert(c.regions[2].y>=c.regions[0].height+24);
  const built=bindLayoutSelection(mixed,measured,{pages:[{pageId:'p1',relation:'support',candidateId:c.id,reason:'共同说明置于主体下方'}]});
  assert.equal(built.plan.pages[0].items.length,3);
});

test('parallel label cannot bypass explicit primary-supporting area balance',()=>{
  const mixed=structuredClone(plan);
  mixed.pages[0].groups=mixed.pages[0].groups.slice(0,2);
  mixed.pages[0].groups[1].importance='supporting';
  const measured=measuredLayoutCandidates(mixed,area,metrics);
  assert.throws(()=>bindLayoutSelection(mixed,measured,{pages:[{pageId:'p1',relation:'parallel',candidateId:'cards-horizontal-equal',reason:'伪装为并列'}]}),/共同说明面积/);
});

