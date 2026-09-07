import {
  discoverCoreAssetPackages,
  loadCoreAssetPackage,
} from "./core-asset-packages.mjs";
import { countStructureItems } from "./structure-adaptation.mjs";

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

export async function renderStructureAsset(slide, renderPayload, skin, targetFrame = skin.bodyFrame, root = process.cwd()) {
  const resolved = await resolveStructureAsset(renderPayload, skin, targetFrame, root);
  return compileResolvedStructureAsset(slide, resolved);
}

function verifiedAdaptivePackage(assetPackage) {
  return assetPackage.asset?.spatialContract?.resizeMode === "adaptive"
    && assetPackage.runtime?.contract?.adaptationStatus === "verified";
}

export async function resolveStructureAsset(renderPayload, skin, targetFrame = skin.bodyFrame, root = process.cwd()) {
  const assetPackage = await loadCoreAssetPackage(renderPayload.assetId, root);
  if (assetPackage.runtime.renderer === "html-component") {
    const { resolveHtmlComponent } = await loadHtmlRuntime();
    const designFrame = assetPackage.component.designFrame;
    if (verifiedAdaptivePackage(assetPackage)) {
      if (typeof assetPackage.spatialResolver !== "function") {
        const error = new Error(`${assetPackage.assetId} 声明动态适配但没有可用空间 resolver`);
        error.code = "STRUCTURE_ADAPTATION_CAPABILITY_MISSING";
        throw error;
      }
      const requirement = await assetPackage.spatialResolver(
        renderPayload.parameters,
        targetFrame,
        { asset: assetPackage.asset, component: assetPackage.component, theme: skin.componentTheme },
      );
      if (!requirement?.ok) {
        const error = new Error(`${assetPackage.assetId} 的空间 resolver 没有返回可用结果`);
        error.code = "STRUCTURE_ADAPTATION_CAPABILITY_INVALID";
        error.assetId = assetPackage.assetId;
        throw error;
      }
      const tree = await resolveHtmlComponent({
        component: assetPackage.component,
        assetDir: assetPackage.assetDir,
        variantId: assetPackage.runtime.variantId,
        parameters: renderPayload.parameters,
        targetFrame,
        theme: skin.componentTheme,
        adaptation: { ...requirement, status: "verified" },
      });
      return { renderer: "html-component", tree, targetFrame, adaptation: requirement };
    }
    const stateCount = countStructureItems(renderPayload.parameters);
    const footprint = Number.isInteger(stateCount)
      ? assetPackage.asset?.spatialContract?.stateFootprints?.[String(stateCount)]
      : null;
    const requiresNaturalCrop = targetFrame.width + 0.5 < designFrame.width
      || targetFrame.height + 0.5 < designFrame.height;
    if (requiresNaturalCrop && footprint
      && targetFrame.width + 0.5 >= footprint.width
      && targetFrame.height + 0.5 >= footprint.height) {
      const tree = await resolveHtmlComponent({
        component: assetPackage.component,
        assetDir: assetPackage.assetDir,
        variantId: assetPackage.runtime.variantId,
        parameters: renderPayload.parameters,
        theme: skin.componentTheme,
      });
      return {
        renderer: "html-component",
        tree,
        targetFrame,
        compileOptions: { mode: "natural-crop", footprint },
      };
    }
    const tree = await resolveHtmlComponent({
      component: assetPackage.component,
      assetDir: assetPackage.assetDir,
      variantId: assetPackage.runtime.variantId,
      parameters: renderPayload.parameters,
      targetFrame,
      theme: skin.componentTheme,
    });
    return { renderer: "html-component", tree, targetFrame };
  }
  if (assetPackage.runtime.renderer === "legacy-builder") {
    return {
      renderer: "legacy-builder",
      builder: assetPackage.builder,
      parameters: { ...renderPayload.parameters, title: "核心结构" },
      sourceFrame: assetPackage.runtime.sourceFrame ?? skin.componentSourceFrame,
      targetFrame,
      theme: skin.componentTheme,
    };
  }
  throw new Error(`结构渲染器不能渲染 Skin 资产：${renderPayload.assetId}`);
}

export async function compileResolvedStructureAsset(slide, resolved) {
  if (resolved.renderer === "html-component") {
    const { compileResolvedVisualTree } = await loadHtmlRuntime();
    return compileResolvedVisualTree(slide, resolved.tree, resolved.targetFrame, resolved.compileOptions);
  }
  if (resolved.renderer === "legacy-builder") {
    const { renderComponentIntoSlide } = await import("../asset-runtime/component-builders.mjs");
    return renderComponentIntoSlide(resolved.builder, slide, resolved.parameters, {
      sourceFrame: resolved.sourceFrame,
      targetFrame: resolved.targetFrame,
      theme: resolved.theme,
    });
  }
  throw new Error(`未知已解析结构渲染器：${resolved?.renderer}`);
}

export async function closeHtmlComponentRuntime() {
  const runtime = await loadHtmlRuntime();
  await runtime.closeHtmlComponentRuntime();
  htmlRuntimePromise = null;
}

export async function isSkinOnlyAsset(assetId, root = process.cwd()) {
  const descriptor = (await discoverCoreAssetPackages(root)).find((item) => item.assetId === assetId);
  return descriptor?.runtime.renderer === "skin";
}
