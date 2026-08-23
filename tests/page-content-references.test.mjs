import assert from "node:assert/strict";
import test from "node:test";

import { validateStructuredDataReferences } from "../src/content/page-content.mjs";

const item = (id, title = id, body = "说明") => ({ id, title, body });

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
});
