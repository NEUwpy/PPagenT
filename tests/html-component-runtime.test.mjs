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

const assetDir = path.resolve(import.meta.dirname, "../assets/结构图/循环闭环-001");

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
    });
    assert.equal(tree.nodes.find((node) => node.name === "cycle-title-0")?.style.color, "#FFD176");

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
      { title: "输入", body: "只有正文", points: [] },
      { title: "处理", points: ["只有一个分点"] },
      { title: "输出", body: "正文", points: ["分点一", "分点二", "分点三", "分点四"] },
    ],
  });
  assert.deepEqual(model.steps.map((step) => step.copyLines.length), [1, 1, 5]);
  assert.throws(() => normalizeCycleParameters({
    steps: [
      { title: "输入", body: "正文" },
      { title: "处理", body: "正文", metrics: [{ label: "进度", value: "80%" }] },
      { title: "输出", body: "正文" },
    ],
  }), /独立的嵌套 Style Group/);
});
