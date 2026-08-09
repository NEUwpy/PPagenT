import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const generatorPath = path.join(
  projectRoot,
  "experiments",
  "真实稿件",
  "为什么做PPagenT-v0.1.0",
  "generate.mjs",
);

test("指定视觉源的真实稿件必须先复制模板 starter", async () => {
  const source = await fs.readFile(generatorPath, "utf8");

  assert.match(source, /prepareTemplateMappedStarter\s*\(/);
  assert.match(source, /PresentationFile\.importPptx\s*\(/);
  assert.match(source, /PresentationFile\.exportPptx\s*\(/);
  assert.doesNotMatch(source, /Presentation\.create\s*\(/);
  assert.doesNotMatch(source, /component-builders\.mjs/);
});

test("东北大学真实稿件的页面只映射到源模板四类页面", async () => {
  const planPath = path.join(path.dirname(generatorPath), "deck-plan.json");
  const plan = JSON.parse(await fs.readFile(planPath, "utf8"));

  assert.equal(plan.visualSource, "PPT模板-封面正文尾页.pptx");
  assert.deepEqual(
    [...new Set(plan.slides.map((slide) => slide.sourceSlide))].sort(),
    [1, 2, 3, 4],
  );
  assert.equal(plan.validation.templateFidelity, "passed");
});
