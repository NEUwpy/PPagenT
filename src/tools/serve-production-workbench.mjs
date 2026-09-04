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
const currentRunPath = path.join(workbenchRoot, "current-run.json");
const maxUploadBytes = 30 * 1024 * 1024;
const runtimeRevision = process.env.PPAGENT_RUNTIME_REVISION || "source-direct";
const serverStartedAt = new Date().toISOString();
let activeRunId = null;
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
  return readJsonState(path.join(targetRunDir, "summary.json"));
}

async function listAllRuns() {
  await fs.mkdir(runsRoot, { recursive: true });
  const entries = await fs.readdir(runsRoot, { withFileTypes: true });
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try { summaries.push(await readSummary(path.join(runsRoot, entry.name))); } catch {}
  }
  return summaries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
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
  const activeTargets = uniqueRunIds.filter((runId) => !runIsDeletable(runId));
  if (activeTargets.length) {
    const error = new Error("仍在计算或交付的记录不能删除；等待确认的记录可以直接取消并删除");
    error.statusCode = 409;
    error.activeRunIds = activeTargets;
    throw error;
  }
  for (const runId of uniqueRunIds) await cancelAwaitingRun(runId);
  const targets = uniqueRunIds.map((runId) => ({ runId, targetRunDir: checkedRunDir(runId) }));
  await Promise.all(targets.map(({ targetRunDir }) => readSummary(targetRunDir)));
  let currentPointer = null;
  try { currentPointer = JSON.parse(await fs.readFile(currentRunPath, "utf8")); } catch {}
  for (const { targetRunDir } of targets) {
    await fs.rm(targetRunDir, { recursive: true, force: false });
  }
  const remainingRuns = await listAllRuns();
  const deletedCurrent = uniqueRunIds.includes(currentPointer?.runId);
  if (deletedCurrent) {
    if (remainingRuns[0]) await writeCurrentRunPointer(runDir(remainingRuns[0].runId), remainingRuns[0]);
    else await fs.rm(currentRunPath, { force: true });
  }
  return {
    deletedRunIds: uniqueRunIds,
    currentRunId: deletedCurrent ? (remainingRuns[0]?.runId ?? null) : currentPointer?.runId ?? null,
  };
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

async function createRun(request, response, url) {
  if (activeRunId) return sendJson(response, 409, { error: "已有生成任务正在运行", activeRunId });
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
    const task = executeRun(targetRunDir, summary, normalizedPath, recorder);
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
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".json": "application/json; charset=utf-8",
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
      return sendJson(response, 200, await readJsonState(currentRunPath));
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
      const targetRunDir = runDir(match[1]);
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
  await writeSummary(runDir(existingRun.runId), {
    ...existingRun,
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: {
      name: "WorkbenchProcessInterrupted",
      code: "WORKBENCH_PROCESS_INTERRUPTED",
      stage: existingRun.status,
      message: "工作台进程在任务完成前中断；该任务不能从内存检查点恢复，请新建任务重试",
    },
  });
}
server.listen(port, host, () => process.stdout.write(`http://${host}:${port}/\n`));

export { currentRunPath, projectRoot, runsRoot, server };

if (process.argv[1] && path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) {
  // Imported by the SEA worker; the listener above is still intentional.
}
