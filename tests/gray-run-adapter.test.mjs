import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GRAY_STAGES, GRAY_PIPELINE_NOTE,
  grayStepFiles, graySnapshot, grayArtifacts, grayPreview,
  grayContinuability, prepareGrayResume,
} from "../src/workbench/gray-run-adapter.mjs";

async function tempDir(t) {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-gray-adapter-"));
  t.after(() => fs.rm(target, { recursive: true, force: true }));
  return target;
}

async function write(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, typeof contents === "string" ? contents : JSON.stringify(contents, null, 2), "utf8");
}

const AREA = { width: 1170, height: 492, label: "测试区" };

/** 一轮完整的、全部通过的修订：文件集与 gray-draft.mjs 实际落盘一致。 */
async function writeCompleteRevision(runDir, revision = 0) {
  const dir = path.join(runDir, `revision-${revision}`);
  await write(path.join(dir, "system-prompt.txt"), "SYSTEM");
  await write(path.join(dir, "model-response.json"), { schemaVersion: "gray-plan-3", pages: [] });
  await write(path.join(dir, "content-plan.json"), { schemaVersion: "gray-plan-3", pages: [] });
  await write(path.join(dir, "expression-prompt.txt"), "EXPRESSION");
  await write(path.join(dir, "expression-response.json"), { selections: [] });
  await write(path.join(dir, "semantic-plan.json"), { schemaVersion: "gray-plan-3", pages: [] });
  await write(path.join(dir, "structure-check.json"), { accepted: true, issues: [] });
  await write(path.join(dir, "semantic-prompt.txt"), "REVIEW");
  await write(path.join(dir, "visible-plan.json"), { pages: [] });
  await write(path.join(dir, "semantic-response.json"), { accepted: true, issues: [] });
  await write(path.join(dir, "semantic-check.json"), { accepted: true, issues: [] });
  await write(path.join(dir, "layout-prompt.txt"), "LAYOUT");
  await write(path.join(dir, "layout-response-0.json"), { composition: "column" });
  await write(path.join(dir, "layout-resolved-0.json"), { receipts: [] });
  await write(path.join(dir, "layout-check-0.json"), { accepted: true, issues: [] });
  await write(path.join(dir, "plan.json"), { pages: [] });
  await write(path.join(dir, "program-check.json"), { accepted: true, issues: [] });
}

async function writeRunState(runDir, { status, history, runtimeFailure = null }) {
  await write(path.join(runDir, "state.json"), {
    sourcePath: "source.md",
    deckBrief: { title: "测试稿" },
    pages: [],
    grayDraft: { version: "gray-draft-3", area: AREA, sourceHash: "abc", status, humanReview: "pending", history, provider: "chat-completions:test", providerSettings: { model: "test-model" } },
    ...(runtimeFailure ? { runtimeFailure } : {}),
  });
}

test("阶段表与步骤文件映射的键一一对应", async (t) => {
  const runDir = await tempDir(t);
  const files = await grayStepFiles(runDir, null);
  assert.deepEqual(Object.keys(files).sort(), GRAY_STAGES.map(([id]) => id).sort());
  // 任何一步的四个分类都必须存在（可以为空数组），前端按固定四列渲染。
  for (const step of Object.values(files)) {
    assert.deepEqual(Object.keys(step).sort(), ["checks", "inputs", "outputs", "prompts"]);
  }
  assert.match(GRAY_PIPELINE_NOTE, /等待审阅|续跑/);
});

test("步骤文件列出这一轮的真实文件，多尝试也照实列", async (t) => {
  const runDir = await tempDir(t);
  await writeCompleteRevision(runDir, 0);
  // 布局重试的第二、三次尝试文件
  await write(path.join(runDir, "revision-0", "layout-response-1.json"), "{}");
  await write(path.join(runDir, "revision-0", "layout-check-1.json"), "{}");
  const files = await grayStepFiles(runDir, 0);
  assert.equal(files["semantic-planning"].prompts[0].path, "revision-0/system-prompt.txt");
  assert.equal(files["semantic-planning"].checks[0].path, "revision-0/structure-check.json");
  assert.equal(files["expression-selection"].prompts[0].path, "revision-0/expression-prompt.txt");
  assert.equal(files["semantic-review"].inputs[0].path, "revision-0/visible-plan.json");
  const layoutLabels = files["layout-solving"].outputs.map((item) => item.label);
  assert.ok(layoutLabels.includes("模型响应（基础组合）"), "第一次尝试不带序号");
  assert.ok(layoutLabels.includes("模型响应（基础组合） · 第 2 次"), "第二次尝试带序号");
  assert.equal(files["layout-solving"].checks.at(-1).path, "revision-0/program-check.json");
});

