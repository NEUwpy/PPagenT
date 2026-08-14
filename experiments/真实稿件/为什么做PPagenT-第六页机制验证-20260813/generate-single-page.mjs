import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import provider from "../../../src/agent/deepseek-provider-from-env.mjs";
import { createNortheasternUniversityRenderer } from "../../../src/agent/neu-renderer.mjs";
import { buildVisualCandidateSets, resolveVisualPlan } from "../../../src/agent/visual-resolution.mjs";
import { runDirectorWorkflow } from "../../../src/agent/workflow.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(experimentDir, "../../..");
const inputPath = path.join(experimentDir, "第六页验证稿.md");
const outputPath = path.join(experimentDir, "为什么做PPagenT-第六页-机制修复-v2.pptx");
const runDir = path.join(experimentDir, "run-02-order-preserved");
const rawMarkdown = await fs.readFile(inputPath, "utf8");

const renderer = createNortheasternUniversityRenderer({
  sourcePptx: path.join(root, "PPT源", "PPT模板-封面正文尾页.pptx"),
  outputPptx: outputPath,
  manuscriptSource: path.relative(root, inputPath).replaceAll("\\", "/"),
});

const result = await runDirectorWorkflow({
  root,
  input: { rawMarkdown, skinId: "northeastern-university" },
  provider,
  outputDir: runDir,
  visualCandidateProvider: buildVisualCandidateSets,
  visualResolver: resolveVisualPlan,
  renderer,
  reviewMode: "none",
});

process.stdout.write(`${result.outputPptx}\n`);
