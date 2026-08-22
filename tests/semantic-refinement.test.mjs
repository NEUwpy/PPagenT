import assert from "node:assert/strict";
import test from "node:test";
import {
  applySemanticRefinements,
  normalizeSemanticRefinementRequests,
} from "../src/agent/semantic-refinement.mjs";

const page = {
  pageId: "p1",
  sourceText: "核心规律包括表达、容量与变化。",
  items: [{ id: "rule", title: "规律", body: "提炼可复用规律" }],
};
const candidate = {
  familyId: "sequential-process",
  variantId: "horizontal-cards",
  contentContract: { itemRole: "semantic-node", points: "optional" },
  textCapacity: { maxPointsPerItem: 4, maxPointChars: 8 },
};

test("局部细化只接受候选支持且尚未带 points 的目标节点", () => {
  const requests = normalizeSemanticRefinementRequests([{
    pageId: "p1",
    familyId: "sequential-process",
    variantId: "horizontal-cards",
    itemIds: ["rule", "missing"],
    reason: "原文存在节点内枚举",
  }], [page], [{ pageId: "p1", candidates: [candidate] }]);
  assert.deepEqual(requests[0].itemIds, ["rule"]);
  assert.equal(requests[0].maxPointsPerItem, 4);
  assert.equal(requests[0].maxPointChars, 8);
});

test("局部细化丢弃没有原文依据或超过候选字数的分点", () => {
  const requests = [{
    pageId: "p1",
    itemIds: ["rule"],
    maxPointsPerItem: 4,
    maxPointChars: 8,
  }];
  const result = applySemanticRefinements([page], requests, {
    refinements: [{
      pageId: "p1",
      items: [{
        itemId: "rule",
        points: [
          { text: "表达", sourceFragment: "表达" },
          { text: "这是一个明显超过容量的长分点", sourceFragment: "容量" },
          { text: "编造内容", sourceFragment: "不存在" },
        ],
      }],
    }],
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.pageContents[0].items[0].points, ["表达"]);
});

test("需要 points 的结构组可从内容合同读取数量和字数上限", () => {
  const requiredCandidate = {
    familyId: "comparison",
    variantId: "weighted-dual-focus",
    contentContract: {
      points: "required",
      pointCount: { min: 3, max: 5, balancedAcrossItems: true },
    },
    textCapacity: { maxItemChars: 16 },
  };
  const comparisonPage = {
    pageId: "p2",
    sourceText: "稳定方案与随机方案有三项明确差别。",
    items: [
      { id: "stable", title: "稳定方案", body: "稳定" },
      { id: "random", title: "随机方案", body: "随机", points: ["已有一点"] },
    ],
  };
  const [request] = normalizeSemanticRefinementRequests([{
    pageId: "p2",
    familyId: requiredCandidate.familyId,
    variantId: requiredCandidate.variantId,
    itemIds: ["stable", "random"],
    reason: "补齐对应维度",
  }], [comparisonPage], [{ pageId: "p2", candidates: [requiredCandidate] }]);
  assert.deepEqual(request.itemIds, ["stable", "random"]);
  assert.equal(request.maxPointsPerItem, 5);
  assert.equal(request.maxPointChars, 16);
});
