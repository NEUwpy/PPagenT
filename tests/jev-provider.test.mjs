import assert from "node:assert/strict";
import test from "node:test";
import { JevDecisionsProvider } from "../src/runner/jev-provider.mjs";

test("JEV provider sends the bounded Decisions request and records redaction-safe events", async () => {
  const calls = [];
  const events = [];
  const provider = new JevDecisionsProvider({
    apiKey: "sk-test-secret",
    model: "~typesafe/jev-latest",
    endpoint: "https://example.test/decisions",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ model: "~typesafe/jev-latest", answers: { candidateId: { type: "choice", choice: "cards-horizontal-equal" } }, usage: { total_tokens: 12 } }); },
      };
    },
    observer: async (event) => events.push(event),
  });

  const result = await provider.decide({
    state: "页面需要表达三个并列事实",
    questions: { candidateId: { type: "choice", instructions: "选择候选", criteria: { "cards-horizontal-equal": "三个并列卡片" } } },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/decisions");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk-test-secret");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "~typesafe/jev-latest",
    state: "页面需要表达三个并列事实",
    questions: { candidateId: { type: "choice", instructions: "选择候选", criteria: { "cards-horizontal-equal": "三个并列卡片" } } },
  });
  assert.equal(result.answers.candidateId.choice, "cards-horizontal-equal");
  assert.equal(events[0].status, "running");
  assert.equal(events.at(-1).status, "succeeded");
});
