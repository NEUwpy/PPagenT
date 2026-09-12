import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  RUNNER_STAGES, STAGE_OF_PHASE, RUNNER_PIPELINE_NOTE,
  archiveRunSummary, runnerArtifacts, readRunnerDeckTitle,
} from "../src/workbench/runner-run-adapter.mjs";

async function tempDir(t) {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-runner-adapter-"));
  t.after(() => fs.rm(target, { recursive: true, force: true }));
  return target;
}

async function write(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents, "utf8");
}

test("阶段映射的每个目标都必须真的在流水线阶段表里", () => {
  const ids = new Set(RUNNER_STAGES.map(([id]) => id));
  for (const [phase, stage] of Object.entries(STAGE_OF_PHASE)) {
    assert.ok(ids.has(stage), `${phase} 映射到了不存在的阶段 ${stage}`);
  }
  // 运行器的四个阶段必须全部有归属，否则看板上会出现永远不亮的阶段。
  assert.deepEqual(Object.keys(STAGE_OF_PHASE).sort(), ["content", "content-revision", "ready", "visual"]);
  assert.equal(STAGE_OF_PHASE.ready, "delivery");
  assert.equal(STAGE_OF_PHASE["content-revision"], "content-director");
});

test("产物清单只列真实存在的文件，并按页码自然排序", async (t) => {
  const runDir = await tempDir(t);
  assert.deepEqual(await runnerArtifacts(runDir), [], "空目录不得列出任何产物");

  await write(path.join(runDir, "deck.pptx"), "x");
  await write(path.join(runDir, "state.md"), "x");
  await write(path.join(runDir, "qa", "montage.webp"), "x");
  // 故意造出 slide-10 与 slide-2：字典序会把 10 排到 2 前面，页码序不会。
  for (const name of ["slide-2.png", "slide-10.png", "slide-1.png"]) await write(path.join(runDir, "qa", name), "x");
  await write(path.join(runDir, "qa", "inspect.ndjson"), "x");

  const labels = (await runnerArtifacts(runDir)).map((item) => item.label);
  assert.deepEqual(labels, [
    "可编辑 PPTX", "整套预览", "第 1 页", "第 2 页", "第 10 页", "运行状态",
  ]);
  // blueprint.json / content.md / tool-events.ndjson 这次没写，就不能出现在清单里。
  assert.equal(labels.includes("实际被构建的蓝图"), false);
  assert.equal(labels.some((label) => label.includes("inspect")), false);
});

test("历史运行从 state.json 合成只读记录，状态按真实阶段判定", async (t) => {
  const runDir = await tempDir(t);
  await write(path.join(runDir, "state.json"), `${JSON.stringify({
    phase: "ready",
    sourcePath: "harness/runs/样例/原稿.md",
    deckBrief: { title: "样例整稿标题" },
    sources: [{ id: "s1" }, { id: "s2" }],
    pages: [{ pageId: "p1" }, { pageId: "p2" }, { pageId: "p3" }],
  }, null, 2)}\n`);
  await write(path.join(runDir, "deck.pptx"), "x");

  const summary = await archiveRunSummary({ runId: "样例", runDir });
  assert.equal(summary.runId, "样例");
  assert.equal(summary.originalName, "原稿.md");
  assert.equal(summary.deckTitle, "样例整稿标题");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.pageCount, 3);
  assert.equal(summary.sourceCount, 2);
  assert.equal(summary.pipeline, "runner");
  assert.deepEqual(summary.archive, { root: "harness/runs", readOnly: true });
  // 当时没有检查点这件事不能被显示成"auto"或"manual"。
  assert.equal(summary.visualCheckpointMode, null);
  assert.equal(summary.nativePreviewCheckpointMode, null);
  // 模型名没有记录，就不许拿当前配置去冒充当时用的模型。
  assert.equal(summary.model, null);
  assert.deepEqual(summary.artifacts.map((item) => item.label), ["可编辑 PPTX"]);
  assert.equal(summary.pipelineNote, RUNNER_PIPELINE_NOTE);
});

test("有逐页预览时页数按幻灯片数算，正文页数另记", async (t) => {
  const runDir = await tempDir(t);
  await write(path.join(runDir, "state.json"), `${JSON.stringify({
    phase: "ready",
    sources: [{ id: "s1" }, { id: "s2" }],
    // 三页正文：牌组实际是 1 张封面 + 3 张正文 = 4 张。
    pages: [{ pageId: "p1" }, { pageId: "p2" }, { pageId: "p3" }],
  })}\n`);
  for (const name of ["slide-01.png", "slide-02.png", "slide-03.png", "slide-04.png"]) {
    await write(path.join(runDir, "qa", name), "x");
  }

  const summary = await archiveRunSummary({ runId: "样例", runDir });
  // 同一次运行在工作台入口与历史入口必须报同一个页数，否则同一份稿子会显示成两个数。
  assert.equal(summary.pageCount, 4);
  assert.equal(summary.bodyPageCount, 3);
  assert.equal(summary.sourceCount, 2);
});

test("未到 ready 的历史运行记为已停止，宿主失败记为失败", async (t) => {
  const root = await tempDir(t);
  const stopped = path.join(root, "stopped");
  await write(path.join(stopped, "state.json"), `${JSON.stringify({ phase: "visual", sources: [], pages: [] })}\n`);
  assert.equal((await archiveRunSummary({ runId: "stopped", runDir: stopped })).status, "stopped");

  const broken = path.join(root, "broken");
  await write(path.join(broken, "state.json"), `${JSON.stringify({
    phase: "visual", sources: [], pages: [], runtimeFailure: { message: "未找到 Edge" },
  })}\n`);
  assert.equal((await archiveRunSummary({ runId: "broken", runDir: broken })).status, "failed");
});

test("读不到整稿标题时返回 null，不编造", async (t) => {
  const runDir = await tempDir(t);
  assert.equal(await readRunnerDeckTitle(runDir), null);
  await write(path.join(runDir, "state.json"), `${JSON.stringify({ phase: "content", sources: [], pages: [] })}\n`);
  assert.equal(await readRunnerDeckTitle(runDir), null);
});
