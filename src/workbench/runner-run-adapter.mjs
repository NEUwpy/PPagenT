// 工作台 ↔ 薄运行器 的适配层。**只做映射**，不做运行：
//   ① 把运行器的磁盘产物翻译成工作台既有的 artifacts 约定；
//   ② 把运行器的阶段名翻译成工作台流水线里的阶段 id；
//   ③ 把仓库内 harness/runs 的历史运行翻译成**只读**的运行记录。
// 它不启动运行器（那是 serve-production-workbench.mjs 的事）、不构建 PPT、不写运行器状态。
//
// 为什么要单独一层：serve-production-workbench.mjs 在 import 时就会监听端口，
// 因此它的内部函数无法被测试直接调用。把可判定的映射放在这里，映射逻辑就有真测试。

import fs from "node:fs/promises";
import path from "node:path";

/**
 * 薄运行器的真实阶段。**照实列**，不借用旧生产线的八段：
 * 旧线的 shell-scaffold / visual-candidates / visual-resolution / native-preview
 * 在运行器里不存在，列出来会让看板显示没发生过的阶段。
 */
export const RUNNER_STAGES = Object.freeze([
  ["manuscript-normalization", "稿件进入", "原文件 → 规范化 Markdown"],
  ["content-director", "分页内容与来源绑定", "薄运行器：模型引用来源 ID 并提炼条目正文，逐字来源作为保真比对证据"],
  ["visual-director", "页面方案与真实构建", "薄运行器：分配版式、真实渲染、审计回执"],
  ["delivery", "交付与审计", "deck.pptx、逐页预览与门禁结果"],
]);

export const RUNNER_HANDOFFS = Object.freeze({
  "manuscript-normalization": "程序读取上传文件并统一转为 Markdown。这里不调用模型；输出全文原样交给薄运行器的内容阶段。",
  "content-director": "运行器把原稿切分成来源项，模型只能引用来源 ID；它可以在来源基础上提炼撰写上屏正文，同时如实标注每项在原稿里的层级角色（准则是准则、全程规则不是某一步）。每条正文都要过保真检查：编造的数字与引号内容会被拒，但加限定条件、弱化语气、换同义词、中文数词编造查不出来。全部来源被引用后才允许冻结内容。",
  "visual-director": "每一步都调用既有渲染器真实构建整副牌组，再用 auditRenderedDeck 审计实际几何、字号与断行；回执按页记账，只有当前版本通过的页可复用。",
  delivery: "阶段到达 ready 后交付运行器构建出的 deck.pptx 与逐页预览。交付物就是审计过的那一份，不重新排版。",
});

/** 阶段 id 的顺序表。stageProvenance 靠它判断"哪些阶段排在续跑起点之前"。 */
const RUNNER_STAGE_IDS = RUNNER_STAGES.map(([id]) => id);

/** 阶段的中文名，给"从「X」阶段接着跑"这类提示用；认不出就退回 id，不编名字。 */
function stageName(stageId) {
  return RUNNER_STAGES.find(([id]) => id === stageId)?.[1] ?? stageId;
}

/** 运行器的 phase → 工作台流水线的 stage id。content-revision 不是独立阶段，仍归内容。 */
export const STAGE_OF_PHASE = Object.freeze({
  content: "content-director",
  "content-revision": "content-director",
  visual: "visual-director",
  ready: "delivery",
});

/**
 * 运行器当前的能力边界。**必须显示给用户**，否则"改用新运行器"看起来像一次无代价升级，
 * 而实际是：版式只覆盖纯文本 editorial-* 系列，结构组件与图片页还没接进来。
 */
export const RUNNER_PIPELINE_NOTE = "薄运行器当前只构建纯文本版式（editorial-* 系列）：封面 + 正文页。"
  + "结构组件页、图片页、议程页与尾页尚未接入，需要它们的稿件请改用旧 API 生产线。";

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

/**
 * 逐页预览的页码：按文件名里的页码自然排序，不按字典序（否则 slide-10 会排到 slide-2 前面）。
 * 只认图片扩展名——`slide-03.layout.json` 是布局证据，不是第 3 页的预览图。
 */
function slideNumber(filename) {
  return Number.parseInt(/^slide-(\d+)\.(png|jpe?g|webp)$/i.exec(filename)?.[1] ?? "", 10);
}

/**
 * 运行器产物 → 工作台 artifacts。**只列真实存在的文件**：
 * 列一个不存在的产物，就是让"文件存在"去冒充"内容正确"。
 */
