import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  collectVisualSkillDashboardData,
} from "../src/tools/visual-skill-dashboard-data.mjs";
import {
  previewParameters,
  resolveContentSlots,
  resolvePreviewParameters,
  visualComponent,
} from "../assets/结构图/循环闭环-001/review.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("看板只把资产专属 HTML 计入迁移完成度", async () => {
  const data = await collectVisualSkillDashboardData(root);
  const cycle = data.records.find((record) => record.library === "core" && record.id === "cycle-loop-001");
  const sequence = data.records.find((record) => record.library === "core" && record.id === "sequential-process-001");

  assert.equal(cycle?.componentPreviewAvailable, true);
  assert.equal(cycle?.renderer, "html-component");
  assert.ok(cycle?.nativeStatePreviewUrl);
  assert.deepEqual(cycle?.runtimeCapabilities, ["html-component", "native-compiled-output"]);
  assert.equal(cycle?.nativeOutputAvailable, true);
  assert.equal(cycle?.slotContract?.resolverExport, "resolveContentSlots");
  assert.equal(cycle?.builderExport, "");
  assert.equal(cycle?.componentInitialSelection.stepCount, 4);
  assert.equal(sequence?.componentPreviewAvailable, false);
  assert.deepEqual(sequence?.runtimeCapabilities, ["native-builder"]);
  assert.equal(data.summary.htmlDesignComponents, 10);
});

test("首批八个既有资产已经改用 HTML 单源正式链路", async () => {
  const data = await collectVisualSkillDashboardData(root);
  const migratedIds = new Set([
    "comparison-structure-001", "framework-matrix-001", "swimlane-process-001",
    "hierarchy-pyramid-001", "layered-architecture-001", "organization-tree-001",
    "problem-improvement-001", "radial-hub-001",
  ]);
  const migrated = data.records.filter((record) => record.library === "core" && migratedIds.has(record.id));
  assert.equal(migrated.length, migratedIds.size);
  for (const record of migrated) {
    assert.equal(record.renderer, "html-component");
    assert.equal(record.componentImplementation, "asset-specific-html");
    assert.equal(record.builderExport, "");
    assert.ok(record.nativeStatePreviewUrl);
  }
});

test("循环 Style Group 暴露与 State 同步的可填充 Content Slots", () => {
  for (const stepCount of [3, 4, 5, 6]) {
    const parameters = resolvePreviewParameters(previewParameters, { stepCount });
    const slots = resolveContentSlots(parameters);
    assert.equal(slots.length, stepCount);
    for (const slot of slots) {
      assert.equal(slot.capacity.maxDepth, 1);
      assert.equal(slot.fallback, "plain-text");
      assert.ok(slot.frame.left >= 0 && slot.frame.top >= 0);
      assert.ok(slot.frame.left + slot.frame.width <= visualComponent.designFrame.width);
      assert.ok(slot.frame.top + slot.frame.height <= visualComponent.designFrame.height);
    }
  }
});

test("循环闭环由同一 HTML 组件解析 3–6 步状态", () => {
  for (const stepCount of [3, 4, 5, 6]) {
    const parameters = resolvePreviewParameters(previewParameters, { stepCount });
    const markup = visualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-step-count="${stepCount}"`));
    assert.equal((markup.match(/class="cycle-note"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/class="cycle-arc"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/data-content-slot-id=/g) ?? []).length, stepCount);
  }
});
