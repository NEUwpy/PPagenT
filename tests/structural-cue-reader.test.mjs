import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceSectionPageContract,
  enforceStructuralIntentRelations,
} from "../src/agent/model-director-provider.mjs";
import {
  applyStructuralHints,
  assertStructuralCueCompliance,
  buildStructuralCueGuides,
  detectStructuralCues,
  readStructuralCues,
} from "../src/agent/structural-cue-reader.mjs";

const source = `# 示例

## 判断成本

需要判断：怎么讲，拆几页，每页讲什么，观点什么关系，哪里突出，何时用图，何时一句话。

## 三步分工

> **AI 负责理解。** 读取材料。
> **规则负责决定。** 判断边界。
> **代码负责执行。** 稳定生成。
> **直接说法。** 调用已经做好的东西。

## 普通场景

使用场景很普通：明早汇报，晚上交稿，希望结构清楚，视觉规范，而且可以修改。

## 单一主张

背景说明。

> **固定意味着已经验证。**

## 服务人群

少数人可以自己做好。

但更多的人有内容，却不擅长表达。

## 两种方案

稳定方案比随机方案更适合工作。

## 能力积累

先做出页面。提炼其中规律，才能从作品变成能力。
`;

test("高置信结构线索保留判断簇、枚举、重复职责和转化链", () => {
  const cues = detectStructuralCues(source);
  assert.deepEqual(cues.map((cue) => [cue.type, cue.relation]), [
    ["decision-cluster", "hub"],
    ["role-sequence", "sequence"],
    ["parallel-enumeration", "parallel"],
    ["category-contrast", "parallel"],
    ["paired-contrast", "comparison"],
    ["sequence-transformation", "sequence"],
  ]);
  assert.deepEqual(cues.at(-1).anchorTitles, ["作品", "规律", "能力"]);
});

test("结构线索并行独立调用且保留程序确定的关系", async () => {
  const calls = [];
  const model = {
    identity: "fake-structure-reader",
    async generateJson(input) {
      calls.push(input.context.cues.map((cue) => cue.cueId));
      return { hints: input.context.cues.map((cue) => ({
        cueId: cue.cueId,
        atoms: Array.from({ length: cue.itemRange.minItems }, (_, index) => ({
          title: `节点${index + 1}`,
          body: `第${index + 1}项内容`,
          sourceFragments: [`片段${index + 1}`],
          ...(cue.cueId.endsWith("comparison")
            ? { points: ["依据一", "依据二", "依据三"] }
            : {}),
        })),
      })) };
    },
  };
  const hints = await readStructuralCues(source, model);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 5);
  assert.deepEqual(hints.map((hint) => hint.relation), [
    "hub", "sequence", "parallel", "parallel", "comparison", "sequence",
  ]);
  assert.deepEqual(hints.map((hint) => hint.atoms.length), [4, 3, 4, 2, 2, 3]);
});

test("转场对照与独立行动不会被压成正文或误判为流程", () => {
  const cues = detectStructuralCues(`# 示例

## 时空切换

从1937年的血火记忆切换到今天的和平生活。

## 三项行动

首先要守护真相；其次要珍惜和平；最后要开创未来。

## 共同目的

为了守护真相、珍惜和平、开创未来，我们必须行动。
`);
  assert.deepEqual(cues.map((cue) => [cue.type, cue.relation, cue.explicitItemCount]), [
    ["paired-contrast", "comparison", undefined],
    ["ordinal-parallel-actions", "parallel", 3],
    ["parallel-action-list", "parallel", 3],
  ]);
});

test("产品叙事的十节正文均能提取结构技能线索且不把结论误当单节点页", async () => {
  const fs = await import("node:fs/promises");
  const markdown = await fs.readFile(new URL("../docs/产品叙事.md", import.meta.url), "utf8");
  const cues = detectStructuralCues(markdown);
  assert.equal(cues.length, 10);
  assert.deepEqual(cues.map((cue) => cue.relation), [
    "hub", "progression", "comparison", "parallel", "sequence", "layered", "sequence", "hub", "sequence", "parallel",
  ]);
  assert.deepEqual(cues[5].fixedAtoms.map((atom) => atom.points.length), [4, 2, 4]);
  assert.ok(cues.every((cue) => cue.type !== "single-thesis"));
});

test("关闭辅助结构模型时，本地结构指南仍阻止明确 Logic 退化为纯文字", () => {
  const markdown = "## 三项能力\n\n核心能力包括：理解稿件，选择结构，稳定生成。";
  const guides = buildStructuralCueGuides(markdown);
  assert.equal(guides[0].relation, "parallel");
  assert.throws(() => assertStructuralCueCompliance({ pageContents: [{
    pageId: "p1",
    title: "三项能力",
    logicIntent: { logicId: "editorial", reason: "概括" },
    items: [{ id: "i1", title: "能力", body: "总括" }],
    sourceText: markdown,
  }] }, guides), (error) => error.code === "CONTENT_LOGIC_MISMATCH");
});

