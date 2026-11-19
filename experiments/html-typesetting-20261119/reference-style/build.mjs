import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { renderAdaptiveMarkup } from "../../../assets/结构图/多路汇聚结果-003/review.mjs";
import { universityMckinseySkin } from "../../../src/runtime/skins/university-mckinsey.mjs";
import { compileHtmlComponentTheme, htmlComponentThemeCss } from "../../../src/visual-runtime/html-component-theme.mjs";
import { htmlTextFlowCss } from "../../../src/visual-runtime/text-flow.mjs";
import { anchors, draft, gist, inputs, points, result, sources } from "../talk-slide/content.mjs";

const read = (path) => fs.readFile(new URL(path, import.meta.url), "utf8");
const [source, assetCss, slideCss, layoutCss, appearanceCss] = await Promise.all([
  read("../../../" + draft), read("../../../assets/结构图/多路汇聚结果-003/component.css"),
  read("../talk-slide/slide.css"), read("layout.css"), read("appearance.css"),
]);
const graphFrame = { width: 507, height: 213 };
const canvas = { width: 1280, height: 720 };
const shortFacts = [["认识", "待提升"], ["作风", "待转变"], ["能力", "待增强"], ["协同", "待深化"]];
for (const quote of sources) assert(source.includes(quote), quote);
for (const [object, status] of shortFacts) {
  assert(source.includes(object + "有待" + status.slice(1)), object);
}

const heading = `<header class="theme-header" data-object="theme-header">
  <h1 data-object="claim">${gist}</h1>
  <p class="page-topic" data-object="topic"><span>第二部分</span><span>存在的不足与感悟</span></p>
</header>`;
const inGroupFlow = anchors.map((label, index) => {
  const arrow = index > 0 ? `<span class="stage-arrow" data-object="blm-link-${index}" aria-hidden="true">→</span>` : "";
  return arrow + `<span class="stage-label" data-object="blm-stage-${index + 1}">${label}</span>`;
}).join("");
const reading = points.map(({ title, cue }, index) => {
  const id = "insight-" + (index + 1);
  return `<li data-object="${id}"><span class="reading-index" data-object="${id}-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
    <div class="reading-copy" data-object="${id}-surface">
      <svg class="reading-face" data-object="${id}-surface-outline" viewBox="0 0 550 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H534 L550 50 L534 100 H0 Z"/></svg>
      <h3 data-object="${id}-heading">${title}</h3>
      ${cue ? `<p data-object="${id}-cue">${cue}</p>` : `<div class="process" data-object="blm-flow">${inGroupFlow}</div>`}
    </div></li>`;
}).join("\n");
const compliance = `<article class="compliance" data-object="compliance">
  <h3 class="issue-title" data-object="compliance-heading">合规管理短板</h3>
  <p data-object="compliance-cue">2017 年巡视整改有成效，也暴露基础管理薄弱</p>
  <div class="short-facts" data-object="compliance-status">
    <div class="short-label"><span data-object="compliance-status-heading">主要表现</span></div>
    ${shortFacts.map(([object, status], i) => `<dl data-object="status-${i + 1}"><dt data-object="status-${i + 1}-object">${object}</dt><dd data-object="status-${i + 1}-state">${status}</dd></dl>`).join("")}
  </div>
</article>`;

