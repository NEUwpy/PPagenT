import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { collectLogicDashboardData, defaultProjectRoot } from "./logic-dashboard-data.mjs";

const root = defaultProjectRoot;
const outputRoot = path.join(root, ".tmp", "text-layout-dashboard-validation");
const dashboardPath = path.join(outputRoot, "ppa-dashboard.html");
const reportPath = path.join(outputRoot, "validation-report.json");
const screenshotPath = path.join(outputRoot, "ppa-text-layout-library.png");
const dashboardScreenshotPath = path.join(outputRoot, "ppa-asset-domains.png");

function rounded(value) {
  return Math.round(value * 100) / 100;
}

async function browserExecutable() {
  const candidates = [process.env.BROWSER_EXECUTABLE_PATH].filter(Boolean);
  for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA].filter(Boolean)) {
    candidates.push(path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"));
    candidates.push(path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
  }
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("未找到 Edge/Chrome，无法验证 PPA 文字排版库");
}

await fs.mkdir(outputRoot, { recursive: true });
const data = await collectLogicDashboardData(root);
const template = await fs.readFile(path.join(root, "src", "tools", "templates", "logic-dashboard.html"), "utf8");
const serialized = JSON.stringify({ ...data, mode: "text-layout-validation" }).replaceAll("<", "\\u003c");
await fs.writeFile(dashboardPath, template.replace("/*__PPAGENT_DATA__*/", `const DATA = ${serialized};`), "utf8");

const browser = await chromium.launch({ headless: true, executablePath: await browserExecutable() });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(dashboardPath).href}#text-layouts`, { waitUntil: "load" });
await page.locator("#text-layout-grid").waitFor();

const items = [];
for (const layout of data.textLayouts) {
  await page.locator(`[data-text-layout-select="${layout.id}"]`).click();
  for (const preview of layout.previews) {
    await page.locator(`[data-text-preview-select="${preview.id}"]`).click();
    const measured = await page.locator("#text-layout-detail .text-layout-preview-frame").evaluate((frame) => {
      const frameBox = frame.getBoundingClientRect();
      const layoutNode = frame.querySelector("[data-ppagent-text-layout]");
      const primitives = [...frame.querySelectorAll("[data-text-primitive]")]
        .filter((node) => !node.querySelector("[data-text-primitive]"));
      const issues = [];
      const typography = primitives.map((node) => {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        const fontSizePt = Number.parseFloat(style.fontSize) * 0.75;
        if (fontSizePt < 14.95) issues.push({ code: "font-below-minimum", field: node.dataset.textLayoutField, fontSizePt });
        if (box.left < frameBox.left - 1 || box.top < frameBox.top - 1 || box.right > frameBox.right + 1 || box.bottom > frameBox.bottom + 1) {
          issues.push({ code: "text-outside-frame", field: node.dataset.textLayoutField });
        }
        if (node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 3) {
          issues.push({ code: "text-clipped", field: node.dataset.textLayoutField });
        }
        return {
          field: node.dataset.textLayoutField,
          primitive: node.dataset.textPrimitive,
          fontSizePt,
          color: style.color,
          box: { left: box.left - frameBox.left, top: box.top - frameBox.top, width: box.width, height: box.height },
        };
      });
      if (!layoutNode) issues.push({ code: "missing-layout-node" });
      else if (layoutNode.scrollWidth > layoutNode.clientWidth + 2 || layoutNode.scrollHeight > layoutNode.clientHeight + 2) issues.push({ code: "layout-overflow" });
      return {
        surfaceId: frame.dataset.textLayoutSurface,
        backgroundColor: getComputedStyle(frame).backgroundColor,
        borderLeftColor: getComputedStyle(frame).borderLeftColor,
        issues,
        typography,
      };
    });
    items.push({
      layoutId: layout.id,
      previewId: preview.id,
      frame: preview.frame,
      surfaceId: preview.surfaceId,
      status: measured.issues.length ? "failed" : "passed",
      issues: measured.issues,
      evidence: {
        backgroundColor: measured.backgroundColor,
        borderLeftColor: measured.borderLeftColor,
        minimumFontSizePt: rounded(Math.min(...measured.typography.map((item) => item.fontSizePt))),
      },
      typography: measured.typography.map((item) => ({ ...item, fontSizePt: rounded(item.fontSizePt), box: Object.fromEntries(Object.entries(item.box).map(([key, value]) => [key, rounded(value)])) })),
    });
  }
}

const layoutScreenshots = {};
for (const layout of data.textLayouts) {
  await page.locator(`[data-text-layout-select="${layout.id}"]`).click();
  await page.locator('[data-text-preview-select="representative"]').click();
  const target = path.join(outputRoot, `${layout.id}.png`);
  await page.locator("#text-layout-detail .text-layout-preview-stage").screenshot({ path: target });
  layoutScreenshots[layout.id] = target;
}

await page.locator("#text-layouts").screenshot({ path: screenshotPath });
await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
await browser.close();

const failed = items.filter((item) => item.status === "failed").length;
const report = {
  schemaVersion: 1,
  source: "PPA 看板 / Markdown 文字库",
  activeSkin: data.activeSkin.id,
  visualStyle: "markdown-skin",
  reviewStatus: "awaiting-user-review",
  nativeGenerated: false,
  summary: {
    layoutCount: data.textLayouts.length,
    surfaceCount: data.textSurfaces.length,
    stateCount: items.length,
    passed: items.length - failed,
    failed,
    minimumFontSizePt: rounded(Math.min(...items.map((item) => item.evidence.minimumFontSizePt))),
  },
  skinTokens: data.activeSkin.componentTheme,
  layoutScreenshots,
  items,
};
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report.summary, outputRoot }, null, 2));
if (failed) process.exitCode = 1;
