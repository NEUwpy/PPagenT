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

test("intake batch command creates and updates a complete user-review record", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-intake-batch-"));
  const sourcePath = path.join(root, "source.pptx");
  const resultA = path.join(root, "asset-a.pptx");
  const resultB = path.join(root, "asset-b.pptx");
  const resultB2 = path.join(root, "asset-b-repaired.pptx");
  await Promise.all([sourcePath, resultA, resultB, resultB2].map((filePath) => fs.writeFile(filePath, "pptx-placeholder")));
  const pageA = path.join(root, "asset-a-page.png");
  const pageB = path.join(root, "asset-b-page.png");
  const pageB2 = path.join(root, "asset-b-page-repaired.png");
  await Promise.all([pageA, pageB, pageB2].map((filePath) => fs.writeFile(filePath, png)));
  const outputDir = path.join(root, "intake-batch");
  const configPath = path.join(root, "intake-batch.json");
  const config = {
    schemaVersion: "1.0",
    batchId: "batch-2026-08-11",
    title: "Structure intake",
    outputDir,
    sources: [{ label: "reference deck", path: sourcePath }],
    weeklyLimit: { startPercent: 92 },
    task: { startedAt: "2026-08-11T08:00:00Z", model: "Luna High" },
    assets: [
      { assetId: "asset-a", label: "Asset A" },
      { assetId: "asset-b", label: "Asset B" },
    ],
  };
  await fs.writeFile(configPath, JSON.stringify(config));
  const first = spawnSync(process.execPath, [cli, "--batch-config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const firstRecord = JSON.parse(await fs.readFile(path.join(outputDir, "batch.json"), "utf8"));
  const firstMarkdown = await fs.readFile(path.join(outputDir, "用户验收.md"), "utf8");
  assert.equal(firstRecord.status, "awaiting-complete-user-review");
  assert.equal(firstRecord.weeklyLimit.endPercent, null);
  assert.equal(firstRecord.weeklyLimit.consumedPercentagePoints, null);
  assert.equal(firstRecord.task.model, "Luna High");
  assert.equal(firstRecord.task.startedAt, "2026-08-11T08:00:00Z");
  assert.equal(firstRecord.task.endedAt, undefined);
  assert.match(firstMarkdown, /Asset A/);
  assert.match(firstMarkdown, /Asset B/);
  assert.match(firstMarkdown, /待生成/);
  assert.match(firstMarkdown, /周限剩余（用户提供）/);
  assert.match(firstMarkdown, /工具不会读取或声称读取 Codex 账户周限/);
  assert.doesNotMatch(firstMarkdown, /百分点消耗/);
  assert.doesNotMatch(firstMarkdown, /## Sources|## Main result paths|Status:|Weekly limit/);

  const incompleteRelease = { ...config, allReleased: true };
  await fs.writeFile(configPath, JSON.stringify(incompleteRelease));
  const incompleteReleaseResult = spawnSync(process.execPath, [cli, "--batch-config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(incompleteReleaseResult.status, 0);
  assert.match(incompleteReleaseResult.stderr, /INTAKE_RELEASE_INCOMPLETE/);

  const update = {
    schemaVersion: "1.0",
    batchId: config.batchId,
    outputDir,
    resultPaths: [{ label: "review deck", path: resultA }, { label: "repaired review deck", path: resultB2 }],
    weeklyLimit: { endPercent: 66 },
    task: { endedAt: "2026-08-11T08:30:00Z" },
    assets: [
      { assetId: "asset-a", label: "Asset A", resultPaths: [resultA], reviewPages: [{ pageId: "a-1", label: "A page", path: pageA }] },
      { assetId: "asset-b", label: "Asset B", resultPaths: [resultB2], reviewPages: [{ pageId: "b-2", label: "B repaired page", path: pageB2 }] },
    ],
  };
  await fs.writeFile(configPath, JSON.stringify(update));
  const second = spawnSync(process.execPath, [cli, "--batch-config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  const secondRecord = JSON.parse(await fs.readFile(path.join(outputDir, "batch.json"), "utf8"));
  const secondMarkdown = await fs.readFile(path.join(outputDir, "用户验收.md"), "utf8");
  assert.equal(secondRecord.status, "awaiting-complete-user-review");
  assert.equal(secondRecord.weeklyLimit.startPercent, 92);
  assert.equal(secondRecord.weeklyLimit.consumedPercentagePoints, 26);
  assert.equal(secondRecord.task.startedAt, "2026-08-11T08:00:00Z");
  assert.equal(secondRecord.task.endedAt, "2026-08-11T08:30:00Z");
  assert.equal(secondRecord.task.assetCount, 2);
  assert.deepEqual(secondRecord.assets.map((asset) => asset.assetId), ["asset-a", "asset-b"]);
  assert.match(secondMarkdown, /a-1/);
  assert.match(secondMarkdown, /b-2/);
  assert.match(secondMarkdown, /repaired review deck/);
  assert.doesNotMatch(secondMarkdown, /Status: \*\*promoted\*\*/);

  const release = { ...update, allReleased: true };
  await fs.writeFile(configPath, JSON.stringify(release));
  const releaseResult = spawnSync(process.execPath, [cli, "--batch-config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(releaseResult.status, 0, releaseResult.stderr);
  const releasedRecord = JSON.parse(await fs.readFile(path.join(outputDir, "batch.json"), "utf8"));
  const releasedMarkdown = await fs.readFile(path.join(outputDir, "用户验收.md"), "utf8");
  assert.equal(releasedRecord.status, "user-approved");
  assert.equal(releasedRecord.promotionEligible, true);
  assert.match(releasedMarkdown, /用户已明确确认本批全部资产可放行；核心库晋升仍由后续操作完成/);

  const wrongBatch = { ...update, batchId: "another-batch" };
  await fs.writeFile(configPath, JSON.stringify(wrongBatch));
  const wrongBatchResult = spawnSync(process.execPath, [cli, "--batch-config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(wrongBatchResult.status, 0);
  assert.match(wrongBatchResult.stderr, /INTAKE_BATCH_ID_MISMATCH/);

  const invalid = { ...update, weeklyLimit: { startPercent: 92, endPercent: 101 } };
  await fs.writeFile(configPath, JSON.stringify(invalid));
  const third = spawnSync(process.execPath, [cli, "--batch-config", configPath], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(third.status, 0);
  assert.match(third.stderr, /INTAKE_PERCENT/);
});
