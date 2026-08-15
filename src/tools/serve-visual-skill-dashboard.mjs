import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  collectVisualSkillDashboardData,
  defaultProjectRoot,
  resolveComponentPreview,
  resolvePreviewDeck,
  resolveSourceSlide,
} from "./visual-skill-dashboard-data.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const projectRoot = path.resolve(option("--root", defaultProjectRoot));
const port = Number(option("--port", process.env.PPAGENT_DASHBOARD_PORT ?? 4192));
const host = "127.0.0.1";
const templatePath = path.join(import.meta.dirname, "templates", "visual-skill-dashboard.html");
const renderToolPath = path.join(import.meta.dirname, "render-pptx-evidence.mjs");
const renderSourceToolPath = path.join(import.meta.dirname, "render-pptx-slide-evidence.mjs");
const cacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-previews");
const sourceCacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-source-previews");
const renderJobs = new Map();
const renderQueue = [];
let activeRenderCount = 0;
const maxConcurrentRenders = 2;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`invalid --port: ${port}`);
}

function send(response, status, body, contentType, headers = {}) {
  response.writeHead(status, {
    "content-type": contentType,
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), "application/json; charset=utf-8", {
    "cache-control": "no-store",
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function runRenderer(deckPath, outputDir) {
  return new Promise((resolve, reject) => {
    const dashboardExecutable = process.env.PPAGENT_DASHBOARD_EXE;
    const executable = dashboardExecutable || process.execPath;
    const args = dashboardExecutable
      ? ["--render-preview", deckPath, outputDir, "--root", projectRoot]
      : [renderToolPath, deckPath, outputDir];
    const child = spawn(executable, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`preview renderer exited with ${code}: ${stderr || stdout}`));
    });
  });
}

function runSourceRenderer(deckPath, slideNumber, outputPath) {
  return new Promise((resolve, reject) => {
    const dashboardExecutable = process.env.PPAGENT_DASHBOARD_EXE;
    const executable = dashboardExecutable || process.execPath;
    const args = dashboardExecutable
      ? ["--render-source-slide", deckPath, String(slideNumber), outputPath, "--root", projectRoot]
      : [renderSourceToolPath, deckPath, String(slideNumber), outputPath];
    const child = spawn(executable, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`source preview renderer exited with ${code}: ${stderr || stdout}`));
    });
  });
}

function withRenderSlot(task) {
  return new Promise((resolve, reject) => {
    const start = async () => {
      activeRenderCount += 1;
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      } finally {
        activeRenderCount -= 1;
        renderQueue.shift()?.();
      }
    };
    if (activeRenderCount < maxConcurrentRenders) start();
    else renderQueue.push(start);
  });
}

