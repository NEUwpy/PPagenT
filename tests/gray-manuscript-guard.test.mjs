import test from 'node:test';
import assert from 'node:assert/strict';
import { requireExpandedManuscript } from '../src/runner/gray-agent.mjs';

test('D 类简短需求诚实拒绝（<60 字，不产出需求复述页）', () => {
  assert.throws(() => requireExpandedManuscript('做一份面向社区居民的生活垃圾分类宣传 PPT，重点讲清四类垃圾怎么分。'), /需先生成内容稿/);
  assert.throws(() => requireExpandedManuscript('给我讲一个焊接历史的 PPT'), /需先生成内容稿/);
});

test('材料稿放行（≥60 字）', () => {
  const material = '各部门于 11 月 1 日至 11 月 15 日完成本部门资产自查，逐一核对资产编号、存放地点和使用状态；账实不符的须填写差异说明并报资产管理员汇总。';
  assert.equal(requireExpandedManuscript(material), undefined);
});
