import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { buildSourceBlocks } from "../../../src/content/source-blocks.mjs";

const sourceUrl = new URL("../../../稿件/模拟稿库/行政信息/A04-备件供应方式对比说明.md", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const blocks = buildSourceBlocks(source);
const coverage = [];
const stylesheet = await readFile(new URL("page.css", import.meta.url), "utf8");
const encode = (value) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function bind(key, paragraph, quote, output = encode(quote)) {
  const block = blocks[paragraph - 1];
  const position = block.text.indexOf(quote);
  assert.notEqual(position, -1, key);
  const offset = source.indexOf(block.text, block.start);
  coverage.push({ key, sourceBlock: block.id, span: [offset + position, offset + position + quote.length], quote });
  return `<span data-bind="${key}" data-source="${block.id}">${output}</span>`;
}

const title = blocks[0].text;
const content = `<article class="slide" data-page><div class="composition">
  <header>
    <h1>${bind("title", 1, title)}</h1>
    <p class="introduction">${bind("comparison-source", 2, "设备科对现行两种备件供应方式作了对比。")}${bind("parallel-compatibility", 3, "两种方式并非互斥。")}</p>
  </header>
  <div class="comparison">
    <section class="method" aria-labelledby="central">
      <h2 id="central">${bind("central-label", 2, "集中供应")}</h2>
      <p class="measure">${bind("central-time-label", 2, "配送周期平均")} <strong>${bind("central-time", 2, "5 个工作日", '<span class="number">5</span> 个工作日')}</strong></p>
      <p class="copy">${bind("central-method", 2, "中心库统一采购、统一配送", "中心库统一采购、统一配送。")}${bind("central-cost", 2, "单件采购成本较低", "单件采购成本较低。")}${bind("central-emergency", 2, "紧急需求须另走加急流程", "紧急需求须另走加急流程。")}</p>
      <p class="copy fit">${bind("central-fit", 3, "常用件适合集中供应", "适合常用件")}。</p>
    </section>
    <section class="method" aria-labelledby="local">
      <h2 id="local">${bind("local-label", 2, "就近供应")}</h2>
      <p class="measure">${bind("local-time-label", 2, "响应时间可缩短至")} <strong>${bind("local-time", 2, "1 个工作日以内", '<span class="number">1</span> 个工作日以内')}</strong></p>
      <p class="copy">${bind("local-method", 2, "各站点自行采购", "各站点自行采购。")}${bind("local-cost", 2, "单价普遍高出 8% 至 12%", '单价普遍高出 <b>8% 至 12%</b>。')}</p>
      <p class="copy fit">${bind("local-fit", 3, "价值低、消耗快的易损件适合就近供应", "适合价值低、消耗快的易损件")}。</p>
    </section>
  </div>
  <div class="regulations">
    <section aria-labelledby="grade">
      <h3 id="grade">${bind("classification", 3, "建议按备件分级确定供应方式", "分级建议")}</h3>
      <p class="copy">${bind("threshold", 3, "单件价值 500 元以上的集中采购，500 元以下的由站点自行采购。", "单件价值 <strong>500 元以上</strong>的集中采购，<strong>500 元以下</strong>的由站点自行采购。")}</p>
    </section>
    <section aria-labelledby="exception">
      <h3 id="exception">关键备件例外</h3>
      <p class="copy">${bind("safety-override", 3, "涉及安全停机的关键备件，无论金额均须报设备科备案后加急处理。", "涉及安全停机的关键备件，<strong>无论金额</strong>均须报设备科备案后加急处理。")}</p>
    </section>
  </div>
  <p class="notice">${bind("effective-date-and-precedence", 4, blocks[3].text)}</p>
</div></article>`;

function document(route) {
  return `<!doctype html>
<html lang="zh-CN"${route === "first" ? ' class="first"' : ""}>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${encode(title)}</title>
<style>${stylesheet}</style>
<body>${content}</body>
</html>`;
}

await mkdir(new URL("evidence/", import.meta.url), { recursive: true });
const chrome = process.env.BROWSER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: chrome });
const profiles = [
  { key: "first", file: "evidence/first.html", width: 1280, height: 720, route: "first" },
  { key: "landscape", file: "index.html", width: 1280, height: 720, route: "final" },
  { key: "narrow", file: "index.html", width: 1020, height: 640, route: "final" },
  { key: "phone", file: "index.html", width: 560, height: 900, route: "final" },
];
const reports = [];
try {
  for (const profile of profiles) {
    const html = document(profile.route);
    await writeFile(new URL(profile.file, import.meta.url), html);
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const protocol = await page.context().newCDPSession(page);
    await protocol.send("DOM.enable");
    await protocol.send("CSS.enable");
    const { root } = await protocol.send("DOM.getDocument");
    const platformFonts = {};
    for (const selector of ["h1", ".number", ".copy", ".notice"]) {
      const { nodeId } = await protocol.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      const { fonts } = await protocol.send("CSS.getPlatformFontsForNode", { nodeId });
      platformFonts[selector] = fonts.map(({ familyName }) => familyName);
    }
    const measured = await page.evaluate(() => {
      // Reading the inline box baseline is the zero-size marker technique from
      // bkazez/css-baseline-grid, applied to our measured text paragraphs.
      function baseline(node) {
        const marker = document.createElement("span");
        Object.assign(marker.style, {
          display: "inline-block", width: "0", height: "0", verticalAlign: "baseline",
        });
        node.prepend(marker);
        const y = marker.getBoundingClientRect().top;
        marker.remove();
        return y;
      }
      const text = [...document.querySelectorAll("[data-bind]")].map((node) => {
        const range = new Range();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].map(({ left, top, right, bottom }) => ({ left, top, right, bottom }));
        return { key: node.dataset.bind, text: node.textContent, rects,
          fontSize: parseFloat(getComputedStyle(node).fontSize) };
      });
      const copyBaselines = [...document.querySelectorAll(".method .copy")]
        .map((copy) => ({ text: copy.textContent, y: baseline(copy) }));
      return { text, copyBaselines,
        layout: getComputedStyle(document.querySelector(".regulations")).gridTemplateColumns,
        overflow: { x: document.body.scrollWidth - innerWidth, y: document.body.scrollHeight - innerHeight },
        features: { subgrid: CSS.supports("grid-template-rows", "subgrid"), pretty: CSS.supports("text-wrap", "pretty") },
      };
    });
    assert.deepEqual(measured.text.map(({ key }) => key).sort(), coverage.map(({ key }) => key).sort());
    assert.ok(measured.text.every(({ rects, fontSize }) => rects.length > 0 && fontSize >= 18));
    assert.equal(measured.overflow.x, 0);
    measured.outsideSlide = measured.text.filter(({ rects }) =>
      rects.some(({ left, right, top, bottom }) => left < -.5 || right > profile.width + .5 || top < -.5 || bottom > profile.height + .5))
      .map(({ key }) => key);
    if (profile.key === "landscape" || profile.key === "narrow") {
      assert.deepEqual(measured.outsideSlide, [], profile.key);
    }
    const screenshot = profile.key === "landscape" ? "preview.png" : `evidence/${profile.key}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(screenshot, import.meta.url)), fullPage: profile.key === "phone" });
    reports.push({ ...profile, ...measured, platformFonts, screenshot });
    await page.close();
  }
} finally {
  await browser.close();
}
const input = { file: "稿件/模拟稿库/行政信息/A04-备件供应方式对比说明.md", sha256: createHash("sha256").update(source).digest("hex") };
await writeFile(new URL("evidence/results.json", import.meta.url), JSON.stringify({
  input, coverage, reports, browser: browser.version(),
}, null, 2) + "\n");
for (const { key, outsideSlide, overflow, copyBaselines, layout } of reports) {
  console.log(key, "rules", layout, "outside", outsideSlide, "overflow", overflow, "methods", copyBaselines.map(({ y }) => y));
}
