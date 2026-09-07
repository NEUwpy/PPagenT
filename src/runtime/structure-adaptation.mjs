/**
 * Shared spatial adaptation contract for registered Structure Groups.
 *
 * The visual component remains the source of truth for its geometry.  This
 * module only records the small set of layout behaviours that the compiler may
 * use when a page gives a component a smaller or differently shaped region.
 * Keeping the profile beside the runtime contract lets discovery, composition
 * planning and the actual compiler agree on the same failure boundary.
 */

const PROFILE_DEFAULTS = Object.freeze({
  rail: Object.freeze({
    minimumFrame: Object.freeze({ width: 540, height: 250 }),
    axis: "horizontal",
    preserve: Object.freeze(["direction", "order", "connectors", "stage-roles"]),
  }),
  convergence: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 260 }),
    axis: "horizontal",
    preserve: Object.freeze(["fan-in", "single-result", "smooth-paths", "direction"]),
  }),
  branching: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 270 }),
    axis: "horizontal",
    preserve: Object.freeze(["fan-out", "branch-ownership", "direction"]),
  }),
  cycle: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 280 }),
    axis: "both",
    preserve: Object.freeze(["closed-loop", "direction", "step-order"]),
  }),
  radial: Object.freeze({
    minimumFrame: Object.freeze({ width: 540, height: 300 }),
    axis: "both",
    preserve: Object.freeze(["center-anchor", "radial-edges", "equal-phase"]),
  }),
  orbit: Object.freeze({
    minimumFrame: Object.freeze({ width: 620, height: 300 }),
    axis: "both",
    preserve: Object.freeze(["inner-outer-rings", "shared-outcome", "radial-edges"]),
  }),
  stack: Object.freeze({
    minimumFrame: Object.freeze({ width: 540, height: 280 }),
    axis: "vertical",
    preserve: Object.freeze(["layer-order", "stacked-silhouette", "depth-direction"]),
  }),
  iceberg: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 300 }),
    axis: "vertical",
    preserve: Object.freeze(["surface-boundary", "visible-hidden-split", "depth"]),
  }),
  grid: Object.freeze({
    minimumFrame: Object.freeze({ width: 480, height: 260 }),
    axis: "both",
    preserve: Object.freeze(["row-column-order", "cell-ownership", "equal-spacing"]),
  }),
  matrix: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 300 }),
    axis: "both",
    preserve: Object.freeze(["x-axis", "y-axis", "quadrants", "position"]),
  }),
  network: Object.freeze({
    minimumFrame: Object.freeze({ width: 600, height: 320 }),
    axis: "both",
    preserve: Object.freeze(["domains", "shared-core", "multi-edge-relations"]),
  }),
  parallel: Object.freeze({
    minimumFrame: Object.freeze({ width: 500, height: 250 }),
    axis: "both",
    preserve: Object.freeze(["same-level", "parallelism", "item-order"]),
  }),
  progression: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 270 }),
    axis: "horizontal",
    preserve: Object.freeze(["progression-direction", "milestones", "path-slope"]),
  }),
  swimlane: Object.freeze({
    minimumFrame: Object.freeze({ width: 600, height: 300 }),
    axis: "both",
    preserve: Object.freeze(["stage-order", "role-lanes", "handoffs"]),
  }),
  comparison: Object.freeze({
    minimumFrame: Object.freeze({ width: 520, height: 260 }),
    axis: "horizontal",
    preserve: Object.freeze(["two-polarities", "row-correspondence", "verdict"]),
  }),
  hierarchy: Object.freeze({
    minimumFrame: Object.freeze({ width: 560, height: 280 }),
    axis: "both",
    preserve: Object.freeze(["parent-child", "level-order", "ownership"]),
  }),
});

const PROFILE_BY_ASSET = Object.freeze({
  "argument-evidence-conclusion-001": "convergence",
  "branching-decision-routes-001": "branching",
  "branching-scenario-fan-004": "branching",
  "causal-fishbone-attribution-001": "convergence",
  "causal-mediator-chain-003": "rail",
  "comparison-dual-verdict-001": "comparison",
  "comparison-pros-cons-balance-005": "comparison",
  "containment-consensus-field-005": "parallel",
  "containment-multi-set-intersection-001": "parallel",
  "convergence-funnel-001": "convergence",
  "convergence-many-to-one-003": "convergence",
  "convergence-simple-funnel-001": "convergence",
  "cycle-loop-001": "cycle",
  "cycle-racetrack-loop-005": "cycle",
  "cycle-single-chain-feedback-002": "cycle",
  "goal-alignment-strategy-metrics-001": "hierarchy",
  "hierarchy-grouped-breakdown-005": "hierarchy",
  "hub-directed-outcomes-002": "radial",
  "hub-radial-001": "radial",
  "hub-two-tier-capabilities-004": "orbit",
  "layered-architecture-001": "stack",
  "layered-iceberg-depth-006": "iceberg",
  "matrix-cross-grid-003": "grid",
  "matrix-quadrant-priority-001": "matrix",
  "network-internal-external-ecosystem-001": "network",
  "parallel-equal-cards-001": "parallel",
  "parallel-folded-notes-grid-002": "grid",
  "problem-method-result-001": "convergence",
  "problem-solution-outcome-001": "convergence",
  "progression-growth-curve-004": "progression",
  "progression-maturity-steps-002": "progression",
  "progression-spectrum-focus-001": "progression",
  "role-stage-collaboration-001": "swimlane",
  "sequence-flow-001": "rail",
  "sequence-phase-gates-004": "rail",
});

