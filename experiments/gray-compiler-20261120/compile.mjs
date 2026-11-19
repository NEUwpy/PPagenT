import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { measureGrayPage } from "./measure.mjs";
import { minimumGroupWidth, renderGrayPage } from "./render.mjs";
import { collectFields, validatePagePlan } from "./validate.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const folder = path.dirname(fileURLToPath(import.meta.url));
const usage = `用法
  node experiments/gray-compiler-20261120/compile.mjs <page-plan.json> [--out 目录] [--width 1280] [--height 720]

输出 gray.html、gray.png、layout.json、report.json。拒绝时输出 report.json 与可测的失败预览。
重复使用同一输出位置时，新运行保存到子目录。`;
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean" }, out: { type: "string" }, width: { type: "string" }, height: { type: "string" } },
});
if (values.help) {
  console.log(usage);
  process.exit(0);
}

function dimension(value, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new Error("画布尺寸必须是正整数");
  }
  return Number(value);
}

const canvas = { width: dimension(values.width, 1280), height: dimension(values.height, 720) };
if (positionals.length !== 1) throw new Error(usage);
const inputFile = path.resolve(positionals[0]);
const target = path.resolve(values.out ?? path.join(folder, "output",
  path.basename(inputFile, ".json") + "-" + canvas.width + "x" + canvas.height));
await fs.mkdir(path.dirname(target), { recursive: true });
let destination = target;
try {
  await fs.mkdir(target);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  destination = await fs.mkdtemp(path.join(target, "run-"));
}
const write = (file, content) => fs.writeFile(path.join(destination, file), content, "utf8");
const json = (file, content) => write(file, JSON.stringify(content, null, 2) + "\n");

