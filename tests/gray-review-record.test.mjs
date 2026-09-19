import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotSemanticReview, SEMANTIC_REVIEW_CONTRACT } from '../src/runner/gray-semantics.mjs';

// 已知危害样本（评审 #102 用户实测：旧过滤器删字有损，改为只记不改后必须恒等通过）。
const HARM_TRUNCATED = '共同限定应紧随三个主体条目且不编号，与三项并列铺开不算落实。';
// 旧行为：删「且不编号」并吞掉连接词，输出残句「…且」。此处作危害留档。
const HARM_PARENTHETICAL = '保留共同限定（仅在表格中列出的试验条件下成立）。';
// 旧行为：整个括号条件被删——「表格」在那里是数据出处，不是载体指令。
const HARM_RESIDUE = '…且';

test('危害样本恒等通过：不再删字、不再产生残句', () => {
  for (const text of [HARM_TRUNCATED, HARM_PARENTHETICAL]) {
    const snapshot = snapshotSemanticReview({ accepted: false, issues: [{ pageId: 'p1', problem: '范围不清楚', requiredRevision: text }] });
    assert.equal(snapshot.issues[0].requiredRevision, text);
    assert.notEqual(snapshot.issues[0].requiredRevision, HARM_RESIDUE);
  }
  assert.ok(HARM_TRUNCATED.includes('不编号'));
  assert.ok(HARM_PARENTHETICAL.includes('表格'));
  assert.ok(HARM_PARENTHETICAL.includes('（') && HARM_PARENTHETICAL.includes('）'));
});

test('审稿记录只记不改：原文、判定、覆盖与边界完整入档', () => {
  const review = {
    accepted: false,
    issues: [{ pageId: 'p2', sourceIds: ['g1'], problem: '共同约束被读成只约束第三条', requiredRevision: HARM_TRUNCATED }],
    coverage: '逐页说明', limits: '未看像素图',
  };
  const snapshot = snapshotSemanticReview(review);
  assert.equal(snapshot.accepted, false);
  assert.deepEqual(snapshot.issues, review.issues);
  assert.equal(snapshot.coverage, '逐页说明');
  assert.equal(snapshot.limits, '未看像素图');
  assert.deepEqual(snapshotSemanticReview(null), { accepted: false, issues: [], coverage: null, limits: null });
});

test('契约口径：载体建议不具约束力、不被程序过滤；note 保证仅为呈现形态', () => {
  assert.doesNotMatch(SEMANTIC_REVIEW_CONTRACT, /会被程序过滤/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不具约束力/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不采纳不构成拒绝理由/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /程序保证的只是呈现形态/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /仍须对照内容核对/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /不预先统一实现/u);
  assert.doesNotMatch(SEMANTIC_REVIEW_CONTRACT, /其存在即层级分离的落实/u);
  assert.match(SEMANTIC_REVIEW_CONTRACT, /序号不是模型标签/u);
});
