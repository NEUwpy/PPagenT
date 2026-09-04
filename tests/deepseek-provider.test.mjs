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

test("视觉导演可以使用独立模型与凭证且公开配置不泄露密钥", async (context) => {
  const names = [
    "DEEPSEEK_API_KEY",
    "PPAGENT_DEEPSEEK_MODEL",
    "PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_API_KEY",
    "PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_MODEL",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  context.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  process.env.DEEPSEEK_API_KEY = "content-secret";
  process.env.PPAGENT_DEEPSEEK_MODEL = "deepseek-v4-flash";
  process.env.PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_API_KEY = "visual-secret";
  process.env.PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_MODEL = "deepseek-v4-flash-vision-exp";
  const { provider, publicConfig } = await createConfiguredDeepSeekProvider({ root: process.cwd() });
  assert.match(provider.metadata.visualCompositionModel, /deepseek-v4-flash-vision-exp/);
  assert.equal(publicConfig.model, "deepseek-v4-flash");
  assert.equal(publicConfig.roles.visualComposition.model, "deepseek-v4-flash-vision-exp");
  assert.equal(JSON.stringify(publicConfig).includes("content-secret"), false);
  assert.equal(JSON.stringify(publicConfig).includes("visual-secret"), false);
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

test("DeepSeek Vision Provider 使用多模态 Chat Completions 且日志不保留图片 base64", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-deepseek-vision-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const imagePath = path.join(root, "page.png");
  await fs.writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  let requestBody = null;
  const events = [];
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    model: "deepseek-v4-flash-vision-exp",
    observer: async (event) => events.push(event),
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return {
        ok: true,
        async json() { return { choices: [{ message: { content: "{}" } }] }; },
      };
    },
  });
  await model.generateJson({
    role: "视觉审查者",
    task: "审查页面",
    context: { imageOrder: [1] },
    outputSchema: { name: "review", schema: { type: "object" } },
    imagePaths: [imagePath],
  });
  assert.equal(requestBody.messages[1].content[0].type, "text");
  assert.equal(requestBody.messages[1].content[1].type, "image_url");
  assert.match(requestBody.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
  const running = events.find((event) => event.status === "running");
  assert.equal(running.request.messages[1].content[1].image_url.url, "[inline image/png omitted from log]");
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

test("DeepSeek Provider 的非法输出日志保留脱敏响应轮廓", async () => {
  const events = [];
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    thinking: "disabled",
    observer: async (event) => events.push(event),
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          id: "response-test",
          model: "deepseek-v4-flash",
          choices: [{
            finish_reason: "length",
            message: { content: "", reasoning_content: "内部推理不应写入日志" },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        };
      },
    }),
  });
  await assert.rejects(model.generateJson({
    role: "导演",
    task: "测试",
    context: {},
    outputSchema: { name: "test", schema: { type: "object" } },
    maxJsonAttempts: 1,
  }), (error) => error.code === "MODEL_JSON_INVALID");
  const invalid = events.find((event) => event.status === "invalid-output");
  assert.equal(invalid.responseDiagnostic.finishReason, "length");
  assert.equal(invalid.responseDiagnostic.contentLength, 0);
  assert.equal(invalid.responseDiagnostic.reasoningContentLength, 10);
  assert.equal("response" in invalid, false);
  assert.deepEqual(invalid.usage, { prompt_tokens: 10, completion_tokens: 20 });
});
