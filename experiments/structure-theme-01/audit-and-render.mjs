import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";
import { PresentationFile } from "@oai/artifact-tool";
import { createPresentation } from "../../src/asset-runtime/component-builders.mjs";
import { discoverCoreAssetPackages, loadCoreAssetPackage } from "../../src/runtime/core-asset-packages.mjs";
import {
  closeHtmlComponentRuntime,
  compileResolvedVisualTree,
  resolveHtmlComponent,
} from "../../src/visual-runtime/html-component-runtime.mjs";
import {
  compileHtmlComponentTheme,
  htmlComponentThemeCss,
  resolveStructureTheme,
} from "../../src/visual-runtime/html-component-theme.mjs";
import { htmlTextFlowCss } from "../../src/visual-runtime/text-flow.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const outputDir = path.join(import.meta.dirname, "output");
const auditOnly = process.argv.includes("--audit-only");
const themes = Object.freeze({ blue: { primaryColor: "#315F91" }, purple: { primaryColor: "#6F42C1" } });
const representativeCases = Object.freeze([
  { assetId: "sequence-phase-gates-004", slug: "sequence-phase-gates-004" },
  { assetId: "matrix-cross-grid-003", slug: "matrix-cross-grid-003" },
  { assetId: "comparison-pros-cons-balance-005", slug: "comparison-pros-cons-balance-005" },
  { assetId: "hub-radial-001", slug: "hub-radial-001" },
  { assetId: "hub-directed-outcomes-002", slug: "hub-directed-outcomes-002-outward", selection: { connectionMode: "向外", nodeCount: 6 } },
  { assetId: "hub-directed-outcomes-002", slug: "hub-directed-outcomes-002-inward", selection: { connectionMode: "向内", nodeCount: 6 } },
  { assetId: "comparison-dual-verdict-001", slug: "comparison-dual-verdict-001" },
]);
const frame = Object.freeze({ left: 55, top: 166, width: 1170, height: 492 });

function chroma(hex) {
  const value = hex.slice(1, 7);
  const channels = [0, 2, 4].map((start) => Number.parseInt(value.slice(start, start + 2), 16) / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const lightness = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function collectHexStrings(value, result = new Set()) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/#[0-9A-F]{6}/gi)) result.add(match[0].toUpperCase());
  } else if (Array.isArray(value)) {
    for (const item of value) collectHexStrings(item, result);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectHexStrings(item, result);
  }
  return result;
}

function collectAuthoredColors(source) {
  const result = new Set();
  for (const match of String(source).matchAll(/#[0-9A-F]{6,8}\b|rgba?\([^)]*\)/gi)) result.add(match[0]);
  return [...result].sort((left, right) => left.localeCompare(right));
}

function scrubColors(value) {
  if (typeof value === "string") return value.replace(/#[0-9A-F]{6}/gi, "#THEME");
  if (Array.isArray(value)) return value.map(scrubColors);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === "dataUrl" && typeof item === "string" && item.startsWith("data:image/svg+xml") ? "data:image/svg+xml;THEMED" : scrubColors(item),
  ]));
  return value;
}

function paletteColors(theme) {
  const resolved = resolveStructureTheme(theme);
  return new Set([
    resolved.primaryColor,
    resolved.primaryDeep,
    resolved.primaryDark,
    resolved.primaryLight,
    resolved.primaryPale,
    resolved.primaryWash,
    resolved.accentAlt,
    resolved.accentSoft,
    resolved.cyan,
    resolved.line,
  ].map((color) => color.toUpperCase()));
}

async function reviewParameters(descriptor, selectionOverride = null) {
  const review = descriptor.runtime.review;
  const module = await import(pathToFileURL(path.resolve(descriptor.assetDir, review.entry)).href);
  const base = structuredClone(module[review.previewParametersExport]);
  const resolver = review.previewResolverExport ? module[review.previewResolverExport] : null;
  const selection = selectionOverride ?? review.exampleSelections?.[0]
    ?? Object.fromEntries((review.controls ?? []).map((control) => [control.key, control.values?.[0]]));
  return resolver ? resolver(base, selection) : base;
}

async function browserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  throw new Error("未找到 Edge");
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