async function previewPathFor(library, assetId) {
  const resolved = await resolvePreviewDeck(projectRoot, library, assetId);
  if (!resolved) return null;

  const cacheKey = crypto.createHash("sha256").update(`${library}\0${assetId}`).digest("hex").slice(0, 20);
  const outputDir = path.join(cacheRoot, cacheKey);
  const previewPath = path.join(outputDir, "slide-01.png");
  const deckStat = await fs.stat(resolved.deckPath);
  let previewStat = null;
  try {
    previewStat = await fs.stat(previewPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (!previewStat || previewStat.mtimeMs < deckStat.mtimeMs) {
    const jobKey = `${library}:${assetId}`;
    if (!renderJobs.has(jobKey)) {
      renderJobs.set(jobKey, withRenderSlot(async () => {
        await fs.mkdir(outputDir, { recursive: true });
        await runRenderer(resolved.deckPath, outputDir);
      }).finally(() => renderJobs.delete(jobKey)));
    }
    await renderJobs.get(jobKey);
  }

  return previewPath;
}

async function sourcePreviewPathFor(library, assetId, requestedSlide) {
  const resolved = await resolveSourceSlide(projectRoot, library, assetId, requestedSlide);
  if (!resolved) return null;
  const cacheKey = crypto.createHash("sha256")
    .update(`${resolved.deckPath}\0${resolved.slideNumber}`)
    .digest("hex")
    .slice(0, 20);
  const previewPath = path.join(sourceCacheRoot, `${cacheKey}.png`);
  const deckStat = await fs.stat(resolved.deckPath);
  let previewStat = null;
  try {
    previewStat = await fs.stat(previewPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!previewStat || previewStat.mtimeMs < deckStat.mtimeMs) {
    const jobKey = `source:${cacheKey}`;
    if (!renderJobs.has(jobKey)) {
      renderJobs.set(jobKey, withRenderSlot(async () => {
        await fs.mkdir(sourceCacheRoot, { recursive: true });
        await runSourceRenderer(resolved.deckPath, resolved.slideNumber, previewPath);
      }).finally(() => renderJobs.delete(jobKey)));
    }
    await renderJobs.get(jobKey);
  }
  return previewPath;
}

async function componentPreviewHtml(library, assetId, requestedState) {
  const resolved = await resolveComponentPreview(projectRoot, library, assetId);
  if (!resolved) return null;
  const entryStat = await fs.stat(resolved.entryPath);
  const moduleUrl = `${pathToFileURL(resolved.entryPath).href}?dashboard=${entryStat.mtimeMs}`;
  const module = await import(moduleUrl);
  const component = module[resolved.record.componentExport];
  const previewParameters = structuredClone(module[resolved.record.previewParametersExport]);
  if (!component?.renderMarkup || !previewParameters) return null;

  const states = resolved.record.componentStates ?? [];
  const state = requestedState === null || requestedState === ""
    ? resolved.record.componentInitialState
    : Number(requestedState);
  if (!Number.isInteger(state) || !states.includes(state)) return null;
  if (Array.isArray(previewParameters.items)) {
    if (previewParameters.items.length < state) return null;
    previewParameters.items = previewParameters.items.slice(0, state);
  }

  const cssPath = path.resolve(resolved.assetDir, component.cssFile ?? "component.css");
  const relativeCssPath = path.relative(resolved.assetDir, cssPath);
  if (relativeCssPath.startsWith("..") || path.isAbsolute(relativeCssPath)) return null;
  const css = await fs.readFile(cssPath, "utf8");
  const markup = component.renderMarkup(previewParameters);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(resolved.record.name)} · ${state}项</title><style>${css}</style></head><body>${markup}</body></html>`;
}

async function serveDashboard(response) {
  const template = await fs.readFile(templatePath, "utf8");
  const bootstrap = `const DATA = await fetch("/api/dashboard-data", { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error("看板数据读取失败：" + response.status); return response.json(); });`;
  const html = template.replace("/*__PPAGENT_DATA__*/", bootstrap);
  send(response, 200, html, "text/html; charset=utf-8", { "cache-control": "no-store" });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      await serveDashboard(response);
      return;
    }
    if (url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", root: projectRoot, pid: process.pid });
      return;
    }
    if (url.pathname === "/api/dashboard-data") {
      const data = await collectVisualSkillDashboardData(projectRoot);
      sendJson(response, 200, data);
      return;
    }
    if (url.pathname === "/api/asset-preview") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const previewPath = await previewPathFor(library, assetId);
      if (!previewPath) {
        sendJson(response, 404, { error: "preview_not_found" });
        return;
      }
      send(response, 200, await fs.readFile(previewPath), "image/png", {
        "cache-control": "no-cache",
      });
      return;
    }
    if (url.pathname === "/api/source-preview") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const previewPath = await sourcePreviewPathFor(library, assetId, url.searchParams.get("slide"));
      if (!previewPath) {
        sendJson(response, 404, { error: "source_preview_not_found" });
        return;
      }
      send(response, 200, await fs.readFile(previewPath), "image/png", { "cache-control": "no-cache" });
      return;
    }
    if (url.pathname === "/api/component-preview") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const html = await componentPreviewHtml(library, assetId, url.searchParams.get("state"));
      if (!html) {
        sendJson(response, 404, { error: "component_preview_not_found" });
        return;
      }
      send(response, 200, html, "text/html; charset=utf-8", {
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "dashboard_error", message: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`PPagenT Visual Skill 实时看板：http://${host}:${port}/`);
  console.log(`仓库根目录：${projectRoot}`);
  console.log("页面每次加载都会重新读取仓库清单；PPT 示例在首次查看时按需渲染并缓存。");
});
