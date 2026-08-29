import assert from "node:assert/strict";
import test from "node:test";

import { composeHierarchyPathMatrices } from "../src/content/hierarchy-matrix.mjs";
import { buildPageIntentFromContent, validateStructuredDataReferences } from "../src/content/page-content.mjs";
import { createRuleValidators } from "../src/selection/validation.mjs";

const item = (id, title = id, body = "说明") => ({ id, title, body });

test("递进逻辑区分成长路径、连续区间和离散等级", () => {
  const page = {
    schemaVersion: "1.0",
    pageId: "progression-page",
    title: "从恐惧到觉醒再到行动",
    sourceText: "最初选择沉默，逐渐看清责任，最终开始行动。",
    logicIntent: { logicId: "progression", reason: "人物状态逐渐成长" },
    items: [item("a", "恐惧"), item("b", "觉醒"), item("c", "行动")],
  };
  assert.equal(buildPageIntentFromContent(page).relationTraits.progressionMode, "growth-path");
  page.title = "需求复杂度连续分布";
  page.logicIntent.reason = "连续区间中间区域是主要需求";
  assert.equal(buildPageIntentFromContent(page).relationTraits.progressionMode, "continuous-spectrum");
  page.title = "能力成熟度等级";
  page.logicIntent.reason = "从当前级走向目标级";
  assert.equal(buildPageIntentFromContent(page).relationTraits.progressionMode, "discrete-levels");
});

test("结构化数据只接受完整且唯一的 PageContent 引用", () => {
  const problemSolution = {
    items: [item("p1", "问题一", "现状")],
    structuredData: {
      type: "problem-solution",
      pairs: [{ id: "p1", problem: { title: "问题一", body: "现状" }, solution: { title: "方案一", body: "改进" } }],
      outcome: { title: "结果", highlight: "", body: "" },
    },
  };
  assert.deepEqual(validateStructuredDataReferences(problemSolution), []);
  problemSolution.structuredData.pairs[0].problem.title = "另一问题";
  assert.ok(validateStructuredDataReferences(problemSolution).some((issue) => issue.code === "PAIR_ITEM_MIRROR_MISMATCH"));

  const matrix = {
    items: [item("a"), item("b")],
    structuredData: {
      type: "matrix",
      quadrants: [
        { id: "q1", itemIds: ["a"] },
        { id: "q2", itemIds: ["a"] },
        { id: "q3", itemIds: ["unknown"] },
        { id: "q4", itemIds: ["b"] },
      ],
    },
  };
  const matrixIssues = validateStructuredDataReferences(matrix);
  assert.ok(matrixIssues.some((issue) => issue.code === "DUPLICATE_REFERENCE"));
  assert.ok(matrixIssues.some((issue) => issue.code === "UNKNOWN_ITEM_REFERENCE"));

  const convergence = {
    items: [item("s1"), item("s2")],
    structuredData: {
      type: "convergence",
      inputs: [{ id: "i1" }],
      phases: [{ id: "phase-1", stepIds: ["s1"] }],
    },
  };
  assert.ok(validateStructuredDataReferences(convergence).some((issue) => (
    issue.code === "UNASSIGNED_ITEM" && issue.ids.includes("s2")
  )));

  const branching = {
    items: [item("route-a"), item("route-b")],
    structuredData: {
      type: "branching-decision",
      context: { title: "输入", body: "" },
      decision: { title: "是否满足条件" },
      branches: [
        { id: "route-a", condition: "满足" },
        { id: "unknown", condition: "不满足" },
      ],
    },
  };
  const branchingIssues = validateStructuredDataReferences(branching);
  assert.ok(branchingIssues.some((issue) => issue.code === "UNKNOWN_ITEM_REFERENCE"));
  assert.ok(branchingIssues.some((issue) => issue.code === "UNASSIGNED_ITEM"));

  const scenario = {
    items: [item("stable"), item("growth"), item("shortage")],
    structuredData: {
      type: "branching-scenario",
      assumption: "外部需求存在不确定性",
      scenarios: [
        { id: "stable", trigger: "需求稳定", outcome: "持续复用" },
        { id: "growth", trigger: "需求增长", outcome: "扩充资产" },
        { id: "shortage", trigger: "结构短缺", outcome: "降级排版" },
      ],
    },
  };
  assert.deepEqual(validateStructuredDataReferences(scenario), []);
  scenario.structuredData.scenarios[2].id = "unknown";
  const scenarioIssues = validateStructuredDataReferences(scenario);
  assert.ok(scenarioIssues.some((issue) => issue.code === "UNKNOWN_ITEM_REFERENCE"));
  assert.ok(scenarioIssues.some((issue) => issue.code === "UNASSIGNED_ITEM"));

  const network = {
    items: [item("internal-a"), item("internal-b"), item("external-a"), item("external-b")],
    structuredData: {
      type: "internal-external-ecosystem",
      internalIds: ["internal-a", "internal-b"],
      externalIds: ["external-a", "external-b"],
      links: [
        { from: "internal-a", to: "internal-b" },
        { from: "external-a", to: "external-b" },
        { from: "internal-b", to: "external-a" },
      ],
    },
  };
  assert.deepEqual(validateStructuredDataReferences(network), []);
  network.structuredData.links.push({ from: "missing", to: "external-b" });
  assert.ok(validateStructuredDataReferences(network).some((issue) => issue.code === "UNKNOWN_ITEM_REFERENCE"));

  const tieredHub = {
    items: [item("inner-a"), item("inner-b"), item("inner-c"), item("outer-a"), item("outer-b"), item("outer-c")],
    structuredData: {
      type: "hub-tiered-ecosystem",
      center: { title: "共同中心", body: "" },
      innerIds: ["inner-a", "inner-b", "inner-c"],
      outerIds: ["outer-a", "outer-b", "outer-c"],
    },
  };
  assert.deepEqual(validateStructuredDataReferences(tieredHub), []);
  tieredHub.structuredData.outerIds[2] = "inner-a";
  const tieredHubIssues = validateStructuredDataReferences(tieredHub);
  assert.ok(tieredHubIssues.some((issue) => issue.code === "DUPLICATE_REFERENCE"));
  assert.ok(tieredHubIssues.some((issue) => issue.code === "UNASSIGNED_ITEM"));
});

