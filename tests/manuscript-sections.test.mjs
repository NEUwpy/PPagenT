import assert from "node:assert/strict";
import test from "node:test";
import { contentSchemaWithSectionFloor, enforceSectionPageContract } from "../src/agent/model-director-provider.mjs";
import { applyAcademicReportShellScaffold } from "../src/agent/shell-scaffold.mjs";
import { buildStructuralCueGuides, readStructuralCues } from "../src/agent/structural-cue-reader.mjs";
import { extractManuscriptSections } from "../src/content/manuscript-sections.mjs";

function minimalContentSchema() {
  return {
    name: "content",
    schema: {
      type: "object",
      properties: {
        deckPlan: { properties: { pages: { type: "array", items: {} } } },
        pageContents: {
          type: "array",
          items: {
            required: [],
            properties: {
              logicIntent: { properties: { logicId: {} } },
            },
          },
        },
      },
    },
  };
}

test("显式页标记兼容 H3、普通行、跳号和重复语义标题", () => {
  const markdown = `# 演讲稿

### 第1页：封面

封面内容。

### 第3页：同名页

正文甲。

第6页：同名页

正文乙。`;
  const sections = extractManuscriptSections(markdown);
  assert.equal(sections.length, 3);
  assert.deepEqual(sections.map((section) => section.pageNumber), ["1", "3", "6"]);
  assert.equal(new Set(sections.map((section) => section.sectionKey)).size, 3);
  assert.equal(sections[0].shellRole, "cover");
});

test("单个完整行页标记也能形成一个页面单元", () => {
  const sections = extractManuscriptSections("第1页：单页说明\n\n正文中见第3页。");
  assert.equal(sections.length, 1);
  assert.equal(sections[0].semanticTitle, "单页说明");
});

test("显式页标记优先且代码围栏与正文页码不切页", () => {
  const markdown = `### 第1页：封面

见第3页，不是边界。

## 页内标题

\`\`\`md
### 第4页：代码示例
\`\`\`

### 第5页：正文

正文。`;
  const sections = extractManuscriptSections(markdown);
  assert.equal(sections.length, 2);
  assert.deepEqual(sections.map((section) => section.pageNumber), ["1", "5"]);
  assert.match(sections[0].body, /页内标题/);
});

test("没有页标记时只使用最浅 Markdown 正文标题", () => {
  const nested = extractManuscriptSections("# 标题\n\n## A\n\n### A1\n\n正文\n\n## B\n\n正文");
  assert.deepEqual(nested.map((section) => section.heading), ["A", "B"]);
  const h3Only = extractManuscriptSections("# 标题\n\n### A\n\n正文\n\n### B\n\n正文");
  assert.deepEqual(h3Only.map((section) => section.heading), ["A", "B"]);
});

test("页数 schema、结构线索与覆盖契约共用同一显式分段", () => {
  const markdown = `### 第1页：封面

封面。

### 第3页：三个步骤

第一步准备；第二步执行；第三步复盘。

第6页：结束语

谢谢。`;
  const schema = contentSchemaWithSectionFloor(minimalContentSchema(), markdown, [{ logicId: "sequence" }]);
  assert.equal(schema.schema.properties.pageContents.minItems, 3);
  assert.equal(schema.schema.properties.pageContents.maxItems, 3);
  assert.equal(schema.schema.properties.pageContents.items.properties.sourceText, undefined);
  const [guide] = buildStructuralCueGuides(markdown);
  assert.equal(guide.sectionHeading, "第3页：三个步骤");
  assert.equal(guide.relation, "sequence");

  const output = enforceSectionPageContract({
    deckPlan: {
      title: "演讲稿",
      narrativeArc: ["步骤"],
      pages: [
        { pageId: "p1", sequence: 1, narrativeJob: "封面", sourceAnchors: ["### 第1页：封面"] },
        { pageId: "p2", sequence: 2, narrativeJob: "步骤", sourceAnchors: ["模型改写后无法定位的摘要"] },
        { pageId: "p3", sequence: 3, narrativeJob: "结束", sourceAnchors: ["第6页：结束语"] },
      ],
    },
    pageContents: [
      { pageId: "p1", title: "封面", items: [], sourceText: "### 第1页：封面\n\n封面。" },
      { pageId: "p2", title: "第3页：三个步骤", items: [] },
      { pageId: "p3", title: "结束语", items: [], sourceText: "第6页：结束语\n\n谢谢。" },
    ],
  }, markdown);
  assert.equal(output.pageContents.length, 3);
  assert.equal(output.pageContents[0].title, "封面");
  assert.equal(output.pageContents[1].title, "三个步骤");
  assert.match(output.pageContents[1].sourceText, /第一步准备/);
  assert.deepEqual(output.deckPlan.pages[1].sourceAnchors, ["### 第3页：三个步骤"]);
  assert.equal(output.pageContents[2].title, "结束语");
  assert.match(output.pageContents[0].notes, /PPagenTShellRole=cover/);
  assert.match(output.pageContents[2].notes, /PPagenTShellRole=closing/);
  assert.equal(output.deckPlan.pages[1].narrativeJob, "步骤");
});

