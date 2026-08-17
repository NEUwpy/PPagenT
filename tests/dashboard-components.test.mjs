import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import path from "node:path";

import {
  collectLogicDashboardData,
} from "../src/tools/logic-dashboard-data.mjs";
import {
  previewParameters,
  resolveContentSlots,
  resolvePreviewParameters,
  visualComponent,
} from "../assets/结构图/循环闭环-001/review.mjs";
import {
  previewParameters as parallelPreviewParameters,
  resolvePreviewParameters as resolveParallelPreviewParameters,
  visualComponent as parallelVisualComponent,
} from "../备选资产/结构图/等权并列卡片-001/review.mjs";
import { mapPageContent as mapParallelPageContent } from "../备选资产/结构图/等权并列卡片-001/generate.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("看板只把资产专属 HTML 计入迁移完成度", async () => {
  const data = await collectLogicDashboardData(root);
  const cycle = data.records.find((record) => record.library === "core" && record.id === "cycle-loop-001");

  assert.equal(cycle?.componentPreviewAvailable, true);
  assert.equal(cycle?.renderer, "html-component");
  assert.ok(cycle?.nativeStatePreviewUrl);
  assert.ok(cycle?.nativeStatePptxUrl);
  assert.ok(cycle?.skinStatePreviewUrl);
  assert.equal("skinStatePptxUrl" in cycle, false);
  assert.match(cycle?.visualIntentText ?? "", /逻辑|循环/);
  assert.ok(cycle?.componentModel?.fixed?.length);
  assert.ok(cycle?.componentModel?.variable?.length);
  assert.ok(cycle?.fieldContract?.editable?.some((item) => item.field === "steps[].title"));
  assert.deepEqual(cycle?.stateFootprints?.["4"], {
    width: 1170,
    height: 492,
    basis: "component-root",
  });
  assert.deepEqual(cycle?.runtimeCapabilities, ["html-component", "native-compiled-output"]);
  assert.equal(cycle?.nativeOutputAvailable, true);
  assert.equal(cycle?.slotContract?.resolverExport, "resolveContentSlots");
  assert.equal(data.activeSkin?.componentTheme?.typography?.componentBody, 19);
  assert.equal(data.activeSkin?.pptPointScale, 0.75);
  assert.equal(cycle?.builderExport, "");
  assert.equal(cycle?.componentInitialSelection.stepCount, 4);
  assert.equal(data.summary.htmlDesignComponents, 1);
  assert.match(cycle?.previewUrl ?? "", /[?&]v=\d+/);
  assert.match(cycle?.componentPreviewUrl ?? "", /[?&]v=\d+/);
  assert.match(cycle?.nativeStatePreviewUrl ?? "", /[?&]v=\d+/);
  assert.match(cycle?.skinStatePreviewUrl ?? "", /[?&]v=\d+/);
});

test("预览使用版本化长期缓存，主数据仍保持实时", async () => {
  const server = await fs.readFile(path.join(root, "src/tools/serve-logic-dashboard.mjs"), "utf8");
  assert.match(server, /max-age=31536000, immutable/);
  assert.match(server, /fetch\("\/api\/dashboard-data", \{ cache: "no-store" \}\)/);
});

test("看板字号缺失时显示未读取而不是 NaN", async () => {
  const template = await fs.readFile(path.join(root, "src/tools/templates/logic-dashboard.html"), "utf8");
  assert.match(template, /Number\.isFinite\(designSize\)/);
  assert.match(template, /<code>未读取<\/code>/);
});

test("看板 EXE 每次启动都会重启旧服务并使用新地址打开", async () => {
  const launcher = await fs.readFile(path.join(root, "src/launcher/ppa-dashboard-main.cjs"), "utf8");
  assert.match(launcher, /await stopExistingDashboards\(root\)/);
  assert.match(launcher, /process\.kill\(health\.pid\)/);
  assert.match(launcher, /\?launch=\$\{Date\.now\(\)\}/);
});

test("作废的旧 Logic 不再出现在核心库或正式生成候选中", async () => {
  const data = await collectLogicDashboardData(root);
  const removedIds = new Set([
    "comparison-structure-001", "framework-matrix-001", "swimlane-process-001",
    "hierarchy-pyramid-001", "layered-architecture-001", "organization-tree-001",
    "problem-improvement-001", "radial-hub-001", "timeline-roadmap-001",
    "funnel-conversion-001", "sequential-process-001", "fishbone-analysis-001",
  ]);
  assert.equal(data.records.some((record) => removedIds.has(record.id)), false);
  const formalIds = new Set(data.formalLogics.map((record) => record.id));
  assert.deepEqual([...formalIds], ["cycle-loop-001"]);
});

