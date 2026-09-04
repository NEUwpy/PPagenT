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
import {
  buildFormalPageExpressionPlan,
  projectFormalPageContentBlocks,
} from "../src/visual-runtime/formal-page-expression.mjs";

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
  assert.match(productionServer, /nativeCheckpointMatch/);
  assert.match(productionServer, /nativePreviewCheckpointMode: url\.searchParams\.get\("nativePreviewCheckpoint"\) === "auto" \? "auto" : "manual"/);
  assert.match(productionServer, /request\.method === "DELETE"/);
  assert.match(productionServer, /\/api\/workbench\/runs\/batch-delete/);
  assert.match(productionServer, /value\?\.mode === "all-deletable"/);
  assert.match(productionServer, /await Promise\.all\(targets\.map/);
  assert.match(productionServer, /path\.dirname\(targetRunDir\) !== resolvedRunsRoot/);
  assert.match(productionServer, /fs\.rm\(targetRunDir, \{ recursive: true, force: false \}\)/);
  assert.match(productionServer, /function awaitingCheckpoint\(runId\)/);
  assert.match(productionServer, /await checkpoint\.cancel\(\)/);
  assert.match(productionServer, /if \(activeRunId === summary\.runId\) activeRunId = null/);
  assert.match(productionTemplate, /调试时暂停表单/);
  assert.match(productionServer, /visualCheckpointMode: url\.searchParams\.get\("visualCheckpoint"\) === "manual" \? "manual" : "auto"/);
  assert.match(productionTemplate, /可选表单暂停 · 修改视觉导演的结构化输出/);
  assert.match(productionTemplate, /正式生成默认自动继续/);
  assert.match(productionTemplate, /PPT 排版预览/);
  assert.match(productionTemplate, /确认并交付这份 PPT/);
  assert.match(productionTemplate, /不会再次排版或编译/);
  assert.doesNotMatch(productionTemplate, /id="manual-checkpoint" type="checkbox" checked/);
  assert.match(productionTemplate, /data-delete-run/);
  assert.match(productionTemplate, /id="select-all-runs"/);
  assert.match(productionTemplate, /id="new-task"/);
  assert.match(productionTemplate, /等待确认的任务会取消后删除/);
  assert.match(productionTemplate, /id="delete-selected-runs"/);
  assert.match(productionTemplate, /id="delete-all-runs"/);
  assert.match(productionTemplate, /不只删除左侧当前显示的记录/);
  assert.match(productionTemplate, /输入稿件副本、API 事件、所有中间记录、预览和交付文件都会永久删除/);
  assert.match(productionTemplate, /function viewSignature\(\)/);
  assert.match(productionTemplate, /if\(viewSignature\(\)!==lastViewSignature\)render\(\)/);
  assert.match(productionTemplate, /if\(signature!==lastRunListSignature\)/);
  assert.match(productionTemplate, /if\(pipelineMarkup!==lastPipelineSignature\)/);
  assert.match(productionTemplate, /if\(eventMarkup!==lastEventListSignature\)/);
  assert.match(productionTemplate, /if\(markup!==lastArtifactSignature\)/);
  assert.match(productionTemplate, /function captureReaderState\(\)/);
  assert.match(productionTemplate, /function restoreReaderState\(state\)/);
  assert.match(productionTemplate, /hadDocumentFocus:document\.hasFocus\(\)/);
  assert.match(productionTemplate, /state\.hadDocumentFocus&&document\.hasFocus\(\)/);
  assert.match(productionTemplate, /if\(isVisualCheckpointEditing\(\)\)return/);
  assert.match(productionTemplate, /if\(signature===lastReaderSignature\)return/);
  assert.match(productionTemplate, /const viewer=pageHrefs\.length\?/);
  assert.match(productionTemplate, /data-preview-page/);
  assert.match(productionTemplate, /id="preview-prev"/);
  assert.match(productionTemplate, /id="preview-next"/);
  assert.match(productionTemplate, /可直接在工作台内逐页查看/);
  const script = productionTemplate.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});

test("正式逐页稿可投影为多内容块，并接受视觉导演的块级结构选择", () => {
  const page = {
    pageId: "page-01",
    title: "复合系统",
    sourceText: "研学链、三类课堂和教学场景共同构成复合系统。",
    logicIntent: { logicId: "parallel", reason: "三个组成部分并列" },
    items: [
      { id: "chain", title: "研学链", body: "贯通基地", points: ["基地", "场馆", "教学点"], logicIntent: { logicId: "hierarchy", reason: "三级层次" } },
      { id: "classes", title: "三类课堂", body: "形成课堂形态", points: ["行走", "沉浸", "互动"] },
      { id: "scenes", title: "教学场景", body: "连接实践场景", points: ["校地", "校企", "校校"] },
    ],
  };
  const blocks = projectFormalPageContentBlocks(page, "同时说明系统主张与组成");
  assert.equal(blocks.coreMessage.markdown, "同时说明系统主张与组成");
  assert.doesNotMatch(blocks.coreMessage.markdown, /复合系统/);
  const plan = buildFormalPageExpressionPlan(blocks, [
    { sourceItemId: "chain", pattern: "chain" },
    { sourceItemId: "classes", pattern: "rail" },
  ]);
  const flattened = flattenExpressions(plan);
  assert.equal(validatePageExpressionPlan(blocks, plan).maximumStructureDepth, 2);
  assert.equal(flattened.find((item) => item.expression.expressionId === "structure-chain").expression.structure.structureGroupId, "prototype-chain-levels");
  assert.equal(flattened.find((item) => item.expression.expressionId === "structure-classes").expression.structure.structureGroupId, "prototype-parallel-scenes");
});
