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
} from "../assets/结构图/等权并列卡片-001/review.mjs";
import { mapPageContent as mapParallelPageContent } from "../assets/结构图/等权并列卡片-001/runtime.mjs";
import {
  previewParameters as sequencePreviewParameters,
  resolvePreviewParameters as resolveSequencePreviewParameters,
  visualComponent as sequenceVisualComponent,
} from "../assets/结构图/顺序流程-001/review.mjs";
import {
  previewParameters as fishbonePreviewParameters,
  resolvePreviewParameters as resolveFishbonePreviewParameters,
  visualComponent as fishboneVisualComponent,
} from "../assets/结构图/鱼骨归因-001/review.mjs";
import { mapPageContent as mapFishbonePageContent } from "../assets/结构图/鱼骨归因-001/runtime.mjs";
import {
  previewParameters as problemSolutionPreviewParameters,
  resolvePreviewParameters as resolveProblemSolutionPreviewParameters,
  visualComponent as problemSolutionVisualComponent,
} from "../assets/结构图/问题方案结果-001/review.mjs";
import { mapPageContent as mapProblemSolutionPageContent } from "../assets/结构图/问题方案结果-001/runtime.mjs";
import {
  previewParameters as matrixPreviewParameters,
  resolvePreviewParameters as resolveMatrixPreviewParameters,
  visualComponent as matrixVisualComponent,
} from "../assets/结构图/矩阵象限-001/review.mjs";
import { mapPageContent as mapMatrixPageContent } from "../assets/结构图/矩阵象限-001/runtime.mjs";
import { mapPageContent as mapIntersectionPageContent } from "../assets/结构图/多集合交集-001/runtime.mjs";
import { mapPageContent as mapNetworkPageContent } from "../assets/结构图/关系生态网络-001/runtime.mjs";

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
  assert.equal(data.activeSkin?.componentTheme?.typography?.componentBody, 14);
  assert.equal(data.activeSkin?.typographyUnit, "ppt-pt");
  assert.equal(data.activeSkin?.pptPointScale, 1);
  assert.deepEqual(data.textLayouts.map((item) => item.id), [
    "statement-flow",
    "heading-content-flow",
    "label-content-flow",
    "structured-list-flow",
    "metric-content-flow",
    "metric-set-flow",
    "key-value-flow",
    "quote-attribution-flow",
    "heading-metric-content-flow",
    "summary-information-flow",
  ]);
  assert.equal(data.textPrimitives.length, 8);
  assert.equal(data.summary.textLayouts, 10);
  assert.equal(data.summary.textPrimitives, 8);
  assert.match(data.textLayoutCss, /\.ppagent-text-layout/);
  assert.ok(data.textLayouts.every((layout) => (
    layout.previews.length === 3
    && layout.previews[0].id === "minimum"
    && layout.previews[0].frame.width === layout.minimumFrame.width
    && layout.previews[0].frame.height === layout.minimumFrame.height
    && layout.previews.every((preview) => /data-ppagent-text-region/.test(preview.markup))
  )));
  assert.equal(cycle?.builderExport, "");
  assert.equal(cycle?.componentInitialSelection.stepCount, 4);
  assert.equal(data.summary.htmlDesignComponents, 25);
  assert.match(cycle?.previewUrl ?? "", /[?&]v=\d+/);
  assert.match(cycle?.componentPreviewUrl ?? "", /[?&]v=\d+/);
  assert.match(cycle?.nativeStatePreviewUrl ?? "", /[?&]v=\d+/);
  assert.match(cycle?.skinStatePreviewUrl ?? "", /[?&]v=\d+/);
});

