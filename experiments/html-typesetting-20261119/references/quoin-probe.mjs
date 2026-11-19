import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const revision = "cba04515852af5bbd4da7f6d6a5f404d8d708162";
const source = new URL(`node_modules/quoin-${revision}/`, import.meta.url);
const entry = fileURLToPath(new URL("src/global.ts", source));
const { version, license } = JSON.parse(await readFile(new URL("package.json", source), "utf8"));
const bundle = await build({ entryPoints: [entry], bundle: true, format: "iife", platform: "browser", write: false });
const html = await readFile(new URL("index.html", import.meta.url), "utf8");
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const reports = [];
let wideExport = "";
try {
  for (const { width, height } of [{ width: 1280, height: 720 }, { width: 1020, height: 640 }]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const before = await page.evaluate(() => {
      const result = window.quoin.verifyGrid({ pitch: 4, ignore: ["h1", ".measure"] });
      return result.report;
    });
    const { seating, after, rowStart, bottom } = await page.evaluate(() => {
      const options = { pitch: 4, ignore: ["h1", ".measure"] };
      const seating = window.quoin.seatPage({ ...options, mode: "full" });
      window.quoinProbeSeating = seating;
      const after = window.quoin.verifyGrid(options).report;
      const rowStart = [...document.querySelectorAll(".method .copy")].map((element) => element.getBoundingClientRect().top);
      return { seating, after, rowStart, bottom: document.querySelector(".notice").getBoundingClientRect().bottom };
    });
    await page.screenshot({ path: fileURLToPath(new URL(`evidence/quoin-${width}.png`, import.meta.url)) });
    const exportResult = await page.evaluate(() => window.quoin.exportCssVerified(window.quoinProbeSeating));
    const record = { width, height, before, after, rowStart, bottom,
      blocks: seating.blocks, missed: seating.missed, passes: seating.passes, verification: exportResult.check };
    if (width === 1280) {
      wideExport = exportResult.css;
      await writeFile(new URL("evidence/quoin-wide.css", import.meta.url), wideExport);
    } else {
      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.addStyleTag({ content: wideExport });
      record.replayedWide = await page.evaluate(() => window.quoin.verifyGrid({ pitch: 4, ignore: ["h1", ".measure"] }).report);
    }
    reports.push(record);
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(new URL("evidence/quoin.json", import.meta.url), JSON.stringify({ revision, version, license, reports }, null, 2) + "\n");
console.log(JSON.stringify(reports.map(({ width, before, after, bottom, passes, missed, replayedWide }) => ({
  width, before, after, bottom, passes, missed, replayedWide,
})), null, 2));
