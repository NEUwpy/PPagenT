import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeManuscript, supportedManuscriptExtensions } from "../workbench/manuscript-normalizer.mjs";
import { createTraceRecorder, readTraceEvents } from "../workbench/trace-recorder.mjs";

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
let activeRunId = null;

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
  await fs.writeFile(path.join(targetRunDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const relativeRunDir = path.relative(projectRoot, targetRunDir).replaceAll("\\", "/");
  const pointer = {
    schemaVersion: "1.0",
    runId: summary.runId,
    status: summary.status,
    originalName: summary.originalName,
    active: ["normalizing", "running"].includes(summary.status),
    runDir: relativeRunDir,
    summary: `${relativeRunDir}/summary.json`,
    events: `${relativeRunDir}/events.jsonl`,
    traceDir: `${relativeRunDir}/trace`,
    normalizedManuscript: `${relativeRunDir}/input/normalized.md`,
    workflowDir: `${relativeRunDir}/workflow`,
    deliveryDir: `${relativeRunDir}/delivery`,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(workbenchRoot, { recursive: true });
  await fs.writeFile(currentRunPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
}

async function readSummary(targetRunDir) {
  return JSON.parse(await fs.readFile(path.join(targetRunDir, "summary.json"), "utf8"));
}

async function listRuns() {
  await fs.mkdir(runsRoot, { recursive: true });
  const entries = await fs.readdir(runsRoot, { withFileTypes: true });
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try { summaries.push(await readSummary(path.join(runsRoot, entry.name))); } catch {}
  }
  return summaries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
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
      providerInstance: provider,
      providerLabel: "configured-deepseek-provider",
      observer: recorder.observe,
      mode: "production",
      python: "",
      "overflow-tool": "",
    });
    const artifacts = [
      { label: "可编辑 PPTX", kind: "pptx", path: relativeArtifact(targetRunDir, result.outputPptx) },
      { label: "规范化 Markdown", kind: "markdown", path: relativeArtifact(targetRunDir, normalizedPath) },
      { label: "运行结果", kind: "json", path: "workflow/workflow-result.json" },
      { label: "生产统计", kind: "json", path: "workflow/production-statistics.json" },
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
      },
    });
    summary.status = "succeeded";
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt;
    summary.pageCount = result.pageCount;
    summary.deliveryStatus = result.deliveryStatus ?? result.status;
    summary.assetGapReport = result.assetGapReport;
    summary.productionStatistics = result.productionStatistics;
    summary.artifacts = artifacts;
  } catch (error) {
    await recorder.observe({
      source: "workbench", type: "delivery", status: "failed", stage: error?.stage ?? "delivery",
      durationMs: Date.now() - startedAt,
      error: { name: error?.name, code: error?.code, message: error?.message ?? String(error), details: error?.details },
    });
    summary.status = "failed";
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt;
    summary.error = { name: error?.name, code: error?.code, stage: error?.stage, message: error?.message ?? String(error), details: error?.details };
  } finally {
    await recorder.flush();
    await writeSummary(targetRunDir, summary);
    activeRunId = null;
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
    artifacts: [],
  };
  await writeSummary(targetRunDir, summary);
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
    activeRunId = runId;
    executeRun(targetRunDir, summary, normalizedPath, recorder);
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
    return sendJson(response, 422, summary);
  }
}

function contentTypeFor(target) {
  const extension = path.extname(target).toLowerCase();
  return ({
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
  return {
    app: "PPagenT 正式生成工作台",
    skin: { id: "northeastern-university-001", name: "东北大学" },
    provider: { name: "DeepSeek", model: process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash", configured: Boolean(process.env.DEEPSEEK_API_KEY || local.apiKey) },
    formats: supportedManuscriptExtensions,
    maxUploadBytes,
    activeRunId,
  };
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { status: "ok", app: "ppagent-production-workbench", root: projectRoot, pid: process.pid });
    }
    if (request.method === "GET" && url.pathname === "/") {
      return send(response, 200, await fs.readFile(templatePath), "text/html; charset=utf-8", { "cache-control": "no-store" });
    }
    if (request.method === "GET" && url.pathname === "/api/workbench/config") return sendJson(response, 200, await publicConfig());
    if (request.method === "GET" && url.pathname === "/api/workbench/current") {
      return send(response, 200, await fs.readFile(currentRunPath), "application/json; charset=utf-8", { "cache-control": "no-store" });
    }
    if (request.method === "GET" && url.pathname === "/api/workbench/runs") return sendJson(response, 200, { runs: await listRuns(), activeRunId });
    if (request.method === "POST" && url.pathname === "/api/workbench/runs") return await createRun(request, response, url);
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
const existingRuns = await listRuns();
if (existingRuns[0]) await writeSummary(runDir(existingRuns[0].runId), existingRuns[0]);
server.listen(port, host, () => process.stdout.write(`http://${host}:${port}/\n`));

export { currentRunPath, projectRoot, runsRoot, server };

if (process.argv[1] && path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) {
  // Imported by the SEA worker; the listener above is still intentional.
}
