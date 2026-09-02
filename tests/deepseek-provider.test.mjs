import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DeepSeekJsonModel } from "../src/agent/deepseek-director-provider.mjs";
import { createConfiguredDeepSeekProvider } from "../src/agent/deepseek-provider-from-env.mjs";

test("未配置 API Key 时 Provider 可加载并把导演调用交给工作流兜底", async (context) => {
  const previous = process.env.DEEPSEEK_API_KEY;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-unconfigured-provider-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const { provider, publicConfig } = await createConfiguredDeepSeekProvider({ root });
    assert.equal(publicConfig.configured, false);
    await assert.rejects(
      provider.contentDirector({}),
      (error) => error.code === "DIRECTOR_PROVIDER_UNAVAILABLE",
    );
  } finally {
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  }
});

test("DeepSeek Provider 使用 V4 Flash Chat Completions JSON 输出", async () => {
  let requestUrl = "";
  let requestBody = null;
  let authorization = "";
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestBody = JSON.parse(init.body);
      authorization = init.headers.Authorization;
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: "{\"ok\":true}" } }] };
        },
      };
    },
  });

  const output = await model.generateJson({
    role: "PPagenT 内容导演",
    task: "输出测试对象",
    context: { source: "测试" },
    outputSchema: {
      name: "test_output",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      },
    },
  });

  assert.deepEqual(output, { ok: true });
  assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
  assert.equal(authorization, "Bearer test-key");
  assert.equal(requestBody.model, "deepseek-v4-flash");
  assert.deepEqual(requestBody.response_format, { type: "json_object" });
  assert.deepEqual(requestBody.thinking, { type: "enabled" });
  assert.equal(requestBody.reasoning_effort, "high");
  assert.match(requestBody.messages[0].content, /JSON Schema/);
  assert.match(requestBody.messages[0].content, /test_output/);
});

test("DeepSeek Provider 不伪装支持逐页图片审查", async () => {
  const model = new DeepSeekJsonModel({ apiKey: "test-key" });
  await assert.rejects(
    model.generateJson({
      role: "视觉审查者",
      task: "审查页面",
      context: {},
      outputSchema: { name: "review", schema: { type: "object" } },
      imagePaths: ["page.png"],
    }),
    /不支持 PPagenT 的逐页图片审查/,
  );
});

test("DeepSeek Provider 可关闭思考模式以降低固定工作流延迟", async () => {
  let requestBody = null;
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    thinking: "disabled",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: "{}" } }] };
        },
      };
    },
  });
  await model.generateJson({
    role: "导演",
    task: "测试",
    context: {},
    outputSchema: { name: "empty", schema: { type: "object" } },
  });
  assert.deepEqual(requestBody.thinking, { type: "disabled" });
  assert.equal("reasoning_effort" in requestBody, false);
});

test("DeepSeek Provider 对非法 JSON 只进行一次受控重答", async () => {
  let calls = 0;
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    thinking: "disabled",
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: calls === 1 ? '{"reason":"未转义"引号"}' : '{"ok":true}' } }] };
        },
      };
    },
  });
  const output = await model.generateJson({
    role: "导演",
    task: "测试",
    context: {},
    outputSchema: { name: "test", schema: { type: "object" } },
  });
  assert.deepEqual(output, { ok: true });
  assert.equal(calls, 2);
});

test("局部调用可以覆盖为单次尝试", async () => {
  let calls = 0;
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        async json() { return { choices: [{ message: { content: "not-json" } }] }; },
      };
    },
  });
  await assert.rejects(model.generateJson({
    role: "局部调用",
    task: "测试",
    context: {},
    outputSchema: { name: "test", schema: { type: "object" } },
    maxJsonAttempts: 1,
  }), (error) => error.code === "MODEL_JSON_INVALID");
  assert.equal(calls, 1);
});

test("DeepSeek Provider 的思考响应为空时第二次关闭思考直接返回 JSON", async () => {
  const requests = [];
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    thinking: "enabled",
    reasoningEffort: "max",
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return {
        ok: true,
        async json() {
          return requests.length === 1
            ? { choices: [{ message: { content: "" } }] }
            : { choices: [{ message: { content: '{"ok":true}' } }] };
        },
      };
    },
  });
  const output = await model.generateJson({
    role: "导演",
    task: "测试",
    context: {},
    outputSchema: { name: "test", schema: { type: "object" } },
  });
  assert.deepEqual(output, { ok: true });
  assert.deepEqual(requests[0].thinking, { type: "enabled" });
  assert.equal(requests[0].reasoning_effort, "max");
  assert.deepEqual(requests[1].thinking, { type: "disabled" });
  assert.equal("reasoning_effort" in requests[1], false);
});
