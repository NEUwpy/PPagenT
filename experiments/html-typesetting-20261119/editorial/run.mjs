import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDefaultSimplifiedChineseParser } from "budoux";
import { chromium } from "playwright-core";
import { buildSourceBlocks } from "../../../src/content/source-blocks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const out = path.join(here, "output");
const css = await fs.readFile(path.join(here, "editorial.css"), "utf8");
const zh = loadDefaultSimplifiedChineseParser();
const size = { width: 1280, height: 720 };
const chrome = process.env.BROWSER_EXECUTABLE_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const cases = [
  ["review", "稿件/变革不足与感悟-v3-条件否定.md"],
  ["decisions", "稿件/模拟稿库/布局试排-options.md"],
];
const escape = (text) => text.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const json = (data) => JSON.stringify(data, null, 2) + "\n";

function adaptParagraphEnds() {
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
  const range = document.createRange();
  const applied = [];
  function readLines(paragraph) {
    const textNode = paragraph.firstChild;
    const lines = new Map();
    for (const { segment, index } of segmenter.segment(textNode.textContent)) {
      range.setStart(textNode, index);
      range.setEnd(textNode, index + segment.length);
      const box = range.getBoundingClientRect();
      if (!box.width) continue;
      const key = Math.round(box.top);
      lines.set(key, (lines.get(key) ?? "") + segment);
    }
    return [...lines.values()];
  }
  for (const paragraph of document.querySelectorAll(".review .text-body")) {
    paragraph.classList.remove("has-balanced-lines");
    paragraph.style.removeProperty("padding-inline-end");
    if (paragraph.childNodes.length !== 1 || paragraph.firstChild.nodeType !== Node.TEXT_NODE) continue;
    const before = readLines(paragraph);
    if (before.length < 2 || before.at(-1).trim().length > 4) continue;
    paragraph.classList.add("has-balanced-lines");
    let after = readLines(paragraph);
    let method = "balance";
    if (after.length !== before.length || after.at(-1).trim().length <= 4) {
      paragraph.classList.remove("has-balanced-lines");
      method = "measure";
      for (const inset of [4, 8, 12, 16]) {
        paragraph.style.paddingInlineEnd = inset + "px";
        after = readLines(paragraph);
        if (after.length === before.length && after.at(-1).trim().length > 4) break;
      }
    }
    if (after.length === before.length && after.at(-1).trim().length > 4) {
      applied.push({ id: paragraph.dataset.bind, method, before, after });
    } else {
      paragraph.style.removeProperty("padding-inline-end");
    }
  }
  return applied;
}

