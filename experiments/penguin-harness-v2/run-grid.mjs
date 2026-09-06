import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { createAgent, defaultSystemConfig, addModel, loadOrInitAgentState, systemConfigPath, userText } from "@prismshadow/penguin-core";
import { loadDeepSeekLocalConfig } from "../../src/agent/deepseek-provider-from-env.mjs";
import { newProject, validateContent, validateComposition, skillCatalog } from "./grid-project.mjs";
import { buildGridDeck } from "./grid-native.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const args = Object.fromEntries(process.argv.slice(2).reduce((out, token, index, all) => index % 2 ? out : [...out, [token.replace(/^--/, ""), all[index + 1]]], []));
const runDir = path.resolve(root, args["run-dir"] ?? ".tmp/penguin-harness-v2/grid-loop-1");
const input = path.resolve(root, args.input ?? "experiments/penguin-harness-v2/fixtures/grid-manuscript.md");
const projectFile = path.join(runDir, "deck-project.json");
await fs.mkdir(runDir, { recursive: true });
const read = async () => JSON.parse(await fs.readFile(projectFile, "utf8"));
if (args.resume !== "true" && args.replay !== "true") {
  try { await fs.access(projectFile); throw new Error("运行目录已有项目，请使用新目录或 --resume true"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  let initial = newProject(await fs.readFile(input, "utf8"), path.relative(root, input).replaceAll("\\", "/"));
  if (args["seed-project"]) { initial = JSON.parse(await fs.readFile(path.resolve(root, args["seed-project"]), "utf8")); initial.phase = "visual"; initial.artifactState = {}; delete initial.contentRevision; delete initial.runtimeFailure; initial.seedProject = args["seed-project"]; }
  await fs.writeFile(projectFile, JSON.stringify(initial, null, 2));
}
const started = Date.now();
if (args.resume === "true") {
  const p = await read(); delete p.runtimeFailure;
  await fs.writeFile(projectFile, JSON.stringify(p, null, 2));
}
const commonPrompt = "你是 PPagenT 的一个逻辑 PPT Agent。当前只有一个阶段和相应工具，所有持久状态由工具保存。只做当前阶段；提交成功立即停止。禁止输出图片消息、读取仓库或写代码。正式库由另一条开发线建设，这里验证有限能力下的稿件驱动编排。";
const prompts = {
  content: `${commonPrompt}\n内容阶段：read_manuscript 获取来源，set_deck_brief 定义沟通目标，upsert_page_briefs 分批写页面。页数自行按信息职责判断，既不要一段一页，也不要整稿一页。每项通过 sourceIds 引用完整内容，所有来源必须覆盖。关系只有有先后步骤才是 sequence，比较不等于流程。finish_content 校验并冻结。不要指定版式，不做封面目录尾页；本次是正文编排验证。`,
  visual: `${commonPrompt}\n视觉阶段：read_project 读取页面和能力。先判断每页职责，再用 24×12 网格编排区域并调用有限能力。Text 正常表达，Structure 仅用于真实顺序；不能为页型数量硬套。上屏标题和正文通过 sourceItemId 绑定，必须各自逐字取自 sourceText 中连续片段；完整内容保留在备注。可以提取更短标签，但不能发明或改写事实。所有来源项须有可见表达。每页正文统一采用 left 或 center 一种对齐；结构固定居中时同页文字也居中，保留区域间距；尽量使用内容区，避免过密和无目的大片空白。upsert_page_compositions 可批量提交。错误明确指出 page/region，只修受影响页。check_pages 会真的生成 PPT 并返回 Native 文字行、占用热图、空区和几何检查；只对修改页重查。经验提示需要判断是否应该修，不能把大框当内容。最多四个方案版本/页；无法解决就如实停止。全部当前版本检查通过后 finish_visual；存在经验提示须给具体原因。`,
};
async function phase(mode) {
  const local = await loadDeepSeekLocalConfig(root);
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.PPAGENT_DEEPSEEK_API_KEY || local.apiKey;
  if (!apiKey) throw new Error("缺少模型密钥");
  const provider = "deepseek", modelId = process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash";
  const baseUrl = (process.env.PPAGENT_DEEPSEEK_BASE_URL || local.baseUrl || "https://api.deepseek.com").replace(/\/chat\/completions\/?$/, "");
  const dataRoot = path.join(runDir, "private-agent-data"), projectId = "ppagent_grid", agentId = mode;
  await addModel(dataRoot, projectId, { provider, model_id: modelId, api_key: apiKey, base_url: baseUrl, client_type: "openai-chat", vision: false, max_tokens: 4096 }, { setDefault: true });
  await loadOrInitAgentState({ root: dataRoot, projectId, agentId });
  const base = defaultSystemConfig();
  const runtimeEnv = Object.fromEntries(["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA", "SystemRoot", "WINDIR", "TEMP", "TMP", "BROWSER_EXECUTABLE_PATH", "RUNTIME_NODE", "RUNTIME_NODE_MODULES", "RUNTIME_BIN_DIR"].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  const stageRule = mode === "content" ? "若当前项目处于内容修订：先 read_revision，只通过 replace_page_briefs 重组目标页，再 finish_content；不要改其他页、重设整稿或重新全稿分页。" : "content-underfilled 是用户留白要求下的未通过，不能豁免；可 request_content_revision 提出相关页重组。发出请求后立即停止。";
  const config = { ...base, name: `PPT ${mode}`, version: 3, system_prompt: prompts[mode] + "\n" + stageRule, max_turns: mode === "content" ? 9 : 16, model: { ...base.model, max_tokens: 4096, thinking_level: "low", timeoutMs: 180000 }, memory: { ...base.memory, enabled: false }, vault: { ...base.vault, enabled: false }, schedules: { ...base.schedules, enabled: false }, tools: { builtin: [], mcpServers: [{ name: `grid_${mode}`, config: { transport: "stdio", command: process.execPath, args: [path.join(import.meta.dirname, "grid-mcp.mjs"), mode], cwd: root, env: { ...runtimeEnv, PPAGENT_ROOT: root, PPAGENT_GRID_RUN: runDir }, permission: "rw", timeoutMs: 180000, connectTimeoutMs: 30000, maxOutputLength: 40000 } }] } };
  await fs.writeFile(systemConfigPath(dataRoot, projectId, agentId), YAML.stringify(config));
  const agent = await createAgent({ root: dataRoot, projectId, agentId });
  const session = await agent.createSession({ workspaceDir: root, provider, modelId, apiKey, baseUrl, thinkingLevel: "low" });
  const stats = { phase: mode, requests: 0, toolCalls: 0, usage: [], durationMs: 0 }, phaseStart = Date.now();
  try {
    const currentPhase = (await read()).phase;
    for await (const message of session.run([userText(`开始 ${mode} 阶段；项目状态为 ${currentPhase}。${currentPhase === "content-revision" ? "首先 read_revision，只修订请求中的页面。" : "先读取工具中的项目状态。"}`)], { approve: async () => "allow" })) {
      const payload = message.payload ?? {};
      if (payload.type === "token_usage") { stats.requests++; stats.usage.push(payload.request); }
      if (payload.type === "tool_call") stats.toolCalls++;
      if (payload.type === "tool_call_output") {
        const p = await read();
        if (p.runtimeFailure) break;
        if (mode === "visual" && p.phase === "content-revision") break;
        if ((mode === "content" && p.phase === "visual") || (mode === "visual" && p.phase === "ready")) break;
      }
    }
  } finally {
    session.dispose(); stats.durationMs = Date.now() - phaseStart;
    await fs.writeFile(path.join(runDir, `${mode}-stats-${phaseStart}.json`), JSON.stringify(stats, null, 2));
    await fs.writeFile(path.join(runDir, `${mode}-stats.json`), JSON.stringify(stats, null, 2));
  }
  console.log(JSON.stringify({ mode, requests: stats.requests, toolCalls: stats.toolCalls, seconds: Math.round(stats.durationMs / 1000), state: (await read()).phase }));
}
if (args.replay !== "true") {
  if (["content", "content-revision"].includes((await read()).phase)) await phase("content");
  if ((await read()).phase !== "visual" && (await read()).phase !== "ready") throw new Error("内容未提交，停止");
  if ((await read()).phase === "visual") await phase("visual");
  if ((await read()).phase === "content-revision") { await phase("content"); if ((await read()).phase === "visual") await phase("visual"); }
}
const project = await read();
if (project.phase !== "ready") throw new Error("视觉未完成有效提交，未交付；可查看项目与工具记录");
const catalog = await skillCatalog(root);
if (!validateContent(project).accepted || project.pages.some((page) => !page.composition || !validateComposition(page, page.composition, catalog).accepted)) throw new Error("最终项目的来源或区域契约不合法，未交付");
const artifact = await buildGridDeck(root, project, project.pages.map((p) => p.pageId), path.join(runDir, "final"));
if (artifact.feedback.some((f) => !f.accepted)) throw new Error("最终重新编译检查失败，未交付");
const output = path.resolve(root, args.output ?? "output/penguin-harness-v2/共享仪器-无图片网格闭环.pptx");
await fs.mkdir(path.dirname(output), { recursive: true }); await fs.copyFile(artifact.pptxPath, output);
const summary = { status: "delivered-experiment", vision: false, pageCount: project.pages.length, structurePages: project.pages.filter((p) => p.composition.regions.some((r) => r.skillId === "sequence-flow-001")).length, mixedPages: project.pages.filter((p) => new Set(p.composition.regions.map((r) => r.skillId)).size > 1).length, revisions: Object.fromEntries(project.pages.map((p) => [p.pageId, p.compositionRevision])), output, durationMs: Date.now() - started, feedback: artifact.feedback.map(({ pageId, accepted, issues, warnings, textOccupancyEstimate }) => ({ pageId, accepted, issues, warnings, textOccupancyEstimate })) };
summary.executionMode = args.replay === "true" ? "offline-replay-no-model" : args["seed-project"] ? "seeded-project" : args.resume === "true" ? "resume" : "from-manuscript";
const phaseRecords = await Promise.all((await fs.readdir(runDir)).filter((name) => /^(content|visual)-stats-\d+\.json$/.test(name)).map(async (name) => JSON.parse(await fs.readFile(path.join(runDir, name), "utf8"))));
summary.modelAccounting = { scope: "当前运行目录中已保存的阶段记录；seed 项目来源的历史调用不包含在内；累计上下文 token 不等于新增 token 或实际费用", phaseCount: phaseRecords.length, requests: phaseRecords.reduce((n, p) => n + p.requests, 0), toolCalls: phaseRecords.reduce((n, p) => n + p.toolCalls, 0), tokens: phaseRecords.flatMap((p) => p.usage ?? []).reduce((a, u) => { for (const [k, v] of Object.entries(u ?? {})) if (Number.isFinite(v)) a[k] = (a[k] ?? 0) + v; return a; }, {}) };
summary.modelAccounting.modelPhaseDurationMs = phaseRecords.reduce((n, p) => n + p.durationMs, 0);
await fs.writeFile(path.join(runDir, "result.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, feedback: undefined }, null, 2));
