import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  collectVisualSkillDashboardData,
} from "../src/tools/visual-skill-dashboard-data.mjs";
import {
  previewParameters,
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
  assert.equal(cycle?.builderExport, "");
  assert.equal(cycle?.componentInitialSelection.stepCount, 4);
  assert.equal(sequence?.componentPreviewAvailable, false);
  assert.deepEqual(sequence?.runtimeCapabilities, ["native-builder"]);
  assert.equal(data.summary.htmlDesignComponents, 2);
});

test("循环闭环由同一 HTML 组件解析 3–6 步状态", () => {
  for (const stepCount of [3, 4, 5, 6]) {
    const parameters = resolvePreviewParameters(previewParameters, { stepCount });
    const markup = visualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-step-count="${stepCount}"`));
    assert.equal((markup.match(/class="cycle-note"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/class="cycle-arc"/g) ?? []).length, stepCount);
  }
});
