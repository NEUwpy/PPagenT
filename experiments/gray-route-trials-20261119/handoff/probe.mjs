import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import { chromium } from "playwright-core";

const directory = path.dirname(fileURLToPath(import.meta.url));
const prior = path.resolve(directory, "../../html-library-reuse-20261119/evidence");
const source = await fs.readFile(path.join(prior, "native-a-tree.json"), "utf8");
const tree = JSON.parse(source);
const out = path.join(directory, "output");
const pxIn = (px) => px / 96;
const pxPt = (px) => px * 0.75;
const color = (hex) => hex.replace(/^#/, "");
const roundPx = (px) => Math.round(px * 1000) / 1000;
const normalize = (text) => text.replace(/\s/gu, "");
const box = ({ left, top, width, height, rotation = 0 }) => ({
  x: pxIn(left), y: pxIn(top), w: pxIn(width), h: pxIn(height), rotate: rotation,
});

await fs.mkdir(out, { recursive: true });

async function inspectBrowser() {
  const executablePath = process.env.BROWSER_EXECUTABLE_PATH
    || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.setContent(tree.resolvedDocument);
    const view = await page.evaluate(async () => {
      await document.fonts.ready;
      const marked = [...document.querySelectorAll("[data-ppt-root] [data-ppt-kind]")];
      const toList = (style, properties) =>
        Object.fromEntries(properties.map((prop) => [prop, style.getPropertyValue(prop)]));
      function paragraphText(element) {
        return [...element.childNodes].map((node) => {
          if (node.nodeType === Node.TEXT_NODE) return node.data;
          if (node.nodeType !== Node.ELEMENT_NODE || getComputedStyle(node).display === "none") return "";
          return node.tagName === "BR" ? "\n" : paragraphText(node);
        }).join("").trim();
      }
      function inspectElement(el) {
        const kind = el.dataset.pptKind;
        const name = el.dataset.pptName;
        const style = getComputedStyle(el);
        const text = ["text", "shape-text"].includes(kind);
        const lines = [];
        if (text) {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (getComputedStyle(node.parentElement).visibility === "hidden") continue;
            const runStyle = getComputedStyle(node.parentElement);
            for (let offset = 0; offset < node.length; offset += 1) {
              range.setStart(node, offset);
              range.setEnd(node, offset + 1);
              const rect = range.getClientRects()[0];
              if (!rect || rect.width === 0) continue;
              const center = rect.top + rect.height / 2;
              let line = lines.find((match) => Math.abs(match.center - center) < 5);
              if (!line) {
                line = { value: "", center, left: rect.left, right: rect.right, styles: [] };
                lines.push(line);
              }
              line.value += node.data[offset];
              line.left = Math.min(line.left, rect.left);
              line.right = Math.max(line.right, rect.right);
              const run = [runStyle.fontFamily, runStyle.fontWeight, runStyle.fontSize, runStyle.color];
              if (!line.styles.some((entry) => JSON.stringify(entry) === JSON.stringify(run))) {
                line.styles.push(run);
              }
            }
          }
        }
        const borders = toList(style, ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"]);
        const pathData = kind === "path" ? el.getAttribute("d") : null;
        const cubic = pathData?.match(/^M\s+([\d.-]+)\s+([\d.-]+)\s+C\s+([\d.-]+)\s+([\d.-]+),\s*([\d.-]+)\s+([\d.-]+),\s*([\d.-]+)\s+([\d.-]+)$/);
        const controlPoints = [];
        if (cubic) {
          const coords = cubic.slice(1).map(Number);
          for (let i = 0; i < coords.length; i += 2) {
            const p = new DOMPoint(coords[i], coords[i + 1]).matrixTransform(el.getScreenCTM());
            controlPoints.push({ x: p.x, y: p.y });
          }
        }
        return {
          kind, name, lines, borders, controlPoints, logicalText: text ? paragraphText(el) : null,
          computedTextStyle: text ? toList(style, ["font-family", "font-size", "line-height", "padding-left", "padding-right"]) : null,
        };
      }
      const view = marked.filter((el) => el.getClientRects().length > 0).map(inspectElement);
      const stress = [];
      for (const name of ["page-a-text-8", "page-a-text-12"]) {
        const original = marked.find((el) => el.dataset.pptName === name);
        const first = inspectElement(original).lines[0];
        for (const offset of [-2, -0.5, 0, 0.5, 2]) {
          const width = first.right - first.left + offset;
          const clone = original.cloneNode(true);
          clone.style.cssText += `position:absolute;width:${width}px;height:auto;margin:0`;
          original.parentElement.append(clone);
          stress.push({ ...inspectElement(clone), width, offset });
          clone.remove();
        }
      }
      return { view, stress };
    });
    return { version: browser.version(), ...view };
  } finally {
    await browser.close();
  }
}

