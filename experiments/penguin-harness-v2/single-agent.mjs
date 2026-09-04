import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  createAgent,
  defaultSystemConfig,
  addModel,
  setDefaultModel,
  isCompleteModelMessage,
  isEventMessage,
  loadOrInitAgentState,
  systemConfigPath,
  userText,
} from "@prismshadow/penguin-core";

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function remove(file) {
  try {
    await fs.rm(file, { force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function eventForLog(message) {
  const payload = message?.payload ?? {};
  if (payload.type === "tool_call") return { type: "tool_call", name: payload.tool_name ?? payload.name ?? null };
  if (payload.type === "tool_call_output") return { type: "tool_call_output", id: payload.tool_call_id ?? null, error: payload.is_error ?? false };
  if (payload.type === "token_usage") return { type: "token_usage", request: payload.request ?? null, session: payload.session ?? null };
  if (payload.type === "text" && isCompleteModelMessage(message)) return { type: "text", text: String(payload.text ?? "").slice(-1200) };
  if (isEventMessage(message) && ["request_begin", "request_end", "mcp_connect_begin", "mcp_connect_end", "abort"].includes(payload.type)) {
    return { type: payload.type };
  }
  return null;
}

export class PenguinSinglePptAgent {
  constructor({ root, runDir, config }) {
    this.root = path.resolve(root);
    this.runDir = path.resolve(runDir);
    this.config = config;
    this.experimentDir = path.dirname(fileURLToPath(import.meta.url));
    this.dataRoot = path.join(this.root, ".tmp", "penguin-harness-v2", "single-agent-data");
    this.projectId = "ppagent_single_agent";
    this.agentId = "ppagent_ppt_maker";
    this.session = null;
  }

  phaseContext(mode) {
    const dir = path.join(this.runDir, "penguin-single-agent", mode);
    return {
      dir,
      context: path.join(dir, "context.json"),
      final: path.join(dir, "final.json"),
      draft: path.join(dir, "draft.json"),
    };
  }

  async configureProjectModel() {
    const provider = this.config.provider ?? "deepseek";
    const modelId = this.config.model ?? "deepseek-v4-flash";
    const baseUrl = (this.config.baseUrl ?? "https://api.deepseek.com").replace(/\/chat\/completions\/?$/, "");
    await addModel(this.dataRoot, this.projectId, {
      provider,
      model_id: modelId,
      api_key: this.config.apiKey,
      base_url: baseUrl,
      client_type: this.config.clientType ?? "openai-chat",
      vision: false,
      // Incremental project tools keep each action small. A 16K output budget
      // encouraged the reasoning model to spend almost the whole allowance on
      // individual tool turns; 4K is enough for four page patches at a time.
      max_tokens: 4096,
    }, { setDefault: true });
    await setDefaultModel(this.dataRoot, this.projectId, { provider, model_id: modelId });
  }

  async configureAgent() {
    const state = await loadOrInitAgentState({ root: this.dataRoot, projectId: this.projectId, agentId: this.agentId });
    const base = defaultSystemConfig();
    const prompt = await fs.readFile(path.join(this.experimentDir, "prompts", "ppt-agent.md"), "utf8");
    const contexts = {
      content: this.phaseContext("content"),
      visual: this.phaseContext("visual"),
    };
    const server = (mode) => ({
      name: `ppagent_single_${mode}`,
      config: {
        transport: "stdio",
        command: process.execPath,
        args: [path.join(this.experimentDir, "mcp-server.mjs"), "--mode", mode],
        cwd: this.experimentDir,
        env: {
          PPAGENT_ROOT: this.root,
          PPAGENT_HARNESS_CONTEXT: contexts[mode].context,
          PPAGENT_HARNESS_FINAL: contexts[mode].final,
          PPAGENT_HARNESS_DRAFT: contexts[mode].draft,
        },
        permission: "rw",
        connectTimeoutMs: 30000,
        timeoutMs: 180000,
        maxOutputLength: 60000,
      },
    });
    const agentConfig = {
      ...base,
      name: "PPagenT PPT Maker",
      description: "共享上下文的 PPagenT 内容与视觉生成 Agent",
      version: 3,
      system_prompt: prompt,
      max_turns: 10,
      model: { ...base.model, max_tokens: 4096, thinking_level: "low", timeoutMs: 180000 },
      memory: { ...base.memory, enabled: false },
      vault: { ...base.vault, enabled: false },
      schedules: { ...base.schedules, enabled: false },
      tools: {
        // DeepSeek should not roam the repository during deck generation. The
        // MCP surface already provides progressive disclosure at the exact
        // manuscript/page/candidate granularity needed by this workflow.
        builtin: [],
        mcpServers: [server("content"), server("visual")],
      },
    };
    await fs.writeFile(systemConfigPath(this.dataRoot, this.projectId, this.agentId), YAML.stringify(agentConfig), "utf8");

    const skillsDir = path.join(state.stateDir, "skills");
    const sourceDir = path.join(this.experimentDir, "skills");
    await fs.mkdir(skillsDir, { recursive: true });
    for (const entry of await fs.readdir(sourceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      await fs.cp(path.join(sourceDir, entry.name), path.join(skillsDir, entry.name), { recursive: true, force: true });
    }
  }

  async createPhaseSession() {
    await this.configureProjectModel();
    await this.configureAgent();
    const agent = await createAgent({ root: this.dataRoot, projectId: this.projectId, agentId: this.agentId });
    return agent.createSession({
      workspaceDir: this.root,
      provider: "deepseek",
      modelId: this.config.model ?? "deepseek-v4-flash",
      apiKey: this.config.apiKey,
      baseUrl: (this.config.baseUrl ?? "https://api.deepseek.com").replace(/\/chat\/completions\/?$/, ""),
      thinkingLevel: "low",
    });
  }

  async runPhase(mode, input) {
    if (!this.config?.apiKey) throw new Error("缺少 DeepSeek API Key");
    this.session?.dispose();
    this.session = await this.createPhaseSession();
    const context = this.phaseContext(mode);
    await fs.mkdir(context.dir, { recursive: true });
    await writeJson(context.context, input);
    await Promise.all([remove(context.final), remove(context.draft)]);
    const task = mode === "content"
      ? "现在进入内容阶段。使用 ppagent_single_content 建立内容项目，按页增量完成稿件分析、分页和内容编排，最后校验提交。不要调用视觉工具；提交成功后立即结束。"
      : "现在进入视觉阶段。内容项目已经冻结。使用 ppagent_single_visual 读取页级内容、规划全稿 Layout、选择已登记 Skill，并按页保存后验证。不要重写正文；验证通过或明确需要内容修订后立即结束。";
    const eventFile = path.join(this.runDir, "penguin-single-agent", `${mode}-events.ndjson`);
    const stats = { requests: 0, toolCalls: 0, finalText: "" };
    for await (const message of this.session.run([userText(task)], { approve: async () => "allow" })) {
      const event = eventForLog(message);
      if (!event) continue;
      await fs.appendFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
      if (event.type === "tool_call") stats.toolCalls += 1;
      if (event.type === "token_usage") stats.requests += 1;
      if (event.type === "text") stats.finalText = event.text;
      if (isEventMessage(message) && message.payload?.type === "abort") throw new Error(`Penguin 单 Agent 在 ${mode} 阶段被中止`);
    }
    await writeJson(path.join(this.runDir, "penguin-single-agent", `${mode}-summary.json`), stats);
    try {
      return JSON.parse(await fs.readFile(context.final, "utf8"));
    } catch (error) {
      const missing = new Error(`Penguin 单 Agent ${mode} 阶段未提交可用结果：${error.message}`);
      missing.code = "MODEL_JSON_INVALID";
      throw missing;
    }
  }

  dispose() {
    this.session?.dispose();
    this.session = null;
  }
}

export function createPenguinSingleAgentProvider({ root, runDir, config }) {
  const harness = new PenguinSinglePptAgent({ root, runDir, config });
  return {
    metadata: {
      providerKind: "penguin-single-agent",
      harness: "@prismshadow/penguin-core@0.2.9",
      model: config.model ?? "deepseek-v4-flash",
      architecture: "one-ppt-agent-two-stateful-stages-native",
      formalWorkflowChanged: false,
    },
    contentDirector(input) { return harness.runPhase("content", input); },
    visualDirector(input) { return harness.runPhase("visual", input); },
    dispose() { harness.dispose(); },
  };
}
