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
  ["content-director", "分页内容与来源绑定", "薄运行器：模型只引用来源 ID，正文由程序回填"],
  ["visual-director", "页面方案与真实构建", "薄运行器：分配版式、真实渲染、审计回执"],
  ["delivery", "交付与审计", "deck.pptx、逐页预览与门禁结果"],
]);

export const RUNNER_HANDOFFS = Object.freeze({
  "manuscript-normalization": "程序读取上传文件并统一转为 Markdown。这里不调用模型；输出全文原样交给薄运行器的内容阶段。",
  "content-director": "运行器把原稿切分成来源项，模型只能引用来源 ID；页面正文由程序从原稿逐字回填，模型不撰写正文。全部来源被引用后才允许冻结内容。",
  "visual-director": "每一步都调用既有渲染器真实构建整副牌组，再用 auditRenderedDeck 审计实际几何、字号与断行；回执按页记账，只有当前版本通过的页可复用。",
  delivery: "阶段到达 ready 后交付运行器构建出的 deck.pptx 与逐页预览。交付物就是审计过的那一份，不重新排版。",
});

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
    pageCount: state.pages?.length ?? 0,
    sourceCount: state.sources?.length ?? 0,
    model: null,
    provider: null,
    artifacts: await runnerArtifacts(runDir),
    stages: RUNNER_STAGES,
    handoffs: RUNNER_HANDOFFS,
    pipelineNote: RUNNER_PIPELINE_NOTE,
  };
}

export { exists };