function profileFromLogic(asset) {
  const logic = asset?.runtime?.logicId;
  if (logic === "sequence" || logic === "causal" || logic === "role-stage") return "rail";
  if (logic === "convergence" || logic === "argument-evidence" || logic === "problem-solution") return "convergence";
  if (logic === "branching") return "branching";
  if (logic === "cycle") return "cycle";
  if (logic === "hub") return "radial";
  if (logic === "layered") return "stack";
  if (logic === "matrix") return "matrix";
  if (logic === "network") return "network";
  if (logic === "parallel" || logic === "containment") return "parallel";
  if (logic === "progression") return "progression";
  if (logic === "hierarchy" || logic === "goal-alignment") return "hierarchy";
  if (logic === "comparison") return "comparison";
  return "parallel";
}

export function getStructureAdaptationProfile(assetOrId) {
  const asset = typeof assetOrId === "string" ? null : assetOrId;
  const id = typeof assetOrId === "string" ? assetOrId : asset?.id;
  const profileId = PROFILE_BY_ASSET[id] ?? profileFromLogic(asset);
  const defaults = PROFILE_DEFAULTS[profileId] ?? PROFILE_DEFAULTS.parallel;
  return Object.freeze({
    id: profileId,
    minimumFrame: { ...defaults.minimumFrame },
    axis: defaults.axis,
    preserve: [...defaults.preserve],
  });
}

export function isAdaptiveStructureAsset(asset) {
  return asset?.kind === "component"
    && asset?.runtime?.renderer === "html-component"
    && asset?.runtime?.contract?.adaptationStatus === "adaptive";
}

export function countStructureItems(parameters = {}) {
  const candidates = [
    parameters.items,
    parameters.inputs,
    parameters.steps,
    parameters.causes,
    parameters.layers,
    parameters.sides?.[0]?.items,
    parameters.rows,
    parameters.columns,
    parameters.factors,
    parameters.stages,
    parameters.actions,
    parameters.variables,
    parameters.scenarios,
    parameters.outcomes,
    parameters.phases,
    parameters.roles,
    parameters.domains,
    parameters.internal,
    parameters.external,
    parameters.groups,
    parameters.levels,
    parameters.nodes,
    parameters.points,
    parameters.pros,
    parameters.cons,
    parameters.benefits,
    parameters.costs,
    parameters.cells,
    parameters.quadrants,
  ];
  const counts = candidates.filter(Array.isArray).map((value) => value.length);
  if (Array.isArray(parameters.rows) && Array.isArray(parameters.columns)) {
    counts.push(parameters.rows.length * parameters.columns.length);
  }
  if (Array.isArray(parameters.internal) && Array.isArray(parameters.external)) {
    counts.push(parameters.internal.length + parameters.external.length);
  }
  return counts.length ? Math.max(...counts) : null;
}

function textCharacterCount(value) {
  if (typeof value === "string") return [...value].length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + textCharacterCount(item), 0);
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !["key", "id", "icon", "color", "value"].includes(key))
      .reduce((sum, [, item]) => sum + textCharacterCount(item), 0);
  }
  return 0;
}

export class StructureSpatialRequirementError extends Error {
  constructor({ code = "STRUCTURE_FRAME_UNSUPPORTED", assetId, targetFrame, requiredFrame, profile, itemCount, reason }) {
    super(
      `${assetId} 空间不足：${reason}；需要至少 ${requiredFrame.width}×${requiredFrame.height}，实际 ${Math.round(targetFrame.width)}×${Math.round(targetFrame.height)}`,
    );
    this.name = "StructureSpatialRequirementError";
    this.code = code;
    this.assetId = assetId;
    this.targetFrame = { ...targetFrame };
    this.requiredFrame = { ...requiredFrame };
    this.profile = profile;
    this.itemCount = itemCount;
    this.reason = reason;
    this.details = {
      actualFrame: { ...targetFrame },
      requiredFrame: { ...requiredFrame },
      assetId,
      profile,
      itemCount,
      reason,
    };
  }
}

