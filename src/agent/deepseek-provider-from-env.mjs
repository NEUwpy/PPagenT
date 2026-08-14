import fs from "node:fs/promises";
import path from "node:path";
import { createDeepSeekDirectorProvider } from "./deepseek-director-provider.mjs";

async function loadLocalConfig(root) {
  const configPath = path.join(root, "config", "deepseek.local.json");
  try {
    return JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`无法读取本地 DeepSeek 配置：${configPath}：${error.message}`);
  }
}

const root = path.resolve(process.cwd());
const local = await loadLocalConfig(root);
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

function roleSettings(name, defaults = {}) {
  const role = local.roles?.[name] ?? {};
  const prefix = `PPAGENT_DEEPSEEK_${name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;
  const roleMaxTokens = Number.parseInt(
    process.env[`${prefix}_MAX_TOKENS`] || String(role.maxTokens ?? defaults.maxTokens ?? maxTokens),
    10,
  );
  return {
    thinking: process.env[`${prefix}_THINKING`] || role.thinking || defaults.thinking
      || process.env.PPAGENT_DEEPSEEK_THINKING || local.thinking || "enabled",
    reasoningEffort: process.env[`${prefix}_REASONING_EFFORT`] || role.reasoningEffort
      || defaults.reasoningEffort || process.env.PPAGENT_DEEPSEEK_REASONING_EFFORT
      || local.reasoningEffort || "high",
    maxTokens: roleMaxTokens,
  };
}

export default await createDeepSeekDirectorProvider({
  root,
  apiKey: process.env.DEEPSEEK_API_KEY || local.apiKey,
  model: process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash",
  endpoint,
  thinking: process.env.PPAGENT_DEEPSEEK_THINKING || local.thinking || "enabled",
  reasoningEffort: process.env.PPAGENT_DEEPSEEK_REASONING_EFFORT || local.reasoningEffort || "high",
  maxTokens,
  requestTimeoutMs,
  content: roleSettings("content", { thinking: "enabled", reasoningEffort: "low", maxTokens: 16384 }),
  structure: roleSettings("structure", { thinking: "disabled", maxTokens: 4096 }),
  visualIntent: roleSettings("visualIntent", { thinking: "disabled", maxTokens: 8192 }),
  visualComposition: roleSettings("visualComposition", { thinking: "disabled", maxTokens: 8192 }),
  reviewer: roleSettings("reviewer", { thinking: "enabled", reasoningEffort: "low", maxTokens: 8192 }),
});
