import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { htmlComponentThemeCss } from "../visual-runtime/html-component-theme.mjs";
import {
  listPageExpressionPrototypes,
  pageExpressionPrototypeCss,
} from "../visual-runtime/page-expression-prototype.mjs";
import { northeasternUniversityTheme } from "../runtime/skins/northeastern-university-theme.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(root, ".tmp", "page-expression-prototype-validation");
const htmlPath = path.join(outputRoot, "page-expression-prototypes.html");
const reportPath = path.join(outputRoot, "validation-report.json");

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
  throw new Error("未找到 Edge/Chrome，无法验证2+3组合原型");
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

const prototypes = listPageExpressionPrototypes();
await fs.mkdir(outputRoot, { recursive: true });
const runtimeCss = `${htmlComponentThemeCss(northeasternUniversityTheme)}${pageExpressionPrototypeCss()}`;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>PPagenT 2+3 组合原型验证</title><style>
  ${runtimeCss}
  *{box-sizing:border-box}body{margin:0;padding:32px;background:#e9eef4;font-family:"Microsoft YaHei",sans-serif}.case{width:1234px;margin:0 auto 34px;padding:24px 31px 30px;background:#fff}.case h1{margin:0 0 5px;font-size:22px}.case p{margin:0 0 16px;color:#66768a;font-size:14px}.frame{width:1170px;height:492px;border:1px solid #aebed1}
</style></head><body>${prototypes.map((prototype) => `<section class="case" data-prototype-id="${prototype.id}"><h1>${prototype.name}</h1><p>${prototype.description}</p><div class="frame">${prototype.markup}</div></section>`).join("")}</body></html>`;
await fs.writeFile(htmlPath, html, "utf8");

const browser = await chromium.launch({ headless: true, executablePath: await browserExecutable() });
const page = await browser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });

const results = [];
for (const prototype of prototypes) {
  const target = page.locator(`[data-prototype-id="${prototype.id}"]`);
  const screenshotPath = path.join(outputRoot, `${prototype.id}.png`);
  await target.screenshot({ path: screenshotPath });
  const measured = await target.locator(".ppagent-expression-page").evaluate((rootNode) => {
    const rootBox = rootNode.getBoundingClientRect();
    const issues = [];
    const textNodes = [...rootNode.querySelectorAll('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]')]
      .filter((node) => !node.querySelector('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]'));
    const assertNotClippedByAncestor = (node, box, label) => {
      let ancestor = node.parentElement;
      while (ancestor && rootNode.contains(ancestor)) {
        const style = getComputedStyle(ancestor);
        if ([style.overflow, style.overflowX, style.overflowY].some((value) => value === "hidden" || value === "clip")) {
          const ancestorBox = ancestor.getBoundingClientRect();
          if (box.left < ancestorBox.left - 1 || box.top < ancestorBox.top - 1 || box.right > ancestorBox.right + 1 || box.bottom > ancestorBox.bottom + 1) {
            issues.push({ code: "node-clipped-by-ancestor", name: label, ancestor: ancestor.dataset.expressionId || ancestor.className });
            return;
          }
        }
        if (ancestor === rootNode) return;
        ancestor = ancestor.parentElement;
      }
    };
    const typography = textNodes.map((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const fontSizePt = Number.parseFloat(style.fontSize) * 0.75;
      if (fontSizePt < 14.95) issues.push({ code: "font-below-minimum", name: node.dataset.pptName, fontSizePt });
      if (box.left < rootBox.left - 1 || box.top < rootBox.top - 1 || box.right > rootBox.right + 1 || box.bottom > rootBox.bottom + 1) {
        issues.push({ code: "text-outside-content-frame", name: node.dataset.pptName });
      }
      if (node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 3) {
        issues.push({ code: "text-clipped", name: node.dataset.pptName, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight });
      }
      assertNotClippedByAncestor(node, box, node.dataset.pptName);
      return { name: node.dataset.pptName, fontSizePt, text: node.textContent.trim() };
    });
    const expressionNodes = [...rootNode.querySelectorAll("[data-expression-id]")];
    for (const node of expressionNodes) {
      const box = node.getBoundingClientRect();
      if (box.left < rootBox.left - 1 || box.top < rootBox.top - 1 || box.right > rootBox.right + 1 || box.bottom > rootBox.bottom + 1) {
        issues.push({ code: "expression-outside-content-frame", expressionId: node.dataset.expressionId });
      }
      if (node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 3) {
        issues.push({ code: "expression-overflow", expressionId: node.dataset.expressionId });
      }
    }
    const groups = new Map();
    for (const node of expressionNodes) {
      const parent = node.parentElement?.closest("[data-expression-id]");
      const key = parent?.dataset.expressionId ?? "page-root";
      const list = groups.get(key) ?? [];
      list.push(node);
      groups.set(key, list);
    }
    for (const [parentId, siblings] of groups) {
      for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
          const left = siblings[leftIndex].getBoundingClientRect();
          const right = siblings[rightIndex].getBoundingClientRect();
          const overlapWidth = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
          const overlapHeight = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
          if (overlapWidth * overlapHeight > 4) {
            issues.push({ code: "unexpected-expression-overlap", parentId, left: siblings[leftIndex].dataset.expressionId, right: siblings[rightIndex].dataset.expressionId });
          }
        }
      }
    }
    return {
      issues,
      minimumFontSizePt: Math.min(...typography.map((item) => item.fontSizePt)),
      expressionCount: expressionNodes.length,
      maximumStructureDepth: Math.max(0, ...expressionNodes.map((node) => Number(node.dataset.structureDepth) || 0)),
      typography,
    };
  });
  results.push({
    prototypeId: prototype.id,
    status: measured.issues.length ? "failed" : "passed",
    issues: measured.issues,
    evidence: {
      minimumFontSizePt: rounded(measured.minimumFontSizePt),
      expressionCount: measured.expressionCount,
      maximumStructureDepth: measured.maximumStructureDepth,
      contentCoverage: prototype.validation.coverage,
      screenshotPath,
    },
    typography: measured.typography.map((item) => ({ ...item, fontSizePt: rounded(item.fontSizePt) })),
  });
}
await browser.close();

const failed = results.filter((item) => item.status === "failed").length;
const report = {
  schemaVersion: "0.1",
  source: "PPA 排版系统 / 2+3 页面表达原型",
  reviewStatus: "awaiting-user-review",
  nativeGenerated: false,
  formalPipelineConnected: false,
  summary: {
    prototypeCount: results.length,
    passed: results.length - failed,
    failed,
    minimumFontSizePt: rounded(Math.min(...results.map((item) => item.evidence.minimumFontSizePt))),
    maximumStructureDepth: Math.max(...results.map((item) => item.evidence.maximumStructureDepth)),
  },
  htmlPath,
  results,
};
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report.summary, outputRoot, htmlPath }, null, 2));
if (failed) process.exitCode = 1;
