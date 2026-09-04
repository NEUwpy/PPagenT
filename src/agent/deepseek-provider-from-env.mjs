import fs from "node:fs/promises";
import path from "node:path";
import { createDeepSeekDirectorProvider } from "./deepseek-director-provider.mjs";

export async function loadDeepSeekLocalConfig(root) {
  const configPath = path.join(path.resolve(root), "config", "deepseek.local.json");
  try {
    return JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`无法读取本地 DeepSeek 配置：${configPath}：${error.message}`);
  }
}

function roleSettings(local, name, defaults = {}, globalMaxTokens) {
  const role = local.roles?.[name] ?? {};
  const prefix = `PPAGENT_DEEPSEEK_${name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;
  const apiKey = process.env[`${prefix}_API_KEY`] || role.apiKey;
  const model = process.env[`${prefix}_MODEL`] || role.model;
  const baseUrl = process.env[`${prefix}_BASE_URL`] || role.baseUrl;
  const endpoint = process.env[`${prefix}_ENDPOINT`]
    || role.endpoint
    || (baseUrl ? `${baseUrl.replace(/\/$/, "")}/chat/completions` : undefined);
  return {
    ...(apiKey ? { apiKey } : {}),
    ...(model ? { model } : {}),
    ...(endpoint ? { endpoint } : {}),
    enabled: role.enabled ?? defaults.enabled ?? true,
    thinking: process.env[`${prefix}_THINKING`] || role.thinking || defaults.thinking
      || process.env.PPAGENT_DEEPSEEK_THINKING || local.thinking || "enabled",
    reasoningEffort: process.env[`${prefix}_REASONING_EFFORT`] || role.reasoningEffort
      || defaults.reasoningEffort || process.env.PPAGENT_DEEPSEEK_REASONING_EFFORT
      || local.reasoningEffort || "high",
    maxTokens: Number.parseInt(
      process.env[`${prefix}_MAX_TOKENS`] || String(role.maxTokens ?? defaults.maxTokens ?? globalMaxTokens),
      10,
    ),
  };
}

function unconfiguredProvider(model) {
  const unavailable = async () => {
    const error = new Error("DeepSeek 未配置，正式工作流将使用确定性兜底路径");
    error.code = "DIRECTOR_PROVIDER_UNAVAILABLE";
    throw error;
  };
  return {
    metadata: { providerKind: "deepseek-unconfigured", model },
    contentDirector: unavailable,
    refineContent: unavailable,
    visualDirector: unavailable,
  };
}

export async function createConfiguredDeepSeekProvider({ root = process.cwd(), observer } = {}) {
  const resolvedRoot = path.resolve(root);
  const local = await loadDeepSeekLocalConfig(resolvedRoot);
  const baseUrl = process.env.PPAGENT_DEEPSEEK_BASE_URL || local.baseUrl || "https://api.deepseek.com";
  const endpoint = process.env.PPAGENT_DEEPSEEK_ENDPOINT
    || local.endpoint
    || `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const maxTokens = Number.parseInt(
    process.env.PPAGENT_DEEPSEEK_MAX_TOKENS || String(local.maxTokens ?? 32768),
    10,
  );
  const requestTimeoutMs = Number.parseInt(
    process.env.PPAGENT_DEEPSEEK_TIMEOUT_MS || String(local.requestTimeoutMs ?? 120000),
    10,
  );
  const model = process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash";
  const apiKey = process.env.DEEPSEEK_API_KEY || local.apiKey;
  const settings = {
    content: roleSettings(local, "content", { thinking: "disabled", reasoningEffort: "low", maxTokens: 16384 }, maxTokens),
    structure: roleSettings(local, "structure", { enabled: false, thinking: "disabled", maxTokens: 4096 }, maxTokens),
    visualIntent: roleSettings(local, "visualIntent", { thinking: "disabled", maxTokens: 8192 }, maxTokens),
    visualComposition: roleSettings(local, "visualComposition", { thinking: "enabled", reasoningEffort: "low", maxTokens: 8192 }, maxTokens),
    reviewer: roleSettings(local, "reviewer", { thinking: "enabled", reasoningEffort: "low", maxTokens: 8192 }, maxTokens),
  };
  const provider = apiKey
    ? await createDeepSeekDirectorProvider({
      root: resolvedRoot,
      apiKey,
      model,
      endpoint,
      thinking: process.env.PPAGENT_DEEPSEEK_THINKING || local.thinking || "enabled",
      reasoningEffort: process.env.PPAGENT_DEEPSEEK_REASONING_EFFORT || local.reasoningEffort || "high",
      maxTokens,
      requestTimeoutMs,
      ...settings,
      observer,
    })
    : unconfiguredProvider(model);
  return {
    provider,
    publicConfig: {
      provider: "DeepSeek",
      model,
      endpoint,
      configured: Boolean(apiKey),
      roles: Object.fromEntries(["content", "visualComposition", "reviewer"].map((name) => {
        const setting = settings[name];
        return [name, {
          enabled: setting.enabled,
          thinking: setting.thinking,
          reasoningEffort: setting.reasoningEffort,
          maxTokens: setting.maxTokens,
          model: setting.model ?? model,
          endpoint: setting.endpoint ?? endpoint,
          configured: Boolean(setting.apiKey ?? apiKey),
        }];
      })),
    },
  };
}

const configured = await createConfiguredDeepSeekProvider({ root: process.cwd() });
export default configured.provider;
