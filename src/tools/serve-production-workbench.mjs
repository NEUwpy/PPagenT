import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeManuscript, supportedManuscriptExtensions } from "../workbench/manuscript-normalizer.mjs";
import { createTraceRecorder, readTraceEvents } from "../workbench/trace-recorder.mjs";
import { createVisualDirectorCheckpoint, withVisualDirectorCheckpoint } from "../workbench/visual-director-checkpoint.mjs";
import { readJsonState, writeJsonState } from "../workbench/json-state-file.mjs";
import { createNativePptCheckpoint, readNativePptCheckpoint } from "../workbench/native-ppt-checkpoint.mjs";
import { candidateSetsForVisualDirector } from "../agent/model-director-provider.mjs";
import {
  RUNNER_STAGES, RUNNER_HANDOFFS, RUNNER_PIPELINE_NOTE, STAGE_OF_PHASE,
  archiveRunSummary, runnerArtifacts, readRunnerDeckTitle, exists,
} from "../workbench/runner-run-adapter.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const defaultProjectRoot = path.resolve(import.meta.dirname, "..", "..");
const projectRoot = path.resolve(option("--root", defaultProjectRoot));
const port = Number(option("--port", process.env.PPAGENT_PRODUCTION_WORKBENCH_PORT ?? 4212));
const host = "127.0.0.1";
const templatePath = path.join(import.meta.dirname, "templates", "production-workbench.html");
const workbenchRoot = path.join(projectRoot, ".tmp", "production-workbench");
const runsRoot = path.join(workbenchRoot, "runs");
// 仓库内的运行证据目录。工作台**只读**这里：它是 Git 里的运行记录（harness/runs/README.md 的约定），
// 不是工作台的临时产物，因此不在这里创建、不在这里删除。列出来是为了让"生成的东西在哪看"只有一个答案。
const archiveRoot = path.join(projectRoot, "harness", "runs");
const currentRunPath = path.join(workbenchRoot, "current-run.json");
const maxUploadBytes = 30 * 1024 * 1024;
const runtimeRevision = process.env.PPAGENT_RUNTIME_REVISION || "source-direct";
const serverStartedAt = new Date().toISOString();
let activeRunId = null;
/** 仓库证据目录里出现的运行编号。由 listAllRuns 刷新；这些记录在工作台里只读。 */
let archiveRunIds = new Set();
const activeVisualCheckpoints = new Map();
const activeNativePptCheckpoints = new Map();
const activeRunTasks = new Map();

function awaitingCheckpoint(runId) {
  const visual = activeVisualCheckpoints.get(runId);
  if (visual?.read()?.status === "awaiting-user") return visual;
  const native = activeNativePptCheckpoints.get(runId);
  if (native?.read()?.status === "awaiting-user") return native;
  return null;
}

function runIsDeletable(runId) {
  // 仓库证据目录（harness/runs）里的记录不属于工作台，工作台不删它。
  if (archiveRunIds.has(runId)) return false;
  if (awaitingCheckpoint(runId)) return true;
  return activeRunId !== runId
    && !activeVisualCheckpoints.has(runId)
    && !activeNativePptCheckpoints.has(runId);
}

async function cancelAwaitingRun(runId) {
  const checkpoint = awaitingCheckpoint(runId);
  if (!checkpoint) return false;
  const task = activeRunTasks.get(runId);
  await checkpoint.cancel();
  if (task) await task;
  return true;
}

function send(response, status, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  response.writeHead(status, { "content-type": contentType, "x-content-type-options": "nosniff", ...headers });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), "application/json; charset=utf-8", { "cache-control": "no-store" });
}

function safeFilename(value) {
  const decoded = decodeURIComponent(String(value || "稿件.md"));
  const basename = path.basename(decoded).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  return basename || "稿件.md";
}

function runDir(runId) {
  if (!/^[a-z0-9-]+$/i.test(runId)) throw new Error("非法运行编号");
  return path.join(runsRoot, runId);
}

/**
 * 读到一次运行的目录。两个来源：工作台自己的 runsRoot（可写），或仓库证据目录 archiveRoot（只读）。
 * 同名时以工作台自己的为准——本次运行的事实优先于历史证据。
 */
async function resolveRunDir(runId) {
  const primary = runDir(runId);
  if (await exists(path.join(primary, "summary.json"))) return primary;
  const archived = path.join(archiveRoot, runId);
  if (await exists(path.join(archived, "state.json"))) return archived;
  return primary;
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxUploadBytes) {
      const error = new Error("稿件超过 30 MB 上限");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!bytes) throw new Error("没有收到稿件内容");
  return Buffer.concat(chunks);
}

async function writeSummary(targetRunDir, summary) {
  await writeJsonState(path.join(targetRunDir, "summary.json"), summary);
  await writeCurrentRunPointer(targetRunDir, summary);
}

