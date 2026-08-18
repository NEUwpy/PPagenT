import assert from "node:assert/strict";
import test from "node:test";

import {
  assertResolvedTextContainerSlots,
  resolveTextContainerContract,
} from "../src/visual-runtime/text-container-contract.mjs";

test("容器制度默认把 points 合并进单一正文流", () => {
  assert.deepEqual(resolveTextContainerContract({}, { points: "optional" }), {
    pointRendering: "merged-body",
    bodyContainerMode: "single-flow",
    itemTitleRequired: false,
    itemBodyRequired: false,
    itemBodySourceField: "support",
    itemBodyTextMode: "flow",
    itemBodyListPolicy: "inline",
  });
  assert.equal(resolveTextContainerContract({}, { points: "forbidden" }).itemBodySourceField, "body");
});

test("默认制度拒绝独立分点槽和重复正文槽", () => {
  assert.throws(() => assertResolvedTextContainerSlots([
    { id: "p1", role: "item-point", itemId: "a" },
  ], {}, "测试组件"), /不能声明独立 item-point 槽/);
  assert.throws(() => assertResolvedTextContainerSlots([
    { id: "b1", role: "item-body", itemId: "a" },
    { id: "b2", role: "item-body", itemId: "a" },
  ], {}, "测试组件"), /一个完整正文容器/);
});

test("多个独立几何子槽必须双重显式声明", () => {
  assert.throws(() => resolveTextContainerContract({ pointRendering: "separate-slots" }), /fixed-regions/);
  const explicit = {
    pointRendering: "separate-slots",
    bodyContainerMode: "fixed-regions",
  };
  assert.doesNotThrow(() => assertResolvedTextContainerSlots([
    { id: "p1", role: "item-point", itemId: "a" },
    { id: "p2", role: "item-point", itemId: "a" },
  ], explicit, "固定子框组件"));
});
