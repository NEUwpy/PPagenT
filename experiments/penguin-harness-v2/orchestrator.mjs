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
async function remove(file) { try { await fs.rm(file, { force: true }); } catch (error) { if (error?.code !== "ENOENT") throw error; } }
function eventForLog(message) {
  const payload = message?.payload ?? {};
  if (payload.type === "tool_call") return { type: "tool_call", name: payload.tool_name ?? payload.name ?? null };
  if (payload.type === "tool_call_output") return { type: "tool_call_output", id: payload.tool_call_id ?? null, error: payload.is_error ?? false };
  if (payload.type === "token_usage") return { type: "token_usage", request: payload.request ?? null, session: payload.session ?? null };
  if (payload.type === "text" && isCompleteModelMessage(message)) return { type: "text", text: String(payload.text ?? "").slice(-1000) };
  if (isEventMessage(message) && ["request_begin", "request_end", "mcp_connect_begin", "mcp_connect_end", "abort"].includes(payload.type)) return { type: payload.type };
  return null;
}

export class PenguinPptHarness {
  constructor({ root, runDir, config }) {
    this.root = path.resolve(root);
    this.runDir = path.resolve(runDir);
    this.config = config;
    this.experimentDir = path.dirname(fileURLToPath(import.meta.url));
    this.dataRoot = path.join(this.root, ".tmp", "penguin-harness-v2", "data");
    this.projectId = "ppagent_harness_v2";
    this.parentAgentId = "ppagent_orchestrator_v2";
    this.childAgentIds = { content: "ppagent_content_v2", visual: "ppagent_visual_v2" };
    this.parentSession = null;
    this.phaseCount = { content: 0, visual: 0 };
  }

  childContext(mode) {
    const dir = path.join(this.runDir, "penguin-harness-v2", mode);
    return {
      dir,
      context: path.join(dir, "context.json"),
      final: path.join(dir, "final.json"),
      draft: path.join(dir, "draft.json"),
      events: path.join(dir, "events.ndjson"),
    };
  }