async function writeCurrentRunPointer(targetRunDir, summary) {
  const relativeRunDir = path.relative(projectRoot, targetRunDir).replaceAll("\\", "/");
  const pointer = {
    schemaVersion: "1.0",
    runId: summary.runId,
    status: summary.status,
    originalName: summary.originalName,
    active: ["normalizing", "running", "awaiting-visual-approval", "awaiting-native-preview-approval"].includes(summary.status),
    runDir: relativeRunDir,
    summary: `${relativeRunDir}/summary.json`,
    events: `${relativeRunDir}/events.jsonl`,
    traceDir: `${relativeRunDir}/trace`,
    normalizedManuscript: `${relativeRunDir}/input/normalized.md`,
    workflowDir: `${relativeRunDir}/workflow`,
    deliveryDir: `${relativeRunDir}/delivery`,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonState(currentRunPath, pointer);
}

async function readSummary(targetRunDir) {
  const summaryPath = path.join(targetRunDir, "summary.json");
  if (await exists(summaryPath)) return readJsonState(summaryPath);
  // harness/runs 的历史运行没有工作台的 summary.json：从唯一真源 state.json 合成一份只读记录。
  return archiveRunSummary({ runId: path.basename(targetRunDir), runDir: targetRunDir });
}

/**
 * 仓库证据目录里的历史运行。**只列不写**：没有 summary.json 的目录才算历史证据；
 * 已经有 summary.json 的说明它是工作台运行被搬进来的，按工作台记录读取，不重复列。
 */
async function listArchiveRuns() {
  const entries = await fs.readdir(archiveRoot, { withFileTypes: true }).catch(() => []);
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-z0-9-]+$/i.test(entry.name)) continue;
    const targetRunDir = path.join(archiveRoot, entry.name);
    if (await exists(path.join(targetRunDir, "summary.json"))) continue;
    try { summaries.push(await archiveRunSummary({ runId: entry.name, runDir: targetRunDir })); } catch {}
  }
  return summaries;
}

async function listAllRuns() {
  await fs.mkdir(runsRoot, { recursive: true });
  const entries = await fs.readdir(runsRoot, { withFileTypes: true });
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try { summaries.push(await readSummary(path.join(runsRoot, entry.name))); } catch {}
  }
  const archived = await listArchiveRuns();
  archiveRunIds = new Set(archived.map((run) => run.runId));
  return [...summaries, ...archived].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function listRuns() {
  return (await listAllRuns()).slice(0, 30);
}

function checkedRunDir(runId) {
  const targetRunDir = path.resolve(runDir(runId));
  const resolvedRunsRoot = path.resolve(runsRoot);
  if (path.dirname(targetRunDir) !== resolvedRunsRoot || targetRunDir === resolvedRunsRoot) {
    const error = new Error("删除目标不在运行记录目录内");
    error.statusCode = 403;
    throw error;
  }
  return targetRunDir;
}

async function deleteRuns(runIds) {
  const uniqueRunIds = [...new Set(runIds)];
  if (!uniqueRunIds.length) {
    const error = new Error("没有选择可删除的运行记录");
    error.statusCode = 400;
    throw error;
  }
  if (uniqueRunIds.length > 500) {
    const error = new Error("单次最多删除 500 条运行记录");
    error.statusCode = 400;
    throw error;
  }
  if (uniqueRunIds.some((runId) => typeof runId !== "string" || !/^[a-z0-9-]+$/i.test(runId))) {
    const error = new Error("批量删除包含非法运行编号");
    error.statusCode = 400;
    throw error;
  }
  const targets = uniqueRunIds.map((runId) => ({ runId, targetRunDir: checkedRunDir(runId) }));
  // 判据是"这次运行实际落在哪"：解析结果不在 runsRoot 里的，就是仓库证据目录的历史运行，工作台不删它。
  // 这一步必须排在活动检查之前——runIsDeletable 对它们也返回 false，否则会被误报成"仍在计算"。
  const archived = [];
  for (const { runId, targetRunDir } of targets) {
    const resolved = await resolveRunDir(runId);
    if (path.resolve(resolved) !== path.resolve(targetRunDir)) archived.push(runId);
  }
  if (archived.length) {
    const error = new Error(`仓库内运行证据（harness/runs）在工作台里只读：${archived.join("、")}。要删除请直接在文件系统里处理。`);
    error.statusCode = 403;
    throw error;
  }
  const activeTargets = uniqueRunIds.filter((runId) => !runIsDeletable(runId));
  if (activeTargets.length) {
    const error = new Error("仍在计算或交付的记录不能删除；等待确认的记录可以直接取消并删除");
    error.statusCode = 409;
    error.activeRunIds = activeTargets;
    throw error;
  }
  for (const runId of uniqueRunIds) await cancelAwaitingRun(runId);
  await Promise.all(targets.map(({ targetRunDir }) => readSummary(targetRunDir)));
  let currentPointer = null;
  try { currentPointer = JSON.parse(await fs.readFile(currentRunPath, "utf8")); } catch {}
  for (const { targetRunDir } of targets) {
    await fs.rm(targetRunDir, { recursive: true, force: false });
  }
  const remainingRuns = await listAllRuns();
  const deletedCurrent = uniqueRunIds.includes(currentPointer?.runId);
  let nextCurrentRunId = currentPointer?.runId ?? null;
  if (deletedCurrent) {
    // 只在工作台自己的运行里挑下一个指针目标：仓库证据目录的记录不是"当前运行"，
    // 指向它会得到一个 runsRoot 下不存在的路径。
    const next = remainingRuns.find((run) => !archiveRunIds.has(run.runId));
    nextCurrentRunId = next?.runId ?? null;
    if (next) await writeCurrentRunPointer(runDir(next.runId), next);
    else await fs.rm(currentRunPath, { force: true });
  }
  // 报告的必须就是真正写下去的那一个：曾经这里用 remainingRuns[0] 另算一遍，
  // 结果指针已经清空、回复里却说"当前运行是某个仓库证据目录里的运行"。
  return { deletedRunIds: uniqueRunIds, currentRunId: nextCurrentRunId };
}

