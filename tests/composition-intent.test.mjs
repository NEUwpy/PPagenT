import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCompositionIntents } from '../src/composition/intent.mjs';
import { loadRules } from '../src/runtime/rules-loader.mjs';
import { fileURLToPath } from 'node:url';

function plan() {
  return { pages: [{ pageId: 'P1', compositionIntent: {
    topic: '比较结果支持先试点', topicPlacement: 'Skin 主题条带',
    groups: [
      { id: 'evidence', role: 'analysis', message: '同口径方案比较', sourceRefs: ['原稿方案表'], emphasis: 'primary', medium: 'table' },
      { id: 'meaning', role: 'interpretation', message: '先验证再扩展', sourceRefs: ['原稿建议'], emphasis: 'secondary', medium: 'text', relatesTo: ['evidence'] }
    ],
    composition: { op: 'column', children: [{ groupId: 'evidence' }, { groupId: 'meaning' }] },
    readingOrder: ['evidence', 'meaning'], alignment: '共享左起线，比较表列对齐', fitStrategy: '表格全宽，按最长依据确定行高'
  } }] };
}

test('全宽分析加解读合法，计划通过不代表视觉通过', () => {
  const result = checkCompositionIntents(plan());
  assert.equal(result.status, 'passed');
  assert.equal(result.visualStatus, 'not-evaluated');
});
test('遗漏证据、重复放置与孤立解读均拒绝', () => {
  for (const mutate of [
    i => { i.composition.children[0].groupId = 'meaning'; },
    i => { i.groups[1].relatesTo = ['missing']; },
    i => { i.readingOrder = ['meaning']; },
    i => { i.groups[0].emphasis = 'supporting'; },
    i => { i.composition.children.push({ groupId: 'phantom' }); }
  ]) {
    const value = plan(); mutate(value.pages[0].compositionIntent);
    assert.equal(checkCompositionIntents(value).status, 'failed');
  }
});
test('空计划和重复页不能成为零覆盖通过', () => {
  assert.equal(checkCompositionIntents({ pages: [] }).status, 'failed');
  const value = plan(); value.pages.push(structuredClone(value.pages[0]));
  assert.equal(checkCompositionIntents(value).status, 'failed');
});
test('共享组合真实加载到两个 Skin，正式选择器仍使用受限协议', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const skin of ['northeastern-university-001', 'neutral-editorial-001']) {
    const result = await loadRules(root, { profile: 'generation', skin });
    assert.equal(result.files.filter(f => f.path === '页面组合.md').length, 1);
    assert.match(result.text, /composition-intent.json/);
  }
  const selector = await loadRules(root, { profile: 'visual-selector' });
  assert.ok(!selector.files.some(f => f.path === '页面组合.md'));
});
