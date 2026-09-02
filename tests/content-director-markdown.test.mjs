import assert from "node:assert/strict";
import test from "node:test";
import { compileContentDirectorDraft, parseContentDirectorMarkdown } from "../src/content/content-director-markdown.mjs";
import { buildDeterministicContentFallback } from "../src/content/deterministic-content-fallback.mjs";

const rawMarkdown = `# 原稿

开场提出为什么现在需要改变。

第一项说明当前流程重复且缓慢。

第二项说明新方法先整理再执行。

结尾强调从今天开始行动。`;

function draft(overrides = {}) {
  return {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "demo-deck",
      title: "改变从现在开始",
      communicationJob: "说明改变的必要性与执行方式",
      audience: "项目团队",
      audienceOutcome: "理解问题并开始行动",
      centralTakeaway: "先看清问题，再用新方法开始行动。",
      narrativeArc: ["看清问题", "开始行动"],
    },
    contentMarkdown: `# 当前问题

> 让听众理解旧流程的真实代价。

## 重复劳动

当前流程存在重复工作。

### 直接影响

- 处理缓慢
- 容易遗漏

# 新方法

> 说明先整理、再执行的行动顺序。

## 先整理

先把输入梳理清楚。

## 再执行

再按确定步骤执行。

- 从今天开始行动`,
    pageMetadata: [
      {
        logicIntent: {
          logicId: "problem-solution",
          reason: "原稿先说明重复缓慢的问题",
          evidenceFragments: ["当前流程重复且缓慢"],
          confidence: "high",
        },
        sourceAnchors: ["开场提出", "第一项说明当前流程重复且缓慢"],
      },
      {
        logicIntent: {
          logicId: "sequence",
          reason: "原稿明确先整理再执行",
          evidenceFragments: ["先整理再执行"],
          confidence: "high",
        },
        sourceAnchors: ["第二项说明新方法先整理再执行", "从今天开始行动"],
      },
    ],
    ...overrides,
  };
}

test("受控 Markdown 以 H1 定义页面并用 H2/H3 和列表表达页内层级", () => {
  const parsed = parseContentDirectorMarkdown(draft().contentMarkdown);
  assert.deepEqual(parsed.pages.map((page) => page.title), ["当前问题", "新方法"]);
  assert.equal(parsed.pages[0].itemBlocks.length, 1);
  assert.equal(parsed.pages[1].itemBlocks.length, 2);
});

test("Markdown 草稿确定性编译为现有 DeckPlan 与 PageContent", () => {
  const output = compileContentDirectorDraft(rawMarkdown, draft());
  assert.equal(output.deckPlan.title, "改变从现在开始");
  assert.deepEqual(output.deckPlan.narrativeArc, ["看清问题", "开始行动"]);
  assert.deepEqual(output.deckPlan.pages.map((page) => page.pageId), ["page-01", "page-02"]);
  assert.equal(output.pageContents[0].items[0].id, "page-01-item-1");
  assert.match(output.pageContents[0].items[0].body, /直接影响/);
  assert.deepEqual(output.pageContents[0].items[0].points, ["处理缓慢", "容易遗漏"]);
  assert.equal(output.pageContents[1].items[1].body, "再按确定步骤执行。");
  assert.ok(rawMarkdown.includes(output.pageContents[0].sourceText));
  assert.ok(output.pageContents[1].sourceText.includes("从今天开始行动"));
});

test("pageMetadata 必须与 H1 页面逐项对齐", () => {
  assert.throws(
    () => compileContentDirectorDraft(rawMarkdown, draft({ pageMetadata: draft().pageMetadata.slice(0, 1) })),
    (error) => error.code === "CONTENT_METADATA_MISMATCH",
  );
});

test("标题跳级、空页面和缺少页面职责明确失败", () => {
  for (const contentMarkdown of [
    "## 缺少页面\n\n正文",
    "# 空页面\n\n> 职责",
    "# 页面\n\n## 节点\n\n正文",
    "# 页面\n\n> 职责\n\n## 节点\n\n#### 过深\n\n正文",
  ]) {
    assert.throws(
      () => parseContentDirectorMarkdown(contentMarkdown),
      (error) => error.code === "CONTENT_MARKDOWN_INVALID",
    );
  }
});