test("鱼骨、问题方案结果与矩阵象限均进入正式生成线", async () => {
  const data = await collectLogicDashboardData(root);
  const fishbone = data.records.find((item) => item.id === "causal-fishbone-attribution-001");
  assert.equal(fishbone?.status, "core");
  assert.equal(fishbone?.logicId, "causal");
  assert.equal(fishbone?.componentPreviewAvailable, true);
  assert.equal(fishbone?.componentFidelityStatus, "user-approved");
  assert.equal(fishbone?.componentExport, "fishboneVisualComponent");
  assert.equal(fishbone?.autoCallable, true);
  assert.ok(fishbone?.nativeStatePreviewUrl);
  assert.ok(fishbone?.skinStatePreviewUrl);

  const problemSolution = data.records.find((item) => item.id === "problem-solution-outcome-001");
  assert.equal(problemSolution?.status, "core");
  assert.equal(problemSolution?.logicId, "problem-solution");
  assert.equal(problemSolution?.componentFidelityStatus, "user-approved");
  assert.equal(problemSolution?.componentExport, "problemSolutionVisualComponent");
  assert.equal(problemSolution?.autoCallable, true);
  assert.ok(problemSolution?.nativeStatePreviewUrl);
  assert.ok(problemSolution?.skinStatePreviewUrl);

  const matrix = data.records.find((item) => item.id === "matrix-quadrant-priority-001");
  assert.equal(matrix?.status, "core");
  assert.equal(matrix?.logicId, "matrix");
  assert.equal(matrix?.componentPreviewAvailable, true);
  assert.equal(matrix?.componentFidelityStatus, "user-approved");
  assert.equal(matrix?.componentExport, "matrixQuadrantVisualComponent");
  assert.equal(matrix?.autoCallable, true);
  assert.ok(matrix?.nativeStatePreviewUrl);
  assert.ok(matrix?.skinStatePreviewUrl);
  assert.equal(data.pendingApproval.some((item) => item.id === "matrix-quadrant-priority-001"), false);
});

test("预览使用版本化长期缓存，主数据仍保持实时", async () => {
  const server = await fs.readFile(path.join(root, "src/tools/serve-logic-dashboard.mjs"), "utf8");
  const dataCollector = await fs.readFile(path.join(root, "src/tools/logic-dashboard-data.mjs"), "utf8");
  const template = await fs.readFile(path.join(root, "src/tools/templates/logic-dashboard.html"), "utf8");
  assert.match(server, /max-age=31536000, immutable/);
  assert.match(server, /\.ppagent-slot-visual-layer\{[^}]*opacity:0/);
  assert.match(server, /\.ppagent-component-scale:hover \.ppagent-slot-visual-layer/);
  assert.match(dataCollector, /src", "tools", "serve-logic-dashboard\.mjs/);
  assert.match(server, /fetch\("\/api\/dashboard-data", \{ cache: "no-store" \}\)/);
  assert.match(server, /reviewModule\[resolved\.record\.componentExport\] \?\? runtimeModule\[resolved\.record\.componentExport\]/);
  assert.match(server, /pathToFileURL\(htmlRuntimePath\)\.href\}\?dashboard=\$\{htmlRuntimeStat\.mtimeMs\}/);
  assert.match(server, /pathToFileURL\(htmlRuntimePath\)\.href\}\?dashboard=\$\{inputMtime\}/);
  assert.match(server, /html-component-theme\.mjs/);
  assert.match(server, /await runRenderer\(pptxPath, outputDir\)/);
  assert.match(template, /asset\.nativeStatePreviewUrl[\s\S]*selectionQuery\(asset\.componentInitialSelection/);
  assert.doesNotMatch(template, /overlay=0/);
  assert.match(template, /class="coverage-tier-grid" id="approval-grid"/);
  assert.match(template, /class="coverage-card available"[\s\S]*coverage-count">待审批/);
  assert.doesNotMatch(template, /preloadAssetEvidence/);
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
    "hierarchy-pyramid-001", "organization-tree-001",
    "problem-improvement-001", "radial-hub-001", "timeline-roadmap-001",
    "funnel-conversion-001", "sequential-process-001", "fishbone-analysis-001",
  ]);
  assert.equal(data.records.some((record) => removedIds.has(record.id)), false);
  const formalIds = new Set(data.formalLogics.map((record) => record.id));
  assert.deepEqual(formalIds, new Set([
    "comparison-dual-verdict-001", "comparison-pros-cons-balance-005", "cycle-loop-001", "hierarchy-people-tree-001",
    "hub-radial-001", "layered-architecture-001", "layered-iceberg-depth-006", "parallel-equal-cards-001",
    "convergence-simple-funnel-001", "convergence-funnel-001", "sequence-flow-001",
    "causal-fishbone-attribution-001", "problem-solution-outcome-001",
    "matrix-quadrant-priority-001", "argument-evidence-conclusion-001",
    "problem-method-result-001", "progression-spectrum-focus-001",
    "branching-decision-routes-001", "goal-alignment-strategy-metrics-001",
    "role-stage-collaboration-001", "containment-multi-set-intersection-001",
    "network-internal-external-ecosystem-001", "cycle-racetrack-loop-005",
    "cycle-single-chain-feedback-002", "convergence-many-to-one-003",
  ]));
});

