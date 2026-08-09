import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadContractCatalog, matchPageIntent } from "../src/selection/contracts.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const contracts = await loadContractCatalog(root);
const readFixture = async (name) => JSON.parse(await fs.readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"));

test("普通顺序过程只匹配基础顺序语法", async () => {
  const intent = await readFixture("sequence.intent.json");
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "single-match");
  assert.deepEqual(result.eligible.map((item) => item.assetId), ["sequential-process-001"]);
});

test("科研分支流程匹配高级复合模板，而不是普通顺序流程", async () => {
  const intent = await readFixture("research-route.intent.json");
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "single-match");
  assert.deepEqual(result.eligible.map((item) => item.assetId), ["technical-route-flow-001"]);
});

test("中心辐射超过已验证容量时返回无匹配", () => {
  const intent = {
    schemaVersion: "1.0",
    intentId: "hub-overflow",
    purpose: "explain_topics",
    relation: "hub",
    structure: { itemCount: 9, hierarchyDepth: 1, ordered: false, sameLevel: true, hasBranches: false, dimensions: {} },
    density: "medium",
  };
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "no-match");
  assert.ok(result.rejected.find((item) => item.assetId === "radial-hub-001").reasons.includes("above-max:itemCount"));
});

test("暂缓资产默认不参与选择", () => {
  const intent = {
    schemaVersion: "1.0",
    intentId: "deferred-example",
    purpose: "explain_experience_layers",
    relation: "layered",
    structure: { itemCount: 3, hierarchyDepth: 3, ordered: true, sameLevel: false, hasBranches: false, dimensions: {} },
    density: "medium",
  };
  const result = matchPageIntent(intent, contracts);
  assert.ok(!result.eligible.some((item) => item.assetId === "experience-layer-model-001"));
});