const browser = await inspectBrowser();
const byName = new Map();
for (const item of browser.view) {
  if (!byName.has(item.name)) byName.set(item.name, []);
  byName.get(item.name).push(item);
}
const items = tree.nodes.map((node) => {
  const browserItem = byName.get(node.name)?.shift();
  assert(browserItem, `Missing DOM leaf: ${node.name}`);
  return {
    objectName: `source-${String(node.order).padStart(2, "0")}-${node.name}`,
    node, browserItem,
  };
});
const stressItems = browser.stress.map((browserItem, index) => {
  const source = items.find((item) => item.node.name === browserItem.name);
  return {
    objectName: `stress-${index}-${source.node.name}`,
    browserItem,
    node: {
      ...source.node,
      frame: {
        left: index >= 5 ? 700 : 55,
        top: 45 + (index % 5) * 125,
        width: browserItem.width,
        height: 110,
      },
    },
  };
});

const diagnostics = [];
for (const { objectName, node, browserItem } of items) {
  if (node.fill?.type === "gradient") diagnostics.push({
    objectName, code: "gradient-fallback", effect: "Shell gradient emitted as first stop for this probe.",
  });
  if (new Set(Object.values(browserItem.borders)).size > 1) diagnostics.push({
    objectName, code: "per-edge-stroke-absent", borders: browserItem.borders, serializedStroke: node.line ?? null,
  });
  if (browserItem.lines.some((line) => line.styles.length > 1)) diagnostics.push({
    objectName, code: "mixed-text-run-absent", runs: browserItem.lines.map((line) => line.styles),
  });
}

function nativeGeometry(node) {
  assert(["rect", "roundRect"].includes(node.geometry), `Unsupported geometry ${node.geometry}`);
  return {
    shape: node.geometry,
    rectRadius: node.borderRadius ? pxIn(node.borderRadius) : undefined,
    fill: typeof node.fill === "string"
      ? node.fill === "none" ? undefined : { color: color(node.fill) }
      : { color: color(node.fill.stops[0].color) },
    line: node.line?.width
      ? { color: color(node.line.fill), width: pxPt(node.line.width) }
      : { type: "none" },
  };
}

function addText(slide, item, frame, lockLines) {
  const { node, browserItem } = item;
  const style = node.style;
  const shapeOptions = node.kind === "shape-text" ? nativeGeometry(node) : {};
  const lines = browserItem.lines.map((line) => line.value);
  const useBreaks = lockLines && lines.length > 1 && normalize(lines.join("")) === normalize(node.text);
  // The older tree's text contains browser reflow line breaks. Natural
  // PowerPoint wrap must start from the DOM paragraph, including any explicit breaks.
  const logicalText = browserItem.logicalText;
  assert(typeof logicalText === "string" && normalize(logicalText) === normalize(node.text), item.objectName);
  const text = useBreaks ? lines.map((value, index) => ({
    text: value, options: { softBreakBefore: index > 0 },
  })) : logicalText;
  slide.addText(text, {
    ...frame, ...shapeOptions,
    fontFace: style.typeface,
    fontSize: style.fontSizePt,
    color: color(style.color),
    bold: style.bold,
    italic: style.italic,
    align: style.alignment,
    valign: style.verticalAlignment,
    margin: 0,
    fit: "none",
    wrap: useBreaks ? false : style.wrap !== "none",
    lineSpacing: style.fontSizePt * style.lineSpacing,
    lang: "zh-CN",
  });
}

