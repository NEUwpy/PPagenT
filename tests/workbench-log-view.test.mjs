import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTraceRecorder } from "../src/workbench/trace-recorder.mjs";
import { compileRunLog } from "../src/workbench/log-view.mjs";

test("工作台日志视图从事件和 trace 编译每阶段输入输出", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-log-view-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const recorder = createTraceRecorder(root);
  await recorder.observe({ source: "workbench", type: "stage-call", status: "running", stage: "layout-solving", input: { pageId: "p1" } });
  await recorder.observe({ source: "model", type: "api-call", status: "succeeded", stage: "layout-solving", output: { candidateId: "cards-horizontal-equal" } });
  await recorder.flush();
  const view = await compileRunLog(root);
  assert.equal(view.source, "events.jsonl + trace/*.json");
  assert.equal(view.lastSequence, 2);
  assert.deepEqual(view.stages["layout-solving"].inputs[0].value, { pageId: "p1" });
  assert.deepEqual(view.stages["layout-solving"].outputs[0].value, { candidateId: "cards-horizontal-equal" });
});

