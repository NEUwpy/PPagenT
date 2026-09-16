// 方案结构的两条硬边界。它们都属于同一类缺陷：**渲染器只画得出第一条，多出来的被静默丢掉**，
// 页面上再也找不到，而蓝图上写着它——门禁却全报通过。
//
// 2026-09-13 R1 重跑真实命中过：`editorial-dual-statement` 的 `textSlots` 里 `right` 出现了两次
// （`{right:[reg]}` 与 `{right:[basis]}`），渲染器用 `.find()` 只认第一条，
// 「选择依据」整条从交付物里消失；`deckAudit`、逐页记账与 `--replay` 全部报通过。
// 另一半（一个区绑多条，渲染器取 `[0]`）还没被命中，但一样会丢件，一起关掉。
import test from "node:test";
import assert from "node:assert/strict";
import { planStructureIssues, singleItemSlotIds } from "../src/render/page-composition.mjs";

test("同一个区域被写进 textSlots 两次即拒绝：渲染器只认第一条，后写的整条会消失", () => {
  const issues = planStructureIssues("editorial-dual-statement", {
    textSlots: [
      { slotId: "left", sourceItemIds: ["a"] },
      { slotId: "right", sourceItemIds: ["b"] },
      { slotId: "right", sourceItemIds: ["c"] },
    ],
  });
  assert.deepEqual(issues.map((issue) => issue.code), ["duplicate-slot"]);
  assert.equal(issues[0].slotId, "right");
  assert.equal(issues[0].count, 2);
  // 消息要能直接照着改，不能只说"方案有问题"。
  assert.match(issues[0].message, /right/);
  assert.match(issues[0].message, /出现了 2 次/);
  assert.match(issues[0].message, /不会出现在页面上/);
});

test("只画一条的区域绑多条即拒绝，且按版式区分（single-focus 的 primary 吃得下多条）", () => {
  // 单条目区：lead / aside / left / right，以及 focus 系的 primary。
  assert.equal(singleItemSlotIds("editorial-list").includes("lead"), true);
  assert.deepEqual(singleItemSlotIds("editorial-dual-statement"), ["lead", "aside", "left", "right"]);
  assert.equal(singleItemSlotIds("editorial-focus").includes("primary"), true);
  // editorial-single-focus 的 primary 是主条 + 底部支持行，能吃多条，不能误伤。
  assert.equal(singleItemSlotIds("editorial-single-focus").includes("primary"), false);

  const overflow = planStructureIssues("editorial-dual-statement", {
    textSlots: [{ slotId: "right", sourceItemIds: ["b", "c"] }],
  });
  assert.deepEqual(overflow.map((issue) => issue.code), ["slot-capacity-exceeded"]);
  assert.equal(overflow[0].slotId, "right");
  assert.equal(overflow[0].count, 2);
  assert.match(overflow[0].message, /只画 1 条/);

  // 同一份 plan 绑进能吃多条的区，就不该报。
  assert.deepEqual(planStructureIssues("editorial-single-focus", {
    textSlots: [{ slotId: "primary", sourceItemIds: ["b", "c"] }],
  }), []);
});

test("合法方案一条都不报——否则这个闸门会变成噪声，模型每次都要绕它", () => {
  assert.deepEqual(planStructureIssues("editorial-list", { textSlots: [
    { slotId: "lead", sourceItemIds: ["a"] },
    { slotId: "body", sourceItemIds: ["b", "c", "d"] },
  ] }), []);
  assert.deepEqual(planStructureIssues("editorial-dual-statement", { textSlots: [
    { slotId: "left", sourceItemIds: ["a"] },
    { slotId: "right", sourceItemIds: ["b"] },
  ] }), []);
  // 空方案不报——"还没排"不是"排错了"，那由既有的 missing-composition 分支管。
  assert.deepEqual(planStructureIssues("editorial-list", { textSlots: [] }), []);
});
