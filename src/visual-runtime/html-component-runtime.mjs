import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const TREE_SCHEMA_VERSION = 2;
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
  throw new Error("未找到 Edge/Chrome；HTML → Native 编译需要本机浏览器计算最终 DOM/CSS");
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = resolveBrowserExecutable().then((executablePath) => chromium.launch({ headless: true, executablePath }));
  }
  return browserPromise;
}

function normalizeFrame(frame, label) {
  requireValue(frame && ["left", "top", "width", "height"].every((key) => Number.isFinite(frame[key])), `${label} 非法`);
  requireValue(frame.width > 0 && frame.height > 0, `${label} 的宽高必须大于 0`);
  return { left: frame.left, top: frame.top, width: frame.width, height: frame.height };
}

function cssString(value, fallback) {
  return `"${String(value ?? fallback).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function htmlComponentThemeCss(theme = {}) {
  const typography = theme.typography ?? {};
  return `:root{
    --ppagent-font-body:${cssString(theme.font, "Microsoft YaHei")};
    --ppagent-component-heading-size:${Number(typography.componentHeading ?? 29)}px;
    --ppagent-component-title-size:${Number(typography.componentTitle ?? 26)}px;
    --ppagent-component-item-title-size:${Number(typography.componentItemTitle ?? 21)}px;
    --ppagent-component-body-size:${Number(typography.componentBody ?? 19)}px;
    --ppagent-component-label-size:${Number(typography.componentLabel ?? 18)}px;
    --ppagent-component-meta-size:${Number(typography.componentMeta ?? 17)}px;
  }`;
}

function componentDocument(markup, css, frame, theme) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${frame.width}px;height:${frame.height}px;overflow:hidden;background:transparent}
    ${htmlComponentThemeCss(theme)}
    ${css}
  </style></head><body>${markup}</body></html>`;
}

