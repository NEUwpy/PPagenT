import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const output = path.join(here, "output");
const cases = {
  hr: "稿件/变革不足与感悟-v3-条件否定.md",
  duty: "稿件/模拟稿库/行政信息/A05-汛期值班与应急处置安排.md",
};
const font = '"Noto Sans SC","Microsoft YaHei",sans-serif';
const serif = '"Noto Serif SC",SimSun,serif';
const chrome = process.env.BROWSER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const viewport = { width: 1280, height: 720 };
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const write = (file, content) => fs.writeFile(path.join(output, file), content, "utf8");

function sections(id, blocks) {
  if (id === "hr") {
    const colon = blocks[0].indexOf("：");
    const groups = blocks.slice(1).map((block, groupIndex) => {
      const prefix = /^(?:首先|其次)是(.+?)。/.exec(block);
      if (!prefix) throw Error("No group heading");
      const marks = [...block.matchAll(/([一二三四]是)([^。]+)。(?![^。]*[一二三四]是)/g)];
      const expected = groupIndex === 0 ? 2 : 4;
      if (marks.length !== expected) throw Error("Unexpected HR section count");
      const items = marks.map((m, index) => ({
        label: m[2],
        titleSource: m[0],
        body: block.slice(m.index + m[0].length, marks[index + 1]?.index ?? block.length),
      }));
      if (prefix[0] + items.map(({ titleSource, body }) => titleSource + body).join("") !== block) {
        throw Error("HR source span did not reconstruct");
      }
      return { heading: prefix[1], items };
    });
    return { title: blocks[0].slice(colon + 1), strap: blocks[0].slice(0, colon), groups };
  }
  const ends = blocks[1].indexOf("。") + 1;
  const headingEnd = blocks[2].indexOf("：") + 1;
  const split = (text) => {
    const fragments = text.match(/[^；。]+[；。]/g) ?? [];
    if (fragments.join("") !== text) throw Error("Duty source span did not reconstruct");
    return fragments.map((body) => ({ body }));
  };
  const items = [split(blocks[1].slice(ends)), split(blocks[2].slice(headingEnd)), split(blocks[3])];
  const heading = ["值班与交接", "险情分级处置", "加密巡查"];
  const prefixes = ["值班实行", "一般渗漏、积水", "连续降雨"];
  return {
    title: blocks[0], strap: blocks[1].slice(0, ends).replace(/。$/, ""),
    groups: items.map((item, i) => {
      if (!item[0].body.startsWith(prefixes[i])) throw Error("Unexpected duty section");
      return { heading: heading[i], items: item };
    }),
  };
}

function paragraphMarkup(text) {
  const emphasis = [
    "一般渗漏、积水", "出现管涌、滑坡征兆", "涉及人员受伤或设备停机的",
    "连续降雨超过 12 小时或单日降雨量超过 100 毫米时", "天气好转后",
  ].find((start) => text.startsWith(start));
  const units = (s) => escape(s).replace(/(?:\d+\s*(?:个工作日|小时|毫米|分钟)(?:时)?|BLM)/gu,
    (word) => `<span class="unit">${word}</span>`);
  return emphasis ? `<strong>${units(emphasis)}</strong>${units(text.slice(emphasis.length))}` : units(text);
}

function markup(plan, mode) {
  const pretitle = plan.strap && mode === "hr" ? `<p class="strap">${escape(plan.strap)}</p>` : "";
  const posttitle = plan.strap && mode !== "hr" ? `<p class="strap">${escape(plan.strap)}</p>` : "";
  const groups = plan.groups.map((group, index) => {
    const estimate = group.items.reduce((count, item) => count + item.body.length + (item.label?.length ?? 0), 0);
    const items = group.items.map((item, itemIndex) => `<div class="entry">
      ${item.label ? `<h3>${escape(item.label)}</h3>` : ""}
      <p class="body" data-copy="${index + 1}:${itemIndex + 1}">${paragraphMarkup(item.body)}</p>
    </div>`).join("");
    const columns = Math.ceil(estimate / 230);
    const weight = columns * (360 + (estimate / columns - 170) * 0.7);
    return `<section data-group="${index + 1}" style="--tracks:${columns};--weight:${weight.toFixed(2)}">
      <h2>${escape(group.heading)}</h2><div class="flow">${items}</div></section>`;
  }).join("");
  return `<article class="stage"><header>${pretitle}<h1>${escape(plan.title)}</h1>${posttitle}</header>
    <div class="sections" data-columns="${plan.groups.length}" data-matter="${mode}">${groups}</div></article>`;
}

