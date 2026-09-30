import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEBUG_SEGMENTS, runDebugSegment } from "../src/workbench/segment-runner.mjs";
import { createTraceRecorder, readTraceEvents } from "../src/workbench/trace-recorder.mjs";

const fixturePath = path.resolve("experiments/a0-gray-layout-review/workbench-input.json");

test("A0 分段运行写出输入、候选、检查、灰稿与日志", async () => {
  assert.ok(DEBUG_SEGMENTS["a0-layout-candidates"]);
  const input = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-segment-"));
  const recorder = createTraceRecorder(root);
  const result = await runDebugSegment({ segmentId: "a0-layout-candidates", input, output: root, recorder });
  await recorder.flush();
  assert.equal(result.status, "awaiting-user-review");
  for (const file of ["input.json", "input-plan.json", "candidates.json", "result.json", "refusals.json", "gray-draft.pptx", "editable-check.json"]) {
    await assert.doesNotReject(fs.access(path.join(root, file)));
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "result.json"), "utf8")).check.accepted, true);
  const events = await readTraceEvents(root);
  assert.deepEqual(events.map(event => [event.stage, event.status]), [["a0-layout-candidates", "running"], ["a0-layout-candidates", "succeeded"]]);
});
