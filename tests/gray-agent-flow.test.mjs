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

function mockProvider(chatScript) {
  let chatIndex = 0;
  const reviewCalls = [];
  return {
    model: 'mock',
    reviewCalls,
    complete: async ({ messages }) => {
      const system = messages[0]?.content ?? '';
      if (system.includes('灰稿内容与表达审稿人')) {
        reviewCalls.push(Date.now());
        return { content: JSON.stringify({ accepted: true, issues: [], coverage: 'mock 覆盖', limits: 'mock' }), toolCalls: [], usage: {}, finishReason: 'stop' };
      }
      const step = chatScript[chatIndex++] ?? { content: '收工。', toolCalls: [] };
      return {
        content: step.content ?? '',
        toolCalls: (step.tools ?? []).map((name, index) => ({ id: `c${chatIndex}-${index}`, name, arguments: '{}' })),
        usage: {},
        finishReason: 'stop',
      };
    },
  };
}

test('计划版本流：未写新 JSON 可推进审稿；同版复用不重复调用；修订后重新审稿', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gray-agent-flow-'));
  try {
    const source = path.join(dir, 'source.md');
    const output = path.join(dir, 'run');
    await fs.writeFile(source, SOURCE, 'utf8');
    const provider = mockProvider([
      { content: planJson(''), tools: ['check_plan'] },
      { content: '当前计划不变，继续审稿。', tools: ['semantic_review'] },
      { content: '再次审同一版本。', tools: ['semantic_review'] },
      { content: planJson('，并留痕'), tools: ['semantic_review'] },
      { content: '收工。', tools: [] },
    ]);
    await runGrayAgent({
      source, output, area: { width: 1170, height: 492 },
      root: path.resolve(import.meta.dirname, '..'), provider, maxTurns: 5,
    });
    const events = (await fs.readFile(path.join(output, 'agent', 'tool-events.ndjson'), 'utf8'))
      .trim().split(/\r?\n/).map(line => JSON.parse(line));
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
    const fingerprintNew = reviews[2].result.reviewedFingerprint;
    assert.ok(fingerprintNew && fingerprintNew !== reviews[0].result.reviewedFingerprint);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