export function resolveStructureSpatialRequirement(assetOrId, parameters = {}, targetFrame = null, options = {}) {
  const assetId = typeof assetOrId === "string" ? assetOrId : assetOrId?.id ?? "structure";
  const profile = getStructureAdaptationProfile(assetOrId);
  const itemCount = options.itemCount ?? countStructureItems(parameters);
  const minimum = adaptiveMinimumFrame(typeof assetOrId === "string" ? { id: assetId } : assetOrId, { itemCount });
  const characters = textCharacterCount(parameters);
  const textPressure = characters > 520 ? 1.2 : characters > 300 ? 1.1 : characters > 180 ? 1.04 : 1;
  const requiredFrame = {
    width: Math.ceil(minimum.width * textPressure),
    height: Math.ceil(minimum.height * textPressure),
  };
  const resolvedTarget = targetFrame
    ? { left: targetFrame.left ?? 0, top: targetFrame.top ?? 0, width: targetFrame.width, height: targetFrame.height }
    : null;
  if (resolvedTarget && (!Number.isFinite(resolvedTarget.width) || !Number.isFinite(resolvedTarget.height))) {
    throw new StructureSpatialRequirementError({
      code: "STRUCTURE_FRAME_UNSUPPORTED",
      assetId,
      targetFrame: { ...resolvedTarget, width: Number(resolvedTarget.width) || 0, height: Number(resolvedTarget.height) || 0 },
      requiredFrame,
      profile: profile.id,
      itemCount,
      reason: "targetFrame 无效",
    });
  }
  if (resolvedTarget && (resolvedTarget.width < requiredFrame.width || resolvedTarget.height < requiredFrame.height)) {
    throw new StructureSpatialRequirementError({
      code: characters > 180 ? "STRUCTURE_CONTENT_OVERFLOW" : "STRUCTURE_FRAME_UNSUPPORTED",
      assetId,
      targetFrame: resolvedTarget,
      requiredFrame,
      profile: profile.id,
      itemCount,
      reason: characters > 180 ? "文字密度超出当前结构的适配下界" : "当前结构的核心形态与内容槽位无法在该区域保持可读",
    });
  }
  return {
    ok: true,
    assetId,
    profile: profile.id,
    axis: profile.axis,
    preserve: profile.preserve,
    itemCount,
    requiredFrame,
    declaredMinimumFrame: minimum,
    targetFrame: resolvedTarget,
    reason: "profiled-adaptive-layout",
    verified: minimum.verified,
  };
}

export function adaptiveMinimumFrame(asset, { itemCount = null } = {}) {
  const profile = getStructureAdaptationProfile(asset);
  const declared = asset?.spatialContract?.adaptiveMinimumFrame;
  const base = declared && Number.isFinite(declared.width) && Number.isFinite(declared.height)
    ? declared
    : profile.minimumFrame;
  // The item count is deliberately only a small density guard.  The component
  // remains responsible for detailed text capacity and relation validation.
  const density = Number.isInteger(itemCount) && itemCount > 8 ? 1.08 : 1;
  return {
    width: Math.ceil(base.width * density),
    height: Math.ceil(base.height * density),
    profile: profile.id,
    basis: declared ? "asset-contract" : "profile-lower-bound",
    verified: Boolean(declared),
  };
}

export function resolveStructureAdaptation(asset, targetFrame, designFrame) {
  if (!isAdaptiveStructureAsset(asset)) return null;
  const profile = getStructureAdaptationProfile(asset);
  const normalizedTarget = {
    left: targetFrame.left,
    top: targetFrame.top,
    width: targetFrame.width,
    height: targetFrame.height,
  };
  const normalizedSource = {
    left: 0,
    top: 0,
    width: designFrame.width,
    height: designFrame.height,
  };
  const itemCount = null;
  return {
    mode: "adaptive",
    profile: profile.id,
    axis: profile.axis,
    preserve: profile.preserve,
    sourceFrame: normalizedSource,
    targetFrame: normalizedTarget,
    minimumFrame: adaptiveMinimumFrame(asset, { itemCount }),
    minFontSize: Number(asset.spatialContract?.minFontSize ?? 15),
    status: asset.runtime.contract.adaptationStatus,
  };
}

export function describeStructureAdaptation(asset) {
  if (!isAdaptiveStructureAsset(asset)) return null;
  const profile = getStructureAdaptationProfile(asset);
  const minimum = adaptiveMinimumFrame(asset);
  return {
    mode: "adaptive",
    profile: profile.id,
    axis: profile.axis,
    preserve: profile.preserve,
    minimumFrame: { width: minimum.width, height: minimum.height },
    minimumBasis: minimum.basis,
    verified: minimum.verified,
  };
}

export function adaptiveProfileCoverage() {
  return Object.entries(PROFILE_BY_ASSET).map(([assetId, profile]) => ({ assetId, profile }));
}
