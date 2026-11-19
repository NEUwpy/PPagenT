import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { renderAdaptiveMarkup, resolveConvergenceLayout } from "../../../assets/结构图/多路汇聚结果-003/review.mjs";
import { universityMckinseySkin } from "../../../src/runtime/skins/university-mckinsey.mjs";
import { compileHtmlComponentTheme, htmlComponentThemeCss } from "../../../src/visual-runtime/html-component-theme.mjs";
import { htmlTextFlowCss } from "../../../src/visual-runtime/text-flow.mjs";
import { draft, gist, inputs, result, anchors, points, sources } from "./content.mjs";

const asset = new URL("../../../assets/结构图/多路汇聚结果-003/", import.meta.url);
const source = await fs.readFile(new URL("../../../" + draft, import.meta.url), "utf8");
const sourceCss = await fs.readFile(new URL("component.css", asset), "utf8");
const sheetCss = await fs.readFile(new URL("slide.css", import.meta.url), "utf8");
const chrome = process.env.BROWSER_EXECUTABLE_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
for (const excerpt of sources) assert(source.includes(excerpt), "来源有变化：" + excerpt);

const notes = `# 存在的不足与感悟 · 讲述备注

**本页主旨**　${gist}。

1. 先从左侧的三路汇聚讲起。顶层设计完成后，变革氛围、信息系统支撑和市场化机制都还没到位，共同阻碍落地。
2. 再讲第二点不足。2017 年巡视整改有成效，同时暴露出人力条线的基础管理短板，点出认识、作风、能力与协同。
3. 转到右侧四点感悟。用 BLM 讲清业务战略如何走到人力资源的落地方案；以解决实际问题检验成效；根据试点和对标持续迭代；最后讲如何统筹变革、合规和作风，落在持续用力。

## 原稿

${source.trim()}
`;
await fs.writeFile(new URL("讲述备注.md", import.meta.url), notes, "utf8");

const variants = [
  { file: "review", width: 1280, margin: 54, left: 605, gap: 40, title: 37, pointTitle: 24, indent: 41, process: 16, graphHeight: 236 },
  { file: "review-narrow", width: 1020, margin: 42, left: 482, gap: 31, title: 30, pointTitle: 22, indent: 34, process: 15, graphHeight: 230 },
];
const pathCss = sourceCss.slice(sourceCss.indexOf(".merge {"));
const theme = { ...universityMckinseySkin, font: "Noto Sans SC" };