async function deleteRun(response, runId) {
  try {
    const result = await deleteRuns([runId]);
    return sendJson(response, 200, { ...result, deletedRunId: runId });
  } catch (error) {
    if (error.activeRunIds) return sendJson(response, error.statusCode, { error: error.message, activeRunIds: error.activeRunIds });
    throw error;
  }
}

async function deleteRunBatch(request, response) {
  const value = JSON.parse((await readBody(request)).toString("utf8"));
  const allRuns = await listAllRuns();
  const runIds = value?.mode === "all-deletable"
    ? allRuns.map((run) => run.runId).filter(runIsDeletable)
    : value?.runIds;
  if (!Array.isArray(runIds)) return sendJson(response, 400, { error: "runIds 必须是数组" });
  try {
    return sendJson(response, 200, await deleteRuns(runIds));
  } catch (error) {
    if (error.activeRunIds) return sendJson(response, error.statusCode, { error: error.message, activeRunIds: error.activeRunIds });
    throw error;
  }
}

function relativeArtifact(targetRunDir, absolutePath) {
  return path.relative(targetRunDir, path.resolve(absolutePath)).replaceAll("\\", "/");
}

async function executeRun(targetRunDir, summary, normalizedPath, recorder) {
  const startedAt = Date.now();
  try {
    const [{ createConfiguredDeepSeekProvider }, { runWorkflowCli }] = await Promise.all([
      import("../agent/deepseek-provider-from-env.mjs"),
      import("../agent/run-workflow.mjs"),
    ]);
    const { provider, publicConfig } = await createConfiguredDeepSeekProvider({ root: projectRoot, observer: recorder.observe });
    const unavailableDirector = () => {
      const error = new Error("DeepSeek 未配置，正式工作流将使用确定性保底路径");
      error.code = "DIRECTOR_PROVIDER_UNAVAILABLE";
      throw error;
    };
    let providerInstance = publicConfig.configured ? provider : {
      metadata: { providerKind: "deterministic-fallback-only" },
      contentDirector: unavailableDirector,
      visualDirector: unavailableDirector,
    };
    let nativePreviewApprover = null;
    if (summary.visualCheckpointMode === "manual") {
      const checkpoint = createVisualDirectorCheckpoint({
        runDir: targetRunDir,
        onAwaiting: async (state) => {
          if (activeRunId === summary.runId) activeRunId = null;
          summary.status = "awaiting-visual-approval";
          summary.visualCheckpoint = { stage: state.stage, status: state.status, updatedAt: state.updatedAt };
          await recorder.observe({
            source: "workbench", type: "manual-checkpoint", status: "awaiting-user", stage: "visual-director",
            output: { expectedPageIds: state.expectedPageIds, checkpoint: "checkpoint/visual-director.json" },
          });
          await writeSummary(targetRunDir, summary);
        },
        onResumed: async (state) => {
          summary.status = "running";
          summary.visualCheckpoint = { stage: state.stage, status: state.status, updatedAt: state.updatedAt };
          await recorder.observe({
            source: "workbench", type: "manual-checkpoint", status: "succeeded", stage: "visual-director",
            output: { edited: true, expectedPageIds: state.expectedPageIds },
          });
          await writeSummary(targetRunDir, summary);
        },
      });
      activeVisualCheckpoints.set(summary.runId, checkpoint);
      providerInstance = withVisualDirectorCheckpoint(provider, checkpoint, (input) => ({
        ...input,
        candidateSets: candidateSetsForVisualDirector(input.candidateSets, input.previousResolution?.feedback ?? []),
      }));
    }
    if (summary.nativePreviewCheckpointMode === "manual") {
      const checkpoint = createNativePptCheckpoint({
        runDir: targetRunDir,
        onAwaiting: async (state) => {
          if (activeRunId === summary.runId) activeRunId = null;
          summary.status = "awaiting-native-preview-approval";
          summary.nativePreview = {
            status: state.status,
            pageCount: state.preview.pageCount,
            pptxPath: relativeArtifact(targetRunDir, state.preview.stagedPptx),
            montagePath: state.preview.montage ? relativeArtifact(targetRunDir, state.preview.montage) : null,
            pagePaths: state.preview.pageEvidence.map((item) => relativeArtifact(targetRunDir, item)),
            updatedAt: state.updatedAt,
          };
          await recorder.observe({
            source: "workbench", type: "manual-checkpoint", status: "awaiting-user", stage: "native-preview",
            output: { pageCount: state.preview.pageCount, preview: summary.nativePreview.montagePath, stagedPptx: summary.nativePreview.pptxPath },
          });
          await writeSummary(targetRunDir, summary);
        },
        onResumed: async (state) => {
          summary.status = "running";
          summary.nativePreview = { ...summary.nativePreview, status: state.status, updatedAt: state.updatedAt };
          await recorder.observe({
            source: "workbench", type: "manual-checkpoint", status: "succeeded", stage: "native-preview",
            output: { approved: true, pageCount: state.preview.pageCount },
          });
          await writeSummary(targetRunDir, summary);
        },
      });
      activeNativePptCheckpoints.set(summary.runId, checkpoint);
      nativePreviewApprover = checkpoint.pause;
    }
    summary.provider = publicConfig;
    await writeSummary(targetRunDir, summary);
    const outputPptx = path.join(targetRunDir, "delivery", `${path.parse(summary.originalName).name || "PPagenT"}-v1.pptx`);
    await fs.mkdir(path.dirname(outputPptx), { recursive: true });
    const result = await runWorkflowCli({
      root: projectRoot,
      input: normalizedPath,
      skin: "northeastern-university-001",
      output: outputPptx,
      "run-dir": path.join(targetRunDir, "workflow"),
      provider: "",
      providerInstance,
      providerLabel: "configured-deepseek-provider",
      observer: recorder.observe,
      nativePreviewApprover,
      mode: "production",
      python: "",
      "overflow-tool": "",
    });
    const artifacts = [
      { label: "可编辑 PPTX", kind: "pptx", path: relativeArtifact(targetRunDir, result.outputPptx) },
      { label: "规范化 Markdown", kind: "markdown", path: relativeArtifact(targetRunDir, normalizedPath) },
      { label: "运行结果", kind: "json", path: "workflow/workflow-result.json" },
      { label: "生产统计", kind: "json", path: "workflow/production-statistics.json" },
      ...(result.resilienceReport?.events?.length
        ? [{ label: "鲁棒性与兜底报告", kind: "json", path: "workflow/resilience-report.json" }]
        : []),
      ...(result.assetGapReport?.fallbackPageCount
        ? [{ label: "结构缺口与退回报告", kind: "json", path: "workflow/asset-gap-report.json" }]
        : []),
      ...result.renderResult.pageEvidence.map((item, index) => ({
        label: `第 ${index + 1} 页`, kind: "image", path: relativeArtifact(targetRunDir, item),
      })),
    ];
    if (result.renderResult.montage) {
      artifacts.splice(1, 0, { label: "整套预览", kind: "image", path: relativeArtifact(targetRunDir, result.renderResult.montage) });
    }
    await recorder.observe({
      source: "workbench", type: "delivery", status: "succeeded", stage: "delivery",
      durationMs: Date.now() - startedAt,
      output: {
        pageCount: result.pageCount,
        deliveryStatus: result.deliveryStatus ?? result.status,
        outputPptx: artifacts[0].path,
        qualityAudit: result.renderResult.qualityAudit,
        fallbackPageCount: result.productionStatistics?.fallbackPageCount
          ?? result.assetGapReport?.fallbackPageCount
          ?? 0,
        recommendedStructureSupplements: result.assetGapReport?.recommendedStructureSupplements ?? [],
        productionStatistics: result.productionStatistics,
        resilienceReport: result.resilienceReport,
      },
    });
    summary.status = "succeeded";
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt;
    summary.pageCount = result.pageCount;
    summary.deliveryStatus = result.deliveryStatus ?? result.status;
    summary.assetGapReport = result.assetGapReport;
    summary.productionStatistics = result.productionStatistics;
    summary.resilienceReport = result.resilienceReport;
    summary.artifacts = artifacts;
  } catch (error) {
    const cancelled = error?.code === "WORKBENCH_RUN_CANCELLED";
    await recorder.observe({
      source: "workbench", type: cancelled ? "cancellation" : "delivery", status: cancelled ? "cancelled" : "failed", stage: error?.stage ?? "delivery",
      durationMs: Date.now() - startedAt,
      error: { name: error?.name, code: error?.code, message: error?.message ?? String(error), details: error?.details },
    });
    summary.status = cancelled ? "cancelled" : "failed";
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt;
    summary.error = { name: error?.name, code: error?.code, stage: error?.stage, message: error?.message ?? String(error), details: error?.details };
  } finally {
    await recorder.flush();
    await writeSummary(targetRunDir, summary);
    if (activeRunId === summary.runId) activeRunId = null;
    activeVisualCheckpoints.delete(summary.runId);
    activeNativePptCheckpoints.delete(summary.runId);
  }
}

