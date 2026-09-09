import test from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptHash, prepareManuscriptDraft } from '../src/composition/manuscript-draft.mjs';

const raw = '先核对原因。\n\n观察增加但没有对照。\n\n拟议限量试点。\n\n失败时暂停扩围。';
const input = () => ({ rawMarkdown: raw, sourceHash: manuscriptHash(raw), pages: [
  { pageId: 'P1', purpose: '观察及证据边界', topic: { sourceIds: ['source-001'] }, groups: [{ id: 'evidence', title: '观察', role: 'analysis', sourceIds: ['source-002'] }], relations: [{ type: 'support', from: ['evidence'], to: 'topic', meaning: '观察只支持核对' }] },
  { pageId: 'P2', purpose: '试点与回退', topic: { sourceIds: ['source-003'] }, groups: [{ id: 'condition', title: '回退', role: 'boundary', sourceIds: ['source-004'] }], relations: [{ type: 'condition', from: ['condition'], to: 'topic', meaning: '失败时不能继续扩围' }] },
] });

test('完整整稿从来源 ID 编译到现有分组入口，保留原文位置及未审状态', () => {
  const result = prepareManuscriptDraft(input());
  assert.equal(result.pages[1].draft.grouping.groups[0].sourceText, '失败时暂停扩围。');
  assert.equal(result.sourceMap.length, 4);
  for (const block of result.sourceMap) assert.equal(raw.slice(block.start, block.end), block.text);
  assert.equal(result.semanticStatus, 'unreviewed');
  assert.equal(result.visualStatus, 'not-evaluated');
});
test('分页前漏掉完整页面也会拒绝，不能再以局部完整冒充整稿完整', () => {
  const data = input(); data.pages.pop();
  assert.throws(() => prepareManuscriptDraft(data), /整稿来源未分配: source-003, source-004/);
});
test('拒绝跨页重复、未知来源、旧原稿哈希和正文替换', () => {
  for (const [mutate, pattern] of [
    [x => x.pages[1].groups[0].sourceIds = ['source-002'], /来源重复分配/],
    [x => x.pages[1].groups[0].sourceIds = ['source-999'], /未知来源/],
    [x => x.rawMarkdown += '\n\n新增边界。', /原稿哈希不匹配/],
    [x => x.pages[1].groups[0].sourceText = '直接扩围。', /替换正文/],
  ]) { const data = input(); mutate(data); assert.throws(() => prepareManuscriptDraft(data), pattern); }
});
test('拒绝空页集和重复页 ID', () => {
  const data = input(); data.pages = []; assert.throws(() => prepareManuscriptDraft(data), /缺少页面分配/);
  const duplicate = input(); duplicate.pages[1].pageId = 'P1'; assert.throws(() => prepareManuscriptDraft(duplicate), /页 ID 重复/);
});
