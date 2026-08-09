import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { enrichPageIntent } from "../src/content/page-content.mjs";
import { mapRenderPayload } from "../src/render/render-payload.mjs";
import { loadContractCatalog, matchPageIntent } from "../src/selection/contracts.mjs";
import { createRuleValidators } from "../src/selection/validation.mjs";

const root = process.cwd();
const manuscriptPath = path.join(
  root,
  "experiments",
  "真实稿件",
  "为什么做PPagenT-v0.2.0",
  "manuscript.json",
);

test("第一份真实稿件逐页通过四层对象并形成唯一资产调用", async () => {
  const manuscript = JSON.parse(await fs.readFile(manuscriptPath, "utf8"));
  const contracts = await loadContractCatalog(root);
  const validators = await createRuleValidators(root);
  const selectedAssets = [];

  for (const page of manuscript.pages) {
    assert.equal(validators.validatePageContent(page.content), true);
    const intent = enrichPageIntent(page.intentDraft, page.content);
    assert.equal(validators.validatePageIntent(intent), true);
    const decision = matchPageIntent(intent, contracts);
    assert.notEqual(decision.selectedAssetId, null, page.content.pageId);
    assert.notEqual(decision.decision, "needs-ranking", page.content.pageId);
    assert.equal(validators.validateLayoutDecision(decision), true);
    const payload = mapRenderPayload(page.content, intent, decision);
    assert.equal(validators.validateRenderPayload(payload), true);
    selectedAssets.push(decision.selectedAssetId);
  }

  assert.deepEqual(selectedAssets, [
    "northeastern-university-cover-001",
    "radial-hub-001",
    "radial-hub-001",
    "comparison-structure-001",
    "sequential-process-001",
    "radial-hub-001",
    "sequential-process-001",
    "layered-architecture-001",
    "cycle-loop-001",
    "northeastern-university-closing-001",
  ]);
});
