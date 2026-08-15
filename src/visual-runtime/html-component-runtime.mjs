import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const SCHEMA_VERSION = 1;
let browserPromise = null;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function browserCandidates() {
  const candidates = [process.env.BROWSER_EXECUTABLE_PATH].filter(Boolean);
  if (process.platform === "win32") {
    for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA].filter(Boolean)) {
      candidates.push(path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
      candidates.push(path.join(root, "Google", "Chrome", "Application", "chrome.exe"));
    }
  }
  return [...new Set(candidates)];
}

async function resolveBrowserExecutable() {
  for (const candidate of browserCandidates()) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("未找到可用浏览器；请安装 Edge/Chrome 或设置 BROWSER_EXECUTABLE_PATH");
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = resolveBrowserExecutable().then((executablePath) => chromium.launch({ headless: true, executablePath }));
  }
  return browserPromise;
}

function componentDocument(markup, css) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`;
}

function normalizeFrame(frame, label) {
  requireValue(frame && ["left", "top", "width", "height"].every((key) => Number.isFinite(frame[key])), `${label} 非法`);
  requireValue(frame.width > 0 && frame.height > 0, `${label} 的宽高必须大于 0`);
  return { left: frame.left, top: frame.top, width: frame.width, height: frame.height };
}

export async function resolveHtmlComponent({ component, parameters, assetDir, targetFrame }) {
  requireValue(component?.schemaVersion === SCHEMA_VERSION, `HTML Component schemaVersion 必须为 ${SCHEMA_VERSION}`);
  requireValue(typeof component.renderMarkup === "function", "HTML Component 缺少 renderMarkup");
  requireValue(typeof component.cssFile === "string" && component.cssFile, "HTML Component 缺少 cssFile");
  const frame = normalizeFrame(targetFrame, "targetFrame");
  const cssPath = path.resolve(assetDir, component.cssFile);
  const relativeCssPath = path.relative(path.resolve(assetDir), cssPath);
  requireValue(relativeCssPath && !relativeCssPath.startsWith("..") && !path.isAbsolute(relativeCssPath), "HTML Component cssFile 必须位于资产目录内");
  const css = await fs.readFile(cssPath, "utf8");
  const markup = component.renderMarkup(parameters);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: Math.round(frame.width), height: Math.round(frame.height) } });
  try {
    await page.setContent(componentDocument(markup, css), { waitUntil: "load" });
    const tree = await page.evaluate(async ({ width, height }) => {
      await document.fonts.ready;
      const root = document.querySelector("[data-ppt-root]");
      if (!root) throw new Error("HTML Component 缺少 data-ppt-root");
      const rootBox = root.getBoundingClientRect();
      const rounded = (value) => Math.round(value * 1000) / 1000;
      const color = (value) => {
        if (!value || value === "transparent") return "none";
        const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!match || Number(match[4] ?? 1) === 0) return "none";
        return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
      };
      const nodes = [...root.querySelectorAll("[data-ppt-kind]")].map((element, index) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const kind = element.dataset.pptKind;
        const nodeFrame = {
          left: rounded(box.left - rootBox.left),
          top: rounded(box.top - rootBox.top),
          width: rounded(box.width),
          height: rounded(box.height),
        };
        const base = { kind, name: element.dataset.pptName || `${kind}-${index}`, frame: nodeFrame, order: index };
        if (kind === "shape") {
          return {
            ...base,
            geometry: element.dataset.pptShape || (parseFloat(style.borderRadius) > 0 ? "roundRect" : "rect"),
            fill: color(style.backgroundColor),
            line: {
              fill: color(style.borderTopColor),
              width: rounded(parseFloat(style.borderTopWidth) || 0),
              style: style.borderTopStyle === "dashed" ? "dashed" : "solid",
            },
            shadow: element.dataset.pptShadow || "shadow-none",
          };
        }
        if (kind === "text") {
          return {
            ...base,
            text: element.textContent.replace(/\s+/g, " ").trim(),
            style: {
              fontFamily: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
              fontSize: rounded(parseFloat(style.fontSize)),
              bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
              italic: style.fontStyle === "italic",
              color: color(style.color),
              alignment: style.textAlign === "center" ? "center" : style.textAlign === "right" ? "right" : "left",
              verticalAlignment: element.dataset.pptValign || "middle",
            },
          };
        }
        throw new Error(`不支持的 data-ppt-kind: ${kind}`);
      });
      return {
        schemaVersion: 1,
        frame: { width: rounded(rootBox.width), height: rounded(rootBox.height) },
        viewport: { width, height },
        overflow: root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
        nodes,
      };
    }, { width: Math.round(frame.width), height: Math.round(frame.height) });
    requireValue(!tree.overflow, `${component.id ?? "HTML Component"} 超出 Content Frame`);
    requireValue(tree.nodes.length > 0, `${component.id ?? "HTML Component"} 没有可编译对象`);
    return { ...tree, componentId: component.id, targetFrame: frame };
  } finally {
    await page.close();
  }
}

function scaledFrame(nodeFrame, tree, targetFrame) {
  const scaleX = targetFrame.width / tree.frame.width;
  const scaleY = targetFrame.height / tree.frame.height;
  return {
    left: targetFrame.left + nodeFrame.left * scaleX,
    top: targetFrame.top + nodeFrame.top * scaleY,
    width: nodeFrame.width * scaleX,
    height: nodeFrame.height * scaleY,
  };
}

export function compileResolvedVisualTree(slide, tree, targetFrame = tree.targetFrame) {
  requireValue(tree?.schemaVersion === SCHEMA_VERSION, `ResolvedVisualTree schemaVersion 必须为 ${SCHEMA_VERSION}`);
  const frame = normalizeFrame(targetFrame, "targetFrame");
  requireValue(
    Math.abs(frame.width - tree.frame.width) <= 0.1 && Math.abs(frame.height - tree.frame.height) <= 0.1,
    "ResolvedVisualTree 必须按最终 Content Frame 求解，编译器不得二次拉伸布局",
  );
  const fontScale = Math.min(frame.width / tree.frame.width, frame.height / tree.frame.height);
  const rendered = [];
  for (const node of [...tree.nodes].sort((left, right) => left.order - right.order)) {
    const position = scaledFrame(node.frame, tree, frame);
    if (node.kind === "shape") {
      rendered.push(slide.shapes.add({
        geometry: node.geometry,
        name: node.name,
        position,
        fill: node.fill,
        line: node.line.width > 0 ? node.line : { style: "solid", fill: "none", width: 0 },
        shadow: node.shadow,
        ...(node.geometry === "roundRect" ? { borderRadius: "rounded-xl" } : {}),
      }));
      continue;
    }
    if (node.kind === "text") {
      const shape = slide.shapes.add({
        geometry: "textbox",
        name: node.name,
        position,
        fill: "none",
        line: { style: "solid", fill: "none", width: 0 },
      });
      shape.text = node.text;
      shape.text.style = {
        typeface: node.style.fontFamily,
        fontSize: node.style.fontSize * fontScale,
        bold: node.style.bold,
        italic: node.style.italic,
        color: node.style.color,
        alignment: node.style.alignment,
        verticalAlignment: node.style.verticalAlignment,
        autoFit: "shrinkText",
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      };
      rendered.push(shape);
    }
  }
  for (const shape of rendered) shape.bringToFront();
  return tree;
}

export async function closeHtmlComponentRuntime() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

export async function runHtmlComponentGenerator(moduleUrl, component, defaults) {
  if (!process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(moduleUrl)) return;
  const values = { output: path.join(path.dirname(fileURLToPath(moduleUrl)), "example.pptx"), config: null };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${name || "<empty>"}`);
    const key = name.slice(2);
    if (!(key in values)) throw new Error(`不支持的参数：--${key}`);
    values[key] = value;
  }
  const parameters = values.config
    ? { ...defaults, ...JSON.parse(await fs.readFile(path.resolve(values.config), "utf8")) }
    : defaults;
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    const tree = await resolveHtmlComponent({ component, parameters, assetDir: path.dirname(fileURLToPath(moduleUrl)), targetFrame });
    compileResolvedVisualTree(slide, tree, targetFrame);
    await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
    await (await PresentationFile.exportPptx(presentation)).save(path.resolve(values.output));
    console.log(path.resolve(values.output));
  } finally {
    await closeHtmlComponentRuntime();
  }
}