async function executablePath() {
  const candidates = process.env.BROWSER_EXECUTABLE_PATH
    ? [process.env.BROWSER_EXECUTABLE_PATH]
    : [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      chromium.executablePath(),
    ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("找不到 Chromium。可用 BROWSER_EXECUTABLE_PATH 指定本机 Chrome 或 Edge。");
}

function allocate(total, weights, minima) {
  if (minima.reduce((sum, width) => sum + width, 0) > total) return null;
  const widths = Array(weights.length).fill(0);
  const open = weights.map((_, index) => index);
  let space = total;
  while (open.length) {
    const sum = open.reduce((result, index) => result + weights[index], 0);
    const pin = open.findIndex((index) => space * weights[index] / sum < minima[index]);
    if (pin < 0) {
      for (const index of open) widths[index] = Math.floor(space * weights[index] / sum);
      const residue = total - widths.reduce((result, width) => result + width, 0);
      for (const index of open.slice(0, residue)) widths[index] += 1;
      return widths;
    }
    const [index] = open.splice(pin, 1);
    widths[index] = minima[index];
    space -= minima[index];
  }
  return widths;
}

function candidateLayouts(groups) {
  const margin = Math.max(22, Math.min(54, Math.round(canvas.width * 0.042)));
  const fullWidth = canvas.width - 2 * margin;
  const gap = Math.max(14, Math.min(28, Math.round(canvas.width * 0.022)));
  const lengths = groups.map((group) => group.items.length * 32 + collectFields(group)
    .reduce((length, { field }) => length + [...field.text].length, 0));
  const weighted = lengths.map((length) => Math.sqrt(length));
  const average = weighted.reduce((sum, weight) => sum + weight, 0) / weighted.length;
  const weightings = [
    ["content-weighted", weighted],
    ["balanced", groups.map(() => 1)],
    ["stronger-content-weight", weighted.map((weight) => weight * weight / average)],
  ];
  const layouts = [];
  for (const [density, padding] of [["standard", 12], ["compact", 10]]) {
    const minima = groups.map((group) => minimumGroupWidth(group, padding));
    const seen = new Set();
    for (const [mode, weights] of weightings) {
      const columns = allocate(fullWidth - (groups.length - 1) * gap, weights, minima);
      const key = columns?.join(",");
      if (!columns || seen.has(key)) continue;
      seen.add(key);
      layouts.push({ id: density + "-row-" + mode, canvas, margin, gap, padding, direction: "row", columns, density });
    }
    if (groups.length > 1 && minima.every((width) => width <= fullWidth)) {
      layouts.push({ id: density + "-column", canvas, margin, gap, padding, direction: "column",
        columns: groups.map(() => fullWidth), density });
    }
  }
  return layouts;
}

function rank(layout, measured) {
  const shortEnds = measured.texts.filter(({ lines }) =>
    lines.length > 1 && [...lines.at(-1).text.trim()].length <= 3).length;
  const heights = measured.groups.map(({ visibleHeight }) => visibleHeight);
  const imbalance = heights.length > 1 && layout.direction === "row" ? Math.max(...heights) - Math.min(...heights) : 0;
  const weightPreference = layout.id.endsWith("content-weighted") ? 0 : 2;
  return (layout.density === "compact" ? 175 : 0) + (layout.direction === "column" ? 225 : 0)
    + shortEnds * 12 + imbalance / 12 + weightPreference;
}

function bodyFiles() {
  return { html: "gray.html", png: "gray.png", layout: "layout.json", plan: "page-plan.json" };
}

function relationshipRecords(page) {
  const notes = (owner, scoped = []) => scoped.map(({ id, appliesTo }) => ({ id, owner, appliesTo }));
  const groups = page.groups.map(({ id, relation, title, items, scopeNotes }) => ({
    id, title, relation, members: items.map(({ id }) => id),
    items: items.map(({ id, component }) => ({ id, ...(component ? { component } : {}) })),
    notes: notes(id, scopeNotes),
  }));
  return { groups, notes: notes(page.id, page.scopeNotes) };
}

async function screenshot(page, file) {
  await page.screenshot({ path: path.join(destination, file), animations: "disabled" });
}

async function run() {
  const report = { version: "gray-compile-report@1", status: "rejected", phase: "input",
    input: path.basename(inputFile), canvas, errors: [], candidates: [] };
  let browser;
  try {
    const input = await fs.readFile(inputFile, "utf8");
    report.inputSha256 = createHash("sha256").update(input).digest("hex");
    const plan = JSON.parse(input);
    const validation = await validatePagePlan(plan, repository);
    if (validation.errors.length) {
      report.errors = validation.errors;
      return report;
    }

    report.phase = "layout";
    const layouts = candidateLayouts(plan.page.groups);
    if (!layouts.length) {
      report.errors.push({ code: "no-space-for-group", message: "内容区宽度小于组件或分区的最低宽度" });
      return report;
    }
    browser = await chromium.launch({ executablePath: await executablePath(), headless: true });
    report.browser = browser.version();
    const page = await browser.newPage({ viewport: canvas });
    const measuredCandidates = [];
    for (const layout of layouts) {
      try {
        const html = renderGrayPage(plan, layout);
        await page.setContent(html);
        const measured = await measureGrayPage(page, plan);
        const valid = measured.errors.length === 0;
        const score = valid ? rank(layout, measured) : null;
        measuredCandidates.push({ html, layout, valid, score, measured });
        report.candidates.push({ layout, valid, score, frame: measured.frame, groups: measured.groups,
          errors: measured.errors });
      } catch (error) {
        report.candidates.push({ layout, valid: false, errors: [{ code: "render-candidate", message: error.message }] });
      }
    }
    const selected = measuredCandidates.filter(({ valid }) => valid).sort((a, b) => a.score - b.score)[0];
    if (!selected) {
      report.errors.push({ code: "no-fitting-layout", message: "所有候选均被拒绝，具体文本与几何错误见 candidates" });
      const diagnostic = measuredCandidates.sort((a, b) => a.measured.errors.length - b.measured.errors.length)[0];
      if (diagnostic) {
        await write("rejected.html", diagnostic.html);
        await page.setContent(diagnostic.html);
        await page.evaluate(() => document.fonts.ready);
        await screenshot(page, "rejected.png");
        report.diagnosticPreview = { html: "rejected.html", png: "rejected.png", candidate: diagnostic.layout.id };
      }
      return report;
    }

    await page.setContent(selected.html);
    const replay = await measureGrayPage(page, plan);
    if (JSON.stringify(replay) !== JSON.stringify(selected.measured)) {
      report.errors.push({ code: "unstable-render", message: "复渲染结果与入选候选的浏览器测量不同" });
      return report;
    }
    report.phase = "output";
    const files = bodyFiles();
    const layout = {
      version: "gray-layout@1", pageId: plan.page.id, inputSha256: report.inputSha256, canvas,
      units: "CSS px", origin: "slide top-left", compilerLayout: selected.layout,
      frame: replay.frame, readingOrder: replay.texts.map(({ id }) => id), relations: relationshipRecords(plan.page),
      sources: validation.sources, notes: plan.page.notes ?? [], objects: replay.nodes,
      texts: replay.texts, groups: replay.groups,
    };
    await write(files.html, selected.html);
    await screenshot(page, files.png);
    await json(files.layout, layout);
    await json(files.plan, plan);
    report.status = "passed";
    report.selected = selected.layout.id;
    report.artifacts = files;
    return report;
  } catch (error) {
    report.errors.push({ code: report.phase === "input" ? "read-plan" : "compile-error", message: error.message });
    return report;
  } finally {
    await browser?.close();
  }
}

const report = await run();
await json("report.json", report);
console.log(JSON.stringify({ status: report.status, directory: destination, selected: report.selected, errors: report.errors }, null, 2));
if (report.status !== "passed") process.exitCode = 1;
