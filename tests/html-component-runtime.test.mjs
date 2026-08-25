import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createPresentation } from "../src/asset-runtime/component-builders.mjs";
import {
  closeHtmlComponentRuntime,
  compileResolvedVisualTree,
  resolveHtmlComponent,
  sortResolvedVisualNodes,
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
import {
  argumentEvidenceVisualComponent,
  previewParameters as argumentPreviewParameters,
} from "../assets/结构图/论点证据结论-001/review.mjs";
import {
  previewParameters as problemMethodPreviewParameters,
  problemMethodVisualComponent,
} from "../assets/结构图/问题方法结果-001/review.mjs";
import {
  previewParameters as intersectionPreviewParameters,
  resolvePreviewParameters as resolveIntersectionPreviewParameters,
  visualComponent as intersectionVisualComponent,
} from "../assets/结构图/多集合交集-001/review.mjs";
import { northeasternUniversityTheme } from "../src/runtime/skins/northeastern-university-theme.mjs";

const assetDir = path.resolve(import.meta.dirname, "../assets/结构图/循环闭环-001");
const parallelAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/等权并列卡片-001");
const matrixAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/矩阵象限-001");
const sequenceAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/顺序流程-001");
const argumentAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/论点证据结论-001");
const problemMethodAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/问题方法结果-001");
const intersectionAssetDir = path.resolve(import.meta.dirname, "../assets/结构图/多集合交集-001");

test("Native 编译把浏览器 computed px 原样交给 Artifact Tool，避免重复 pt 换算", () => {
  let compiledTextStyle = null;
  let compiledTextWrap = null;
  const textProxy = {};
  Object.defineProperty(textProxy, "style", {
    set(value) { compiledTextStyle = value; },
  });
  Object.defineProperty(textProxy, "wrap", {
    set(value) { compiledTextWrap = value; },
  });
  const shape = {};
  Object.defineProperty(shape, "text", {
    get() { return textProxy; },
    set(value) { textProxy.value = value; },
  });
  const slide = { shapes: { add: () => shape } };
  compileResolvedVisualTree(slide, {
    schemaVersion: 5,
    frame: { width: 100, height: 100 },
    nodes: [{
      kind: "text",
      name: "font-unit-fixture",
      order: 0,
      stackingPath: [0],
      frame: { left: 0, top: 0, width: 100, height: 40 },
      text: "字号换算",
      shadow: "shadow-none",
      style: {
        typeface: "Microsoft YaHei",
        fontSize: 28,
        fontSizePt: 21,
        bold: false,
        italic: false,
        color: "#000000",
        alignment: "center",
        verticalAlignment: "middle",
        wrap: "none",
        lineSpacing: 1,
      },
    }],
  }, { left: 0, top: 0, width: 100, height: 100 });
  assert.equal(compiledTextStyle.fontSize, 28);
  assert.equal(compiledTextWrap, "none");
});

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
          typography: { componentHeading: 25, componentTitle: 23, componentItemTitle: 21, componentLead: 19, componentBody: 17, componentLabel: 17, componentMeta: 15 },
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
        typography: { componentHeading: 25, componentTitle: 23, componentItemTitle: 21, componentLead: 19, componentBody: 17, componentLabel: 17, componentMeta: 15 },
      },
    });
    assert.equal(tree.nodes.find((node) => node.name === "cycle-title-0")?.style.color, "#FFD176");
    assert.equal(tree.nodes.find((node) => node.name === "cycle-number-0")?.style.fontSizePt, 25);
    assert.equal(tree.nodes.find((node) => node.name === "cycle-title-0")?.style.fontSizePt, 21);
    assert.equal(tree.nodes.find((node) => node.name === "cycle-core-text-0")?.style.fontSizePt, 23);
    assert.equal(tree.nodes.find((node) => node.name === "cycle-0-support")?.style.fontSizePt, 17);
    const centerSlot = tree.slots.find((slot) => slot.role === "center-title");
    const titleSlot = tree.slots.find((slot) => slot.role === "item-title");
    const supportSlots = tree.slots.filter((slot) => slot.contentType === "text-region");
    assert.equal(centerSlot?.typography.fontSizePt, 23);
    assert.equal(centerSlot?.typography.role, "componentTitle");
    assert.equal(centerSlot?.capacity.reliable, false);
    assert.equal(titleSlot?.typography.fontSizePt, 21);
    assert.equal(titleSlot?.capacity.reliable, false);
    assert.equal(supportSlots.length, 4);
    assert.ok(supportSlots.every((slot) => slot.textLayout.status === "resolved"));
    assert.ok(supportSlots.every((slot) => slot.textLayout.parts.every((part) => part.typography.fontSizePt === 17)));
    assert.equal(tree.slots.find((slot) => slot.role === "item-title")?.required, false);
    assert.deepEqual(supportSlots[0].textLayout.contentRoles, ["body", "list"]);
    assert.match(supportSlots[0].textLayout.parts.map((part) => part.text).join("\n"), /明确本轮改进目标\n• 分析现状约束/);

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
  assert.doesNotThrow(() => normalizeCycleParameters({
    steps: [
      { title: "输入", body: "超".repeat(65) },
      { title: "处理", body: "正文" },
      { title: "输出", body: "正文" },
    ],
  }));
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

