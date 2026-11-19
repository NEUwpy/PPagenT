import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const revision = "203a601f5b362e16671484710a476ee3e72229d9";
const upstream = new URL(`./node_modules/grid-system-${revision}/`, import.meta.url);
const info = JSON.parse(await readFile(new URL("package.json", upstream), "utf8"));
const entry = fileURLToPath(new URL("src/core.ts", upstream));
const bundle = await build({ entryPoints: [entry], bundle: true, format: "iife",
  globalName: "gridSystem", platform: "browser", write: false });
const manuscript = await readFile(new URL("../../../稿件/模拟稿库/行政信息/A04-备件供应方式对比说明.md", import.meta.url), "utf8");
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const variants = await page.evaluate((input) => {
    const context = document.createElement("canvas").getContext("2d");
    function measure(text, fontSize) {
      context.font = `${fontSize}px "Noto Sans SC", sans-serif`;
      const measured = context.measureText(text);
      return { width: measured.width, ascent: measured.fontBoundingBoxAscent, descent: measured.fontBoundingBoxDescent };
    }
    const normalize = (text) => text.replace(/\s+/gu, "");
    const original = normalize(input);
    const settings = window.gridSystem.DEFAULT_SETTINGS;
    return ["aligned", "editorial", "asymmetric", "free"].map((layout) => {
      const result = window.gridSystem.calculateLayout({
        ...settings,
        page: { ...settings.page, width: 1280, height: 720 },
        fontSize: 20, lineHeight: 30, density: 0.9, layout, seed: 6,
      }, input, measure);
      const rendered = normalize(result.blocks.map((block) => block.text).join(""));
      return {
        layout, sourceCharacters: original.length, renderedCharacters: rendered.length,
        originalCopies: rendered.split(original).length - 1,
        titleOccurrences: rendered.split("备件供应方式对比说明").length - 1,
        footerOccurrences: rendered.split("本说明自下发之日起执行").length - 1,
        warnings: result.warnings,
        blocks: result.blocks,
      };
    });
  }, manuscript);
  const result = { upstream: "https://github.com/dostevskii/grid-system", revision, version: info.version, variants };
  await writeFile(new URL("evidence/grid-system.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log(variants.map(({ blocks, ...summary }) => ({ ...summary, boxes: blocks.length })));
} finally {
  await browser.close();
}
