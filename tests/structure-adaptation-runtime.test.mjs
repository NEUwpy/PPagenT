import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertSpatialFit,
  compositionCandidatesForAsset,
  loadCompositionLayouts,
} from "../src/composition/layouts.mjs";
import { inspectAssetManifestContract } from "../src/runtime/asset-manifest-contract.mjs";
import { tagComponentRuntimeOverflow } from "../src/runtime/skins/northeastern-university.mjs";
import {
  closeHtmlComponentRuntime,
  resolveHtmlComponent,
} from "../src/visual-runtime/html-component-runtime.mjs";

const root = path.resolve(import.meta.dirname, "..");

const page = {
  content: { pageId: "adaptive-page" },
  payload: { assetId: "adaptive-structure" },
};

test("结构尺寸与内容不足错误进入 production 的既有 overflow 反馈链", () => {
  for (const code of ["STRUCTURE_FRAME_UNSUPPORTED", "STRUCTURE_CONTENT_OVERFLOW"]) {
    const error = Object.assign(new Error("结构区域不足"), {
      code,
      details: {
        actualFrame: { left: 55, top: 166, width: 520, height: 260 },
        requiredFrame: { width: 560, height: 280 },
        reason: "核心形态与文字不能同时完整呈现",
      },
    });
    const tagged = tagComponentRuntimeOverflow(error, page);
    assert.equal(tagged.code, "COMPONENT_RUNTIME_OVERFLOW");
    assert.equal(tagged.structureErrorCode, code);
    assert.equal(tagged.pageId, page.content.pageId);
    assert.equal(tagged.assetId, page.payload.assetId);
    assert.deepEqual(tagged.targetFrame, error.details.actualFrame);
    assert.deepEqual(tagged.requiredFrame, error.details.requiredFrame);
    assert.equal(tagged.reason, error.details.reason);
  }
});

test("非容量类结构错误保持原错误码", () => {
  const error = Object.assign(new Error("运行入口缺失"), { code: "STRUCTURE_RUNTIME_BROKEN" });
  const tagged = tagComponentRuntimeOverflow(error, page);
  assert.equal(tagged.code, "STRUCTURE_RUNTIME_BROKEN");
  assert.equal(tagged.pageId, undefined);
});

function adaptiveManifest(status = "verified") {
  return {
    id: "adaptive-fixture",
    kind: "component",
    runtime: {
      renderer: "html-component",
      entry: "runtime.mjs",
      mapperExport: "mapContent",
      componentExport: "visualComponent",
      spatialResolverExport: "resolveSpatialRequirement",
      logicId: "sequence",
      structureGroupId: "adaptive-fixture",
      familyId: "sequence",
      variantId: "adaptive",
      silhouette: "rail",
      supportedBaseRelations: ["sequence"],
      itemCount: { min: 2, preferred: [3], max: 5 },
      contract: { adaptationStatus: status },
    },
    spatialContract: {
      resizeMode: "adaptive",
      contentFrame: { left: 55, top: 166, width: 1170, height: 492 },
      adaptiveMinimumFrame: { width: 100, height: 60 },
      supportedCompositionIds: ["component-full", "component-aside-right"],
      adaptation: { mode: "profiled-reflow" },
    },
  };
}

test("manifest 只有 verified 动态能力才能声明 adaptive", () => {
  assert.deepEqual(inspectAssetManifestContract(adaptiveManifest()).issues, []);
  assert.ok(inspectAssetManifestContract(adaptiveManifest("planned")).issues.some((issue) => (
    issue.includes("adaptationStatus=verified")
  )));
});

test("HTML runtime 只通过显式 adaptive renderer 在目标 viewport 重新求解", async () => {
  const component = {
    id: "adaptive-html-fixture",
    designFrame: { width: 240, height: 120 },
    cssText: "*{box-sizing:border-box}",
    renderMarkup: () => '<section data-ppt-root style="position:relative;width:240px;height:120px"><div data-ppt-kind="shape" style="width:240px;height:120px;background:#fff"></div></section>',
    renderAdaptiveMarkup: (_parameters, { frame }) => `<section data-ppt-root style="position:relative;width:${frame.width}px;height:${frame.height}px"><div data-ppt-kind="shape" data-ppt-name="adaptive-surface" style="position:absolute;inset:0;background:#fff"></div><span data-ppt-kind="text" data-ppt-name="adaptive-label" style="position:absolute;left:10px;top:10px;width:${frame.width - 20}px;height:30px;font:17pt/24pt sans-serif">动态排版</span></section>`,
  };
  try {
    const tree = await resolveHtmlComponent({
      component,
      parameters: {},
      assetDir: root,
      targetFrame: { left: 55, top: 166, width: 180, height: 90 },
      adaptation: { status: "verified", requiredFrame: { width: 160, height: 80 } },
    });
    assert.deepEqual(tree.frame, { width: 180, height: 90 });
    assert.equal(tree.nodes.find((node) => node.name === "adaptive-label")?.style.fontSizePt, 17);

    const missingCapability = { ...component };
    delete missingCapability.renderAdaptiveMarkup;
    await assert.rejects(
      resolveHtmlComponent({
        component: missingCapability,
        parameters: {},
        assetDir: root,
        targetFrame: { left: 55, top: 166, width: 180, height: 90 },
        adaptation: { status: "verified" },
      }),
      (error) => error.code === "STRUCTURE_ADAPTATION_CAPABILITY_MISSING",
    );
  } finally {
    await closeHtmlComponentRuntime();
  }
});

test("组合候选只向 verified adaptive 资产开放实际可容纳的局部槽位", async () => {
  const layouts = await loadCompositionLayouts(root);
  const metadata = adaptiveManifest();
  metadata.spatialContract.adaptiveMinimumFrame = { width: 500, height: 250 };
  metadata.spatialContract.supportedCompositionIds.push("component-lead-top");
  const bodyFrame = { left: 55, top: 166, width: 1170, height: 492 };
  const candidates = compositionCandidatesForAsset(layouts, metadata.id, metadata);
  assert.deepEqual(candidates.map((layout) => layout.id), [
    "component-full",
    "component-aside-right",
    "component-lead-top",
  ]);
  assert.doesNotThrow(() => assertSpatialFit(metadata, layouts.get("component-aside-right"), bodyFrame));

  metadata.spatialContract.adaptiveMinimumFrame = { width: 900, height: 250 };
  const narrower = compositionCandidatesForAsset(layouts, metadata.id, metadata);
  assert.deepEqual(narrower.map((layout) => layout.id), ["component-full", "component-lead-top"]);
  assert.throws(
    () => assertSpatialFit(metadata, layouts.get("component-aside-right"), bodyFrame),
    (error) => error.code === "STRUCTURE_FRAME_UNSUPPORTED"
      && error.requiredFrame.width === 900
      && error.targetFrame.width < 900,
  );
});
