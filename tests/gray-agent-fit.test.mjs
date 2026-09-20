import test from 'node:test';
import assert from 'node:assert/strict';
import { planFitIssues } from '../src/runner/gray-agent.mjs';

const area = { width: 1170, height: 492 };
const plan = (claim, text) => ({
  schemaVersion: 'gray-plan-3',
  deckBrief: { title: '开放安排', audience: '管理员', objective: '理解条件' },
  pages: [{
    pageId: 'p1', title: '开放安排', claim, pagePurpose: '说明安排与例外', narrative: '异常处置附属于开放规则',
    groups: [{ id: 'a', role: '行动', heading: '开放安排', importance: 'primary', kind: 'text', blocks: [{ id: 'b1', text, sourceIds: ['s1'] }] }],
  }],
});

test('主题句超单行预算在规划期以 issue 暴露（与渲染门禁同一测量）', () => {
  const report = planFitIssues(plan('覆盖主城区 12 个采样点、连续采样 7 天：厨余占 52%，与三年前相比升 4 个百分点；可回收物纸类最多但污染率超 30%', '模拟：核验后开放。'), area);
  assert.ok(report.issues.some(issue => issue.code === 'topic-overflow' && issue.pageId === 'p1'));
  assert.equal(report.warnings.length, 0);
});

test('短主题句通过；容量按默认组合预估以 warning 暴露、不阻塞', () => {
  const ok = planFitIssues(plan('核验通过后开放', '模拟：核验后开放。'), area);
  assert.equal(ok.issues.length, 0);
  assert.equal(ok.warnings.length, 0);
  const heavy = planFitIssues(plan('核验通过后开放', '重要条件必须保留，异常暂停并复核记录。'.repeat(30)), { width: 560, height: 240 });
  assert.equal(heavy.issues.length, 0);
  assert.ok(heavy.warnings.some(warning => warning.code === 'plan-capacity' && warning.pageId === 'p1'));
});
