import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MAIN_FLOW_STEPS, validateMainRange, runMainNormalization } from "../src/workbench/main-flow.mjs";
import { createTraceRecorder, readTraceEvents } from "../src/workbench/trace-recorder.mjs";

test("main flow exposes the ordered construction boundary", () => {
  assert.equal(MAIN_FLOW_STEPS.length, 10);
  assert.deepEqual(MAIN_FLOW_STEPS.slice(0, 2).map(step => step.id), ["manuscript-normalization", "pagination-draft"]);
  assert.equal(validateMainRange("manuscript-normalization", "manuscript-normalization").length, 1);
  assert.throws(() => validateMainRange("manuscript-normalization", "pagination-draft"), /独立入口待建设/);
});

test("main normalization records exact text and stops before pagination", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-main-flow-"));
  const output = path.join(root, "run");
  await fs.mkdir(path.join(output, "input"), { recursive: true });
  const inputPath = path.join(root, "source.md");
  const raw = "\n# 标题\n\n条件：不得删改。\n";
  await fs.writeFile(inputPath, raw, "utf8");
  const recorder = createTraceRecorder(output);
  const result = await runMainNormalization({ inputPath, originalName: "source.md", output, recorder });
  await recorder.flush();
  assert.equal(result.contentMarkdown, raw);
  assert.equal(await fs.readFile(path.join(output, "input", "normalized.md"), "utf8"), raw);
  assert.equal(result.nextStep, "pagination-draft");
  assert.equal((await readTraceEvents(output)).map(event => `${event.stage}:${event.status}`).join(","), "manuscript-normalization:running,manuscript-normalization:succeeded");
});