/**
 * 模型端点的主机名。事件里显示"哪家的模型"，比显示一个固定的产品名诚实（端点可换）。
 * 拿不到端点就返回 null——编一个 "chat-completions" 之类的名字出来，等于让看板显示
 * 一个谁也没见过的服务商名。
 */
function endpointHost(endpoint) {
  try { return new URL(endpoint).host; } catch { return null; }
}

/**
 * 走薄运行器（`src/runner/`）。**进程内调用**，理由与旧生产线一致：SEA 版 .exe 里没有可用的 node
 * 子进程——`process.execPath` 就是 .exe 自己，再 spawn 一次只会重新启动工作台。所以这里 await main()。
 *
 * 代价如实记在这里，不粉饰：
 *   ① 运行器**没有取消钩子**。任务开始后不能像表单暂停那样取消，只能等它结束或结束进程。
 *   ② 运行器不暂停等待批准，所以本入口没有人工检查点（上游已拒绝"又要暂停又走运行器"的组合）。
 *   ③ 好处是状态落在 state.json 里：进程中断后用 `--resume` 可以续跑，不像旧线那样只能重来。
 */
async function executeRunnerRun(targetRunDir, summary, normalizedPath, recorder) {
  const startedAt = Date.now();
  try {
    const { main } = await import("../runner/run.mjs");
    // 模型名不写在 summary 里靠猜：从实际发出的 api-call 事件里取，取到的就是真正上线的那一个。
    let observedModel = null;
    const observe = async (event) => {
      if (event.type === "api-call" && event.model) observedModel = event.model;
      // 运行器报的是它自己的 phase 名；工作台的流水线用另一套阶段 id，翻译在这里做。
      const stage = event.stage ? (STAGE_OF_PHASE[event.stage] ?? event.stage) : "delivery";
      await recorder.observe({
        ...event,
        stage,
        // 运行器的模型事件自报 source:"runner"；工作台流水线按 source==="model" 统计 API 次数。
        ...(event.type === "api-call" ? { source: "model", provider: endpointHost(event.endpoint) } : {}),
      });
    };
    // 这里**不发**"任务启动"事件。曾经发过一条挂在 delivery 阶段的启动事件，代价是：
    // 整场运行期间看板都把"交付"显示成正在进行的阶段（实际进行的是内容/视觉）。
    // 运行器自己会如实报每个阶段，工作台不替它宣布阶段；启动信息（生成线、运行目录、能力边界）
    // 都在 summary 里，不靠事件重复一遍。
    const result = await main(["--input", normalizedPath, "--run-dir", targetRunDir], { observer: observe });
    const artifacts = await runnerArtifacts(targetRunDir);
    const slideCount = artifacts.filter((item) => item.label.startsWith("第 ")).length;
    summary.artifacts = artifacts;
    summary.runner = {
      status: result.status,
      phase: result.phase,
      stopReason: result.stopReason ?? null,
      phases: result.phases ?? [],
    };
    summary.pageCount = slideCount;
    summary.bodyPageCount = result.bodyPageCount ?? null;
    summary.deckTitle = await readRunnerDeckTitle(targetRunDir);
    summary.model = observedModel;
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt;
    if (result.status === "delivered") {
      // 不再补一条交付阶段事件：运行器在循环结束时已经发过 delivery/succeeded。
      // 补一条只会让同一件事在记录里出现两次。
      summary.status = "succeeded";
      summary.deliveryStatus = "delivered";
    } else {
      // 停在原地就是没交付。不写成"失败"也不写成"成功"：运行器是**主动停止**的，
      // 状态还在 state.json 里，修好原因可以续跑。交付阶段事件同样由运行器发出。
      summary.status = "stopped";
      summary.error = {
        stage: result.phase,
        code: "RUNNER_STOPPED",
        message: `${result.note ?? "运行器停止且未交付"}（停止原因 ${result.stopReason ?? "未记录"}）`,
        details: { stopReason: result.stopReason, phases: result.phases },
      };
    }
  } catch (error) {
    // 运行器根本没跑起来或中途抛出时，它自己一条事件都发不出来，只能由工作台记账。
    // 沿用旧生产线的记法（type/status/stage 与 executeRun 的 catch 一致），不发明新事件类型：
    // 新类型在筛选按阶段进行的看板上会直接看不见。
    await recorder.observe({
      source: "workbench", type: "delivery", status: "failed", stage: error?.stage ?? "delivery",
      durationMs: Date.now() - startedAt,
      error: { name: error?.name, code: error?.code, message: error?.message ?? String(error) },
    });
    summary.status = "failed";
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt;
    summary.error = { name: error?.name, code: error?.code, stage: "runner", message: error?.message ?? String(error) };
    // 抛出的错误同样要留下产物清单：失败时更该看得见运行器已经写到哪一步。
    summary.artifacts = await runnerArtifacts(targetRunDir).catch(() => []);
  } finally {
    await recorder.flush();
    await writeSummary(targetRunDir, summary);
    if (activeRunId === summary.runId) activeRunId = null;
  }
}

