import {
  buildCausalChain,
  buildRadialHubSplitWing,
  buildRoleHandoff,
  buildSequentialProcessRibbon,
  buildSequentialProcessStaircase,
  renderComponentIntoSlide,
} from "../asset-runtime/component-builders.mjs";
import { discoverCoreAssetPackages } from "./core-asset-packages.mjs";

const DEFAULT_BUILDERS = new Map();
const DEFAULT_SOURCE_FRAMES = new Map();
const VARIANT_SOURCE_FRAMES = new Map();

const VARIANT_BUILDERS = new Map([
  ["radial-hub-001:split-wing", buildRadialHubSplitWing],
  ["sequential-process-001:ribbon", buildSequentialProcessRibbon],
  ["sequential-process-001:staircase", buildSequentialProcessStaircase],
  ["sequential-process-001:role-handoff", buildRoleHandoff],
  ["sequential-process-001:causal-chain", buildCausalChain],
]);

const CORE_ASSET_PACKAGES = await discoverCoreAssetPackages();
const CORE_SKIN_ASSET_IDS = new Set(
  CORE_ASSET_PACKAGES
    .filter((item) => item.runtime.renderer === "skin")
    .map((item) => item.assetId),
);

for (const assetPackage of CORE_ASSET_PACKAGES) {
  if (!assetPackage.builder) continue;
  DEFAULT_BUILDERS.set(assetPackage.assetId, assetPackage.builder);
  if (assetPackage.runtime.sourceFrame) {
    DEFAULT_SOURCE_FRAMES.set(assetPackage.assetId, assetPackage.runtime.sourceFrame);
    VARIANT_SOURCE_FRAMES.set(
      `${assetPackage.assetId}:${assetPackage.runtime.variantId}`,
      assetPackage.runtime.sourceFrame,
    );
  }
  VARIANT_BUILDERS.set(
    `${assetPackage.assetId}:${assetPackage.runtime.variantId}`,
    assetPackage.builder,
  );
}

export function listStructureAssetBuilders() {
  return {
    defaultAssetIds: [...DEFAULT_BUILDERS.keys()].sort(),
    variantBuilderKeys: [...VARIANT_BUILDERS.keys()].sort(),
  };
}

export function hasStructureAssetBuilder(assetId, variantId = null) {
  if (variantId) return VARIANT_BUILDERS.has(`${assetId}:${variantId}`);
  return DEFAULT_BUILDERS.has(assetId);
}

export async function renderStructureAsset(slide, renderPayload, skin, targetFrame = skin.bodyFrame) {
  const variantId = renderPayload.parameters?.visualVariantId ?? null;
  const builder = variantId
    ? VARIANT_BUILDERS.get(`${renderPayload.assetId}:${variantId}`)
    : DEFAULT_BUILDERS.get(renderPayload.assetId);
  if (!builder) throw new Error(`运行时没有结构资产生成器：${renderPayload.assetId}`);
  const embeddedParameters = {
    ...renderPayload.parameters,
    // The Skin owns the visible page title. Component title limits only apply
    // to standalone showcases, where the builder draws that title itself.
    title: "核心结构",
  };
  const sourceFrame = variantId
    ? VARIANT_SOURCE_FRAMES.get(`${renderPayload.assetId}:${variantId}`)
    : DEFAULT_SOURCE_FRAMES.get(renderPayload.assetId);
  return renderComponentIntoSlide(builder, slide, embeddedParameters, {
    sourceFrame: sourceFrame ?? skin.componentSourceFrame,
    targetFrame,
    theme: skin.componentTheme,
  });
}

// Kept as a no-op while callers shed the former browser-backed formal runtime.
export async function closeHtmlComponentRuntime() {}

export function isSkinOnlyAsset(assetId) {
  return CORE_SKIN_ASSET_IDS.has(assetId);
}
