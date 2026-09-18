import test from 'node:test';
import assert from 'node:assert/strict';
import { auditGeometry, voidWarnings, VOID_THRESHOLDS } from '../src/runner/gray-audit.mjs';

const item = (id, lines) => ({ id, kind: 'text', heading: '组', blocks: [{ id: `${id}-b`, text: '字'.repeat(lines * 25) }] });
const page = (pageId, regions) => ({
  pageId,
  items: regions.map(region => item(region.itemId, region.lines)),
  composition: { regions: regions.map(region => ({ itemId: region.itemId, x: 0, y: region.y ?? 0, width: 1138, height: region.height, fontSize: 22 })) },
});
const area = { width: 1170, height: 492 };

test('空洞指标：稀疏页与稀疏组触发 warn（非阻塞）', () => {
  const rows = auditGeometry([page('p1', [{ itemId: 'g1', height: 300, lines: 1 }])], area);
  assert.ok(rows[0].bottomVoid >= VOID_THRESHOLDS.bottomVoid, `bottomVoid=${rows[0].bottomVoid}`);
  assert.ok(rows[0].regions[0].voidRatio >= VOID_THRESHOLDS.regionVoid, `voidRatio=${rows[0].regions[0].voidRatio}`);
  const warnings = voidWarnings(rows);
  assert.deepEqual(warnings.map(warning => warning.code).sort(), ['page-bottom-void', 'region-void']);
  for (const warning of warnings) assert.ok(warning.message.includes('不阻塞'));
});

test('充实页不触发；小容器（available<160）即使空洞也不触发组 warn', () => {
  const denseRows = auditGeometry([page('p1', [{ itemId: 'g1', height: 438, lines: 20 }])], area);
  assert.ok(denseRows[0].bottomVoid < VOID_THRESHOLDS.bottomVoid, `bottomVoid=${denseRows[0].bottomVoid}`);
  assert.deepEqual(voidWarnings(denseRows), []);

  const smallRows = auditGeometry([page('p1', [{ itemId: 'g1', height: 225, lines: 1 }])], area);
  assert.ok(smallRows[0].regions[0].available < VOID_THRESHOLDS.regionMinAvailable);
  assert.ok(smallRows[0].regions[0].voidRatio >= VOID_THRESHOLDS.regionVoid);
  assert.ok(!voidWarnings(smallRows).map(warning => warning.code).includes('region-void'));
});
