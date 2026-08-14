import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNortheasternUniversityRenderer } from "../../../src/agent/neu-renderer.mjs";
import { resolveVisualPlan } from "../../../src/agent/visual-resolution.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(experimentDir, "../../..");
const contentDir = path.join(experimentDir, "run", "content", "attempt-01");
const visualDir = path.join(experimentDir, "run", "visual", "attempt-01");
const replayDir = path.join(experimentDir, "accepted-replay");
const outputPptx = path.join(experimentDir, "为什么做PPagenT-第06张-Visual-Skill机制验证.pptx");
const readJson = (target) => fs.readFile(target, "utf8").then(JSON.parse);

const [deckPlan, pageContents, pageIntents, visualPlan, compositionPlan, candidateSets] = await Promise.all([
  readJson(path.join(contentDir, "deck-plan.json")),
  readJson(path.join(contentDir, "page-contents.json")),
  readJson(path.join(visualDir, "page-intents.json")),
  readJson(path.join(visualDir, "visual-plan.json")),
  readJson(path.join(visualDir, "composition-plan.json")),
  readJson(path.join(visualDir, "candidate-sets.json")),
]);

const resolved = await resolveVisualPlan({
  root,
  pageContents,
  pageIntents,
  visualPlan,
  compositionPlan,
  candidateSets,
});
if (resolved.status !== "accepted") {
  throw new Error(`保存的视觉导演结果仍未通过：${JSON.stringify(resolved.feedback)}`);
}

await fs.mkdir(replayDir, { recursive: true });
await fs.writeFile(
  path.join(replayDir, "resolved.json"),
  `${JSON.stringify(resolved, null, 2)}\n`,
  "utf8",
);
const renderer = createNortheasternUniversityRenderer({
  sourcePptx: path.join(root, "PPT源", "PPT模板-封面正文尾页.pptx"),
  outputPptx,
  manuscriptSource: path.relative(root, path.join(experimentDir, "第06张验证稿.md")).replaceAll("\\", "/"),
});
const result = await renderer({
  outputDir: replayDir,
  deckPlan,
  pageContents,
  pageIntents,
  compositionPlan: resolved.compositionPlan,
  layoutDecisions: resolved.layoutDecisions,
  renderPayloads: resolved.renderPayloads,
});
process.stdout.write(`${result.outputPptx}\n`);
