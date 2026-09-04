import assert from "node:assert/strict";
import test from "node:test";
import { auditDeckRhythm, summarizeRhythmPages } from "../src/agent/deck-rhythm.mjs";

test("rhythmPlan 汇总锚点、安静页、连续组与转折", () => {
  const rhythm = summarizeRhythmPages([
    { pageId: "p1", pageRole: "problem", densityTarget: "quiet", visualWeight: "quiet", compositionFamily: "statement" },
    { pageId: "p2", pageRole: "evidence", densityTarget: "balanced", visualWeight: "anchor", compositionFamily: "diagram", continuityGroup: "evidence-run" },
    { pageId: "p3", pageRole: "summary", densityTarget: "quiet", visualWeight: "peak", compositionFamily: "statement", continuityGroup: "evidence-run", contrastBreakBefore: true },
  ]);
  assert.deepEqual(rhythm.anchorPageIds, ["p2", "p3"]);
  assert.deepEqual(rhythm.quietPageIds, ["p1"]);
  assert.deepEqual(rhythm.continuityGroups, [{ groupId: "evidence-run", pageIds: ["p2", "p3"] }]);
  assert.deepEqual(rhythm.contrastBreaks, ["p3"]);
});

test("整套节奏审计识别三连同构、家族垄断、密度平坦和卡片化", () => {
  const pages = Array.from({ length: 5 }, (_, index) => ({
    pageId: `p${index + 1}`,
    pageRole: "explanation",
    densityTarget: "balanced",
    visualWeight: "normal",
    compositionFamily: "cards",
  }));
  const candidateSets = pages.map((page) => ({
    pageId: page.pageId,
    candidates: [{
      compositions: [
        { id: "editorial-list", requiresComponent: false },
        { id: "editorial-single-focus", requiresComponent: false },
      ],
    }],
  }));
  const audit = auditDeckRhythm({
    visualPlan: { pages },
    candidateSets,
    pageContents: pages.map((page) => ({ pageId: page.pageId })),
    pageIntents: pages.map(() => ({ baseRelation: "none" })),
  });
  const codes = new Set(audit.warnings.map((warning) => warning.code));
  assert.equal(audit.status, "warning");
  assert.ok(codes.has("composition-family-three-in-row"));
  assert.ok(codes.has("composition-family-dominance"));
  assert.ok(codes.has("density-rhythm-flat"));
  assert.ok(codes.has("visual-anchor-missing"));
  assert.ok(codes.has("boxed-layout-dominance"));
});
