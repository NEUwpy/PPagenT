// 运行器纯核测试：无网络、无浏览器、无 Native、无 PPTX。
// 用例逐条对应 experiments/penguin-harness-v2/grid-project.test.mjs 里已验证过的那几条机制，
// 加上运行器新拥有的两件事（工具派发、多轮循环）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  newRunState, upsertPageBriefs, validateContent, replacePageBriefs, freezeContent,
  upsertComposition, artifactReusable, recordArtifact, recordRuntimeFailure, looksLikeRuntimeFailure,
  requestContentRevision, finishVisual, renderStateMarkdown, renderContentMarkdown,
  writeState, setDeckBrief, MAX_COMPOSITION_REVISIONS, recordDeckAudit, splitSources,
} from "../src/runner/state.mjs";
import { defineTool, createToolRegistry } from "../src/runner/tools/index.mjs";
import { runToolLoop, transcriptSummary } from "../src/runner/loop.mjs";
import { createCommitter } from "../src/runner/tools/generation.mjs";

const MANUSCRIPT = "# 标题\n\n来源甲\n\n来源乙\n\n来源丙";
// 工具事件日志的落点。按仓库既有惯例放系统临时目录，不往工作区里写。
const RUN_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-runner-core-"));

function seeded(pages = 3) {
  let state = newRunState(MANUSCRIPT, "test.md");
  state = { ...state, deckBrief: { title: "试稿", audience: "评审", objective: "说明流程" } };
  state = upsertPageBriefs(state, Array.from({ length: pages }, (_, index) => ({
    pageId: `p${index + 1}`,
    title: `页${index + 1}`,
    claim: `主张${index + 1}`,
    relation: "none",
    items: [{ id: `i${index + 1}`, sourceIds: [`s${index + 1}`] }],
  })));
  return state;
}

// 曾经的实现按「空行分块」切，块首是 `#` 就把整块当标题吞掉——`# 标题\n正文` 这种写法
// （标题与正文之间没有空行）是合法 Markdown，正文会**静默消失**，来源凭空少一条，
// 而且 validateContent 只会说"来源未覆盖"，看不出是解析把正文吃了。
test("标题行只作分组：与正文同块的标题也不得吞掉正文", () => {
  const parsed = splitSources("# 标题\n这是不能丢的正文。\n\n第二段。");
  assert.deepEqual(parsed, [
    { id: "s1", heading: "标题", text: "这是不能丢的正文。" },
    { id: "s2", heading: "标题", text: "第二段。" },
  ]);

  // 连续标题、标题在段中、多级标题都不吞正文。
  assert.deepEqual(splitSources("## 甲\n### 乙\n正文一\n\n正文二").map((source) => source.text), ["正文一", "正文二"]);
  assert.deepEqual(splitSources("## 甲\n### 乙\n正文一").map((source) => source.heading), ["乙"]);
  // 正文行自己带 `#`（如「#1 优先级」）不能被当成标题行——只有行首 `#`+空白才算标题。
  assert.deepEqual(splitSources("#1 优先级说明").map((source) => source.text), ["#1 优先级说明"]);
});

// 最强的验证：拿一份**已经跑过**的真原稿当夹具。它的每个标题行都独占一块，
// 因此新旧两种切法必须给出逐字段完全相同的结果——否则就是把历史运行的数据改了。
test("按行解析与历史运行记录逐字段一致，来源 ID 与顺序契约不变", async () => {
  const runDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "harness", "runs", "20260912-r1-thin-runner");
  const raw = await fs.readFile(path.join(runDir, "原稿.md"), "utf8");
  const recorded = JSON.parse(await fs.readFile(path.join(runDir, "state.json"), "utf8"));
  assert.equal(recorded.sources.length, 12);
  assert.deepEqual(splitSources(raw), recorded.sources);
});