export async function resolveHtmlComponent({ component, parameters, assetDir, targetFrame = null, theme = {} }) {
  requireValue(component && typeof component.renderMarkup === "function", "HTML Component 缺少 renderMarkup");
  requireValue(typeof component.cssFile === "string" && component.cssFile, "HTML Component 缺少 cssFile");
  const designFrame = normalizeFrame({
    left: 0,
    top: 0,
    width: component.designFrame?.width,
    height: component.designFrame?.height,
  }, "component.designFrame");
  const normalizedTargetFrame = targetFrame ? normalizeFrame(targetFrame, "targetFrame") : null;
  if (normalizedTargetFrame) {
    const scale = Math.min(normalizedTargetFrame.width / designFrame.width, normalizedTargetFrame.height / designFrame.height);
    requireValue(Math.abs(scale - 1) < 0.001, `${component.id ?? "HTML Component"} 必须按自然字号渲染；目标区域不能缩放组件`);
  }
  const cssPath = path.resolve(assetDir, component.cssFile);
  const relativeCssPath = path.relative(path.resolve(assetDir), cssPath);
  requireValue(relativeCssPath && !relativeCssPath.startsWith("..") && !path.isAbsolute(relativeCssPath), "cssFile 必须位于资产目录内");
  const css = await fs.readFile(cssPath, "utf8");
  const markup = component.renderMarkup(parameters);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: Math.ceil(designFrame.width), height: Math.ceil(designFrame.height) } });
  try {
    await page.setContent(componentDocument(markup, css, designFrame, theme), { waitUntil: "load" });
    const tree = await page.evaluate(async () => {
      await document.fonts.ready;
      const root = document.querySelector("[data-ppt-root]");
      if (!root) throw new Error("HTML Component 缺少 data-ppt-root");
      const rootBox = root.getBoundingClientRect();
      const rounded = (value) => Math.round(value * 1000) / 1000;
      const color = (value) => {
        if (!value || value === "transparent" || value === "none") return "none";
        const match = value.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i);
        if (!match || Number(match[4] ?? 1) === 0) return "none";
        return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
      };
      const htmlFrame = (element) => {
        const box = element.getBoundingClientRect();
        return {
          left: rounded(box.left - rootBox.left),
          top: rounded(box.top - rootBox.top),
          width: rounded(box.width),
          height: rounded(box.height),
          rotation: Number(element.dataset.pptRotation ?? 0),
        };
      };
      const svgFrame = (element) => {
        const box = element.getBBox();
        const matrix = element.getScreenCTM();
        const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix);
        const scaleX = Math.hypot(matrix.a, matrix.b);
        const scaleY = Math.hypot(matrix.c, matrix.d);
        const textPaddingX = element instanceof SVGTextElement ? Number(element.dataset.pptPadX ?? 8) : 0;
        const textPaddingY = element instanceof SVGTextElement ? Number(element.dataset.pptPadY ?? 2) : 0;
        return {
          left: rounded(center.x - rootBox.left - (box.width + textPaddingX * 2) * scaleX / 2),
          top: rounded(center.y - rootBox.top - (box.height + textPaddingY * 2) * scaleY / 2),
          width: rounded((box.width + textPaddingX * 2) * scaleX),
          height: rounded((box.height + textPaddingY * 2) * scaleY),
          rotation: rounded(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI),
        };
      };
      const textStyle = (element, style) => ({
        typeface: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        fontSize: rounded(parseFloat(style.fontSize)),
        bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
        italic: style.fontStyle === "italic",
        color: color(element instanceof SVGElement ? style.fill : style.color),
        alignment: style.textAnchor === "middle" || style.textAlign === "center" ? "center" : style.textAnchor === "end" || style.textAlign === "right" ? "right" : "left",
        verticalAlignment: element.dataset.pptValign || "middle",
      });
      const lineStyle = (element, style) => {
        const svg = element instanceof SVGElement;
        const width = rounded(parseFloat(svg ? style.strokeWidth : style.borderTopWidth) || 0);
        return {
          fill: color(svg ? style.stroke : style.borderTopColor),
          width,
          style: (svg ? style.strokeDasharray !== "none" : style.borderTopStyle === "dashed") ? "dashed" : "solid",
        };
      };
      const pathNode = (element, base, style) => {
        const length = element.getTotalLength();
        const sampleCount = Math.max(32, Math.min(240, Math.ceil(length / 2)));
        const matrix = element.getScreenCTM();
        const absolute = Array.from({ length: sampleCount + 1 }, (_, index) => {
          const source = element.getPointAtLength(length * index / sampleCount);
          const point = new DOMPoint(source.x, source.y).matrixTransform(matrix);
          return { x: point.x - rootBox.left, y: point.y - rootBox.top };
        });
        const xs = absolute.map((point) => point.x);
        const ys = absolute.map((point) => point.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        const width = Math.max(...xs) - left;
        const height = Math.max(...ys) - top;
        return {
          ...base,
          frame: { left: rounded(left), top: rounded(top), width: rounded(width), height: rounded(height), rotation: 0 },
          fill: color(style.fill),
          line: lineStyle(element, style),
          points: absolute.map((point) => ({ x: rounded(point.x - left), y: rounded(point.y - top) })),
        };
      };
      const nodes = [...root.querySelectorAll("[data-ppt-kind]")].map((element, order) => {
        const kind = element.dataset.pptKind;
        const style = getComputedStyle(element);
        const base = { kind, name: element.dataset.pptName || `${kind}-${order}`, order };
        if (kind === "path") return pathNode(element, base, style);
        const frame = kind === "image"
          ? htmlFrame(element)
          : element instanceof SVGGraphicsElement ? svgFrame(element) : htmlFrame(element);
        if (kind === "image") {
          if (!(element instanceof SVGSVGElement)) throw new Error("data-ppt-kind=image 当前只支持内联 SVG");
          const clone = element.cloneNode(true);
          clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          clone.setAttribute("width", String(Math.max(1, frame.width)));
          clone.setAttribute("height", String(Math.max(1, frame.height)));
          clone.style.color = style.color;
          const encoded = btoa(unescape(encodeURIComponent(clone.outerHTML)));
          return { ...base, frame, dataUrl: `data:image/svg+xml;base64,${encoded}`, alt: element.dataset.iconKey || base.name };
        }
        if (kind === "text") {
          return { ...base, frame, text: element.textContent.replace(/\s+/g, " ").trim(), style: textStyle(element, style) };
        }
        if (kind === "shape" || kind === "shape-text") {
          const node = {
            ...base,
            frame,
            geometry: element.dataset.pptShape || (parseFloat(style.borderRadius) > 0 ? "roundRect" : "rect"),
            fill: color(element instanceof SVGElement ? style.fill : style.backgroundColor),
            line: lineStyle(element, style),
            shadow: element.dataset.pptShadow || "shadow-none",
          };
          if (kind === "shape-text") {
            node.text = element.textContent.replace(/\s+/g, " ").trim();
            node.style = textStyle(element, style);
          }
          return node;
        }
        throw new Error(`不支持的 data-ppt-kind: ${kind}`);
      });
      const slots = [...root.querySelectorAll("[data-slot-id]")].map((element) => {
        const maxChars = Number(element.dataset.slotMaxChars);
        const maxLines = Number(element.dataset.slotMaxLines);
        return {
          id: element.dataset.slotId,
          role: element.dataset.slotRole || "content",
          field: element.dataset.slotField || "",
          itemId: element.dataset.slotItemId || "",
          contentType: element.dataset.slotContentType || (element.dataset.slotRole === "icon" ? "icon" : "text"),
          frame: htmlFrame(element),
          capacity: {
            ...(Number.isFinite(maxChars) && maxChars > 0 ? { maxChars } : {}),
            ...(Number.isFinite(maxLines) && maxLines > 0 ? { maxLines } : {}),
          },
          media: element.dataset.slotContentType === "icon" || element.dataset.slotRole === "icon" ? {
            type: "icon",
            provider: element.dataset.slotProvider || "",
            required: element.dataset.slotRequired === "true",
          } : null,
        };
      });
      return {
        schemaVersion: 2,
        frame: { width: rounded(rootBox.width), height: rounded(rootBox.height) },
        overflow: root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
        nodes,
        slots,
      };
    });
    requireValue(!tree.overflow, `${component.id ?? "HTML Component"} 超出设计区域`);
    requireValue(tree.nodes.length > 0, `${component.id ?? "HTML Component"} 没有 data-ppt-kind 可编译对象`);
    return {
      ...tree,
      componentId: component.id,
      targetFrame: normalizedTargetFrame,
    };
  } finally {
    await page.close();
  }
}

