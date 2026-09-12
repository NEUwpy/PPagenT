// 薄运行器 CLI。运行器**只**拥有四件事：循环、状态落盘、工具派发、恢复。
// 构建、审计、规则加载、结构调用一律调既有模块；这里不实现其中任何一件。
//
// 用法：
//   node src/runner/run.mjs --input <原稿.md> --run-dir <运行目录>
//   node src/runner/run.mjs --run-dir <运行目录> --resume
//   node src/runner/run.mjs --run-dir <运行目录> --replay
//
// --resume：从 state.json 续跑，不重做已冻结的页面。
// --replay：零模型调用，按 state.json 重新编译交付物（用于验证确定性）。
//
// 另一个入口是 `main(argv, { observer })`。observer 是**只读观察口**：阶段边界、工具调用回执与
// 模型 API 事件会照原样转发给它（工作台的实时进度就是这么来的），它不能改变状态、不能决定停止。
// 不传 observer 时行为与从前完全一致。

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newRunState, readState, writeState, writeText, renderStateMarkdown, renderContentMarkdown } from "./state.mjs";
import { createToolRegistry } from "./tools/index.mjs";
import { runToolLoop, transcriptSummary } from "./loop.mjs";
import { buildChatProviderFromEnv } from "./chat-provider.mjs";
import { createCommitter, contentTools } from "./tools/generation.mjs";
import { buildTools, compileDeck } from "./tools/build-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else { args[key] = next; index += 1; }
  }
  return args;
}

/** 阶段提示词。只描述当前阶段与停止条件，不写任何页级答案——那属于任务目录，不属于通用规则。 */
const BASE_PROMPT = [
  "你是 PPagenT 生成线的一个编排 Agent。所有持久状态由工具保存，你只通过调用工具改变状态。",
  "只做当前阶段：当前阶段的完成工具一旦成功返回，立即停止，不要再调用任何工具。",
  "只回复文字不改变任何状态；不调用工具等于什么都没做。",
  "不要输出图片，不要读取仓库文件，不要写代码。",
  "不要编造事实。原稿里没有的成效、数字、承诺一律不得出现。",
].join("\n");

const PHASE_PROMPT = {
  content: [
    "内容阶段：先 read_manuscript 读取来源，再 set_deck_brief 定义受众与沟通目标，然后用 upsert_page_briefs 分批写页面。",
    "页数按信息职责自行判断：既不要一段一页，也不要整稿一页。",
    "每个内容项用 sourceIds 引用来源；全部来源都必须被引用到，否则 finish_content 会被拒绝。",
    "关系只有内容确实存在先后步骤时才用 sequence；比较不等于流程。",
    "本阶段不选择版式、不调用结构能力，那是下一阶段的事。",
    "写完后调用 finish_content。",
  ].join("\n"),
  "content-revision": [
    "内容修订阶段：先 read_manuscript 看当前页面，判断请求修订的页面确实无法承载其内容。",
    "只通过 replace_page_briefs 重组请求中的页面：可以合页或拆页，但必须完整保留这些页的全部来源，不得引入其他页的来源。",
    "修改完成后调用 finish_content。",
  ].join("\n"),
  visual: [
    "视觉阶段：先 read_catalog 读取可用版式与能力，再逐页决定区域与上屏表达。",
    "check_pages 会真的构建 PPT 并回报真实几何与字号问题；只对改过的页重复检查。",
    "全部页面当前版本通过后调用 finish_visual；存在经验提示时必须逐页给出理由。",
  ].join("\n"),
};

async function loadOrInitState({ statePath, inputPath, resume }) {
  // resume 与 replay 都是"从既有 state.json 出发"；只有首次运行才读原稿建 state。
  // （曾经 replay 走错到这一支，inputPath 是 null，直接 TypeError。）
  if (resume) {
    const state = await readState(statePath);
    // 续跑时清掉上次的宿主失败标记——环境修好了就该继续，不该被旧标记卡住。
    const cleared = { ...state, runtimeFailure: null, lastStop: null };
    await writeState(statePath, cleared);
    return cleared;
  }
  const raw = await fs.readFile(inputPath, "utf8");
  const state = newRunState(raw, path.relative(root, inputPath).replaceAll("\\", "/"));
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await writeState(statePath, state);
  await writeText(path.join(path.dirname(statePath), "state.md"), renderStateMarkdown(state));
  await writeText(path.join(path.dirname(statePath), "content.md"), renderContentMarkdown(state));
  return state;
}