test("来源漏项阻断冻结；重写同页简报使该页产物失效且不动其他页", () => {
  let state = newRunState(MANUSCRIPT, "test.md");
  state = { ...state, deckBrief: { title: "试稿" } };
  state = upsertPageBriefs(state, [{ pageId: "p1", title: "页1", claim: "主张1", relation: "none", items: [{ id: "i1", sourceIds: ["s1"] }] }]);
  assert.equal(validateContent(state).accepted, false);
  assert.deepEqual(validateContent(state).issues.find((issue) => issue.code === "missing-source-coverage").sourceIds, ["s2", "s3"]);

  state = upsertPageBriefs(state, [{ pageId: "p2", title: "页2", claim: "主张2", relation: "none", items: [{ id: "i2", sourceIds: ["s2"] }] }]);
  state = upsertPageBriefs(state, [{ pageId: "p3", title: "页3", claim: "主张3", relation: "none", items: [{ id: "i3", sourceIds: ["s3"] }] }]);
  assert.equal(validateContent(state).accepted, true);

  state = { ...state, artifactState: { p1: { status: "passed", revision: 1 }, p2: { status: "passed", revision: 1 } } };
  const rewritten = upsertPageBriefs(state, [{ pageId: "p1", title: "页1改", claim: "主张1", relation: "none", items: [{ id: "i1", sourceIds: ["s1"] }] }]);
  assert.equal(rewritten.artifactState.p1, undefined);
  assert.equal(rewritten.artifactState.p2.status, "passed");
  assert.equal(rewritten.pages.find((page) => page.pageId === "p1").revision, 2);
});

// 内容提炼原则：模型**可以**撰写条目正文（否则它只能全文照抄，编排无从谈起），
// 但写出来的东西必须过保真检查。两条落点：sourceText 仍逐字并集（证据），item.text 是撰写稿。
test("条目正文可撰写，但过不了保真检查就被拒，且逐字来源证据仍在", () => {
  let state = newRunState("# 甲\n\n设备共 12 台，交接由管理员确认。", "test.md");
  state = { ...state, deckBrief: { title: "试稿" } };
  const page = (item) => [{ pageId: "p1", title: "页1", claim: "主张1", relation: "none", items: [{ id: "i1", sourceIds: ["s1"], ...item }] }];

  // 合规撰写：数字与引号都有据 → 通过，且 sourceText 逐字保留、未被撰写稿顶掉。
  const written = upsertPageBriefs(state, page({ text: "设备共 12 台，由管理员确认交接。" }));
  assert.equal(written.pages[0].items[0].text, "设备共 12 台，由管理员确认交接。");
  assert.equal(written.pages[0].items[0].sourceText, "设备共 12 台，交接由管理员确认。");

  // 编造数字：原稿里没有 30。
  assert.throws(() => upsertPageBriefs(state, page({ text: "设备共 30 台。" })), /保真|unbacked-number|30/);
  // 编造引号内容。
  assert.throws(() => upsertPageBriefs(state, page({ text: "原稿称之为「智能交接」。" })), /保真|unbacked-quote|智能交接/);
  // 不写 text 仍然合法：回退逐字来源。
  const verbatim = upsertPageBriefs(state, page({}));
  assert.equal(verbatim.pages[0].items[0].text, undefined);
  assert.equal(verbatim.pages[0].items[0].sourceText, "设备共 12 台，交接由管理员确认。");
  // 拒绝时必须原样返回，不半落地：上一次的 state 对象不受影响。
  assert.equal(state.pages.length, 0);
});

test("来源文本由程序按 sourceIds 回填，模型不能自报；未知来源被拒", () => {
  const state = seeded(1);
  const page = state.pages[0];
  assert.equal(page.items[0].sourceText, "来源甲");
  assert.throws(
    () => upsertPageBriefs(state, [{ pageId: "px", title: "x", claim: "x", relation: "none", items: [{ id: "ix", sourceIds: ["s99"] }] }]),
    /未知来源/,
  );
});

test("冻结后内容阶段关闭；来源未覆盖时冻结被拒且不推进阶段", () => {
  let state = newRunState(MANUSCRIPT, "test.md");
  state = { ...state, deckBrief: { title: "试稿" } };
  state = upsertPageBriefs(state, [{ pageId: "p1", title: "页1", claim: "主张1", relation: "none", items: [{ id: "i1", sourceIds: ["s1"] }] }]);
  const blocked = freezeContent(state);
  assert.equal(blocked.report.accepted, false);
  assert.equal(blocked.state.phase, "content");

  const ok = freezeContent(seeded());
  assert.equal(ok.report.accepted, true);
  assert.equal(ok.state.phase, "visual");
  assert.throws(() => upsertPageBriefs(ok.state, []), /content 阶段/);
});

