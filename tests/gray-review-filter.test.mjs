import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRequiredRevision, sanitizeSemanticReview } from '../src/runner/gray-semantics.mjs';

// 正例一：WP3 第 1 轮 6 连拒原文（评审 #43 认定越界）。
const ROUND1 = '将下午演示环节明确表达为三个要点讲完之后的后续环节：以 attachment=true 的 note 块紧随要点组、不编号、不与三大要点同层；「演示重点／上手建议」等内容不得用与工艺要点相同的层级结构并列铺开，须能从可见结构直接读出它是依附于要点之后的后续演示环节。';
// 正例二：WP3 第 2 轮原文（评审 #44 计第 2 例、checker 毕业）。
const ROUND2 = '将阶段记录要求改为紧随四个阶段各自条目的附着说明（如 kind:note、不编号），使其位于每个阶段结束环节的层级之下，而不是作为独立 text 区域与 flow 并列。';
// 反例：纯可读性描述，不得误滤。
const READABILITY = '核心判断区域应只保留「关键只有一条：保护好熔池」这一核心判断，开场句「本次培训主题是钛合金焊接」不应混入核心判断正文；若保留开场主题，应与核心判断分离并明确其开场职责。';
const RELATION = '三条操作要点不得与「保护好熔池」这一关键并列铺开，须能从可见文案直接读出依附关系。';

test('越界指定载体样例：剥离载体指令、保留可读性与关系描述', () => {
  const first = sanitizeRequiredRevision(ROUND1);
  assert.equal(first.filtered, true);
  assert.doesNotMatch(first.text, /attachment|note\s*块|不编号|kind/iu);
  assert.match(first.text, /不与三大要点同层/u);
  assert.match(first.text, /依附于要点之后的后续演示环节/u);
  assert.match(first.text, /直接读出/u);
  assert.ok(first.removed.length >= 2);
  const second = sanitizeRequiredRevision(ROUND2);
  assert.equal(second.filtered, true);
  assert.doesNotMatch(second.text, /kind|note|不编号|text\s*区域|\bflow\b/iu);
  assert.match(second.text, /紧随四个阶段各自条目的附着说明/u);
  assert.match(second.text, /层级之下/u);
  assert.match(second.text, /并列/u);
});

test('纯可读性打回原样通过，不被误滤', () => {
  for (const text of [READABILITY, RELATION]) {
    const result = sanitizeRequiredRevision(text);
    assert.equal(result.filtered, false, text);
    assert.equal(result.text, text);
    assert.deepEqual(result.removed, []);
  }
  assert.equal(sanitizeRequiredRevision('').filtered, false);
});

test('审稿响应级过滤：脏条剥离、净条不动，原文只入档不回传', () => {
  const review = { accepted: false, issues: [
    { pageId: 'p2', requiredRevision: ROUND2, problem: '阶段记录要求未随阶段分层' },
    { pageId: 'p3', requiredRevision: READABILITY, problem: '核心判断混入开场句' },
  ] };
  const { review: filtered, filters } = sanitizeSemanticReview(review);
  assert.equal(filters.length, 1);
  assert.equal(filters[0].pageId, 'p2');
  assert.equal(filters[0].original, ROUND2);
  assert.match(filters[0].filtered, /紧随四个阶段各自条目的附着说明/u);
  assert.deepEqual(filters[0].removed.length >= 2, true);
  assert.doesNotMatch(JSON.stringify(filtered.issues[0]), /kind:note|text\s*区域|\bflow\b/iu);
  assert.equal(filtered.issues[0].requiredRevisionOriginal, undefined);
  assert.equal(filtered.issues[1].requiredRevision, READABILITY);
  assert.equal(review.issues[0].requiredRevision, ROUND2);
});
