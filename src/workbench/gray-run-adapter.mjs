// 工作台 ↔ 灰稿运行器（src/runner/gray-draft.mjs）的适配层。**只做映射与读取**，不做运行：
//   ① 把灰稿运行的磁盘产物（revision-N/ 下的提示词、模型响应、检查、计划）翻译成工作台可展示的步骤结构；
//   ② 从 state.json.grayDraft 与文件存在性推导每步状态（未开始/进行中/完成/失败/被跳过）；
//   ③ 判定能否续跑，并整理续跑前遗留的未完成修订轮。
// 灰稿运行器的证据以文件为真源：提示词、响应、检查各自落盘；工作台不把它们复制进事件流，
// 而是按目录读取——看板看到的与命令行实验看到的永远是同一份文件。
//
// 为什么单独一层：serve-production-workbench.mjs 在 import 时就会监听端口，
// 内部函数无法被测试直接调用。把可判定的映射放在这里，映射逻辑就有真测试。

import fs from "node:fs/promises";
import path from "node:path";

/**
 * 灰稿运行器的真实阶段。**照实列**，沿用薄运行器的命名风格：
 * 前两步（进入/规划）在两次运行里各有对应，后四步是灰稿线独有的表达、审稿、求解与渲染。
 */
export const GRAY_STAGES = Object.freeze([
  ["manuscript-normalization", "稿件进入", "原文件 → 规范化 Markdown；冻结本次使用的规则快照"],
  ["semantic-planning", "内容与结构规划", "模型在来源约束下提炼分页、条目与必要关系，不写坐标"],
  ["expression-selection", "表达选择", "逐项选择文字/结构/图表等表达方式，并绑定到条目"],
  ["semantic-review", "语义审稿", "模型对照原稿复核：遗漏、误判、机械重复"],
  ["layout-solving", "布局求解", "基础组合选择 + 按实文测量的几何求解，不改文案"],
  ["gray-rendering", "灰稿渲染", "程序构建原生 PPTX、重导入预览与可编辑性检查"],
]);

export const GRAY_HANDOFFS = Object.freeze({
  "manuscript-normalization": "程序读取上传文件并统一转为 Markdown，同时把本次实际使用的三份共用规则（内容结构/页面组合/排版）写成快照。这里不调用模型。",
  "semantic-planning": "模型拿到版面尺寸、全部来源与全文，产出不含坐标的语义计划：页面目的、每条正文的来源归属、必要关系。程序随后检查来源引用、数字保真与容量。",
  "expression-selection": "模型在已通过程序检查的计划上，为每个条目选择表达方式（文字/结构/图表等）。选择结果由程序绑定回计划，不新增事实。",
  "semantic-review": "模型对照原稿复核一遍完整计划，找遗漏、误判与机械重复；程序只验证响应格式，采纳与否记录在审稿文件里。",
  "layout-solving": "模型只选基础组合与横向比例；程序按实际文字测量容量并解出坐标。几何失败会先修几何，不改已批准的文案；确证无法容纳则返回重规划。",
  "gray-rendering": "程序在原生 PPT 引擎里构建灰稿：灰色实文区、浅蓝制作说明区，重导入导出验证逐字可编辑，并输出逐页 PNG 预览。",
});

export const GRAY_PIPELINE_NOTE = "灰稿线（现行 M1）：从稿件走到可审阅的灰稿就停住——内容规划、表达选择、语义审稿、"
  + "布局求解、原生渲染与可编辑性检查。结构库、图片、图表与美化属于后半场，尚未接入，"
  + "本线不承诺它们的能力。停在灰稿后可在工作台直接续跑一轮修订。";

const REVISION_PATTERN = /^revision-(\d+)$/;
const PREVIEW_PATTERN = /^slide-(\d+)\.png$/i;
const LAYOUT_ARTIFACT_PATTERN = /^layout-(response|resolved|check)-(\d+)\.json$/;

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function readJsonIfExists(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return null; }
}

/** 预览页按文件名里的页码自然排序，不按字典序（否则 slide-10 会排到 slide-2 前面）。 */
function previewPageNumber(filename) {
  return Number.parseInt(PREVIEW_PATTERN.exec(filename)?.[1] ?? "", 10);
}

async function listPreviewPages(previewDir, prefix = "") {
  let names = [];
  try { names = await fs.readdir(previewDir); } catch { return []; }
  return names
    .filter((name) => previewPageNumber(name) > 0)
    .sort((left, right) => previewPageNumber(left) - previewPageNumber(right))
    .map((name) => `${prefix}preview/${name}`);
}

