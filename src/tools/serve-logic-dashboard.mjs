import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectLogicDashboardData,
  defaultProjectRoot,
  resolveComponentPreview,
  resolveNativeStatePreview,
  resolvePreviewDeck,
  resolveSourceSlide,
} from "./logic-dashboard-data.mjs";
import { northeasternUniversityTheme } from "../runtime/skins/northeastern-university-theme.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const projectRoot = path.resolve(option("--root", defaultProjectRoot));
const port = Number(option("--port", process.env.PPAGENT_DASHBOARD_PORT ?? 4192));
const host = "127.0.0.1";
const templatePath = path.join(import.meta.dirname, "templates", "logic-dashboard.html");
const renderToolPath = path.join(import.meta.dirname, "render-pptx-evidence.mjs");
const renderSourceToolPath = path.join(import.meta.dirname, "render-pptx-slide-evidence.mjs");
const renderSourcePowerPointPath = path.join(import.meta.dirname, "render-pptx-slide-powerpoint.ps1");
const dashboardServerPath = fileURLToPath(import.meta.url);
const cacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-previews");
const sourceCacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-source-previews");
const nativeStateCacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-native-state-previews");
const skinStateCacheRoot = path.join(projectRoot, ".tmp", "asset-dashboard-skin-state-previews");
const renderJobs = new Map();
const renderQueue = [];
let activeRenderCount = 0;
const maxConcurrentRenders = 2;
const immutablePreviewHeaders = { "cache-control": "private, max-age=31536000, immutable" };

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
  const designWidth = Number(component.designFrame?.width);
  const designHeight = Number(component.designFrame?.height);
  if (!Number.isFinite(designWidth) || !Number.isFinite(designHeight) || designWidth <= 0 || designHeight <= 0) return null;
  const { htmlComponentThemeCss } = await import("../visual-runtime/html-component-runtime.mjs");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(resolved.record.name)} · ${escapeHtml(stateLabel)}</title><style>${htmlComponentThemeCss(northeasternUniversityTheme)}${css}