test("同一句中的三个职责按三个节点计数而不是按一行计数", () => {
  const [guide] = buildStructuralCueGuides("## 分工\n\nAI 负责理解，规则负责选择，代码负责生成。");
  assert.equal(guide.type, "role-sequence");
  assert.deepEqual(guide.itemRange, { minItems: 3, maxItems: 3 });
  assert.equal(guide.fixedAtoms.length, 3);
});

test("辅助结构线索连续超出容量时退回内容导演而不阻断整稿", async () => {
  let calls = 0;
  const model = {
    async generateJson(input) {
      calls += 1;
      return { hints: input.context.cues.map((cue) => ({
        cueId: cue.cueId,
        atoms: [1, 2, 3].map((index) => ({
          title: `节点${index}`,
          body: "这是一段明显超过结构读取器容量上限但语义仍可能正确的说明文字",
          sourceFragments: ["来源片段"],
        })),
      })) };
    },
  };
  const hints = await readStructuralCues("## 转化\n\n提炼规律，才能从作品变成能力。", model);
  assert.equal(calls, 2);
  assert.deepEqual(hints, []);
});

test("高置信结构原子确定性替换对应页面并携带关系标记", () => {
  const output = applyStructuralHints({
    deckPlan: { pages: [{ pageId: "p1" }] },
    pageContents: [{
      schemaVersion: "1.0",
      pageId: "p1",
      title: "判断成本",
      items: [{ id: "old", title: "总括", body: "被压缩" }],
      sourceText: "## 判断成本\n\n需要判断很多事。",
    }],
  }, [{
    sectionHeading: "判断成本",
    relation: "parallel",
    atoms: [
      { title: "讲法", body: "确定怎么讲" },
      { title: "拆页", body: "确定拆几页" },
    ],
  }]);
  assert.deepEqual(output.pageContents[0].items.map((item) => item.title), ["讲法", "拆页"]);
  assert.match(output.pageContents[0].notes, /PPagenT主关系=parallel/);
});

test("转化主节点和节点内分点保持两级结构", () => {
  const output = applyStructuralHints({
    deckPlan: { pages: [{ pageId: "p1" }] },
    pageContents: [{
      schemaVersion: "1.0",
      pageId: "p1",
      title: "能力积累",
      items: [],
      sourceText: "## 能力积累\n\n从作品变成能力。",
    }],
  }, [{
    sectionHeading: "能力积累",
    type: "sequence-transformation",
    relation: "sequence",
    atoms: [
      { title: "作品", body: "先形成漂亮页面" },
      { title: "规律", body: "提炼页面规律", points: ["表达", "容量", "变化", "禁忌"] },
      { title: "能力", body: "适配更多内容" },
    ],
  }]);
  assert.deepEqual(output.pageContents[0].items.map((item) => item.title), ["作品", "规律", "能力"]);
  assert.deepEqual(output.pageContents[0].items[1].points, ["表达", "容量", "变化", "禁忌"]);
  assert.match(output.pageContents[0].notes, /PPagenT节点接口=semantic-node\+points/);
});

test("明确冒号枚举优先保留为同级对象而不被后文结论压缩", () => {
  const [cue] = detectStructuralCues(`## 积累能力

真正积累的是经验：表达，容量，变化，禁忌。

规律被提炼后，才能从作品变成能力。`);
  assert.equal(cue.type, "parallel-enumeration");
});

test("长案例段中的从小盆景变成大风景不会覆盖整节为转化骨架", () => {
  const cues = detectStructuralCues(`## 五类实践抓手

一张任务单解决现场难题。一座基地提供沉浸党课。一支宣讲团走进社区。

一张红色朋友圈与多家单位联建，组织互联、资源互通、经验互鉴，推动共享循环，真正让六地精神从校园小盆景变成区域大风景，同时保留每个抓手各自的职责与成果。`);
  assert.ok(cues.every((cue) => cue.type !== "sequence-transformation"));
});

test("多段案例中的局部分号枚举不会覆盖整节实践抓手", () => {
  const cues = detectStructuralCues(`## 五类实践抓手

一张任务单解决难题（写誓言；写方案；写答卷）。

一座基地提供沉浸党课。

一支宣讲团走进社区。`);
  assert.ok(cues.every((cue) => cue.type !== "parallel-enumeration"));
});

