import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { buildSourceBlocks } from "../../../src/content/source-blocks.mjs";
import { stylesheet } from "./styles.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../../..");
const output = path.join(here, "output");
const dist = path.join(here, "node_modules", "@chenglou", "pretext", "dist");
const writeJson = (file, data) => writeFile(path.join(output, file), JSON.stringify(data, null, 2) + "\n");

function makeItem(id, heading, body, source, { exactHeading = heading, trimFinalSemicolon = false } = {}) {
  const text = trimFinalSemicolon ? body.replace(/；$/u, "。") : body;
  const headingStart = exactHeading ? source.text.indexOf(exactHeading) : null;
  const bodyStart = source.text.indexOf(body);
  if (headingStart === -1 || bodyStart === -1) throw new Error(`Source binding failed for ${id}`);
  return {
    id, heading, text, source: source.id,
    headingSpan: headingStart == null ? null : [headingStart, headingStart + exactHeading.length],
    bodySpan: [bodyStart, bodyStart + body.length],
  };
}

async function inputs() {
  const files = ["稿件/变革不足与感悟-v3-条件否定.md", "稿件/模拟稿库/行政信息/A04-备件供应方式对比说明.md"];
  const [hr, spares] = await Promise.all(files.map(async (file) => {
    const raw = await readFile(path.join(workspace, file), "utf8");
    return { file, sources: buildSourceBlocks(raw), sha256: createHash("sha256").update(raw).digest("hex") };
  }));
  const [hrTitle, ...hrGroups] = hr.sources;
  const [hrIntro, title] = hrTitle.text.split("：");
  const groups = hrGroups.map((source, groupIndex) => {
    const headers = [...source.text.matchAll(/[一二三四]是([^。]+)。(?!。)/gu)];
    if (headers.length !== [2, 4][groupIndex]) throw new Error("HR headings changed");
    const label = source.text.slice(0, headers[0].index).replace(/^(首先|其次)是|。$/gu, "");
    return {
      id: `hr-g${groupIndex + 1}`, label, peer: groupIndex === 0,
      items: headers.map((heading, index) => makeItem(
        `hr-${groupIndex + 1}-${index + 1}`, heading[1],
        source.text.slice(heading.index + heading[0].length, headers[index + 1]?.index),
        source, { exactHeading: heading[0] },
      )),
    };
  });
  const [sparesTitle, modes, grading, enforce] = spares.sources;
  const modeTexts = modes.text.match(/^(.*?。)(集中供应)(.+?；)(就近供应)(.+)$/u);
  const gradeTexts = grading.text.match(/^(.+?)。(.*?。)(涉及安全停机.*)$/u);
  if (!modeTexts || !gradeTexts) throw new Error("Spares structure changed");
  return [
    { id: "hr", ...hr, intro: hrIntro, title, groups },
    { id: "spares", ...spares, title: sparesTitle.text, deck: modeTexts[1], groups: [
      { id: "spares-g1", label: "两种方式", peer: true, items: [
        makeItem("central", modeTexts[2], modeTexts[3], modes, { trimFinalSemicolon: true }),
        makeItem("local", modeTexts[4], modeTexts[5], modes),
      ] },
      { id: "spares-g2", label: "分级建议", items: [
        makeItem("grading", "", gradeTexts[1] + "。" + gradeTexts[2], grading),
      ] },
      { id: "spares-g3", label: "执行要求", items: [
        makeItem("exception", "关键备件", gradeTexts[3], grading, { exactHeading: "" }),
        makeItem("effective", "生效与衔接", enforce.text, enforce, { exactHeading: "" }),
      ] },
    ] },
  ];
}

function documentHtml(inner) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>文字排版试验</title><style>${stylesheet}</style><body>${inner}</body></html>`;
}

const cachedBrowserModule = await readFile(path.join(here, "compose-browser.mjs"));
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.end(documentHtml(""));
  }
  response.setHeader("Content-Type", "text/javascript; charset=utf-8");
  if (pathname === "/compose.mjs") return response.end(cachedBrowserModule);
  if (pathname.startsWith("/pretext/")) {
    const file = path.resolve(dist, pathname.slice("/pretext/".length));
    if (path.relative(dist, file).startsWith("..")) {
      response.writeHead(403);
      return response.end();
    }
    try {
      return response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      return response.end();
    }
  }
  response.writeHead(404);
  response.end();
});
await mkdir(output, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

async function save(page, result, name) {
  const file = path.join(output, name + ".html");
  await writeFile(file, documentHtml(result.html), "utf8");
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, name + ".png") });
}

function receipt(trial) {
  const { measured, ...remaining } = trial;
  delete remaining.html;
  return { ...remaining, measured };
}

const records = await inputs();
await writeJson("input-map.json", records);
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const probe = await page.evaluate(async (records) => (await import("/compose.mjs")).probe(records), records);
  const matches = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  probe.summary = {
    browser: browser.version(), version: JSON.parse(await readFile(path.join(dist, "..", "package.json"), "utf8")).version,
    fixedWidthTrials: probe.results.length,
    greedyLineCountsMatch: probe.results.filter((item) => item.pretext.length === item.greedy.length).length,
    greedyLinesMatch: probe.results.filter((item) => matches(item.pretext, item.greedy)).length,
    prettyLineCountsMatch: probe.results.filter((item) => item.pretext.length === item.pretty.length).length,
    prettyLinesMatch: probe.results.filter((item) => matches(item.pretext, item.pretty)).length,
    variableLineTrials: probe.variable.length,
    variableLinesMatch: probe.variable.filter((item) => matches(item.pretext.map((line) => line.text), item.native)).length,
  };
  await writeJson("line-probes.json", probe);
  const preview = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const summary = [];
  for (const input of records) {
    for (const [variant, frame] of [["standard", { width: 1148, height: 508 }], ["narrow", { width: 1012, height: 464 }]]) {
      const run = (sz, sparse, placement) => page.evaluate(async ({ input, frame, sz, sparse, placement }) =>
        (await import("/compose.mjs")).renderTrial({ input, frame, sz, sparse, variant: placement }),
      { input, frame, sz, sparse, placement });
      const first = await run(23, true);
      await save(preview, first, `${input.id}-${variant}-first`);
      const trials = [];
      let selected;
      for (const placement of ["aside", "above", "run-in"]) {
        for (const size of [22, 21.5, 21, 20.5, 20, 19.5, 19, 18.5, 18]) {
          const trial = await run(size, false, placement);
          trials.push(receipt(trial));
          if (trial.measured.valid && trial.measured.boundText && trial.measured.used <= frame.height - 12) {
            selected = trial;
            break;
          }
        }
        if (selected) break;
      }
      const name = `${input.id}-${variant}`;
      if (selected) await save(preview, selected, name);
      await writeJson(name + ".json", { input: input.id, variant, first: receipt(first), trials });
      summary.push({ id: input.id, variant, first: { used: first.measured.used, valid: first.measured.valid },
        selected: selected ? { used: selected.measured.used, size: selected.sz,
          headingPlacement: selected.layout.inline ? "run-in" : selected.layout.headline ? "above" : "alongside",
          html: `output/${name}.html`,
          png: `output/${name}.png`, columns: selected.groups.map((group) => group.chosen.map((column) => column.items)) } : null,
      });
    }
  }
  await writeJson("summary.json", { probes: probe.summary, pages: summary });
  console.log(JSON.stringify({ probes: probe.summary, pages: summary }, null, 2));
} finally {
  await browser?.close();
  server.close();
}
