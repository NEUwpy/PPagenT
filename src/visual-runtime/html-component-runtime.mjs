import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { assertResolvedTextContainerSlots } from "./text-container-contract.mjs";
import { htmlComponentThemeCss, resolveComponentTypography } from "./html-component-theme.mjs";
import { htmlTextFlowCss } from "./text-flow.mjs";

export { htmlComponentThemeCss } from "./html-component-theme.mjs";

// v5 adds TextRegion/TextLayout bindings and box-derived capacity envelopes.
const TREE_SCHEMA_VERSION = 5;
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
    ${htmlTextFlowCss()}
    ${css}
  </style></head><body>${markup}</body></html>`;
}

export async function resolveHtmlComponent({ component, parameters, assetDir, targetFrame = null, theme = {} }) {
  requireValue(component && typeof component.renderMarkup === "function", "HTML Component 缺少 renderMarkup");
  const hasInlineCss = typeof component.cssText === "string" && component.cssText.trim().length > 0;
  const hasCssFile = typeof component.cssFile === "string" && component.cssFile;
  requireValue(hasInlineCss || hasCssFile, "HTML Component 缺少 cssText 或 cssFile");
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
  let css = component.cssText ?? "";
  if (!hasInlineCss) {
    const cssPath = path.resolve(assetDir, component.cssFile);
    const relativeCssPath = path.relative(path.resolve(assetDir), cssPath);
    requireValue(relativeCssPath && !relativeCssPath.startsWith("..") && !path.isAbsolute(relativeCssPath), "cssFile 必须位于资产目录内");
    css = await fs.readFile(cssPath, "utf8");
  }
  const markup = component.renderMarkup(parameters);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: Math.ceil(designFrame.width), height: Math.ceil(designFrame.height) } });
  try {
    await page.setContent(componentDocument(markup, css, designFrame, theme), { waitUntil: "load" });
    const tree = await page.evaluate(async (typographyContract) => {
      await document.fonts.ready;
      const root = document.querySelector("[data-ppt-root]");
      if (!root) throw new Error("HTML Component 缺少 data-ppt-root");
      const number = (value) => Number.parseFloat(value) || 0;
      const standardizedFontSizesPt = [...new Set(Object.values(typographyContract)
        .map(Number)
        .filter((value) => Number.isFinite(value) && value >= 15))]
        .sort((left, right) => right - left);
      const innerSize = (element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          width: Math.max(0, box.width - number(style.paddingLeft) - number(style.paddingRight) - number(style.borderLeftWidth) - number(style.borderRightWidth)),
          height: Math.max(0, box.height - number(style.paddingTop) - number(style.paddingBottom) - number(style.borderTopWidth) - number(style.borderBottomWidth)),
        };
      };
      const renderedLineCount = (element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const tops = [...range.getClientRects()]
          .filter((rect) => rect.width > 0.1 && rect.height > 0.1)
          .map((rect) => Math.round(rect.top * 2) / 2);
        return new Set(tops).size || 1;
      };
      const textFits = (element, fontSizePt, singleLine) => {
        const source = element.textContent.replace(/\r/g, "").trim();
        if (!source) return true;
        const available = innerSize(element);
        const sourceStyle = getComputedStyle(element);
        if (singleLine) {
          const fontSizePx = fontSizePt / 0.75;
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.font = `${sourceStyle.fontStyle} ${sourceStyle.fontWeight} ${fontSizePx}px ${sourceStyle.fontFamily}`;
          const letterSpacing = sourceStyle.letterSpacing === "normal" ? 0 : number(sourceStyle.letterSpacing);
          const requiredWidth = Math.max(...source.split("\n").map((line) => (
            context.measureText(line).width + Math.max(0, [...line].length - 1) * letterSpacing
          )));
          return requiredWidth <= available.width + 1 && fontSizePx <= available.height + 1;
        }
        const clone = element.cloneNode(true);
        clone.removeAttribute("id");
        clone.style.position = "fixed";
        clone.style.left = "-10000px";
        clone.style.top = "0";
        clone.style.width = `${element.getBoundingClientRect().width}px`;
        clone.style.height = "auto";
        clone.style.minHeight = "0";
        clone.style.maxHeight = "none";
        clone.style.overflow = "visible";
        clone.style.transform = "none";
        clone.style.fontSize = `${fontSizePt}pt`;
        clone.style.webkitLineClamp = "unset";
        clone.style.whiteSpace = singleLine ? "nowrap" : sourceStyle.whiteSpace;
        document.body.appendChild(clone);
        const cloneStyle = getComputedStyle(clone);
        const lineHeight = number(cloneStyle.lineHeight) || number(cloneStyle.fontSize) * 1.2;
        const lines = renderedLineCount(clone);
        const requiredHeight = Math.max(lineHeight * lines, clone.scrollHeight);
        clone.remove();
        const declaredMaxLines = Number(element.dataset.slotMaxLines);
        const maxLines = Number.isFinite(declaredMaxLines) && declaredMaxLines > 0
          ? declaredMaxLines
          : Math.max(1, Math.floor((available.height + 0.5) / lineHeight));
        // Chromium rounds scrollHeight to whole CSS pixels while the visible
        // line box and our extracted frame keep fractional pixels. A natural
        // two-line block can therefore report ~1-2 px more scrollHeight even
        // though its geometry is fully inside the parent layout. Use the same
        // 2 px tolerance as the collective TextLayout containment check.
        return lines <= maxLines && requiredHeight <= available.height + 2;
      };

      const renderedTextLines = (element) => {
        const node = element.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) {
          return element.textContent.replace(/\r/g, "").split("\n");
        }
        const source = node.textContent.replace(/\r/g, "");
        const lines = [];
        let current = "";
        let currentTop = null;
        for (let index = 0; index < source.length; index += 1) {
          const character = source[index];
          if (character === "\n") {
            lines.push(current.trim());
            current = "";
            currentTop = null;
            continue;
          }
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          const top = Math.round(rect.top * 2) / 2;
          if (currentTop !== null && Math.abs(top - currentTop) > 0.5) {
            lines.push(current.trim());
            current = "";
          }
          currentTop = top;
          current += character;
        }
        if (current.trim() || !lines.length) lines.push(current.trim());
        return lines.filter((line) => line.length > 0);
      };

      const flowProfiles = (composition) => {
        const title = Number(typographyContract.componentItemTitle);
        const lead = Number(typographyContract.componentLead);
        const body = Number(typographyContract.componentBody);
        const meta = Number(typographyContract.componentMeta);
        if (composition === "title-body") {
          return [
            { title, body },
            { title, body: meta },
            { title: lead, body: meta },
            { title: body, body: meta },
          ];
        }
        if (composition === "title-only") {
          return [title, lead, body, meta].map((fontSize) => ({ title: fontSize }));
        }
        return [body, meta].map((fontSize) => ({ body: fontSize }));
      };

      const textFlowFits = (flow, title, body) => {
        const flowBox = flow.getBoundingClientRect();
        const content = [...flow.querySelectorAll("[data-text-flow-part]")]
          .filter((element) => getComputedStyle(element).display !== "none");
        const boxes = content.map((element) => element.getBoundingClientRect());
        if (!boxes.length) return false;
        const inside = boxes.every((box) => (
          box.left >= flowBox.left - 1
          && box.right <= flowBox.right + 1
          && box.top >= flowBox.top - 1
          && box.bottom <= flowBox.bottom + 1
        ));
        if (!inside) return false;
        if (title && renderedLineCount(title) > 2) return false;
        for (const element of [title, body].filter(Boolean)) {
          if (element.scrollWidth > element.clientWidth + 1) return false;
        }
        return flow.scrollWidth <= flow.clientWidth + 1 && flow.scrollHeight <= flow.clientHeight + 1;
      };

      const resolvedTextFlows = [];
      const textFlowOverflows = [];
      for (const flow of root.querySelectorAll("[data-ppagent-text-flow]")) {
        const title = flow.querySelector('[data-text-flow-part="title"]');
        const body = flow.querySelector('[data-text-flow-part="body"]');
        const composition = flow.dataset.textFlowComposition;
        const original = {
          ...(title ? { title: number(getComputedStyle(title).fontSize) * 0.75 } : {}),
          ...(body ? { body: number(getComputedStyle(body).fontSize) * 0.75 } : {}),
        };
        let selected = null;
        for (const candidate of flowProfiles(composition)) {
          if (title && Number.isFinite(candidate.title)) title.style.fontSize = `${candidate.title}pt`;
          if (body && Number.isFinite(candidate.body)) body.style.fontSize = `${candidate.body}pt`;
          flow.getBoundingClientRect();
          if (!textFlowFits(flow, title, body)) continue;
          selected = candidate;
          break;
        }
        if (!selected) {
          textFlowOverflows.push(flow.dataset.slotId || flow.dataset.slotField || "text-flow");
          flow.dataset.pptTextFlowStatus = "overflow";
        } else {
          flow.dataset.pptTextFlowStatus = "resolved";
        }
        for (const [part, element] of [["title", title], ["body", body]]) {
          if (!element) continue;
          const resolvedFontSizePt = number(getComputedStyle(element).fontSize) * 0.75;
          element.dataset.pptOriginalFontSizePt = String(Math.round(original[part] * 1000) / 1000);
          element.dataset.pptResolvedFontSizePt = String(Math.round(resolvedFontSizePt * 1000) / 1000);
          element.dataset.pptFontFit = resolvedFontSizePt < original[part] - 0.05 ? "reduced" : "unchanged";
          element.dataset.pptResolvedWrap = "square";
          element.dataset.pptResolvedText = renderedTextLines(element).join("\n");
        }
        resolvedTextFlows.push({
          id: flow.dataset.slotId || flow.dataset.slotField || "text-flow",
          composition,
          status: flow.dataset.pptTextFlowStatus,
          profile: flow.dataset.textFlowProfile || "standard",
        });
      }
      // The HTML layout is the source of truth. Before extracting it, choose the
      // largest approved font tier that actually fits each fixed text container.
      // This is discrete fitting (22→20→18→16→14→12), never arbitrary shrinking.
      for (const element of root.querySelectorAll('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]')) {
        if (element instanceof SVGTextElement) continue;
        if (element.closest("[data-ppagent-text-flow]")) continue;
        let style = getComputedStyle(element);
        const source = element.textContent.replace(/\r/g, "");
        const currentFontSizePt = number(style.fontSize) * 0.75;
        const verticalText = style.writingMode !== "horizontal-tb";
        const explicitSingleLine = element.dataset.slotTextMode === "single-line" || ["nowrap", "pre"].includes(style.whiteSpace);
        const singleLine = !verticalText && !source.includes("\n") && (explicitSingleLine || renderedLineCount(element) === 1);
        const primitiveTiers = (element.dataset.textPrimitiveFontTiers || "")
          .split(",")
          .map(Number)
          .filter((size) => Number.isFinite(size) && size >= 12)
          .sort((left, right) => right - left);
        const candidates = (primitiveTiers.length ? primitiveTiers : standardizedFontSizesPt)
          .filter((size) => size <= currentFontSizePt + 0.05);
        const originalFontSizePt = currentFontSizePt;
        let selectedFontSizePt = currentFontSizePt;
        let fits = textFits(element, currentFontSizePt, singleLine);
        if (!fits) {
          for (const candidate of candidates) {
            if (!textFits(element, candidate, singleLine)) continue;
            selectedFontSizePt = candidate;
            fits = true;
            break;
          }
          if (selectedFontSizePt !== currentFontSizePt) {
            element.style.fontSize = `${selectedFontSizePt}pt`;
            style = getComputedStyle(element);
          }
        }
        if (!fits) {
          const domFits = element.scrollWidth <= element.clientWidth + 2 && element.scrollHeight <= element.clientHeight + 2;
          if (domFits) fits = true;
        }
        element.dataset.pptResolvedWrap = singleLine ? "none" : "square";
        element.dataset.pptFontFit = fits ? (selectedFontSizePt < originalFontSizePt - 0.05 ? "reduced" : "unchanged") : "overflow";
        element.dataset.pptOriginalFontSizePt = String(Math.round(originalFontSizePt * 1000) / 1000);
        element.dataset.pptResolvedFontSizePt = String(Math.round(selectedFontSizePt * 1000) / 1000);
        element.dataset.pptResolvedText = renderedTextLines(element).join("\n");
        const fontSize = Number.parseFloat(style.fontSize);
        const height = element.getBoundingClientRect().height;
        const lineHeight = Number.parseFloat(style.lineHeight);
        const legacyCenteredLineBox = Number.isFinite(lineHeight) && lineHeight >= height * 0.85;
        const wantsMiddle = !element.dataset.pptValign || element.dataset.pptValign === "middle";
        if (singleLine && legacyCenteredLineBox && wantsMiddle && style.textAlign === "center" && height >= fontSize * 1.35) {
          element.dataset.pptTextLayout = "single-line-center";
          element.style.display = "flex";
          element.style.alignItems = "center";
          element.style.justifyContent = "center";
          element.style.lineHeight = "1.2";
        }
      }
      const resolvedTextLayouts = [];
      const textLayoutOverflows = [];
      const textLayoutFits = (layout, parts) => {
        const tolerance = 2;
        const layoutBox = layout.getBoundingClientRect();
        const inside = parts.every((part) => {
          const box = part.getBoundingClientRect();
          return box.left >= layoutBox.left - tolerance
            && box.right <= layoutBox.right + tolerance
            && box.top >= layoutBox.top - tolerance
            && box.bottom <= layoutBox.bottom + tolerance;
        });
        const primitiveFits = parts.every((part) => {
          if (part.dataset.pptFontFit !== "overflow") return true;
          // Auto-height Markdown blocks can inherit Chromium's integer
          // scrollHeight rounding even when every rendered line is visible.
          // Accept that narrow case only when the extracted line geometry
          // itself fits; fixed-height clipped text still fails this check.
          const style = getComputedStyle(part);
          const lineHeight = number(style.lineHeight) || number(style.fontSize) * 1.2;
          const requiredLineBoxHeight = lineHeight * renderedLineCount(part);
          return style.overflow === "visible"
            && part.getBoundingClientRect().height + tolerance >= requiredLineBoxHeight;
        });
        return inside
          && layout.scrollWidth <= layout.clientWidth + tolerance
          && layout.scrollHeight <= layout.clientHeight + tolerance
          && primitiveFits;
      };
      const collectiveFitOrder = ["body", "list", "annotation", "label", "heading", "quote", "emphasis", "metric"];
      for (const layout of root.querySelectorAll("[data-ppagent-text-layout]")) {
        const parts = [...layout.querySelectorAll("[data-text-layout-part]")]
          .filter((element) => getComputedStyle(element).display !== "none");
        let fits = textLayoutFits(layout, parts);
        // Each primitive may fit on its own while the combined stack does not.
        // Resolve that at the TextLayout level by stepping through the same
        // approved font tiers, never by arbitrary scaling or Builder changes.
        for (const primitiveId of collectiveFitOrder) {
          const group = parts.filter((part) => part.dataset.textPrimitive === primitiveId);
          while (!fits && group.length) {
            let changed = false;
            for (const part of group) {
              const current = number(getComputedStyle(part).fontSize) * 0.75;
              const tiers = (part.dataset.textPrimitiveFontTiers || "")
                .split(",")
                .map(Number)
                .filter((size) => Number.isFinite(size) && size >= 12 && size < current - 0.05)
                .sort((left, right) => right - left);
              if (!tiers.length) continue;
              part.style.fontSize = `${tiers[0]}pt`;
              part.dataset.pptResolvedFontSizePt = String(tiers[0]);
              part.dataset.pptFontFit = "reduced";
              part.dataset.pptResolvedText = renderedTextLines(part).join("\n");
              changed = true;
            }
            if (!changed) break;
            layout.getBoundingClientRect();
            fits = textLayoutFits(layout, parts);
          }
          if (fits) break;
        }
        layout.dataset.pptTextLayoutStatus = fits ? "resolved" : "overflow";
        const layoutId = layout.dataset.textLayoutId || "text-layout";
        if (!fits) textLayoutOverflows.push(layout.closest("[data-slot-id]")?.dataset.slotId || layoutId);
        resolvedTextLayouts.push({
          id: layoutId,
          status: layout.dataset.pptTextLayoutStatus,
          align: layout.dataset.textLayoutAlign || "left",
          valign: layout.dataset.textLayoutValign || "middle",
          density: layout.dataset.textLayoutDensity || "standard",
        });
      }
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
      const textStyle = (element, style, opacity) => {
        const singleLineCenter = element.dataset.pptTextLayout === "single-line-center";
        const fontSize = rounded(parseFloat(style.fontSize));
        const centeredByLayout = (
          (["grid", "inline-grid"].includes(style.display) && [style.justifyItems, style.placeItems].some((value) => value?.includes("center")))
          || (["flex", "inline-flex"].includes(style.display) && style.justifyContent === "center")
        );
        const inferredVerticalAlignment = (() => {
          if (element.dataset.pptValign) return element.dataset.pptValign;
          if (["flex", "inline-flex", "grid", "inline-grid"].includes(style.display)) {
            if (["flex-start", "start"].includes(style.alignItems)) return "top";
            if (["flex-end", "end"].includes(style.alignItems)) return "bottom";
          }
          return "middle";
        })();
        return {
          typeface: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          fontSize,
          fontSizePt: rounded(fontSize * 0.75),
          bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
          italic: style.fontStyle === "italic",
          color: color(element instanceof SVGElement ? style.fill : style.color, opacity, element, "color"),
          alignment: style.textAnchor === "middle" || style.textAlign === "center" || centeredByLayout ? "center" : style.textAnchor === "end" || style.textAlign === "right" ? "right" : "left",
          verticalAlignment: inferredVerticalAlignment,
          wrap: element.dataset.pptResolvedWrap || (["nowrap", "pre"].includes(style.whiteSpace) ? "none" : "square"),
          fontFit: element.dataset.pptFontFit || "unchanged",
          originalFontSizePt: Number(element.dataset.pptOriginalFontSizePt || rounded(fontSize * 0.75)),
          lineSpacing: singleLineCenter
            ? 1
            : rounded((Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize)) / Number.parseFloat(style.fontSize)),
        };
      };
      const textValue = (element) => {
        if (element.dataset.pptResolvedText !== undefined) return element.dataset.pptResolvedText;
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
      const stackingPath = (element) => {
        const ancestors = [];
        for (let current = element; current && current !== root.parentElement; current = current.parentElement) {
          ancestors.push(current);
          if (current === root) break;
        }
        ancestors.reverse();
        const path = [];
        for (const current of ancestors) {
          const currentStyle = getComputedStyle(current);
          if (currentStyle.position === "static" || currentStyle.zIndex === "auto") continue;
          const zIndex = Number.parseInt(currentStyle.zIndex, 10);
          if (!Number.isFinite(zIndex)) fidelityError("UNSUPPORTED_Z_INDEX", current, "z-index", currentStyle.zIndex);
          path.push(zIndex);
        }
        return path.length ? path : [0];
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
        const sourcePath = element.getAttribute("d")?.trim() ?? "";
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
        // PowerPoint custom paths reject a zero-sized bounding box. Straight
        // horizontal/vertical SVG paths are valid, so keep their coordinates
        // unchanged while giving the exported path a minimal positive extent.
        const exportWidth = Math.max(1, width);
        const exportHeight = Math.max(1, height);
        return {
          ...base,
          frame: { left: rounded(left), top: rounded(top), width: rounded(exportWidth), height: rounded(exportHeight), rotation: 0 },
          fill: svgFill(element, style, opacity),
          line: lineStyle(element, style, opacity),
          shadow: shadowStyle(element, style, opacity),
          closed: /[zZ]\s*$/.test(sourcePath),
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
        const base = { kind, name: element.dataset.pptName || `${kind}-${order}`, order, stackingPath: stackingPath(element) };
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
          const hasVisualSurface = style.backgroundImage !== "none"
            || color(style.backgroundColor, opacity, element, "background-color") !== "none"
            || style.boxShadow !== "none"
            || [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
              .some((width) => Number.parseFloat(width) > 0);
          if (hasVisualSurface) {
            fidelityError("TEXT_SURFACE_REQUIRES_SHAPE_TEXT", element, "data-ppt-kind", "text");
          }
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
      const textSlotMetrics = (element, textMode) => {
        const typographyElement = element.matches('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]')
          ? element
          : element.querySelector('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]');
        const style = getComputedStyle(typographyElement ?? element);
        const containerStyle = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const number = (value) => Number.parseFloat(value) || 0;
        const fontSizePx = number(style.fontSize);
        const fontSizePt = rounded(fontSizePx * 0.75);
        const lineHeightPx = number(style.lineHeight) || fontSizePx * 1.2;
        const padding = {
          top: number(containerStyle.paddingTop),
          right: number(containerStyle.paddingRight),
          bottom: number(containerStyle.paddingBottom),
          left: number(containerStyle.paddingLeft),
        };
        const border = {
          top: number(containerStyle.borderTopWidth),
          right: number(containerStyle.borderRightWidth),
          bottom: number(containerStyle.borderBottomWidth),
          left: number(containerStyle.borderLeftWidth),
        };
        const innerWidth = Math.max(0, box.width - padding.left - padding.right - border.left - border.right);
        const innerHeight = Math.max(0, box.height - padding.top - padding.bottom - border.top - border.bottom);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = `${style.fontStyle} ${style.fontWeight} ${fontSizePx}px ${style.fontFamily}`;
        const letterSpacing = style.letterSpacing === "normal" ? 0 : number(style.letterSpacing);
        const glyphWidth = Math.max(1, context.measureText("中").width + letterSpacing);
        const charsPerLine = Math.max(1, Math.floor((innerWidth + letterSpacing) / glyphWidth));
        const singleLine = textMode === "single-line" || ["nowrap", "pre"].includes(style.whiteSpace);
        const geometricMaxLines = singleLine ? 1 : Math.max(1, Math.floor((innerHeight + 0.5) / lineHeightPx));
        const declaredMaxChars = Number(element.dataset.slotMaxChars);
        const declaredMaxLines = Number(element.dataset.slotMaxLines);
        const borderRadius = Math.max(
          number(containerStyle.borderTopLeftRadius),
          number(containerStyle.borderTopRightRadius),
          number(containerStyle.borderBottomRightRadius),
          number(containerStyle.borderBottomLeftRadius),
        );
        const nonRectangular = containerStyle.clipPath !== "none"
          || element.dataset.pptShape === "ellipse"
          || (borderRadius > Math.min(box.width, box.height) * 0.35);
        const reliable = !(element instanceof SVGTextElement)
          && !(element instanceof SVGGElement)
          && !nonRectangular;
        const maxLines = Number.isFinite(declaredMaxLines) && declaredMaxLines > 0
          ? Math.min(declaredMaxLines, geometricMaxLines)
          : geometricMaxLines;
        const geometricMaxChars = charsPerLine * geometricMaxLines;
        const maxCharsWithinEffectiveLines = charsPerLine * maxLines;
        const maxChars = Number.isFinite(declaredMaxChars) && declaredMaxChars > 0
          ? Math.min(declaredMaxChars, maxCharsWithinEffectiveLines)
          : maxCharsWithinEffectiveLines;
        const declarationFits = (
          !(Number.isFinite(declaredMaxLines) && declaredMaxLines > geometricMaxLines)
          && !(Number.isFinite(declaredMaxChars) && declaredMaxChars > maxCharsWithinEffectiveLines)
        );
        const sampleText = typographyElement?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const sampleLayout = (() => {
          if (!sampleText || typographyElement instanceof SVGTextElement) {
            return { lineCount: 1, scrollWidth: innerWidth, scrollHeight: lineHeightPx };
          }
          const clone = typographyElement.cloneNode(true);
          clone.removeAttribute("id");
          clone.style.position = "fixed";
          clone.style.left = "-10000px";
          clone.style.top = "0";
          clone.style.right = "auto";
          clone.style.bottom = "auto";
          clone.style.width = `${innerWidth}px`;
          clone.style.height = "auto";
          clone.style.display = "block";
          clone.style.padding = "0";
          clone.style.border = "0";
          clone.style.minHeight = "0";
          clone.style.maxHeight = "none";
          clone.style.overflow = "visible";
          clone.style.whiteSpace = style.whiteSpace;
          clone.style.webkitLineClamp = "unset";
          document.body.appendChild(clone);
          const cloneStyle = getComputedStyle(clone);
          const cloneLineHeight = number(cloneStyle.lineHeight) || lineHeightPx;
          const result = {
            lineCount: Math.max(1, Math.round(clone.scrollHeight / cloneLineHeight)),
            scrollWidth: clone.scrollWidth,
            scrollHeight: clone.scrollHeight,
          };
          clone.remove();
          return result;
        })();
        const sampleLineCount = sampleLayout.lineCount;
        const sampleOverflowsWidth = Boolean(sampleText) && singleLine && sampleLayout.scrollWidth > innerWidth + 1;
        const sampleOverflowsHeight = Boolean(sampleText) && sampleLineCount > geometricMaxLines;
        const sampleUnexpectedWrap = textMode === "single-line" && sampleLineCount > 1;
        const sampleFits = !sampleOverflowsWidth && !sampleOverflowsHeight && !sampleUnexpectedWrap;
        const typographyRole = Object.entries(typographyContract)
          .find(([, size]) => Math.abs(Number(size) - fontSizePt) < 0.05)?.[0] ?? "custom";
        return {
          typography: {
            role: typographyRole,
            typeface: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
            fontSizePt,
            fontWeight: style.fontWeight,
            alignment: style.textAlign,
            lineHeightPt: rounded(lineHeightPx * 0.75),
          },
          innerFrame: {
            width: rounded(innerWidth),
            height: rounded(innerHeight),
            padding,
          },
          capacity: {
            charsPerLine,
            maxLines,
            maxChars,
            basis: "zh-glyph",
            reliable,
            geometricMaxLines,
            geometricMaxChars,
            declarationFits,
            sampleTextChars: [...sampleText].length,
            sampleLineCount,
            sampleOverflowsWidth,
            sampleOverflowsHeight,
            sampleUnexpectedWrap,
            sampleFits,
            ...(Number.isFinite(declaredMaxChars) && declaredMaxChars > 0 ? { declaredMaxChars } : {}),
            ...(Number.isFinite(declaredMaxLines) && declaredMaxLines > 0 ? { declaredMaxLines } : {}),
          },
        };
      };
      const textFlowSlotMetrics = (element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const padding = {
          top: number(style.paddingTop),
          right: number(style.paddingRight),
          bottom: number(style.paddingBottom),
          left: number(style.paddingLeft),
        };
        const parts = [...element.querySelectorAll('[data-text-flow-part="title"],[data-text-flow-part="body"]')]
          .map((part) => {
            const partStyle = getComputedStyle(part);
            const fontSizePt = rounded(number(partStyle.fontSize) * 0.75);
            return {
              part: part.dataset.textFlowPart,
              field: part.dataset.textFlowField || part.dataset.textFlowPart,
              frame: htmlFrame(part),
              text: textValue(part),
              lineCount: renderedLineCount(part),
              typography: {
                role: Object.entries(typographyContract)
                  .find(([, size]) => Math.abs(Number(size) - fontSizePt) < 0.05)?.[0] ?? "custom",
                typeface: partStyle.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
                fontSizePt,
                fontWeight: partStyle.fontWeight,
                alignment: partStyle.textAlign,
                lineHeightPt: rounded(number(partStyle.lineHeight) * 0.75),
              },
            };
          });
        return {
          textFlow: {
            layoutOwner: "text-flow",
            profile: element.dataset.textFlowProfile || "standard",
            composition: element.dataset.textFlowComposition,
            status: element.dataset.pptTextFlowStatus,
            align: element.dataset.textFlowAlign || "left",
            valign: element.dataset.textFlowValign || "middle",
            layout: {
              gapPx: rounded(number(style.rowGap || style.gap)),
              separatorHeightPx: rounded(element.querySelector('[data-text-flow-part="separator"]')?.getBoundingClientRect().height ?? 0),
            },
            parts,
          },
          innerFrame: {
            width: rounded(Math.max(0, box.width - padding.left - padding.right)),
            height: rounded(Math.max(0, box.height - padding.top - padding.bottom)),
            padding,
          },
          capacity: {
            basis: "dynamic-text-flow",
            reliable: true,
            derived: true,
            sampleFits: element.dataset.pptTextFlowStatus === "resolved",
          },
        };
      };
      const textRegionSlotMetrics = (element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const padding = {
          top: number(style.paddingTop),
          right: number(style.paddingRight),
          bottom: number(style.paddingBottom),
          left: number(style.paddingLeft),
        };
        const parts = [...element.querySelectorAll("[data-text-flow-part],[data-text-layout-part]")].map((part) => {
          const partStyle = getComputedStyle(part);
          const fontSizePt = rounded(number(partStyle.fontSize) * 0.75);
          const partBox = part.getBoundingClientRect();
          const lineHeightPx = number(partStyle.lineHeight) || number(partStyle.fontSize) * 1.2;
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.font = `${partStyle.fontStyle} ${partStyle.fontWeight} ${partStyle.fontSize} ${partStyle.fontFamily}`;
          const glyphWidth = Math.max(1, context.measureText("中").width);
          const charsPerLine = Math.max(1, Math.floor(partBox.width / glyphWidth));
          const hardMaxLines = Math.max(1, Math.floor((partBox.height + 0.5) / lineHeightPx));
          const hardMaxChars = charsPerLine * hardMaxLines;
          return {
            part: part.dataset.textLayoutPart || part.dataset.textFlowPart,
            field: part.dataset.textLayoutField || part.dataset.textFlowField || part.dataset.textLayoutPart || part.dataset.textFlowPart,
            primitive: part.dataset.textPrimitive || part.closest("[data-text-primitive]")?.dataset.textPrimitive || "",
            frame: htmlFrame(part),
            text: textValue(part),
            lineCount: renderedLineCount(part),
            typography: {
              role: Object.entries(typographyContract)
                .find(([, size]) => Math.abs(Number(size) - fontSizePt) < 0.05)?.[0] ?? "custom",
              typeface: partStyle.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
              fontSizePt,
              fontWeight: partStyle.fontWeight,
              alignment: partStyle.textAlign,
                lineHeightPt: rounded(number(partStyle.lineHeight) * 0.75),
              },
            capacity: {
              recommendedMaxChars: Math.max(1, Math.floor(hardMaxChars * 0.8)),
              hardMaxChars,
              hardMaxLines,
            },
          };
        });
        const layout = element.querySelector("[data-ppagent-text-layout]");
        return {
          textLayout: {
            id: element.dataset.textLayoutId || "",
            defaultId: element.dataset.textLayoutDefaultId || element.dataset.textLayoutId || "",
            compatible: (element.dataset.textLayoutCompatible || element.dataset.textLayoutId || "").split(",").filter(Boolean),
            contentRoles: (element.dataset.textLayoutContentRoles || "").split(",").filter(Boolean),
            status: layout?.dataset.pptTextLayoutStatus || "unresolved",
            align: layout?.dataset.textLayoutAlign || "left",
            valign: layout?.dataset.textLayoutValign || "middle",
            density: layout?.dataset.textLayoutDensity || "standard",
            parts,
          },
          innerFrame: {
            width: rounded(Math.max(0, box.width - padding.left - padding.right)),
            height: rounded(Math.max(0, box.height - padding.top - padding.bottom)),
            padding,
          },
          capacity: {
            basis: "dom-box-font-metrics",
            reliable: true,
            derived: true,
            sampleFits: layout?.dataset.pptTextLayoutStatus === "resolved",
            recommendedMaxChars: parts.reduce((sum, part) => sum + (part.capacity?.recommendedMaxChars ?? 0), 0),
            hardMaxChars: parts.reduce((sum, part) => sum + (part.capacity?.hardMaxChars ?? 0), 0),
          },
        };
      };
      const slots = [...root.querySelectorAll("[data-slot-id]")].map((element) => {
        const maxChars = Number(element.dataset.slotMaxChars);
        const maxLines = Number(element.dataset.slotMaxLines);
        const role = element.dataset.slotRole || "content";
        const contentType = element.dataset.slotContentType || (role === "icon" ? "icon" : "text");
        const textMode = element.dataset.slotTextMode || (role === "item-body" ? "flow" : "single-line");
        const metrics = contentType === "text"
          ? textSlotMetrics(element, textMode)
          : contentType === "text-flow"
            ? textFlowSlotMetrics(element)
            : contentType === "text-region"
              ? textRegionSlotMetrics(element)
            : null;
        return {
          id: element.dataset.slotId,
          role,
          field: element.dataset.slotField || "",
          itemId: element.dataset.slotItemId || "",
          regionId: element.dataset.slotRegionId || "",
          contentType,
          required: element.dataset.slotRequired === "true",
          textMode,
          listPolicy: element.dataset.slotListPolicy || (role === "item-body" ? "inline" : "none"),
          frame: htmlFrame(element),
          capacity: metrics?.capacity ?? {
            ...(Number.isFinite(maxChars) && maxChars > 0 ? { maxChars } : {}),
            ...(Number.isFinite(maxLines) && maxLines > 0 ? { maxLines } : {}),
          },
          ...(metrics ? { typography: metrics.typography, innerFrame: metrics.innerFrame } : {}),
          ...(metrics?.textFlow ? { textFlow: metrics.textFlow } : {}),
          ...(metrics?.textLayout ? { textLayout: metrics.textLayout } : {}),
          media: element.dataset.slotContentType === "icon" || element.dataset.slotRole === "icon" ? {
            type: "icon",
            provider: element.dataset.slotProvider || "",
            required: element.dataset.slotRequired === "true",
          } : null,
        };
      });
      return {
        schemaVersion: 5,
        frame: { width: rounded(rootBox.width), height: rounded(rootBox.height) },
        overflow: root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1,
        textFlowOverflows,
        textLayoutOverflows,
        textFlows: resolvedTextFlows,
        textLayouts: resolvedTextLayouts,
        nodes,
        slots,
      };
    }, resolveComponentTypography(theme));
    requireValue(!tree.overflow, `${component.id ?? "HTML Component"} 超出设计区域`);
    requireValue(!tree.textFlowOverflows.length, `${component.id ?? "HTML Component"} 的文字容器无法在规范字号内排版：${tree.textFlowOverflows.join(", ")}`);
    const textLayoutOverflowDetails = tree.slots
      .filter((slot) => tree.textLayoutOverflows.includes(slot.id))
      .map((slot) => ({
        slotId: slot.id,
        frame: slot.frame,
        innerFrame: slot.innerFrame,
        layout: slot.textLayout,
      }));
    requireValue(!tree.textLayoutOverflows.length, `${component.id ?? "HTML Component"} 的组合排版无法在安全 box 内完整呈现：${tree.textLayoutOverflows.join(", ")} ${JSON.stringify(textLayoutOverflowDetails)}`);
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
    // Artifact Tool 的 authoring unit 与浏览器一致，都是 96 DPI 的 CSS px；
    // 导出 PPTX 时它会自行换算为 PowerPoint pt。这里必须传 computed px，
    // 否则预先乘 0.75 会在导出阶段被再次换算，导致全部字号缩小 25%。
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
  // HTML 明确禁止换行的标题、标签和短能力项，在 PowerPoint 中也必须禁止
  // 自动折行；否则浏览器黄金状态是一行，最终 PPT/看板缩略图却会变成两行。
  shape.text.wrap = node.style.wrap;
}

export function compileResolvedVisualTree(slide, tree, targetFrame = tree.targetFrame) {
  requireValue(tree?.schemaVersion === TREE_SCHEMA_VERSION, `ResolvedVisualTree schemaVersion 必须为 ${TREE_SCHEMA_VERSION}`);
  const frame = normalizeFrame(targetFrame, "targetFrame");
  const transform = fittedTransform(tree, frame);
  for (const node of sortResolvedVisualNodes(tree.nodes)) {
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
            ...(node.closed ? [{ close: {} }] : []),
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

export function sortResolvedVisualNodes(nodes) {
  return [...nodes].sort((left, right) => {
    const leftPath = Array.isArray(left.stackingPath) ? left.stackingPath : [0];
    const rightPath = Array.isArray(right.stackingPath) ? right.stackingPath : [0];
    const length = Math.max(leftPath.length, rightPath.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftPath[index] ?? 0) - (rightPath[index] ?? 0);
      if (difference) return difference;
    }
    return left.order - right.order;
  });
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
