import {
  buildComparison,
  buildCausalChain,
  buildCycleLoop,
  buildLayeredArchitectureAdaptive,
  buildRadialHub,
  buildRadialHubSplitWing,
  buildProblemImprovement,
  buildRoleHandoff,
  buildSequentialProcess,
  buildSequentialProcessRibbon,
  buildSequentialProcessStaircase,
  buildSwimlaneProcess,
  renderComponentIntoSlide,
} from "../asset-runtime/component-builders.mjs";
import { buildOrganizationTree } from "../asset-runtime/history-organization-builders.mjs";
import { discoverCoreAssetPackages } from "./core-asset-packages.mjs";

const DEFAULT_BUILDERS = new Map([
  ["comparison-structure-001", buildComparison],
  ["cycle-loop-001", buildCycleLoop],
  ["layered-architecture-001", buildLayeredArchitectureAdaptive],
  ["radial-hub-001", buildRadialHub],
  ["sequential-process-001", buildSequentialProcess],
  ["swimlane-process-001", buildSwimlaneProcess],
  ["problem-improvement-001", buildProblemImprovement],
  ["organization-tree-001", buildOrganizationTree],
]);

const VARIANT_BUILDERS = new Map([
  ["comparison-structure-001:default", buildComparison],
  ["cycle-loop-001:default", buildCycleLoop],
  ["layered-architecture-001:default", buildLayeredArchitectureAdaptive],
  ["radial-hub-001:orbit", buildRadialHub],
  ["radial-hub-001:split-wing", buildRadialHubSplitWing],
  ["sequential-process-001:horizontal-cards", buildSequentialProcess],
  ["sequential-process-001:ribbon", buildSequentialProcessRibbon],
  ["sequential-process-001:staircase", buildSequentialProcessStaircase],
  ["sequential-process-001:role-handoff", buildRoleHandoff],
  ["sequential-process-001:causal-chain", buildCausalChain],
  ["swimlane-process-001:default", buildSwimlaneProcess],
  ["problem-improvement-001:default", buildProblemImprovement],
  ["organization-tree-001:default", buildOrganizationTree],
]);

for (const assetPackage of await discoverCoreAssetPackages()) {
  DEFAULT_BUILDERS.set(assetPackage.assetId, assetPackage.builder);
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

export function renderStructureAsset(slide, renderPayload, skin, targetFrame = skin.bodyFrame) {
  const variantId = renderPayload.parameters?.visualVariantId ?? null;
  const builder = variantId
    ? VARIANT_BUILDERS.get(`${renderPayload.assetId}:${variantId}`)
    : DEFAULT_BUILDERS.get(renderPayload.assetId);
  if (!builder) throw new Error(`运行时没有结构资产生成器：${renderPayload.assetId}`);
  return renderComponentIntoSlide(builder, slide, renderPayload.parameters, {
    sourceFrame: skin.componentSourceFrame,
    targetFrame,
    theme: skin.componentTheme,
  });
}

export function isSkinOnlyAsset(assetId) {
  return new Set([
    "northeastern-university-cover-001",
    "northeastern-university-closing-001",
    "northeastern-university-body-001",
  ]).has(assetId);
}
