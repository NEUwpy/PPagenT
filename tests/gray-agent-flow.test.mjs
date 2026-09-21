import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runGrayAgent } from '../src/runner/gray-agent.mjs';

const SOURCE = '模拟：核验之后才能开放，异常情况立即暂停并复核记录，复核结果按季度归档备查，责任落实到人；未按要求执行或漏报的，纳入部门年度考核。';

const planJson = suffix => JSON.stringify({
  schemaVersion: 'gray-plan-3',
  deckBrief: { title: '开放安排', audience: '管理员', objective: '理解条件' },
  pages: [{
    pageId: 'p1', title: '开放安排', claim: '核验通过后开放', pagePurpose: '说明安排', narrative: '异常附属于规则',
    groups: [{
      id: 'g1', role: '行动', heading: '开放安排', importance: 'primary', kind: 'text',
      blocks: [{ id: 'b1', text: `模拟：核验之后才能开放，异常情况立即暂停并复核记录${suffix}。`, sourceIds: ['s1'] }],
    }],
  }],
});

function mockProvider(chatScript, reviewPayloads = []) {
  let chatIndex = 0;
  let reviewIndex = 0;
  const reviewCalls = [];
  return {
    model: 'mock',
    reviewCalls,
    complete: async ({ messages }) => {
      const system = messages[0]?.content ?? '';
      if (system.includes('灰稿内容与表达审稿人')) {
        reviewCalls.push(Date.now());
        const payload = reviewPayloads[reviewIndex++] ?? { accepted: true, issues: [], notes: [], coverage: 'mock 覆盖', limits: 'mock' };
        return { content: JSON.stringify(payload), toolCalls: [], usage: {}, finishReason: 'stop' };
      }
      const step = chatScript[chatIndex++] ?? { content: '收工。', toolCalls: [] };
      return {
        content: step.content ?? '',
        toolCalls: (step.tools ?? []).map((tool, index) => {
          const name = typeof tool === 'string' ? tool : tool.name;
          const args = typeof tool === 'string' ? '{}' : JSON.stringify(tool.arguments ?? {});
          return { id: `c${chatIndex}-${index}`, name, arguments: args };
        }),
        usage: {},
        finishReason: 'stop',
      };
    },
  };
}

async function runFlow(chatScript, reviewPayloads, turns = 5) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gray-agent-flow-'));
  const source = path.join(dir, 'source.md');
  const output = path.join(dir, 'run');
  await fs.writeFile(source, SOURCE, 'utf8');
  const provider = mockProvider(chatScript, reviewPayloads);
  try {
    await runGrayAgent({
      source, output, area: { width: 1170, height: 492 },
      root: path.resolve(import.meta.dirname, '..'), provider, maxTurns: turns,
    });
    const events = (await fs.readFile(path.join(output, 'agent', 'tool-events.ndjson'), 'utf8'))
      .trim().split(/\r?\n/).map(line => JSON.parse(line));
    return { events, provider };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('坏提交是失败控制流：已审过的旧版不被坏修订冒充交付；截断计划也算失败；沿用可继续', async () => {
  const truncated = '```json\n{ "schemaVersion": "gray-plan-3", "deckBrief": { "title": "开放安排"';
  const { events, provider } = await runFlow([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: truncated, tools: [{ name: 'render_draft', arguments: { layouts: [{ pageId: 'p1', layout: { type: 'single' } }] } }] },
    { content: truncated, tools: ['semantic_review'] },
    { content: '明确沿用上一版。', tools: ['semantic_review'] },
    { content: '收工。', tools: [] },
  ]);
  const renders = events.filter(event => event.tool === 'render_draft');
  const reviews = events.filter(event => event.tool === 'semantic_review');
  // 坏修订＋render：即使上一版已审过，也不得产生正常成功交付
  assert.equal(renders.length, 1);
  assert.equal(renders[0].result.accepted, false);
  assert.equal(renders[0].result.stage, 'submission-failed');
  // 坏提交不审稿、不写审稿结果
  assert.equal(reviews.length, 3);
  assert.equal(reviews[1].result.planSource, 'submission-failed');
  assert.equal(reviews[1].result.reviewedFingerprint, null);
  assert.match(reviews[1].result.note ?? '', /提交失败/);
  // 下一轮明确沿用旧版：同版缓存复用，正常推进（不要求重抄全文）
  assert.equal(reviews[2].result.planSource, 'current-plan');
  assert.match(reviews[2].result.note ?? '', /结论复用/);
  assert.equal(provider.reviewCalls.length, 1, '只有合法计划那一次真正审稿');
});