test("层级内容用节点层和相邻关系矩阵表达，并以布尔乘法派生跨层路径", async () => {
  const pageContent = {
    schemaVersion: "1.0",
    pageId: "hierarchy-matrix-page",
    title: "层级矩阵",
    items: [],
    structuredData: {
      type: "hierarchy",
      layers: [
        [{ id: "root", label: "总体体系" }],
        [{ id: "a", label: "分支甲" }, { id: "b", label: "分支乙" }],
        [{ id: "result", label: "后续节点" }],
      ],
      adjacency: [
        [[1, 1]],
        [[0], [1]],
      ],
    },
  };
  const validators = await createRuleValidators();
  assert.equal(validators.validatePageContent(pageContent), true);
  assert.deepEqual(validateStructuredDataReferences(pageContent), []);
  assert.deepEqual(composeHierarchyPathMatrices(pageContent.structuredData.adjacency), [
    [[1, 1]],
    [[1]],
  ]);
  const intent = buildPageIntentFromContent(pageContent);
  assert.equal(intent.structure.itemCount, 2);
  assert.equal(intent.structure.hierarchyDepth, 3);
  assert.equal(intent.structure.dimensions.levels, 3);
  assert.equal(intent.contentStats.maxItemTitleChars, 4);

  pageContent.structuredData.adjacency[1] = [[1], [1]];
  assert.ok(validateStructuredDataReferences(pageContent).some((issue) => issue.code === "INVALID_HIERARCHY_PARENT_COUNT"));
});

test("行列交叉矩阵提交完整二维单元表，而不是为每种表格复制结构", async () => {
  const pageContent = {
    schemaVersion: "1.0",
    pageId: "matrix-grid-page",
    title: "任务角色交叉关系",
    items: [
      { id: "task-a", title: "任务甲", body: "", points: [], emphasis: false },
      { id: "task-b", title: "任务乙", body: "", points: [], emphasis: false },
    ],
    structuredData: {
      type: "matrix-grid",
      cellMode: "marker",
      cornerLabel: "任务 × 角色",
      rows: [
        { id: "row-a", label: "任务甲", itemId: "task-a" },
        { id: "row-b", label: "任务乙", itemId: "task-b" },
      ],
      columns: [
        { id: "role-a", label: "角色甲" },
        { id: "role-b", label: "角色乙" },
      ],
      cells: [
        { rowId: "row-a", columnId: "role-a", marker: "R" },
        { rowId: "row-a", columnId: "role-b", marker: "A" },
        { rowId: "row-b", columnId: "role-a", marker: "C" },
        { rowId: "row-b", columnId: "role-b", marker: "R" },
      ],
    },
  };
  const validators = await createRuleValidators();
  assert.equal(validators.validatePageContent(pageContent), true);
  assert.deepEqual(validateStructuredDataReferences(pageContent), []);
  assert.equal(buildPageIntentFromContent(pageContent).baseRelation, "matrix");

  pageContent.structuredData.cells.pop();
  assert.ok(validateStructuredDataReferences(pageContent).some((issue) => issue.code === "MISSING_MATRIX_CELL"));
});
