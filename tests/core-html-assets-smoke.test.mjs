import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createPresentation } from "../src/asset-runtime/component-builders.mjs";
import { discoverCoreAssetPackages } from "../src/runtime/core-asset-packages.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university-contract.mjs";
import {
  closeHtmlComponentRuntime,
  compileResolvedVisualTree,
  resolveHtmlComponent,
} from "../src/visual-runtime/html-component-runtime.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("每个核心 HTML 资产的一个黄金状态可编译且字号符合自身契约", async () => {
  const targetFrame = northeasternUniversitySkin.bodyFrame;
  const packages = (await discoverCoreAssetPackages(root)).filter((item) => item.runtime.renderer === "html-component");
  assert.ok(packages.length > 0);
  const presentation = createPresentation();
  try {
    for (const descriptor of packages) {
      const module = await import(pathToFileURL(descriptor.entryPath).href);
      const review = descriptor.runtime.review ?? {};
      const previewName = descriptor.runtime.previewParametersExport ?? review.previewParametersExport;
      const resolverName = descriptor.runtime.previewResolverExport ?? review.previewResolverExport;
      const component = module[descriptor.runtime.componentExport];
      const base = structuredClone(module[previewName]);
      const selection = structuredClone(review.goldenState?.selection ?? {});
      const parameters = resolverName ? module[resolverName](base, selection) : base;
      const tree = await resolveHtmlComponent({
        component,
        parameters,
        assetDir: descriptor.assetDir,
        targetFrame,
        theme: northeasternUniversitySkin.componentTheme,
      });
      const fontSizes = tree.nodes.filter((node) => node.text).map((node) => node.style?.fontSize).filter(Number.isFinite);
      assert.ok(fontSizes.length > 0, `${descriptor.assetId} 没有可检查文字`);
      const actualMinimum = Math.min(...fontSizes);
      const declaredMinimum = descriptor.asset.spatialContract?.minFontSize ?? 16;
      assert.ok(actualMinimum >= declaredMinimum, `${descriptor.assetId} 实际最小字号 ${actualMinimum} < 声明 ${declaredMinimum}`);
      assert.ok(actualMinimum >= 16, `${descriptor.assetId} 实际字号低于生产底线 16pt`);
      compileResolvedVisualTree(presentation.slides.add(), tree, targetFrame);
    }
  } finally {
    await closeHtmlComponentRuntime();
  }
});
