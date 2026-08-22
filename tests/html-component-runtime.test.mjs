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
import {
  previewParameters as matrixPreviewParameters,
  visualComponent as matrixVisualComponent,
} from "../assets/结构图/矩阵象限-001/review.mjs";
import {
  previewParameters as sequencePreviewParameters,
  visualComponent as sequenceVisualComponent,
} from "../assets/结构图/顺序流程-001/review.mjs";

const assetDir = path.resolve(import.meta.dirname, "../assets/结构图/循环闭环-001");
const parallelAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/等权并列卡片-001");
const matrixAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/矩阵象限-001");
const sequenceAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/顺序流程-001");

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

test("矩阵 HTML 的透明度、渐变、自定义阴影、圆角和 SVG 图标无降级进入 ResolvedVisualTree", async () => {
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    const tree = await resolveHtmlComponent({
      component: matrixVisualComponent,
      parameters: structuredClone(matrixPreviewParameters),
      assetDir: matrixAssetDir,
      targetFrame,
    });
    assert.equal(tree.schemaVersion, 3);
    assert.equal(tree.nodes.find((node) => node.name === "quadrant-field-0")?.fill, "#CAE1FC/25");
    assert.equal(tree.nodes.find((node) => node.name === "matrix-item-0-0")?.fill, "#2F5EA8/79");
    assert.equal(tree.nodes.find((node) => node.name === "matrix-item-0-0")?.shadow, "0px 9px 21px #2F5EA8/14");
    assert.deepEqual(tree.nodes.find((node) => node.name === "matrix-high-band")?.fill, {
      type: "gradient",
      gradientKind: "linear",
      angleDeg: 180,
      stops: [
        { offset: 0, color: "#4F89C3/80" },
        { offset: 100000, color: "#609ACF/61" },
      ],
    });
    assert.equal(tree.nodes.find((node) => node.name === "matrix-high-band")?.borderRadius, 8);
    assert.deepEqual(tree.nodes.filter((node) => node.kind === "image").map((node) => node.name), [
      "matrix-high-band-icon",
      "matrix-low-band-icon",
    ]);
    assert.match(Buffer.from(tree.nodes.find((node) => node.name === "matrix-high-band-icon").dataUrl.split(",")[1], "base64").toString("utf8"), /opacity: 0\.72/);

    const presentation = createPresentation();
    const slide = presentation.slides.add();
    compileResolvedVisualTree(slide, tree, targetFrame);
    const inspection = await presentation.inspect({ kind: "slide,textbox,shape,image", maxChars: 100000 });
    const rows = inspection.ndjson.split(/\r?\n/).filter(Boolean).map(JSON.parse);
    assert.equal(rows.filter((row) => row.kind === "image").length, 2);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("HTML → PPT 对不能可靠映射的效果和遗漏 SVG 采用 fail-close", async () => {
  const targetFrame = { left: 0, top: 0, width: 100, height: 100 };
  const component = (markup) => ({
    id: "fidelity-gate-fixture",
    designFrame: { width: 100, height: 100 },
    cssFile: "component.css",
    renderMarkup: () => markup,
  });
  try {
    await assert.rejects(() => resolveHtmlComponent({
      component: component('<section data-ppt-root style="width:100px;height:100px"><div data-ppt-kind="shape" style="width:50px;height:50px;background:#fff;filter:blur(2px)"></div></section>'),
      parameters: {},
      assetDir: matrixAssetDir,
      targetFrame,
    }), /HTML_PPT_FIDELITY:UNSUPPORTED_FILTER.*filter/);
    await assert.rejects(() => resolveHtmlComponent({
      component: component('<section data-ppt-root style="width:100px;height:100px"><svg width="50" height="50"><circle cx="25" cy="25" r="20" fill="#2f5ea8"\/><\/svg><div data-ppt-kind="shape" style="width:1px;height:1px;background:#fff"><\/div><\/section>'),
      parameters: {},
      assetDir: matrixAssetDir,
      targetFrame,
    }), /HTML_PPT_FIDELITY:UNCOMPILED_SVG_NODE/);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("固定高度的单行居中文本使用公共视觉居中语义，不把容器行高编译为 PPT 行距", async () => {
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    const tree = await resolveHtmlComponent({
      component: sequenceVisualComponent,
      parameters: structuredClone(sequencePreviewParameters),
      assetDir: sequenceAssetDir,
      targetFrame,
      theme: { font: "Microsoft YaHei" },
    });
    const order = tree.nodes.find((node) => node.name === "sequence-order-0");
    assert.equal(order?.style.alignment, "center");
    assert.equal(order?.style.verticalAlignment, "middle");
    assert.equal(order?.style.lineSpacing, 1);
    assert.equal(order?.frame.width, 64);
    assert.equal(order?.frame.height, 64);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("开放 SVG 路径不会在 Native 编译时被强制闭合", async () => {
  const component = {
    id: "open-path-fixture",
    designFrame: { width: 100, height: 100 },
    cssFile: "component.css",
    renderMarkup: () => `<section data-ppt-root style="width:100px;height:100px;overflow:hidden">
      <svg width="100" height="100" style="display:block">
        <path data-ppt-kind="path" data-ppt-name="open" d="M10 10 L80 20 L60 70" fill="none" stroke="#2f5ea8" stroke-width="2"/>
        <path data-ppt-kind="path" data-ppt-name="closed" d="M20 20 L40 20 L30 40 Z" fill="#2f5ea8" stroke="#2f5ea8" stroke-width="1"/>
      </svg>
    </section>`,
  };
  try {
    const tree = await resolveHtmlComponent({
      component,
      parameters: {},
      assetDir: matrixAssetDir,
      targetFrame: { left: 0, top: 0, width: 100, height: 100 },
    });
    assert.equal(tree.nodes.find((node) => node.name === "open")?.closed, false);
    assert.equal(tree.nodes.find((node) => node.name === "closed")?.closed, true);
    const presentation = createPresentation();
    compileResolvedVisualTree(presentation.slides.add(), tree);
  } finally {
    await closeHtmlComponentRuntime();
  }
});
