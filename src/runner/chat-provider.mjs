// OpenAI 兼容的 chat 调用，带 tools / tool_calls。
//
// 为什么不复用 src/agent/deepseek-director-provider.mjs：那个类做的是 `generateJson`——
// 只发 [system, user] 并强制 `response_format: json_object`，拿回一个 JSON 对象就结束，
// 不看 `tool_calls`、也不支持多轮。它服务的是"一次问答"的导演流程，不是工具循环。
// 可复用的是它的 HTTP 骨架（鉴权头、AbortSignal 超时、错误码、observer 脱敏），本文件照此写。
//
// 与厂商无关：任何 OpenAI 兼容端点都能用，配置走项目既有变量名（见 buildChatProviderFromEnv）。
// 这刻意避免把运行器绑死在一家模型上——换模型只改配置，不改代码。

import { loadDeepSeekLocalConfig } from "../agent/deepseek-provider-from-env.mjs";

/** 只有这些情况值得重发：网络抖动、限流、服务端 5xx。4xx 是我们请求写错了，重发只是浪费一次调用。 */
function isRetryable(status) {
  return status === 429 || (Number.isInteger(status) && status >= 500);
}

function normalizeContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // 部分端点返回分段内容数组；只要文本段，图片段对循环无用。
    return content.filter((part) => part?.type === "text").map((part) => part.text ?? "").join("");
  }
  return null;
}

/** tool_calls[].function.arguments 规范上是一段 JSON 字符串，但实测有端点直接回对象。两种都收下。 */
function normalizeToolCalls(message) {
  if (!Array.isArray(message?.tool_calls)) return [];
  return message.tool_calls.map((call, index) => ({
    id: call.id ?? `call_${index}`,
    name: call.function?.name ?? call.name ?? "",
    arguments: typeof call.function?.arguments === "string"
      ? call.function.arguments
      : JSON.stringify(call.function?.arguments ?? call.arguments ?? {}),
  }));
}