test("全部通过的运行：每步完成，渲染完成，预览与产物按真实文件列出", async (t) => {
  const runDir = await tempDir(t);
  await writeRunState(runDir, { status: "awaiting-user-review", history: [{ revision: 0, program: true, semantic: true, directory: "revision-0" }] });
  await writeCompleteRevision(runDir, 0);
  await write(path.join(runDir, "source.md"), "原稿");
  await write(path.join(runDir, "rules-snapshot.md"), "规则");
  await write(path.join(runDir, "plan.json"), { deckBrief: { title: "测试稿" }, pages: [{ pageId: "p1", title: "页一", claim: "主张", items: [{ id: "i1" }, { id: "i2" }] }] });
  await write(path.join(runDir, "preview", "slide-01.png"), "png");
  await write(path.join(runDir, "gray-draft.pptx"), "pptx");
  await write(path.join(runDir, "editable-check.json"), { accepted: true });

  const snapshot = await graySnapshot(runDir);
  assert.equal(snapshot.kind, "gray");
  assert.equal(snapshot.status, "awaiting-user-review");
  assert.equal(snapshot.activeRevision, 0);
  assert.equal(snapshot.currentStage, null);
  const statuses = Object.fromEntries(snapshot.steps.map((step) => [step.id, step.status]));
  assert.deepEqual(statuses, {
    "manuscript-normalization": "succeeded",
    "semantic-planning": "succeeded",
    "expression-selection": "succeeded",
    "semantic-review": "succeeded",
    "layout-solving": "succeeded",
    "gray-rendering": "succeeded",
  });
  assert.equal(snapshot.preview.pptxPath, "gray-draft.pptx");
  assert.deepEqual(snapshot.preview.pages, ["preview/slide-01.png"]);
  assert.equal(snapshot.plan.title, "测试稿");
  assert.equal(snapshot.plan.pages[0].itemCount, 2);

  const artifacts = await grayArtifacts(runDir);
  const paths = artifacts.map((item) => item.path);
  assert.ok(paths.includes("gray-draft.pptx"));
  assert.ok(paths.includes("preview/slide-01.png"));
  assert.ok(paths.includes("editable-check.json"));
  // 没有写过的文件不许出现在清单里。
  assert.equal(paths.includes("content.md"), false);
});

test("表达调用进行中：规划已过、表达标记为进行中而不是规划进行中", async (t) => {
  const runDir = await tempDir(t);
  await writeRunState(runDir, { status: "planning", history: [] });
  await write(path.join(runDir, "source.md"), "原稿");
  // 表达调用前的落盘：系统提示、规划响应、计划、表达提示词；结构检查要等表达绑定后才写。
  await write(path.join(runDir, "revision-0", "system-prompt.txt"), "SYSTEM");
  await write(path.join(runDir, "revision-0", "model-response.json"), "{}");
  await write(path.join(runDir, "revision-0", "content-plan.json"), "{}");
  await write(path.join(runDir, "revision-0", "expression-prompt.txt"), "EXPRESSION");

  const snapshot = await graySnapshot(runDir);
  const statuses = Object.fromEntries(snapshot.steps.map((step) => [step.id, step.status]));
  assert.equal(statuses["semantic-planning"], "succeeded");
  assert.equal(statuses["expression-selection"], "running");
  assert.equal(snapshot.currentStage, "expression-selection");
});