/**
 * 灰稿产物所在目录：首次渲染写运行根目录，续跑后的成功渲染写 revision-N/artifacts/。
 * 两处都存在时按 gray-draft.pptx 的修改时间取最新——不按目录位置猜新旧。
 */
async function findLatestPptx(runDir) {
  const candidates = [];
  const consider = async (dir, prefix) => {
    const pptx = path.join(dir, "gray-draft.pptx");
    if (!(await exists(pptx))) return;
    const stat = await fs.stat(pptx);
    candidates.push({ dir, prefix, mtime: stat.mtimeMs });
  };
  await consider(runDir, "");
  let revisionNumbers = [];
  try {
    revisionNumbers = (await fs.readdir(runDir))
      .map((name) => REVISION_PATTERN.exec(name)?.[1])
      .filter((value) => value !== undefined)
      .map((value) => Number.parseInt(value, 10))
      .sort((left, right) => left - right);
  } catch { revisionNumbers = []; }
  for (const revision of revisionNumbers) {
    await consider(path.join(runDir, `revision-${revision}`, "artifacts"), `revision-${revision}/artifacts/`);
  }
  candidates.sort((left, right) => right.mtime - left.mtime);
  return candidates[0] ?? null;
}

/** 灰稿的逐页预览与 PPTX 位置。找不到就返回空，不编造路径。 */
export async function grayPreview(runDir) {
  const latest = await findLatestPptx(runDir);
  if (latest) {
    return {
      pptxPath: `${latest.prefix}gray-draft.pptx`,
      pages: await listPreviewPages(path.join(latest.dir, "preview"), latest.prefix),
      editableCheckPath: await exists(path.join(latest.dir, "editable-check.json")) ? `${latest.prefix}editable-check.json` : null,
    };
  }
  // 没有 PPTX 也把根目录已有的预览列出来：渲染中途被杀时它们就是已有的证据。
  return { pptxPath: null, pages: await listPreviewPages(path.join(runDir, "preview")), editableCheckPath: null };
}

/**
 * 运行产物 → 工作台 artifacts。**只列真实存在的文件**：
 * 列一个不存在的产物，就是让"文件存在"去冒充"内容正确"。
 */
export async function grayArtifacts(runDir) {
  const items = [];
  const push = (label, kind, relativePath) => items.push({ label, kind, path: relativePath });
  const preview = await grayPreview(runDir);

  if (preview.pptxPath) push("灰稿可编辑 PPTX", "pptx", preview.pptxPath);
  for (const [index, page] of preview.pages.entries()) push(`第 ${index + 1} 页`, "image", page);
  for (const [label, name, kind] of [
    ["最终计划", "plan.json", "json"],
    ["分页实文", "content.md", "markdown"],
    ["运行状态", "state.md", "markdown"],
    ["规则快照", "rules-snapshot.md", "markdown"],
  ]) {
    if (await exists(path.join(runDir, name))) push(label, kind, name);
  }
  if (preview.editableCheckPath) push("可编辑性检查", "json", preview.editableCheckPath);
  if (await exists(path.join(runDir, "agent", "transcript.json"))) push("Agent 轨迹", "json", "agent/transcript.json");
  return items;
}

/** 计划摘要：列表与详情页用标题认稿子，读不到就不编造。含逐页结构供来源追溯面板使用。 */
async function planSummary(runDir) {
  const plan = await readJsonIfExists(path.join(runDir, "plan.json"));
  if (!plan) return null;
  return {
    title: plan.deckBrief?.title ?? null,
    pageCount: Array.isArray(plan.pages) ? plan.pages.length : null,
    planningNotes: plan.planningNotes ?? null,
    pages: (plan.pages ?? []).map((page) => ({
      pageId: page.pageId,
      title: page.title ?? null,
      claim: page.claim ?? null,
      purpose: page.pagePurpose ?? page.semantics?.pagePurpose ?? null,
      narrative: page.narrative ?? page.semantics?.narrative ?? null,
      itemCount: Array.isArray(page.items) ? page.items.length : null,
      items: (page.items ?? []).map((item) => ({
        heading: item.heading ?? null,
        kind: item.kind ?? null,
        importance: item.importance ?? null,
        blocks: (item.blocks ?? []).map((block) => ({
          label: block.label ?? null,
          text: block.text ?? "",
          sourceIds: Array.isArray(block.sourceIds) ? block.sourceIds : [],
        })),
      })),
    })),
  };
}

