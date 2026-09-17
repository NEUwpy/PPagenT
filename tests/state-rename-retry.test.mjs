import test from 'node:test';
import assert from 'node:assert/strict';
import { renameWithRetry } from '../src/runner/state.mjs';

test('rename 撞锁有界重试：可恢复错误重试后成功且退避递增', async () => {
  let calls = 0;
  const rename = async () => {
    calls += 1;
    if (calls < 3) { const error = new Error('locked'); error.code = 'EPERM'; throw error; }
    return 'ok';
  };
  const sleeps = [];
  const result = await renameWithRetry('a', 'b', { rename, sleep: async (ms) => sleeps.push(ms) });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [40, 80]);
});

test('非可恢复错误立即抛出；重试上限用尽后抛出', async () => {
  const missing = async () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; };
  await assert.rejects(() => renameWithRetry('a', 'b', { rename: missing }), /missing/);
  let calls = 0;
  const locked = async () => { calls += 1; const error = new Error('locked'); error.code = 'EPERM'; throw error; };
  await assert.rejects(() => renameWithRetry('a', 'b', { rename: locked, attempts: 3, sleep: async () => {} }), /locked/);
  assert.equal(calls, 3);
});
