import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { measureGrayPage } from "../gray-compiler-20261120/measure.mjs";
import { deriveExpression } from "./express.mjs";
import { bandCandidates, evaluateBand, renderBand } from "./bands.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const legacyCompiler = fileURLToPath(new URL("../gray-compiler-20261120/compile.mjs", import.meta.url));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" }, out: { type: "string" }, width: { type: "string" },
    height: { type: "string" }, route: { type: "string", default: "both" },
  },
});
const usage = "node experiments/semantic-auto-layout-20261120/compile.mjs <纯内容 JSON> --out <新目录> [--width 1280] [--height 720] [--route both|baseline|bands]";
if (values.help) {
  console.log(usage);
  process.exit(0);
}
if (positionals.length !== 1 || !values.out || !["both", "baseline", "bands"].includes(values.route)) {
  throw new Error(usage);
}

function dimension(argument, fallback) {
  const number = Number(argument ?? fallback);
  if (!Number.isInteger(number) || number <= 0 || number > 4096) throw new Error("幅面尺寸需为 1–4096 的整数");
  return number;
}

const inputFile = path.resolve(positionals[0]);
const canvas = { width: dimension(values.width, 1280), height: dimension(values.height, 720) };
const requestedOutput = path.resolve(values.out);
await fs.mkdir(path.dirname(requestedOutput), { recursive: true });
let output = requestedOutput;
try {
  await fs.mkdir(output);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  output = await fs.mkdtemp(path.join(output, "run-"));
}
const json = (folder, file, value) => fs.writeFile(path.join(folder, file), JSON.stringify(value, null, 2) + "\n", "utf8");

async function browserExecutable() {
  const candidates = process.env.BROWSER_EXECUTABLE_PATH ? [process.env.BROWSER_EXECUTABLE_PATH] : [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", chromium.executablePath(),
  ];
  for (const candidate of candidates) {
    try { await fs.access(candidate); return candidate; } catch {}
  }
  throw new Error("找不到可执行的 Chromium，可通过 BROWSER_EXECUTABLE_PATH 指定");
}

async function additionalChecks(page, content, expression, measured) {
  const noteBindings = [
    ...(content.page.scopeNotes ?? []),
    ...content.page.groups.flatMap(({ scopeNotes = [] }) => scopeNotes),
  ].map(({ id, appliesTo }) => ["note:" + id, appliesTo]);
  const scopeBindings = noteBindings.concat(expression.crossCase.map(({ id, appliesTo }) => ["item:" + id, appliesTo]));
  const nodes = new Map(measured.nodes.map((node) => [node.id, node]));
  for (const [id, targets] of scopeBindings) {
    if (JSON.stringify(nodes.get(id)?.appliesTo) !== JSON.stringify(targets)) {
      measured.errors.push({ code: "scope-binding", id, expected: targets });
    }
  }
  const generatedLabels = await page.locator(".scope-label").evaluateAll((labels) => labels.map((label) => {
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = range.getBoundingClientRect();
    const owner = label.closest("aside").getBoundingClientRect();
    return { id: label.dataset.node, inside: text.left >= owner.left && text.right <= owner.right + 1
      && text.top >= owner.top && text.bottom <= owner.bottom + 1 };
  }));
  for (const { id, inside } of generatedLabels) {
    if (!inside) measured.errors.push({ code: "scope-label-outside-note", id });
  }
  return measured;
}

