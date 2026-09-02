import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readJsonState, writeJsonState } from "../src/workbench/json-state-file.mjs";

test("工作台 JSON 状态串行写入且读取端不会得到半截 JSON", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-json-state-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, "summary.json");
  await writeJsonState(target, { index: -1, payload: "初始状态" });

  const writes = Array.from({ length: 20 }, (_, index) => writeJsonState(target, {
    index,
    payload: "状态".repeat(20000),
  }));
  const reads = Array.from({ length: 80 }, () => readJsonState(target));
  const values = await Promise.all([...writes, ...reads]);
  const readValues = values.slice(writes.length);

  assert.equal(readValues.every((value) => Number.isInteger(value.index)), true);
  assert.deepEqual(await readJsonState(target), { index: 19, payload: "状态".repeat(20000) });
});
