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

function mockProvider(chatScript, reviewPayloads = [], beforeCall = null) {
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
      if (beforeCall) await beforeCall({ chatIndex });
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

async function runProtocol(chatScript, reviewPayloads = [], turns = 8, beforeCall = null) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gray-agent-protocol-'));
  const source = path.join(dir, 'source.md');
  const output = path.join(dir, 'run');
  await fs.writeFile(source, SOURCE, 'utf8');
  const provider = mockProvider(chatScript, reviewPayloads, beforeCall ? (context) => beforeCall({ ...context, output }) : null);
  await runGrayAgent({
    source, output, area: { width: 1170, height: 492 },
    root: path.resolve(import.meta.dirname, '..'), provider, maxTurns: turns,
  });
  const events = (await fs.readFile(path.join(output, 'agent', 'tool-events.ndjson'), 'utf8'))
    .trim().split(/\r?\n/).map(line => JSON.parse(line));
  const state = JSON.parse(await fs.readFile(path.join(output, 'state.json'), 'utf8'));
  const readFile = name => fs.readFile(path.join(output, name), 'utf8');
  const exists = async name => { try { await fs.access(path.join(output, name)); return true; } catch { return false; } };
  return { dir, output, events, provider, state, readFile, exists, rm: () => fs.rm(dir, { recursive: true, force: true }) };
}

const renderSingle = { name: 'render_draft', arguments: { layouts: [{ pageId: 'p1', layout: { type: 'single' } }] } };
const renderColumn = { name: 'render_draft', arguments: { layouts: [{ pageId: 'p1', layout: { type: 'column' }, override: { reason: '纵向排列验证布局复核' } }] } };

