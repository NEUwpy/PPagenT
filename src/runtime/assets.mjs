import {
  buildComparison,
  buildCausalChain,
  buildCycleLoop,
  buildLayeredArchitecture,
  buildRadialHub,
  buildRadialHubSplitWing,
  buildRoleHandoff,
  buildSequentialProcess,
  buildSequentialProcessRibbon,
  buildSequentialProcessStaircase,
  renderComponentIntoSlide,
} from "../asset-runtime/component-builders.mjs";

const DEFAULT_BUILDERS = new Map([
  ["comparison-structure-001", buildComparison],
  ["cycle-loop-001", buildCycleLoop],
  ["layered-architecture-001", buildLayeredArchitecture],
  ["radial-hub-001", buildRadialHub],
  ["sequential-process-001", buildSequentialProcess],
]);

const VARIANT_BUILDERS = new Map([
  ["comparison-structure-001:default", buildComparison],
  ["cycle-loop-001:default", buildCycleLoop],
  ["layered-architecture-001:default", buildLayeredArchitecture],
  ["radial-hub-001:orbit", buildRadialHub],
  ["radial-hub-001:split-wing", buildRadialHubSplitWing],
  ["sequential-process-001:horizontal-cards", buildSequentialProcess],
  ["sequential-process-001:ribbon", buildSequentialProcessRibbon],
  ["sequential-process-001:staircase", buildSequentialProcessStaircase],
  ["sequential-process-001:role-handoff", buildRoleHandoff],
  ["sequential-process-001:causal-chain", buildCausalChain],
]);

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

export function renderStructureAsset(slide, renderPayload, skin) {
  const variantId = renderPayload.parameters?.visualVariantId ?? null;
  const builder = variantId
    ? VARIANT_BUILDERS.get(`${renderPayload.assetId}:${variantId}`)
    : DEFAULT_BUILDERS.get(renderPayload.assetId);
  if (!builder) throw new Error(`运行时没有结构资产生成器：${renderPayload.assetId}`);
  return renderComponentIntoSlide(builder, slide, renderPayload.parameters, {
    sourceFrame: skin.componentSourceFrame,
    targetFrame: skin.bodyFrame,
    theme: skin.componentTheme,
  });
}

export function isSkinOnlyAsset(assetId) {
  return new Set([
    "northeastern-university-cover-001",
    "northeastern-university-closing-001",
  ]).has(assetId);
}
