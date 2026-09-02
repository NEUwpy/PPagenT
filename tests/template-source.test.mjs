import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import {
  NORTHEASTERN_UNIVERSITY_BUNDLED_TEMPLATE,
  resolveNortheasternUniversityTemplate,
} from "../src/runtime/skins/template-source.mjs";

test("正式仓库随附东北大学 Skin 运行模板", async () => {
  const root = path.resolve(import.meta.dirname, "..");
  const resolved = resolveNortheasternUniversityTemplate(root);
  assert.ok(["local-source", "bundled-runtime"].includes(resolved.kind));
  const bundled = path.join(root, NORTHEASTERN_UNIVERSITY_BUNDLED_TEMPLATE);
  const zip = await JSZip.loadAsync(await fs.readFile(bundled));
  const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slides.length, 4);
});

test("全新克隆没有 PPT源 时自动使用随仓库模板", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-template-source-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundled = path.join(root, NORTHEASTERN_UNIVERSITY_BUNDLED_TEMPLATE);
  await fs.mkdir(path.dirname(bundled), { recursive: true });
  await fs.writeFile(bundled, "runtime-template");

  assert.deepEqual(resolveNortheasternUniversityTemplate(root), {
    kind: "bundled-runtime",
    path: bundled,
  });
});