export async function runnerArtifacts(runDir) {
  const items = [];
  const push = (label, kind, relativePath) => items.push({ label, kind, path: relativePath });

  if (await exists(path.join(runDir, "deck.pptx"))) push("可编辑 PPTX", "pptx", "deck.pptx");

  const qaDir = path.join(runDir, "qa");
  for (const candidate of ["montage.webp", "montage.png", "montage.jpg"]) {
    if (await exists(path.join(qaDir, candidate))) { push("整套预览", "image", `qa/${candidate}`); break; }
  }

  let pageFiles = [];
  try {
    pageFiles = (await fs.readdir(qaDir))
      .filter((name) => slideNumber(name) > 0)
      .sort((left, right) => slideNumber(left) - slideNumber(right));
  } catch { pageFiles = []; }
  for (const name of pageFiles) push(`第 ${slideNumber(name)} 页`, "image", `qa/${name}`);

  const textFiles = [
    ["运行状态", "state.md", "markdown"],
    ["分页内容", "content.md", "markdown"],
    ["实际被构建的蓝图", "blueprint.json", "json"],
    ["工具调用记录", "tool-events.ndjson", "ndjson"],
    ["逐页审查记录", "审查记录.md", "markdown"],
  ];
  for (const [label, name, kind] of textFiles) {
    if (await exists(path.join(runDir, name))) push(label, kind, name);
  }
  return items;
}

/** 运行器的整稿标题。列表里"原稿.md"认不出是哪一稿，标题才认得出来；读不到就返回 null，不编造。 */
export async function readRunnerDeckTitle(runDir) {
  try {
    const state = JSON.parse(await fs.readFile(path.join(runDir, "state.json"), "utf8"));
    return state.deckBrief?.title ?? null;
  } catch { return null; }
}

/** 交付是否成立只看运行器写下的状态字段，不猜。 */
function runnerStatus(state) {
  if (state.runtimeFailure) return "failed";
  if (state.phase === "ready") return "succeeded";
  return "stopped";
}

/**
 * 仓库内 harness/runs 的历史运行 → 只读运行记录。
 * 这类目录由运行器（或人）维护，没有工作台的 summary.json / events.jsonl，
 * 因此这里**临时合成**一份记录供列表与详情读取，不落盘、不写回运行目录。
 */
export async function archiveRunSummary({ runId, runDir }) {
  const statePath = path.join(runDir, "state.json");
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  const stat = await fs.stat(statePath);
  const timestamp = stat.mtime.toISOString();
  const sourceName = state.sourcePath ? path.basename(state.sourcePath) : "";
  const artifacts = await runnerArtifacts(runDir);
  // 页数按**实际存在**的逐页预览数，不按 state.pages.length 猜：牌组是 1 张封面 + 全部正文页，
  // 少算封面会让同一次运行在工作台入口显示 5 页、在历史入口显示 4 页。
  const slideCount = artifacts.filter((item) => item.label.startsWith("第 ")).length;
  return {
    schemaVersion: "1.0",
    runId,
    originalName: sourceName || `${runId}.md`,
    deckTitle: await readRunnerDeckTitle(runDir),
    // 运行目录里没有创建时间，用唯一真源 state.json 的最后写入时间；不编造一个"开始时间"。
    createdAt: timestamp,
    finishedAt: timestamp,
    status: runnerStatus(state),
    pipeline: "runner",
    archive: { root: "harness/runs", readOnly: true },
    skin: { id: "northeastern-university-001", name: "东北大学" },
    // 既不是 manual 也不是 auto：模板据此显示"历史运行"，不伪称当时有检查点。
    visualCheckpointMode: null,
    nativePreviewCheckpointMode: null,
    pageCount: slideCount || (state.pages?.length ?? 0),
    bodyPageCount: state.pages?.length ?? 0,
    sourceCount: state.sources?.length ?? 0,
    model: null,
    provider: null,
    artifacts,
    stages: RUNNER_STAGES,
    handoffs: RUNNER_HANDOFFS,
    pipelineNote: RUNNER_PIPELINE_NOTE,
  };
}

/**
 * 这条运行还能不能接着跑。**只判定，不跑**——真正调用运行器的是 serve-production-workbench.mjs。
 *
 * 为什么要有它：运行器支持 `--resume`（从 state.json 的阶段接着跑）与 `--replay`（零模型重编译），
 * 但这两个开关此前只能从命令行用，看板上只留了一句"去命令行跑"。看板既然要做到"所有跑过的都看得见"，
 * 就必须也能从这里发起；而且发起前要先把不能跑的情形说清楚，不是让用户点了再收一个 500。
 *
 * 起点**只能**是 state.json 里真实的 phase：不提供"人为指定从哪一阶段开始"，
 * 那等于绕开运行器的阶段闸门。
 */