test("Logic 能力地图保留空槽位，只把合格资产填入对应位置", async () => {
  const data = await collectLogicDashboardData(root);
  assert.equal(data.logics.length, 20);
  assert.equal(data.summary.logicSlots, 20);
  assert.equal(data.summary.logicFilled, 18);

  const cycle = data.logics.find((logic) => logic.id === "cycle");
  assert.deepEqual(cycle?.assetIds, [
    "cycle-loop-001",
    "cycle-racetrack-loop-005",
    "cycle-single-chain-feedback-002",
  ]);
  assert.equal(cycle?.status, "available");

  const parallel = data.logics.find((logic) => logic.id === "parallel");
  assert.deepEqual(parallel?.assetIds, ["parallel-equal-cards-001"]);
  assert.equal(parallel?.status, "available");

  const sequence = data.logics.find((logic) => logic.id === "sequence");
  assert.deepEqual(sequence?.assetIds, ["sequence-flow-001"]);
  assert.equal(sequence?.status, "available");

  const layered = data.logics.find((logic) => logic.id === "layered");
  assert.deepEqual(layered?.assetIds, ["layered-architecture-001", "layered-iceberg-depth-006"]);
  assert.equal(layered?.status, "available");

  const hierarchy = data.logics.find((logic) => logic.id === "hierarchy");
  assert.deepEqual(hierarchy?.assetIds, ["hierarchy-people-tree-001"]);
  assert.equal(hierarchy?.status, "available");
  assert.match(hierarchy?.description ?? "", /上下级|归属/);

  const convergence = data.logics.find((logic) => logic.id === "convergence");
  assert.deepEqual(convergence?.assetIds, [
    "convergence-simple-funnel-001",
    "convergence-funnel-001",
    "convergence-many-to-one-003",
  ]);
  assert.equal(convergence?.status, "available");

  const causal = data.logics.find((logic) => logic.id === "causal");
  assert.deepEqual(causal?.assetIds, ["causal-fishbone-attribution-001"]);
  assert.equal(causal?.status, "available");

  const problemSolution = data.logics.find((logic) => logic.id === "problem-solution");
  assert.deepEqual(problemSolution?.assetIds, ["problem-solution-outcome-001", "problem-method-result-001"]);
  assert.equal(problemSolution?.status, "available");

  const matrix = data.logics.find((logic) => logic.id === "matrix");
  assert.deepEqual(matrix?.assetIds, ["matrix-quadrant-priority-001"]);
  assert.equal(matrix?.status, "available");

  const argumentEvidence = data.logics.find((logic) => logic.id === "argument-evidence");
  assert.deepEqual(argumentEvidence?.assetIds, ["argument-evidence-conclusion-001"]);
  assert.equal(argumentEvidence?.status, "available");

  const branching = data.logics.find((logic) => logic.id === "branching");
  assert.deepEqual(branching?.assetIds, ["branching-decision-routes-001"]);
  assert.equal(branching?.status, "available");

  const network = data.logics.find((logic) => logic.id === "network");
  assert.deepEqual(network?.assetIds, ["network-internal-external-ecosystem-001"]);
  assert.equal(network?.status, "available");

  const template = await fs.readFile(path.join(root, "src/tools/templates/logic-dashboard.html"), "utf8");
  assert.match(template, /data-carousel-select/);
  assert.match(template, /coverage-asset-tab/);
  assert.match(template, /candidate\.name/);
});