test("Logic 能力地图保留空槽位，只把合格资产填入对应位置", async () => {
  const data = await collectLogicDashboardData(root);
  assert.equal(data.logics.length, 20);
  assert.equal(data.summary.logicSlots, 20);
  assert.equal(data.summary.logicFilled, 1);

  const cycle = data.logics.find((logic) => logic.id === "cycle");
  assert.deepEqual(cycle?.assetIds, ["cycle-loop-001"]);
  assert.equal(cycle?.status, "available");

  const hierarchy = data.logics.find((logic) => logic.id === "hierarchy");
  assert.deepEqual(hierarchy?.assetIds, []);
  assert.equal(hierarchy?.status, "empty");
  assert.match(hierarchy?.description ?? "", /上下级|归属/);
});

test("循环 Structure Group 暴露与 State 同步的可填充 Content Slots", () => {
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
    assert.equal((markup.match(/data-slot-role="center-title"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/data-slot-role="item-body"/g) ?? []).length, stepCount);
    assert.ok((markup.match(/data-slot-role="item-point"/g) ?? []).length >= stepCount);
    assert.equal((markup.match(/data-slot-max-chars=/g) ?? []).length, 1 + stepCount * 2 + (markup.match(/data-slot-role="item-point"/g) ?? []).length);
  }
});

test("看板从当前 HTML State 自动生成容器表并复用到 Native 和 Skin", async () => {
  const template = await fs.readFile(path.join(root, "src/tools/templates/logic-dashboard.html"), "utf8");
  assert.match(template, /readComponentSlotMap/);
  assert.match(template, /data-slot-map-list/);
  assert.match(template, /data-slot-overlay/);
  assert.match(template, /slotMaxChars/);
  assert.match(template, /slotProvider/);
  assert.match(template, /悬停查看可编辑容器/);
});

test("等权并列卡片由同一 HTML 组件重新排布 3–5 项状态", () => {
  for (const itemCount of [3, 4, 5]) {
    const parameters = resolveParallelPreviewParameters(parallelPreviewParameters, { itemCount });
    const markup = parallelVisualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-item-count="${itemCount}"`));
    assert.equal((markup.match(/class="parallel-card"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="icon"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="item-body"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-required="true"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-max-lines="4"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-icon-key=/g) ?? []).length, itemCount);
  }
});

test("待审批并列组件已接通 Native 与东北大学主题预览，但不进入正式能力地图", async () => {
  const data = await collectLogicDashboardData(root);
  const candidate = data.records.find((record) => record.library === "candidate" && record.id === "parallel-equal-cards-001");
  assert.equal(candidate?.status, "candidate");
  assert.deepEqual(candidate?.componentStates, [3, 4, 5]);
  assert.ok(candidate?.nativeStatePreviewUrl);
  assert.ok(candidate?.nativeStatePptxUrl);
  assert.ok(candidate?.skinStatePreviewUrl);
  assert.equal(candidate?.logicId, "parallel");
  assert.equal(candidate?.mediaContract?.mode, "semantic-icon");
  assert.equal(data.activeSkin?.slots?.contentFrame?.width, 1170);
  assert.equal(data.formalLogics.some((record) => record.id === "parallel-equal-cards-001"), false);
});

test("并列 Mapper 接收视觉导演语义查询，但不让导演指定图标文件", () => {
  const content = {
    title: "四项能力",
    items: [
      { id: "a", title: "专业能力", body: "解决复杂任务" },
      { id: "b", title: "协同能力", body: "整合人员资源" },
      { id: "c", title: "创新能力", body: "提出新的思路" },
    ],
  };
  const payload = mapParallelPageContent(content, { intentId: "parallel-intent" }, null, null, {
    iconQueries: [
      { sourceItemId: "a", query: "tool professional" },
      { sourceItemId: "b", query: "users group" },
      { sourceItemId: "c", query: "bulb idea" },
    ],
  });
  assert.deepEqual(payload.parameters.items.map((item) => item.iconQuery), [
    "tool professional", "users group", "bulb idea",
  ]);
  assert.equal(payload.parameters.items.some((item) => "iconKey" in item), false);
});
