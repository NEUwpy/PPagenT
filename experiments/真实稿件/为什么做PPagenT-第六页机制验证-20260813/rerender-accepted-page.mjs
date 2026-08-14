import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapPageContent } from "../../../assets/结构图/顺序流程-001/generate.mjs";
import { createNortheasternUniversityRenderer } from "../../../src/agent/neu-renderer.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(experimentDir, "../../..");
const acceptedRun = path.join(experimentDir, "run");
const visualDir = path.join(acceptedRun, "visual", "attempt-02");
const readJson = async (target) => JSON.parse(await fs.readFile(target, "utf8"));
const outputPptx = path.join(experimentDir, "为什么做PPagenT-第六页-机制修复-v2.pptx");

const renderer = createNortheasternUniversityRenderer({
  sourcePptx: path.join(root, "PPT源", "PPT模板-封面正文尾页.pptx"),
  outputPptx,
  manuscriptSource: "experiments/真实稿件/为什么做PPagenT-第六页机制验证-20260813/第六页验证稿.md",
});

const pageContents = await readJson(path.join(acceptedRun, "content", "attempt-01", "page-contents.json"));
const pageIntents = await readJson(path.join(visualDir, "page-intents.json"));
const mappedPayload = mapPageContent(pageContents[0], pageIntents[0]);
mappedPayload.parameters.visualVariantId = "horizontal-cards";

const result = await renderer({
  root,
  outputDir: path.join(experimentDir, "rerender-v2"),
  deckPlan: await readJson(path.join(acceptedRun, "content", "attempt-01", "deck-plan.json")),
  pageContents,
  pageIntents,
  compositionPlan: await readJson(path.join(visualDir, "composition-plan.json")),
  layoutDecisions: await readJson(path.join(visualDir, "layout-decisions.json")),
  renderPayloads: [mappedPayload],
});

process.stdout.write(`${result.outputPptx}\n`);
