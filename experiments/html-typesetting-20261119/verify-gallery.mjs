import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const chrome = process.env.BROWSER_EXECUTABLE_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const examples = {
  review: { narrow: [1020, 720], phrases: ["2017年巡视整改有成效", "作风改进不要求立竿见影，重在持续用力", "变革落地受阻", "人力资源战略规划"] },
  spares: { narrow: [1020, 640], phrases: ["紧急需求须另走加急流程", "8%至12%", "无论金额均须报设备科备案后加急处理", "以本文为准"] },
  duty: { narrow: [1080, 650], phrases: ["连续降雨超过12小时或单日降雨量超过100毫米", "无论级别均须立即上报指挥部", "经带班领导确认方可恢复"] },
};
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1380, height: 886 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("index.html", import.meta.url).href);
  const iframe = await page.locator("#preview").elementHandle();
  for (const [id, { narrow, phrases }] of Object.entries(examples)) {
    await page.locator(`button[data-case="${id}"]`).click();
    for (const size of ["wide", "narrow"]) {
      await page.locator(`button[data-size="${size}"]`).click();
      const [width, height] = size === "wide" ? [1280, 720] : narrow;
      const previewLink = await page.locator("#open").getAttribute("href");
      const frame = await iframe.contentFrame();
      await frame.waitForURL(new URL(previewLink, import.meta.url).href);
      await frame.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height, { width, height });
      const report = await frame.evaluate(async () => {
        await document.fonts.ready;
        await window.typesettingReady;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          width: innerWidth, height: innerHeight,
          documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
          text: document.body.textContent.replace(/\s+/gu, ""),
        };
      });
      assert(report.documentWidth <= width + 1, id + " " + size + " scrolls horizontally");
      assert(report.documentHeight <= height + 1, id + " " + size + " scrolls vertically");
      for (const phrase of phrases) assert(report.text.includes(phrase), id + " misses " + phrase);
      assert.equal(await page.locator("#notes").isVisible(), id === "review");
      if (id === "review") {
        assert.equal(await frame.locator("[data-theme-header] [data-theme-role='claim']").count(), 1);
        assert.equal(await frame.locator(".body [data-theme-role='claim']").count(), 0);
        assert.equal(await frame.locator(".graph svg path").count(), 3);
      }
      results.push({ id, size, width, height, documentWidth: report.documentWidth, documentHeight: report.documentHeight, phrases });
    }
  }
  await page.locator('button[data-case="review"]').click();
  await page.locator('button[data-size="wide"]').click();
  const frame = await iframe.contentFrame();
  await frame.waitForURL("**/talk-slide/review.html");
  await frame.evaluate(async () => { await document.fonts.ready; await window.typesettingReady; });
  await page.screenshot({ path: fileURLToPath(new URL("preview.png", import.meta.url)) });
  await page.setViewportSize({ width: 430, height: 769 });
  await page.waitForFunction(() => document.documentElement.scrollWidth === innerWidth);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
await fs.writeFile(new URL("gallery-check.json", import.meta.url), JSON.stringify(results, null, 2) + "\n", "utf8");
console.table(results.map(({ id, size, width, height, documentWidth, documentHeight }) =>
  ({ id, size, width, height, documentWidth, documentHeight })));
