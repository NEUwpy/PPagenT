import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  RUNNER_STAGES, STAGE_OF_PHASE, RUNNER_PIPELINE_NOTE,
  archiveRunSummary, runnerArtifacts, readRunnerDeckTitle,
  continuability, readAttempts, stageProvenance, interruptedStageCalls,
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

test("续跑判定：五种不能续跑的情形各自给出原因，不静默放行", () => {
  const running = { pipeline: "runner", status: "failed" };
  const state = { phase: "visual" };

  const archive = continuability({ summary: running, state, isArchive: true });
  assert.equal(archive.allowed, false);
  assert.equal(archive.mode, null);
  assert.match(archive.reason, /只读/);

  const missing = continuability({ summary: null, state });
  assert.equal(missing.allowed, false);
  assert.match(missing.reason, /找不到/);

  const legacy = continuability({ summary: { pipeline: "legacy", status: "failed" }, state });
  assert.equal(legacy.allowed, false);
  assert.match(legacy.reason, /旧 API 生产线/);

  const noState = continuability({ summary: running, state: null });
  assert.equal(noState.allowed, false);
  assert.match(noState.reason, /state\.json/);

  // 正在进行中的运行不能被第二条任务插进来：工作台一次只跑一个。
  for (const status of ["normalizing", "running"]) {
    const busy = continuability({ summary: { pipeline: "runner", status }, state });
    assert.equal(busy.allowed, false, `${status} 不该允许续跑`);
    assert.match(busy.reason, /正在进行中/);
  }
});

test("续跑判定：未到 ready 从当前阶段接续，到 ready 只能零模型重编译", () => {
  const summary = { pipeline: "runner", status: "failed" };

  const resume = continuability({ summary, state: { phase: "visual" } });
  assert.equal(resume.allowed, true);
  assert.equal(resume.mode, "resume");
  assert.equal(resume.fromPhase, "visual");
  // 提示里要说清"之前阶段沿用"，否则用户不知道这次不会重跑内容。
  assert.match(resume.reason, /页面方案与真实构建/);
  assert.match(resume.reason, /沿用上次产物/);

  const ready = continuability({ summary: { pipeline: "runner", status: "succeeded" }, state: { phase: "ready" } });
  assert.equal(ready.allowed, true);
  assert.equal(ready.mode, "recompile");
  assert.equal(ready.fromPhase, "ready");
  assert.match(ready.reason, /零模型重编译/);

  // 上次停在宿主依赖失败上时，续跑会清掉标记——这一点必须显示出来。
  const failed = continuability({ summary, state: { phase: "visual", runtimeFailure: { message: "未找到 Edge" } } });
  assert.match(failed.reason, /宿主依赖失败/);
});

test("尝试记录只认形状自证的条目，不替谁补字段", () => {
  assert.deepEqual(readAttempts(undefined), []);
  assert.deepEqual(readAttempts({}), []);
  assert.deepEqual(readAttempts({ attempts: "第一次" }), []);
  const kept = { attempt: 2, mode: "resume", fromPhase: "visual" };
  assert.deepEqual(readAttempts({ attempts: [{ mode: "resume" }, { attempt: 1 }, null, "x", kept] }), [kept]);
});

test("阶段沿用按最近一次尝试的起点算，第一次运行全部算重跑", () => {
  assert.deepEqual(stageProvenance({}), {
    "manuscript-normalization": "rerun", "content-director": "rerun",
    "visual-director": "rerun", delivery: "rerun",
  });

  // 从视觉阶段接续：稿件进入与内容两段沿用上次产物，本次不会有它们的事件。
  assert.deepEqual(stageProvenance({ attempts: [{ attempt: 1, mode: "resume", fromPhase: "visual" }] }), {
    "manuscript-normalization": "reused", "content-director": "reused",
    "visual-director": "rerun", delivery: "rerun",
  });

  // 零模型重编译：只有交付段是本次做的，前三段全部沿用。
  assert.deepEqual(stageProvenance({ attempts: [{ attempt: 1, mode: "recompile", fromPhase: "ready" }] }), {
    "manuscript-normalization": "reused", "content-director": "reused",
    "visual-director": "reused", delivery: "rerun",
  });

  // 先跑完整一遍、再从视觉接续：算的是**最近一次**的起点，不是第一次的。
  assert.deepEqual(stageProvenance({
    attempts: [{ attempt: 1, mode: "first" }, { attempt: 2, mode: "resume", fromPhase: "visual" }],
  }), {
    "manuscript-normalization": "reused", "content-director": "reused",
    "visual-director": "rerun", delivery: "rerun",
  });

  // 起点就是第一个阶段时，没有任何阶段是沿用的。
  assert.deepEqual(stageProvenance({ attempts: [{ attempt: 2, mode: "resume", fromPhase: "content" }] }), {
    "manuscript-normalization": "reused", "content-director": "rerun",
    "visual-director": "rerun", delivery: "rerun",
  });
});

