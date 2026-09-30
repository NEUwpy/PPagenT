import test from 'node:test';
import assert from 'node:assert/strict';
import { bindVisualBlocks, validateVisualBlockMapping } from '../src/runner/visual-block-mapping.mjs';
import { semanticPages, semanticPlanFromPages, semanticReviewInput, planContentFingerprint } from '../src/runner/gray-semantics.mjs';
import { grayBodyLayout, fitGrayText, validateGrayPlan } from '../src/runner/gray-draft.mjs';
import { measuredLayoutCandidates, bindLayoutSelection, adjacentPageLayoutAdvice } from '../src/runner/gray-layout-selection.mjs';

const page={pageId:'p1',groups:[
 {id:'g1',role:'主体',kind:'text',blocks:[{id:'a',label:'甲',text:'甲文',sourceIds:['s1']},{id:'b',label:'乙',text:'乙文',sourceIds:['s2']}]},
 {id:'g2',role:'说明',kind:'text',blocks:[{id:'c',text:'共同说明',sourceIds:['s3'],scope:'group'}]},
]};

test('mapping splits and merges blocks within one semantic group while retaining source order',()=>{
 const result=bindVisualBlocks(page,{groups:[{groupId:'g1',direction:'horizontal',relation:'parallel'}],blocks:[
  {id:'v1',groupId:'g1',blockIds:['a']},
  {id:'v2',groupId:'g1',blockIds:['b']},
  {id:'v3',groupId:'g2',blockIds:['c'],role:'shared',scopeGroupIds:['g2']},
 ]});
 assert.deepEqual(result.groups,[{groupId:'g1',visualBlockIds:['v1','v2'],direction:'horizontal',relation:'parallel'},{groupId:'g2',visualBlockIds:['v3'],direction:'vertical',relation:null}]);
 assert.deepEqual(result.blocks[0].blocks[0],page.groups[0].blocks[0]);
 assert.equal(result.blocks[2].role,'shared');
 assert.equal(validateVisualBlockMapping(page,{blocks:[{id:'v1',groupId:'g1',blockIds:['a','b']},{id:'v2',groupId:'g2',blockIds:['c'],role:'shared',scopeGroupIds:['g2']}]}).valid,true);
});

function mappedPlan(direction='horizontal', sharedFirst=false) {
 const blocks=[{id:'a',label:'服务甲',text:'保留正文甲。',sourceIds:['s1']},
  {id:'n',kind:'note',text:'仅在预约后提供。',sourceIds:['s1']},
  {id:'b',label:'服务乙',text:'保留正文乙。',sourceIds:['s2']}];
 const shared={id:'c',text:'两项服务均在工作日提供。',scope:'group',sourceIds:['s3']};
 const visual=[{id:'va',groupId:'g',blockIds:['a','n']},{id:'vb',groupId:'g',blockIds:['b']}];
 const sharedVisual={id:'vc',groupId:'g',blockIds:['c'],role:'shared',scopeGroupIds:['g']};
 if(sharedFirst){blocks.unshift(shared);visual.unshift(sharedVisual);}else{blocks.push(shared);visual.push(sharedVisual);}
 return {schemaVersion:'gray-plan-3',deckBrief:{title:'服务'},pages:[{pageId:'p',title:'服务',claim:'按需提供服务',pagePurpose:'服务安排',narrative:'独立服务及共同条件',
  groups:[{id:'g',kind:'text',heading:'服务',role:'主体',importance:'primary',blocks}],
  visualMapping:{groups:[{groupId:'g',direction,relation:'independent'}],blocks:visual}}]};
}

