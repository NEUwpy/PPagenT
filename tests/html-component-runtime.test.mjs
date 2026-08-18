import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createPresentation } from "../src/asset-runtime/component-builders.mjs";
import {
  closeHtmlComponentRuntime,
  compileResolvedVisualTree,
  resolveHtmlComponent,
} from "../src/visual-runtime/html-component-runtime.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "../assets/结构图/循环闭环-001/review.mjs";
import { normalizeCycleParameters } from "../assets/结构图/循环闭环-001/layout.mjs";
import {
  previewParameters as parallelPreviewParameters,
  resolvePreviewParameters as resolveParallelPreviewParameters,
  visualComponent as parallelVisualComponent,
} from "../assets/结构图/等权并列卡片-001/review.mjs";

const assetDir = path.resolve(import.meta.dirname, "../assets/结构图/循环闭环-001");
const parallelAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/等权并列卡片-001");

test("循环 HTML 由通用 DOM 编译器直接生成可编辑 Native 形状", async () => {
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    let tree;
    for (const stepCount of [3, 4, 5, 6]) {
      tree = await resolveHtmlComponent({
        component: visualComponent,
        parameters: resolvePreviewParameters(previewParameters, { stepCount }),
        assetDir,
        targetFrame,
        theme: {
          font: "Microsoft YaHei",
          typography: { componentHeading: 29, componentTitle: 26, componentItemTitle: 21, componentBody: 19, componentLabel: 18, componentMeta: 17 },
        },
      });
      assert.equal(tree.nodes.filter((node) => node.kind === "path").length, stepCount * 2);
      assert.equal(tree.nodes.filter((node) => node.name.startsWith("cycle-panel-")).length, stepCount);
      assert.equal(tree.nodes.some((node) => node.name.includes("metric") || node.name.includes("detail-label")), false);
    }
    tree = await resolveHtmlComponent({
      component: visualComponent,
      parameters: resolvePreviewParameters(previewParameters, { stepCount: 4 }),
      assetDir,
      targetFrame,
      theme: {
        font: "Microsoft YaHei",
        typography: { componentHeading: 29, componentTitle: 26, componentItemTitle: 21, componentBody: 19, componentLabel: 18, componentMeta: 17 },
      },
    });
    assert.equal(tree.nodes.find((node) => node.name === "cycle-title-0")?.style.color, "#FFD176");
    assert.equal(tree.nodes.find((node) => node.name === "cycle-number-0")?.style.fontSize, 29);
    assert.equal(tree.nodes.find((node) => node.name === "cycle-title-0")?.style.fontSize, 21);
    assert.equal(tree.nodes.find((node) => node.name === "cycle-core-text-0")?.style.fontSize, 26);
    assert.equal(tree.nodes.find((node) => node.name === "cycle-0-support")?.style.fontSize, 19);
    assert.deepEqual(tree.slots.find((slot) => slot.role === "center-title")?.capacity, { maxChars: 12, maxLines: 2 });
    assert.deepEqual(tree.slots.find((slot) => slot.role === "item-title")?.capacity, { maxChars: 8, maxLines: 1 });
    assert.deepEqual(tree.slots.find((slot) => slot.role === "item-body")?.capacity, { maxChars: 64, maxLines: 5 });
    assert.equal(tree.slots.find((slot) => slot.role === "item-body")?.textMode, "flow");
    assert.equal(tree.slots.find((slot) => slot.role === "item-body")?.listPolicy, "inline");
    assert.equal(tree.slots.find((slot) => slot.role === "item-title")?.required, false);
    assert.match(tree.nodes.find((node) => node.name === "cycle-0-support")?.text ?? "", /明确本轮改进目标\n• 分析现状约束/);

    const presentation = createPresentation();
    const slide = presentation.slides.add();
    compileResolvedVisualTree(slide, tree, targetFrame);
    const inspection = await presentation.inspect({ kind: "slide,textbox,shape,image", maxChars: 100000 });
    const rows = inspection.ndjson.split(/\r?\n/).filter(Boolean).map(JSON.parse);
    assert.equal(rows.some((row) => row.kind === "image"), false);
    assert.equal(rows.filter((row) => row.name?.startsWith("cycle-band-")).length, 4);
    assert.equal(rows.filter((row) => row.name?.startsWith("cycle-panel-")).length, 4);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("循环基础版接受正文和0–4条普通分点，不绑定指标结构", () => {
  const model = normalizeCycleParameters({
    center: "循环",
    steps: [
      { body: "只有正文", points: [] },
      { title: "处理", points: ["只有一个分点"] },
      { title: "输出", body: "正文", points: ["分点一", "分点二", "分点三", "分点四"] },
    ],
  });
  assert.equal(model.steps[0].title, "");
  assert.deepEqual(model.steps.map((step) => step.supportText.split("\n").length), [1, 1, 5]);
  assert.throws(() => normalizeCycleParameters({
    steps: [
      { title: "输入", body: "正文" },
      { title: "处理", body: "正文", metrics: [{ label: "进度", value: "80%" }] },
      { title: "输出", body: "正文" },
    ],
  }), /独立的嵌套 Structure Group/);
  assert.throws(() => normalizeCycleParameters({
    steps: [
      { title: "输入", body: "超".repeat(65) },
      { title: "处理", body: "正文" },
      { title: "输出", body: "正文" },
    ],
  }), /支持正文超过 64 字/);
});

test("HTML 组件拒绝通过缩放目标框偷偷改变字号", async () => {
  try {
    await assert.rejects(() => resolveHtmlComponent({
      component: visualComponent,
      parameters: resolvePreviewParameters(previewParameters, { stepCount: 4 }),
      assetDir,
      targetFrame: { left: 0, top: 0, width: 585, height: 246 },
    }), /不能缩放组件/);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("并列组件的文字与图标槽由最终 DOM 派生，并编译为原生图像对象", async () => {
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    const tree = await resolveHtmlComponent({
      component: parallelVisualComponent,
      parameters: resolveParallelPreviewParameters(parallelPreviewParameters, { itemCount: 4 }),
      assetDir: parallelAssetDir,
      targetFrame,
    });
    assert.equal(tree.slots.length, 12);
    assert.equal(tree.slots.filter((slot) => slot.role === "icon").length, 4);
    assert.ok(tree.slots.filter((slot) => slot.role === "icon").every((slot) => (
      slot.media?.provider === "tabler-icons" && slot.media.required === true
    )));
    assert.deepEqual(tree.slots.find((slot) => slot.role === "item-body")?.capacity, { maxChars: 30, maxLines: 4 });
    assert.equal(tree.nodes.filter((node) => node.kind === "image").length, 4);

    const presentation = createPresentation();
    const slide = presentation.slides.add();
    compileResolvedVisualTree(slide, tree, targetFrame);
    const inspection = await presentation.inspect({ kind: "slide,textbox,shape,image", maxChars: 100000 });
    const rows = inspection.ndjson.split(/\r?\n/).filter(Boolean).map(JSON.parse);
    assert.equal(rows.filter((row) => row.kind === "image").length, 4);
  } finally {
    await closeHtmlComponentRuntime();
  }
});