test("鱼骨归因由同一组件扩散类别与因素状态，并由 Mapper 绑定结果和原因", () => {
  for (const categoryCount of [4, 5, 6]) {
    for (const factorCount of [1, 2, 3]) {
      const parameters = resolveFishbonePreviewParameters(fishbonePreviewParameters, { categoryCount, factorCount });
      const markup = fishboneVisualComponent.renderMarkup(parameters);
      assert.match(markup, new RegExp(`data-category-count="${categoryCount}"`));
      assert.match(markup, new RegExp(`data-factor-count="${factorCount}"`));
      assert.equal((markup.match(/class="cause-group"/g) ?? []).length, categoryCount);
      assert.equal((markup.match(/class="factor-guide-line"/g) ?? []).length, categoryCount * factorCount);
      assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, categoryCount);
      assert.equal((markup.match(/data-slot-role="item-body"/g) ?? []).length, categoryCount);
      assert.equal((markup.match(/data-slot-role="item-content"/g) ?? []).length, 1);
      assert.equal((markup.match(/data-slot-region-id="summary"/g) ?? []).length, 1);
    }
  }

  const content = {
    title: "交付延期",
    items: [
      { id: "requirements", title: "需求定义", body: "目标变化", points: [{ text: "口径不清" }] },
      { id: "planning", title: "计划协同", body: "资源不稳", points: [{ text: "依赖遗漏" }] },
      { id: "technology", title: "技术实现", body: "接口复杂", points: [{ text: "覆盖不足" }] },
      { id: "testing", title: "测试验证", body: "环境不稳", points: [{ text: "回归滞后" }] },
    ],
  };
  const payload = mapFishbonePageContent(content, { intentId: "causal-intent" }, null, {
    componentText: [{ sourceField: "page-title", targetRole: "center-title", text: "最终延期" }],
    componentBindings: [{
      bindingId: "cause-factors",
      sourceItemId: "requirements",
      entries: [{ text: "目标调整" }, { text: "验收不清" }],
    }],
  });
  assert.equal(payload.parameters.effect.title, "最终延期");
  assert.deepEqual(payload.parameters.causes[0].factors, ["目标调整", "验收不清"]);
  assert.deepEqual(payload.parameters.causes[1].factors, ["依赖遗漏"]);
});

test("待确认问题方案结果由同一 HTML 组件重排 2–4 组且保持逐组对应", () => {
  for (const pairCount of [2, 3, 4]) {
    const parameters = resolveProblemSolutionPreviewParameters(problemSolutionPreviewParameters, { pairCount });
    const markup = problemSolutionVisualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-pair-count="${pairCount}"`));
    assert.equal((markup.match(/class="pair-row"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/class="problem-card"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/class="solution-card"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/data-slot-role="solution-title"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/data-slot-role="item-body"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/data-slot-role="solution-body"/g) ?? []).length, pairCount);
    assert.equal((markup.match(/class="outcome-card"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-slot-role="center-title"/g) ?? []).length, 1);
  }

  const resultModes = new Map([
    ["标题型", "title-only"],
    ["结论型", "conclusion"],
    ["重点型", "full"],
    ["指标型", "full"],
  ]);
  for (const [resultMode, expectedMode] of resultModes) {
    const parameters = resolveProblemSolutionPreviewParameters(problemSolutionPreviewParameters, { pairCount: 3, resultMode });
    const markup = problemSolutionVisualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-outcome-mode="${expectedMode}"`));
    assert.equal((markup.match(/data-slot-role="center-highlight"/g) ?? []).length, ["重点型", "指标型"].includes(resultMode) ? 1 : 0);
  }

  const content = {
    pageId: "p1",
    title: "协同过程更清晰",
    items: [
      { id: "handoff", title: "交接依赖人工", body: "信息同步慢" },
      { id: "exception", title: "异常发现滞后", body: "定位耗时" },
    ],
    structuredData: {
      type: "problem-solution",
      pairs: [
        { id: "handoff", problem: { title: "交接依赖人工", body: "信息同步慢" }, solution: { title: "统一协同入口", body: "节点同步可见" } },
        { id: "exception", problem: { title: "异常发现滞后", body: "定位耗时" }, solution: { title: "实时监测预警", body: "自动分级提醒" } },
      ],
      outcome: { title: "协同过程更清晰", highlight: "", body: "异常提前暴露" },
    },
  };
  const payload = mapProblemSolutionPageContent(content, { intentId: "problem-solution-intent" }, null, {
    componentItemIds: ["handoff", "exception"],
    componentText: [{ sourceField: "page-title", targetRole: "center-title", text: "交付节奏更稳定" }],
  });
  assert.equal(payload.parameters.pairs[0].solution.title, "统一协同入口");
  assert.equal(payload.parameters.outcome.title, "交付节奏更稳定");
  assert.equal(payload.parameters.outcome.body, "异常提前暴露");
});