test("定向内容重组守住来源集合与无关页产物", () => {
  const state = { ...seeded(), phase: "content-revision", contentRevision: { pageIds: ["p2", "p3"], reason: "两页内容可合并", applied: false } };
  const withArtifact = { ...state, artifactState: { p1: { status: "passed", revision: 1 } } };
  assert.throws(
    () => replacePageBriefs(withArtifact, ["p2", "p3"], [{ pageId: "merged", title: "合并", claim: "合并主张", relation: "none", items: [{ id: "i2", sourceIds: ["s2"] }] }]),
    /全部来源/,
  );
  const merged = replacePageBriefs(withArtifact, ["p2", "p3"], [{
    pageId: "merged", title: "合并", claim: "合并主张", relation: "none",
    items: [{ id: "i2", sourceIds: ["s2"] }, { id: "i3", sourceIds: ["s3"] }],
  }]);
  assert.deepEqual(merged.pages.map((page) => page.pageId), ["p1", "merged"]);
  assert.deepEqual(merged.artifactState.p1, withArtifact.artifactState.p1);
  assert.equal(merged.contentRevision.applied, true);
});

// 真实存在的死胡同：replacePageBriefs 完成修订后只置 applied:true、不把 phase 拨回 content，
// 而 freezeContent 当时只认 content 阶段，于是 finish_content 必然抛错、被工具层吞成 {accepted:false}。
// 结果是运行一旦进入 content-revision 就再也出不来，只会耗尽轮次停在原地。
// 参照实现 experiments/penguin-harness-v2/run-grid.mjs:70 是把 content-revision 当作 content
// 阶段的第二趟来跑的，移植时丢了这一层。
test("定向修订完成后能从 content-revision 冻结回 visual，不再卡死", () => {
  const state = { ...seeded(), phase: "content-revision", contentRevision: { pageIds: ["p2", "p3"], reason: "两页内容可合并", applied: false } };
  const merged = replacePageBriefs(state, ["p2", "p3"], [{
    pageId: "merged", title: "合并", claim: "合并主张", relation: "none",
    items: [{ id: "i2", sourceIds: ["s2"] }, { id: "i3", sourceIds: ["s3"] }],
  }]);

  assert.equal(merged.contentRevision.applied, true);
  // 修订阶段不拨回 content：拨回去就等于放开了 upsertPageBriefs，
  // 模型可以绕过 replacePageBriefs 的来源集合守恒校验。守恒必须仍然守住。
  assert.equal(merged.phase, "content-revision");
  assert.throws(
    () => upsertPageBriefs(merged, [{ pageId: "p1", title: "偷改", claim: "偷改", relation: "none", items: [{ id: "i1", sourceIds: ["s1"] }] }]),
    /content 阶段/,
  );

  const frozen = freezeContent(merged);
  assert.equal(frozen.report.accepted, true);
  assert.equal(frozen.state.phase, "visual");
});

test("内容修订预算只有一次，且只能指向已知页面", () => {
  const visual = { ...seeded(), phase: "visual" };
  const requested = requestContentRevision(visual, { pageIds: ["p1"], reason: "该页内容不足以支撑主张" });
  assert.equal(requested.state.phase, "content-revision");
  assert.throws(() => requestContentRevision(requested.state, { pageIds: ["p1"], reason: "再来一次再来一次" }), /visual 阶段/);
  assert.throws(() => requestContentRevision(visual, { pageIds: ["p9"], reason: "未知页面必须被拒" }), /未知页面/);
});

test("产物复用键是 (status, revision)：改版即失效，未通过不复用", () => {
  let state = { ...seeded(1), phase: "visual" };
  state = upsertComposition(state, "p1", { alignment: "left", regions: [] }, { accepted: true, issues: [] }).state;
  assert.equal(state.pages[0].compositionRevision, 1);
  assert.equal(artifactReusable(state, "p1").reusable, false);

  state = recordArtifact(state, "p1", { status: "passed", revision: 1, feedback: { accepted: true, issues: [] } });
  assert.equal(artifactReusable(state, "p1").reusable, true);

  state = recordArtifact(state, "p1", { status: "failed", revision: 1, feedback: { accepted: false, issues: [] } });
  assert.equal(artifactReusable(state, "p1").reusable, false);

  state = recordArtifact(state, "p1", { status: "passed", revision: 1, feedback: { accepted: true, issues: [] } });
  const revised = upsertComposition(state, "p1", { alignment: "center", regions: [] }, { accepted: true, issues: [] }).state;
  assert.equal(revised.pages[0].compositionRevision, 2);
  assert.equal(artifactReusable(revised, "p1").reusable, false);
});

