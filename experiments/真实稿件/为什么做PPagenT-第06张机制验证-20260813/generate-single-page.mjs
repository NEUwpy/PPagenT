import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import provider from "../../../src/agent/deepseek-provider-from-env.mjs";
import { createNortheasternUniversityRenderer } from "../../../src/agent/neu-renderer.mjs";
import { buildVisualCandidateSets, resolveVisualPlan } from "../../../src/agent/visual-resolution.mjs";
import { runDirectorWorkflow } from "../../../src/agent/workflow.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(experimentDir, "../../..");
const inputPath = path.join(experimentDir, "第06张验证稿.md");
const outputPath = path.join(experimentDir, "为什么做PPagenT-第06张-Visual-Skill绑定实验.pptx");
const rawMarkdown = await fs.readFile(inputPath, "utf8");

const result = await runDirectorWorkflow({
  root,
  input: { rawMarkdown, skinId: "northeastern-university" },
  provider,
  outputDir: path.join(experimentDir, "run"),
  visualCandidateProvider: buildVisualCandidateSets,
  visualResolver: resolveVisualPlan,
  renderer: createNortheasternUniversityRenderer({
    sourcePptx: path.join(root, "PPT源", "PPT模板-封面正文尾页.pptx"),
    outputPptx: outputPath,
    manuscriptSource: path.relative(root, inputPath).replaceAll("\\", "/"),
  }),
  reviewMode: "none",
});

process.stdout.write(`${result.outputPptx}\n`);
