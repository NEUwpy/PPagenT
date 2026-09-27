import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGrayRegionPlan } from '../src/runner/gray-expressions.mjs';
import { grayRegionElements } from '../src/render/gray-regions.mjs';

const page = {items:[
  {id:'diagram',kind:'diagram',heading:'对应关系',text:'甲对应乙',expression:'对应',blocks:[{text:'甲对应乙'}]},
  {id:'check',kind:'text',heading:'核验',text:'仍需核验',blocks:[{text:'仍需核验'}]},
],grayComposition:{regions:[{itemId:'diagram',x:0,y:0,width:1170,height:278.5,fontSize:22},{itemId:'check',x:0,y:302.5,width:573,height:189.5,fontSize:22}]}};
const plan = {compositionId:'component-gray-regions',textSlots:[],structure:{sourceLocation:'diagram',sourceItemIds:['diagram']}};
test('gray import rejects whole-page takeover and unrelated text binding',()=>{
  assert.throws(()=>validateGrayRegionPlan(page,{...plan,compositionId:'component-full'}),/保留原分区/);
  assert.throws(()=>validateGrayRegionPlan(page,{...plan,structure:{...plan.structure,sourceItemIds:['diagram','check']}}),/不能吞并/);
  assert.doesNotThrow(()=>validateGrayRegionPlan(page,plan));
});
test('structure stays in blue subregion, original text retains its separate region',()=>{
  const result=grayRegionElements({items:page.items.map(i=>({id:i.id,grayItem:i}))},{...plan,grayRegions:page.grayComposition.regions,grayArea:{width:1170,height:492}},{left:55,top:166,width:1170,height:492});
  assert.deepEqual(result.componentFrame,{left:71,top:220,width:1138,height:208.5});
  const body=result.text.find(t=>t.value==='仍需核验');
  assert.ok(body.frame.top>result.componentFrame.top+result.componentFrame.height);
  assert.ok(result.text.some(t=>t.value==='核验'));
});
