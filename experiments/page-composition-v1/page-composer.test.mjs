import assert from "node:assert/strict";
import test from "node:test";
import { composeStructureWithAside } from "./page-composer.mjs";

const bodyFrame = { left: 55, top: 166, width: 1170, height: 492 };
const pageBrief = {
  pageId: "page-01",
  pageJob: "说明从内容规划到原生输出的三步链路",
  structure: { skillId: "sequence-flow-001", sourceItemIds: ["step-1", "step-2", "step-3"] },
  aside: { sourceItemIds: ["takeaway"] },
};

test("uses the component natural footprint and leaves one real text region", () => {
  const result = composeStructureWithAside({
    pageBrief,
    bodyFrame,
    structureFootprint: { width: 930, height: 382 },
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.readingOrder, ["structure", "aside"]);
  assert.equal(result.regions[0].frame.width, 930);
  assert.equal(result.regions[1].frame.width, 216);
  assert.equal(result.regions[0].sourceContentIds.length, 3);
  assert.deepEqual(result.textSlots[0].sourceItemIds, ["takeaway"]);
});

test("rejects a full-frame asset instead of compressing the text region", () => {
  const result = composeStructureWithAside({
    pageBrief,
    bodyFrame,
    structureFootprint: { width: 1060, height: 382 },
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "structure-footprint-leaves-no-usable-aside");
});