/**
 * 每步的文件清单（相对运行目录）。前端用 artifact 接口按需读取。
 * activeRevision 为 null（规划一轮都没开完）时只给稿件进入一步。
 * Agent 运行（gray-agent-1）按轮次组织：每一步是 Agent 的一轮对话。
 */
export async function grayStepFiles(runDir, revision) {
  const state = await readJsonIfExists(path.join(runDir, "state.json"));
  if (state?.grayDraft?.version === "gray-agent-1") {
    const files = {
      system: {
        inputs: [],
        prompts: [],
        outputs: [{ label: "Agent 系统提示词与共用规则（每轮随消息发送）", path: "agent-system-prompt.txt" }],
        checks: [],
      },
    };
    for (const turn of Array.isArray(state.grayDraft.turns) ? state.grayDraft.turns : []) {
      files[`turn-${turn.turn}`] = {
        inputs: [],
        prompts: [],
        outputs: [{ label: "模型输出与工具调用（含工具结果）", path: `agent/turn-${turn.turn}/response.json` }],
        checks: [],
      };
    }
    const preview = await grayPreview(runDir);
    files.delivered = {
      inputs: [],
      prompts: [],
      outputs: [
        ...(preview.pptxPath ? [{ label: "灰稿可编辑 PPTX", path: preview.pptxPath }] : []),
        { label: "最终计划（含坐标）", path: "plan.json" },
        { label: "Agent 轨迹摘要（轮数、工具序列、用量）", path: "agent/transcript.json" },
      ],
      checks: preview.editableCheckPath ? [{ label: "可编辑性检查（逐字回读 PPTX）", path: preview.editableCheckPath }] : [],
    };
    return files;
  }
  const prefix = revision === null ? null : `revision-${revision}/`;
  const layoutFiles = { responses: [], resolved: [], checks: [] };
  if (prefix) {
    let names = [];
    try { names = await fs.readdir(path.join(runDir, `revision-${revision}`)); } catch { names = []; }
    for (const name of names.sort()) {
      const match = LAYOUT_ARTIFACT_PATTERN.exec(name);
      if (!match) continue;
      const bucket = match[1] === "response" ? layoutFiles.responses : match[1] === "resolved" ? layoutFiles.resolved : layoutFiles.checks;
      const attemptLabel = match[2] === "0" ? "" : ` · 第 ${Number(match[2]) + 1} 次`;
      bucket.push({ label: `${match[1] === "response" ? "模型响应（基础组合）" : match[1] === "resolved" ? "求解回执（实文测量）" : "布局检查"}${attemptLabel}`, path: `${prefix}${name}` });
    }
  }
  const preview = await grayPreview(runDir);
  return {
    "manuscript-normalization": {
      inputs: [{ label: "规范化原稿", path: "source.md" }],
      prompts: [{ label: "本次规则快照（内容结构 / 页面组合 / 排版）", path: "rules-snapshot.md" }],
      outputs: [],
      checks: [],
    },
    "semantic-planning": {
      inputs: [{ label: "规划输入（版面尺寸 + 全部来源 + 全稿）", path: "source.md" }],
      prompts: prefix ? [{ label: "system 提示词（SEMANTIC_CONTRACT + 共用规则）", path: `${prefix}system-prompt.txt` }] : [],
      outputs: prefix ? [
        { label: "模型响应（语义计划）", path: `${prefix}model-response.json` },
        { label: "内容计划", path: `${prefix}content-plan.json` },
      ] : [],
      checks: prefix ? [{ label: "程序检查（来源引用 / 容量 / 边界）", path: `${prefix}structure-check.json` }] : [],
    },
    "expression-selection": {
      inputs: prefix ? [{ label: "上一版计划（表达选择输入）", path: `${prefix}content-plan.json` }] : [],
      prompts: prefix ? [{ label: "system 提示词（EXPRESSION_CONTRACT）", path: `${prefix}expression-prompt.txt` }] : [],
      outputs: prefix ? [
        { label: "模型响应（表达选择）", path: `${prefix}expression-response.json` },
        { label: "绑定后的语义计划", path: `${prefix}semantic-plan.json` },
      ] : [],
      checks: [],
    },
    "semantic-review": {
      inputs: prefix ? [{ label: "审稿输入（可见页摘要）", path: `${prefix}visible-plan.json` }] : [],
      prompts: prefix ? [{ label: "system 提示词（SEMANTIC_REVIEW_CONTRACT）", path: `${prefix}semantic-prompt.txt` }] : [],
      outputs: prefix ? [{ label: "模型响应（审稿结论）", path: `${prefix}semantic-response.json` }] : [],
      checks: prefix ? [{ label: "审稿记录", path: `${prefix}semantic-check.json` }] : [],
    },
    "layout-solving": {
      inputs: prefix ? [{ label: "冻结的语义计划", path: `${prefix}semantic-plan.json` }] : [],
      prompts: prefix ? [{ label: "system 提示词（LAYOUT_CONTRACT）", path: `${prefix}layout-prompt.txt` }] : [],
      outputs: prefix ? [
        { label: "最终计划（含坐标）", path: `${prefix}plan.json` },
        ...layoutFiles.responses,
        ...layoutFiles.resolved,
      ] : [],
      checks: prefix ? [...layoutFiles.checks, { label: "最终程序检查", path: `${prefix}program-check.json` }] : [],
    },
    "gray-rendering": {
      inputs: [{ label: "最终计划", path: "plan.json" }],
      prompts: [],
      outputs: preview.pptxPath ? [{ label: "灰稿可编辑 PPTX", path: preview.pptxPath }] : [],
      checks: preview.editableCheckPath ? [{ label: "可编辑性检查（逐字回读 PPTX）", path: preview.editableCheckPath }] : [],
    },
  };
}