async function componentDocument(assetPackage, parameters, theme) {
  let css = assetPackage.component.cssText ?? "";
  if (!css) css = await fs.readFile(path.join(assetPackage.assetDir, assetPackage.component.cssFile), "utf8");
  const compiled = compileHtmlComponentTheme({
    markup: assetPackage.component.renderMarkup(parameters),
    css,
    theme,
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:1170px;height:492px;overflow:hidden}${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${compiled.css}</style></head><body>${compiled.markup}</body></html>`;
}

await fs.mkdir(outputDir, { recursive: true });
for (const obsolete of ["hub-directed-outcomes-002-blue-purple.html", "hub-directed-outcomes-002-blue-purple.png"]) {
  await fs.rm(path.join(outputDir, obsolete), { force: true });
}
const descriptors = (await discoverCoreAssetPackages(root)).filter((item) => item.runtime.renderer === "html-component");
if (descriptors.length !== 35) throw new Error(`核心结构数量应为 35，实际 ${descriptors.length}`);

const audit = [];
const inventory = [];
const treesByAsset = new Map();
try {
  for (const descriptor of descriptors) {
    const assetPackage = await loadCoreAssetPackage(descriptor.assetId, root);
    const parameters = await reviewParameters(descriptor);
    let authoredCss = assetPackage.component.cssText ?? "";
    if (!authoredCss) authoredCss = await fs.readFile(path.join(assetPackage.assetDir, assetPackage.component.cssFile), "utf8");
    const authoredMarkup = assetPackage.component.renderMarkup(parameters);
    const reviewSource = await fs.readFile(path.resolve(descriptor.assetDir, descriptor.runtime.review.entry), "utf8");
    const runtimeSource = await fs.readFile(descriptor.entryPath, "utf8");
    const authoredColors = collectAuthoredColors(`${authoredCss}\n${reviewSource}\n${runtimeSource}\n${authoredMarkup}`);
    inventory.push({
      assetId: descriptor.assetId,
      assetDir: path.relative(root, descriptor.assetDir).replaceAll("\\", "/"),
      authoredColorLiteralCount: authoredColors.length,
      authoredColors,
      inspectedSources: [descriptor.runtime.review.entry, descriptor.runtime.entry, assetPackage.component.cssFile ?? "inline css"],
      sharedThemeBoundary: "resolveHtmlComponent + PPA componentPreviewHtml",
    });
    const themedTrees = {};
    for (const [themeName, theme] of Object.entries(themes)) {
      const tree = await resolveHtmlComponent({
        component: assetPackage.component,
        parameters,
        assetDir: descriptor.assetDir,
        targetFrame: frame,
        theme,
      });
      const colors = collectHexStrings(tree);
      const palette = paletteColors(theme);
      const offPalette = [...colors].filter((color) => chroma(color) >= 0.075 && !palette.has(color));
      if (offPalette.length) throw new Error(`${descriptor.assetId}/${themeName} 存在非主题色：${offPalette.join(", ")}`);
      themedTrees[themeName] = tree;
      audit.push({ assetId: descriptor.assetId, theme: themeName, nodeCount: tree.nodes.length, colors: [...colors].sort(), offPalette });
    }
    if (JSON.stringify(scrubColors(themedTrees.blue)) !== JSON.stringify(scrubColors(themedTrees.purple))) {
      throw new Error(`${descriptor.assetId} 换色改变了颜色以外的解析结果`);
    }
    treesByAsset.set(descriptor.assetId, { parameters, ...themedTrees });
  }

  if (!auditOnly) {
    const nativeDeck = createPresentation();
    for (const representative of representativeCases) {
      const assetPackage = await loadCoreAssetPackage(representative.assetId, root);
      const descriptor = descriptors.find((item) => item.assetId === representative.assetId);
      const parameters = representative.selection
        ? await reviewParameters(descriptor, representative.selection)
        : treesByAsset.get(representative.assetId).parameters;
      for (const themeName of Object.keys(themes)) {
        const slide = nativeDeck.slides.add();
        slide.background.fill = "#FFFFFF";
        const tree = representative.selection
          ? await resolveHtmlComponent({ component: assetPackage.component, parameters, assetDir: assetPackage.assetDir, targetFrame: frame, theme: themes[themeName] })
          : treesByAsset.get(representative.assetId)[themeName];
        compileResolvedVisualTree(slide, tree, frame);
      }
    }
    const nativePath = path.join(outputDir, "representative-native-blue-purple.pptx");
    await (await PresentationFile.exportPptx(nativeDeck)).save(nativePath);
    const nativeRenderDir = path.join(outputDir, "native-render");
    await fs.mkdir(nativeRenderDir, { recursive: true });
    for (const [index, slide] of [...nativeDeck.slides.items].entries()) {
      const image = await nativeDeck.export({ slide, format: "png", scale: 1 });
      await fs.writeFile(path.join(nativeRenderDir, `slide-${String(index + 1).padStart(2, "0")}.png`), Buffer.from(await image.arrayBuffer()));
      const layout = await slide.export({ format: "layout" });
      await fs.writeFile(path.join(nativeRenderDir, `slide-${String(index + 1).padStart(2, "0")}.layout.json`), await layout.text(), "utf8");
    }

    const browser = await chromium.launch({ headless: true, executablePath: await browserExecutable() });
    try {
      for (const representative of representativeCases) {
        const assetPackage = await loadCoreAssetPackage(representative.assetId, root);
        const descriptor = descriptors.find((item) => item.assetId === representative.assetId);
        const parameters = representative.selection
          ? await reviewParameters(descriptor, representative.selection)
          : treesByAsset.get(representative.assetId).parameters;
        const blue = await componentDocument(assetPackage, parameters, themes.blue);
        const purple = await componentDocument(assetPackage, parameters, themes.purple);
        const comparison = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;background:#f1f1f1;font-family:"Microsoft YaHei"}.row{display:flex;gap:14px}.panel{background:#fff}.label{height:30px;padding-left:10px;font-weight:700;line-height:30px;color:#333}iframe{display:block;width:1170px;height:492px;border:0}</style></head><body><div class="row"><section class="panel"><div class="label">默认蓝 #315F91</div><iframe srcdoc="${escapeAttribute(blue)}"></iframe></section><section class="panel"><div class="label">替换紫 #6F42C1</div><iframe srcdoc="${escapeAttribute(purple)}"></iframe></section></div></body></html>`;
        const htmlPath = path.join(outputDir, `${representative.slug}-blue-purple.html`);
        await fs.writeFile(htmlPath, comparison, "utf8");
        const page = await browser.newPage({ viewport: { width: 2382, height: 550 }, deviceScaleFactor: 1 });
        await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
        await page.screenshot({ path: path.join(outputDir, `${representative.slug}-blue-purple.png`), fullPage: true });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await closeHtmlComponentRuntime();
}

await fs.writeFile(path.join(outputDir, "theme-audit.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  coreStructureCount: descriptors.length,
  primaryColors: Object.fromEntries(Object.entries(themes).map(([key, value]) => [key, value.primaryColor])),
  inventory,
  records: audit,
}, null, 2), "utf8");

const inventoryRows = inventory.map((item) => `| ${item.assetId} | ${item.assetDir} | ${item.authoredColorLiteralCount} | 已接管 |`).join("\n");
await fs.writeFile(path.join(import.meta.dirname, "INVENTORY.md"), `# 35 个核心结构颜色来源盘点

本表盘点各核心组件在代表状态下的 CSS 与 markup 彩色字面量来源。源码中的历史字面量仍保留用于旧调用兼容；当 Skin 明确提供 \`primaryColor\` 时，它们在浏览器解析前被映射到共享离散色阶。PPA HTML 与 \`resolveHtmlComponent\` 均调用同一编译入口。

| Asset ID | 资产目录 | 代表状态颜色字面量数 | 新主题接管 |
| --- | --- | ---: | --- |
${inventoryRows}

逐项原始颜色、蓝/紫解析树最终颜色及非主题色检查见 [output/theme-audit.json](output/theme-audit.json)。
`, "utf8");

console.log(JSON.stringify({
  status: "passed",
  coreStructureCount: descriptors.length,
  records: audit.length,
  representatives: representativeCases.map((item) => item.slug),
}, null, 2));
