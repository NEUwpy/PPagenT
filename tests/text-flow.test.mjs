import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateTextFlowPlanningCapacity,
  resolveTextFlowContent,
  textFlowMarkup,
  textRegionAttributes,
} from "../src/visual-runtime/text-flow.mjs";
import {
  compatibleTextLayouts,
  listTextLayouts,
  listTextLayoutPrimitives,
  textRegionMarkup,
} from "../src/visual-runtime/text-layout-library.mjs";
import {
  markdownTextRegionMarkup,
  parseControlledMarkdown,
} from "../src/visual-runtime/markdown-text.mjs";
import {
  matchTextLayoutsForPayload,
  summarizeTextRegionContract,
} from "../src/visual-runtime/typography-matcher.mjs";
import { loadCoreAssetPackage } from "../src/runtime/core-asset-packages.mjs";

test("TextFlow 从字段有无自动选择标题正文组合", () => {
  assert.deepEqual(resolveTextFlowContent({ title: "标题", body: "正文", points: ["分点"] }), {
    title: "标题",
    body: "正文\n• 分点",
    composition: "title-body",
  });
  assert.equal(resolveTextFlowContent({ title: "仅标题" }).composition, "title-only");
  assert.equal(resolveTextFlowContent({ body: "仅正文" }).composition, "body-only");
  assert.equal(resolveTextFlowContent({}).composition, "empty");
});

test("TextFlow 从容器几何派生保守规划容量", () => {
  const capacity = estimateTextFlowPlanningCapacity({
    width: 211.5,
    height: 218,
    gapPx: 14,
    separatorHeightPx: 4,
  });
  assert.deepEqual(capacity.titleBody, {
    maxTitleChars: 18,
    maxTitleLines: 2,
    maxBodyChars: 40,
    maxBodyLines: 4,
  });
  assert.equal(capacity.basis, "conservative-cjk-geometry");
});

test("TextFlow 只声明一个内容槽且不手写字数上限", () => {
  const markup = textFlowMarkup({
    id: "item-a-content",
    field: "items[0]",
    itemId: "item-a",
    title: "标题",
    body: "正文",
    separator: true,
  });
  assert.equal((markup.match(/data-slot-id=/g) ?? []).length, 1);
  assert.match(markup, /data-slot-role="item-content"/);
  assert.match(markup, /data-slot-content-type="text-flow"/);
  assert.match(markup, /data-text-flow-composition="title-body"/);
  assert.doesNotMatch(markup, /data-slot-max-(chars|lines)/);
});

test("必填 TextFlow 拒绝完全空内容", () => {
  assert.throws(() => textFlowMarkup({ id: "empty", field: "items[0]" }), /至少需要标题或正文/);
  assert.doesNotThrow(() => textFlowMarkup({
    id: "optional-empty",
    field: "items[0]",
    required: false,
  }));
});

test("TextRegion 披露连续复合文字大区而不规定内部块数量", () => {
  const attributes = textRegionAttributes({
    id: "quadrant-detail-region",
    field: "quadrants[0].detail",
    itemId: "quadrant-0-detail",
    regionId: "detail",
  });
  assert.match(attributes, /data-slot-role="text-region"/);
  assert.match(attributes, /data-slot-content-type="text-region"/);
  assert.match(attributes, /data-slot-region-id="detail"/);
  assert.match(attributes, /data-slot-safe-box="true"/);
  assert.doesNotMatch(attributes, /max-chars|max-lines/);
});

test("PPA 文字库只暴露 Markdown 流式与区域模板两种渲染模式", () => {
  assert.deepEqual(listTextLayouts().map((item) => item.id), [
    "markdown-flow",
    "markdown-zoned",
  ]);
  assert.deepEqual(listTextLayoutPrimitives().map((item) => item.id), [
    "heading",
    "paragraph",
    "unordered-list",
    "ordered-list",
    "quote",
    "emphasis",
    "divider",
  ]);
  const markup = textRegionMarkup({
    id: "metric-1",
    field: "metrics[0]",
    layoutId: "value-label-stacked",
    content: { value: "≥95%", label: "结构化通过率" },
  });
  assert.equal((markup.match(/data-slot-id=/g) ?? []).length, 1);
  assert.match(markup, /data-slot-content-type="text-region"/);
  assert.match(markup, /data-text-layout-id="metric-content-flow"/);
  assert.match(markup, /data-text-layout-part="metric"/);
  assert.match(markup, /data-text-layout-part="label"/);
  assert.doesNotMatch(markup, /metric-value[^\n]*data-slot-id|metric-label[^\n]*data-slot-id/);
  assert.deepEqual(compatibleTextLayouts({
    width: 132,
    height: 71,
    contentRoles: ["value", "label"],
  }), []);
  assert.ok(compatibleTextLayouts({
    width: 240,
    height: 130,
    contentRoles: ["heading", "body"],
  }).includes("heading-content-flow"));
  assert.equal(compatibleTextLayouts({
    width: 320,
    height: 190,
    contentRoles: ["heading", "body"],
  }).includes("metric-content-flow"), false);
  assert.ok(listTextLayouts().every((layout) => (
    layout.minimumFrame.width === layout.recommendedFrame.width
    && layout.minimumFrame.height === layout.recommendedFrame.height
    && layout.visualStyle === "markdown-skin"
    && layout.visualReviewStatus === "awaiting-user-review"
  )));
});

