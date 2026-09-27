import test from 'node:test';
import assert from 'node:assert/strict';
import { expressionRequirements, missingExpressions } from '../src/runner/gray-expressions.mjs';

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