const typography = `
*{box-sizing:border-box}
html,body{margin:0;background:#f8f7f3;color:#232320}
.stage{font-family:${font};font-variant-numeric:tabular-nums}
p,h1,h2,h3{margin:0}
header{padding:0 0 25px;border-bottom:2px solid #30302d;margin:0 0 23px}
h1{font-size:49px;font-weight:780;line-height:1.2;letter-spacing:-.035em;text-wrap:balance}
.strap{font-size:20px;color:#55544d;line-height:1.35;font-weight:500}
.strap:first-child{margin-bottom:10px}
.strap:last-child{margin-top:12px}
h2{font-size:26px;line-height:1.35;font-weight:745;margin:0 0 18px;break-after:avoid}
h3{font-size:20px;line-height:1.38;font-weight:700;margin:0 0 6px;break-after:avoid}
.body{font:400 20px/1.56 ${serif};color:#34342e;line-break:strict;word-break:normal;overflow-wrap:normal;text-wrap:pretty;widows:2;orphans:2}
.body strong{font-weight:700;color:#22221e}
.unit{white-space:nowrap}
.entry{padding:0 0 13px;break-inside:avoid-column}
.flow{column-gap:26px}
`;
const screenCss = (width, height, bodyFont = 20) => `
.stage{width:${width}px;min-height:${height}px;padding:${height < 700 ? "40px 43px 38px" : "54px 64px 53px"}}
.sections{display:grid;gap:${width < 1200 ? 28 : 36}px;align-items:start}
section+section{border-left:1px solid #c3c1b8;padding-left:${width < 1200 ? 24 : 34}px}
.sections:not([data-matter="hr"]) section+section{padding-left:24px}
.flow{column-count:var(--tracks);column-fill:balance}
.sections{grid-template-columns:var(--fractions)}
.flow>.entry:last-child{padding-bottom:0}
.body{font-size:${bodyFont}px}
${height < 700 ? `header{padding-bottom:16px;margin-bottom:15px}
h1{font-size:43px}h2{font-size:25px;margin-bottom:12px}
h3{line-height:1.28;margin-bottom:4px}.body{line-height:1.43}
.entry{padding-bottom:10px}.flow{column-gap:22px}` : ""}
`;
const flatCss = (width, height) => `
.stage{width:${width}px;min-height:${height}px;padding:54px 64px 53px}
.sections{columns:2;column-gap:42px;column-rule:1px solid #c3c1b8;column-fill:balance}
h2{margin:15px 0 10px}
section:first-child h2{margin-top:0}
`;
const pagedCss = (width, height) => `
@page{size:${width}px ${height}px;margin:54px 64px 53px;background:#f8f7f3}
.sections{columns:2;column-gap:42px;column-rule:1px solid #c3c1b8;column-fill:balance}
h2{margin:15px 0 10px}
section:first-child h2{margin-top:0}
.pagedjs_pages{background:#e7e6e1}.pagedjs_page{margin:0}
`;