test("结构检查失败的一轮：规划失败、下游被跳过、轮未通过", async (t) => {
  const runDir = await tempDir(t);
  await writeRunState(runDir, { status: "blocked", history: [{ revision: 0, program: false, semantic: null, directory: "revision-0" }] });
  await write(path.join(runDir, "source.md"), "原稿");
  await write(path.join(runDir, "revision-0", "model-response.json"), "{}");
  await write(path.join(runDir, "revision-0", "content-plan.json"), "{}");
  await write(path.join(runDir, "revision-0", "structure-check.json"), { accepted: false, issues: [{ code: "topic-overflow" }] });

  const snapshot = await graySnapshot(runDir);
  const statuses = Object.fromEntries(snapshot.steps.map((step) => [step.id, step.status]));
  assert.equal(statuses["semantic-planning"], "failed");
  assert.equal(statuses["expression-selection"], "skipped");
  assert.equal(statuses["semantic-review"], "skipped");
  assert.equal(statuses["gray-rendering"], "skipped");
  assert.equal(snapshot.revisions[0].passed, false);
});

test("续跑判定：等待审阅与中断都可续，运行中不可续", async (t) => {
  const runDir = await tempDir(t);
  const summary = { pipeline: "gray", status: "awaiting-user-review" };
  await writeRunState(runDir, { status: "awaiting-user-review", history: [{ revision: 0, program: true, semantic: true }] });
  let state = JSON.parse(await fs.readFile(path.join(runDir, "state.json"), "utf8"));
  const allowed = grayContinuability({ summary, state });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.mode, "resume");
  assert.match(allowed.reason, /再来一轮修订|一轮规划修订/);

  const blocked = grayContinuability({
    summary: { pipeline: "gray", status: "failed" },
    state: { ...state, grayDraft: { ...state.grayDraft, status: "blocked" }, runtimeFailure: { message: "模型输出截断" } },
  });
  assert.equal(blocked.allowed, true);
  assert.equal(blocked.cleanup, true);
  assert.match(blocked.reason, /整理未完成的修订轮/);

  const running = grayContinuability({ summary: { pipeline: "gray", status: "running" }, state });
  assert.equal(running.allowed, false);
  assert.match(running.reason, /正在进行/);

  const notGray = grayContinuability({ summary: { pipeline: "runner", status: "failed" }, state });
  assert.equal(notGray.allowed, false);
});

test("续跑前整理：未完成的轮目录改名保留，不删除", async (t) => {
  const runDir = await tempDir(t);
  await writeRunState(runDir, { status: "planning", history: [] });
  await write(path.join(runDir, "revision-0", "system-prompt.txt"), "半截");
  await write(path.join(runDir, "revision-0", "model-response.json"), "{}");

  const result = await prepareGrayResume(runDir);
  assert.equal(result.revision, 0);
  assert.match(result.moved, /^revision-0-interrupted-\d{14}$/);
  assert.equal(await fs.stat(path.join(runDir, "revision-0")).then(() => "exists", () => "missing"), "missing");
  const renamed = await fs.readdir(runDir);
  assert.ok(renamed.some((name) => name.startsWith("revision-0-interrupted-")));
  // 已完成后没有未完成目录时，什么都不动。
  const again = await prepareGrayResume(runDir);
  assert.equal(again.moved, null);
});

test("预览取最新渲染：续跑后的产物在 revision-N/artifacts/ 时按修改时间取最新", async (t) => {
  const runDir = await tempDir(t);
  await write(path.join(runDir, "gray-draft.pptx"), "old");
  await write(path.join(runDir, "preview", "slide-01.png"), "old-page");
  await new Promise((resolve) => setTimeout(resolve, 20));
  await write(path.join(runDir, "revision-1", "artifacts", "gray-draft.pptx"), "new");
  await write(path.join(runDir, "revision-1", "artifacts", "preview", "slide-01.png"), "new-page");
  await write(path.join(runDir, "revision-1", "artifacts", "editable-check.json"), { accepted: true });

  const preview = await grayPreview(runDir);
  assert.equal(preview.pptxPath, "revision-1/artifacts/gray-draft.pptx");
  assert.deepEqual(preview.pages, ["revision-1/artifacts/preview/slide-01.png"]);
  assert.equal(preview.editableCheckPath, "revision-1/artifacts/editable-check.json");
});