export function continuability({ summary, state, isArchive = false }) {
  const deny = (reason) => ({ allowed: false, mode: null, fromPhase: null, reason });
  if (isArchive) return deny("这是仓库内的历史运行，只读；要接着跑请把它复制到工作台的运行区。");
  if (!summary) return deny("找不到这条运行的记录。");
  if (summary.pipeline !== "runner") return deny("这条运行走的是旧 API 生产线，没有运行器的阶段状态，无法从中断处续跑。");
  if (!state) return deny("运行目录里没有 state.json，取不到阶段与页面状态。");
  if (["normalizing", "running"].includes(summary.status)) return deny("这条运行正在进行中，等它结束或中断后再继续。");

  // 上次停在宿主依赖失败时，续跑会清掉该标记（run.mjs 的 loadOrInitState 里做了），
  // 这一点要说明白，否则用户会以为带着失败标记续跑还会立刻停在同一处。
  const clearedNote = state.runtimeFailure
    ? "；上次停在宿主依赖失败上，续跑会清掉该标记，环境修好就能继续"
    : "";

  if (state.phase === "ready") {
    return {
      allowed: true,
      mode: "recompile",
      fromPhase: "ready",
      reason: `内容与页面方案都已冻结，可以做一次零模型重编译：不调用模型，用同一份 state.json 重新构建交付物，用来核对它能否被复现${clearedNote}。`,
    };
  }
  return {
    allowed: true,
    mode: "resume",
    fromPhase: state.phase,
    reason: `从「${stageName(STAGE_OF_PHASE[state.phase] ?? state.phase)}」阶段接着跑；排在它之前的阶段沿用上次产物，不重新调用模型${clearedNote}。`,
  };
}

/**
 * 尝试记录。只认形状自证的条目：缺 attempt / mode 的一律不认，也不替它补字段。
 * 续跑采用"同一条运行记录 + 尝试快照"，所以 summary.attempts 是这条运行唯一的历史线索——
 * 上一次停在哪个阶段、为什么停，靠它留住，不被新一次尝试的终态抹掉。
 */
export function readAttempts(summary) {
  const raw = Array.isArray(summary?.attempts) ? summary.attempts : [];
  return raw.filter((item) => item && typeof item === "object"
    && Number.isInteger(item.attempt) && typeof item.mode === "string");
}

/**
 * 哪些阶段的**最近一次**调用没有收到终态（进程被杀）。返回阶段 id，按事件出现顺序。
 *
 * 判据只能是「该阶段最近一次 stage-call」。曾经用「历史 running 集合 − 历史 terminal 集合」：
 * 一条运行记录里会有多次尝试，第一次被杀的 running 会在历史里留下痕迹，
 * 于是第二次尝试再被杀时这个差集是空的，补记就被跳过了；反过来，
 * 只看"有没有过 running"又会给已经跑完的阶段硬加一条失败。两个方向都错，所以按"最近一次"。
 *
 * 放在这里而不是 serve-production-workbench.mjs：那个文件 import 时就会监听端口，
 * 内部函数无法被测试直接调用（见本文件头注释）。
 */
export function interruptedStageCalls(events) {
  const lastCallOf = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== "stage-call" || typeof event.stage !== "string") continue;
    lastCallOf.set(event.stage, event.status);
  }
  return [...lastCallOf].filter(([, status]) => status === "running").map(([stage]) => stage);
}

/**
 * 把这次尝试的结果并进最近一条尝试记录。没有尝试记录时原样返回——
 * 不为了"看起来完整"现造一条，那会凭空多出一次没发生过的尝试。
 */
export function mergeAttemptOutcome(summary, patch) {
  const attempts = readAttempts(summary);
  if (!attempts.length) return summary;
  attempts[attempts.length - 1] = { ...attempts[attempts.length - 1], ...patch };
  return { ...summary, attempts };
}

/**
 * 最近一次尝试里，每个阶段是"本次重跑"还是"沿用上次产物"。
 *
 * 依据是这次尝试的起点 fromPhase：排在它之前的阶段，本次**一条事件都不会有**——
 * 它们的结果来自冻结的 state.json，不是重跑出来的。看板必须把它们标出来，
 * 否则一次续跑在界面上看起来和从头跑一遍没有区别，等于把"沿用了旧产物"显示成"重新做过了"。
 */
export function stageProvenance(summary) {
  const provenance = Object.fromEntries(RUNNER_STAGE_IDS.map((id) => [id, "rerun"]));
  const latest = readAttempts(summary).at(-1);
  if (!latest?.fromPhase) return provenance;
  const startIndex = RUNNER_STAGE_IDS.indexOf(STAGE_OF_PHASE[latest.fromPhase] ?? latest.fromPhase);
  if (startIndex <= 0) return provenance;
  for (let index = 0; index < startIndex; index += 1) provenance[RUNNER_STAGE_IDS[index]] = "reused";
  return provenance;
}

export { exists };