async function createRun(request, response, url) {
  if (activeRunId) return sendJson(response, 409, { error: "已有生成任务正在运行", activeRunId });
  const pipeline = url.searchParams.get("pipeline") === "legacy" ? "legacy" : "runner";
  // 薄运行器没有人工检查点（harness/运行流程.md：阶段不要求用户逐步批准）。
  // 用户明确勾了暂停时不能静默忽略——那等于把一次显式请求丢掉。
  const wantsManualCheckpoint = url.searchParams.get("visualCheckpoint") === "manual"
    || url.searchParams.get("nativePreviewCheckpoint") === "manual";
  if (pipeline === "runner" && wantsManualCheckpoint) {
    return sendJson(response, 409, {
      error: "薄运行器不暂停等待人工确认，因此没有表单检查点。请取消勾选“调试时暂停表单”，或把生成线切换为旧 API 生产线。",
    });
  }
  const originalName = safeFilename(url.searchParams.get("filename"));
  const extension = path.extname(originalName).toLowerCase();
  if (!supportedManuscriptExtensions.includes(extension)) {
    return sendJson(response, 415, { error: extension === ".doc" ? "请先把旧版 .doc 另存为 .docx" : `不支持 ${extension || "无扩展名"}` });
  }
  const buffer = await readBody(request);
  const runId = `${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;
  const targetRunDir = runDir(runId);
  const inputDir = path.join(targetRunDir, "input");
  await fs.mkdir(inputDir, { recursive: true });
  const originalPath = path.join(inputDir, originalName);
  await fs.writeFile(originalPath, buffer);
  const recorder = createTraceRecorder(targetRunDir);
  const createdAt = new Date().toISOString();
  const summary = {
    schemaVersion: "1.0", runId, originalName, createdAt, status: "normalizing",
    skin: { id: "northeastern-university-001", name: "东北大学" },
    visualCheckpointMode: url.searchParams.get("visualCheckpoint") === "manual" ? "manual" : "auto",
    nativePreviewCheckpointMode: url.searchParams.get("nativePreviewCheckpoint") === "auto" ? "auto" : "manual",
    pipeline,
    // 阶段表随生成线走：两条线的阶段不是同一套，看板照实显示当前这条线的阶段。
    ...(pipeline === "runner"
      ? { stages: RUNNER_STAGES, handoffs: RUNNER_HANDOFFS, pipelineNote: RUNNER_PIPELINE_NOTE }
      : {}),
    artifacts: [],
  };
  await writeSummary(targetRunDir, summary);
  activeRunId = runId;
  try {
    const normalizeStarted = Date.now();
    await recorder.observe({
      source: "workbench", type: "stage-call", status: "running", stage: "manuscript-normalization",
      input: { originalName, bytes: buffer.length, extension },
    });
    const normalized = await normalizeManuscript({ inputPath: originalPath, originalName });
    const normalizedPath = path.join(inputDir, "normalized.md");
    await fs.writeFile(normalizedPath, `${normalized.rawMarkdown.trim()}\n`, "utf8");
    await recorder.observe({
      source: "workbench", type: "stage-call", status: "succeeded", stage: "manuscript-normalization",
      durationMs: Date.now() - normalizeStarted,
      output: { format: normalized.format, messages: normalized.messages, normalizedMarkdown: normalized.rawMarkdown },
    });
    summary.status = "running";
    summary.normalizedFormat = normalized.format;
    await writeSummary(targetRunDir, summary);
    const task = pipeline === "runner"
      ? executeRunnerRun(targetRunDir, summary, normalizedPath, recorder)
      : executeRun(targetRunDir, summary, normalizedPath, recorder);
    activeRunTasks.set(runId, task);
    task.finally(() => activeRunTasks.delete(runId)).catch(() => {});
    return sendJson(response, 202, summary);
  } catch (error) {
    await recorder.observe({
      source: "workbench", type: "stage-call", status: "failed", stage: "manuscript-normalization",
      error: { message: error?.message ?? String(error) },
    });
    await recorder.flush();
    summary.status = "failed";
    summary.error = { stage: "manuscript-normalization", message: error?.message ?? String(error) };
    await writeSummary(targetRunDir, summary);
    activeRunId = null;
    return sendJson(response, 422, summary);
  }
}

function contentTypeFor(target) {
  const extension = path.extname(target).toLowerCase();
  return ({
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".json": "application/json; charset=utf-8", ".ndjson": "application/x-ndjson; charset=utf-8",
    ".md": "text/markdown; charset=utf-8", ".html": "text/html; charset=utf-8", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  })[extension] ?? "application/octet-stream";
}

async function sendArtifact(response, targetRunDir, requestedPath) {
  const target = path.resolve(targetRunDir, requestedPath);
  const relative = path.relative(targetRunDir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return sendJson(response, 403, { error: "非法文件路径" });
  const data = await fs.readFile(target);
  const disposition = path.extname(target).toLowerCase() === ".pptx"
    ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(target))}` }
    : {};
  send(response, 200, data, contentTypeFor(target), { "cache-control": "no-store", ...disposition });
}