test("矩阵象限保持真实双轴、独立扩散每象限 1–3 个对象并完成内容映射", () => {
  for (const itemsPerQuadrant of [1, 2, 3]) {
    const parameters = resolveMatrixPreviewParameters(matrixPreviewParameters, { itemsPerQuadrant, focusQuadrant: "左上", definitionRail: "有" });
    const markup = matrixVisualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-items-per-quadrant="${itemsPerQuadrant}"`));
    assert.equal((markup.match(/class="matrix-quadrant/g) ?? []).length, 4);
    assert.equal((markup.match(/class="matrix-item/g) ?? []).length, itemsPerQuadrant * 4);
    assert.equal((markup.match(/class="axis-line"/g) ?? []).length, 2);
    assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, itemsPerQuadrant * 4);
    assert.equal((markup.match(/quadrant-detail detail-/g) ?? []).length, 4);
    assert.equal((markup.match(/data-slot-content-type="text-region"/g) ?? []).length, 4);
    assert.equal((markup.match(/data-slot-role="text-region"/g) ?? []).length, 4);
    assert.equal((markup.match(/data-slot-region-id="detail"/g) ?? []).length, 4);
    assert.equal((markup.match(/data-text-layout-id="heading-metric-content-flow"/g) ?? []).length, 8);
    assert.equal((markup.match(/data-text-layout-part="metric"/g) ?? []).length, 8);
    assert.equal((markup.match(/class="band-definition band-/g) ?? []).length, 2);
    assert.doesNotMatch(markup, /data-slot-role="item-body"/);
  }
  const withoutDefinitionRail = resolveMatrixPreviewParameters(matrixPreviewParameters, { itemsPerQuadrant: 2, focusQuadrant: "无", definitionRail: "无" });
  const markupWithoutDefinitionRail = matrixVisualComponent.renderMarkup(withoutDefinitionRail);
  assert.match(markupWithoutDefinitionRail, /data-definition-rail="off"/);
  assert.doesNotMatch(markupWithoutDefinitionRail, /class="band-definition/);

  const mixedParameters = resolveMatrixPreviewParameters(matrixPreviewParameters, {
    q0Count: 1,
    q1Count: 2,
    q2Count: 3,
    q3Count: 1,
    focusQuadrant: "右上",
    definitionRail: "有",
  });
  const mixedMarkup = matrixVisualComponent.renderMarkup(mixedParameters);
  assert.match(mixedMarkup, /data-items-per-quadrant="mixed"/);
  assert.match(mixedMarkup, /data-quadrant-counts="1,2,3,1"/);
  assert.match(mixedMarkup, /data-items-q0="1"/);
  assert.match(mixedMarkup, /data-items-q1="2"/);
  assert.match(mixedMarkup, /data-items-q2="3"/);
  assert.match(mixedMarkup, /data-items-q3="1"/);
  assert.equal((mixedMarkup.match(/class="matrix-item/g) ?? []).length, 7);

  const content = {
    pageId: "matrix-page",
    title: "项目优先级",
    items: [
      { id: "alert", title: "异常预警", body: "" },
      { id: "portal", title: "统一入口", body: "" },
      { id: "platform", title: "数据平台", body: "" },
      { id: "report", title: "报表美化", body: "" },
    ],
    structuredData: {
      type: "matrix",
      axes: { xLow: "难度低", xHigh: "难度高", yLow: "价值低", yHigh: "价值高" },
      focusQuadrant: 1,
      showDefinitionRail: false,
      quadrants: [
        { id: "q0", title: "优先推进", detail: { title: "快速落地", body: "低难度高价值项目", metrics: [{ label: "周期", value: "2周" }, { label: "团队", value: "2组" }] }, itemIds: ["alert"] },
        { id: "q1", title: "战略投入", detail: { title: "重点投入", body: "集中资源持续建设", metrics: [{ label: "周期", value: "3月" }, { label: "投入", value: "重点" }] }, itemIds: ["platform"] },
        { id: "q2", title: "择机优化", detail: { title: "常规优化", body: "低成本择机改善", metrics: [{ label: "频率", value: "季度" }, { label: "投入", value: "常规" }] }, itemIds: ["report"] },
        { id: "q3", title: "谨慎评估", detail: { title: "审慎评估", body: "投入前验证边界", metrics: [{ label: "周期", value: "1月" }, { label: "风险", value: "较高" }] }, itemIds: ["portal"] },
      ],
    },
  };
  const payload = mapMatrixPageContent(content, { intentId: "matrix-intent" }, null, {
    componentItemIds: content.items.map((item) => item.id),
  });
  assert.deepEqual(payload.parameters.axes, content.structuredData.axes);
  assert.deepEqual(payload.parameters.quadrants.map((quadrant) => quadrant.items.map((item) => item.key)), [
    ["alert"], ["platform"], ["report"], ["portal"],
  ]);
  assert.equal(payload.parameters.focusQuadrant, 1);
  assert.equal(payload.parameters.showDefinitionRail, false);
  assert.equal(payload.mappings.length, 4);
});

test("循环 Structure Group 暴露与 State 同步的可填充 Content Slots", () => {
  for (const stepCount of [3, 4, 5, 6]) {
    const parameters = resolvePreviewParameters(previewParameters, { stepCount });
    const slots = resolveContentSlots(parameters);
    assert.equal(slots.length, stepCount);
    for (const slot of slots) {
      assert.equal(slot.capacity.basis, "safe-box-and-text-layout");
      assert.deepEqual(slot.capacity.box, slot.frame);
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
    assert.equal((markup.match(/data-slot-content-type="text-region"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/data-slot-role="center-title"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/data-slot-role="text-region"/g) ?? []).length, stepCount);
    assert.equal((markup.match(/data-slot-role="item-point"/g) ?? []).length, 0);
    assert.equal((markup.match(/data-text-layout-id="heading-content-flow"/g) ?? []).length, stepCount * 2);
    assert.equal((markup.match(/data-slot-safe-box="true"/g) ?? []).length, stepCount);
    assert.doesNotMatch(markup, /data-slot-role="text-region"[^>]*data-slot-max-(?:chars|lines)=/);
  }
});

test("看板从当前 HTML State 自动生成容器表并复用到 Native 和 Skin", async () => {
  const server = await fs.readFile(path.join(root, "src/tools/serve-logic-dashboard.mjs"), "utf8");
  const template = await fs.readFile(path.join(root, "src/tools/templates/logic-dashboard.html"), "utf8");
  assert.match(template, /readComponentSlotMap/);
  assert.match(template, /frozenComponentSlotMap/);
  assert.match(template, /intakeSlotContract/);
  assert.match(template, /intakeSlotContractUrl/);
  assert.match(template, /按需读取完整契约/);
  assert.match(template, /data-slot-map-list/);
  assert.match(template, /data-slot-overlay/);
  assert.match(template, /fontSizePt/);
  assert.match(template, /入库时固化的字体—容器契约/);
  assert.match(template, /slotProvider/);
  assert.match(template, /悬停查看可编辑容器/);
  assert.match(server, /统一动态文字区/);
  assert.match(server, /动态文字大区/);
  assert.match(server, /标题区（本次排版）/);
  assert.match(server, /正文区（本次排版）/);
  assert.match(template, /最外层深蓝框表示连续的动态文字大区/);
  assert.match(template, /连续复合文字区域/);
  assert.match(template, /text-flow-part/);
  assert.match(template, /slot\.textFlow\?\.parts/);
});

test("多集合共同交集只在原稿明确集合与共同部分时映射正式载荷", () => {
  const content = {
    pageId: "intersection-page",
    title: "可靠生成的共同基础",
    items: [
      { id: "need", title: "用户需要", body: "真实场景中的核心诉求", points: ["高频需求"] },
      { id: "standard", title: "组织规范", body: "统一标准与可靠边界", points: ["格式规范"] },
      { id: "expression", title: "表达能力", body: "清晰呈现与灵活适配", points: ["逻辑清楚"] },
    ],
    structuredData: {
      type: "multi-set-common-intersection",
      setIds: ["need", "standard", "expression"],
      shared: { title: "可靠生成", body: "共同价值" },
    },
  };
  const payload = mapIntersectionPageContent(content, { intentId: "intersection-intent" }, null, {
    componentItemIds: content.items.map((item) => item.id),
  });
  assert.equal(payload.assetId, "containment-multi-set-intersection-001");
  assert.deepEqual(payload.parameters.items.map((item) => item.key), content.structuredData.setIds);
  assert.deepEqual(payload.parameters.shared, content.structuredData.shared);
  assert.equal(payload.parameters.showSupport, true);
  assert.equal(payload.mappings.length, 3);
});

test("内外协同生态网络只按显式分组与关系映射正式载荷", () => {
  const content = {
    pageId: "ecosystem-page",
    title: "内外协同生态",
    items: [
      { id: "governance", title: "组织治理", body: "" },
      { id: "data", title: "数据能力", body: "" },
      { id: "university", title: "高校伙伴", body: "" },
      { id: "industry", title: "行业企业", body: "" },
    ],
    structuredData: {
      type: "internal-external-ecosystem",
      internalTitle: "内部协同",
      externalTitle: "外部生态",
      internalIds: ["governance", "data"],
      externalIds: ["university", "industry"],
      core: { title: "共建共享", body: "资源与能力" },
      links: [
        { from: "governance", to: "data" },
        { from: "university", to: "industry" },
        { from: "data", to: "university" },
      ],
    },
  };
  const payload = mapNetworkPageContent(content, { intentId: "network-intent" }, null, {
    componentItemIds: content.items.map((item) => item.id),
  });
  assert.equal(payload.assetId, "network-internal-external-ecosystem-001");
  assert.deepEqual(payload.parameters.internal.nodes.map((item) => item.key), ["governance", "data"]);
  assert.deepEqual(payload.parameters.external.nodes.map((item) => item.key), ["university", "industry"]);
  assert.deepEqual(payload.parameters.links, content.structuredData.links);
  assert.equal(payload.mappings.length, 4);
});

test("等权并列卡片由同一 HTML 组件重新排布 3–5 项状态", () => {
  for (const itemCount of [3, 4, 5]) {
    const parameters = resolveParallelPreviewParameters(parallelPreviewParameters, { itemCount });
    const markup = parallelVisualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-item-count="${itemCount}"`));
    assert.equal((markup.match(/class="parallel-card"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="icon"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="text-region"/g) ?? []).length, itemCount * 2);
    assert.equal((markup.match(/data-slot-content-type="text-region"/g) ?? []).length, itemCount * 2);
    assert.equal((markup.match(/data-text-layout-id="statement-flow"/g) ?? []).length, itemCount * 2);
    assert.equal((markup.match(/data-text-layout-id="heading-content-flow"/g) ?? []).length, itemCount * 2);
    assert.equal((markup.match(/data-slot-required="true"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-max-(?:chars|lines)=/g) ?? []).length, 0);
    assert.equal((markup.match(/data-icon-key=/g) ?? []).length, itemCount);
  }
});

