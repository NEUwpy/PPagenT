// 运行器**重依赖**测试：会真的构建 PPTX 并调用审计器。
// 与 runner-core.test.mjs 分开是刻意的——那边是无引擎纯核，任何环境都能跑；
// 这边依赖 @oai/artifact-tool 与 assets/主题/东北大学-001/runtime-template.pptx，跑不了就是环境问题。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  newRunState, setDeckBrief, upsertPageBriefs, freezeContent, upsertComposition, writeState,
} from "../src/runner/state.mjs";
import { createCommitter } from "../src/runner/tools/generation.mjs";
import { createToolRegistry } from "../src/runner/tools/index.mjs";
import { buildDeckPages, compileDeck, buildTools, groupViolations } from "../src/runner/tools/build-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S1 = "临时协调入口简单，但记录分散在不同人的手里，交接时需要逐个确认。";
const S2 = "统一登记便于交接，但需要持续维护，对值班安排有额外要求。";
const S3 = "试点优先验证交接是否清楚。";
const MANUSCRIPT = `# 标题\n\n${S1}\n\n${S2}\n\n${S3}`;

const PLAN = {
  compositionId: "editorial-list",
  textSlots: [
    { slotId: "lead", sourceItemIds: ["i1"], contentMode: "all" },
    { slotId: "body", sourceItemIds: ["i2", "i3"], contentMode: "all" },
  ],
  itemLabels: { i1: "临时协调", i2: "统一登记", i3: "试点重点" },
};

/** 一份走到 visual 阶段、且 p1 已有方案的 state。sourceText 由 upsertPageBriefs 从稿件回填。 */
function visualState({ manuscript = MANUSCRIPT, plan = PLAN } = {}) {
  let state = newRunState(manuscript, "test.md");
  state = setDeckBrief(state, { title: "试稿", audience: "评审", objective: "说明两种协调方式的差别" });
  state = upsertPageBriefs(state, [{
    pageId: "p1", title: "两种协调方式的差别", claim: "两种方式各有取舍", relation: "comparison",
    items: [{ id: "i1", sourceIds: ["s1"] }, { id: "i2", sourceIds: ["s2"] }, { id: "i3", sourceIds: ["s3"] }],
  }]);
  state = freezeContent(state).state;
  if (plan) state = upsertComposition(state, "p1", plan, { accepted: true }).state;
  return state;
}

async function runDirFor(name) {
  const runDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), `ppagent-${name}-`)), "run");
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

/** 把 state 落盘并返回"真实派发路径"上的 check_pages：经注册表校验入参，与运行时完全一致。 */
async function dispatchCheckPages(state, args) {
  const runDir = await runDirFor("check");
  const statePath = path.join(runDir, "state.json");
  await writeState(statePath, state);
  const committer = createCommitter({ statePath });
  const registry = createToolRegistry({ tools: buildTools({ root, runDir, committer, statePath }), runDir });
  return { runDir, ...(await registry.dispatch("check_pages", args)) };
}

test("buildDeckPages 只出封面与正文页，正文逐字取自来源、模型不能自报", () => {
  const state = visualState();
  const pages = buildDeckPages(state);

  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((page) => page.payload.assetId), [
    "northeastern-university-cover-001",
    "northeastern-university-body-001",
  ]);
  // 议程页与尾页的文案在 state 里没有真源，硬编就是编造，所以整副牌组不含它们。
  assert.equal(pages.some((page) => page.payload.assetId.includes("agenda")), false);

  const items = pages[1].content.items;
  assert.deepEqual(items.map((item) => item.body), [S1, S2, S3]);
  assert.deepEqual(items.map((item) => item.title), ["临时协调", "统一登记", "试点重点"]);
  assert.equal(pages[1].content.title, "两种协调方式的差别");
  // 方案里只带 compositionId 与 textSlots 进渲染器；itemLabels 是呈现信息，渲染器不读它。
  assert.deepEqual(Object.keys(pages[1].composition).sort(), ["compositionId", "textSlots"]);
});

test("buildDeckPages 是确定性的，且不修改传入的 state", () => {
  const state = visualState();
  const before = structuredClone(state);
  assert.deepEqual(buildDeckPages(state), buildDeckPages(state));
  assert.deepEqual(state, before);
});

test("没有方案的正文页 composition 为 null（不得凭空补版式）", () => {
  const pages = buildDeckPages(visualState({ plan: null }));
  assert.equal(pages[1].composition, null);
  assert.equal(pages[1].payload.assetId, "northeastern-university-body-001");
});

