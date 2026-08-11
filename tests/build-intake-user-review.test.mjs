import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(".");
const cli = path.join(repoRoot, "src", "tools", "build-intake-user-review.mjs");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z5ZkAAAAASUVORK5CYII=", "base64");

test("intake review harness emits selected topology cases in a stable per-page package", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-review-"));
  const runDir = path.join(root, "workbench", "distillation", "runs", "sample-r1");
  const skinDir = path.join(runDir, "skin-qa");
  const standaloneDir = path.join(runDir, "standalone-qa");
  await fs.mkdir(skinDir, { recursive: true });
  await fs.mkdir(standaloneDir, { recursive: true });
  await fs.writeFile(path.join(skinDir, "slide-01.png"), png);
  await fs.writeFile(path.join(skinDir, "slide-02.png"), png);
  await fs.writeFile(path.join(standaloneDir, "slide-01.png"), png);
  await fs.writeFile(path.join(standaloneDir, "slide-02.png"), png);
  await fs.writeFile(path.join(runDir, "review-index.json"), JSON.stringify({
    runId: "sample-r1",
    summary: { renderCaseCount: 2 },
    cases: [{
      caseId: "r01",
      assetId: "sample-001",
      skin: { pageNumber: 1, png: { path: "workbench/distillation/runs/sample-r1/skin-qa/slide-01.png" } },
      standalone: { pageNumber: 1, png: { path: "workbench/distillation/runs/sample-r1/standalone-qa/slide-01.png" } },
    }, {
      caseId: "r02",
      assetId: "sample-001",
      skin: { pageNumber: 2, png: { path: "workbench/distillation/runs/sample-r1/skin-qa/slide-02.png" } },
      standalone: { pageNumber: 2, png: { path: "workbench/distillation/runs/sample-r1/standalone-qa/slide-02.png" } },
    }],
  }));
  const outputDir = path.join(root, "review-v1");
  const configPath = path.join(root, "review-batch.json");
  await fs.writeFile(configPath, JSON.stringify({
    schemaVersion: "1.0",
    batchId: "sample-batch-v1",
    sourceRoot: root,
    outputDir,
    assets: [{ label: "样例资产", runDir: "workbench/distillation/runs/sample-r1", caseIds: ["r02"] }],
  }));

  const first = spawnSync(process.execPath, [cli, "--config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, "review-manifest.json"), "utf8"));
  assert.equal(manifest.status, "awaiting-complete-user-review");
  assert.equal(manifest.pageCount, 1);
  assert.equal(manifest.pages[0].caseId, "r02");
  assert.equal((await fs.readdir(path.join(outputDir, "逐页PNG", "Skin"))).length, 1);
  assert.equal((await fs.readdir(path.join(outputDir, "逐页PNG", "独立版"))).length, 1);
  await fs.access(path.join(outputDir, "逐页验收-Skin.pptx"));
  await fs.access(path.join(outputDir, "逐页验收-独立版.pptx"));
  assert.match(await fs.readFile(path.join(outputDir, "验收清单.md"), "utf8"), /只有用户明确表示/);

  const second = spawnSync(process.execPath, [cli, "--config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /EEXIST/);
});