async function publicConfig() {
  let local = {};
  try { local = JSON.parse(await fs.readFile(path.join(projectRoot, "config", "deepseek.local.json"), "utf8")); } catch {}
  const visual = local.roles?.visualComposition ?? {};
  return {
    app: "PPagenT 正式生成工作台",
    skin: { id: "northeastern-university-001", name: "东北大学" },
    provider: {
      name: "DeepSeek",
      model: process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash",
      configured: Boolean(process.env.DEEPSEEK_API_KEY || local.apiKey),
      roles: {
        visualComposition: {
          model: process.env.PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_MODEL || visual.model
            || process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash",
          configured: Boolean(process.env.PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_API_KEY || visual.apiKey
            || process.env.DEEPSEEK_API_KEY || local.apiKey),
        },
      },
    },
    formats: supportedManuscriptExtensions,
    maxUploadBytes,
    activeRunId,
    pipelines: {
      default: "runner",
      runner: { label: "薄运行器", note: RUNNER_PIPELINE_NOTE, checkpoint: false },
      legacy: {
        label: "旧 API 生产线",
        note: "旧 API 生产线：固定候选与参数执行器，支持结构组件页与人工表单检查点，但不再作为新架构主线。",
        checkpoint: true,
      },
    },
    runtime: { revision: runtimeRevision, startedAt: serverStartedAt },
  };
}