test("groupViolations 按 slide 归集，typography 违规补出语义 code", () => {
  const grouped = groupViolations({
    typography: { violations: [{ slide: "slide-02", text: "试点", fontSize: 9, bbox: {} }] },
    geometry: { violations: [{ type: "out-of-slide", slide: "slide-03", parent: "qa-1" }] },
  });
  assert.deepEqual(grouped.get("slide-02").map((issue) => issue.code), ["tiny-font"]);
  assert.deepEqual(grouped.get("slide-03").map((issue) => issue.code), ["out-of-slide"]);
  assert.equal(grouped.get("slide-09"), undefined);
});

test("compileDeck 真的产出 PPTX、逐页 PNG 与 blueprint，且 blueprint 就是被构建的那份", async () => {
  const state = visualState();
  const runDir = await runDirFor("compile");
  const compiled = await compileDeck({ root, runDir, state });

  assert.equal(compiled.qualityAudit.status, "passed");
  assert.equal(compiled.pages.length, 2);

  const pptx = await fs.stat(path.join(runDir, "deck.pptx"));
  assert.ok(pptx.size > 5000, `PPTX 过小，疑似空文件：${pptx.size} 字节`);

  const shot = await fs.readFile(path.join(runDir, "qa", "slide-02.png"));
  // 校验收的是签名而不是"文件存在"——存在一个 0 字节文件也能通过后者。
  assert.deepEqual([...shot.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.ok(shot.length > 1000, `PNG 过小：${shot.length} 字节`);
  await fs.access(path.join(runDir, "qa", "montage.webp"));

  // blueprint.json 记录的是实际被构建的 pages，不是模型的意图；两者必须逐字一致。
  const blueprint = JSON.parse(await fs.readFile(path.join(runDir, "blueprint.json"), "utf8"));
  assert.deepEqual(blueprint, buildDeckPages(state));
  assert.equal(blueprint[1].content.items[1].body, S2);
});

test("check_pages 通过后按页记账，且已通过的版本被复用而不重复构建", async () => {
  const state = visualState();
  const first = await dispatchCheckPages(state, { pageIds: ["p1"] });
  assert.equal(first.result.accepted, true);
  assert.deepEqual(first.result.pages.map((page) => [page.pageId, page.status, page.slide]), [["p1", "passed", "slide-02"]]);
  assert.equal(first.result.reused.length, 0);

  // 复用键是 (status, revision)：同一版本再检查一次必须走复用，不得再构建。
  const persisted = JSON.parse(await fs.readFile(path.join(first.runDir, "state.json"), "utf8"));
  const second = await dispatchCheckPages(persisted, { pageIds: ["p1"] });
  assert.deepEqual(second.result.reused, [{ pageId: "p1", revision: 1 }]);
  assert.deepEqual(second.result.pages, []);
});

test("正文装不下时构建失败，且归因到出问题的那一页", async () => {
  // 约 600 字正文放进「一列条目」的正文槽位（上限 4 行、最小 16pt，约容 110 字），任何档位都排不下。
  const long = "交接记录需要逐项确认设备编号与归还时间，".repeat(30);
  const state = visualState({
    manuscript: `# 标题\n\n${S1}\n\n${long}\n\n${S3}`,
    plan: {
      compositionId: "editorial-list",
      textSlots: [
        { slotId: "lead", sourceItemIds: ["i1"], contentMode: "all" },
        { slotId: "body", sourceItemIds: ["i2", "i3"], contentMode: "all" },
      ],
      itemLabels: { i1: "临时协调", i2: "统一登记", i3: "试点重点" },
    },
  });
  const outcome = await dispatchCheckPages(state, { pageIds: ["p1"] });
  assert.equal(outcome.result.accepted, false);
  assert.equal(outcome.result.failedPageId, "p1");
  assert.equal(outcome.result.runtimeFailure, undefined);
  // 归因依据要落在结果里：预检唯一命中就不必付前缀二分那份构建代价。
  assert.equal(outcome.result.attribution, "precheck");
  assert.equal(outcome.result.precheck[0].code, "composition-text-fit-failed");

  // 失败也要落盘：这一页的产物状态是 failed，finish_visual 因此仍然拦住它。
  const persisted = JSON.parse(await fs.readFile(path.join(outcome.runDir, "state.json"), "utf8"));
  assert.equal(persisted.artifactState.p1.status, "failed");
  assert.equal(persisted.artifactState.p1.feedback.issues[0].code, "build-failed");
});