test("来源锚点作为独立证据，允许后页回看和覆盖前页来源", () => {
  const value = draft();
  value.pageMetadata[1].sourceAnchors = ["开场提出", "从今天开始行动"];
  const output = compileContentDirectorDraft(rawMarkdown, value);
  assert.match(output.pageContents[1].sourceText, /开场提出/);
  assert.match(output.pageContents[1].sourceText, /从今天开始行动/);
});

test("来源锚点在剩余原稿中重复时失败而不是猜第一次出现", () => {
  const repeatedSource = `${rawMarkdown}\n\n结尾再次写下：开场提出。`;
  assert.throws(
    () => compileContentDirectorDraft(repeatedSource, draft()),
    (error) => error.code === "CONTENT_METADATA_MISMATCH",
  );
});

test("复杂关系只通过 Markdown 引用生成 structuredData", () => {
  const withBindings = draft();
  withBindings.pageMetadata[1].relationBindings = {
    type: "problem-method-result",
    literals: [
      { path: "/methodIds/0", value: "page-02-item-1" },
      { path: "/methodIds/1", value: "page-02-item-2" },
    ],
    references: [
      { path: "/problem/title", ref: "page.title" },
      { path: "/problem/body", ref: "item:1.body" },
      { path: "/result/title", ref: "item:2.title" },
      { path: "/result/body", ref: "item:2.body" },
    ],
  };
  const output = compileContentDirectorDraft(rawMarkdown, withBindings);
  assert.deepEqual(output.pageContents[1].structuredData, {
    type: "problem-method-result",
    methodIds: ["page-02-item-1", "page-02-item-2"],
    problem: { title: "新方法", body: "先把输入梳理清楚。" },
    result: { title: "再执行", body: "再按确定步骤执行。" },
  });
});

test("H2 节点的强调与极性由同序轻量元数据补充，不复制正文", () => {
  const value = draft();
  value.pageMetadata[1].itemMetadata = [
    { emphasis: true, polarity: "positive" },
    { emphasis: false, polarity: "neutral" },
  ];
  const output = compileContentDirectorDraft(rawMarkdown, value);
  assert.equal(output.pageContents[1].items[0].emphasis, true);
  assert.equal(output.pageContents[1].items[0].polarity, "positive");
  assert.equal(output.pageContents[1].items[1].emphasis, false);
  assert.equal(output.pageContents[1].items[1].polarity, "neutral");
});

test("itemMetadata 数量必须与本页 H2 数量一致", () => {
  const value = draft();
  value.pageMetadata[1].itemMetadata = [{ emphasis: true }];
  assert.throws(
    () => compileContentDirectorDraft(rawMarkdown, value),
    (error) => error.code === "CONTENT_METADATA_MISMATCH",
  );
});

test("relationBindings 的正文必须引用 Markdown，不能在元数据重复填写", () => {
  const invalid = draft();
  invalid.pageMetadata[0].relationBindings = {
    type: "problem-solution",
    literals: [{ path: "/outcome/title", value: "重复正文" }],
    references: [],
  };
  assert.throws(
    () => compileContentDirectorDraft(rawMarkdown, invalid),
    (error) => error.code === "CONTENT_RELATION_COMPILE_FAILED",
  );
});

test("relationBindings 不能覆盖 type 或写入原型链", () => {
  for (const reference of [
    { path: "/type", ref: "page.title" },
    { path: "/__proto__/polluted", ref: "item:1.title" },
  ]) {
    const invalid = draft();
    invalid.pageMetadata[0].relationBindings = {
      type: "problem-solution",
      literals: [],
      references: [reference],
    };
    assert.throws(
      () => compileContentDirectorDraft(rawMarkdown, invalid),
      (error) => error.code === "CONTENT_RELATION_COMPILE_FAILED",
    );
  }
  assert.equal(Object.prototype.polluted, undefined);
});

