import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { newProject, upsertBriefs, replaceBriefs, validateContent, validateComposition, occupancy, layoutFeedback, skillCatalog, GRID } from "./grid-project.mjs";
const catalog = await skillCatalog(path.resolve(import.meta.dirname, "../.."));
const makePage = () => ({ pageId: "p1", title: "说明", claim: "说明", relation: "none", items: [{ id: "i1", sourceIds: ["s1"], sourceText: "登记需求：申请人登记设备和时间。" }, { id: "i2", sourceIds: ["s2"], sourceText: "确认安排：管理员确认后再通知。" }] });
const region = (id, sourceItemId, x = 0) => ({ id, x, y: 1, w: 11, h: 9, skillId: "text/basic", view: [{ sourceItemId, title: "", body: sourceItemId === "i1" ? "申请人登记设备和时间。" : "管理员确认后再通知。" }] });
test("来源漏项阻断冻结；同页修订失效产物且保持其他页面", () => {
  let p = newProject("# 标题\n\n来源甲\n\n来源乙", "test"); p.deckBrief = { title: "试稿" };
  p = upsertBriefs(p, [{ pageId: "p1", items: [{ id: "i1", sourceIds: ["s1"] }] }]);
  assert.equal(validateContent(p).accepted, false);
  p = upsertBriefs(p, [{ pageId: "p2", items: [{ id: "i2", sourceIds: ["s2"] }] }]);
  p.artifactState = { p1: { status: "passed" }, p2: { status: "passed" } };
  p = upsertBriefs(p, [{ pageId: "p1", items: [{ id: "i1", sourceIds: ["s1"] }] }]);
  assert.equal(validateContent(p).accepted, true); assert.equal(p.artifactState.p1, undefined); assert.equal(p.artifactState.p2.status, "passed");
  p.phase = "visual"; assert.throws(() => upsertBriefs(p, []), /冻结/);
});
test("来源适配、区域碰撞和漏项分别报错", () => {
  const page = makePage();
  const plan = { alignment: "left", regions: [region("a", "i1"), region("b", "i2", 12)] };
  assert.equal(validateComposition(page, plan, catalog).accepted, true);
  plan.regions[1].x = 5;
  assert.ok(validateComposition(page, plan, catalog).issues.some((i) => i.code === "region-overlap"));
  plan.regions[0].view[0].body = "申请自动批准";
  assert.ok(validateComposition(page, plan, catalog).issues.some((i) => i.code === "non-extractive-view"));
  plan.regions.pop(); assert.ok(validateComposition(page, plan, catalog).issues.some((i) => i.code === "missing-item-view"));
});
test("空框不能伪装内容密度，最大空矩形定位可解释", () => {
  const whole = { ...GRID.frame };
  assert.equal(occupancy([whole]).occupiedCellRatio, 1);
  const page = makePage(), plan = { regions: [region("a", "i1")] };
  const feedback = layoutFeedback({ elements: [] }, page, plan);
  assert.equal(feedback.textOccupancyEstimate.occupiedCellRatio, 0);
  assert.equal(feedback.textOccupancyEstimate.largestEmptyRectangle.ratio, 1);
  assert.ok(feedback.regionAllocation.occupiedCellRatio > 0);
  assert.equal(feedback.accepted, false);
});
test("定向内容重组守住来源集合与无关页产物", () => {
  let p = newProject("# 稿件\n\n甲\n\n乙\n\n丙", "test");
  p = upsertBriefs(p, [1, 2, 3].map((n) => ({ pageId: `p${n}`, items: [{ id: `i${n}`, sourceIds: [`s${n}`] }] })));
  p.phase = "content-revision"; p.contentRevision = { pageIds: ["p2", "p3"] }; p.artifactState.p1 = { status: "passed" };
  assert.throws(() => replaceBriefs(p, ["p2", "p3"], [{ pageId: "merged", items: [{ id: "i2", sourceIds: ["s2"] }] }]), /全部来源/);
  const q = replaceBriefs(p, ["p2", "p3"], [{ pageId: "merged", items: [{ id: "i2", sourceIds: ["s2"] }, { id: "i3", sourceIds: ["s3"] }] }]);
  assert.deepEqual(q.pages.map((v) => v.pageId), ["p1", "merged"]); assert.deepEqual(q.artifactState.p1, p.artifactState.p1); assert.equal(q.contentRevision.applied, true);
});
test("结构语义和自然尺寸不能被网格绕过", () => {
  const page = makePage();
  const plan = { alignment: "left", regions: [{ ...region("a", "i1"), skillId: "sequence-flow-001" }] };
  const issues = validateComposition(page, plan, catalog).issues.map((i) => i.code);
  assert.ok(issues.includes("structure-semantic-mismatch")); assert.ok(issues.includes("structure-frame-too-small"));
});
test("Native 越界及正文对齐变化会阻断，编号锚点有独立契约", () => {
  const page = makePage(), plan = { regions: [region("a", "i1")] };
  const e = { name: "grid:a:i1:body", text: "正文", bbox: [30, 180, 400, 90], resolvedFontSize: 20, resolvedTextStyle: { alignment: "center" } };
  const f = layoutFeedback({ elements: [e] }, page, plan);
  assert.ok(f.issues.some((i) => i.code === "native-text-outside")); assert.ok(f.issues.some((i) => i.code === "native-alignment-mismatch"));
});