test("已审批并列组件进入核心库并可被正式生成线发现", async () => {
  const data = await collectLogicDashboardData(root);
  const core = data.records.find((record) => record.library === "core" && record.id === "parallel-equal-cards-001");
  assert.equal(core?.status, "core");
  assert.equal(core?.autoCallable, true);
  assert.deepEqual(core?.componentStates, [3, 4, 5]);
  assert.ok(core?.nativeStatePreviewUrl);
  assert.ok(core?.nativeStatePptxUrl);
  assert.ok(core?.skinStatePreviewUrl);
  assert.equal(core?.logicId, "parallel");
  assert.equal(core?.mediaContract?.mode, "semantic-icon");
  assert.equal(data.activeSkin?.slots?.contentFrame?.width, 1170);
  assert.equal(data.formalLogics.some((record) => record.id === "parallel-equal-cards-001"), true);
});

test("已审批顺序流程由同一组件扩散 3–6 步并进入核心库", async () => {
  for (const itemCount of [3, 4, 5, 6]) {
    const parameters = resolveSequencePreviewParameters(sequencePreviewParameters, { itemCount });
    const markup = sequenceVisualComponent.renderMarkup(parameters);
    assert.match(markup, new RegExp(`data-item-count="${itemCount}"`));
    assert.equal((markup.match(/class="sequence-step"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="item-title"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-role="item-body"/g) ?? []).length, itemCount);
    assert.equal((markup.match(/data-slot-text-mode="flow"/g) ?? []).length, itemCount);
  }
  const data = await collectLogicDashboardData(root);
  const core = data.records.find((record) => record.library === "core" && record.id === "sequence-flow-001");
  assert.equal(core?.status, "core");
  assert.equal(core?.componentPreviewAvailable, true);
  assert.equal(core?.nativeOutputAvailable, true);
  assert.equal(core?.autoCallable, true);
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