test("整句末尾的必须不会把前面的并列地名误判成行动清单", () => {
  const cues = detectStructuralCues(`## 五类实践抓手

累计26项微课题被沈阳、鞍山、抚顺等地“揭榜挂帅”，青年党员读懂振兴辽宁是我们可以也必须扛起的时代订单。`);
  assert.ok(cues.every((cue) => cue.type !== "parallel-action-list"));
});

test("内容导演漏掉二级章节时由对应结构线索补回而不是静默缩页", () => {
  const markdown = "# 标题\n\n## 第一节\n\n第一节正文。\n\n## 第二节\n\n第二节正文。";
  const output = enforceSectionPageContract({
    deckPlan: {
      schemaVersion: "1.0",
      deckId: "deck",
      title: "标题",
      communicationJob: "说明",
      audience: "听众",
      audienceOutcome: "理解",
      centralTakeaway: "结论",
      narrativeArc: ["第一节", "第二节"],
      pages: [{ pageId: "p1", sequence: 1, narrativeJob: "解释第一节", sourceAnchors: ["## 第一节"] }],
    },
    pageContents: [{
      schemaVersion: "1.0",
      pageId: "p1",
      title: "第一节",
      items: [{ id: "p1-i1", title: "要点", body: "正文" }],
      sourceText: "## 第一节\n\n第一节正文。",
    }],
  }, markdown, [{
    sectionHeading: "第二节",
    relation: "parallel",
    atoms: [
      { title: "节点一", body: "第一项" },
      { title: "节点二", body: "第二项" },
    ],
  }]);
  assert.deepEqual(output.pageContents.map((page) => page.title), ["第一节", "第二节"]);
  assert.equal(output.deckPlan.pages.length, 2);
  assert.equal(output.pageContents[1].sourceText, "## 第二节\n\n第二节正文。");
});

test("没有结构线索可补回的遗漏章节返回可重试错误", () => {
  const markdown = "# 标题\n\n## 第一节\n\n第一节正文。\n\n## 第二节\n\n第二节正文。";
  assert.throws(() => enforceSectionPageContract({
    deckPlan: {
      schemaVersion: "1.0", deckId: "deck", title: "标题", communicationJob: "说明",
      audience: "听众", audienceOutcome: "理解", centralTakeaway: "结论", narrativeArc: ["第一节"],
      pages: [{ pageId: "p1", sequence: 1, narrativeJob: "解释第一节", sourceAnchors: ["## 第一节"] }],
    },
    pageContents: [{
      schemaVersion: "1.0", pageId: "p1", title: "第一节",
      items: [{ id: "p1-i1", title: "要点", body: "正文" }],
      sourceText: "## 第一节\n\n第一节正文。",
    }],
  }, markdown), (error) => error.code === "SECTION_COVERAGE_FAILED" && error.details.sectionHeading === "第二节");
});

test("程序确认的主关系覆盖视觉模型的关系误判", () => {
  const output = enforceStructuralIntentRelations({
    pageIntents: [{
      intentId: "i1",
      baseRelation: "comparison",
      purposeKey: "compare_audience_segments",
      relationTraits: { temporal: true },
      structure: { ordered: true },
    }],
  }, [{ notes: "PPagenT主关系=parallel" }]);
  assert.equal(output.pageIntents[0].baseRelation, "parallel");
  assert.equal(output.pageIntents[0].purposeKey, "present_parallel_points");
  assert.equal(output.pageIntents[0].relationTraits.temporal, false);
});

test("没有时间证据的程序顺序关系不会被视觉模型升级为时间轴", () => {
  const output = enforceStructuralIntentRelations({
    pageIntents: [{
      intentId: "i1",
      baseRelation: "sequence",
      purposeKey: "explain_process",
      relationTraits: { temporal: true },
      structure: { ordered: true },
    }],
  }, [{ notes: "PPagenT主关系=sequence", sourceText: "AI负责理解，规则负责决定，代码负责执行。" }]);
  assert.equal(output.pageIntents[0].relationTraits.temporal, false);
});

test("矩阵结构数据确定双维关系与矩阵用途", () => {
  const output = enforceStructuralIntentRelations({
    pageIntents: [{
      intentId: "matrix-intent",
      baseRelation: "parallel",
      purposeKey: "present_parallel_points",
      relationTraits: { dimensions: 1 },
      structure: { ordered: true, sameLevel: false },
    }],
  }, [{ structuredData: { type: "matrix" } }]);
  assert.equal(output.pageIntents[0].baseRelation, "matrix");
  assert.equal(output.pageIntents[0].purposeKey, "organize_matrix");
  assert.equal(output.pageIntents[0].relationTraits.dimensions, 2);
  assert.equal(output.pageIntents[0].structure.ordered, false);
  assert.equal(output.pageIntents[0].structure.sameLevel, true);
});
