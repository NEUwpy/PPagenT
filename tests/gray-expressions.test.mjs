import test from 'node:test';
import assert from 'node:assert/strict';
import { expressionRequirements, missingExpressions, validateGrayRegionPlan } from '../src/runner/gray-expressions.mjs';

test('文字组内的局部图示不能被外层 text 遮蔽', () => {
  const page = {items:[{id:'group',kind:'text',blocks:[{id:'intro',text:'范围'},
    {id:'evidence',kind:'diagram',relationship:'依据支持判断',production:'保留范围'}]}]};
  const req = expressionRequirements(page);
  assert.equal(req[0].location, 'group/evidence');
  assert.equal(req[0].relationship, '依据支持判断');
  assert.equal(missingExpressions(page,{textSlots:[{sourceItemIds:['group']}]}).length,1);
  assert.equal(missingExpressions(page,{structure:{sourceItemIds:['group']}}).length,0);
});
test('纯文字不强制图示；其他组的结构不能替代本组要求', () => {
  assert.deepEqual(expressionRequirements({items:[{id:'a',blocks:[{text:'正文'}]}]}),[]);
  assert.equal(missingExpressions({items:[{id:'a',kind:'flow'}]}, {structure:{sourceItemIds:['b']}}).length,1);
});

test('附注属于文字回填，不会把灰稿交接误判为图示', () => {
  const page = {items:[{id:'a',kind:'text',heading:'范围',blocks:[
    {id:'body',label:'适用条件',text:'正文'},
    {id:'note',kind:'note',text:'共同限定'},
  ]}],grayComposition:{regions:[{itemId:'a',x:0,y:0,width:1170,height:492}]}};
  assert.deepEqual(expressionRequirements(page),[]);
  assert.doesNotThrow(() => validateGrayRegionPlan(page,{compositionId:'component-gray-regions',textSlots:[]},{width:1170,height:492}));
});

test('纯文字页不能偷偷绑定结构，多图示仍明确返回能力缺口', () => {
  const page={items:[{id:'a',kind:'text',heading:'正文',blocks:[{id:'b',text:'内容'}]}],grayComposition:{regions:[{itemId:'a',x:0,y:0,width:1170,height:492}]}};
  assert.throws(()=>validateGrayRegionPlan(page,{compositionId:'component-gray-regions',textSlots:[],structure:{sourceLocation:'a',sourceItemIds:['a']}},{width:1170,height:492}),/纯文字灰稿/);
  const multi={items:[{id:'a',kind:'diagram'},{id:'b',kind:'flow'}],grayComposition:{regions:[{itemId:'a',x:0,y:0,width:500,height:492},{itemId:'b',x:520,y:0,width:650,height:492}]}};
  assert.throws(()=>validateGrayRegionPlan(multi,{compositionId:'component-gray-regions',textSlots:[],structure:{sourceLocation:'a',sourceItemIds:['a']}},{width:1170,height:492}),/多图示页/);
});