async function compileBands(destination, content, expression) {
  const report = { version: "semantic-band-report@1", status: "rejected", canvas, candidates: [], errors: [] };
  const layouts = bandCandidates(expression, canvas);
  if (!layouts.length) {
    report.errors.push(expression.plan.page.groups.length > 6
      ? { code: "band-search-limit", message: "此试验枚举支持最多六组" }
      : { code: "no-band-width", message: "幅面宽度不足以达到现有组件的最低宽度" });
    return report;
  }
  const browser = await chromium.launch({ executablePath: await browserExecutable(), headless: true });
  try {
    report.browser = browser.version();
    const page = await browser.newPage({ viewport: canvas });
    const examined = [];
    for (const layout of layouts) {
      try {
        const html = renderBand(expression, layout);
        await page.setContent(html);
        const measured = await additionalChecks(page, content, expression, await measureGrayPage(page, expression.plan));
        const score = measured.errors.length ? null : evaluateBand(layout, measured);
        examined.push({ html, measured, score, layout });
        report.candidates.push({ layout, score, frame: measured.frame, groups: measured.groups, errors: measured.errors });
      } catch (error) {
        report.candidates.push({ layout, score: null, errors: [{ code: "candidate-render", message: error.message }] });
      }
    }
    const selected = examined.filter(({ score }) => score).sort((a, b) => a.score.cost - b.score.cost)[0];
    const savePreview = async (candidate, name) => {
      if (!candidate) return;
      await fs.writeFile(path.join(destination, name + ".html"), candidate.html, "utf8");
      await page.setContent(candidate.html);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(destination, name + ".png"), animations: "disabled" });
    };
    if (!selected) {
      report.errors.push({ code: "no-fitting-bands", message: "没有分带候选同时通过文字、边界、关系和作用域检查" });
      const diagnostic = examined.sort((a, b) => a.measured.errors.length - b.measured.errors.length)[0];
      await savePreview(diagnostic, "rejected");
      report.diagnosticPreview = diagnostic?.layout.id;
      return report;
    }
    await page.setContent(selected.html);
    const replay = await additionalChecks(page, content, expression, await measureGrayPage(page, expression.plan));
    if (JSON.stringify(replay) !== JSON.stringify(selected.measured)) {
      report.errors.push({ code: "unstable-render", message: "候选复渲染的浏览器实测结果不同" });
      return report;
    }
    await savePreview(selected, "gray");
    const { frame, nodes, texts, groups } = replay;
    await json(destination, "layout.json", {
      version: "semantic-band-layout@1", units: "CSS px", origin: "slide top-left", canvas,
      pageId: content.page.id, compilerLayout: selected.layout, frame, objects: nodes, texts, groups,
      readingOrder: texts.map(({ id }) => id), sources: expression.sources,
      expression: expression.decisions, crossCase: expression.crossCase, notes: expression.plan.page.notes ?? [],
    });
    report.status = "passed";
    report.selected = selected.layout.id;
    report.metrics = selected.score;
    return report;
  } finally {
    await browser.close();
  }
}

async function run() {
  const summary = { version: "semantic-auto-layout@1", input: path.relative(repository, inputFile).replaceAll("\\", "/"),
    canvas, routes: {}, errors: [] };
  let content, expression;
  try {
    const original = await fs.readFile(inputFile);
    summary.inputSha256 = createHash("sha256").update(original).digest("hex");
    await fs.writeFile(path.join(output, "content.json"), original);
    content = JSON.parse(original.toString("utf8").replace(/^\uFEFF/u, ""));
    expression = await deriveExpression(content, repository);
    summary.errors = expression.errors;
  } catch (error) {
    summary.errors.push({ code: "input-read", message: error.message });
  }
  if (summary.errors.length) return summary;
  await json(output, "expression.json", {
    plan: expression.plan, decisions: expression.decisions, crossCase: expression.crossCase,
    localRelations: content.page.groups.flatMap(({ items }) => items.filter(({ detail }) => detail)
      .map(({ id, detail }) => ({ itemId: id, ...detail }))),
  });
  await json(output, "page-plan.json", expression.plan);

  if (values.route !== "bands") {
    const destination = path.join(output, "baseline");
    const result = spawnSync(process.execPath, [legacyCompiler, path.join(output, "page-plan.json"), "--out", destination,
      "--width", String(canvas.width), "--height", String(canvas.height)], { cwd: repository, encoding: "utf8" });
    try {
      const report = JSON.parse(await fs.readFile(path.join(destination, "report.json"), "utf8"));
      summary.routes.baseline = { status: report.status, selected: report.selected, errors: report.errors };
    } catch (error) {
      summary.routes.baseline = { status: "rejected", errors: [{ code: "baseline-execution",
        message: result.error?.message || result.stderr || error.message }] };
    }
  }
  if (values.route !== "baseline") {
    const destination = path.join(output, "bands");
    await fs.mkdir(destination);
    let report;
    try {
      report = await compileBands(destination, content, expression);
    } catch (error) {
      report = { status: "rejected", errors: [{ code: "band-execution", message: error.message }] };
    }
    await json(destination, "report.json", report);
    summary.routes.bands = { status: report.status, selected: report.selected, errors: report.errors };
  }
  return summary;
}

const summary = await run();
summary.status = summary.errors.length || Object.values(summary.routes).some(({ status }) => status !== "passed")
  ? "rejected" : "passed";
await json(output, "summary.json", summary);
console.log(JSON.stringify({ output, ...summary }, null, 2));
if (summary.status === "rejected") process.exitCode = 1;