html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important}
body{position:relative!important;background:#fff!important}
.ppagent-component-viewport{position:absolute;inset:0;overflow:hidden;background:#fff}
.ppagent-component-scale{--ppagent-preview-scale:min(calc((100vw - 4px) / ${designWidth}px),calc((100vh - 4px) / ${designHeight}px));position:absolute;left:50%;top:50%;width:${designWidth}px;height:${designHeight}px;margin-left:${-designWidth / 2}px;margin-top:${-designHeight / 2}px;transform:scale(var(--ppagent-preview-scale));transform-origin:center center}
[data-slot-id]{outline:0 solid transparent;outline-offset:2px;transition:outline-color .12s ease,background-color .12s ease}
[data-slot-id]:hover{z-index:50!important;outline:2px dashed rgba(35,117,220,.9);background-color:rgba(61,145,238,.12)!important}
[data-slot-role="icon"]:hover{outline-color:rgba(255,255,255,.98);background-color:rgba(255,255,255,.22)!important}
[data-slot-id]::after{content:attr(data-slot-role) " · " attr(data-slot-field);position:absolute;left:3px;bottom:3px;z-index:100;display:none;max-width:calc(100% - 6px);padding:3px 6px;overflow:hidden;border-radius:4px;color:#fff;background:rgba(23,32,51,.86);font:12px/1.25 "Microsoft YaHei",sans-serif;white-space:nowrap;text-overflow:ellipsis;pointer-events:none}
[data-slot-id]:hover::after{display:block}
.ppagent-slot-visual-layer{position:absolute;inset:0;z-index:999;pointer-events:none}
.ppagent-slot-visual-box{position:absolute;pointer-events:auto;border:1px dashed rgba(35,117,220,.22);background:rgba(61,145,238,.025);transition:border-color .12s ease,background-color .12s ease}
.ppagent-slot-visual-box.icon{border-color:rgba(118,80,189,.28)}
.ppagent-slot-visual-box:hover{border:2px dashed rgba(35,117,220,.92);background:rgba(61,145,238,.16)}
.ppagent-slot-visual-box::after{content:attr(data-slot-label);position:absolute;left:3px;bottom:3px;display:none;max-width:calc(100% - 6px);padding:3px 6px;overflow:hidden;border-radius:4px;color:#fff;background:rgba(23,32,51,.86);font:12px/1.25 "Microsoft YaHei",sans-serif;white-space:nowrap;text-overflow:ellipsis}
.ppagent-slot-visual-box:hover::after{display:block}
</style></head><body><div class="ppagent-component-viewport"><div class="ppagent-component-scale">${markup}</div></div><script>
addEventListener("load",async()=>{await document.fonts.ready;const scale=document.querySelector(".ppagent-component-scale");const root=document.querySelector("[data-ppt-root]");if(!scale||!root)return;const rootBox=root.getBoundingClientRect();if(!rootBox.width||!rootBox.height)return;const layer=document.createElement("div");layer.className="ppagent-slot-visual-layer";for(const element of root.querySelectorAll("[data-slot-id]")){const box=element.getBoundingClientRect();if(!box.width||!box.height)continue;const marker=document.createElement("i");marker.className="ppagent-slot-visual-box"+(element.dataset.slotRole==="icon"?" icon":"");marker.dataset.slotLabel=(element.dataset.slotRole||"content")+" · "+(element.dataset.slotField||element.dataset.slotId);marker.style.left=(box.left-rootBox.left)/rootBox.width*100+"%";marker.style.top=(box.top-rootBox.top)/rootBox.height*100+"%";marker.style.width=box.width/rootBox.width*100+"%";marker.style.height=box.height/rootBox.height*100+"%";layer.append(marker)}scale.append(layer)});
</script></body></html>`;
}

async function nativeStateArtifactsFor(library, assetId, searchParams) {
  const resolved = await resolveNativeStatePreview(projectRoot, library, assetId);
  if (!resolved) return null;
  const selection = selectedControls(resolved.record, searchParams);
  const selectionKey = JSON.stringify(selection);
  const cacheKey = crypto.createHash("sha256").update(`${library}\0${assetId}\0${selectionKey}`).digest("hex").slice(0, 20);
  const previewPath = path.join(nativeStateCacheRoot, `${cacheKey}.png`);
  const pptxPath = path.join(nativeStateCacheRoot, `${cacheKey}.pptx`);
  const cssPath = path.join(resolved.assetDir, "component.css");
  const htmlRuntimePath = path.join(projectRoot, "src", "visual-runtime", "html-component-runtime.mjs");
  const themePath = path.join(projectRoot, "src", "runtime", "skins", "northeastern-university-theme.mjs");
  const [reviewStat, runtimeStat, cssStat, htmlRuntimeStat, themeStat] = await Promise.all([
    fs.stat(resolved.entryPath), fs.stat(resolved.runtimeEntryPath), fs.stat(cssPath), fs.stat(htmlRuntimePath), fs.stat(themePath),
  ]);
  const [previewStat, pptxStat] = await Promise.all([previewPath, pptxPath].map(async (target) => {
    try { return await fs.stat(target); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }));
  const inputMtime = Math.max(reviewStat.mtimeMs, runtimeStat.mtimeMs, cssStat.mtimeMs, htmlRuntimeStat.mtimeMs, themeStat.mtimeMs);
  if (!previewStat || !pptxStat || previewStat.mtimeMs < inputMtime || pptxStat.mtimeMs < inputMtime) {
    const jobKey = `native:${cacheKey}`;
    if (!renderJobs.has(jobKey)) {
      renderJobs.set(jobKey, withRenderSlot(async () => {
        const reviewModule = await loadReviewModule(resolved);
        const parameters = resolveReviewParameters(resolved, reviewModule, selection);
        const runtimeModule = await import(`${pathToFileURL(resolved.runtimeEntryPath).href}?dashboard=${runtimeStat.mtimeMs}`);
        if (!parameters) throw new Error("Native 审查参数不完整");
        const { createPresentation } = await import("../asset-runtime/component-builders.mjs");
        const presentation = createPresentation();
        const slide = presentation.slides.add();
        slide.background.fill = "#FFFFFF";
        const previewFrame = resolved.record.spatialContract?.contentFrame ?? { left: 55, top: 166, width: 1170, height: 492 };
        if (resolved.record.renderer === "html-component") {
          const component = runtimeModule[resolved.record.componentExport] ?? reviewModule[resolved.record.componentExport];
          if (!component?.renderMarkup) throw new Error("HTML Component 审查入口不完整");
          const { compileResolvedVisualTree, resolveHtmlComponent } = await import("../visual-runtime/html-component-runtime.mjs");
          const tree = await resolveHtmlComponent({ component, parameters, assetDir: resolved.assetDir, targetFrame: previewFrame, theme: northeasternUniversityTheme });
          compileResolvedVisualTree(slide, tree, previewFrame);
        } else {
          const builder = runtimeModule[resolved.record.builderExport];
          if (typeof builder !== "function") throw new Error("Native Builder 审查入口不完整");
          const { renderComponentIntoSlide } = await import("../asset-runtime/component-builders.mjs");
          renderComponentIntoSlide(builder, slide, parameters, {
            sourceFrame: resolved.record.spatialContract?.contentFrame ?? { left: 40, top: 135, width: 1200, height: 520 },
            targetFrame: previewFrame,
            theme: {},
          });
        }
        const image = await presentation.export({ slide, format: "png", scale: 1 });
        await fs.mkdir(nativeStateCacheRoot, { recursive: true });
        await fs.writeFile(previewPath, Buffer.from(await image.arrayBuffer()));
        const { PresentationFile } = await import("@oai/artifact-tool");
        const pptx = await PresentationFile.exportPptx(presentation);
        await pptx.save(pptxPath);
      }).finally(() => renderJobs.delete(jobKey)));
    }
    await renderJobs.get(jobKey);
  }
  return { previewPath, pptxPath, selection };
}

async function runSkinRenderer(deckPath, outputDir) {
  if (process.platform === "win32") {
    try {
      await runSourceRendererProcess("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden",
        "-ExecutionPolicy", "Bypass", "-File", renderSourcePowerPointPath,
        "-InputPath", deckPath,
        "-SlideNumber", "1",
        "-OutputPath", path.join(outputDir, "slide-01.png"),
      ]);
      return;
    } catch {
      // Continue with the portable renderer when desktop PowerPoint is absent.
    }
  }
  await runRenderer(deckPath, outputDir);
}

async function skinStateArtifactsFor(library, assetId, searchParams) {
  const resolved = await resolveNativeStatePreview(projectRoot, library, assetId);
  if (!resolved || resolved.record.renderer === "skin") return null;
  const selection = selectedControls(resolved.record, searchParams);
  const selectionKey = JSON.stringify(selection);
  const cacheKey = crypto.createHash("sha256").update(`northeastern-university\0${library}\0${assetId}\0${selectionKey}`).digest("hex").slice(0, 20);
  const outputDir = path.join(skinStateCacheRoot, cacheKey);
  const previewPath = path.join(outputDir, "slide-01.png");
  const pptxPath = path.join(outputDir, `${assetId}.pptx`);
  const sourcePptx = path.join(projectRoot, "PPT源", "PPT模板-封面正文尾页.pptx");
  const skinEntryPath = path.join(projectRoot, "src", "runtime", "skins", "northeastern-university.mjs");
  const cssPath = path.join(resolved.assetDir, "component.css");
  const htmlRuntimePath = path.join(projectRoot, "src", "visual-runtime", "html-component-runtime.mjs");
  const assetRuntimePath = path.join(projectRoot, "src", "runtime", "assets.mjs");
  const themePath = path.join(projectRoot, "src", "runtime", "skins", "northeastern-university-theme.mjs");
  const inputStats = await Promise.all([
    fs.stat(resolved.entryPath),
    fs.stat(resolved.runtimeEntryPath),
    fs.stat(sourcePptx),
    fs.stat(skinEntryPath),
    fs.stat(cssPath),
    fs.stat(htmlRuntimePath),
    fs.stat(assetRuntimePath),
    fs.stat(themePath),
  ]);
  const inputMtime = Math.max(...inputStats.map((item) => item.mtimeMs));
  const dashboardStat = await fs.stat(dashboardServerPath);
  const [previewStat, pptxStat] = await Promise.all([previewPath, pptxPath].map(async (target) => {
    try { return await fs.stat(target); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }));
  const needsPptx = !pptxStat || pptxStat.mtimeMs < inputMtime;
  const needsPreview = !previewStat || needsPptx
    || previewStat.mtimeMs < Math.max(pptxStat?.mtimeMs ?? 0, dashboardStat.mtimeMs);
  if (needsPptx || needsPreview) {
    const jobKey = `skin:${cacheKey}`;
    if (!renderJobs.has(jobKey)) {
      renderJobs.set(jobKey, withRenderSlot(async () => {
        await fs.mkdir(outputDir, { recursive: true });
        if (needsPptx) {
          const reviewModule = await loadReviewModule(resolved);
          const parameters = resolveReviewParameters(resolved, reviewModule, selection);
          if (!parameters) throw new Error("Skin 审查参数不完整");
          const skinStat = await fs.stat(skinEntryPath);
          const { renderNortheasternUniversityDeck } = await import(`${pathToFileURL(skinEntryPath).href}?dashboard=${skinStat.mtimeMs}`);
          const runtimeModule = await import(`${pathToFileURL(resolved.runtimeEntryPath).href}?dashboard=${inputMtime}`);
          const structureRenderer = resolved.record.renderer === "html-component"
            ? async (slide, payload, skin, targetFrame = skin.bodyFrame) => {
                const component = runtimeModule[resolved.record.componentExport] ?? reviewModule[resolved.record.componentExport];
                if (!component?.renderMarkup) throw new Error("HTML Component Skin 审查入口不完整");
                const { compileResolvedVisualTree, resolveHtmlComponent } = await import("../visual-runtime/html-component-runtime.mjs");
                const tree = await resolveHtmlComponent({
                  component,
                  parameters: payload.parameters,
                  assetDir: resolved.assetDir,
                  targetFrame,
                  theme: skin.componentTheme,
                });
                return compileResolvedVisualTree(slide, tree, targetFrame);
              }
            : undefined;
          await renderNortheasternUniversityDeck({
            pages: [{
              content: { pageId: `dashboard-${assetId}`, title: parameters.title || resolved.record.name, items: [] },
              meta: { sectionName: "结构图" },
              payload: { assetId, parameters },
              composition: null,
              intent: { intentId: `dashboard-${assetId}` },
              decision: { selectedAssetId: assetId },
            }],
            sourcePptx,
            outputPptx: pptxPath,
            qaDir: null,
            manuscriptSource: "PPA 看板 State 预览",
            ...(structureRenderer ? { structureRenderer } : {}),
          });
        }
        if (needsPreview) await runSkinRenderer(pptxPath, outputDir);
      }).finally(() => renderJobs.delete(jobKey)));
    }
    await renderJobs.get(jobKey);
  }
  return { previewPath, pptxPath, selection };
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
      const data = await collectLogicDashboardData(projectRoot);
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
        ...immutablePreviewHeaders,
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
      send(response, 200, await fs.readFile(previewPath), "image/png", immutablePreviewHeaders);
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
        ...immutablePreviewHeaders,
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      });
      return;
    }
    if (url.pathname === "/api/native-state-preview") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const artifacts = await nativeStateArtifactsFor(library, assetId, url.searchParams);
      if (!artifacts) {
        sendJson(response, 404, { error: "native_state_preview_not_found" });
        return;
      }
      send(response, 200, await fs.readFile(artifacts.previewPath), "image/png", immutablePreviewHeaders);
      return;
    }
    if (url.pathname === "/api/native-state-pptx") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const artifacts = await nativeStateArtifactsFor(library, assetId, url.searchParams);
      if (!artifacts) {
        sendJson(response, 404, { error: "native_state_pptx_not_found" });
        return;
      }
      const fileName = encodeURIComponent(`${assetId}-${Object.values(artifacts.selection).join("-") || "default"}.pptx`);
      send(response, 200, await fs.readFile(artifacts.pptxPath), "application/vnd.openxmlformats-officedocument.presentationml.presentation", {
        "cache-control": "no-cache",
        "content-disposition": `attachment; filename*=UTF-8''${fileName}`,
      });
      return;
    }
    if (url.pathname === "/api/skin-state-preview") {
      const library = url.searchParams.get("library") ?? "";
      const assetId = url.searchParams.get("id") ?? "";
      const artifacts = await skinStateArtifactsFor(library, assetId, url.searchParams);
      if (!artifacts) {
        sendJson(response, 404, { error: "skin_state_preview_not_found" });
        return;
      }
      send(response, 200, await fs.readFile(artifacts.previewPath), "image/png", immutablePreviewHeaders);
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "dashboard_error", message: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`PPagenT Logic 实时看板：http://${host}:${port}/`);
  console.log(`仓库根目录：${projectRoot}`);
  console.log("页面每次加载都会重新读取仓库清单；PPT 示例在首次查看时按需渲染并缓存。");
});
