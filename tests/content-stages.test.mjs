import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareContentDraft, bindExpressions } from '../src/composition/content-stages.mjs';

const input = () => ({ pageId: 'P', sourceParagraphs: ['先验证。', '观察有集中。', '不能认定因果。'], grouping: {
  topic: { sourceText: '先验证。' },
  groups: [{ id: 'a', title: '观察', role: 'analysis', sourceText: '观察有集中。' }, { id: 'b', title: '边界', role: 'interpretation', sourceText: '不能认定因果。', relatesTo: ['a'] }],
  relations: [{ type: 'support', from: ['a'], to: 'b', meaning: '解释观察的证据边界' }],
} });
const selection = [{ groupId: 'a', medium: 'text', reason: '直接陈述观察' }, { groupId: 'b', medium: 'text', reason: '就近说明限制' }];
test('完整原文经复核后绑定表达且内容不可改写', () => {
  const draft = prepareContentDraft(input());
  const bound = bindExpressions({ draft, review: { contentHash: draft.contentHash, status: 'passed', reason: '原文和关系已复核' }, selections: selection });
  assert.equal(bound.expressions[1].group.sourceText, '不能认定因果。');
  assert.ok(Object.isFrozen(bound.expressions[0].group));
});
test('拒绝漏掉限制、重复归组和改写', () => {
  for (const mutation of [x => x.grouping.groups.pop(), x => x.grouping.groups[1].sourceText = '观察有集中。', x => x.grouping.groups[1].sourceText = '可以认定因果。']) {
    const data = input(); mutation(data); assert.throws(() => prepareContentDraft(data));
  }
});
test('拒绝跳过复核、使用过期复核、遗漏表达和替换正文', () => {
  const draft = prepareContentDraft(input());
  const review = { contentHash: draft.contentHash, status: 'passed', reason: '复核' };
  assert.throws(() => bindExpressions({ draft, selections: selection }));
  assert.throws(() => bindExpressions({ draft, review: { ...review, contentHash: 'old' }, selections: selection }));
  assert.throws(() => bindExpressions({ draft, review, selections: selection.slice(0, 1) }));
  assert.throws(() => bindExpressions({ draft, review, selections: [{ ...selection[0], sourceText: '改写' }, selection[1]] }));
});
