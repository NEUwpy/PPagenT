import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { audit } from "./audit.mjs";
import { candidateId, discover, enumerate, grade } from "./candidates.mjs";
import { project } from "./projection.mjs";
import { repository, validateContent } from "./validate-content.mjs";

const execute = promisify(execFile);
const here = fileURLToPath(new URL("./", import.meta.url));
const compiler = fileURLToPath(new URL("../gray-compiler-20261120/compile.mjs", import.meta.url));
const relative = (file) => path.relative(repository, file).replaceAll("\\", "/");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
const checksum = async (file) => createHash("sha256").update(await fs.readFile(file)).digest("hex");

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  out: { type: "string" }, width: { type: "string", default: "1280" }, height: { type: "string", default: "720" },
  probe: { type: "string", multiple: true, default: [] },
} });
const probes = ["reverse-sequence", "cases-as-sequence", "drop-scope"];
if (positionals.length !== 1 || values.probe.some((probe) => !probes.includes(probe))) {
  throw new Error("node run.mjs <input.json> [--out folder] [--width 1280] [--height 720] [--probe " + probes.join("|") + "]");
}
for (const value of [values.width, values.height]) {
  if (!/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("画布尺寸必须是正整数");
}
const input = path.resolve(positionals[0]);
const content = await readJson(input);
const validation = await validateContent(content);
if (validation.length) throw new Error(validation.join("\n"));

const target = path.resolve(values.out ?? path.join(here, "output", `${content.page.id}-${values.width}x${values.height}`));
await fs.mkdir(path.dirname(target), { recursive: true });
let destination = target;
try {
  await fs.mkdir(destination);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  destination = await fs.mkdtemp(path.join(target, "run-"));
}

const { choices, excluded } = discover(content.page);
const results = new Map();
async function measure(selected, probe) {
  const id = probe ? "probe-" + probe : candidateId(selected);
  if (results.has(id)) return results.get(id);
  const directory = path.join(destination, id);
  await fs.mkdir(directory);
  const inputPlan = path.join(directory, "input-plan.json");
  const compiled = path.join(directory, "compile");
  const projection = project(content, selected, probe);
  const { plan, ...trace } = projection;
  const args = [compiler, inputPlan, "--width", values.width, "--height", values.height, "--out", compiled];
  await writeJson(inputPlan, plan);
  await writeJson(path.join(directory, "projection.json"), trace);
  let exitCode = 0;
  try {
    await execute(process.execPath, args, { cwd: repository, windowsHide: true });
  } catch (error) {
    exitCode = error.code;
    await fs.writeFile(path.join(directory, "stderr.txt"), error.stderr || error.message, "utf8");
  }
  const report = await readJson(path.join(compiled, "report.json"));
  const result = { id, probe, selected: selected.map(({ owner, kind, benefit, reason }) => ({ owner, kind, benefit, reason })),
    command: ["node", relative(compiler), relative(inputPlan), ...args.slice(2, -1), relative(compiled)],
    exitCode, report: relative(path.join(compiled, "report.json")), compilerStatus: report.status };
  if (report.status === "passed") {
    const layout = await readJson(path.join(compiled, "layout.json"));
    result.audit = audit(content, trace, layout);
    result.layout = layout.compilerLayout.id;
    result.grade = grade(selected, layout);
    result.preview = relative(path.join(compiled, "gray.html"));
    result.image = relative(path.join(compiled, "gray.png"));
  } else {
    result.errors = report.errors;
    result.layoutErrorCodes = [...new Set(report.candidates.flatMap(({ errors }) => errors.map(({ code }) => code)))];
    if (report.diagnosticPreview) {
      result.preview = relative(path.join(compiled, report.diagnosticPreview.html));
      result.image = relative(path.join(compiled, report.diagnosticPreview.png));
    }
  }
  results.set(id, result);
  console.log(JSON.stringify({ id, compiler: result.compilerStatus, audit: result.audit?.errors,
    score: result.grade?.total, errorCodes: result.layoutErrorCodes }));
  return result;
}

const passes = ({ compilerStatus, audit }) => compilerStatus === "passed" && !audit.errors.length;
// Route A proposes each directly supported expression before measuring the page.
const direct = await measure(choices);
const baseline = passes(direct) ? direct : await measure([]);

// Route B measures every text/graphic combination, reusing identical measurements from route A.
for (const selected of enumerate(choices)) await measure(selected);
const ranked = [...results.values()].filter(passes).sort((a, b) =>
  b.grade.total - a.grade.total || a.selected.length - b.selected.length || a.id.localeCompare(b.id, "en"));

for (const probe of values.probe) {
  const selected = probe === "reverse-sequence" ? [choices.find(({ kind }) => kind === "sequence")].filter(Boolean) : [];
  await measure(selected, probe);
}
const summaries = [...results.values()];
await writeJson(path.join(destination, "summary.json"), {
  command: ["node", relative(import.meta.filename), ...process.argv.slice(2)],
  input: relative(input), inputSha256: await checksum(input),
  selectorSha256: await checksum(path.join(here, "candidates.mjs")),
  compilerSha256: await checksum(compiler),
  canvas: { width: Number(values.width), height: Number(values.height) },
  choices: choices.map(({ owner, kind, reason, benefit }) => ({ owner, kind, reason, benefit })), excluded,
  direct: { first: direct.id, winner: passes(baseline) ? baseline.id : null },
  enumeration: { winner: ranked[0]?.id ?? null, ranking: ranked.map(({ id }) => id) },
  candidates: summaries,
});
console.log(JSON.stringify({ destination: relative(destination), direct: passes(baseline) ? baseline.id : null,
  enumeration: ranked[0]?.id ?? null }));
const failedProbe = summaries.some((result) => result.probe && (result.compilerStatus !== "passed" || !result.audit.errors.length));
if (!ranked.length || failedProbe) process.exitCode = 1;