function stepStatusForRevision({ files, expressionPromptReady, revisionDone, revisionPassed }) {
  const status = {};
  const seen = (name) => files[name] !== null && files[name] !== undefined;
  // 每步的判定只用落盘文件与轮结果，不看时间戳猜先后。
  // skipped 只表示"上游已经失败、这步不会再执行"；上游还没结束（pending）时下游也是 pending。
  // 表达选择的判据用 expression-prompt.txt：它在表达调用**之前**落盘，而结构检查在表达绑定**之后**才写；
  // 只看 structure-check 会把"表达调用进行中"误标成"语义规划进行中"。
  if (!seen("model-response.json") && !seen("content-plan.json")) {
    status["semantic-planning"] = "pending";
  } else if (seen("structure-check.json")) {
    status["semantic-planning"] = files["structure-check.json"]?.accepted ? "succeeded" : "failed";
  } else if (expressionPromptReady) {
    status["semantic-planning"] = "succeeded";
  } else {
    status["semantic-planning"] = "pending";
  }

  if (status["semantic-planning"] === "failed") status["expression-selection"] = "skipped";
  else if (status["semantic-planning"] === "pending") status["expression-selection"] = "pending";
  else if (seen("expression-response.json")) status["expression-selection"] = "succeeded";
  else status["expression-selection"] = revisionDone && !revisionPassed ? "failed" : "pending";

  // 上游一旦失败或被跳过，下游不会再执行——把它们也标成"本轮未执行"，而不是永远"未开始"。
  const downstream = (previous) => (previous === "failed" || previous === "skipped" ? "skipped" : previous === "pending" ? "pending" : null);

  const reviewBase = downstream(status["expression-selection"]);
  if (reviewBase) status["semantic-review"] = reviewBase;
  else if (seen("semantic-check.json")) {
    const check = files["semantic-check.json"];
    status["semantic-review"] = check?.accepted && !(check?.issues?.length) ? "succeeded" : "failed";
  } else {
    status["semantic-review"] = revisionDone && !revisionPassed ? "failed" : "pending";
  }

  const layoutBase = downstream(status["semantic-review"]);
  if (layoutBase) status["layout-solving"] = layoutBase;
  else if (seen("program-check.json")) {
    status["layout-solving"] = revisionPassed ? "succeeded" : "failed";
  } else {
    status["layout-solving"] = revisionDone && !revisionPassed ? "failed" : "pending";
  }
  return status;
}

/**
 * 主快照。供 describeRun 现算（不落盘）：运行中它随文件出现变化，
 * 停止后它稳定。前端按 revision 切换查看每一轮。
 */