function documentHtml(mark, css, fractions, paged) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>HTML 文字流</title>
  <style>${typography}\n${css}\n.sections{--fractions:${fractions}}</style>
  ${paged ? '<script>window.PagedConfig = { after: (flow) => { window.pagedTotal = flow.total; document.documentElement.dataset.pagedReady="1" } }</script><script src="../node_modules/pagedjs/dist/paged.polyfill.js"></script>' : ""}
  <body>${mark}</body></html>`;
}

function selectedRatios(plan, width) {
  const measures = plan.groups.map((group) => group.items.reduce((sum, item) => sum + item.body.length + (item.label?.length ?? 0), 0));
  const tracks = measures.map((measure) => Math.ceil(measure / 230));
  const normalized = measures.map((measure, i) => tracks[i] * (360 + (measure / tracks[i] - 170) * 0.7));
  const branches = [-72, -36, 0, 36, 72];
  return Object.fromEntries(normalized.slice(0, -1).flatMap((_weight, allocation) =>
    branches.filter((branch) => allocation === 0 || branch !== 0).map((branch) => {
      const weights = normalized.map((value, index) => index === allocation ? value + branch
        : index === normalized.length - 1 ? value - branch : value);
      const fractions = weights.map((weight) =>
        `minmax(${width > 1100 ? 230 : 190}px,${weight.toFixed(2)}fr)`).join(" ");
      return [allocation + "-" + branch, { fractions, adjustment: branch }];
    })));
}

async function saveEvidence(page, id, rect) {
  const result = await page.evaluate(({ width, height }) => {
    const live = document.querySelector(".pagedjs_pages") ?? document.querySelector(".stage");
    const nodeRects = (e) => {
      const textNodes = [];
      const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) if (walk.currentNode.data.trim()) textNodes.push(walk.currentNode);
      return textNodes.flatMap((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].filter((r) => r.width && r.height).map((r) => [r.x, r.y, r.width, r.height]);
      });
    };
    const paragraphs = [...live.querySelectorAll(".body")].map((element) => ({
      id: element.dataset.copy, text: element.textContent, fontPx: parseFloat(getComputedStyle(element).fontSize),
      lineBoxes: nodeRects(element),
    }));
    const fragments = [...live.querySelectorAll(".entry")].map((element) =>
      [...new Set([...element.getClientRects()].filter((rect) => rect.height > 0).map((rect) => Math.round(rect.x)))]);
    const maxTextY = Math.max(0, ...paragraphs.flatMap((p) => p.lineBoxes.map((r) => r[1] + r[3])));
    const minTextPx = Math.min(...paragraphs.map((p) => p.fontPx));
    const headingFits = [...live.querySelectorAll("h1,h2,h3,.strap")].every((heading) =>
      nodeRects(heading).every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= width + 1 && y + h <= height - 10));
    const visible = maxTextY <= height - 26 && minTextPx >= 18 && headingFits && paragraphs.every((p) =>
      p.lineBoxes.every(([x, y, w]) => x >= 0 && y >= 0 && x + w <= width + 1));
    return {
      width, height, paragraphs, minTextPx, maxTextY, visible, fragments,
      pages: live.querySelectorAll(".pagedjs_page").length || 1,
      sections: [...live.querySelectorAll("section")].map((e) => ({
        id: e.dataset.group, x: e.getBoundingClientRect().x, y: e.getBoundingClientRect().y,
        height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width,
      })),
    };
  }, rect);
  await write(id + ".json", JSON.stringify(result, null, 2) + "\n");
  return result;
}

async function load(page, file, html, paged = false) {
  await write(file, html);
  await page.goto(pathToFileURL(path.join(output, file)).href, { waitUntil: "load" });
  if (paged) await page.waitForFunction(() => document.documentElement.dataset.pagedReady === "1", null, { timeout: 12000 });
  await page.evaluate(() => document.fonts.ready);
}

async function draw(page, pageName, mark, plan) {
  const dimensions = [viewport, { width: 1080, height: 650 }];
  const report = {};
  for (const size of dimensions) {
    const key = pageName + (size.width < 1200 ? "-compact" : "");
    await page.setViewportSize(size);
    const { width, height } = size;
    const candidates = [];
    const ratios = Object.entries(selectedRatios(plan, width));
    const sizes = size.width === viewport.width ? [20, 22] : [20];
    for (const [bodyFont, branch, { fractions, adjustment }] of sizes.flatMap((bodyFont) =>
      ratios.map(([branch, ratio]) => [bodyFont, branch, ratio]))) {
      const file = key + "-candidate-body" + bodyFont + "-" + branch;
      await load(page, file + ".html", documentHtml(mark, screenCss(width, height, bodyFont), fractions));
      const result = await saveEvidence(page, file, size);
      const expected = plan.groups.flatMap((group) => group.items.map((item) => item.body));
      if (expected.join("") !== result.paragraphs.map((p) => p.text).join("")) throw Error("Body fidelity failed: " + key);
      const measured = result.sections.map((section) => section.height);
      const spread = Math.max(...measured) - Math.min(...measured);
      const split = result.fragments.filter((item) => item.length > 1).length;
      const score = spread * 0.48 + result.maxTextY * 0.27 + split * 80
        + Math.abs(adjustment) * .03 - (bodyFont - 20) * 110;
      candidates.push({ branch, fractions, bodyFont, spread, split, maxTextY: result.maxTextY, visible: result.visible, score });
    }
    const chosen = candidates.filter((c) => c.visible).sort((a, b) => a.score - b.score)[0];
    report[key] = { candidates, chosen };
    if (!chosen) continue;
    await load(page, key + ".html", documentHtml(mark, screenCss(width, height, chosen.bodyFont), chosen.fractions));
    await page.screenshot({ path: path.join(output, key + ".png") });
    await saveEvidence(page, key, size);
  }
  for (const engine of ["native-flat", "paged"]) {
    const paged = engine === "paged";
    const name = pageName + "-" + engine;
    await page.setViewportSize(viewport);
    const pageCss = paged ? pagedCss(viewport.width, viewport.height) : flatCss(viewport.width, viewport.height);
    try {
      await load(page, name + ".html", documentHtml(mark, pageCss, "", paged), paged);
      const receipt = await saveEvidence(page, name, viewport);
      await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
      report[name] = {
        pages: receipt.pages, fits: receipt.visible,
        reconstruction: plan.groups.flatMap((g) => g.items.map((item) => item.body)).join("") ===
          receipt.paragraphs.map((item) => item.text).join(""),
        fragments: receipt.fragments,
      };
    } catch (error) {
      report[name] = { error: error.message };
    }
  }
  return report;
}

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const report = { browser: browser.version(), sources: {} };
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  for (const [id, relative] of Object.entries(cases)) {
    const bytes = await fs.readFile(path.join(root, relative));
    const blocks = bytes.toString("utf8").trim().split(/\r?\n(?:\s*\r?\n)+/g);
    const plan = sections(id, blocks);
    const result = await draw(page, id, markup(plan, id), plan);
    report.sources[id] = { path: relative, sha256: createHash("sha256").update(bytes).digest("hex"), plan, result };
  }
} finally {
  await browser.close();
}
await write("results.json", JSON.stringify(report, null, 2) + "\n");
for (const [id, { result }] of Object.entries(report.sources)) {
  console.log(id, Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.chosen ?? value.pages ?? value.error ?? "rejected"])));
}
