import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createNativePptCheckpoint,
  readNativePptCheckpoint,
} from "../src/workbench/native-ppt-checkpoint.mjs";

test("Native PPT 检查点在确认前暂停，确认后放行同一份暂存 PPTX", async (t) => {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-native-ppt-checkpoint-"));
  t.after(() => fs.rm(runDir, { recursive: true, force: true }));
  const transitions = [];
  let awaitingReady;
  const awaiting = new Promise((resolve) => { awaitingReady = resolve; });
  const checkpoint = createNativePptCheckpoint({
    runDir,
    onAwaiting: async () => {
      transitions.push("awaiting");
      awaitingReady();
    },
    onResumed: async () => transitions.push("approved"),
  });
  const preview = {
    schemaVersion: "1.0",
    status: "ready-for-approval",
    stagedPptx: path.join(runDir, "staged-deck.pptx"),
    pageEvidence: [path.join(runDir, "slide-01.png")],
    pageCount: 1,
  };

  let settled = false;
  const paused = checkpoint.pause(preview).then((value) => {
    settled = true;
    return value;
  });
  await awaiting;
  assert.equal(settled, false);
  assert.deepEqual(transitions, ["awaiting"]);
  assert.equal((await readNativePptCheckpoint(runDir)).status, "awaiting-user");

  await checkpoint.approve();
  const approved = await paused;
  assert.equal(approved.approvalStatus, "approved");
  assert.equal(approved.stagedPptx, preview.stagedPptx);
  assert.deepEqual(transitions, ["awaiting", "approved"]);
  assert.equal((await readNativePptCheckpoint(runDir)).status, "approved");
});

test("Native PPT 等待确认时可以取消并释放暂停任务", async (t) => {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-native-ppt-cancel-"));
  t.after(() => fs.rm(runDir, { recursive: true, force: true }));
  let awaitingReady;
  const awaiting = new Promise((resolve) => { awaitingReady = resolve; });
  const checkpoint = createNativePptCheckpoint({
    runDir,
    onAwaiting: async () => awaitingReady(),
  });
  const paused = checkpoint.pause({ stagedPptx: "staged.pptx", pageEvidence: [], pageCount: 0 });
  const rejected = assert.rejects(paused, (error) => error.code === "WORKBENCH_RUN_CANCELLED");
  await awaiting;
  await checkpoint.cancel();
  await rejected;
  assert.equal(checkpoint.read().status, "cancelled");
  assert.equal((await readNativePptCheckpoint(runDir)).status, "cancelled");
});