function trialMarkup(name, source, mode, widthShare, layout) {
  const blocks = buildSourceBlocks(source);
  const fields = [];
  function bind(tag, classes, id, block, text, { highlightPrefix = 0, display = text, phrase = false } = {}) {
    const offset = block.text.indexOf(text);
    assert(offset >= 0, id + " has no literal source");
    const blockOffset = source.indexOf(block.text, block.start);
    assert(blockOffset >= 0);
    const chunks = phrase ? zh.parse(display) : null;
    fields.push({ id, sourceId: block.id, offset: blockOffset + offset, quote: text, display, chunks });
    if (chunks) assert.equal(chunks.join(""), display);
    let body = chunks ? chunks.map(escape).join("<wbr>") : escape(display);
    if (highlightPrefix && !phrase) {
      body = "<strong>" + escape(display.slice(0, highlightPrefix)) + "</strong>" + escape(display.slice(highlightPrefix));
    }
    return `<${tag} class="text ${classes}${phrase ? " phrases" : ""}" data-bind="${id}">${body}</${tag}>`;
  }
  const headlines = mode === "phrases" || mode === "all-phrases";
  const prose = mode === "all-phrases";
  const [title, ...sections] = blocks;
  let fragment;
  if (name === "review") {
    const [chapter, displayTitle] = title.text.split("：");
    assert.equal([chapter, displayTitle].join("："), title.text);
    const titleMarkup = bind("h1", "serif", "title", title, displayTitle, { phrase: headlines });
    const partMarkup = bind("span", "kicker", "chapter", title, chapter);
    const sectionMarkup = sections.map((block, groupIndex) => {
      const matches = [...block.text.matchAll(/[一二三四]是([^。]+)。/gu)];
      assert.equal(matches.length, [2, 4][groupIndex]);
      const groupCue = block.text.slice(0, matches[0].index);
      const [, label] = groupCue.match(/^(?:首先|其次)是(.+)。$/u);
      const labelMarkup = bind("h2", "section-label", "label-" + groupIndex, block, groupCue, { display: label });
      const items = matches.map((match, index) => {
        const id = groupIndex + "-" + index;
        const body = block.text.slice(match.index + match[0].length, matches[index + 1]?.index ?? block.text.length);
        const heading = bind("h3", "", "heading-" + id, block, match[0], { display: match[1], phrase: headlines });
        const copy = bind("p", "text-body", "body-" + id, block, body, { phrase: prose });
        return "<article>" + heading + copy + "</article>";
      });
      return `<section class="${["issues", "insights"][groupIndex]}">${labelMarkup}<div class="articles">${items.join("")}</div></section>`;
    }).join("");
    fragment = `<header class="masthead">${partMarkup}${titleMarkup}</header>
      <div class="${mode === "continuous" ? "continuous" : layout ? "review is-spread" : "review"}" style="--first-share:${widthShare}%">${sectionMarkup}</div>`;
  } else {
    const [central, phased, common] = sections;
    assert.equal(sections.length, 3);
    const titleMarkup = bind("h1", "serif", "title", title, title.text, { phrase: headlines });
    const shared = bind("p", "", "shared", common, common.text, { phrase: prose });
    const options = [central, phased].map((block, index) => {
      const match = block.text.match(/^([^：]+)：([^。]+。)([^；]+；)(.+)$/u);
      assert(match, "options evidence changed");
      const [, caption, method, upside, downstream] = match;
      const heading = bind("h2", "serif", "label-" + index, block, caption, { phrase: headlines });
      const lead = bind("p", "method", "method-" + index, block, method, { phrase: prose });
      const benefit = bind("p", "text-body", "benefit-" + index, block, upside, {
        display: upside.replace(/；$/u, "。"),
        highlightPrefix: upside.indexOf("是") + 1, phrase: prose,
      });
      const risk = bind("p", "text-body", "risk-" + index, block, downstream, { highlightPrefix: downstream.indexOf("是") + 1, phrase: prose });
      return `<article>${heading}${lead}<div class="tradeoff">${benefit}${risk}</div></article>`;
    }).join("");
    fragment = `<header class="masthead">${titleMarkup}</header>
      <section class="conditions"><h2>共同前置条件</h2>${shared}</section>
      <div class="options">${options}</div>`;
  }
  for (const block of blocks) {
    const offset = source.indexOf(block.text, block.start);
    const mask = Array(block.text.length).fill(false);
    for (const field of fields.filter((binding) => binding.sourceId === block.id)) {
      for (let i = field.offset - offset; i < field.offset - offset + field.quote.length; i += 1) mask[i] = true;
    }
    const uncovered = block.text.split("").filter((_, index) => !mask[index]).join("");
    assert(/^[:：]*$/u.test(uncovered), block.id + " unrepresented source: " + uncovered);
  }
  const adaptiveScript = layout === "refined" ? `<script>
    ${adaptParagraphEnds.toString()}
    let pending = 0;
    window.typesettingReady = document.fonts.ready.then(adaptParagraphEnds);
    addEventListener("resize", () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(adaptParagraphEnds);
    });
  </script>` : "";
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title.text)}</title><style>${css}</style></head>
    <body><main class="sheet ${name}-document">${fragment}</main>${adaptiveScript}</body></html>`;
  return { html, fields };
}

async function inspect(page, fields, viewport) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(({ fields, viewport }) => {
    const sourceById = new Map(fields.map((field) => [field.id, field]));
    const errors = [];
    const seen = new Set();
    const elements = [...document.querySelectorAll("[data-bind]")].map((element) => {
      const id = element.dataset.bind;
      const field = sourceById.get(id);
      if (seen.has(id) || field?.display !== element.textContent) errors.push({ id, code: "source-binding" });
      seen.add(id);
      const bounds = element.getBoundingClientRect().toJSON();
      const computed = getComputedStyle(element);
      const fontPx = parseFloat(computed.fontSize);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const lineMap = new Map();
      const range = document.createRange();
      const reader = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const character of reader.segment(node.textContent)) {
          range.setStart(node, character.index);
          range.setEnd(node, character.index + character.segment.length);
          const rect = range.getBoundingClientRect();
          if (!rect.width) continue;
          const key = Math.round(rect.top);
          if (!lineMap.has(key)) lineMap.set(key, { text: "", left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
          const line = lineMap.get(key);
          line.text += character.segment;
          line.right = Math.max(rect.right, line.right);
          line.bottom = Math.max(rect.bottom, line.bottom);
        }
      }
      const lines = [...lineMap.values()];
      if (!lines.length || fontPx < 18) errors.push({ id, code: "missing-or-small" });
      if (lines.some((line) => line.left < -1 || line.right > viewport.width + 1 || line.bottom > viewport.height + 1)) {
        errors.push({ id, code: "outside-artboard" });
      }
      for (const line of lines) {
        if (line.right > bounds.right + 1 || line.left < bounds.left - 1) errors.push({ id, code: "outside-text-box" });
      }
      return { id, fontPx, bounds, lines, lineCount: lines.length };
    });
    if (seen.size !== fields.length) errors.push({ code: "missing-binding" });
    const sectionGeometry = [...document.querySelectorAll(".review section,.continuous section,.options article,.conditions")]
      .map((section) => ({ label: section.querySelector("h2")?.textContent, bounds: section.getBoundingClientRect().toJSON() }));
    const sheetHeight = document.querySelector(".sheet").getBoundingClientRect().height;
    if (sheetHeight > viewport.height + 1) errors.push({ code: "page-taller-than-artboard", sheetHeight });
    return {
      viewport, errors, sectionGeometry, sheetHeight, elements,
      shortEndLines: elements.flatMap(({ id, lines }) => lines.length > 1 && [...lines.at(-1).text.trim()].length <= 4
        ? [{ id, text: lines.at(-1).text }] : []),
    };
  }, { fields, viewport });
}

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const results = { browser: browser.version(), budoux: "0.10.4", cases: [] };
try {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  for (const [name, input] of cases) {
    const source = await fs.readFile(path.join(root, input), "utf8");
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const variants = name === "review"
      ? [["continuous", "continuous", 38], ["native", "native", 37], ["phrases", "phrases", 37], ["all-phrases", "all-phrases", 37], ["narrow", "native", 40, 1020],
        ["spread", "native", 30, 1280, "spread"], ["spread-phrases", "phrases", 30, 1280, "spread"], ["spread-narrow", "native", 30, 1020, "spread"],
        ["refined", "native", 30, 1280, "refined"], ["refined-narrow", "native", 30, 1020, "refined"]]
      : [["native", "native", 0], ["phrases", "phrases", 0], ["all-phrases", "all-phrases", 0], ["narrow", "native", 0, 1020]];
    for (const [variant, mode, widthShare, width = size.width, layout] of variants) {
      const viewport = { width, height: size.height };
      await page.setViewportSize(viewport);
      const artifact = name + "-" + variant;
      const { html, fields } = trialMarkup(name, source, mode, widthShare, layout);
      await page.setContent(html);
      const adjustments = await page.evaluate(() => window.typesettingReady ?? []);
      const measured = await inspect(page, fields, viewport);
      const { root: documentRoot } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: documentRoot.nodeId, selector: "h1" });
      const fonts = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      await fs.writeFile(path.join(out, artifact + ".html"), html, "utf8");
      await page.screenshot({ path: path.join(out, artifact + ".png") });
      await fs.writeFile(path.join(out, artifact + ".json"), json({ input, sourceHash, mode, widthShare, fields, fonts, adjustments, ...measured }), "utf8");
      results.cases.push({ artifact, sheetHeight: measured.sheetHeight, errors: measured.errors,
        shortEndLines: measured.shortEndLines, adjustments, sectionGeometry: measured.sectionGeometry, headingFonts: fonts.fonts });
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(out, "results.json"), json(results), "utf8");
console.table(results.cases.map(({ artifact, sheetHeight, errors, shortEndLines }) =>
  ({ artifact, sheetHeight, errors: errors.length, shortEndLines: shortEndLines.map((item) => item.text).join(" / ") })));