test('formal binding, review and replay preserve mapping; geometry uses measured lanes and full-width scope',()=>{
 for(const direction of ['horizontal','vertical']) for(const first of [false,true]) {
  const plan=mappedPlan(direction,first), before=structuredClone(plan), item=semanticPages(plan)[0].items[0];
  const body=grayBodyLayout(item,1100,22,422);
  assert.equal(body.fits,true);
  assert.deepEqual(body,grayBodyLayout(item,1100,22,422));
  const a=body.sections.find(s=>s.visualBlockId==='va'),b=body.sections.find(s=>s.visualBlockId==='vb'),c=body.sections.find(s=>s.visualBlockId==='vc');
  assert.equal(c.width,1100);
  if(direction==='horizontal'){assert.equal(a.top,b.top);assert(b.left>=a.left+a.width);}
  else assert(b.top>=a.top+a.height);
  if(first) assert(c.top<a.top);else assert(c.top>=Math.max(a.top+a.height,b.top+b.height));
  assert(body.runs.some(r=>r.text==='一 服务甲'));assert(body.runs.some(r=>r.text==='二 服务乙'));
  assert.equal(body.runs.find(r=>r.text==='仅在预约后提供。').visualBlockId,'va');
  assert.equal(grayBodyLayout(item,1100,22,10).fits,false);
  const measured=measuredLayoutCandidates(plan,{width:1170,height:492},{measureBody:grayBodyLayout,fitText:fitGrayText});
  const bound=bindLayoutSelection(plan,measured,{pages:[{pageId:'p',relation:'independent',candidateId:measured[0].candidates[0].id,reason:'固定计划测量'}]}).plan;
  assert.deepEqual(semanticPlanFromPages(bound).pages[0].visualMapping,plan.pages[0].visualMapping);
  const forged=structuredClone(bound);forged.pages[0].items[0].visualMapping.blocks[0].blocks[0].text='伪造回放正文';
  const check=validateGrayPlan({sources:[{id:'s1',text:'保留正文甲。仅在预约后提供。'},{id:'s2',text:'保留正文乙。'},{id:'s3',text:'两项服务均在工作日提供。'}]},forged,{width:1170,height:492});
  assert(check.issues.some(i=>i.message?.includes('视觉块绑定与原始内容不一致')));
  assert.deepEqual(semanticReviewInput({source:'原稿',area:{width:1170,height:492},plan}).requirements[0].visualMapping,plan.pages[0].visualMapping);
  const changed=structuredClone(plan);changed.pages[0].visualMapping.groups[0].direction=direction==='horizontal'?'vertical':'horizontal';
  assert.notEqual(planContentFingerprint(plan),planContentFingerprint(changed));
  assert.deepEqual(plan,before);
  const adjacent={...plan,pages:[plan.pages[0],{...structuredClone(plan.pages[0]),pageId:'p2'}]};
  assert.deepEqual(adjacentPageLayoutAdvice(adjacent,{width:1170,height:492},{measureBody:grayBodyLayout,fitText:fitGrayText}),[]);
 }
});

test('mapping rejects unsupported relationships, separated notes, fabricated fields and undersized lanes',()=>{
 const plan=mappedPlan(),p=plan.pages[0];
 for(const [mutate,pattern] of [
  [m=>m.groups[0].relation='comparison',/仅支持/],
  [m=>m.groups=[],/必须声明/],
  [m=>m.blocks[0].x=0,/未声明字段/],
  [m=>m.blocks[2].scopeGroupIds=['other'],/scopeGroupIds/],
  [m=>{m.blocks[0].blockIds=['a'];m.blocks.splice(1,0,{id:'note',groupId:'g',blockIds:['n']});},/附注/],
 ]) { const m=structuredClone(p.visualMapping);mutate(m);assert.throws(()=>bindVisualBlocks(p,m),pattern); }
 assert.equal(grayBodyLayout(semanticPages(plan)[0].items[0],150,22).fits,false);
});

test('mapping rejects cross-group, omitted, duplicated and out-of-scope content',()=>{
 const bad=[
  [[{id:'v',groupId:'g1',blockIds:['a','c']}],/越界/],
  [[{id:'v',groupId:'g1',blockIds:['a']}],/未进入/],
  [[{id:'v1',groupId:'g1',blockIds:['a']},{id:'v2',groupId:'g1',blockIds:['a']},{id:'v3',groupId:'g2',blockIds:['c']}],/重复/],
  [[{id:'v1',groupId:'g1',blockIds:['a']},{id:'v2',groupId:'g1',blockIds:['b']},{id:'v3',groupId:'g2',blockIds:['c'],scopeGroupIds:['g1']}],/作用范围/],
 ];
 for(const [blocks,error] of bad) assert.throws(()=>bindVisualBlocks(page,{blocks}),error);
});
