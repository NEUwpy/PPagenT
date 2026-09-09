import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveRegions } from './regions.mjs';
const body = { left: 55, top: 166, width: 1170, height: 492 };
test('三种编排重复计算一致，区域在正文内并保留间隔', () => {
  for (const id of ['visual-left', 'visual-right', 'visual-top']) {
    const result = reserveRegions(body, id);
    assert.deepEqual(result, reserveRegions(body, id));
    for (const f of [result.visual, result.narrative]) {
      assert.ok(f.left >= body.left && f.top >= body.top);
      assert.ok(f.left + f.width <= body.left + body.width);
      assert.ok(f.top + f.height <= body.top + body.height);
    }
    const a = result.visual, b = result.narrative;
    assert.ok(a.left+a.width+28 <= b.left || b.left+b.width+28 <= a.left || a.top+a.height+28 <= b.top);
  }
});
test('未知编排或不可支持的区域明确拒绝', () => {
  assert.throws(() => reserveRegions(body, 'free'));
  assert.throws(() => reserveRegions({ ...body, height: 100 }, 'visual-top'));
});