function render(view) {
  const theme = {
    ...universityMckinseySkin, font: "Noto Sans SC",
    ...(view === "gray" ? { primaryColor: "#626262", line: "#c5c5c5", dark: "#262626",
      body: "#424242", muted: "#535353" } : {}),
  };
  const graph = compileHtmlComponentTheme({
    markup: renderAdaptiveMarkup({ inputs, result }, { frame: graphFrame }),
    css: assetCss.slice(assetCss.indexOf(".merge {")),
    theme,
  });
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>存在的不足与感悟 · ${view === "gray" ? "灰稿样张" : "参照样式"}</title>
  <style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${graph.css}${slideCss}${layoutCss}${appearanceCss}</style></head>
  <body><article class="slide" data-view="${view}" style="--canvas-width:1280px;--margin:54px;--left-width:507px;--claim-size:37px">
  ${heading}
  <svg aria-hidden="true" width="0" height="0" style="position:absolute"><defs><linearGradient id="reading-wash"><stop offset="0"/><stop offset="1"/></linearGradient></defs></svg>
  <main class="body" data-object="body">
    <section class="issues" data-object="issues" aria-labelledby="issues-title">
      <h2 id="issues-title" class="group-title" data-object="issues-title">两点不足</h2>
      <div class="issue-points">
        <article data-object="implementation">
          <h3 class="issue-title" data-object="implementation-heading">变革落地</h3>
          <p class="issue-lead" data-object="implementation-context">顶层设计完成后，落地成为关键</p>
          <div class="graph" data-object="convergence" data-asset="convergence-many-to-one-003" aria-label="三项因素共同阻碍落地">${graph.markup}</div>
        </article>
        ${compliance}
      </div>
    </section>
    <section class="insights" data-object="insights" aria-labelledby="insights-title">
      <h2 id="insights-title" class="group-title" data-object="insights-title">四点感悟</h2>
      <ol class="reading-list" data-reading-order="parallel">${reading}</ol>
    </section>
  </main>
  </article></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const views = {};
try {
  const page = await browser.newPage({ viewport: canvas });
  for (const view of ["gray", "reference"]) {
    const target = new URL(view + ".html", import.meta.url);
    await fs.writeFile(target, render(view), "utf8");
    await page.goto(target.href);
    const measured = await page.evaluate(async () => {
      await document.fonts.ready;
      const box = (node) => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      };
      const objects = Object.fromEntries([...document.querySelectorAll("[data-object],[data-ppt-name]")].map((node) =>
        [node.dataset.object ?? node.dataset.pptName, box(node)]));
      const textFields = [];
      const overflow = [];
      for (const element of document.querySelectorAll("h1,h2,h3,p,dt,dd,.short-label span,.process span,.reading-index,[data-ppt-kind='text']")) {
        const style = getComputedStyle(element);
        if (style.display === "none" || !element.getClientRects().length) continue;
        const range = document.createRange();
        range.selectNodeContents(element);
        const lines = [...range.getClientRects()].filter((r) => r.height && r.width)
          .map(({ x, y, width, height }) => ({ x, y, width, height }));
        const owner = element.closest(".input,.result,.reading-copy,.short-facts") ?? element;
        const bounds = box(owner);
        const key = element.dataset.object ?? element.dataset.pptName ?? element.textContent.trim();
        if (lines.some((r) => r.x < bounds.x - 2 || r.x + r.width > bounds.x + bounds.width + 2
          || r.y + r.height > innerHeight || r.x + r.width > innerWidth
          || (element !== owner && (r.y < bounds.y - 2 || r.y + r.height > bounds.y + bounds.height + 2)))) overflow.push(key);
        if (lines.length) textFields.push({ key, text: element.textContent.trim(), font: style.fontFamily,
          fontSize: style.fontSize, weight: style.fontWeight, lines });
      }
      const inputNodes = document.querySelectorAll(".merge .input");
      const targetNode = document.querySelector(".merge .result");
      const connections = [...document.querySelectorAll(".merge path")].map((path, index) => {
        const origin = box(path.ownerSVGElement);
        const input = box(inputNodes[index]);
        const output = box(targetNode);
        const start = path.getPointAtLength(0);
        const end = path.getPointAtLength(path.getTotalLength());
        return {
          path: path.getAttribute("d"), startId: inputNodes[index].dataset.pptName, endId: targetNode.dataset.pptName,
          startError: Math.hypot(start.x + origin.x - input.x - input.width, start.y + origin.y - input.y - input.height / 2),
          endError: Math.hypot(end.x + origin.x - output.x, end.y + origin.y - output.y - output.height / 2),
        };
      });
      return { objects, textFields, overflow, connections, page: box(document.querySelector(".slide")),
        words: document.querySelector(".body").innerText.replace(/\s+/gu, "") };
    });
    assert.deepEqual(measured.overflow, []);
    assert.equal(measured.page.height, canvas.height);
    assert.equal(measured.objects.issues.y, measured.objects.insights.y);
    assert.equal(measured.objects.issues.height, measured.objects.insights.height);
    assert(measured.objects["compliance-status"].y + measured.objects["compliance-status"].height
      <= measured.objects.issues.y + measured.objects.issues.height - 10);
    assert(measured.objects.claim.y < measured.objects.topic.y && measured.objects.topic.y < measured.objects.body.y);
    assert.equal(measured.connections.length, 3);
    assert(measured.connections.every((link) => link.startError < 0.04 && link.endError < 0.04));
    assert(measured.words.includes("作风改进不要求立竿见影，重在持续用力"));
    assert(!["组织共识不足", "数据协同不充分", "激励约束不健全"].some((phrase) => measured.words.includes(phrase)));
    const wash = await page.locator("#reading-wash stop").first().evaluate((stop) => getComputedStyle(stop).stopColor);
    assert.equal(wash, view === "gray" ? "rgb(244, 244, 244)" : "rgb(248, 251, 253)");
    views[view] = measured;
    await page.screenshot({ path: fileURLToPath(new URL(view + ".png", import.meta.url)) });
  }
  assert.deepEqual(views.reference, views.gray, "颜色以外的布局、内容或字体发生漂移");
} finally {
  await browser.close();
}

await fs.writeFile(new URL("layout.json", import.meta.url), JSON.stringify({
  version: "experiment/reference-slide@1", layoutsMatch: true, canvas,
  source: { file: draft, sha256: createHash("sha256").update(source).digest("hex"), excerpts: sources },
  readingOrder: ["claim", "topic", "issues", "implementation", "compliance", "insights",
    "insight-1", "insight-2", "insight-3", "insight-4"],
  relations: [
    { kind: "independent-groups", groupIds: ["issues", "insights"] },
    { kind: "convergence", within: "implementation", asset: "convergence-many-to-one-003", inputKeys: inputs.map((part) => part.key), result: result.title },
    { kind: "parallel", within: "insights", rowIds: points.map((_, index) => "insight-" + (index + 1)) },
    { kind: "sequence", within: "insight-1", nodes: anchors },
  ],
  ...views.gray,
}, null, 2) + "\n", "utf8");
console.log("Gray and reference views share identical measured geometry, text, typography and connectors.");
