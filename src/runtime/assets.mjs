import {
  buildComparison,
  buildCycleLoop,
  buildLayeredArchitecture,
  buildRadialHub,
  buildSequentialProcess,
  renderComponentIntoSlide,
} from "../asset-runtime/component-builders.mjs";

const BUILDERS = new Map([
  ["comparison-structure-001", buildComparison],
  ["cycle-loop-001", buildCycleLoop],
  ["layered-architecture-001", buildLayeredArchitecture],
  ["radial-hub-001", buildRadialHub],
  ["sequential-process-001", buildSequentialProcess],
]);

export function renderStructureAsset(slide, renderPayload, skin) {
  const builder = BUILDERS.get(renderPayload.assetId);
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