  async configureAgent({ agentId, mode, prompt, context }) {
    const state = await loadOrInitAgentState({ root: this.dataRoot, projectId: this.projectId, agentId });
    const base = defaultSystemConfig();
    const config = {
      ...base,
      name: mode === "orchestrator" ? "PPagenT 总 Agent v2" : `PPagenT ${mode === "content" ? "内容导演" : "视觉导演"} v2`,
      description: "PPagenT PenguinHarness v2 旁路实验 Agent",
      version: 2,
      system_prompt: `${prompt}\n\n{{AGENTS_MD}}\n{{SKILLS}}`,
      // Keep the experiment bounded: one planning pass plus at most one repair
      // is enough to validate the delegation path. A runaway child would hide
      // whether the architecture improves the actual deck.
      max_turns: mode === "orchestrator" ? 10 : mode === "content" ? 8 : 14,
      model: { ...base.model, max_tokens: mode === "content" ? 16384 : 12000, thinking_level: "low", timeoutMs: 180000 },
      memory: { ...base.memory, enabled: false },
      vault: { ...base.vault, enabled: false },
      schedules: { ...base.schedules, enabled: false },
      ...(mode === "orchestrator" ? {} : {
        tools: {
          builtin: [],
          mcpServers: [{
            name: `ppagent_harness_v2_${mode}`,
            config: {
              transport: "stdio",
              command: process.execPath,
              args: [path.join(this.experimentDir, "mcp-server.mjs"), "--mode", mode],
              cwd: this.experimentDir,
              env: {
                PPAGENT_ROOT: this.root,
                PPAGENT_HARNESS_CONTEXT: context.context,
                PPAGENT_HARNESS_FINAL: context.final,
                PPAGENT_HARNESS_DRAFT: context.draft,
              },
              permission: "rw",
              connectTimeoutMs: 30000,
              timeoutMs: 180000,
              maxOutputLength: 60000,
            },
          }],
        },
      }),
    };
    await fs.writeFile(systemConfigPath(this.dataRoot, this.projectId, agentId), YAML.stringify(config), "utf8");
    if (mode !== "orchestrator") {
      const skillsDir = path.join(state.stateDir, "skills");
      const sourceDir = path.join(this.experimentDir, "skills");
      await fs.mkdir(skillsDir, { recursive: true });
      for (const entry of await fs.readdir(sourceDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        await fs.cp(path.join(sourceDir, entry.name), path.join(skillsDir, entry.name), { recursive: true, force: true });
      }
    }
  }

  async ensureParent() {
    await this.configureProjectModel();
    const parentPrompt = await fs.readFile(path.join(this.experimentDir, "prompts", "orchestrator.md"), "utf8");
    await this.configureAgent({ agentId: this.parentAgentId, mode: "orchestrator", prompt: parentPrompt, context: this.childContext("content") });
    const agent = await createAgent({ root: this.dataRoot, projectId: this.projectId, agentId: this.parentAgentId });
    this.parentSession = await agent.createSession({
      workspaceDir: this.root,
      provider: "deepseek",
      modelId: this.config.model ?? "deepseek-v4-flash",
      apiKey: this.config.apiKey,
      baseUrl: (this.config.baseUrl ?? "https://api.deepseek.com").replace(/\/chat\/completions\/?$/, ""),
      thinkingLevel: "low",
    });
  }

  async configureProjectModel() {
    // run_subagent creates a child Session from the Project model reference. The
    // parent Session's explicit apiKey is intentionally session-scoped, so the
    // child needs the same model entry in Penguin's project config. This file is
    // under .tmp/ and never enters the repository; addModel writes it atomically
    // with restrictive permissions and keeps the credential out of logs.
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
      max_tokens: 16384,
    }, { setDefault: true });
    await setDefaultModel(this.dataRoot, this.projectId, { provider, model_id: modelId });
  }

  async runParent(prompt, mode) {
    const eventFile = path.join(this.runDir, "penguin-harness-v2", `${mode}-orchestrator.ndjson`);
    await fs.mkdir(path.dirname(eventFile), { recursive: true });
    const stats = { requests: 0, toolCalls: 0, finalText: "" };
    for await (const message of this.parentSession.run([userText(prompt)], { approve: async () => "allow" })) {
      const event = eventForLog(message);
      if (!event) continue;
      await fs.appendFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
      if (event.type === "tool_call") stats.toolCalls += 1;
      if (event.type === "token_usage") stats.requests += 1;
      if (event.type === "text") stats.finalText = event.text;
      if (isEventMessage(message) && message.payload?.type === "abort") throw new Error(`Penguin 总 Agent 在 ${mode} 阶段被中止`);
    }
    await writeJson(path.join(this.runDir, "penguin-harness-v2", `${mode}-orchestrator-summary.json`), stats);
  }

  async runPhase(mode, input) {
    if (!this.config?.apiKey) throw new Error("缺少 DeepSeek API Key；请配置 config/deepseek.local.json 或 DEEPSEEK_API_KEY");
    if (!this.parentSession) await this.ensureParent();
    this.phaseCount[mode] += 1;
    const context = this.childContext(mode);
    await fs.mkdir(context.dir, { recursive: true });
    await writeJson(context.context, input);
    await Promise.all([remove(context.final), remove(context.draft), remove(context.events)]);
    const childPrompt = await fs.readFile(path.join(this.experimentDir, "prompts", `${mode}-director.md`), "utf8");
    await this.configureAgent({ agentId: this.childAgentIds[mode], mode, prompt: childPrompt, context });
    const phaseTask = mode === "content"
      ? `进入 content 阶段。请用 run_subagent 调度 agent_id=${this.childAgentIds.content}，让它完成内容导演工作。子 Agent 必须使用 MCP 工具并把结果提交到 ${context.final.replaceAll("\\", "/")}。等待它完成后检查该文件存在和可读，再报告阶段完成。不要自己写内容 JSON。`
      : `进入 visual 阶段。请用 run_subagent 调度 agent_id=${this.childAgentIds.visual}，让它完成视觉导演工作。子 Agent 必须使用 MCP 工具并把结果提交到 ${context.final.replaceAll("\\", "/")}。等待它完成后检查该文件存在和可读，再报告阶段完成。不要自己替代视觉导演选择页面。`;
    await this.runParent(phaseTask, mode);
    try {
      return JSON.parse(await fs.readFile(context.final, "utf8"));
    } catch (error) {
      const missing = new Error(`Penguin ${mode} 子 Agent 未提交可用结果：${error.message}`);
      missing.code = "MODEL_JSON_INVALID";
      throw missing;
    }
  }

  async dispose() {
    this.parentSession?.dispose();
    this.parentSession = null;
  }
}

export function createPenguinHarnessProviderV2({ root, runDir, config }) {
  const harness = new PenguinPptHarness({ root, runDir, config });
  return {
    metadata: {
      providerKind: "penguin-harness-v2",
      harness: "@prismshadow/penguin-core@0.2.9",
      model: config.model ?? "deepseek-v4-flash",
      architecture: "orchestrator-content-visual-skills-native",
      formalWorkflowChanged: false,
    },
    contentDirector(input) { return harness.runPhase("content", input); },
    visualDirector(input) { return harness.runPhase("visual", input); },
    dispose() { return harness.dispose(); },
  };
}
