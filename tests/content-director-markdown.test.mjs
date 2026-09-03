import assert from "node:assert/strict";
import test from "node:test";
import { compileContentDirectorDraft, parseContentDirectorMarkdown } from "../src/content/content-director-markdown.mjs";
import { buildDeterministicContentFallback } from "../src/content/deterministic-content-fallback.mjs";
import { computeContentStats } from "../src/content/page-content.mjs";

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

test("已选择来源中的数量层级不能被逐页 Markdown 泛化丢失", () => {
  const source = "方案重构为1+3+N矩阵，其中主链采用1+6+N路线，另外包含三类课堂和N个场景。";
  const base = {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "hierarchy-deck",
      title: "复合体系",
      communicationJob: "解释复合体系",
      audience: "项目团队",
      audienceOutcome: "理解体系构成",
      centralTakeaway: "复合结构共同支撑体系。",
      narrativeArc: ["解释体系"],
    },
    contentMarkdown: `# 复合体系\n\n> 多层结构共同形成完整体系。\n\n## 总体方案\n\n形成完整的复合矩阵。`,
    pageMetadata: [{
      logicIntent: { logicId: "hierarchy", reason: "存在多层数量结构", evidenceFragments: ["1+3+N"], confidence: "high" },
      sourceAnchors: [source],
    }],
  };
  assert.throws(
    () => compileContentDirectorDraft(source, base),
    (error) => error.code === "CONTENT_HIERARCHY_COVERAGE_FAILED"
      && error.details.missingStructuralTokens.includes("1+3+N")
      && error.details.missingStructuralTokens.includes("1+6+N"),
  );
  const complete = structuredClone(base);
  complete.contentMarkdown = `# 复合体系\n\n> 1+3+N矩阵把主链、课堂与场景连成完整体系。\n\n## 1条主链\n\n采用1+6+N路线。\n\n## 3类课堂\n\n形成三类教学形态。\n\n## N个场景\n\n连接多种应用场景。`;
  assert.doesNotThrow(() => compileContentDirectorDraft(source, complete));

  const expandedNested = structuredClone(complete);
  expandedNested.contentMarkdown = expandedNested.contentMarkdown.replace(
    "采用1+6+N路线。",
    "路线包含1个校本基地、6处核心场馆和N个配套教学点。",
  );
  assert.doesNotThrow(() => compileContentDirectorDraft(source, expandedNested));

  const chineseExpanded = structuredClone(complete);
  chineseExpanded.contentMarkdown = `# 复合体系\n\n> 一条主链、三类课堂与N个场景形成完整体系。\n\n## 一条主链\n\n路线包含一个校本基地、六处核心场馆和N个配套教学点。\n\n## 三类课堂\n\n形成三类教学形态。\n\n## N个场景\n\n连接多种应用场景。`;
  assert.doesNotThrow(() => compileContentDirectorDraft(source, chineseExpanded));
});

