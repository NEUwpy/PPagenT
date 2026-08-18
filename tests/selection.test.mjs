import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { computeContentStats, enrichPageIntent } from "../src/content/page-content.mjs";
import { loadContractCatalog, matchPageIntent } from "../src/selection/contracts.mjs";
import { createRuleValidators } from "../src/selection/validation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const contracts = await loadContractCatalog(root);
const validators = await createRuleValidators(root);
const readFixture = async (name) => JSON.parse(await fs.readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"));

test("文字统计由 PageContent 确定性计算", async () => {
  const content = await readFixture("sequence.content.json");
  assert.deepEqual(computeContentStats(content), {
    titleChars: 6,
    itemCount: 4,
    maxItemChars: 9,
    avgItemChars: 8.75,
    minItemChars: 8,
    maxItemTitleChars: 2,
    maxItemBodyChars: 7,
    imbalanceRatio: 1.13,
  });
});

test("PageIntent 的数量和文字统计由程序补齐", async () => {
  const content = await readFixture("sequence.content.json");
  const draft = await readFixture("sequence.intent-draft.json");
  const expected = await readFixture("sequence.intent.json");
  assert.deepEqual(enrichPageIntent(draft, content), expected);
});

test("双组对比的组数和每组条目数由 PageContent 确定性补齐", () => {
  const content = {
    schemaVersion: "1.0",
    pageId: "comparison",
    title: "两种路线",
    items: [
      { id: "left", title: "自由生成", body: "结果波动\n难以复现" },
      { id: "right", title: "受控生成", body: "结构稳定\n边界明确\n持续积累" },
    ],
  };
  const intent = enrichPageIntent({
    intentId: "comparison-intent",
    purposeKey: "compare_options",
    purposeText: "比较两种路线",
    baseRelation: "comparison",
    relationTraits: {
      temporal: false, cyclic: false, converging: false, branched: false,
      dimensions: 1, secondaryDimension: "none",
    },
    structure: { itemCount: 0, ordered: false, sameLevel: true, dimensions: { items: 2 } },
    density: "low",
  }, content);
  assert.equal(intent.structure.dimensions.groups, 2);
  assert.equal(intent.structure.dimensions.itemsPerGroup, 3);
});

test("普通顺序过程只匹配基础顺序语法", async () => {
  const intent = await readFixture("sequence.intent.json");
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "single-match");
  assert.equal(result.selectedAssetId, "sequence-flow-001");
});

test("purposeText 可自由变化，执行只依赖受控 purposeKey", async () => {
  const intent = await readFixture("sequence.intent.json");
  const first = matchPageIntent(intent, contracts);
  const second = matchPageIntent({ ...intent, purposeText: "换一种自然语言说明同一个目的" }, contracts);
  assert.equal(first.selectedAssetId, second.selectedAssetId);
});

test("科研分支流程未登记复合模板时回退，不误匹配通用顺序流程", async () => {
  const intent = await readFixture("research-route.intent.json");
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "fallback");
  assert.equal(result.selectedAssetId, null);
  const rejection = result.rejections.find((item) => item.assetId === "sequence-flow-001");
  assert.ok(rejection, "通用顺序流程应当被明确拒绝而非抢占");
  assert.ok(rejection.reasons.includes("purpose-key:explain_research_process"));
});

test("受控 purposeKey 拒绝未登记同义词", async () => {
  const intent = await readFixture("sequence.intent.json");
  assert.equal(validators.purposeKeys.has(intent.purposeKey), true);
  assert.equal(validators.purposeKeys.has("describe_steps_in_order"), false);
});

test("中心辐射超过容量时生成可执行退化计划", async () => {
  const base = await readFixture("sequence.intent.json");
  const intent = {
    ...base,
    intentId: "hub-overflow",
    purposeKey: "explain_topics",
    purposeText: "说明一个中心主题周围的九个同级要点",
    baseRelation: "hub",
    relationTraits: { ...base.relationTraits, branched: false },
    structure: { ...base.structure, itemCount: 9, ordered: false, sameLevel: true },
    contentStats: { ...base.contentStats, itemCount: 9 },
  };
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "fallback");
  assert.equal(result.resolutionPlan.sourceAssetId, "hub-radial-001");
  assert.equal(result.resolutionPlan.reason, "above-max:itemCount");
  assert.equal(result.resolutionPlan.action, "defer-to-review");
  assert.equal(result.resolutionPlan.requiresReview, true);
});

test("顺序步骤超过上限时给出拆页数量", async () => {
  const base = await readFixture("sequence.intent.json");
  const intent = {
    ...base,
    intentId: "sequence-overflow",
    structure: { ...base.structure, itemCount: 7 },
    contentStats: { ...base.contentStats, itemCount: 7 },
  };
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "fallback");
  assert.equal(result.resolutionPlan.action, "split");
  assert.equal(result.resolutionPlan.pages, 2);
});

test("受控 purposeKey 在复合模板缺失时阻止通用语法抢占", async () => {
  const base = await readFixture("sequence.intent.json");
  const intent = {
    ...base,
    intentId: "user-journey",
    purposeKey: "explain_user_journey",
    purposeText: "说明用户在四个连续阶段中的行为和体验",
  };
  const result = matchPageIntent(intent, contracts);
  assert.equal(result.decision, "fallback");
  assert.equal(result.selectedAssetId, null);
  const rejection = result.rejections.find((item) => item.assetId === "sequence-flow-001");
  assert.ok(rejection, "通用顺序流程应当被明确拒绝而非抢占");
  assert.ok(rejection.reasons.includes("purpose-key:explain_user_journey"));
});

test("暂缓资产默认不参与选择", async () => {
  const base = await readFixture("sequence.intent.json");
  const intent = {
    ...base,
    intentId: "deferred-example",
    purposeKey: "explain_experience_layers",
    purposeText: "说明体验体系的三个层次",
    baseRelation: "layered",
    relationTraits: { ...base.relationTraits, dimensions: 1, secondaryDimension: "layer" },
    structure: { ...base.structure, itemCount: 3, hierarchyDepth: 3, ordered: true, sameLevel: false },
    contentStats: { ...base.contentStats, itemCount: 3 },
  };
  const result = matchPageIntent(intent, contracts);
  assert.ok(!result.candidates.some((item) => item.assetId === "experience-layer-model-001"));
});