test("受控 Markdown 用成熟语法生成一个 TextRegion，并允许区域模板重排同一 Token", () => {
  const markdown = "## 可靠生成\n\n把稿件转化为稳定页面。\n\n- 内容与样式分离\n- 统一读取 Skin\n\n> 复杂关系仍交给 Structure。";
  assert.deepEqual(parseControlledMarkdown(markdown).map((block) => block.type), [
    "heading",
    "paragraph",
    "unordered-list",
    "quote",
  ]);
  const flow = markdownTextRegionMarkup({ id: "md-flow", field: "blocks[0].markdown", markdown });
  assert.equal((flow.match(/data-slot-id=/g) ?? []).length, 1);
  assert.match(flow, /data-text-layout-id="markdown-flow"/);
  assert.match(flow, /data-markdown-renderer="controlled-commonmark"/);
  assert.match(flow, /data-text-primitive="heading"/);
  assert.match(flow, /data-text-primitive="list"/);
  const zoned = markdownTextRegionMarkup({ id: "md-zoned", field: "blocks[0].markdown", markdown, mode: "zoned" });
  assert.match(zoned, /data-text-layout-id="markdown-zoned"/);
  assert.match(zoned, /data-markdown-zone="lead"/);
  assert.match(zoned, /data-markdown-zone="body"/);
});

test("受控 Markdown 拒绝图片和多层列表，不把自由网页带入文字系统", () => {
  assert.throws(() => parseControlledMarkdown("![图](https://example.com/image.png)"), /不支持图片/);
  assert.throws(() => parseControlledMarkdown("[链接](https://example.com)"), /不支持链接/);
  assert.throws(() => parseControlledMarkdown("`代码`"), /不支持行内代码/);
  assert.throws(() => parseControlledMarkdown("<b>原始 HTML</b>"), /不支持原始 HTML/);
  assert.throws(() => parseControlledMarkdown("| A | B |\n| - | - |\n| 1 | 2 |"), /不支持表格/);
  assert.throws(() => parseControlledMarkdown("#### 四级标题"), /最多三级/);
  assert.throws(() => parseControlledMarkdown("- 一级\n  - 二级"), /最多一层/);
});

test("Typography Matcher 只在已登记候选中按内容角色展开 Region 绑定", () => {
  const slotContract = {
    variants: [{
      id: "v1",
      slots: [{
        id: "item-1-content",
        field: "items[0]",
        contentType: "text-region",
        required: true,
        frame: { width: 280, height: 160 },
        textLayout: {
          id: "heading-content-flow",
          defaultId: "heading-content-flow",
          compatible: ["heading-content-flow", "metric-content-flow"],
          contentRoles: ["heading", "body"],
        },
      }],
    }],
  };
  assert.deepEqual(summarizeTextRegionContract(slotContract), [{
    regionKey: "items[]",
    contentRoles: ["body", "heading"],
    defaultLayoutId: "heading-content-flow",
    compatibleLayoutIds: ["heading-content-flow"],
    frameRange: { minWidth: 280, maxWidth: 280, minHeight: 160, maxHeight: 160 },
  }]);
  const matched = matchTextLayoutsForPayload({
    slotContract,
    parameters: { items: [{ title: "标题", body: "正文" }] },
    choices: [{ regionKey: "items[]", layoutId: "metric-content-flow" }],
  });
  assert.deepEqual(matched.bindings, { "item-1-content": "heading-content-flow" });
  assert.equal(matched.warnings[0].code, "text-layout-choice-normalized");
});

test("正式核心资产从 RenderPayload 确定性生成 TextRegion 绑定", async () => {
  const assetPackage = await loadCoreAssetPackage("goal-alignment-strategy-metrics-001");
  const content = {
    pageId: "goal-page",
    title: "建立稳定生成体系",
    items: [
      { id: "content", title: "内容结构化", body: "把原稿转换为稳定字段。", points: [] },
      { id: "visual", title: "视觉资产化", body: "选择已确认的结构与排版。", points: [] },
      { id: "delivery", title: "交付确定化", body: "由代码生成可编辑文件。", points: [] },
    ],
    structuredData: {
      type: "goal-strategy-metrics",
      goal: { title: "建立稳定生成体系", body: "AI 做理解和选择，代码做约束和执行。" },
      strategies: [
        { id: "content", metrics: [{ label: "字段通过率", value: "≥95%" }] },
        { id: "visual", metrics: [{ label: "核心资产覆盖", value: "≥80%" }] },
        { id: "delivery", metrics: [{ label: "对象可编辑率", value: "100%" }] },
      ],
    },
  };
  const payload = assetPackage.mapper(
    content,
    { intentId: "goal-intent" },
    {},
    { componentItemIds: content.items.map((item) => item.id) },
  );
  const matched = matchTextLayoutsForPayload({
    slotContract: assetPackage.generatedSlotContract,
    parameters: payload.parameters,
  });
  assert.deepEqual(matched.bindings, {
    "goal-content": "heading-content-flow",
    "strategy-1-content": "heading-content-flow",
    "strategy-2-content": "heading-content-flow",
    "strategy-3-content": "heading-content-flow",
    "strategy-1-metric-1": "metric-content-flow",
    "strategy-2-metric-1": "metric-content-flow",
    "strategy-3-metric-1": "metric-content-flow",
  });
  assert.deepEqual(matched.warnings, []);
});
