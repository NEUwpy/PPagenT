import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  flattenExpressions,
  validatePageExpressionPlan,
} from "../src/visual-runtime/page-expression-plan.mjs";
import {
  listPageExpressionPrototypes,
  renderPageExpressionPrototype,
} from "../src/visual-runtime/page-expression-prototype.mjs";

test("候选内容块与页面表达 Schema 可以编译并验证两个固定原型", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const root = path.resolve(import.meta.dirname, "..");
  const [contentSchema, planSchema] = await Promise.all([
    fs.readFile(path.join(root, "schemas", "page-content-blocks.schema.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(root, "schemas", "page-expression-plan.schema.json"), "utf8").then(JSON.parse),
  ]);
  const validateContent = ajv.compile(contentSchema);
  const validatePlan = ajv.compile(planSchema);
  for (const prototype of listPageExpressionPrototypes()) {
    assert.equal(validateContent(prototype.pageContent), true, JSON.stringify(validateContent.errors));
    assert.equal(validatePlan(prototype.plan), true, JSON.stringify(validatePlan.errors));
  }
});

test("2+3 原型让一页同时拥有多个表达，并保持 Structure 深度不超过两层", () => {
  const prototypes = listPageExpressionPrototypes();
  const matrix = prototypes.find((item) => item.id === "one-three-n");
  const support = prototypes.find((item) => item.id === "claim-support");
  assert.equal(matrix.validation.maximumStructureDepth, 2);
  assert.equal(matrix.validation.expressionCount, 5);
  assert.equal(support.validation.maximumStructureDepth, 1);
  assert.match(matrix.markup, /data-expression-type="text"/);
  assert.equal((matrix.markup.match(/data-expression-type="structure"/g) ?? []).length, 4);
  assert.match(support.markup, /data-markdown-renderer="controlled-commonmark"/);
});

test("必需内容块必须恰好绑定一次，不能漏掉或重复", () => {
  const prototype = listPageExpressionPrototypes()[1];
  const missing = structuredClone(prototype.plan);
  missing.expressions = missing.expressions.filter((item) => item.type !== "structure");
  assert.throws(
    () => validatePageExpressionPlan(prototype.pageContent, missing),
    /blocks\.outcomes=0/,
  );

  const duplicate = structuredClone(prototype.plan);
  duplicate.expressions.push(structuredClone(duplicate.expressions[1]));
  duplicate.expressions.at(-1).expressionId = "claim-evidence-duplicate";
  duplicate.expressions.at(-1).regionKey = "support-duplicate";
  assert.throws(
    () => validatePageExpressionPlan(prototype.pageContent, duplicate),
    /blocks\.outcomes=2/,
  );
});

test("运行时拒绝第三级 Structure", () => {
  const prototype = listPageExpressionPrototypes()[0];
  const plan = structuredClone(prototype.plan);
  const secondLevel = plan.expressions[1].children[0];
  secondLevel.children.push({
    expressionId: "illegal-third-level",
    type: "structure",
    regionKey: "illegal",
    contentBindings: [],
    structure: {
      logicId: "parallel",
      structureGroupId: "prototype-parallel-scenes",
      prototype: true,
    },
    children: [],
  });
  assert.throws(
    () => validatePageExpressionPlan(prototype.pageContent, plan),
    /第 3 层 Structure/,
  );
});

test("内容引用与表达树是两套对象，视觉计划不复制正文", () => {
  const prototype = listPageExpressionPrototypes()[0];
  const flattened = flattenExpressions(prototype.plan);
  assert.equal(flattened.find((item) => item.expression.expressionId === "matrix-chain").parentExpressionId, "matrix-system");
  assert.doesNotMatch(JSON.stringify(prototype.plan), /红色足迹地图|校本基地（校史馆）/);
  const rendered = renderPageExpressionPrototype(prototype.pageContent, prototype.plan);
  assert.match(rendered.markup, /校本基地/);
});

test("2+3候选运行时独立保留，具体稿件的人工检查进入生产工作台", async () => {
  const prototype = listPageExpressionPrototypes()[1];
  const pageContent = structuredClone(prototype.pageContent);
  const plan = structuredClone(prototype.plan);
  pageContent.coreMessage.markdown = "## 人工试填\n\n这段内容来自内容稿表。";
  plan.expressions[0].text.surfaceId = "field";
  const rendered = renderPageExpressionPrototype(pageContent, plan);
  assert.match(rendered.markup, /人工试填/);
  assert.match(rendered.markup, /ppe-surface--field/);

  const root = path.resolve(import.meta.dirname, "..");
  const [assetServer, assetTemplate, productionServer, productionTemplate] = await Promise.all([
    fs.readFile(path.join(root, "src", "tools", "serve-logic-dashboard.mjs"), "utf8"),
    fs.readFile(path.join(root, "src", "tools", "templates", "logic-dashboard.html"), "utf8"),
    fs.readFile(path.join(root, "src", "tools", "serve-production-workbench.mjs"), "utf8"),
    fs.readFile(path.join(root, "src", "tools", "templates", "production-workbench.html"), "utf8"),
  ]);
  assert.doesNotMatch(assetServer, /\/api\/page-expression\/render/);
  assert.doesNotMatch(assetTemplate, /视觉导演填表实验台/);
  assert.match(productionServer, /checkpoint\/visual-director/);
  assert.match(productionServer, /request\.method === "DELETE"/);
  assert.match(productionServer, /\/api\/workbench\/runs\/batch-delete/);
  assert.match(productionServer, /value\?\.mode === "all-deletable"/);
  assert.match(productionServer, /await Promise\.all\(targets\.map/);
  assert.match(productionServer, /path\.dirname\(targetRunDir\) !== resolvedRunsRoot/);
  assert.match(productionServer, /fs\.rm\(targetRunDir, \{ recursive: true, force: false \}\)/);
  assert.match(productionServer, /activeRunId === runId \|\| activeVisualCheckpoints\.has\(runId\)/);
  assert.match(productionTemplate, /调试时暂停表单/);
  assert.match(productionServer, /visualCheckpointMode: url\.searchParams\.get\("visualCheckpoint"\) === "manual" \? "manual" : "auto"/);
  assert.match(productionTemplate, /可选表单暂停 · 修改视觉导演的文本输出/);
  assert.match(productionTemplate, /正式生成默认自动继续，不需要视觉模型/);
  assert.doesNotMatch(productionTemplate, /id="manual-checkpoint" type="checkbox" checked/);
  assert.match(productionTemplate, /data-delete-run/);
  assert.match(productionTemplate, /id="select-all-runs"/);
  assert.match(productionTemplate, /id="delete-selected-runs"/);
  assert.match(productionTemplate, /id="delete-all-runs"/);
  assert.match(productionTemplate, /不只删除左侧当前显示的记录/);
  assert.match(productionTemplate, /输入稿件副本、API 事件、所有中间记录、预览和交付文件都会永久删除/);
  assert.match(productionTemplate, /function viewSignature\(\)/);
  assert.match(productionTemplate, /if\(viewSignature\(\)!==lastViewSignature\)render\(\)/);
  assert.match(productionTemplate, /function captureReaderState\(\)/);
  assert.match(productionTemplate, /function restoreReaderState\(state\)/);
  assert.match(productionTemplate, /if\(isVisualCheckpointEditing\(\)\)return/);
  assert.match(productionTemplate, /if\(signature===lastReaderSignature\)return/);
  const script = productionTemplate.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});