export class ChatCompletionProvider {
  constructor({
    apiKey,
    model,
    endpoint,
    maxTokens = 4096,
    temperature,
    requestTimeoutMs = 180000,
    maxAttempts = 2,
    fetchImpl = globalThis.fetch,
    observer = null,
    extraBody = {},
  }) {
    if (!apiKey) throw new Error("缺少模型密钥：无法在没有密钥的情况下运行工具循环（不会静默降级为确定性路径，那会掩盖真实失败）");
    if (!model) throw new Error("缺少模型名");
    if (!endpoint) throw new Error("缺少 chat completions 端点");
    if (typeof fetchImpl !== "function") throw new Error("当前 Node 运行时没有 fetch");
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) throw new Error("maxTokens 必须是正整数");
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1000) throw new Error("requestTimeoutMs 必须是不小于 1000 的整数");
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 4) throw new Error("maxAttempts 必须是 1 到 4 之间的整数");
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.requestTimeoutMs = requestTimeoutMs;
    this.maxAttempts = maxAttempts;
    this.fetchImpl = fetchImpl;
    this.observer = typeof observer === "function" ? observer : null;
    this.extraBody = extraBody;
    this.identity = `chat-completions:${model}`;
  }

  async observe(event) {
    if (this.observer) await this.observer({ source: "runner", ...event });
  }

  /**
   * 发一轮。返回 {content, toolCalls, usage, finishReason, ...}；不解析、不派发工具——
   * 派发是 loop 的事，provider 只管"把这一轮问出来"。这种分工让 provider 可被单测替身替换。
   */
  async complete({ messages, tools = [], toolChoice = "auto", requestTimeoutMs = this.requestTimeoutMs }) {
    const body = {
      model: this.model,
      messages,
      stream: false,
      max_tokens: this.maxTokens,
      ...(this.temperature === undefined ? {} : { temperature: this.temperature }),
      ...this.extraBody,
    };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = toolChoice;
    }

    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      await this.observe({ type: "api-call", status: "running", attempt, endpoint: this.endpoint, model: this.model, messageCount: messages.length, toolCount: tools.length });
      let response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (error) {
        lastError = error;
        await this.observe({ type: "api-call", status: "failed", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: this.model, error: { code: error?.code, message: error?.message ?? String(error) } });
        if (attempt < this.maxAttempts) continue;
        const timeout = new Error(`模型请求在 ${requestTimeoutMs}ms 内没有完成：${error.message}`);
        timeout.code = "MODEL_REQUEST_TIMEOUT";
        throw timeout;
      }

      if (!response.ok) {
        const responseText = await response.text();
        await this.observe({ type: "api-call", status: "failed", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: this.model, responseStatus: response.status, responseText });
        const failure = new Error(`模型调用失败：${response.status} ${responseText}`);
        failure.code = "MODEL_REQUEST_FAILED";
        failure.status = response.status;
        if (isRetryable(response.status) && attempt < this.maxAttempts) {
          lastError = failure;
          continue;
        }
        throw failure;
      }

      const json = await response.json();
      const message = json?.choices?.[0]?.message;
      if (!message) {
        const malformed = new Error("模型响应里没有 choices[0].message");
        malformed.code = "MODEL_RESPONSE_MALFORMED";
        await this.observe({ type: "api-call", status: "invalid-output", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: this.model, response: json });
        throw malformed;
      }
      const result = {
        content: normalizeContent(message.content),
        toolCalls: normalizeToolCalls(message),
        usage: json.usage ?? null,
        finishReason: json?.choices?.[0]?.finish_reason ?? null,
        responseId: json.id ?? null,
        model: json.model ?? this.model,
        attempts: attempt,
      };
      // endpoint/model 一并带上：只在这条"收到回复"的事件里才拿得到响应方自报的 model，
      // 不带的话下游只能拿请求事件反推，或者干脆显示一个编出来的名字。
      await this.observe({ type: "api-call", status: "succeeded", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: result.model, usage: result.usage, finishReason: result.finishReason, toolCallNames: result.toolCalls.map((call) => call.name), contentLength: result.content?.length ?? 0 });
      return result;
    }
    throw lastError;
  }
}

/**
 * 从项目既有配置构造 provider（config/deepseek.local.json + PPAGENT_DEEPSEEK_* + DEEPSEEK_API_KEY）。
 * 变量名与 src/agent 里那套保持一致，避免出现第二份"模型配在哪"的答案。
 */
export async function buildChatProviderFromEnv({ root = process.cwd(), observer, model: modelOverride, maxTokens } = {}) {
  const resolvedRoot = root;
  const local = await loadDeepSeekLocalConfig(resolvedRoot);
  const baseUrl = process.env.PPAGENT_DEEPSEEK_BASE_URL || local.baseUrl || "https://api.deepseek.com";
  const endpoint = process.env.PPAGENT_DEEPSEEK_ENDPOINT
    || local.endpoint
    || `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const resolvedMaxTokens = maxTokens
    ?? Number.parseInt(process.env.PPAGENT_DEEPSEEK_MAX_TOKENS || String(local.maxTokens ?? 4096), 10);
  const requestTimeoutMs = Number.parseInt(
    process.env.PPAGENT_DEEPSEEK_TIMEOUT_MS || String(local.requestTimeoutMs ?? 180000),
    10,
  );
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.PPAGENT_DEEPSEEK_API_KEY || local.apiKey;
  const model = modelOverride || process.env.PPAGENT_RUNNER_MODEL || process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash";
  return new ChatCompletionProvider({
    apiKey,
    model,
    endpoint,
    maxTokens: resolvedMaxTokens,
    requestTimeoutMs,
    observer,
    extraBody: { thinking: { type: process.env.PPAGENT_DEEPSEEK_THINKING || local.thinking || "disabled" } },
  });
}