function addPath(slide, item, frame, mode) {
  const { node, browserItem } = item;
  assert.equal(browserItem.controlPoints.length, 4);
  const [start, c1, c2, end] = browserItem.controlPoints.map((point) => ({
    x: pxIn(point.x - node.frame.left),
    y: pxIn(point.y - node.frame.top),
  }));
  const points = mode === "preserve-lines" ? [
    { ...start, moveTo: true },
    { ...end, curve: { type: "cubic", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y } },
  ] : node.points.map(({ x, y }) => ({ x: pxIn(x), y: pxIn(y) }));
  slide.addShape("custGeom", {
    ...frame, points,
    line: { color: color(node.line.fill), width: pxPt(node.line.width) },
  });
}

for (const mode of ["natural", "preserve-lines"]) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "Gray1280", width: pxIn(1280), height: pxIn(720) });
  pptx.layout = "Gray1280";
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  for (const item of items) {
    const { node, objectName } = item;
    const frame = { ...box(node.frame), objectName };
    switch (node.kind) {
      case "text":
      case "shape-text":
        addText(slide, item, frame, mode === "preserve-lines");
        break;
      case "shape":
        slide.addShape(node.geometry, { ...frame, ...nativeGeometry(node) });
        break;
      case "path":
        addPath(slide, item, frame, mode);
        break;
      case "image":
        slide.addImage({ ...frame, data: node.dataUrl, altText: node.alt });
        break;
      default:
        throw new Error(`Unsupported node ${node.kind}`);
    }
  }
  const stressSlide = pptx.addSlide();
  for (const item of stressItems) {
    addText(stressSlide, item, { ...box(item.node.frame), objectName: item.objectName }, mode === "preserve-lines");
  }
  await pptx.writeFile({ fileName: path.join(out, `${mode}.pptx`) });
}

async function buildBridgeProbe() {
  const file = path.resolve(directory, "../bridge/output/duty-standard.layout.json");
  const content = await fs.readFile(file, "utf8");
  const layout = JSON.parse(content);
  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: "GrayBridge", width: pxIn(layout.canvas.width), height: pxIn(layout.canvas.height),
  });
  pptx.layout = "GrayBridge";
  const slide = pptx.addSlide();
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const objects = [];
  for (const id of layout.readingOrder) {
    const node = byId.get(id);
    assert(node?.sourceId && typeof node.text === "string", `Missing bridge text ${id}`);
    const { x, y, width, height } = node.bounds;
    const { family, sizePx, lineHeightPx, align, weight } = node.typography;
    slide.addText(node.text, {
      objectName: node.id, x: pxIn(x), y: pxIn(y), w: pxIn(width), h: pxIn(height),
      fontFace: family.split(",")[0].trim().replace(/^"|"$/g, ""),
      fontSize: pxPt(sizePx), lineSpacing: pxPt(lineHeightPx), bold: weight >= 600, align,
      valign: "top", margin: 0, fit: "none", wrap: true, lang: "zh-CN",
    });
    objects.push({
      objectName: node.id, kind: "text", text: node.text, sourceId: node.sourceId,
      frame: { left: x, top: y, width, height },
      browserLineBounds: node.lineBounds, role: node.role,
    });
  }
  await pptx.writeFile({ fileName: path.join(out, "bridge-duty.pptx") });
  return {
    source: path.relative(directory, file).replaceAll("\\", "/"),
    sourceSha256: createHash("sha256").update(content).digest("hex"),
    objects,
  };
}

function detail({ objectName, node, browserItem }) {
  return {
    objectName, kind: node.kind, frame: node.frame, text: browserItem.logicalText ?? node.text,
    browserTextStyle: browserItem.computedTextStyle,
    browserLines: browserItem.lines.map((line) => ({ ...line, center: roundPx(line.center) })),
    pathControlPoints: browserItem.controlPoints,
    widthOffset: browserItem.offset,
  };
}

const receipt = {
  source: path.relative(directory, path.join(prior, "native-a-tree.json")).replaceAll("\\", "/"),
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  browserVersion: browser.version,
  nativeEngine: new PptxGenJS().version,
  diagnostics,
  objects: items.map(detail),
  stress: stressItems.map(detail),
  bridge: await buildBridgeProbe(),
};
await fs.writeFile(path.join(out, "inputs.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(`Exported ${items.length} objects per deck with ${diagnostics.length} style diagnostics.`);