test("并列组件由最终 DOM 派生单一 TextFlow 与图标槽，并编译为原生对象", async () => {
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
    const regionSlots = tree.slots.filter((slot) => slot.contentType === "text-region");
    const titleRegions = regionSlots.filter((slot) => slot.field.endsWith(".title"));
    const supportRegions = regionSlots.filter((slot) => slot.field.endsWith(".support"));
    assert.equal(regionSlots.length, 8);
    assert.equal(titleRegions.length, 4);
    assert.equal(supportRegions.length, 4);
    assert.ok(titleRegions.every((slot) => slot.textLayout.id === "statement-flow"));
    assert.ok(supportRegions.every((slot) => slot.textLayout.id === "heading-content-flow"));
    assert.ok(titleRegions.every((slot) => slot.textLayout.parts[0]?.typography.fontSizePt === 18));
    assert.ok(supportRegions.every((slot) => slot.textLayout.parts[0]?.typography.fontSizePt === 14));
    assert.ok(regionSlots.every((slot) => !Object.hasOwn(slot.capacity, "maxChars")));
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
    assert.equal(tree.schemaVersion, 5);
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
    await assert.rejects(() => resolveHtmlComponent({
      component: component('<section data-ppt-root style="width:100px;height:100px"><span data-ppt-kind="text" style="display:block;width:40px;height:24px;background:#2f5ea8;color:#fff">01<\/span><\/section>'),
      parameters: {},
      assetDir: matrixAssetDir,
      targetFrame,
    }), /HTML_PPT_FIDELITY:TEXT_SURFACE_REQUIRES_SHAPE_TEXT/);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("集合共同交集在同一 Structure Group 内重排 2–5 个集合，并可关闭外围灰色说明区", async () => {
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    for (const itemCount of [2, 3, 4, 5]) {
      for (const supportMode of ["显示", "关闭"]) {
        const parameters = resolveIntersectionPreviewParameters(intersectionPreviewParameters, { itemCount, supportMode });
        const tree = await resolveHtmlComponent({
          component: intersectionVisualComponent,
          parameters,
          assetDir: intersectionAssetDir,
          targetFrame,
        });
        assert.equal(tree.nodes.filter((node) => node.name?.startsWith("set-circle-")).length, itemCount);
        assert.equal(tree.slots.filter((slot) => slot.role === "item-title").length, itemCount);
        const supportSlots = tree.slots.filter((slot) => slot.role === "text-region" && String(slot.regionId).startsWith("support"));
        const expectedSupportSlotCount = supportMode === "关闭" ? 0 : (itemCount === 3 ? 4 : itemCount);
        assert.equal(supportSlots.length, expectedSupportSlotCount);
        assert.equal(tree.slots.filter((slot) => slot.role === "text-region" && slot.regionId === "shared").length, 1);
        assert.deepEqual(tree.textLayoutOverflows, []);
        if (itemCount === 2 && supportMode === "显示") {
          assert.ok(supportSlots.every((slot) => slot.frame.width === 326 && slot.frame.height === 192));
        }
        if (itemCount === 3 && supportMode === "显示") {
          assert.deepEqual(supportSlots.map((slot) => slot.id).sort(), [
            "set-expression-support",
            "set-need-support-left",
            "set-need-support-right",
            "set-standard-support",
          ]);
          const topSlots = supportSlots.filter((slot) => slot.itemId === "need");
          assert.equal(topSlots.length, 2);
          assert.equal(topSlots[0].frame.top, topSlots[1].frame.top);
          assert.equal(topSlots[0].frame.width, topSlots[1].frame.width);
          assert.equal(topSlots[0].frame.height, topSlots[1].frame.height);
          assert.equal(topSlots[0].frame.top, 14);
          assert.equal(topSlots[0].frame.height, 188);
          assert.ok(supportSlots.filter((slot) => slot.itemId !== "need")
            .every((slot) => slot.frame.top === 258 && slot.frame.height === 204));
          const panelNames = tree.nodes.filter((node) => node.name?.startsWith("intersection-panel-")).map((node) => node.name);
          assert.equal(panelNames.length, 4);
          assert.equal(new Set(panelNames).size, 4);
          assert.deepEqual(tree.nodes.find((node) => node.name === "intersection-three-top-frame")?.frame, {
            left: 0, top: 0, width: 1170, height: 216, rotation: 0,
          });
        }
        if (itemCount === 4) {
          assert.equal(tree.nodes.find((node) => node.name === "shared-title")?.style.fontSizePt, 20);
        }
        const circles = tree.nodes.filter((node) => node.name?.startsWith("set-circle-"));
        assert.ok(circles.every((node) => node.frame.left >= 0 && node.frame.top >= 0));
        assert.ok(circles.every((node) => node.frame.left + node.frame.width <= targetFrame.width && node.frame.top + node.frame.height <= targetFrame.height));
        const masks = tree.nodes.filter((node) => node.name?.startsWith("support-arc-mask-"));
        const expectedMaskIndexes = supportMode === "关闭"
          ? []
          : Array.from({ length: itemCount }, (_, index) => index);
        assert.equal(masks.length, expectedMaskIndexes.length);
        if (supportMode === "显示") {
          for (const index of expectedMaskIndexes) {
            const maskFrame = masks.find((node) => node.name === `support-arc-mask-${index}`)?.frame;
            const circleFrame = circles.find((node) => node.name === `set-circle-${index}`)?.frame;
            assert.ok(maskFrame && circleFrame);
            assert.equal(maskFrame.left, circleFrame.left - 14);
            assert.equal(maskFrame.top, circleFrame.top - 14);
            assert.equal(maskFrame.width, circleFrame.width + 28);
            assert.equal(maskFrame.height, circleFrame.height + 28);
          }
        }
        if (supportMode === "关闭") {
          assert.deepEqual(tree.nodes.find((node) => node.name === "intersection-native-base")?.frame, {
            left: 0, top: 0, width: 1170, height: 492, rotation: 0,
          });
        }
      }
    }
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("HTML → PPT 保留 CSS z-index 层叠顺序，而不是只按 DOM 顺序绘制", async () => {
  const component = {
    id: "stacking-order-fixture",
    designFrame: { width: 100, height: 100 },
    cssFile: "component.css",
    renderMarkup: () => `<section data-ppt-root style="position:relative;width:100px;height:100px">
      <span data-ppt-kind="shape" data-ppt-name="badge" style="position:absolute;left:0;top:20px;z-index:2;width:50px;height:50px;border-radius:50%;background:#2f5ea8"></span>
      <section data-ppt-kind="shape" data-ppt-name="card" style="position:absolute;left:30px;top:20px;width:70px;height:50px;border-radius:8px;background:#e7f1fc"></section>
    </section>`,
  };
  try {
    const tree = await resolveHtmlComponent({
      component,
      parameters: {},
      assetDir: matrixAssetDir,
      targetFrame: { left: 0, top: 0, width: 100, height: 100 },
    });
    assert.deepEqual(tree.nodes.find((node) => node.name === "badge")?.stackingPath, [2]);
    assert.deepEqual(tree.nodes.find((node) => node.name === "card")?.stackingPath, [0]);
    assert.deepEqual(sortResolvedVisualNodes(tree.nodes).map((node) => node.name), ["card", "badge"]);
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("1-N-1 组件使用 PPT 点数字号，并让上下语义标签共轴且由单一原生形状承载", async () => {
  const targetFrame = { left: 55, top: 166, width: 1170, height: 492 };
  try {
    for (const [component, parameters, assetDir, topName, bottomName, itemNumberName, itemTitleName] of [
      [argumentEvidenceVisualComponent, argumentPreviewParameters, argumentAssetDir, "claim-label", "therefore-badge", "evidence-number-0", "evidence-title-0"],
      [problemMethodVisualComponent, problemMethodPreviewParameters, problemMethodAssetDir, "problem-label", "result-badge", "method-number-0", "method-title-0"],
    ]) {
      const tree = await resolveHtmlComponent({ component, parameters, assetDir, targetFrame, theme: northeasternUniversityTheme });
      const top = tree.nodes.find((node) => node.name === topName);
      const bottom = tree.nodes.find((node) => node.name === bottomName);
      assert.equal(bottom?.kind, "shape-text");
      assert.equal(bottom?.style.fontSizePt, 14);
      assert.equal(Math.round((top.frame.left + top.frame.width / 2) * 10), Math.round((bottom.frame.left + bottom.frame.width / 2) * 10));
      assert.ok(Math.min(...tree.nodes.filter((node) => node.text).map((node) => node.style.fontSizePt)) >= 12);
      const itemNumber = tree.nodes.find((node) => node.name === itemNumberName);
      const itemTitle = tree.nodes.find((node) => node.name === itemTitleName);
      assert.ok(Math.abs((itemNumber.frame.top + itemNumber.frame.height / 2) - (itemTitle.frame.top + itemTitle.frame.height / 2)) <= 1);
      assert.ok(itemTitle.frame.left >= itemNumber.frame.left + itemNumber.frame.width);
      assert.equal(tree.slots.some((slot) => slot.role === "evidence-type" || slot.role === "method-type"), false);
      assert.equal(tree.nodes.some((node) => node.name?.startsWith("evidence-type-") || node.name?.startsWith("method-type-")), false);
    }
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

test("固定文本容器按规范档位选择最大可容纳字号，并保持 HTML 的单行结果", async () => {
  const component = {
    id: "discrete-font-fit-fixture",
    designFrame: { width: 220, height: 80 },
    cssFile: "component.css",
    renderMarkup: () => `<section data-ppt-root style="position:relative;width:220px;height:80px">
      <span data-ppt-kind="text" data-ppt-name="narrow-title" data-slot-id="title" data-slot-role="item-title" data-slot-field="title" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="4" data-slot-max-lines="1" style="position:absolute;left:0;top:0;width:88px;height:29px;overflow:hidden;font:700 var(--ppagent-component-item-title-size)/29px var(--ppagent-font-body);text-align:center;white-space:nowrap">行动转化</span>
      <span data-ppt-kind="text" data-ppt-name="compact-index" style="position:absolute;left:100px;top:0;display:grid;place-items:center;width:32px;height:32px;font:800 var(--ppagent-component-meta-size)/1 var(--ppagent-font-body)">01</span>
    </section>`,
  };
  try {
    const tree = await resolveHtmlComponent({
      component,
      parameters: {},
      assetDir: matrixAssetDir,
      targetFrame: { left: 0, top: 0, width: 220, height: 80 },
      theme: northeasternUniversityTheme,
    });
    const title = tree.nodes.find((node) => node.name === "narrow-title");
    const index = tree.nodes.find((node) => node.name === "compact-index");
    assert.equal(title?.style.originalFontSizePt, 18);
    assert.equal(title?.style.fontSizePt, 16);
    assert.equal(title?.style.fontFit, "reduced");
    assert.equal(title?.style.wrap, "none");
    assert.equal(index?.style.fontSizePt, 12);
    assert.equal(index?.style.fontFit, "unchanged");
    assert.equal(index?.style.wrap, "none");
    assert.equal(index?.style.alignment, "center");
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