function render(variant) {
  const frame = { width: variant.left, height: variant.graphHeight };
  const { markup, css } = compileHtmlComponentTheme({
    markup: renderAdaptiveMarkup({ inputs, result }, { frame }),
    css: pathCss,
    theme,
  });
  const process = anchors.map((label) => `<span class="stage-label">${label}</span>`)
    .join('<span class="stage-arrow" aria-hidden="true">→</span>');
  const talkingPoints = points.map(({ title, cue }, index) => `<li><h3>${title}</h3>${
    index === 0 ? `<div class="process" aria-label="${anchors.join("到")}">${process}</div>` : `<p>${cue}</p>`
  }</li>`).join("\n");
  const vars = [
    ["canvas-width", variant.width], ["margin", variant.margin], ["left-width", variant.left],
    ["column-gap", variant.gap], ["claim-size", variant.title], ["point-title", variant.pointTitle],
    ["point-indent", variant.indent], ["process-size", variant.process],
  ].map(([name, value]) => `--${name}:${value}px`).join(";");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>存在的不足与感悟</title><style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${css}${sheetCss}</style></head>
<body>
<article class="slide" style="${vars}">
  <header class="theme-header" data-theme-header>
    <h1 data-theme-role="claim">${gist}</h1>
    <p class="page-topic" data-theme-role="topic"><span>第二部分</span><span>存在的不足与感悟</span></p>
  </header>
  <main class="body">
    <section aria-labelledby="issues-heading">
      <h2 id="issues-heading" class="group-title">两点不足</h2>
      <article class="implementation">
        <h3 class="issue-title">变革落地</h3>
        <p class="issue-lead">顶层设计完成后，落地成为关键</p>
        <div class="graph" role="img" aria-label="变革氛围尚未完全形成、信息系统支撑仍有差距、缺乏市场化管理机制，共同阻碍变革落地。" data-asset="convergence-many-to-one-003">${markup}</div>
      </article>
      <article class="compliance">
        <h3 class="issue-title">合规管理短板</h3>
        <p>2017 年巡视整改有成效，也暴露基础管理薄弱</p>
        <p class="needs">提升认识 · 转变作风 · 增强能力 · 深化协同</p>
      </article>
    </section>
    <section aria-labelledby="insights-heading">
      <h2 id="insights-heading" class="group-title">四点感悟</h2>
      <ol class="talk-points">${talkingPoints}</ol>
    </section>
  </main>
</article>
</body></html>`;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const audit = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const variant of variants) {
    const file = new URL(variant.file + ".html", import.meta.url);
    await fs.writeFile(file, render(variant), "utf8");
    await page.setViewportSize({ width: variant.width, height: 720 });
    await page.goto(file.href);
    const measured = await page.evaluate(async () => {
      await document.fonts.ready;
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
      const measureEnds = [...document.querySelectorAll(".merge path")].map((curve, index) => {
        const svg = curve.ownerSVGElement.getBoundingClientRect();
        const inputs = document.querySelectorAll(".merge .input");
        const input = inputs[index].getBoundingClientRect();
        const result = rect(".merge .result");
        const start = curve.getPointAtLength(0);
        const end = curve.getPointAtLength(curve.getTotalLength());
        return {
          fromError: Math.hypot(start.x + svg.left - input.right, start.y + svg.top - (input.top + input.height / 2)),
          toError: Math.hypot(end.x + svg.left - result.left, end.y + svg.top - (result.top + result.height / 2)),
        };
      });
      const wrapped = [];
      const clipped = [];
      for (const element of document.querySelectorAll("h1, .page-topic, h2, h3, .body p, .process span, .merge [data-ppt-kind='text']")) {
        if (!element.getClientRects().length) continue;
        const range = document.createRange();
        range.selectNodeContents(element);
        const lines = [...range.getClientRects()].filter((box) => box.width > 0 && box.height > 0);
        if (element.matches("h1")) wrapped.push(...lines.map((line) => line.y));
        const node = element.closest(".input, .result") ?? element;
        const container = node.getBoundingClientRect();
        if (lines.some((line) => line.right > container.right + 2 || line.left < container.left - 2
          || line.right > innerWidth || line.bottom > innerHeight || line.top < 0
          || (node !== element && (line.top < container.top || line.bottom > container.bottom)))) {
          clipped.push(element.textContent);
        }
      }
      return {
        claim: rect("[data-theme-role='claim']"), topic: rect("[data-theme-role='topic']"),
        main: rect(".body"), header: rect(".theme-header"), slide: rect(".slide"),
        text: document.querySelector(".body").innerText,
        titleLines: new Set(wrapped.map(Math.round)).size, clipped, measureEnds,
        insightCount: document.querySelectorAll(".talk-points > li").length,
        issueCount: document.querySelectorAll(".implementation, .compliance").length,
        processNodes: document.querySelectorAll(".process .stage-label").length,
      };
    });
    assert(measured.claim.bottom <= measured.topic.top, "主旨句应位于主题名称上方");
    assert(measured.topic.bottom < measured.main.top, "主旨和主题名称必须位于正文以外");
    assert.equal(measured.titleLines, 1);
    assert.equal(measured.slide.height, 720);
    assert.deepEqual(measured.clipped, []);
    assert.equal(measured.issueCount, 2);
    assert.equal(measured.insightCount, 4);
    assert.equal(measured.processNodes, 3);
    assert.equal(measured.measureEnds.length, 3);
    assert(measured.measureEnds.every(({ fromError, toError }) => fromError < 0.04 && toError < 0.04));
    assert(measured.text.includes(points[3].cue));
    const bodyCharacterCount = [...measured.text.replace(/\s+/gu, "")].length;
    const sourceBodyCharacterCount = [...source.trim().split(/\r?\n\r?\n/u).slice(1).join("").replace(/\s+/gu, "")].length;
    assert(bodyCharacterCount < sourceBodyCharacterCount * 0.5);
    await page.screenshot({ path: fileURLToPath(new URL(variant.file + ".png", import.meta.url)) });
    audit.push({ variant, source: draft, sourceSha256: createHash("sha256").update(source).digest("hex"),
      layout: resolveConvergenceLayout({ width: variant.left, height: variant.graphHeight }, 3),
      sources, bodyCharacterCount, sourceBodyCharacterCount, ...measured });
  }
} finally {
  await browser.close();
}
await fs.writeFile(new URL("audit.json", import.meta.url), JSON.stringify(audit, null, 2) + "\n", "utf8");
console.table(audit.map(({ variant, bodyCharacterCount, sourceBodyCharacterCount, clipped, measureEnds }) =>
  ({ file: variant.file, bodyCharacterCount, sourceBodyCharacterCount, clipped: clipped.length, connections: measureEnds.length })));