test("邻接矩阵是允许的机器常量且只能包含 0 或 1", () => {
  const value = draft();
  value.pageMetadata[1].relationBindings = {
    type: "hierarchy",
    literals: [{ path: "/adjacency", value: [[[1, 0], [0, 1]]] }],
    references: [
      { path: "/layers/0/0/label", ref: "item:1.title" },
      { path: "/layers/1/0/label", ref: "item:2.title" },
    ],
  };
  const output = compileContentDirectorDraft(rawMarkdown, value);
  assert.deepEqual(output.pageContents[1].structuredData.adjacency, [[[1, 0], [0, 1]]]);

  value.pageMetadata[1].relationBindings.literals[0].value = [[[2]]];
  assert.throws(
    () => compileContentDirectorDraft(rawMarkdown, value),
    (error) => error.code === "CONTENT_RELATION_COMPILE_FAILED",
  );
});

test("显式第 X 页仍然是不可拆分的硬边界", () => {
  const explicitSource = "第1页：开场\n\n开场原文。\n\n第2页：结论\n\n结论原文。";
  const value = draft();
  assert.throws(
    () => compileContentDirectorDraft(explicitSource, value),
    (error) => error.code === "CONTENT_METADATA_MISMATCH",
  );
});

test("不同页面可以引用同一来源段落中的不同证据", () => {
  const sameParagraph = "# 原稿\n\n开头信息，中间信息，结尾信息。";
  const value = draft();
  value.pageMetadata[0].sourceAnchors = ["开头信息", "中间信息"];
  value.pageMetadata[0].logicIntent.evidenceFragments = ["开头信息"];
  value.pageMetadata[1].sourceAnchors = ["结尾信息"];
  value.pageMetadata[1].logicIntent.evidenceFragments = ["结尾信息"];
  const output = compileContentDirectorDraft(sameParagraph, value);
  assert.equal(output.pageContents.length, 2);
  assert.match(output.pageContents[0].sourceText, /开头信息/);
  assert.match(output.pageContents[1].sourceText, /结尾信息/);
});

test("两页使用完全相同的来源证据范围时明确失败", () => {
  const value = draft();
  value.pageMetadata[1].sourceAnchors = [...value.pageMetadata[0].sourceAnchors];
  assert.throws(
    () => compileContentDirectorDraft(rawMarkdown, value),
    (error) => error.code === "CONTENT_METADATA_MISMATCH",
  );
});

test("原稿段落 ID 让程序生成逐字证据并本地收口无效可选关系", () => {
  const source = "标题\n\n信仰更强——\n\n发展对象答辩现场，留辽意愿从58%升至87%。";
  const value = {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "grounded", title: "标题", communicationJob: "说明变化", audience: "师生",
      audienceOutcome: "理解成效", centralTakeaway: "信仰更强", narrativeArc: ["成效"],
    },
    contentMarkdown: "# 红色先锋\n\n> 呈现成效\n\n## 信仰\n留辽意愿提升\n\n## 行动\n扎根辽宁",
    pageMetadata: [{
      sourceBlockIds: ["source-002", "source-003"],
      logicIntent: {
        logicId: "progression",
        reason: "从信仰到行动",
        evidenceFragments: ["信仰更强——发展对象答辩现场"],
        confidence: "high",
      },
      relationBindings: {
        type: "progression",
        literals: [],
        references: [{ path: "/items/1", ref: "item:1.title" }],
      },
    }],
  };
  const output = compileContentDirectorDraft(source, value, { repairMode: true });
  assert.equal(output.pageContents[0].sourceText, "信仰更强——\n\n发展对象答辩现场，留辽意愿从58%升至87%。");
  assert.deepEqual(output.deckPlan.pages[0].sourceAnchors, ["信仰更强——", "发展对象答辩现场，留辽意愿从58%升至87%。"]);
  assert.equal(output.pageContents[0].structuredData, undefined);
  assert.equal(output.contentRepairReport.actions.length, 2);
  assert.ok(output.pageContents[0].logicIntent.evidenceFragments.every((fragment) => (
    output.pageContents[0].sourceText.includes(fragment)
  )));
});

test("确定性内容兜底按原稿切页且不补造事实", () => {
  const source = `# 主题\n\n${"第一项内容。".repeat(90)}\n\n第二部分说明。`;
  const output = buildDeterministicContentFallback(source, { reason: "test" });
  assert.ok(output.pageContents.length >= 3);
  assert.ok(output.pageContents.every((page) => page.logicIntent.logicId === "editorial"));
  assert.ok(output.pageContents.every((page) => source.includes(page.sourceText)));
  assert.equal(output.contentRepairReport.status, "deterministic-fallback");
});
