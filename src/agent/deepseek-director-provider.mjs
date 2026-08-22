import path from "node:path";
import { createModelDirectorProvider } from "./model-director-provider.mjs";
import { loadDirectorGuidelines } from "./director-guidelines.mjs";
import { loadDirectorOutputSchemas } from "./director-output-schemas.mjs";

function messageContent(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("DeepSeek Chat Completions API 没有返回可解析的 message.content");
    error.code = "MODEL_CONTENT_EMPTY";
    throw error;
  }
  return content;
}

function normalizeThinking(value) {
  if (value === undefined || value === null || value === "") return "enabled";
  const normalized = String(value).toLowerCase();
  if (!new Set(["enabled", "disabled"]).has(normalized)) {
    throw new Error("PPAGENT_DEEPSEEK_THINKING 只允许 enabled 或 disabled");
  }
  return normalized;
}

export class DeepSeekJsonModel {
  constructor({
    apiKey,
    model = "deepseek-v4-flash",
    endpoint = "https://api.deepseek.com/chat/completions",
    thinking = "enabled",
    reasoningEffort = "high",
    maxTokens = 32768,
    maxJsonAttempts = 2,
    requestTimeoutMs = 120000,
    fetchImpl = globalThis.fetch,
  }) {
    if (!apiKey) throw new Error("缺少 DEEPSEEK_API_KEY");
    if (!model) throw new Error("缺少 PPAGENT_DEEPSEEK_MODEL");
    if (typeof fetchImpl !== "function") throw new Error("当前 Node 运行时没有 fetch");
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) throw new Error("PPAGENT_DEEPSEEK_MAX_TOKENS 必须是正整数");
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1000) throw new Error("DeepSeek requestTimeoutMs 必须是不小于 1000 的整数");
    if (!Number.isInteger(maxJsonAttempts) || maxJsonAttempts < 1 || maxJsonAttempts > 3) {
      throw new Error("maxJsonAttempts 必须是 1 到 3 之间的整数");
    }
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.thinking = normalizeThinking(thinking);
    this.reasoningEffort = reasoningEffort;
    this.maxTokens = maxTokens;
    this.maxJsonAttempts = maxJsonAttempts;
    this.requestTimeoutMs = requestTimeoutMs;
    this.fetchImpl = fetchImpl;
    this.identity = `deepseek-chat-completions:${model}:${this.thinking}`;
  }

  async generateJson({
    role,
    task,
    context,
    outputSchema,
    imagePaths = [],
    maxJsonAttempts = this.maxJsonAttempts,
    requestTimeoutMs = this.requestTimeoutMs,
  }) {
    if (!outputSchema?.name || !outputSchema?.schema) throw new Error("模型调用缺少输出 JSON schema");
    if (imagePaths.length) {
      throw new Error("DeepSeek V4 Flash Provider 当前不支持 PPagenT 的逐页图片审查；请使用 production 模式，或为 development 模式配置视觉模型 Provider");
    }
    const schemaText = JSON.stringify(outputSchema.schema);
    const body = {
      model: this.model,
      messages: [
        {
          role: "system",
          content: `${role}。只输出一个 JSON 对象，不要 Markdown、解释或代码围栏。输出必须满足名为 ${outputSchema.name} 的 JSON Schema：${schemaText}`,
        },
        {
          role: "user",
          content: `${task}\n\n以下是唯一工作上下文：\n${JSON.stringify(context)}`,
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: this.thinking },
      max_tokens: this.maxTokens,
      stream: false,
    };
    if (this.thinking === "enabled") body.reasoning_effort = this.reasoningEffort;

    let lastError;
    for (let attempt = 1; attempt <= maxJsonAttempts; attempt += 1) {
      const requestBody = structuredClone(body);
      if (attempt > 1) {
        requestBody.messages[0].content += " 上一响应为空或不是可解析 JSON；本次必须正确转义 JSON 字符串中的双引号。";
        if (lastError?.code === "MODEL_CONTENT_EMPTY" && requestBody.thinking?.type === "enabled") {
          requestBody.thinking = { type: "disabled" };
          delete requestBody.reasoning_effort;
          requestBody.messages[0].content += " 上一轮思考模式没有返回最终内容，本次关闭思考并直接输出 JSON。";
        }
      }
      let response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (error) {
        lastError = error;
        if (attempt < maxJsonAttempts) continue;
        const requestError = new Error(`DeepSeek 请求在 ${requestTimeoutMs}ms 内没有完成：${error.message}`);
        requestError.code = "MODEL_REQUEST_TIMEOUT";
        throw requestError;
      }
      if (!response.ok) {
        throw new Error(`DeepSeek Chat Completions API 调用失败：${response.status} ${await response.text()}`);
      }
      try {
        return JSON.parse(messageContent(await response.json()));
      } catch (error) {
        lastError = error;
      }
    }
    const error = new Error(`DeepSeek 连续 ${maxJsonAttempts} 次没有返回可解析 JSON：${lastError?.message ?? "unknown error"}`);
    error.code = "MODEL_JSON_INVALID";
    throw error;
  }
}

export async function createDeepSeekDirectorProvider({
  root,
  apiKey,
  model,
  endpoint,
  thinking,
  reasoningEffort,
  maxTokens,
  requestTimeoutMs,
  content = {},
  structure = {},
  visualIntent = {},
  visualComposition = {},
  reviewer = {},
  fetchImpl,
}) {
  const resolvedRoot = path.resolve(root);
  const [schemas, guidelines] = await Promise.all([
    loadDirectorOutputSchemas(resolvedRoot),
    loadDirectorGuidelines(resolvedRoot),
  ]);
  const shared = { apiKey, model, endpoint, thinking, reasoningEffort, maxTokens, requestTimeoutMs, fetchImpl };
  const contentModel = new DeepSeekJsonModel({ ...shared, ...content });
  const structureModel = structure?.enabled === true
    ? new DeepSeekJsonModel({ ...shared, ...structure })
    : null;
  const visualIntentModel = new DeepSeekJsonModel({ ...shared, ...visualIntent });
  const visualCompositionModel = new DeepSeekJsonModel({ ...shared, ...visualComposition });
  const reviewerModel = new DeepSeekJsonModel({ ...shared, ...reviewer });
  return createModelDirectorProvider({
    contentModel,
    structureModel,
    visualIntentModel,
    visualCompositionModel,
    reviewerModel,
    schemas,
    guidelines,
  });
}