export async function graySnapshot(runDir) {
  const state = await readJsonIfExists(path.join(runDir, "state.json"));
  const gray = state?.grayDraft ?? null;
  if (gray?.version === "gray-agent-1") return agentSnapshot(runDir, state, gray);
  const history = Array.isArray(gray?.history) ? gray.history : [];
  const revisionNumbers = [];
  try {
    for (const name of await fs.readdir(runDir)) {
      const match = REVISION_PATTERN.exec(name);
      if (match) revisionNumbers.push(Number.parseInt(match[1], 10));
    }
  } catch {}
  revisionNumbers.sort((left, right) => left - right);
  const activeRevision = revisionNumbers.length ? revisionNumbers.at(-1) : null;

  const revisions = [];
  for (const revision of revisionNumbers) {
    const dir = path.join(runDir, `revision-${revision}`);
    const historyEntry = history.find((entry) => entry.revision === revision) ?? null;
    const files = {
      "model-response.json": await readJsonIfExists(path.join(dir, "model-response.json")),
      "content-plan.json": await readJsonIfExists(path.join(dir, "content-plan.json")),
      "structure-check.json": await readJsonIfExists(path.join(dir, "structure-check.json")),
      "expression-response.json": await readJsonIfExists(path.join(dir, "expression-response.json")),
      "semantic-response.json": await readJsonIfExists(path.join(dir, "semantic-response.json")),
      "semantic-check.json": await readJsonIfExists(path.join(dir, "semantic-check.json")),
      "layout-check-0.json": await readJsonIfExists(path.join(dir, "layout-check-0.json")),
      "program-check.json": await readJsonIfExists(path.join(dir, "program-check.json")),
    };
    const revisionDone = historyEntry !== null;
    const revisionPassed = Boolean(historyEntry?.program && historyEntry?.semantic);
    const expressionPromptReady = await exists(path.join(dir, "expression-prompt.txt"));
    revisions.push({
      revision,
      directory: `revision-${revision}`,
      done: revisionDone,
      passed: revisionPassed,
      steps: stepStatusForRevision({ files, expressionPromptReady, revisionDone, revisionPassed }),
    });
  }

  // 稿件进入的完成判据是快照文件；灰稿渲染只看渲染终态。
  const sourceReady = await exists(path.join(runDir, "source.md"));
  const preview = await grayPreview(runDir);
  const renderingDone = Boolean(preview.pptxPath) && gray?.status === "awaiting-user-review";
  const latest = revisions.at(-1);
  const steps = GRAY_STAGES.map(([id]) => ({ id, status: "pending" }));
  if (sourceReady) {
    const byId = Object.fromEntries(steps.map((step) => [step.id, step]));
    byId["manuscript-normalization"].status = "succeeded";
    if (latest) for (const [id, status] of Object.entries(latest.steps)) byId[id].status = status;
    const layoutStatus = byId["layout-solving"].status;
    byId["gray-rendering"].status = renderingDone ? "succeeded"
      : layoutStatus === "succeeded" ? (gray?.status === "blocked" ? "failed" : "pending")
        : layoutStatus === "failed" || layoutStatus === "skipped" ? "skipped"
          : "pending";
  }

  // 运行中时，第一个未完成且未被上游跳过的步骤就是当前步骤。由文件推导，不预登记阶段事件。
  let currentStage = null;
  if (gray?.status === "planning" || gray?.status === "rendering") {
    currentStage = steps.find((step) => step.status === "pending" && step.id !== "manuscript-normalization")?.id
      ?? (gray.status === "rendering" ? "gray-rendering" : null);
    if (currentStage) steps.find((step) => step.id === currentStage).status = "running";
  }

  return {
    kind: "gray",
    status: gray?.status ?? null,
    humanReview: gray?.humanReview ?? null,
    area: gray?.area ?? null,
    provider: gray?.provider ?? null,
    providerSettings: gray?.providerSettings ?? null,
    sourceHash: gray?.sourceHash ?? null,
    runtimeFailure: state?.runtimeFailure ?? null,
    revisions,
    activeRevision,
    steps,
    currentStage,
    preview,
    plan: await planSummary(runDir),
    sources: (state?.sources ?? []).map((source) => ({ id: source.id, heading: source.heading ?? null, text: source.text })),
  };
}

