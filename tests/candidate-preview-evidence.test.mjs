import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { collectVisualDirectorEvidence } from "../src/agent/candidate-preview-evidence.mjs";

test("视觉导演为缺少现成 PNG 的核心资产按需生成忽略缓存预览", async () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
  const evidence = await collectVisualDirectorEvidence({
    root,
    candidateSets: [{
      pageId: "p1",
      candidates: [{ assetId: "hub-radial-001", structureGroupId: "hub-radial-anchor" }],
    }],
  });
  assert.equal(evidence.imagePaths.length, 1);
  assert.equal(evidence.entries[0].assetId, "hub-radial-001");
  await fs.access(evidence.imagePaths[0]);
});
