import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildChatProviderFromEnv, ChatCompletionProvider } from '../../../src/runner/chat-provider.mjs';
import { buildJevProviderFromEnv, JevDecisionsProvider } from '../../../src/runner/jev-provider.mjs';
import { runGrayAgent } from '../../../src/runner/gray-agent.mjs';
import { grayBodyLayout, fitGrayText } from '../../../src/runner/gray-draft.mjs';
import { measuredLayoutCandidates, bindLayoutSelection, selectMeasuredLayouts } from '../../../src/runner/gray-layout-selection.mjs';
import { validateSemanticPlan } from '../../../src/runner/gray-semantics.mjs';
import { newRunState } from '../../../src/runner/state.mjs';

const { values: { live } } = parseArgs({ options: { live: { type: 'boolean' } } });
const root = path.resolve(import.meta.dirname, '../../..');
const output = path.join(import.meta.dirname, 'runs', new Date().toISOString().replaceAll(':', '-'));
const area = { width: 1170, height: 492 };
const metrics = { measureBody: grayBodyLayout, fitText: fitGrayText };
await fs.mkdir(output, { recursive: true });

function save(name, value) {
  return fs.writeFile(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function load(name) {
  const sourcePath = path.join(root, '稿件', '模拟稿库', `布局试排-${name}.md`);
  const source = await fs.readFile(sourcePath, 'utf8');
  return { name, source, sourcePath, state: newRunState(source, sourcePath) };
}

function freezeLayoutInput(input) {
  const [title, ...content] = input.state.sources;
  const groups = content.map(({ id, text }, index) => {
    const match = text.match(/^([^：]+)：(.+)$/u);
    return {
      id: `g${index + 1}`, heading: match?.[1] ?? '共同要求', role: match ? '主题内容' : '共同要求',
      importance: match ? 'primary' : 'supporting', kind: 'text',
      blocks: [{ id: `b${index + 1}`, text: match?.[2] ?? text, sourceIds: [id] }],
    };
  });
  return { schemaVersion: 'gray-plan-3', deckBrief: { title: title.text }, pages: [{
    pageId: 'p1', title: title.text, claim: title.text, pagePurpose: '说明原稿主题及共同要求',
    narrative: input.name === 'options' ? '两种方案对照，共用上线前置条件' : '各项服务并列，共用运转规则',
    sourceIds: [title.id], groups,
  }] };
}

function bindingResult(plan, measured, relation, candidateId) {
  try {
    const result = bindLayoutSelection(plan, measured, { pages: [{ pageId: 'p1', relation, candidateId, reason: '受控注入' }] });
    return { relation, candidateId, status: 'bound', receipts: result.receipts };
  } catch (error) {
    return { relation, candidateId, status: 'rejected', reason: error.message };
  }
}

const [options, services] = await Promise.all([load('options'), load('services')]);
const inputs = [options, services];
const locality = inputs.map((input) => {
  const plan = freezeLayoutInput(input);
  const measured = measuredLayoutCandidates(plan, area, metrics);
  const candidates = measured[0].candidates;
  return { name: input.name, plan, measured, checks: [
    ...candidates.map(({ id }) => bindingResult(plan, measured, input.name === 'options' ? 'comparison' : 'support', id)),
    ...candidates.map(({ id }) => bindingResult(plan, measured, 'parallel', id)),
    bindingResult(plan, measured, 'parallel', 'fabricated-id'),
  ] };
});
await save('controlled-layout.json', locality);

function safeFetch(endpoint, deadline) {
  return async (url, request) => {
    if (url !== endpoint) throw new Error('探针请求端点与预期不符');
    const response = await fetch(url, { ...request, redirect: 'error', signal: AbortSignal.any([request.signal, deadline]) });
    if (response.ok) return response;
    return new Response('', { status: response.status });
  };
}

function eventSummarizer(events) {
  return ({ status, durationMs, model, usage, responseStatus, toolCount, messageCount, finishReason, toolCallNames }) => {
    events.push({ status, durationMs, model, usage, responseStatus, toolCount, messageCount, finishReason, toolCallNames });
  };
}

function probeError(error) {
  return { status: 'failed', name: error.name, code: error.code ?? null, httpStatus: error.status ?? null, message: error.message };
}

async function runLive() {
  const chatEndpoint = 'https://api.deepseek.com/chat/completions';
  const jevEndpoint = 'https://openrouter.ai/api/alpha/decisions';
  const configuredChat = await buildChatProviderFromEnv({ root });
  const configuredJev = await buildJevProviderFromEnv({ root });
  if (configuredChat.endpoint !== chatEndpoint || configuredJev.endpoint !== jevEndpoint) {
    throw new Error('仅使用已确认的官方端点，未发出请求');
  }
  const deadline = AbortSignal.timeout(105_000);
  function chat(events, extraBody = {}, maxTokens = 2800) {
    return new ChatCompletionProvider({
      apiKey: configuredChat.apiKey, model: configuredChat.model, endpoint: chatEndpoint,
      maxTokens, temperature: 0, requestTimeoutMs: 25_000, maxAttempts: 1,
      fetchImpl: safeFetch(chatEndpoint, deadline), observer: eventSummarizer(events),
      extraBody: { ...configuredChat.extraBody, ...extraBody },
    });
  }
  function jev(calls) {
    const adapter = new JevDecisionsProvider({
      apiKey: configuredJev.apiKey, model: configuredJev.model, endpoint: jevEndpoint,
      requestTimeoutMs: 15_000, maxAttempts: 1, fetchImpl: safeFetch(jevEndpoint, deadline),
    });
    return {
      model: adapter.model,
      async decide(input) {
        const started = performance.now();
        const call = { input };
        calls.push(call);
        try {
          const response = await adapter.decide(input);
          call.response = { model: response.model, answers: response.answers, usage: response.usage };
          return response;
        } catch (error) {
          call.failure = probeError(error);
          throw error;
        } finally {
          call.durationMs = Math.round(performance.now() - started);
        }
      },
    };
  }

  const jobs = inputs.flatMap((input, index) => [
    execute(`one-shot-${input.name}`, async () => {
      const events = [];
      const instructions = '将一页稿件提炼为可直接阅读的灰稿语义计划，保留事实、时间、风险、联络渠道、限定条件与作用范围。群组说明明确所及范围，不做坐标、版式、分页或增补。每段内容都需来源。只输出 JSON：{"schemaVersion":"gray-plan-3","deckBrief":{"title":"…","audience":"…","objective":"…"},"pages":[{"pageId":"p1","title":"…","claim":"…","pagePurpose":"…","narrative":"…","sourceIds":["s1"],"groups":[{"id":"g1","role":"…","heading":"…","importance":"primary|supporting","kind":"text","blocks":[{"id":"b1","text":"…","sourceIds":["s2"]}]}]}]}。';
      try {
        const result = await chat(events, { response_format: { type: 'json_object' } }).complete({ messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: JSON.stringify(input.state.sources) },
        ] });
        if (result.finishReason === 'length') throw new Error('输出截断');
        const plan = JSON.parse(result.content);
        const report = validateSemanticPlan(input.state, plan);
        return { status: report.accepted ? 'program-accepted' : 'program-rejected', events, plan, report };
      } catch (error) { return { ...probeError(error), events }; }
    }),
    execute(`jev-${input.name}`, async () => {
      const calls = [];
      const directory = path.join(output, `jev-${input.name}-selector`);
      await fs.mkdir(directory);
      try {
        const selected = await selectMeasuredLayouts({ ...input, plan: locality[index].plan, area, metrics, directory, provider: jev(calls) });
        return { status: 'selected-awaiting-render', calls, receipts: selected.receipts };
      } catch (error) { return { ...probeError(error), calls }; }
    }),
  ]);
  jobs.push(execute('legacy-loop-services', async () => {
    const events = [], selectionCalls = [];
    try {
      const result = await runGrayAgent({
        source: services.sourcePath, root, output: path.join(output, 'legacy-services-artifacts'), area,
        provider: chat(events, {}, 5000), selectionProvider: jev(selectionCalls), useLayoutRules: true, maxTurns: 8,
      });
      return { status: result.state.grayDraft.status, stopReason: result.loop.stopReason,
        turns: result.loop.turns.map(turn => ({ stalled: turn.stalled, tools: turn.toolCalls.map(({ name, result }) => ({ name, accepted: result?.accepted ?? null })) })),
        events, selectionCalls, usage: result.loop.usage,
      };
    } catch (error) { return { ...probeError(error), events, selectionCalls }; }
  }));
  return Object.fromEntries(await Promise.all(jobs));
}

async function execute(name, call) {
  const started = performance.now();
  const result = { ...await call(), elapsedMs: Math.round(performance.now() - started) };
  await save(`${name}.json`, result);
  return [name, result.status];
}

const liveStatus = live ? await runLive() : null;
await save('summary.json', { mode: live ? 'official-live-and-controlled' : 'controlled-only', liveStatus });
console.log(JSON.stringify({ output, liveStatus }, null, 2));