// —— 续跑跨尝试终态 ——
// 一条运行记录里会有**多次尝试**：第一次跑到视觉阶段被进程杀掉（留下 running 且永远没有终态），
// 用户点「继续跑」再来一次，这次该阶段正常跑完。旧实现「历史 running 集合 − 历史 terminal 集合」
// 在这里会得出空集（因为历史里确实有一条 terminal），于是第二次尝试被杀掉时不再补记；
// 而模板的 stageInfo 反向找**任意**终态，会拿第一次的 failed 压住第二次的 running，
// 界面上显示「已失败」，其实它正在跑。两处都必须以**该阶段最近一次 stage-call** 为准。
const attemptSequence = [
  { sequence: 1, type: "stage-call", status: "running", stage: "visual-director" },
  { sequence: 2, type: "stage-call", status: "failed", stage: "visual-director" },
  { sequence: 3, type: "stage-call", status: "running", stage: "visual-director" },
];

test("中断收尾只看该阶段最近一次调用，不被上一次尝试的终态压住", () => {
  // 最近一次是 running：这一次确实没收到终态，必须补记。
  assert.deepEqual(interruptedStageCalls(attemptSequence), ["visual-director"]);
  // 最近一次已经有终态：不该补记，否则会给跑完的阶段硬加一条失败。
  assert.deepEqual(interruptedStageCalls(attemptSequence.slice(0, 2)), []);
  // 一个阶段都没起来过（事件里只有别的阶段）：不补记。
  assert.deepEqual(interruptedStageCalls([{ sequence: 1, type: "stage-call", status: "succeeded", stage: "delivery" }]), []);
  // 非 stage-call 事件不参与判定。
  assert.deepEqual(interruptedStageCalls([{ sequence: 1, type: "api-call", status: "running", stage: "visual-director" }]), []);
  // 多个阶段各自判定，顺序按事件出现顺序。
  assert.deepEqual(interruptedStageCalls([
    { sequence: 1, type: "stage-call", status: "running", stage: "content-director" },
    { sequence: 2, type: "stage-call", status: "running", stage: "visual-director" },
    { sequence: 3, type: "stage-call", status: "succeeded", stage: "content-director" },
  ]), ["visual-director"]);
});

// 模板里的 stageInfo 是纯函数（只闭包 events），所以可以抽真源码求值——
// 这是审核方用过的同一个手法：不重写一遍逻辑，测的就是看板真正会跑的那段代码。
function templateStageInfo() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "tools", "templates", "production-workbench.html");
  return fs.readFile(file, "utf8").then((source) => {
    const found = source.match(/^ *function stageInfo\(stageId\)\{.*\}$/mu);
    assert.ok(found, "模板里必须存在 stageInfo（stageInfo 是看板阶段状态的唯一判据）");
    return (events) => new Function("events", `return (${found[0].trim()})`)(events);
  });
}

test("看板 stageInfo 同样以最近一次调用为准，第二次尝试跑起来就不会显示成已失败", async (t) => {
  const stageInfo = await templateStageInfo();
  t.diagnostic(`stageInfo 源码取自 production-workbench.html`);

  // 最近一次是 running → 显示 running，不能被上一次的 failed 压住。
  assert.equal(stageInfo(attemptSequence)("visual-director").status, "running");
  // 最近一次是 failed → 显示 failed。
  assert.equal(stageInfo(attemptSequence.slice(0, 2))("visual-director").status, "failed");
  // 最近一次是 succeeded → 显示 succeeded。
  assert.equal(stageInfo([
    { type: "stage-call", status: "running", stage: "delivery" },
    { type: "stage-call", status: "succeeded", stage: "delivery" },
  ])("delivery").status, "succeeded");
  // 一条事件都没有 → pending。
  assert.equal(stageInfo([])("visual-director").status, "pending");
  // 人工检查点的 awaiting 仍然优先于调用状态。
  assert.equal(stageInfo([
    { type: "manual-checkpoint", status: "awaiting-user", stage: "visual-director" },
    { type: "stage-call", status: "succeeded", stage: "visual-director" },
  ])("visual-director").status, "awaiting");
  // 既有字段不能被这次改动弄丢（看板别处还在用）。
  const info = stageInfo([{ type: "api-call", source: "model", status: "running", stage: "visual-director", durationMs: 5 }])("visual-director");
  assert.equal(info.calls, 1);
  assert.equal(info.duration, 5);
  assert.equal(info.list.length, 1);
});
