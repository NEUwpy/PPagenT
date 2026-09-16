// 页面层级忠实于原稿关系：比较准则不得被画成并列对象，贯穿全程的规则不得被编号成步骤。
// 这里测的是**分带的纯几何与纯文本**（无引擎、无渲染）。
// 真正"画出来了没有"由 tests/runner-build-tools.test.mjs 的真实构建用例确认。
import test from "node:test";
import assert from "node:assert/strict";
import {
  BAND_ROLES, splitByRole, splitRegionFrame, roleBandText, applySlotPlacement, planStructureIssues, withoutRepeatedLabel,
} from "../src/render/page-composition.mjs";

test("只有准则与全程规则被抽成带，其余角色留在主区编号", () => {
  assert.deepEqual([...BAND_ROLES].sort(), ["criterion", "global"]);
  const items = [
    { id: "a", role: "object" },
    { id: "b", role: "criterion" },
    { id: "c", role: "step" },
    { id: "d", role: "global" },
    { id: "e" },
  ];
  const { main, band } = splitByRole(items);
  assert.deepEqual(main.map((item) => item.id), ["a", "c", "e"]);
  assert.deepEqual(band.map((item) => item.id), ["b", "d"]);
});

test("新方案只消除独立标题与正文精确重复的前缀，正文单独显示和历史回放保留原文", () => {
  const item = { title: "记录完整", body: "记录完整：检查登记信息" };
  assert.equal(withoutRepeatedLabel(item, { bandItemIds: [] }).body, "检查登记信息");
  assert.equal(withoutRepeatedLabel(item, { bandItemIds: [], contentMode: "body" }).body, item.body);
  assert.equal(withoutRepeatedLabel(item, {}).body, item.body);
  assert.equal(item.body, "记录完整：检查登记信息");
});

test("同一种准则语义可以是清单主体或比较页辅助，位置由方案决定", () => {
  const items = [{ id: "a", role: "criterion" }, { id: "b", role: "criterion" }, { id: "c", role: "criterion" }];
  const main = splitByRole(items.map(item => applySlotPlacement(item, { bandItemIds: [] })));
  assert.deepEqual(main.main.map(item => item.id), ["a", "b", "c"]);
  assert.deepEqual(main.band, []);
  const comparison = splitByRole(items.map(item => applySlotPlacement(item, { bandItemIds: ["c"] })));
  assert.deepEqual(comparison.main.map(item => item.id), ["a", "b"]);
  assert.deepEqual(comparison.band.map(item => item.id), ["c"]);
});

test("显式辅助带不能吞掉整个主区，也不能引用其他区域或不支持的槽位", () => {
  const issues = (bandItemIds, slotId = "body", compositionId = "editorial-grid") => planStructureIssues(compositionId, {
    textSlots: [{ slotId, sourceItemIds: ["a", "b"], bandItemIds }],
  }).map(issue => issue.code);
  assert.deepEqual(issues(["a", "b"]), ["empty-main-region"]);
  assert.deepEqual(issues(["other"]), ["invalid-band-items"]);
  assert.deepEqual(issues(["a", "a"]), ["invalid-band-items"]);
  assert.deepEqual(issues(["a"], "primary", "editorial-single-focus"), ["unsupported-band"]);
  assert.deepEqual(issues([]), []);
  assert.deepEqual(issues(["b"]), []);
});

// 这条是硬边界：历史 state 里根本没有 role 字段，改动不得动到它们的渲染。
test("角色缺省时主区帧与条目逐字不变，且不产生带", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(splitByRole(items), { main: items, band: [] });

  const frame = { left: 100, top: 200, width: 1000, height: 400 };
  const split = splitRegionFrame(frame, 0);
  // 必须是**同一个对象**（不是等值的新对象）：任何一像素的偏移都会让历史运行的蓝图哈希变化。
  assert.equal(split.mainFrame, frame);
  assert.equal(split.bandFrame, null);
});

test("有带时主区让出带高与间距，带贴在区域底部且不越出区域", () => {
  const frame = { left: 100, top: 200, width: 1000, height: 400 };
  const { mainFrame, bandFrame } = splitRegionFrame(frame, 1);
  assert.ok(mainFrame.height < frame.height, "主区必须让出带的位置");
  assert.equal(mainFrame.left, frame.left);
  assert.equal(mainFrame.width, frame.width);
  assert.equal(bandFrame.top + bandFrame.height, frame.top + frame.height, "带必须贴住区域底边");
  assert.ok(mainFrame.top + mainFrame.height <= bandFrame.top, "主区与带不得重叠（同一碰撞域会被几何审计判重叠）");
  assert.ok(bandFrame.left >= frame.left && bandFrame.left + bandFrame.width <= frame.left + frame.width);
  // 带高有上下限：太矮排不下、太高会吃掉主区。
  assert.equal(splitRegionFrame({ ...frame, height: 2000 }, 1).bandFrame.height, 132);
  assert.equal(splitRegionFrame({ ...frame, height: 100 }, 1).bandFrame.height, 84);
});

test("带的正文用条目自己的短标签，且从头到尾没有序号", () => {
  const text = roleBandText([
    { title: "选择依据", body: "试点优先验证交接是否清楚" },
    { title: "异常处理", body: "适用于整个预约过程" },
  ]);
  assert.deepEqual(text.split("\n"), [
    "选择依据：试点优先验证交接是否清楚",
    "异常处理：适用于整个预约过程",
  ]);
  // 编号是主区专有的：带上出现"01/02"就等于又把准则编成了第 N 个对象。
  assert.equal(/\b0\d\b/u.test(text), false);
  assert.equal(roleBandText([]), "");
});