test("重复 Markdown 标题依靠正文归属到不同 sectionKey", () => {
  const markdown = `## 同名

第一段只讲甲方案。

## 同名

第二段只讲乙方案。`;
  const output = enforceSectionPageContract({
    deckPlan: {
      title: "重复标题",
      narrativeArc: ["甲", "乙"],
      pages: [
        { pageId: "p1", sequence: 1, sourceAnchors: ["## 同名"] },
        { pageId: "p2", sequence: 2, sourceAnchors: ["## 同名"] },
      ],
    },
    pageContents: [
      { pageId: "p1", title: "同名", items: [], sourceText: "第一段只讲甲方案。" },
      { pageId: "p2", title: "同名", items: [], sourceText: "第二段只讲乙方案。" },
    ],
  }, markdown);
  const keys = output.pageContents.map((page) => page.notes.match(/PPagenT来源章节=([^；]+)/)?.[1]);
  assert.equal(new Set(keys).size, 2);
  assert.match(output.pageContents[0].sourceText, /甲方案/);
  assert.match(output.pageContents[1].sourceText, /乙方案/);
});

test("显式封面和结束语映射为 Shell 后不会重复", () => {
  const result = applyAcademicReportShellScaffold({
    deckPlan: {
      title: "演讲稿",
      centralTakeaway: "铭记历史",
      narrativeArc: ["正文"],
      pages: [
        { pageId: "source-cover", sequence: 1, sourceAnchors: ["第1页：封面"] },
        { pageId: "body", sequence: 2, sourceAnchors: ["第2页：正文"] },
        { pageId: "source-closing", sequence: 3, sourceAnchors: ["第3页：结束语"] },
      ],
    },
    pageContents: [
      { pageId: "source-cover", notes: "PPagenTShellRole=cover", sourceText: "第1页：封面", items: [] },
      { pageId: "body", title: "正文", items: [] },
      { pageId: "source-closing", notes: "PPagenTShellRole=closing", sourceText: "第3页：结束语", items: [] },
    ],
  });
  assert.deepEqual(result.pageContents.map((page) => page.pageId), ["shell-cover", "shell-agenda", "body", "shell-closing"]);
  assert.equal(result.pageContents.filter((page) => page.pageId === "shell-cover").length, 1);
  assert.equal(result.pageContents.filter((page) => page.pageId === "shell-closing").length, 1);
});

test("通用关系线索只强制高置信顺序、递进与成对对照", () => {
  const markdown = `## 顺序

第一次接力保存证据；第二次接力传播历史；第三次接力守护记忆。

## 递进

他们最初只是恐惧求生，后来逐渐觉醒并开始反抗，最终成长为真相守护者。

## 对照

在和平年代，底片记录生活；而在战争年代，底片守护真相。

## 非对照

这项能力比较重要，也与之前相比有所改善。

## 普通叙述

首先介绍背景，随后补充一个例子。`;
  const guides = buildStructuralCueGuides(markdown);
  assert.deepEqual(guides.map((guide) => guide.relation), ["sequence", "progression", "comparison"]);
});

test("追问不单列节点且重复然后不冒充完整顺序", () => {
  const guides = buildStructuralCueGuides(`## 问题

哪个人物最触动你？为什么？如果身处当时你会怎么做？今天你能做什么？

## 不完整顺序

首先介绍背景，然后举例，然后总结观点。`);
  assert.equal(guides.length, 1);
  assert.equal(guides[0].type, "question-cluster");
  assert.deepEqual(guides[0].itemRange, { minItems: 3, maxItems: 3 });
});

test("问题簇读取任务明确把短追问并入前一问题", async () => {
  let cueTask = "";
  await readStructuralCues(`## 问题

哪个人物最触动你？为什么？如果身处当时你会怎么做？今天你能做什么？`, {
    identity: "fake-question-reader",
    async generateJson(input) {
      cueTask = input.context.cues[0].task;
      return { hints: [{
        cueId: input.context.cues[0].cueId,
        atoms: [
          { title: "触动人物", body: "选择最触动的人物", sourceFragments: ["哪个人物最触动你？为什么？"] },
          { title: "情境行动", body: "设想身处当时", sourceFragments: ["如果身处当时你会怎么做？"] },
          { title: "当下行动", body: "说明今天能做什么", sourceFragments: ["今天你能做什么？"] },
        ],
      }] };
    },
  });
  assert.match(cueTask, /短追问并入前一个问题/);
  assert.doesNotMatch(cueTask, /每个问号对应一个 atom/);
});
