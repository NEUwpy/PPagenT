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

test("文字排版库让一个大区绑定排法而不是暴露固定小槽", () => {
  assert.deepEqual(listTextLayouts().map((item) => item.id), [
    "statement-flow",
    "heading-content-flow",
    "label-content-flow",
    "structured-list-flow",
    "metric-content-flow",
    "metric-set-flow",
    "key-value-flow",
    "quote-attribution-flow",
    "heading-metric-content-flow",
    "summary-information-flow",
  ]);
  assert.deepEqual(listTextLayoutPrimitives().map((item) => item.id), [
    "heading",
    "body",
    "list",
    "metric",
    "label",
    "annotation",
    "quote",
    "emphasis",
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
  assert.ok(listTextLayouts().every((layout) => (
    layout.minimumFrame.width === layout.recommendedFrame.width
    && layout.minimumFrame.height === layout.recommendedFrame.height
  )));
});