test("单页方案版本有上限，防止无限重试掩盖问题", () => {
  let state = { ...seeded(1), phase: "visual" };
  for (let n = 1; n <= MAX_COMPOSITION_REVISIONS; n += 1) {
    state = upsertComposition(state, "p1", { alignment: "left", regions: [] }, { accepted: false, issues: [] }).state;
  }
  assert.equal(state.pages[0].compositionRevision, MAX_COMPOSITION_REVISIONS);
  assert.throws(() => upsertComposition(state, "p1", { alignment: "left", regions: [] }, { accepted: false, issues: [] }), /上限/);
});

test("收尾闸门要求全部页面当前版本通过，经验提示必须逐页解释", () => {
  let state = { ...seeded(1), phase: "visual" };
  state = upsertComposition(state, "p1", { alignment: "left", regions: [] }, { accepted: true, issues: [] }).state;
  assert.deepEqual(finishVisual(state).report.pending, ["p1"]);

  state = recordArtifact(state, "p1", { status: "passed", revision: 1, feedback: { accepted: true, issues: [], warnings: [{ code: "large-empty-area" }] } });
  const unexplained = finishVisual(state);
  assert.equal(unexplained.report.accepted, false);
  assert.deepEqual(unexplained.report.warningsNeedReason, ["p1"]);

  state = recordDeckAudit(state, { status: "passed", qaDir: "run/qa" });
  const done = finishVisual(state, [{ pageId: "p1", reason: "该页刻意留白以承载单个结论" }]);
  assert.equal(done.report.accepted, true);
  assert.equal(done.state.phase, "ready");
});

test("整套审计不通过时收尾闸门必须拒绝，缺审计记录同样拒绝", () => {
  const seededState = seeded(1);
  const base = recordArtifact(
    { ...seededState, phase: "visual", pages: [{ ...seededState.pages[0], compositionRevision: 1 }] },
    "p1",
    { status: "passed", revision: 1, feedback: { accepted: true, issues: [] } },
  );
  // 逐页全 passed 不等于整副牌组通过：封面违规不归任何正文页，只有整套结论能拦住它。
  const failedDeck = recordDeckAudit(base, { status: "failed", qaDir: "run/qa" });
  const rejected = finishVisual(failedDeck);
  assert.equal(rejected.report.accepted, false);
  assert.equal(rejected.report.deckAudit.status, "failed");
  assert.equal(failedDeck.phase, "visual");

  // 从未做过整套审计（没调过 check_pages）时必须失败关闭，不能默认放行。
  const missing = finishVisual(base);
  assert.equal(missing.report.accepted, false);
  assert.equal(missing.report.deckAudit, null);
});

test("方案一改，整套审计结论即作废", () => {
  let state = { ...seeded(1), phase: "visual" };
  state = upsertComposition(state, "p1", { alignment: "left", regions: [] }, { accepted: true, issues: [] }).state;
  state = recordArtifact(state, "p1", { status: "passed", revision: 1, feedback: { accepted: true, issues: [] } });
  state = recordDeckAudit(state, { status: "passed", qaDir: "run/qa" });
  assert.equal(finishVisual(state).report.accepted, true);

  state = upsertComposition(state, "p1", { alignment: "center", regions: [] }, { accepted: true, issues: [] }).state;
  assert.equal(state.deckAudit, undefined);
});

test("宿主依赖失败被单独记账并要求停止，不交给模型补偿", () => {
  const state = recordRuntimeFailure(seeded(1), { pageId: "p1", message: "未找到 Edge 可执行文件" });
  assert.equal(state.runtimeFailure.pageId, "p1");
  assert.match(state.runtimeFailure.recovery, /不要为了绕过依赖失败而修改页面内容/);
  assert.equal(looksLikeRuntimeFailure("未找到 Edge 可执行文件"), true);
  assert.equal(looksLikeRuntimeFailure("PPT 引擎不可用。未找到 @oai/artifact-tool"), true);
  assert.equal(looksLikeRuntimeFailure("text-does-not-fit"), false);
});

test("state.md 由 state.json 渲染，且明示不得直接编辑", () => {
  const state = recordRuntimeFailure(seeded(2), { pageId: "p1", message: "未找到 Chrome" });
  const markdown = renderStateMarkdown(state);
  assert.match(markdown, /本文件由运行器从 state.json 渲染，不要直接编辑/);
  assert.match(markdown, /宿主依赖失败/);
  assert.match(markdown, /p1/);
  assert.match(markdown, /来源覆盖/);
});