function fittedTransform(tree, targetFrame) {
  const scale = Math.min(targetFrame.width / tree.frame.width, targetFrame.height / tree.frame.height);
  return {
    scale,
    left: targetFrame.left + (targetFrame.width - tree.frame.width * scale) / 2,
    top: targetFrame.top + (targetFrame.height - tree.frame.height * scale) / 2,
  };
}

function scaledFrame(frame, transform) {
  return {
    left: transform.left + frame.left * transform.scale,
    top: transform.top + frame.top * transform.scale,
    width: frame.width * transform.scale,
    height: frame.height * transform.scale,
    rotation: frame.rotation || 0,
  };
}

function applyText(shape, node, scale) {
  shape.text = node.text;
  shape.text.style = {
    typeface: node.style.typeface,
    fontSize: node.style.fontSize * scale,
    bold: node.style.bold,
    italic: node.style.italic,
    color: node.style.color,
    alignment: node.style.alignment,
    verticalAlignment: node.style.verticalAlignment,
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

export function compileResolvedVisualTree(slide, tree, targetFrame = tree.targetFrame) {
  requireValue(tree?.schemaVersion === TREE_SCHEMA_VERSION, `ResolvedVisualTree schemaVersion 必须为 ${TREE_SCHEMA_VERSION}`);
  const frame = normalizeFrame(targetFrame, "targetFrame");
  const transform = fittedTransform(tree, frame);
  for (const node of [...tree.nodes].sort((left, right) => left.order - right.order)) {
    const position = scaledFrame(node.frame, transform);
    if (node.kind === "path") {
      slide.shapes.add({
        geometry: "custom",
        name: node.name,
        position,
        fill: node.fill,
        line: node.line.width > 0 ? { ...node.line, width: node.line.width * transform.scale } : { style: "solid", fill: "none", width: 0 },
        shadow: "shadow-none",
        customPaths: [{
          width: node.frame.width,
          height: node.frame.height,
          commands: [
            { moveTo: node.points[0] },
            ...node.points.slice(1).map((lineTo) => ({ lineTo })),
            { close: {} },
          ],
        }],
      });
      continue;
    }
    if (node.kind === "image") {
      slide.images.add({
        name: node.name,
        dataUrl: node.dataUrl,
        alt: node.alt,
        position,
        fit: "contain",
      });
      continue;
    }
    if (node.kind === "text") {
      const shape = slide.shapes.add({ geometry: "textbox", name: node.name, position, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
      applyText(shape, node, transform.scale);
      continue;
    }
    const shape = slide.shapes.add({
      geometry: node.geometry,
      name: node.name,
      position,
      fill: node.fill,
      line: node.line.width > 0 ? { ...node.line, width: node.line.width * transform.scale } : { style: "solid", fill: "none", width: 0 },
      shadow: node.shadow,
      ...(node.geometry === "roundRect" ? { borderRadius: "rounded-xl" } : {}),
    });
    if (node.kind === "shape-text") applyText(shape, node, transform.scale);
  }
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
  const targetFrame = { left: 55, top: 166, width: component.designFrame.width, height: component.designFrame.height };
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