async function runPhase({ phase, statePath, runDir, provider, maxTurns, tools, observer }) {
  const registry = createToolRegistry({ tools, runDir });
  // 观察口：只把循环**已经发生的**工具调用照原样转发出去，不改变任何状态、不参与判定。
  // 工作台靠它显示实时进度；没有观察者时这一支完全不生效，运行器不因它多出能力。
  const observed = observer
    ? {
      ...registry,
      dispatch: async (name, args) => {
        const outcome = await registry.dispatch(name, args);
        await observer({
          type: "tool-call",
          status: outcome.result?.accepted === false ? "failed" : "succeeded",
          stage: phase,
          output: { tool: name, args, result: outcome.result },
        });
        return outcome;
      },
    }
    : registry;
  const startedAt = new Date().toISOString();
  const result = await runToolLoop({
    provider,
    systemPrompt: `${BASE_PROMPT}\n${PHASE_PROMPT[phase]}`,
    userMessage: `开始 ${phase} 阶段。第一步调用工具读取当前状态，不要凭猜测动手。`,
    registry: observed,
    maxTurns,
    shouldStop: async () => {
      const state = await readState(statePath);
      if (state.runtimeFailure) return { reason: "runtime-failure", detail: state.runtimeFailure };
      if (state.phase !== phase) return { reason: `phase-${state.phase}`, detail: { from: phase } };
      return null;
    },
  });
  const summary = { phase, startedAt, ...transcriptSummary(result) };
  await fs.writeFile(path.join(runDir, `${phase}-transcript.json`), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

export async function main(argv = process.argv.slice(2), { observer = null } = {}) {
  const args = parseArgs(argv);
  const runDir = path.resolve(root, args["run-dir"] ?? "");
  if (!args["run-dir"]) throw new Error("必须指定 --run-dir");
  const statePath = path.join(runDir, "state.json");
  const resume = args.resume === true || args.resume === "true";
  const replay = args.replay === true || args.replay === "true";
  const maxTurns = Number.parseInt(args["max-turns"] ?? "12", 10);

  if (!resume && !replay) {
    if (!args.input) throw new Error("必须指定 --input（或使用 --resume / --replay）");
    try {
      await fs.access(statePath);
      throw new Error(`运行目录已有 state.json：${runDir}。请换新目录，或用 --resume 续跑。`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await fs.mkdir(runDir, { recursive: true });
  // replay 直接读，不走 loadOrInitState：那条路会清掉 runtimeFailure / lastStop，
  // 而重编译只该重编译，不该改写运行记录。
  let state = replay
    ? await readState(statePath)
    : await loadOrInitState({
      statePath,
      inputPath: args.input ? path.resolve(root, args.input) : null,
      resume,
    });

  const committer = createCommitter({ statePath });
  // 每次启动都从 state.json 重渲染 state.md / content.md：它们是派生产物，可能与 state.json 漂移
  // （换过渲染逻辑、手工改过、或上次崩在两次写之间）。唯一真源是 state.json，这里把它重新对齐。
  await committer.render(state);
  const phases = [];

  // --replay：零模型调用，按 state.json 重新编译交付物。与 check_pages 共用 compileDeck，
  // 否则"重编译出的就是交付物"这句话会因为两条路径漂移而失效。
  if (replay) {
    const missing = state.pages.filter((page) => !page.composition).map((page) => page.pageId);
    if (missing.length) {
      return {
        status: "stopped", phase: state.phase, replay: { accepted: false, missingComposition: missing },
        note: "这些页面还没有视觉方案，无法重编译。先用运行器跑完视觉阶段，或使用 --resume 续跑。",
      };
    }
    const compiled = await compileDeck({ root, runDir, state });
    return {
      status: "delivered", phase: state.phase, replay: true,
      // 牌组 = 1 张封面 + 全部正文页，所以页数有两个数：写稿的页数不等于幻灯片张数。
      bodyPageCount: state.pages.length,
      deckSlideCount: compiled.pages.length,
      pptx: path.relative(root, compiled.outputPptx).replaceAll("\\", "/"),
      qaDir: path.relative(root, compiled.qaDir).replaceAll("\\", "/"),
      qualityAuditStatus: compiled.qualityAudit.status,
    };
  }

  // 当前阶段，供模型 API 事件标注归属；观察口的阶段名就是运行器自己的 phase 名，
  // 不改写成工作台的阶段 id——那是工作台那边负责翻译的事（src/workbench/runner-run-adapter.mjs）。
  let currentStage = null;
  const provider = await buildChatProviderFromEnv({
    root,
    observer: observer ? (event) => observer({ stage: currentStage, ...event }) : undefined,
  });
  // 工具按阶段给：内容阶段只有内容工具，视觉阶段只有构建工具，避免模型在错误的阶段拿到不该用的入口。
  const toolsFor = (phase) => (phase === "visual"
    ? buildTools({ root, runDir, committer, statePath })
    : contentTools({ committer }));

  const runStartedAt = Date.now();
  while (state.phase !== "ready") {
    const phase = state.phase;
    currentStage = phase;
    if (observer) {
      await observer({
        type: "stage-call", status: "running", stage: phase,
        input: { phase, sourcePath: state.sourcePath, sourceCount: state.sources.length, pageCount: state.pages.length },
      });
    }
    const phaseStartedAt = Date.now();
    const summary = await runPhase({ phase, statePath, runDir, provider, maxTurns, tools: toolsFor(phase), observer });
    phases.push(summary);
    state = await readState(statePath);
    const advanced = state.phase !== summary.phase;
    if (observer) {
      await observer({
        type: "stage-call", status: advanced ? "succeeded" : "failed", stage: summary.phase,
        durationMs: Date.now() - phaseStartedAt, output: summary,
      });
    }
    // 停在原地说明这一阶段没提交：如实停止，不自动重试，也不假装完成。
    if (!advanced) {
      if (!state.runtimeFailure) state = await committer.commit((current) => ({ ...current, lastStop: { reason: summary.stopReason, at: new Date().toISOString() } }));
      if (observer) {
        await observer({
          type: "delivery", status: "failed", stage: "ready", durationMs: Date.now() - runStartedAt,
          error: { code: "RUNNER_PHASE_NOT_COMMITTED", stage: summary.phase, message: `阶段 ${summary.phase} 未提交（${summary.stopReason}），运行器已停止，未产出交付物。` },
        });
      }
      return { status: "stopped", phase: state.phase, stopReason: summary.stopReason, phases, note: "阶段未提交，已停止。修复原因后用 --resume 续跑。" };
    }
  }

  const pptx = path.join(runDir, "deck.pptx");
  let delivered = null;
  try {
    await fs.access(pptx);
    delivered = { pptx: path.relative(root, pptx).replaceAll("\\", "/"), qaDir: path.relative(root, path.join(runDir, "qa")).replaceAll("\\", "/") };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  currentStage = "ready";
  if (observer) {
    await observer({
      type: "delivery", status: delivered ? "succeeded" : "failed", stage: "ready", durationMs: Date.now() - runStartedAt,
      output: delivered
        ? { bodyPageCount: state.pages.length, pptx: delivered.pptx, qaDir: delivered.qaDir, phases: phases.map((item) => item.phase) }
        : { bodyPageCount: state.pages.length, note: "阶段已到 ready，但运行目录里没有 deck.pptx；不能声称已交付。" },
      ...(delivered ? {} : { error: { code: "RUNNER_DECK_MISSING", message: "状态已 ready 但 deck.pptx 不存在" } }),
    });
  }
  return { status: "delivered", phase: state.phase, bodyPageCount: state.pages.length, delivered, phases };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === "stopped") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}