test("共享背景来源段落中的公式不强制复制到只引用另一段证据的页面", () => {
  const source = "总体采用1+3+N矩阵，并按1+6+N设计路线。\n\n任务单包含拍视频、解难题、带课题三项任务。";
  const value = {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "shared-context", title: "任务单", communicationJob: "说明任务",
      audience: "团队", audienceOutcome: "理解任务", centralTakeaway: "任务单推动实践", narrativeArc: ["实践"],
    },
    contentMarkdown: "# 任务单\n\n> 说明任务单的三项任务。\n\n## 拍视频\n\n记录历史。\n\n## 解难题\n\n服务场馆。\n\n## 带课题\n\n研究振兴。",
    pageMetadata: [{
      logicIntent: {
        logicId: "parallel", reason: "三项任务并列",
        evidenceFragments: ["任务单包含拍视频、解难题、带课题三项任务。"], confidence: "high",
      },
      sourceBlockIds: ["source-001", "source-002"],
    }],
  };
  assert.doesNotThrow(() => compileContentDirectorDraft(source, value));
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

test("内容导演可为 H2 节点登记独立 Logic，并保留来源证据", () => {
  const value = draft();
  value.pageMetadata[1].itemMetadata = [
    {
      logicIntent: {
        logicId: "sequence",
        reason: "该节点说明先整理再执行的顺序",
        evidenceFragments: ["先整理再执行"],
        confidence: "high",
      },
    },
    {},
  ];
  const output = compileContentDirectorDraft(rawMarkdown, value);
  assert.equal(output.pageContents[1].items[0].logicIntent.logicId, "sequence");
  assert.deepEqual(output.pageContents[1].items[0].logicIntent.evidenceFragments, ["先整理再执行"]);
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

test("普通 Logic 名不能冒充 structuredData.type，修复模式只丢弃可选关系", () => {
  const value = draft();
  value.pageMetadata[1].relationBindings = {
    type: "parallel",
    literals: [],
    references: [],
  };
  assert.throws(
    () => compileContentDirectorDraft(rawMarkdown, value),
    (error) => error.code === "CONTENT_RELATION_COMPILE_FAILED",
  );

  const repaired = compileContentDirectorDraft(rawMarkdown, value, { repairMode: true });
  assert.equal(repaired.pageContents[1].structuredData, undefined);
  assert.equal(repaired.pageContents[1].logicIntent.logicId, "sequence");
  assert.ok(repaired.contentRepairReport.actions.some(
    (action) => action.type === "drop-invalid-optional-relation-bindings" && action.pageId === "page-02",
  ));
});

test("修复模式局部移除 H2 Logic 的非逐字证据，不降级整份内容稿", () => {
  const value = draft();
  value.pageMetadata[1].itemMetadata = [
    {
      logicIntent: {
        logicId: "sequence",
        reason: "该节点说明执行顺序",
        evidenceFragments: ["先整理……再执行"],
        confidence: "high",
      },
    },
    {},
  ];
  const repaired = compileContentDirectorDraft(rawMarkdown, value, { repairMode: true });
  assert.equal(repaired.pageContents.length, 2);
  assert.equal(repaired.pageContents[1].items[0].logicIntent, undefined);
  assert.ok(repaired.contentRepairReport.actions.some(
    (action) => action.type === "drop-unverifiable-optional-item-logic" && action.pageId === "page-02",
  ));
});

test("修复模式删除空证据的可选 H2 Logic，保留对应正文", () => {
  const value = draft();
  value.pageMetadata[1].itemMetadata = [
    { logicIntent: { logicId: "sequence", reason: "尝试补充局部逻辑", evidenceFragments: [], confidence: "low" } },
    {},
  ];
  const repaired = compileContentDirectorDraft(rawMarkdown, value, { repairMode: true });
  assert.equal(repaired.pageContents[1].items[0].logicIntent, undefined);
  assert.equal(repaired.pageContents[1].items[0].body, "先把输入梳理清楚。");
  assert.ok(repaired.contentRepairReport.actions.some((action) => (
    action.type === "drop-unverifiable-optional-item-logic" && action.itemId === "page-02-item-1"
  )));
});

test("问题方案 Logic 缺少必需机器关系时按节点极性局部降级", () => {
  const value = draft();
  value.pageMetadata[0].itemMetadata = [{ polarity: "negative" }];
  const repaired = compileContentDirectorDraft(rawMarkdown, value, { repairMode: true });
  assert.equal(repaired.pageContents.length, 2);
  assert.equal(repaired.pageContents[0].logicIntent.logicId, "parallel");
  assert.equal(repaired.contentMetadata.pageMetadata[0].logicIntent.logicId, "parallel");
  assert.equal(repaired.contentRepairReport.actions[0].type, "downgrade-unbound-required-logic");

  const twoSided = draft();
  twoSided.contentMarkdown = twoSided.contentMarkdown.replace(
    "# 当前问题\n\n> 让听众理解旧流程的真实代价。\n\n## 重复劳动",
    "# 当前问题\n\n> 让听众理解旧流程的真实代价。\n\n## 重复劳动",
  ).replace(
    "# 新方法",
    "## 改进方向\n\n减少重复。\n\n# 新方法",
  );
  twoSided.pageMetadata[0].itemMetadata = [
    { polarity: "negative" },
    { polarity: "positive" },
  ];
  const comparison = compileContentDirectorDraft(rawMarkdown, twoSided, { repairMode: true });
  assert.equal(comparison.pageContents[0].logicIntent.logicId, "comparison");
});

test("修复模式把超过 Schema 上限的有效 Logic 证据局部收口到三条", () => {
  const value = draft();
  value.pageMetadata[1].logicIntent.evidenceFragments = [
    "第二项说明",
    "新方法",
    "先整理",
    "再执行",
  ];
  const repaired = compileContentDirectorDraft(rawMarkdown, value, { repairMode: true });
  assert.deepEqual(repaired.pageContents[1].logicIntent.evidenceFragments, [
    "第二项说明",
    "新方法",
    "先整理",
  ]);
  assert.ok(repaired.contentRepairReport.actions.some(
    (action) => action.type === "canonicalize-logic-evidence" && action.pageId === "page-02",
  ));
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

test("一页可以引用全部必要来源段落且不会卷入未选择的中间段落", () => {
  const source = [
    "第一项事实。",
    "无关过渡甲。",
    "第二项事实。",
    "无关过渡乙。",
    "第三项事实。",
    "无关过渡丙。",
    "第四项事实。",
    "无关过渡丁。",
    "第五项事实。",
  ].join("\n\n");
  const value = {
    schemaVersion: "0.1",
    deckMetadata: {
      deckId: "multi-source", title: "标题", communicationJob: "汇总事实", audience: "团队",
      audienceOutcome: "理解五项事实", centralTakeaway: "五项事实共同成立", narrativeArc: ["汇总"],
    },
    contentMarkdown: "# 五项事实\n\n> 汇总分散证据\n\n## 事实\n第一、第二、第三、第四、第五项事实。",
    pageMetadata: [{
      sourceBlockIds: ["source-001", "source-003", "source-005", "source-007", "source-009"],
      logicIntent: {
        logicId: "parallel",
        reason: "五项事实同级",
        evidenceFragments: ["第一项事实。", "第五项事实。"],
        confidence: "high",
      },
    }],
  };
  const output = compileContentDirectorDraft(source, value);
  assert.equal(output.pageContents[0].sourceText, [
    "第一项事实。", "第二项事实。", "第三项事实。", "第四项事实。", "第五项事实。",
  ].join("\n\n"));
  assert.doesNotMatch(output.pageContents[0].sourceText, /无关过渡/);
  assert.equal(output.deckPlan.pages[0].sourceAnchors.length, 5);
});

test("确定性内容兜底按原稿切页且不补造事实", () => {
  const source = `# 主题\n\n${"第一项内容。".repeat(90)}\n\n第二部分说明。`;
  const output = buildDeterministicContentFallback(source, { reason: "test" });
  assert.ok(output.pageContents.length >= 3);
  assert.ok(output.pageContents.every((page) => page.logicIntent.logicId === "editorial"));
  assert.ok(output.pageContents.every((page) => source.includes(page.sourceText)));
  assert.ok(output.pageContents.every((page) => {
    const stats = computeContentStats(page);
    return stats.itemCount <= 13
      && stats.avgItemChars * stats.itemCount <= 240
      && stats.maxItemChars <= 80;
  }));
  assert.equal(output.contentRepairReport.status, "deterministic-fallback");
});
