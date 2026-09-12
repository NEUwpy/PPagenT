import assert from "node:assert/strict";
import test from "node:test";
import { ChatCompletionProvider } from "../src/runner/chat-provider.mjs";

// 用假 fetch 打，不碰网络：这一组测的是"事件里到底报了什么"，不是"能不能连上模型"。
function providerWith(fetchImpl, observed, overrides = {}) {
  return new ChatCompletionProvider({
    apiKey: "test-key",
    model: "configured-model",
    endpoint: "https://api.example.com/v1/chat/completions",
    maxAttempts: 1,
    fetchImpl,
    observer: (event) => observed.push(event),
    ...overrides,
  });
}

const okResponse = (payload) => async () => ({
  ok: true, status: 200, json: async () => payload, text: async () => "",
});

test("成功事件带上端点与响应方自报的模型，不只带请求时写死的那个", async () => {
  const observed = [];
  const provider = providerWith(okResponse({
    id: "resp-1",
    // 端点回报的模型与请求里写的不一致（换名、路由到别处都会这样）。
    model: "served-model",
    choices: [{ message: { content: "好" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
  }), observed);

  const result = await provider.complete({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.model, "served-model");

  const running = observed.find((event) => event.status === "running");
  const succeeded = observed.find((event) => event.status === "succeeded");
  assert.ok(running && succeeded, "请求与成功两条事件都必须发出");
  assert.equal(running.endpoint, "https://api.example.com/v1/chat/completions");
  assert.equal(succeeded.endpoint, "https://api.example.com/v1/chat/completions");
  // 这条断言就是修掉的那个毛病：成功事件不带 endpoint/model 时，下游只能编一个服务商名字出来。
  assert.equal(succeeded.model, "served-model");
  assert.deepEqual(succeeded.usage, { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 });
});

test("失败事件也带端点，看板才能显示是哪家端点失败的", async () => {
  const observed = [];
  const provider = providerWith(async () => ({
    ok: false, status: 400, text: async () => "bad request",
  }), observed);

  await assert.rejects(() => provider.complete({ messages: [] }), /模型调用失败/);
  const failed = observed.find((event) => event.status === "failed");
  assert.ok(failed, "必须留下失败事件");
  assert.equal(failed.endpoint, "https://api.example.com/v1/chat/completions");
  assert.equal(failed.responseStatus, 400);
});

test("观测口收到的事件带 source:runner 前缀，工作台据此改写成 model", async () => {
  const observed = [];
  const provider = providerWith(okResponse({
    choices: [{ message: { content: "x" } }],
  }), observed);
  await provider.complete({ messages: [] });
  assert.ok(observed.length > 0);
  assert.ok(observed.every((event) => event.source === "runner"), "provider 不自己冒充工作台的事件来源");
});