/** Agent 运行（gray-agent-1）的快照：步骤是 Agent 的轮次，产物与预览在运行根目录。 */
async function agentSnapshot(runDir, state, gray) {
  const preview = await grayPreview(runDir);
  const turns = Array.isArray(gray.turns) ? gray.turns : [];
  const renders = Array.isArray(gray.renders) ? gray.renders : [];
  const running = gray.status === "planning" || gray.status === "rendering";
  const steps = [
    { id: "system", status: "succeeded", tools: [] },
    ...turns.map((turn, index) => ({
      id: `turn-${turn.turn ?? index + 1}`,
      status: running && index === turns.length - 1 ? "running" : "succeeded",
      tools: Array.isArray(turn.tools) ? turn.tools : [],
      stalled: Boolean(turn.stalled),
    })),
  ];
  if (gray.status === "awaiting-user-review") steps.push({ id: "delivered", status: "succeeded", tools: [] });
  if (gray.status === "blocked") steps.push({ id: "blocked", status: "failed", tools: [] });
  return {
    kind: "gray", agent: true,
    status: gray.status,
    humanReview: gray.humanReview ?? null,
    area: gray.area ?? null,
    provider: gray.provider ?? null,
    providerSettings: gray.providerSettings ?? null,
    sourceHash: gray.sourceHash ?? null,
    runtimeFailure: state?.runtimeFailure ?? null,
    revisions: [], activeRevision: null,
    steps,
    currentStage: steps.find((step) => step.status === "running")?.id ?? null,
    preview,
    plan: await planSummary(runDir),
    sources: (state?.sources ?? []).map((source) => ({ id: source.id, heading: source.heading ?? null, text: source.text })),
    agentTurns: turns,
    agentRenders: renders,
  };
}

/**
 * 这条灰稿运行还能不能接着跑。**只判定，不跑**。
 *
 * 灰稿运行器的续跑语义与薄运行器不同：它没有"阶段闸门"，resume 会带着上一轮的
 * 检查记录（以及调用方提供的人工反馈）从规划修订继续走——语义规划→表达→审稿→布局，
 * 成功后重新渲染。起点只能是最新修订轮之后，不提供人为指定。
 */
export function grayContinuability({ summary, state, isArchive = false }) {
  const deny = (reason) => ({ allowed: false, mode: null, fromPhase: null, reason });
  if (isArchive) return deny("这是仓库内的历史运行，只读；要接着跑请把它复制到工作台的运行区。");
  if (!summary) return deny("找不到这条运行的记录。");
  if (summary.pipeline !== "gray") return deny("这条运行不是灰稿线，没有灰稿运行器的修订状态。");
  if (!state) return deny("运行目录里没有 state.json，取不到灰稿状态。");
  const gray = state.grayDraft;
  if (!gray) return deny("state.json 里没有灰稿状态，无法续跑。");
  if (gray.version === "gray-agent-1") return deny("这条运行走的是灰稿 Agent 闭环：修订与续跑能力还在建设中（当前按需重跑整条线），暂不能从这里继续。");
  if (["normalizing", "running"].includes(summary.status)) return deny("这条运行正在进行中，等它结束或中断后再继续。");

  const revision = Array.isArray(gray.history) ? gray.history.length : 0;
  const base = { allowed: true, mode: "resume", fromPhase: gray.status, revision };
  if (gray.status === "awaiting-user-review") {
    return {
      ...base,
      reason: `灰稿候选已产出（已完成 ${revision} 轮修订）。续跑会带上一轮的检查记录再走一轮规划修订：`
        + "语义规划 → 表达选择 → 语义审稿 → 布局求解，成功后重新渲染灰稿；通过与否都由新一版的检查文件记账。",
    };
  }
  if (gray.status === "blocked") {
    const message = state.runtimeFailure?.message ?? "未记录原因";
    return {
      ...base,
      cleanup: true,
      reason: `上次运行没有走完（${message}）。续跑会先整理未完成的修订轮目录（改名保留，不删除），再从规划修订继续。`,
    };
  }
  return {
    ...base,
    cleanup: true,
    reason: `上次运行中断在「${gray.status === "rendering" ? "灰稿渲染" : "规划修订"}」阶段。`
      + "续跑会先整理未完成的修订轮目录（改名保留，不删除），再从规划修订继续。",
  };
}

/**
 * 续跑前的整理：下一次要写的 revision-N 目录若已存在（上次在轮中途被杀），
 * 把它改名成 revision-N-interrupted-<时间> 保留证据——灰稿运行器拒绝往已存在的轮目录里写，
 * 而删除别人的失败记录不是工作台该做的事。
 */
export async function prepareGrayResume(runDir) {
  const state = await readJsonIfExists(path.join(runDir, "state.json"));
  const revision = Array.isArray(state?.grayDraft?.history) ? state.grayDraft.history.length : 0;
  const target = path.join(runDir, `revision-${revision}`);
  // history.length = N 意味着第 N 轮还没记账；此时该轮目录若已存在，就是上次中断留下的。
  if (!(await exists(target))) return { moved: null, revision };
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const renamed = `revision-${revision}-interrupted-${stamp}`;
  await fs.rename(target, path.join(runDir, renamed));
  return { moved: renamed, revision };
}

export { exists, readJsonIfExists };
