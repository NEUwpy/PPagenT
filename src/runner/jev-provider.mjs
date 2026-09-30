import { loadCredentialValues } from "../runtime/local-credentials.mjs";

function retryable(status) {
  return status === 429 || status >= 500;
}

export class JevDecisionsProvider {
  constructor({ apiKey, model = "~typesafe/jev-latest", endpoint = "https://openrouter.ai/api/alpha/decisions", observer = null, fetchImpl = globalThis.fetch, requestTimeoutMs = 180000, maxAttempts = 2 }) {
    if (!apiKey) throw new Error("缺少 OPENROUTER_API_KEY：JEV 不能在没有凭证时静默改用其它模型");
    if (typeof fetchImpl !== "function") throw new Error("当前 Node 运行时没有 fetch");
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.observer = typeof observer === "function" ? observer : null;
    this.fetchImpl = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
    this.maxAttempts = maxAttempts;
    this.identity = `openrouter-decisions:${model}`;
  }

  async observe(event) {
    if (this.observer) await this.observer({ source: "runner", ...event });
  }

  async decide({ state, questions }) {
    const body = { model: this.model, state, questions };
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      await this.observe({ type: "api-call", status: "running", attempt, endpoint: this.endpoint, model: this.model, request: body, input: body });
      let response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
      } catch (error) {
        lastError = error;
        await this.observe({ type: "api-call", status: "failed", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: this.model, error: { code: error?.code, message: error?.message ?? String(error) } });
        if (attempt < this.maxAttempts) continue;
        const timeout = new Error(`JEV 请求在 ${this.requestTimeoutMs}ms 内没有完成：${error.message}`);
        timeout.code = "JEV_REQUEST_TIMEOUT";
        throw timeout;
      }
      const responseText = await response.text();
      let payload;
      try { payload = JSON.parse(responseText); } catch { payload = { raw: responseText }; }
      if (!response.ok) {
        const failure = new Error(`JEV 调用失败：${response.status} ${responseText}`);
        failure.code = "JEV_REQUEST_FAILED";
        failure.status = response.status;
        await this.observe({ type: "api-call", status: "failed", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: this.model, responseStatus: response.status, response: payload });
        if (retryable(response.status) && attempt < this.maxAttempts) { lastError = failure; continue; }
        throw failure;
      }
      if (!payload || !payload.answers || Array.isArray(payload.answers) || typeof payload.answers !== "object") {
        const malformed = new Error("JEV 响应没有 answers");
        malformed.code = "JEV_RESPONSE_MALFORMED";
        await this.observe({ type: "api-call", status: "invalid-output", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: this.model, response: payload });
        throw malformed;
      }
      await this.observe({ type: "api-call", status: "succeeded", attempt, durationMs: Date.now() - startedAt, endpoint: this.endpoint, model: payload.model ?? this.model, usage: payload.usage ?? null, response: payload, output: payload });
      return payload;
    }
    throw lastError;
  }
}

export async function buildJevProviderFromEnv({ root = process.cwd(), observer, fetchImpl, model: modelOverride, endpoint: endpointOverride } = {}) {
  const local = await loadCredentialValues(root);
  const apiKey = process.env.OPENROUTER_API_KEY || local.OPENROUTER_API_KEY;
  const model = modelOverride || process.env.PPAGENT_JEV_MODEL || local.PPAGENT_JEV_MODEL || "~typesafe/jev-latest";
  const endpoint = endpointOverride || process.env.PPAGENT_JEV_ENDPOINT || local.PPAGENT_JEV_ENDPOINT || "https://openrouter.ai/api/alpha/decisions";
  const requestTimeoutMs = Number.parseInt(process.env.PPAGENT_JEV_TIMEOUT_MS || local.PPAGENT_JEV_TIMEOUT_MS || "180000", 10);
  return new JevDecisionsProvider({ apiKey, model, endpoint, observer, fetchImpl, requestTimeoutMs });
}