test('散文里的花括号不是提交：按沿用推进，不误判提交失败', async () => {
  const { events } = await runFlow([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '说明：排版可用 {栏} 或 {带} 两种读法。', tools: ['check_plan'] },
    { content: '收工。', tools: [] },
  ]);
  const checks = events.filter(event => event.tool === 'check_plan');
  assert.equal(checks[1].result.planSource, 'current-plan');
  assert.ok(!/提交失败/.test(checks[1].result.note ?? ''));
});

test('计划版本流：未写新 JSON 可推进审稿；同版复用不重复调用；修订后重新审稿', async () => {
  const { events, provider } = await runFlow([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '当前计划不变，继续审稿。', tools: ['semantic_review'] },
    { content: '再次审同一版本。', tools: ['semantic_review'] },
    { content: planJson('，并留痕'), tools: ['semantic_review'] },
    { content: '收工。', tools: [] },
  ]);
  const reviews = events.filter(event => event.tool === 'semantic_review');
  assert.equal(reviews.length, 3, JSON.stringify(reviews.map(event => event.result)));
  // turn2：正文没有新计划 JSON，但对当前已提交版本正常执行审稿（合法推进，未要求重抄全文）
  assert.equal(reviews[0].result.planSource, 'current-plan');
  assert.equal(reviews[0].result.accepted, true);
  assert.ok(!/未运行/.test(reviews[0].result.note ?? ''), '审稿应实际执行');
  // turn3：同版复用——不重复调用审稿模型，返回复用说明
  assert.match(reviews[1].result.note ?? '', /内容一致：结论复用/);
  assert.equal(provider.reviewCalls.length, 2, '只有两次真正的审稿模型调用');
  // turn4：提交了新计划——审稿重新运行，且通过状态绑定新指纹
  assert.equal(reviews[2].result.planSource, 'message');
  assert.equal(reviews[2].result.accepted, true);
  assert.ok(reviews[2].result.reviewedFingerprint && reviews[2].result.reviewedFingerprint !== reviews[0].result.reviewedFingerprint);
});

test('审稿协议：建议/已解决项不阻塞；真实阻塞项仍拦截（阻塞优先于 accepted）', async () => {
  const { events } = await runFlow([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: planJson('，并留痕'), tools: ['semantic_review'] },
    { content: '收工。', tools: [] },
  ], [
    { accepted: true, issues: [], notes: ['建议：标签可再简；上一问题已用其他呈现解决，不再阻塞。'], coverage: '逐页核对', limits: 'mock' },
    { accepted: true, issues: [{ pageId: 'p1', problem: '正文与主题句冲突', requiredRevision: '改回原稿限定' }], notes: [], coverage: '逐页核对', limits: 'mock' },
  ]);
  const reviews = events.filter(event => event.tool === 'semantic_review');
  assert.equal(reviews.length, 2);
  // 第一轮只有建议/已解决说明：不强制返工
  assert.equal(reviews[0].result.accepted, true, JSON.stringify(reviews[0].result));
  assert.deepEqual(reviews[0].result.notes, ['建议：标签可再简；上一问题已用其他呈现解决，不再阻塞。']);
  // 第二轮有真实阻塞项：即使 accepted=true 也按阻塞处理
  assert.equal(reviews[1].result.accepted, false);
  assert.equal(reviews[1].result.issues.length, 1);
});

test('坏提交显式失败：计划不更新、不冒充已修订，旧有效版本仍可推进', async () => {
  const { events } = await runFlow([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '```json\n{ "schemaVersion": "gray-plan-3", "pages": [ { "pageId": "p1" \n```', tools: ['check_plan'] },
    { content: '继续按上一版审稿。', tools: ['semantic_review'] },
    { content: '收工。', tools: [] },
  ]);
  const checks = events.filter(event => event.tool === 'check_plan');
  const reviews = events.filter(event => event.tool === 'semantic_review');
  assert.equal(checks[1].result.planSource, 'submission-failed');
  assert.match(checks[1].result.note ?? '', /提交失败/);
  // 坏提交之后，旧有效版本仍按 current-plan 正常推进审稿（未被当作已修订，也未阻断）
  assert.equal(reviews[0].result.planSource, 'current-plan');
  assert.equal(reviews[0].result.accepted, true);
});