async function readVisualCheckpoint(targetRunDir) {
  return JSON.parse(await fs.readFile(path.join(targetRunDir, "checkpoint", "visual-director.json"), "utf8"));
}

async function submitVisualCheckpoint(request, response, runId) {
  const checkpoint = activeVisualCheckpoints.get(runId);
  if (!checkpoint) return sendJson(response, 409, { error: "该运行当前没有可继续的视觉导演表单调试暂停；服务重启后不能恢复已暂停任务" });
  if (activeRunId && activeRunId !== runId) return sendJson(response, 409, { error: "另一个任务正在生成，请完成后再继续这个等待任务", activeRunId });
  activeRunId = runId;
  try {
    const value = JSON.parse((await readBody(request)).toString("utf8"));
    const state = await checkpoint.submit(value.output);
    return sendJson(response, 200, { checkpoint: { stage: state.stage, status: state.status, updatedAt: state.updatedAt } });
  } catch (error) {
    if (activeRunId === runId) activeRunId = null;
    throw error;
  }
}

async function submitNativePptCheckpoint(response, runId) {
  const checkpoint = activeNativePptCheckpoints.get(runId);
  if (!checkpoint) return sendJson(response, 409, { error: "该运行当前没有可继续的 Native PPT 预览确认；服务重启后不能恢复已暂停任务" });
  if (activeRunId && activeRunId !== runId) return sendJson(response, 409, { error: "另一个任务正在生成，请完成后再确认这个等待任务", activeRunId });
  activeRunId = runId;
  try {
    const state = await checkpoint.approve();
    return sendJson(response, 200, { checkpoint: { stage: state.stage, status: state.status, updatedAt: state.updatedAt } });
  } catch (error) {
    if (activeRunId === runId) activeRunId = null;
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        app: "ppagent-production-workbench",
        root: projectRoot,
        pid: process.pid,
        activeRunId,
        runtimeRevision,
        startedAt: serverStartedAt,
      });
    }
    if (request.method === "GET" && url.pathname === "/") {
      return send(response, 200, await fs.readFile(templatePath), "text/html; charset=utf-8", { "cache-control": "no-store" });
    }
    if (request.method === "GET" && url.pathname === "/api/workbench/config") return sendJson(response, 200, await publicConfig());
    if (request.method === "GET" && url.pathname === "/api/workbench/current") {
      // 指针文件可能本来就不存在（从未跑过任务，或最后一个任务被删掉后指针被清除）。
      // 那不是错误，是"没有当前运行"。
      let pointer = null;
      try { pointer = await readJsonState(currentRunPath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
      return sendJson(response, 200, pointer);
    }
    if (request.method === "GET" && url.pathname === "/api/workbench/runs") {
      const [runs, allRuns] = await Promise.all([listRuns(), listAllRuns()]);
      const deletableRunCount = allRuns.filter((run) => runIsDeletable(run.runId)).length;
      return sendJson(response, 200, { runs, activeRunId, totalRunCount: allRuns.length, deletableRunCount });
    }
    if (request.method === "POST" && url.pathname === "/api/workbench/runs") return await createRun(request, response, url);
    if (request.method === "POST" && url.pathname === "/api/workbench/runs/batch-delete") return await deleteRunBatch(request, response);
    const deleteMatch = url.pathname.match(/^\/api\/workbench\/runs\/([a-z0-9-]+)$/i);
    if (deleteMatch && request.method === "DELETE") return await deleteRun(response, deleteMatch[1]);
    const checkpointMatch = url.pathname.match(/^\/api\/workbench\/runs\/([a-z0-9-]+)\/checkpoint\/visual-director$/i);
    if (checkpointMatch && request.method === "GET") return sendJson(response, 200, await readVisualCheckpoint(runDir(checkpointMatch[1])));
    if (checkpointMatch && request.method === "POST") return await submitVisualCheckpoint(request, response, checkpointMatch[1]);
    const nativeCheckpointMatch = url.pathname.match(/^\/api\/workbench\/runs\/([a-z0-9-]+)\/checkpoint\/native-ppt$/i);
    if (nativeCheckpointMatch && request.method === "GET") return sendJson(response, 200, await readNativePptCheckpoint(runDir(nativeCheckpointMatch[1])));
    if (nativeCheckpointMatch && request.method === "POST") return await submitNativePptCheckpoint(response, nativeCheckpointMatch[1]);
    const match = url.pathname.match(/^\/api\/workbench\/runs\/([a-z0-9-]+)(?:\/(events|trace|artifact))?(?:\/([a-z0-9-]+))?$/i);
    if (match) {
      const targetRunDir = await resolveRunDir(match[1]);
      if (!match[2]) return sendJson(response, 200, await readSummary(targetRunDir));
      if (match[2] === "events") return sendJson(response, 200, { events: await readTraceEvents(targetRunDir, Number(url.searchParams.get("after") || 0)) });
      if (match[2] === "trace") return send(response, 200, await fs.readFile(path.join(targetRunDir, "trace", `${match[3]}.json`)), "application/json; charset=utf-8", { "cache-control": "no-store" });
      if (match[2] === "artifact") return await sendArtifact(response, targetRunDir, url.searchParams.get("path") || "");
    }
    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    sendJson(response, error?.statusCode ?? (error?.code === "ENOENT" ? 404 : 500), { error: error?.message ?? String(error) });
  }
});

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid --port: ${port}`);
await fs.mkdir(runsRoot, { recursive: true });
const existingRuns = await listAllRuns();
const interruptedStatuses = new Set([
  "normalizing", "running", "awaiting-visual-approval", "awaiting-native-preview-approval",
]);
for (const existingRun of existingRuns) {
  if (!interruptedStatuses.has(existingRun.status)) continue;
  // 仓库证据目录里的记录不在 runsRoot 里，也不可能处于"进行中"；只处理工作台自己的运行。
  const targetRunDir = path.join(runsRoot, existingRun.runId);
  if (!(await exists(path.join(targetRunDir, "summary.json")))) continue;
  const resumable = existingRun.pipeline === "runner";
  await writeSummary(targetRunDir, {
    ...existingRun,
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: {
      name: "WorkbenchProcessInterrupted",
      code: "WORKBENCH_PROCESS_INTERRUPTED",
      stage: existingRun.status,
      // 运行器的状态在 state.json 里，和旧线的内存检查点不是一回事：前者能续跑，后者只能重来。
      message: resumable
        ? "工作台进程在任务完成前中断。这次运行的状态在 state.json 里没有丢，可用 node src/runner/run.mjs --run-dir <该运行目录> --resume 续跑"
        : "工作台进程在任务完成前中断；该任务不能从内存检查点恢复，请新建任务重试",
    },
    ...(resumable ? { resumable: true } : {}),
  });
}
server.listen(port, host, () => process.stdout.write(`http://${host}:${port}/\n`));

export { currentRunPath, projectRoot, runsRoot, server };

if (process.argv[1] && path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) {
  // Imported by the SEA worker; the listener above is still intentional.
}
