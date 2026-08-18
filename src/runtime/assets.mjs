import {
  discoverCoreAssetPackages,
  loadCoreAssetPackage,
} from "./core-asset-packages.mjs";

let htmlRuntimePromise = null;

function loadHtmlRuntime() {
  htmlRuntimePromise ??= import("../visual-runtime/html-component-runtime.mjs");
  return htmlRuntimePromise;
}

/** Metadata-only registry view. No asset implementation is imported here. */
export async function listStructureAssetBuilders(root = process.cwd()) {
  const packages = (await discoverCoreAssetPackages(root))
    .filter((item) => item.runtime.renderer !== "skin");
  return {
    defaultAssetIds: packages.map((item) => item.assetId).sort(),
    variantBuilderKeys: packages
      .map((item) => `${item.assetId}:${item.runtime.variantId}`)
      .sort(),
  };
}

export async function hasStructureAssetBuilder(assetId, variantId = null, root = process.cwd()) {
  const descriptor = (await discoverCoreAssetPackages(root))
    .find((item) => item.assetId === assetId && item.runtime.renderer !== "skin");
  return Boolean(descriptor && (!variantId || descriptor.runtime.variantId === variantId));
}

export async function renderStructureAsset(slide, renderPayload, skin, targetFrame = skin.bodyFrame) {
  const assetPackage = await loadCoreAssetPackage(renderPayload.assetId);
  if (assetPackage.runtime.renderer === "html-component") {
    const { compileResolvedVisualTree, resolveHtmlComponent } = await loadHtmlRuntime();
    const tree = await resolveHtmlComponent({
      component: assetPackage.component,
      assetDir: assetPackage.assetDir,
      variantId: assetPackage.runtime.variantId,
      parameters: renderPayload.parameters,
      targetFrame,
      theme: skin.componentTheme,
    });
    return compileResolvedVisualTree(slide, tree, targetFrame);
  }
  if (assetPackage.runtime.renderer === "legacy-builder") {
    const { renderComponentIntoSlide } = await import("../asset-runtime/component-builders.mjs");
    const embeddedParameters = {
      ...renderPayload.parameters,
      title: "核心结构",
    };
    return renderComponentIntoSlide(assetPackage.builder, slide, embeddedParameters, {
      sourceFrame: assetPackage.runtime.sourceFrame ?? skin.componentSourceFrame,
      targetFrame,
      theme: skin.componentTheme,
    });
  }
  throw new Error(`结构渲染器不能渲染 Skin 资产：${renderPayload.assetId}`);
}

export async function closeHtmlComponentRuntime() {
  if (!htmlRuntimePromise) return;
  const runtime = await htmlRuntimePromise;
  await runtime.closeHtmlComponentRuntime();
  htmlRuntimePromise = null;
}

export async function isSkinOnlyAsset(assetId, root = process.cwd()) {
  const descriptor = (await discoverCoreAssetPackages(root)).find((item) => item.assetId === assetId);
  return descriptor?.runtime.renderer === "skin";
}
