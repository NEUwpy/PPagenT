import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { assertResolvedTextContainerSlots } from "./text-container-contract.mjs";
import { htmlComponentThemeCss } from "./html-component-theme.mjs";

export { htmlComponentThemeCss } from "./html-component-theme.mjs";

// v3 carries visual fidelity data (alpha, gradients, exact shadows/radii) instead of flattened CSS colors.
const TREE_SCHEMA_VERSION = 3;
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
      const nodeLabel = (element) => element.dataset.pptName || element.dataset.slotId || element.id || element.className?.baseVal || element.className || element.tagName.toLowerCase();
      const fidelityError = (code, element, property, value) => {
        throw new Error(`[HTML_PPT_FIDELITY:${code}] node=${nodeLabel(element)} property=${property} value=${String(value)}`);
      };
      const splitCssArgs = (value) => {
        const result = [];
        let depth = 0;
        let start = 0;
        for (let index = 0; index < value.length; index += 1) {
          if (value[index] === "(") depth += 1;
          if (value[index] === ")") depth -= 1;
          if (value[index] === "," && depth === 0) {
            result.push(value.slice(start, index).trim());
            start = index + 1;
          }
        }
        result.push(value.slice(start).trim());
        return result.filter(Boolean);
      };
      const effectiveOpacity = (element) => {
        let opacity = 1;
        for (let current = element; current && current !== root.parentElement; current = current.parentElement) {
          opacity *= Number.parseFloat(getComputedStyle(current).opacity) || 0;
          if (current === root) break;
        }
        return Math.max(0, Math.min(1, opacity));
      };
      const color = (value, opacity = 1, element = root, property = "color") => {
        if (!value || value === "transparent" || value === "none") return "none";
        const match = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
        if (!match) fidelityError("UNSUPPORTED_COLOR", element, property, value);
        const sourceAlpha = match[4] === undefined ? 1 : Number(match[4]) / (value.includes("%") ? 100 : 1);
        const alpha = Math.max(0, Math.min(1, sourceAlpha * opacity));
        if (alpha <= 0.0005) return "none";
        const hex = `#${[match[1], match[2], match[3]].map((part) => Math.round(Number(part)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
        if (alpha >= 0.9995) return hex;
        return `${hex}/${rounded(alpha * 100)}`;
      };
      const gradientFill = (element, style, opacity) => {
        const value = style.backgroundImage;
        const functionMatch = value.match(/^(linear-gradient|radial-gradient)\((.*)\)$/i);
        if (!functionMatch) fidelityError("UNSUPPORTED_BACKGROUND_IMAGE", element, "background-image", value);
        if (color(style.backgroundColor, opacity, element, "background-color") !== "none") {
          fidelityError("LAYERED_BACKGROUND", element, "background", `${style.backgroundColor}; ${value}`);
        }
        const args = splitCssArgs(functionMatch[2]);
        const linear = functionMatch[1].toLowerCase() === "linear-gradient";
        let angleDeg = 180;
        if (linear && args.length && !/^(?:rgba?|hsla?)\(|^#/i.test(args[0])) {
          const direction = args.shift().toLowerCase();
          const directionAngles = { "to top": 0, "to top right": 45, "to right": 90, "to bottom right": 135, "to bottom": 180, "to bottom left": 225, "to left": 270, "to top left": 315 };
          if (/^-?[\d.]+deg$/.test(direction)) angleDeg = Number.parseFloat(direction);
          else if (direction in directionAngles) angleDeg = directionAngles[direction];
          else fidelityError("UNSUPPORTED_GRADIENT_DIRECTION", element, "background-image", direction);
        } else if (!linear && args.length && !/^(?:rgba?|hsla?)\(|^#/i.test(args[0])) {
          fidelityError("UNSUPPORTED_RADIAL_GEOMETRY", element, "background-image", args[0]);
        }
        if (args.length < 2) fidelityError("INVALID_GRADIENT", element, "background-image", value);
        const stops = args.map((stop, index) => {
          const match = stop.match(/^((?:rgba?|hsla?)\([^)]*\)|#[0-9a-f]{3,8})(?:\s+(-?[\d.]+)%?)?$/i);
          if (!match) fidelityError("UNSUPPORTED_GRADIENT_STOP", element, "background-image", stop);
          const distributed = args.length === 1 ? 0 : index / (args.length - 1);
          const offset = match[2] === undefined ? distributed * 100000 : Number(match[2]) * 1000;
          if (offset < 0 || offset > 100000) fidelityError("INVALID_GRADIENT_OFFSET", element, "background-image", stop);
          return { offset: rounded(offset), color: color(match[1], opacity, element, "background-image") };
        });
        return {
          type: "gradient",
          gradientKind: linear ? "linear" : "path",
          ...(linear ? { angleDeg } : {}),
          stops,
        };
      };
      const backgroundFill = (element, style, opacity) => style.backgroundImage === "none"
        ? color(style.backgroundColor, opacity, element, "background-color")
        : gradientFill(element, style, opacity);
      const svgFill = (element, style, opacity) => {
        const reference = style.fill.match(/^url\(["']?#([^"')]+)["']?\)$/i);
        if (!reference) return color(style.fill, opacity, element, "fill");
        const gradient = document.getElementById(reference[1]);
        if (!(gradient instanceof SVGLinearGradientElement)) fidelityError("UNSUPPORTED_SVG_PAINT", element, "fill", style.fill);
        const coordinate = (name, fallback) => {
          const raw = gradient.getAttribute(name) ?? fallback;
          return raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
        };
        const x1 = coordinate("x1", "0"), y1 = coordinate("y1", "0"), x2 = coordinate("x2", "1"), y2 = coordinate("y2", "0");
        const angleDeg = rounded((Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90 + 360) % 360);
        const stops = [...gradient.querySelectorAll("stop")].map((stop) => {
          const stopStyle = getComputedStyle(stop);
          const rawOffset = stop.getAttribute("offset") ?? "0";
          const offset = rawOffset.endsWith("%") ? Number.parseFloat(rawOffset) : Number.parseFloat(rawOffset) * 100;
          return {
            offset: rounded(offset),
            color: color(stopStyle.stopColor, opacity * Number.parseFloat(stopStyle.stopOpacity || "1"), stop, "stop-color"),
          };
        });
        if (stops.length < 2) fidelityError("INVALID_SVG_GRADIENT", element, "fill", style.fill);
        return { type: "gradient", gradientKind: "linear", angleDeg, stops };
      };
      const shadowStyle = (element, style, opacity) => {
        if (style.boxShadow === "none") return element.dataset.pptShadow || "shadow-none";
        const shadows = splitCssArgs(style.boxShadow);
        if (shadows.length !== 1) fidelityError("MULTIPLE_BOX_SHADOWS", element, "box-shadow", style.boxShadow);
        const shadow = shadows[0];
        if (/\binset\b/i.test(shadow)) fidelityError("INSET_BOX_SHADOW", element, "box-shadow", shadow);
        const colorMatch = shadow.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
        if (!colorMatch) fidelityError("INVALID_BOX_SHADOW", element, "box-shadow", shadow);
        const dimensions = shadow.replace(colorMatch[0], "").trim().match(/-?[\d.]+px/g)?.map(Number.parseFloat) ?? [];
        if (dimensions.length < 2 || dimensions.length > 4) fidelityError("INVALID_BOX_SHADOW", element, "box-shadow", shadow);
        const [x, y, blur = 0, spread = 0] = dimensions;
        if (Math.abs(spread) > 0.001) fidelityError("UNSUPPORTED_SHADOW_SPREAD", element, "box-shadow", shadow);
        return `${rounded(x)}px ${rounded(y)}px ${rounded(blur)}px ${color(colorMatch[0], opacity, element, "box-shadow")}`;
      };
      const textShadowStyle = (element, style, opacity) => {
        if (style.textShadow === "none") return "shadow-none";
        const shadows = splitCssArgs(style.textShadow);
        if (shadows.length !== 1) fidelityError("MULTIPLE_TEXT_SHADOWS", element, "text-shadow", style.textShadow);
        const shadow = shadows[0];
        const colorMatch = shadow.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
        if (!colorMatch) fidelityError("INVALID_TEXT_SHADOW", element, "text-shadow", shadow);
        const dimensions = shadow.replace(colorMatch[0], "").trim().match(/-?[\d.]+px/g)?.map(Number.parseFloat) ?? [];
        if (dimensions.length < 2 || dimensions.length > 3) fidelityError("INVALID_TEXT_SHADOW", element, "text-shadow", shadow);
        const [x, y, blur = 0] = dimensions;
        return `${rounded(x)}px ${rounded(y)}px ${rounded(blur)}px ${color(colorMatch[0], opacity, element, "text-shadow")}`;
      };
      const assertSupportedEffects = (element, style) => {
        if (style.filter !== "none") fidelityError("UNSUPPORTED_FILTER", element, "filter", style.filter);
        if (style.textShadow !== "none" && element.dataset.pptKind !== "text") fidelityError("UNSUPPORTED_TEXT_SHADOW", element, "text-shadow", style.textShadow);
        if (style.mixBlendMode !== "normal") fidelityError("UNSUPPORTED_BLEND_MODE", element, "mix-blend-mode", style.mixBlendMode);
        if (style.backgroundBlendMode !== "normal") fidelityError("UNSUPPORTED_BLEND_MODE", element, "background-blend-mode", style.backgroundBlendMode);
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
      const textStyle = (element, style, opacity) => ({
        typeface: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        fontSize: rounded(parseFloat(style.fontSize)),
        bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
        italic: style.fontStyle === "italic",
        color: color(element instanceof SVGElement ? style.fill : style.color, opacity, element, "color"),
        alignment: style.textAnchor === "middle" || style.textAlign === "center" ? "center" : style.textAnchor === "end" || style.textAlign === "right" ? "right" : "left",
        verticalAlignment: element.dataset.pptValign || "middle",
        lineSpacing: rounded((Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize)) / Number.parseFloat(style.fontSize)),
      });
      const textValue = (element) => {
        const source = element.textContent.replace(/\r/g, "");
        if (element.dataset.pptPreserveLines === "true") {
          return source
            .split("\n")
            .map((line) => line.replace(/[\t ]+/g, " ").trim())
            .filter(Boolean)
            .join("\n");
        }
        return source.replace(/\s+/g, " ").trim();
      };
      const lineStyle = (element, style, opacity) => {
        const svg = element instanceof SVGElement;
        const width = rounded(parseFloat(svg ? style.strokeWidth : style.borderTopWidth) || 0);
        const sourceStyle = svg ? (style.strokeDasharray === "none" ? "solid" : "dashed") : style.borderTopStyle;
        const supportedStyles = { none: "solid", solid: "solid", dashed: "dashed", dotted: "dotted" };
        if (!(sourceStyle in supportedStyles)) fidelityError("UNSUPPORTED_LINE_STYLE", element, svg ? "stroke-dasharray" : "border-top-style", sourceStyle);
        return {
          fill: color(svg ? style.stroke : style.borderTopColor, opacity, element, svg ? "stroke" : "border-color"),
          width,
          style: supportedStyles[sourceStyle],
        };
      };
      const pathNode = (element, base, style, opacity) => {
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
          fill: svgFill(element, style, opacity),
          line: lineStyle(element, style, opacity),
          shadow: shadowStyle(element, style, opacity),
          points: absolute.map((point) => ({ x: rounded(point.x - left), y: rounded(point.y - top) })),
        };
      };
      const visible = (element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
      };
      for (const element of root.querySelectorAll("*")) {
        if (!visible(element) || element.closest('[data-ppt-kind="image"]') || element.parentElement?.closest('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]')) continue;
        const style = getComputedStyle(element);
        assertSupportedEffects(element, style);
        for (const [pseudo, pseudoStyle] of [["::before", getComputedStyle(element, "::before")], ["::after", getComputedStyle(element, "::after")]]) {
          const hasContent = pseudoStyle.content !== "none" && pseudoStyle.content !== "normal" && pseudoStyle.content !== '\"\"';
          const hasSurface = pseudoStyle.backgroundImage !== "none" || color(pseudoStyle.backgroundColor, 1, element, `${pseudo} background-color`) !== "none";
          if (hasContent || hasSurface) fidelityError("UNCOMPILED_PSEUDO_ELEMENT", element, pseudo, pseudoStyle.content);
        }
        if (!element.hasAttribute("data-ppt-kind") && !(element instanceof SVGElement)) {
          const hasSurface = style.backgroundImage !== "none"
            || color(style.backgroundColor, 1, element, "background-color") !== "none"
            || style.boxShadow !== "none"
            || [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some((width) => Number.parseFloat(width) > 0);
          if (hasSurface) fidelityError("UNCOMPILED_VISUAL_NODE", element, "surface", style.backgroundImage !== "none" ? style.backgroundImage : style.backgroundColor);
          const directText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          if (directText) fidelityError("UNCOMPILED_TEXT_NODE", element, "text", element.textContent.trim().slice(0, 80));
        }
      }
      for (const element of root.querySelectorAll("svg path,svg line,svg rect,svg circle,svg ellipse,svg polygon,svg polyline,svg text,svg image,svg use")) {
        if (!visible(element) || element.closest("defs") || element.closest('[data-ppt-kind="image"]') || element.hasAttribute("data-ppt-kind")) continue;
        fidelityError("UNCOMPILED_SVG_NODE", element, "data-ppt-kind", "missing");
      }
      const nodes = [...root.querySelectorAll("[data-ppt-kind]")].map((element, order) => {
        const kind = element.dataset.pptKind;
        const style = getComputedStyle(element);
        const opacity = effectiveOpacity(element);
        assertSupportedEffects(element, style);
        const base = { kind, name: element.dataset.pptName || `${kind}-${order}`, order };
        if (kind === "path") return pathNode(element, base, style, opacity);
        const frame = kind === "image"
          ? htmlFrame(element)
          : element instanceof SVGGraphicsElement ? svgFrame(element) : htmlFrame(element);
        if (kind === "image") {
          if (element instanceof SVGSVGElement) {
            const clone = element.cloneNode(true);
            clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            clone.setAttribute("width", String(Math.max(1, frame.width)));
            clone.setAttribute("height", String(Math.max(1, frame.height)));
            clone.style.color = style.color;
            clone.style.opacity = String(opacity);
            const encoded = btoa(unescape(encodeURIComponent(clone.outerHTML)));
            return { ...base, frame, dataUrl: `data:image/svg+xml;base64,${encoded}`, alt: element.dataset.iconKey || base.name, geometry: element.dataset.pptShape || null };
          }
          if (element instanceof HTMLImageElement) {
            if (opacity < 0.9995) fidelityError("UNSUPPORTED_RASTER_OPACITY", element, "opacity", opacity);
            const dataUrl = element.currentSrc || element.src;
            if (!dataUrl.startsWith("data:image/")) throw new Error("HTML 图片进入 Native 前必须转换为 data:image/* URL");
            return { ...base, frame, dataUrl, alt: element.alt || base.name, geometry: element.dataset.pptShape || null };
          }
          throw new Error("data-ppt-kind=image 仅支持内联 SVG 或 data:image/* 图片");
        }
        if (kind === "text") {
          return { ...base, frame, text: textValue(element), style: textStyle(element, style, opacity), shadow: textShadowStyle(element, style, opacity) };
        }
        if (kind === "shape" || kind === "shape-text") {
          const geometry = element.dataset.pptShape || (parseFloat(style.borderRadius) > 0 ? "roundRect" : "rect");
          const radii = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(Number.parseFloat);
          if (geometry === "roundRect" && radii.some((radius) => Math.abs(radius - radii[0]) > 0.01)) {
            fidelityError("ASYMMETRIC_BORDER_RADIUS", element, "border-radius", radii.join(" "));
          }
          const node = {
            ...base,
            frame,
            geometry,
            fill: element instanceof SVGElement ? svgFill(element, style, opacity) : backgroundFill(element, style, opacity),
            line: lineStyle(element, style, opacity),
            shadow: shadowStyle(element, style, opacity),
            borderRadius: geometry === "roundRect" ? rounded(radii[0]) : 0,
          };
          if (kind === "shape-text") {
            node.text = textValue(element);
            node.style = textStyle(element, style, opacity);
          }
          return node;
        }
        throw new Error(`不支持的 data-ppt-kind: ${kind}`);
      });
      const slots = [...root.querySelectorAll("[data-slot-id]")].map((element) => {
        const maxChars = Number(element.dataset.slotMaxChars);
        const maxLines = Number(element.dataset.slotMaxLines);
        const role = element.dataset.slotRole || "content";
        return {
          id: element.dataset.slotId,
          role,
          field: element.dataset.slotField || "",
          itemId: element.dataset.slotItemId || "",
          contentType: element.dataset.slotContentType || (role === "icon" ? "icon" : "text"),
          required: element.dataset.slotRequired === "true",
          textMode: element.dataset.slotTextMode || (role === "item-body" ? "flow" : "single-line"),
          listPolicy: element.dataset.slotListPolicy || (role === "item-body" ? "inline" : "none"),
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
        schemaVersion: 3,
        frame: { width: rounded(rootBox.width), height: rounded(rootBox.height) },
        overflow: root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
        nodes,
        slots,
      };
    });
    requireValue(!tree.overflow, `${component.id ?? "HTML Component"} 超出设计区域`);
    requireValue(tree.nodes.length > 0, `${component.id ?? "HTML Component"} 没有 data-ppt-kind 可编译对象`);
    assertResolvedTextContainerSlots(tree.slots, component.textCapacity ?? {}, component.id);
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
    lineSpacing: node.style.lineSpacing,
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
        shadow: node.shadow,
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
        ...(node.geometry ? { geometry: node.geometry } : {}),
      });
      continue;
    }
    if (node.kind === "text") {
      const shape = slide.shapes.add({ geometry: "textbox", name: node.name, position, fill: "none", line: { style: "solid", fill: "none", width: 0 }, shadow: node.shadow });
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
      ...(node.geometry === "roundRect" ? { borderRadius: node.borderRadius } : {}),
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
