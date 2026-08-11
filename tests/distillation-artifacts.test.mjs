import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectLocalDependencyClosure,
  createFreshRunDirectory,
  sha256File,
  summarizeInputArtifacts,
  validateArtifactSummary,
  writeInputArtifactList,
} from "../src/distillation/artifacts.mjs";

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-artifacts-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function write(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value, "utf8");
}

test("file summaries contain exact SHA-256 and byte size", async (t) => {
  const root = await workspace(t);
  const target = path.join(root, "input.txt");
  await write(target, "abc");
  assert.deepEqual(await sha256File(target), {
    digest: "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    sizeBytes: 3,
  });
});

test("dependency closure follows static import and export-from transitively in deterministic order", async (t) => {
  const root = await workspace(t);
  await write(path.join(root, "entry.mjs"), [
    "import { a } from './lib/a.mjs';",
    "export { b } from './lib/b.mjs';",
    "export * as c from './lib/c.mjs';",
    "const note = \"import './not-a-real-dependency.mjs'\";",
    "export default a + b;",
  ].join("\n"));
  await write(path.join(root, "lib", "a.mjs"), "import data from './data.json' with { type: 'json' };\nexport const a = data.a;\n");
  await write(path.join(root, "lib", "b.mjs"), "export const b = 2;\n");
  await write(path.join(root, "lib", "c.mjs"), "export const c = 3;\n");
  await write(path.join(root, "lib", "data.json"), "{\"a\":1}\n");

  const first = await collectLocalDependencyClosure("entry.mjs", { repoRoot: root });
  assert.deepEqual(first.map((item) => item.path), [
    "entry.mjs",
    "lib/a.mjs",
    "lib/b.mjs",
    "lib/c.mjs",
    "lib/data.json",
  ]);
  first.forEach((item) => assert.equal(validateArtifactSummary({ role: "dependency", ...item }), true));

  const oldDigest = first.find((item) => item.path === "lib/a.mjs").digest;
  await write(path.join(root, "lib", "a.mjs"), "import data from './data.json' with { type: 'json' };\nexport const a = data.a + 1;\n");
  const second = await collectLocalDependencyClosure("entry.mjs", { repoRoot: root });
  assert.notEqual(second.find((item) => item.path === "lib/a.mjs").digest, oldDigest);
  assert.deepEqual(second.map((item) => item.path), first.map((item) => item.path));
});

test("dependency closure fails on missing, escaping, and dynamic local dependencies", async (t) => {
  const parent = await workspace(t);
  const root = path.join(parent, "repo");
  await fs.mkdir(root);

  await write(path.join(root, "missing.mjs"), "import './not-found.mjs';\n");
  await assert.rejects(
    collectLocalDependencyClosure("missing.mjs", { repoRoot: root }),
    (error) => error?.code === "DEPENDENCY_FILE_MISSING",
  );

  await write(path.join(parent, "outside.mjs"), "export const secret = true;\n");
  await write(path.join(root, "escape.mjs"), "export { secret } from '../outside.mjs';\n");
  await assert.rejects(
    collectLocalDependencyClosure("escape.mjs", { repoRoot: root }),
    (error) => error?.code === "DEPENDENCY_PATH_ESCAPE",
  );

  await write(path.join(root, "dynamic.mjs"), "export const load = () => import('./lazy.mjs');\n");
  await write(path.join(root, "lazy.mjs"), "export const value = 1;\n");
  await assert.rejects(
    collectLocalDependencyClosure("dynamic.mjs", { repoRoot: root }),
    (error) => error?.code === "DYNAMIC_LOCAL_IMPORT",
  );
});

test("fresh run directories stay below the allowed root and are never reused", async (t) => {
  const root = await workspace(t);
  const allowedRoot = path.join(root, "runs");
  await fs.mkdir(allowedRoot);
  const runDir = path.join(allowedRoot, "batch-001");
  assert.equal(await createFreshRunDirectory({ allowedRoot, runDir }), runDir);

  await assert.rejects(
    createFreshRunDirectory({ allowedRoot, runDir }),
    (error) => error?.code === "RUN_DIR_ALREADY_EXISTS",
  );
  await assert.rejects(
    createFreshRunDirectory({ allowedRoot, runDir: allowedRoot }),
    (error) => error?.code === "RUN_DIR_EQUALS_ALLOWED_ROOT",
  );
  await assert.rejects(
    createFreshRunDirectory({ allowedRoot, runDir: path.join(allowedRoot, "..", "escape") }),
    (error) => error?.code === "RUN_DIR_PATH_ESCAPE",
  );
});

test("input artifact lists are deterministic and cannot summarize or overwrite validation-report", async (t) => {
  const root = await workspace(t);
  await write(path.join(root, "a.txt"), "A");
  await write(path.join(root, "b.txt"), "BB");
  await write(path.join(root, "validation-report.json"), "{}\n");
  const entries = [
    { role: "second", path: "b.txt" },
    { role: "first", path: "a.txt" },
  ];
  const artifacts = await summarizeInputArtifacts(entries, {
    repoRoot: root,
    validationReportPath: "validation-report.json",
  });
  assert.deepEqual(artifacts.map((item) => item.path), ["a.txt", "b.txt"]);

  const output = path.join(root, "input-artifacts.json");
  const payload = await writeInputArtifactList(output, entries, {
    repoRoot: root,
    validationReportPath: "validation-report.json",
  });
  assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), payload);
  await assert.rejects(
    writeInputArtifactList(output, entries, {
      repoRoot: root,
      validationReportPath: "validation-report.json",
    }),
    (error) => error?.code === "EEXIST",
  );

  await assert.rejects(
    summarizeInputArtifacts([{ role: "self", path: "validation-report.json" }], {
      repoRoot: root,
      validationReportPath: "validation-report.json",
    }),
    (error) => error?.code === "VALIDATION_REPORT_SELF_DIGEST",
  );
  await assert.rejects(
    writeInputArtifactList(path.join(root, "validation-report.json"), entries, {
      repoRoot: root,
      validationReportPath: "validation-report.json",
    }),
    (error) => error?.code === "VALIDATION_REPORT_SELF_WRITE",
  );
  await assert.rejects(
    summarizeInputArtifacts([{ role: "escape", path: "../outside.txt" }], {
      repoRoot: root,
      validationReportPath: "validation-report.json",
    }),
    (error) => error?.code === "ARTIFACT_PATH_ESCAPE",
  );
});
