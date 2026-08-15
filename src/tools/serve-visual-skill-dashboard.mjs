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
  resolveNativeStatePreview,
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
const renderSourcePowerPointPath = path.join(import.meta.dirname, "render-pptx-slide-powerpoint.ps1");
const cacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-previews");
const sourceCacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-source-previews");
const nativeStateCacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-native-state-previews");
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

function runSourceRendererProcess(executable, args) {
  return new Promise((resolve, reject) => {
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

async function runSourceRenderer(deckPath, slideNumber, outputPath) {
  if (process.platform === "win32") {
    try {
      await runSourceRendererProcess("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden",
        "-ExecutionPolicy", "Bypass", "-File", renderSourcePowerPointPath,
        "-InputPath", deckPath,
        "-SlideNumber", String(slideNumber),
        "-OutputPath", outputPath,
      ]);
      return;
    } catch {
      // PowerPoint is an optional fast path. Keep the portable Artifact Tool
      // renderer as the fallback for machines without desktop Office.
    }
  }
  const dashboardExecutable = process.env.PPAGENT_DASHBOARD_EXE;
  const executable = dashboardExecutable || process.execPath;
  const args = dashboardExecutable
    ? ["--render-source-slide", deckPath, String(slideNumber), outputPath, "--root", projectRoot]
    : [renderSourceToolPath, deckPath, String(slideNumber), outputPath];
  await runSourceRendererProcess(executable, args);
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

function selectedControls(record, searchParams) {
  return Object.fromEntries((record.componentControls ?? []).map((control) => {
    const requested = searchParams.get(control.key);
    const value = control.values.find((candidate) => String(candidate) === requested);
    return [control.key, value ?? record.componentInitialSelection?.[control.key] ?? control.values[0]];
  }));
}

async function loadReviewModule(resolved) {
  const entryStat = await fs.stat(resolved.entryPath);
  return import(`${pathToFileURL(resolved.entryPath).href}?dashboard=${entryStat.mtimeMs}`);
}

function resolveReviewParameters(resolved, module, selection) {
  const previewParameters = structuredClone(module[resolved.record.previewParametersExport]);
  if (!previewParameters) return null;
  const resolver = resolved.record.previewResolverExport
    ? module[resolved.record.previewResolverExport]
    : null;
  if (resolver) return resolver(previewParameters, selection);
  const singleControl = resolved.record.componentControls?.[0];
  if (singleControl?.key === "itemCount" && Array.isArray(previewParameters.items)) {
    previewParameters.items = previewParameters.items.slice(0, selection.itemCount);
  }
  return previewParameters;
}

async function componentPreviewHtml(library, assetId, searchParams) {
  const resolved = await resolveComponentPreview(projectRoot, library, assetId);
  if (!resolved) return null;
  const module = await loadReviewModule(resolved);
  const component = module[resolved.record.componentExport];
  const selection = selectedControls(resolved.record, searchParams);
  const previewParameters = resolveReviewParameters(resolved, module, selection);
  if (!component?.renderMarkup || !previewParameters) return null;
  let css = component.cssText ?? "";
  if (!css) {
    const cssPath = path.resolve(resolved.assetDir, component.cssFile ?? "component.css");
    const relativeCssPath = path.relative(resolved.assetDir, cssPath);
    if (relativeCssPath.startsWith("..") || path.isAbsolute(relativeCssPath)) return null;
    css = await fs.readFile(cssPath, "utf8");
  }
  const markup = component.renderMarkup(previewParameters);
  const stateLabel = (resolved.record.componentControls ?? []).map((control) => `${control.label} ${selection[control.key]}`).join(" · ");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(resolved.record.name)} · ${escapeHtml(stateLabel)}</title><style>${css}</style></head><body>${markup}</body></html>`;
}

async function nativeStatePreviewPathFor(library, assetId, searchParams) {
  const resolved = await resolveNativeStatePreview(projectRoot, library, assetId);
  if (!resolved) return null;
  const selection = selectedControls(resolved.record, searchParams);
  const selectionKey = JSON.stringify(selection);
  const cacheKey = crypto.createHash("sha256").update(`${library}\0${assetId}\0${selectionKey}`).digest("hex").slice(0, 20);
  const outputPath = path.join(nativeStateCacheRoot, `${cacheKey}.png`);
  const [reviewStat, runtimeStat] = await Promise.all([fs.stat(resolved.entryPath), fs.stat(resolved.runtimeEntryPath)]);
  let outputStat = null;
  try { outputStat = await fs.stat(outputPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!outputStat || outputStat.mtimeMs < Math.max(reviewStat.mtimeMs, runtimeStat.mtimeMs)) {
    const jobKey = `native:${cacheKey}`;
    if (!renderJobs.has(jobKey)) {
      renderJobs.set(jobKey, withRenderSlot(async () => {
        const reviewModule = await loadReviewModule(resolved);
        const parameters = resolveReviewParameters(resolved, reviewModule, selection);
        const runtimeModule = await import(`${pathToFileURL(resolved.runtimeEntryPath).href}?dashboard=${runtimeStat.mtimeMs}`);
        const builder = runtimeModule[resolved.record.builderExport];
        if (!parameters || typeof builder !== "function") throw new Error("Native Builder 审查入口不完整");
        const { createPresentation } = await import("../asset-runtime/component-builders.mjs");
        const presentation = createPresentation();
        const slide = builder(presentation, parameters);
        const image = await presentation.export({ slide, format: "png", scale: 1 });
        await fs.mkdir(nativeStateCacheRoot, { recursive: true });
        await fs.writeFile(outputPath, Buffer.from(await image.arrayBuffer()));
      }).finally(() => renderJobs.delete(jobKey)));
    }
    await renderJobs.get(jobKey);
  }
  return outputPath;
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
      const html = await componentPreviewHtml(library, assetId, url.searchParams);
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
    if (url.pathname === "/api/native-state-preview") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const previewPath = await nativeStatePreviewPathFor(library, assetId, url.searchParams);
      if (!previewPath) {
        sendJson(response, 404, { error: "native_state_preview_not_found" });
        return;
      }
      send(response, 200, await fs.readFile(previewPath), "image/png", { "cache-control": "no-cache" });
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
