import assert from "node:assert/strict";
import test from "node:test";
import { resolveCatalogLayout } from "../备选资产/目录/目录卡片组-001/layout-contract.mjs";
import { validateCatalogItems } from "../备选资产/目录/目录卡片组-001/generate.mjs";

test("候选目录标签组件连续支持 3–7 项", () => {
  for (const count of [3, 4, 5, 6, 7]) {
    const layout = resolveCatalogLayout(count);
    assert.equal(layout.frames.length, count);
    assert.equal(layout.rowCounts.reduce((sum, value) => sum + value, 0), count);
  }
  assert.deepEqual(resolveCatalogLayout(7).rowCounts, [4, 3]);
});

test("候选目录标签组件拒绝越界数量与超长标题", () => {
  assert.throws(() => resolveCatalogLayout(2), /3–7/);
  assert.throws(() => resolveCatalogLayout(8), /3–7/);
  assert.throws(() => validateCatalogItems([
    { title: "这是一个明显超过十个汉字的目录标题" },
    { title: "第二项" },
    { title: "第三项" },
  ]), /10 个汉字/);
});