test('模板门重复请求保护：同一无效布局第二次按停滞拒绝，改用默认后继续（任务 #208）', async () => {
  const badLayout = { name: 'render_draft', arguments: { layouts: [{ pageId: 'p1', layout: { type: 'row' } }] } };
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染（无效组合）。', tools: [badLayout] },
    { content: '原样重试。', tools: [badLayout] },
    { content: '改用默认。', tools: [renderSingle] },
    { content: '保持。', tools: [{ name: 'finish_draft', arguments: { review: '保持。' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const renders = run.events.filter(event => event.tool === 'render_draft');
    assert.equal(renders[0].result.accepted, false);
    assert.equal(renders[0].result.stage, 'template');
    assert.equal(renders[1].result.accepted, false);
    assert.equal(renders[1].result.stage, 'stall');
    assert.match(renders[1].result.reason, /模板门失败过/);
    assert.match(renders[1].result.reason, /override/);
    assert.equal(renders[2].result.accepted, true);
    assert.equal(run.state.grayDraft.postRender.completed, true);
    const stalls = run.state.grayDraft.stalls ?? [];
    assert.ok(stalls.some(stall => stall.stage === 'template' && stall.fingerprint), JSON.stringify(stalls));
  } finally { await run.rm(); }
});

test('渲染后复核协议：成功渲染是候选（带诊断），后续回合 finish 才交付', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: '复核诊断后保持。', tools: [{ name: 'finish_draft', arguments: { review: '对照原稿复核：内容保真、区域职责清楚；保持当前候选。' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const renders = run.events.filter(event => event.tool === 'render_draft');
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(renders[0].result.accepted, true);
    assert.equal(renders[0].result.candidate, true);
    assert.equal(renders[0].result.renderId, 1);
    assert.match(renders[0].result.note ?? '', /尚未交付/);
    assert.equal(renders[0].result.diagnostics.length, 1);
    assert.equal(renders[0].result.diagnostics[0].regions.length, 1);
    const diag = renders[0].result.diagnostics[0];
    const region = diag.regions[0];
    assert.ok(Number.isFinite(region.minimumRegionHeight) && Number.isFinite(region.allocatedRegionHeight));
    assert.ok(region.allocatedRegionHeight > 0);
    assert.ok(region.occupancy <= 1.01, `同口径占用不应>1：${region.occupancy}`);
    assert.ok(Number.isFinite(region.textOccupancy));
    assert.ok(Number.isFinite(diag.pageBottomWhitespace));
    assert.equal(diag.weightsSource, null, '无权重布局的 weightsSource 应为 null');
    assert.equal(finishes[0].result.accepted, true);
    assert.equal(finishes[0].result.delivered, true);
    const gray = run.state.grayDraft;
    assert.equal(gray.status, 'awaiting-user-review');
    assert.equal(gray.postRender.completed, true);
    assert.equal(gray.postRender.delivery.renderId, 1);
    assert.ok(gray.postRender.delivery.review.length > 0);
    assert.equal(gray.postRender.delivery.revisionNotAdopted, false);
    assert.equal(gray.reviewCoverage.deliveredFingerprint, gray.postRender.delivery.contentFingerprint);
    assert.equal(gray.reviewCoverage.reviewedFingerprint, gray.postRender.delivery.reviewedFingerprint);
    assert.equal(await run.exists('gray-draft.pptx'), true);
    assert.equal(await run.exists('preview/slide-01.png'), true);
  } finally { await run.rm(); }
});

test('同轮 render+finish 不算看过诊断：被拒后下一轮 finish 才接受', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染并直接保持。', tools: [renderSingle, { name: 'finish_draft', arguments: { review: '直接保持。' } }] },
    { content: '下一轮再保持。', tools: [{ name: 'finish_draft', arguments: { review: '复核后保持。' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(finishes[0].result.accepted, false);
    assert.equal(finishes[0].result.stage, 'finish-same-turn');
    assert.equal(finishes[1].result.accepted, true);
    assert.equal(run.state.grayDraft.postRender.completed, true);
  } finally { await run.rm(); }
});

test('首次成功后最多一次修订周期：内容修订重审、再次渲染被预算拒绝、finish 交付修订版', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: planJson('，并留痕'), tools: ['semantic_review'] },
    { content: '重渲染修订版。', tools: [renderSingle] },
    { content: '还想再改。', tools: [renderSingle] },
    { content: '保持修订版。', tools: [{ name: 'finish_draft', arguments: { review: '修订版复核后保持。' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const renders = run.events.filter(event => event.tool === 'render_draft');
    assert.equal(renders[0].result.accepted, true);
    assert.equal(renders[1].result.accepted, true);
    assert.equal(renders[2].result.accepted, false);
    assert.equal(renders[2].result.stage, 'revision-budget');
    assert.equal(run.provider.reviewCalls.length, 2, '内容修订触发重新审稿');
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(finishes[0].result.accepted, true);
    assert.equal(finishes[0].result.renderId, 2);
    assert.equal(run.state.grayDraft.postRender.revisions, 1);
  } finally { await run.rm(); }
});

test('布局-only 修订沿用内容审稿：不重复调用审稿模型', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: '只改组合。', tools: [renderColumn] },
    { content: '保持。', tools: [{ name: 'finish_draft', arguments: { review: '布局修订后保持。' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const renders = run.events.filter(event => event.tool === 'render_draft');
    assert.equal(renders[1].result.accepted, true);
    assert.equal(run.provider.reviewCalls.length, 1, '布局-only 不新增审稿调用');
    assert.equal(run.state.grayDraft.postRender.revisions, 1);
  } finally { await run.rm(); }
});

test('未 finish 的预算耗尽：交付第一次成功候选并标未完成复核，不写正常交付记录', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: '只改组合。', tools: [renderColumn] },
    { content: '……', tools: [] },
    { content: '……', tools: [] },
    { content: '……', tools: [] },
  ]);
  try {
    const gray = run.state.grayDraft;
    assert.equal(gray.status, 'awaiting-user-review');
    assert.equal(gray.candidateDelivery, true);
    assert.equal(gray.postRender.completed, false);
    assert.equal(gray.postRender.stopReason, 'model-stalled');
    assert.equal(gray.postRender.delivery, undefined);
    assert.equal(gray.postRender.candidate.renderId, 1, '交付第一次成功候选，防止回归');
    assert.match(gray.candidateNote, /未完成复核/);
    assert.equal(gray.reviewCoverage.candidate, true);
    assert.equal(await run.exists('gray-draft.pptx'), true);
    const renders = run.events.filter(event => event.tool === 'render_draft');
    assert.equal(renders.filter(event => event.result.accepted).length, 2);
  } finally { await run.rm(); }
});

test('候选与当前计划不一致：finish 无 reason 被拒，写明退回原因后记录未采用修订', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: planJson('，并留痕'), tools: [{ name: 'finish_draft', arguments: { review: '保持。' } }] },
    { content: '退回旧候选。', tools: [{ name: 'finish_draft', arguments: { renderId: 1, review: '修订未采用：保持旧候选。', reason: '修订版未渲染，内容变更不采用' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(finishes[0].result.accepted, false);
    assert.equal(finishes[0].result.stage, 'finish-version-mismatch');
    assert.equal(finishes[1].result.accepted, true);
    assert.equal(finishes[1].result.revisionNotAdopted, true);
    const delivery = run.state.grayDraft.postRender.delivery;
    assert.equal(delivery.renderId, 1);
    assert.equal(delivery.revisionNotAdopted, true);
    assert.match(delivery.reason, /不采用/);
  } finally { await run.rm(); }
});

test('坏提交＋finish 不得用旧计划宣布成功：显式报提交失败，下一轮沿用旧候选才可完成', async () => {
  const badJson = '```json\n{ "schemaVersion": "gray-plan-3", "deckBrief": { "title": "开放安排"';
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: badJson, tools: [{ name: 'finish_draft', arguments: { review: '坏提交同轮保持。' } }] },
    { content: '沿用旧候选。', tools: [{ name: 'finish_draft', arguments: { review: '沿用旧候选并保持。' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(finishes[0].result.accepted, false);
    assert.equal(finishes[0].result.stage, 'finish-submission-failed');
    assert.equal(finishes[1].result.accepted, true);
    assert.equal(run.state.grayDraft.postRender.completed, true);
    assert.equal(run.state.grayDraft.submissionFailures, 1);
  } finally { await run.rm(); }
});

test('选择非最新候选需说明退回原因：记录未采用的布局修订', async () => {
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: '只改组合。', tools: [renderColumn] },
    { content: '退回初版布局。', tools: [{ name: 'finish_draft', arguments: { renderId: 1, review: '退回初版。' } }] },
    { content: '写明原因。', tools: [{ name: 'finish_draft', arguments: { renderId: 1, review: '退回初版。', reason: '布局修订未采用：通栏使阅读顺序变差' } }] },
    { content: '收工。', tools: [] },
  ]);
  try {
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(finishes[0].result.accepted, false);
    assert.equal(finishes[0].result.stage, 'finish-version-mismatch');
    assert.equal(finishes[1].result.accepted, true);
    assert.equal(finishes[1].result.superseded, true);
    assert.equal(finishes[1].result.revisionNotAdopted, true);
    const delivery = run.state.grayDraft.postRender.delivery;
    assert.equal(delivery.renderId, 1);
    assert.equal(delivery.supersededRenderId, 2);
    assert.equal(delivery.contentChanged, false);
    assert.match(delivery.reason, /未采用/);
  } finally { await run.rm(); }
});

test('发布前同版断言：磁盘候选计划与登记指纹不一致时 finish 拒绝', async () => {
  let tampered = false;
  const run = await runProtocol([
    { content: planJson(''), tools: ['check_plan'] },
    { content: '审稿。', tools: ['semantic_review'] },
    { content: '渲染。', tools: [renderSingle] },
    { content: '保持。', tools: [{ name: 'finish_draft', arguments: { review: '保持。' } }] },
    { content: '收工。', tools: [] },
  ], [], 8, async ({ chatIndex, output }) => {
    if (chatIndex !== 3 || tampered) return;
    tampered = true;
    const planPath = path.join(output, 'agent-renders', 'render-1', 'plan.json');
    const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
    plan.pages[0].items[0].blocks[0].text = `${plan.pages[0].items[0].blocks[0].text}（磁盘篡改）`;
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');
  });
  try {
    assert.equal(tampered, true);
    const finishes = run.events.filter(event => event.tool === 'finish_draft');
    assert.equal(finishes[0].result.accepted, false);
    assert.equal(finishes[0].result.stage, 'finish-invalid');
    assert.match(finishes[0].result.reason, /指纹与登记不一致/);
    assert.equal(run.state.grayDraft.postRender.completed, false);
  } finally { await run.rm(); }
});

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
