import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectLocalDependencyClosure, sha256File } from "../src/distillation/artifacts.mjs";
import { buildRequiredInputArtifacts, verifyArtifactSummaries } from "../src/distillation/freshness.mjs";

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-freshness-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function write(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value);
}

async function summary(root, role, relativePath) {
  return { role, path: relativePath, ...await sha256File(path.join(root, relativePath)) };
}

async function requiredWorkspace(t) {
  const root = await workspace(t);
  const files = {
    caseManifestPath: "run/case-manifest.json",
    assetMetadataPath: "asset/asset.json",
    sourcePptxPath: "source/reference.pptx",
    skinSourcePath: "skin/skin.mjs",
    lockfilePath: "package-lock.json",
    auditorPath: "tools/auditor.mjs",
    builderEntryPath: "builder/z-entry.mjs",
    validationReportPath: "run/validation-report.json",
  };
  await write(path.join(root, files.caseManifestPath), "{}\n");
  await write(path.join(root, files.assetMetadataPath), "{}\n");
  await write(path.join(root, files.sourcePptxPath), Buffer.from([0x50, 0x50, 0x54, 0x58]));
  await write(path.join(root, files.skinSourcePath), "import '../shared/code.mjs';\nexport const skin = {};\n");
  await write(path.join(root, files.lockfilePath), "{}\n");
  await write(path.join(root, files.auditorPath), "import '../shared/code.mjs';\nexport const audit = true;\n");
  await write(path.join(root, "shared", "code.mjs"), "export const shared = true;\n");
  await write(path.join(root, "builder", "z-entry.mjs"), "import { helper } from './a-helper.mjs';\nexport default helper;\n");
  await write(path.join(root, "builder", "a-helper.mjs"), "export const helper = true;\n");
  await write(path.join(root, files.validationReportPath), "{}\n");
  return { root, config: { repoRoot: root, ...files } };
}

test("freshness audit recomputes file size and digest from disk", async (t) => {
  const root = await workspace(t);
  await write(path.join(root, "input.txt"), "ABCD");
  const artifact = await summary(root, "input", "input.txt");
  assert.equal((await verifyArtifactSummaries([artifact], { repoRoot: root })).status, "passed");

  await write(path.join(root, "input.txt"), "WXYZ");
  await assert.rejects(
    verifyArtifactSummaries([artifact], { repoRoot: root }),
    (error) => error?.code === "ARTIFACT_DIGEST_MISMATCH",
  );
  await fs.rm(path.join(root, "input.txt"));
  await assert.rejects(
    verifyArtifactSummaries([artifact], { repoRoot: root }),
    (error) => error?.code === "ARTIFACT_FILE_MISSING",
  );
});

test("freshness audit rejects duplicate roles, duplicate files, and validation-report evidence", async (t) => {
  const root = await workspace(t);
  await write(path.join(root, "a.txt"), "A");
  await write(path.join(root, "b.txt"), "B");
  await write(path.join(root, "validation-report.json"), "{}\n");
  const first = await summary(root, "first", "a.txt");
  const second = await summary(root, "second", "b.txt");

  await assert.rejects(
    verifyArtifactSummaries([first, { ...second, role: "first" }], { repoRoot: root }),
    (error) => error?.code === "DUPLICATE_ARTIFACT_ROLE",
  );
  await assert.rejects(
    verifyArtifactSummaries([first, { ...first, role: "alias" }], { repoRoot: root }),
    (error) => error?.code === "DUPLICATE_ARTIFACT_PATH",
  );
  const report = await summary(root, "reported-output", "validation-report.json");
  await assert.rejects(
    verifyArtifactSummaries([report], {
      repoRoot: root,
      forbiddenPaths: ["validation-report.json"],
    }),
    (error) => error?.code === "FORBIDDEN_ARTIFACT_PATH",
  );
  await assert.rejects(
    verifyArtifactSummaries([{ ...report, role: "validation-report" }], { repoRoot: root }),
    (error) => error?.code === "FORBIDDEN_ARTIFACT_ROLE",
  );
});

test("freshness audit rejects repository escapes including symlink escapes", async (t) => {
  const parent = await workspace(t);
  const root = path.join(parent, "repo");
  const outside = path.join(parent, "outside");
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await write(path.join(outside, "secret.txt"), "secret");
  await assert.rejects(
    verifyArtifactSummaries([{
      role: "escape",
      path: "../outside/secret.txt",
      ...await sha256File(path.join(outside, "secret.txt")),
    }], { repoRoot: root }),
    (error) => error?.code === "ARTIFACT_PATH_ESCAPE",
  );

  const link = path.join(root, "linked-outside");
  try {
    await fs.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("symbolic links are unavailable in this environment");
      return;
    }
    throw error;
  }
  await assert.rejects(
    verifyArtifactSummaries([{
      role: "symlink-escape",
      path: "linked-outside/secret.txt",
      ...await sha256File(path.join(outside, "secret.txt")),
    }], { repoRoot: root }),
    (error) => error?.code === "ARTIFACT_PATH_ESCAPE",
  );
});

test("required inputs are fixed by configuration and include the full builder closure", async (t) => {
  const { root, config } = await requiredWorkspace(t);
  const artifacts = await buildRequiredInputArtifacts(config);
  assert.deepEqual(artifacts.map((item) => item.role).sort(), [
    "asset-metadata",
    "auditor-entry",
    "builder-entry",
    "case-manifest",
    "code-dependency-001",
    "code-dependency-002",
    "lockfile",
    "skin-entry",
    "source-pptx",
  ]);
  assert.deepEqual(
    artifacts.filter((item) => item.role === "builder-entry" || item.role.startsWith("code-dependency-"))
      .map((item) => item.path).sort(),
    ["builder/a-helper.mjs", "builder/z-entry.mjs", "shared/code.mjs"],
  );
  assert.equal(artifacts.find((item) => item.role === "builder-entry").path, "builder/z-entry.mjs");
  await assert.rejects(
    buildRequiredInputArtifacts({ ...config, rawInputs: [] }),
    (error) => error?.code === "RAW_INPUTS_FORBIDDEN",
  );

  await write(path.join(root, "builder", "z-entry.mjs"), "import { helper } from './missing.mjs';\nexport default helper;\n");
  await assert.rejects(
    buildRequiredInputArtifacts(config),
    (error) => error?.code === "DEPENDENCY_FILE_MISSING",
  );
});

test("CommonJS entries and dependencies fail closed instead of claiming a complete closure", async (t) => {
  const root = await workspace(t);
  await write(path.join(root, "entry.cjs"), "module.exports = require('./helper.cjs');\n");
  await assert.rejects(
    collectLocalDependencyClosure("entry.cjs", { repoRoot: root }),
    (error) => error?.code === "UNSUPPORTED_CJS_DEPENDENCY",
  );

  await write(path.join(root, "entry.mjs"), "import helper from './helper.cjs';\nexport default helper;\n");
  await write(path.join(root, "helper.cjs"), "module.exports = true;\n");
  await assert.rejects(
    collectLocalDependencyClosure("entry.mjs", { repoRoot: root }),
    (error) => error?.code === "UNSUPPORTED_CJS_DEPENDENCY",
  );
});
