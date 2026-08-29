import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectHtmlComponentEligibility } from "../src/runtime/html-component-eligibility.mjs";

test("HTML 一审与 Native/PPT 二审是两个明确阶段", async () => {
  const assetId = "approval-stage-fixture";
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-approval-"));
  try {
    await fs.writeFile(path.join(directory, "visual-intent.md"), "# visual intent\n", "utf8");
    let eligibility = await inspectHtmlComponentEligibility(directory, assetId);
    assert.equal(eligibility.stage, "awaiting-html-review");
    assert.equal(eligibility.htmlApproved, false);
    assert.equal(eligibility.eligible, false);

    await fs.writeFile(path.join(directory, "html-approval.json"), JSON.stringify({
      schemaVersion: "1.0",
      assetId,
      decision: "approved",
      scope: "html-golden",
    }), "utf8");
    eligibility = await inspectHtmlComponentEligibility(directory, assetId);
    assert.equal(eligibility.stage, "awaiting-native-review");
    assert.equal(eligibility.htmlApproved, true);
    assert.equal(eligibility.eligible, false);

    await fs.writeFile(path.join(directory, "user-approval.json"), JSON.stringify({
      schemaVersion: "1.0",
      assetId,
      decision: "approved",
      scope: "html-golden-and-native",
    }), "utf8");
    eligibility = await inspectHtmlComponentEligibility(directory, assetId);
    assert.equal(eligibility.stage, "user-approved");
    assert.equal(eligibility.userApproved, true);
    assert.equal(eligibility.eligible, true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
