import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createVisualDirectorCheckpoint,
  rebuildChangedVisualSelections,
  validateVisualDirectorOutput,
  withVisualDirectorCheckpoint,
} from "../src/workbench/visual-director-checkpoint.mjs";

function output(pageIds = ["p1", "p2"]) {
  return {
    visualPlan: { pages: pageIds.map((pageId) => ({ pageId, familyId: "family", variantId: "variant" })) },
    compositionPlan: { pages: pageIds.map((pageId) => ({ pageId, compositionId: "component-full" })) },
    semanticRefinementRequests: [],
  };
}

test("视觉导演表单调试暂停同一次调用，并以人工版本继续", async (context) => {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-visual-checkpoint-"));
  context.after(() => fs.rm(runDir, { recursive: true, force: true }));
  const states = [];
  const checkpoint = createVisualDirectorCheckpoint({
    runDir,
    onAwaiting: (state) => states.push(state.status),
    onResumed: (state) => states.push(state.status),
  });
  const provider = withVisualDirectorCheckpoint({
    metadata: { name: "fake" },
    async visualDirector() { return output(); },
  }, checkpoint);
  const pending = provider.visualDirector({ pageContents: [{ pageId: "p1" }, { pageId: "p2" }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(checkpoint.read().status, "awaiting-user");
  const edited = output();
  edited.visualPlan.pages[0].variantId = "edited";
  await checkpoint.submit(edited);
  assert.equal((await pending).visualPlan.pages[0].variantId, "edited");
  assert.deepEqual(states, ["awaiting-user", "accepted"]);
  const persisted = JSON.parse(await fs.readFile(checkpoint.checkpointPath, "utf8"));
  assert.equal(persisted.editedOutput.visualPlan.pages[0].variantId, "edited");
});

test("人工修改不能增删或重排视觉页面", () => {
  assert.throws(() => validateVisualDirectorOutput(output(["p2", "p1"]), ["p1", "p2"]), /不能增删页面或改变页面顺序/);
  const mismatched = output();
  mismatched.compositionPlan.pages.reverse();
  assert.throws(() => validateVisualDirectorOutput(mismatched, ["p1", "p2"]), /页面顺序不一致/);
});

test("更换合法 Structure 后由现有路由器重建配套 CompositionPlan", () => {
  const candidate = (suffix) => ({
    assetId: `asset-${suffix}`,
    structureGroupId: `group-${suffix}`,
    familyId: `family-${suffix}`,
    variantId: `variant-${suffix}`,
    silhouette: `shape-${suffix}`,
    adaptationStatus: "adaptive",
    contentReadiness: "ready",
    fallbackBody: false,
    compositionIds: [`composition-${suffix}`],
    compositions: [{ id: `composition-${suffix}`, requiresComponent: false, slots: [{ id: "primary", role: "text" }] }],
    slotCapabilities: { textSlots: [] },
    mediaContract: { mode: "no-image" },
  });
  const input = {
    skinId: "skin",
    deckPlan: { deckId: "deck" },
    pageContents: [{ pageId: "p1", title: "页面标题", items: [{ id: "item", title: "标题", body: "正文" }] }],
    pageIntents: [{ intentId: "p1-intent" }],
    candidateSets: [{ pageId: "p1", candidates: [candidate("a"), candidate("b")] }],
  };
  const original = {
    visualPlan: { pages: [{ pageId: "p1", intentId: "p1-intent", familyId: "family-a", variantId: "variant-a", silhouette: "shape-a" }] },
    compositionPlan: { pages: [{ pageId: "p1", intentId: "p1-intent", compositionId: "composition-a", textSlots: [] }] },
  };
  const edited = structuredClone(original);
  Object.assign(edited.visualPlan.pages[0], { familyId: "family-b", variantId: "variant-b", silhouette: "shape-b" });
  const rebuilt = rebuildChangedVisualSelections(edited, original, input);
  assert.equal(rebuilt.visualPlan.pages[0].familyId, "family-b");
  assert.equal(rebuilt.compositionPlan.pages[0].compositionId, "composition-b");
});
