import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTablerIcon,
  tablerIconCount,
  tablerIconSvgMarkup,
} from "../src/icons/tabler-icon-resolver.mjs";

test("Tabler 图标使用官方本地元数据做确定性 Top 1 匹配", () => {
  assert.ok(tablerIconCount() > 5000);
  const first = resolveTablerIcon("bulb idea");
  const second = resolveTablerIcon("bulb idea");
  assert.equal(first?.key, "bulb");
  assert.deepEqual(second, first);
  assert.match(tablerIconSvgMarkup(first), /data-ppt-kind="image"/);
  assert.match(tablerIconSvgMarkup(first), /data-icon-key="bulb"/);
});

test("空查询不伪造图标", () => {
  assert.equal(resolveTablerIcon(""), null);
  assert.equal(resolveTablerIcon("中文无英文索引"), null);
});