// 真实发生过：用 writeState（做 JSON.stringify）去写 Markdown，结果 state.md 变成
// 一个带引号、\n 转义的 JSON 字符串。这条测试锁住它不再回来。
test("提交口把 state.md / content.md 写成纯文本，state.json 仍是合法 JSON", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-runner-commit-"));
  const statePath = path.join(dir, "state.json");
  await writeState(statePath, seeded(1));
  const committer = createCommitter({ statePath });
  await committer.commit((state) => setDeckBrief(state, { title: "提交口测试", audience: "评审", objective: "验证写法" }));

  const stateMd = await fs.readFile(path.join(dir, "state.md"), "utf8");
  assert.ok(stateMd.startsWith("<!-- 本文件由运行器从 state.json 渲染"), `state.md 开头不对：${stateMd.slice(0, 40)}`);
  assert.doesNotMatch(stateMd, /\\n/, "state.md 里出现了转义换行，说明被当成 JSON 写了");
  assert.match(stateMd, /# 运行状态：提交口测试/);

  const contentMd = await fs.readFile(path.join(dir, "content.md"), "utf8");
  assert.ok(contentMd.startsWith("<!-- 本文件由运行器从 state.json 渲染"), "content.md 开头不对");
  assert.doesNotMatch(contentMd, /\\n/);
  assert.match(contentMd, /^## i1$/m, "内容块必须有稳定 ID");
  assert.match(contentMd, /<!-- 来源：s1 -->/);

  const persisted = JSON.parse(await fs.readFile(statePath, "utf8"));
  assert.equal(persisted.deckBrief.title, "提交口测试");
  assert.equal(persisted.phase, "content");
});

test("state.md 含运行记录约定要求的下一步与中断位置", () => {
  const content = renderStateMarkdown(seeded(1));
  assert.match(content, /- 下一步：继续按信息职责分页/);
  assert.doesNotMatch(content, /上次中断/);

  const visual = renderStateMarkdown({ ...seeded(1), phase: "visual" });
  assert.match(visual, /- 下一步：继续编排页面并用 check_pages/);

  const interrupted = renderStateMarkdown({ ...seeded(1), lastStop: { reason: "model-stalled", at: "2026-09-12T00:00:00.000Z" } });
  assert.match(interrupted, /- 上次中断：`model-stalled`/);
});

test("工具异常与非法入参都转成结构化结果，不抛穿循环", async () => {
  const registry = createToolRegistry({
    runDir: RUN_DIR,
    tools: [
      defineTool({ name: "boom", description: "总是抛错", inputSchema: { type: "object", properties: {} }, handler: () => { throw new Error("底层模块失败"); } }),
      defineTool({ name: "echo", description: "回显", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, handler: ({ text }) => ({ accepted: true, text }) }),
    ],
  });
  assert.deepEqual((await registry.dispatch("boom", {})).result, { accepted: false, error: "底层模块失败" });
  const invalid = await registry.dispatch("echo", { text: 42 });
  assert.equal(invalid.result.accepted, false);
  assert.match(invalid.result.error, /不符合 schema/);
  assert.equal((await registry.dispatch("nope", {})).result.accepted, false);
  assert.deepEqual((await registry.dispatch("echo", { text: "好" })).result, { accepted: true, text: "好" });
});

test("工具名重复与非法定义在注册时就报错", () => {
  const tool = defineTool({ name: "same", description: "x", inputSchema: { type: "object" }, handler: () => ({}) });
  assert.throws(() => createToolRegistry({ runDir: RUN_DIR, tools: [tool, tool] }), /重复/);
  assert.throws(() => defineTool({ name: "bad name", description: "x", inputSchema: { type: "object" }, handler: () => ({}) }), /工具名不合法/);
  assert.throws(() => defineTool({ name: "arr", description: "x", inputSchema: { type: "array" }, handler: () => ({}) }), /必须是 object/);
});

// —— 循环：用替身 provider 注入"模型那一轮说什么"，这测的是循环本身，不是模型。——

function fakeProvider(turns) {
  let index = 0;
  return {
    calls: [],
    async complete({ messages, tools }) {
      this.calls.push({ messageCount: messages.length, toolCount: tools.length });
      const turn = turns[Math.min(index, turns.length - 1)];
      index += 1;
      return { content: turn.content ?? null, toolCalls: turn.toolCalls ?? [], usage: { total_tokens: 10 }, finishReason: "stop", responseId: "r", model: "fake", attempts: 1 };
    },
  };
}

test("循环停止由工具写下的状态决定，而不是模型自述完成", async () => {
  const state = { phase: "content", log: [] };
  const registry = createToolRegistry({
    runDir: RUN_DIR,
    tools: [defineTool({
      name: "advance", description: "推进阶段", inputSchema: { type: "object", properties: {} },
      handler: () => { state.phase = "visual"; state.log.push("advanced"); return { accepted: true, phase: state.phase }; },
    })],
  });
  // 模型嘴上说做完了，但没有调用任何工具 —— 循环必须不认这句话。
  const provider = fakeProvider([
    { content: "我已经全部完成了。" },
    { toolCalls: [{ id: "c1", name: "advance", arguments: "{}" }] },
  ]);
  const result = await runToolLoop({
    provider, systemPrompt: "s", userMessage: "u", registry,
    shouldStop: async () => (state.phase === "visual" ? { reason: "phase-advanced" } : null),
  });
  assert.equal(result.stopReason, "phase-advanced");
  assert.deepEqual(state.log, ["advanced"]);
  assert.equal(result.turns[0].stalled, true);
  assert.equal(transcriptSummary(result).stalledTurns, 1);
});

test("模型始终不调工具时以 model-stalled 结束，且不谎报完成", async () => {
  const registry = createToolRegistry({
    runDir: RUN_DIR,
    tools: [defineTool({ name: "noop", description: "空操作", inputSchema: { type: "object", properties: {} }, handler: () => ({ accepted: true }) })],
  });
  const result = await runToolLoop({
    provider: fakeProvider([{ content: "完成了" }]),
    systemPrompt: "s", userMessage: "u", registry, maxStalls: 2,
    shouldStop: async () => null,
  });
  assert.equal(result.stopReason, "model-stalled");
  assert.match(result.note, /这不是完成，是失败/);
  assert.notEqual(result.stopReason, "ready");
});

test("绝不把模型自然语言当成阶段完成；轮次上限也是失败诊断", async () => {
  const registry = createToolRegistry({
    runDir: RUN_DIR,
    tools: [defineTool({ name: "noop", description: "空操作", inputSchema: { type: "object", properties: {} }, handler: () => ({ accepted: true }) })],
  });
  const result = await runToolLoop({
    provider: fakeProvider([{ content: null, toolCalls: [{ id: "c", name: "noop", arguments: "{}" }] }]),
    systemPrompt: "s", userMessage: "u", registry, maxTurns: 3,
    shouldStop: async () => null,
  });
  assert.equal(result.stopReason, "max-turns");
  assert.match(result.note, /未提交/);
});

test("工具参数不是合法 JSON 时回灌错误让模型自纠，循环不崩", async () => {
  const seen = [];
  const registry = createToolRegistry({
    runDir: RUN_DIR,
    tools: [defineTool({ name: "record", description: "记录", inputSchema: { type: "object", properties: { v: { type: "string" } } }, handler: (args) => { seen.push(args); return { accepted: true }; } })],
  });
  const result = await runToolLoop({
    provider: fakeProvider([
      { toolCalls: [{ id: "c1", name: "record", arguments: "{坏掉的 json" }] },
      { toolCalls: [{ id: "c2", name: "record", arguments: '{"v":"好了"}' }] },
    ]),
    systemPrompt: "s", userMessage: "u", registry,
    shouldStop: async () => (seen.length ? { reason: "recorded" } : null),
  });
  assert.equal(result.stopReason, "recorded");
  assert.deepEqual(seen, [{ v: "好了" }]);
  // 坏参数这次调用必须完整记进 transcript：既要标记未接受，也要留下可读原因。
  const badCall = result.turns[0].toolCalls[0];
  assert.equal(badCall.result.accepted, false);
  assert.match(badCall.result.error, /不是合法 JSON/);
  assert.equal(badCall.args, undefined);
});

test("循环把工具结果作为 tool 消息回灌，且带上 tool_call_id", async () => {
  const registry = createToolRegistry({
    runDir: RUN_DIR,
    tools: [defineTool({ name: "noop", description: "空操作", inputSchema: { type: "object", properties: {} }, handler: () => ({ accepted: true, mark: 7 }) })],
  });
  const result = await runToolLoop({
    provider: fakeProvider([{ toolCalls: [{ id: "call_abc", name: "noop", arguments: "{}" }] }]),
    systemPrompt: "s", userMessage: "u", registry,
    shouldStop: async () => ({ reason: "done" }),
  });
  const toolMessage = result.messages.find((message) => message.role === "tool");
  assert.equal(toolMessage.tool_call_id, "call_abc");
  assert.equal(JSON.parse(toolMessage.content).mark, 7);
  assert.equal(result.messages.find((message) => message.role === "assistant").tool_calls[0].function.name, "noop");
});
