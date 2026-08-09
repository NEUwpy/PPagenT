import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createNortheasternUniversityRenderer } from "./neu-renderer.mjs";
import { buildVisualCandidateSets, resolveVisualPlan } from "./visual-resolution.mjs";
import { DEFAULT_SKIN_ID, runDirectorWorkflow } from "./workflow.mjs";

function parseArgs(argv) {
  const options = {
    root: process.cwd(), input: "", skin: DEFAULT_SKIN_ID, output: "", "run-dir": "", provider: "",
    mode: "production",
    python: process.env.PPAGENT_PYTHON ?? "", "overflow-tool": process.env.PPAGENT_OVERFLOW_TOOL ?? "",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined || !(key in options)) throw new Error(`不支持的参数：${argv[index] ?? "<empty>"}`);
    options[key] = value;
  }
  for (const key of ["input", "output", "run-dir", "provider"]) {
    if (!options[key]) throw new Error(`缺少 --${key}`);
  }
  return options;
}

const execFileAsync = promisify(execFile);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function normalizedText(value) {
  return String(value).replaceAll("\r\n", "\n");
}

async function sha256JsonFile(filePath) {
  return sha256(JSON.stringify(JSON.parse(await fs.readFile(filePath, "utf8"))));
}

async function jsonFiles(root) {
  const files = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "run-manifest.json") files.push(target);
    }
  }
  await visit(root);
  return files.sort();
}

async function runOverflowCheck(options, outputPptx) {
  if (!options.python && !options["overflow-tool"]) return { status: "not-run" };
  if (!options.python || !options["overflow-tool"]) throw new Error("溢出检测必须同时提供 --python 与 --overflow-tool");
  const { stdout, stderr } = await execFileAsync(
    path.resolve(options.python),
    [path.resolve(options["overflow-tool"]), path.resolve(outputPptx)],
    { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
  );
  return {
    status: "passed",
    tool: { name: path.basename(options["overflow-tool"]), sha256: await sha256File(path.resolve(options["overflow-tool"])) },
    output: `${stdout}${stderr}`.trim(),
  };
}

export async function runWorkflowCli(options) {
  const root = path.resolve(options.root ?? process.cwd());
  if (!new Set(["production", "development"]).has(options.mode ?? "production")) {
    throw new Error("--mode 只允许 production 或 development");
  }
  if ((options.skin ?? DEFAULT_SKIN_ID) !== DEFAULT_SKIN_ID) {
    throw new Error(`当前 renderer 只支持 Skin：${DEFAULT_SKIN_ID}；拒绝把其他 Skin 记录为东北大学页面`);
  }
  const inputPath = path.resolve(options.input);
  const rawMarkdown = await fs.readFile(inputPath, "utf8");
  const providerModule = await import(pathToFileURL(path.resolve(options.provider)).href);
  const provider = providerModule.default ?? providerModule.provider;
  if (!provider) throw new Error("DirectorProvider 模块必须导出 default 或 provider");
  const renderer = createNortheasternUniversityRenderer({
    sourcePptx: path.join(root, "PPT模板-封面正文尾页.pptx"),
    outputPptx: path.resolve(options.output),
    manuscriptSource: path.relative(root, inputPath).replaceAll("\\", "/"),
  });
  const runDir = path.resolve(options["run-dir"] ?? options.runDir);
  const result = await runDirectorWorkflow({
    root,
    input: { rawMarkdown, skinId: options.skin ?? DEFAULT_SKIN_ID },
    provider,
    outputDir: runDir,
    visualCandidateProvider: buildVisualCandidateSets,
    visualResolver: resolveVisualPlan,
    renderer,
    reviewMode: options.mode === "development" ? "development" : "none",
  });
  const overflow = await runOverflowCheck(options, result.outputPptx);
  const workflowResultPath = path.join(runDir, "workflow-result.json");
  const workflowResult = JSON.parse(await fs.readFile(workflowResultPath, "utf8"));
  const finalWorkflowResult = {
    ...workflowResult,
    outputPptx: path.relative(root, result.outputPptx).replaceAll("\\", "/"),
    finalQa: {
      postRenderReview: result.workflowMode === "development" ? "passed" : "not-part-of-production-workflow",
      overflow,
    },
    runManifest: path.relative(root, path.join(runDir, "run-manifest.json")).replaceAll("\\", "/"),
  };
  await fs.writeFile(workflowResultPath, `${JSON.stringify(finalWorkflowResult, null, 2)}\n`, "utf8");

  const artifactFiles = await jsonFiles(runDir);
  const artifacts = Object.fromEntries(await Promise.all(artifactFiles.map(async (file) => [
    path.relative(runDir, file).replaceAll("\\", "/"),
    await sha256JsonFile(file),
  ])));
  const pageEvidence = Object.fromEntries(await Promise.all(result.renderResult.pageEvidence.map(async (file, index) => [
    `slide-${String(index + 1).padStart(2, "0")}`,
    await sha256File(file),
  ])));
  const manifest = {
    schemaVersion: "1.0",
    status: result.status,
    input: {
      sourcePath: path.relative(root, inputPath).replaceAll("\\", "/"),
      sourceSha256: sha256(normalizedText(rawMarkdown)),
      skinId: options.skin ?? DEFAULT_SKIN_ID,
    },
    provider: {
      module: path.relative(root, path.resolve(options.provider)).replaceAll("\\", "/"),
      identity: provider.metadata ?? { providerKind: "module-without-metadata" },
    },
    artifacts,
    output: { path: path.relative(root, result.outputPptx).replaceAll("\\", "/"), sha256: await sha256File(result.outputPptx) },
    pageEvidence,
    qa: {
      postRenderReview: result.workflowMode === "development" ? "passed" : "not-part-of-production-workflow",
      overflow,
    },
  };
  await fs.writeFile(path.join(runDir, "run-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { ...result, overflow, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runWorkflowCli(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${result.outputPptx}\n`);
}
