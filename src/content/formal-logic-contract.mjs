export const LOGIC_INTENT_DEFAULTS = Object.freeze({
  parallel: { purposeKey: "present_parallel_points", baseRelation: "parallel", sameLevel: true },
  sequence: { purposeKey: "explain_process", baseRelation: "sequence", ordered: true },
  cycle: { purposeKey: "explain_cycle", baseRelation: "cycle", ordered: true, cyclic: true },
  comparison: { purposeKey: "compare_options", baseRelation: "comparison", sameLevel: true },
  hierarchy: { purposeKey: "explain_hierarchy", baseRelation: "hierarchy", branched: true },
  layered: {
    purposeKey: "explain_layers",
    baseRelation: "layered",
    ordered: true,
    secondaryDimension: "layer",
  },
  progression: { purposeKey: "explain_evolution", baseRelation: "progression", ordered: true },
  hub: { purposeKey: "explain_topics", baseRelation: "hub", sameLevel: true },
  matrix: { purposeKey: "organize_matrix", baseRelation: "matrix", dimensions: 2, sameLevel: true },
  convergence: { purposeKey: "explain_conversion", baseRelation: "convergence", ordered: true, converging: true },
  causal: { purposeKey: "analyze_causes", baseRelation: "causal", converging: true },
  "problem-solution": {
    purposeKey: "connect_problems_and_solutions",
    baseRelation: "composite",
    converging: true,
  },
  "argument-evidence": {
    purposeKey: "support_claim_with_evidence",
    baseRelation: "composite",
    converging: true,
  },
  containment: {
    purposeKey: "explain_shared_scope",
    baseRelation: "intersection",
    sameLevel: true,
  },
  network: {
    purposeKey: "explain_internal_external_ecosystem",
    baseRelation: "network",
    sameLevel: true,
  },
  "goal-alignment": {
    purposeKey: "align_goal_and_metrics",
    baseRelation: "goal-alignment",
    sameLevel: false,
  },
  "role-stage": {
    purposeKey: "explain_cross_role_process",
    baseRelation: "sequence",
    ordered: true,
    dimensions: 2,
    secondaryDimension: "role",
  },
  branching: {
    purposeKey: "route_by_condition",
    baseRelation: "branching",
    branched: true,
  },
  editorial: { purposeKey: "summarize_research_method", baseRelation: "none" },
});

export const STRUCTURED_DATA_LOGIC_IDS = Object.freeze({
  hierarchy: "hierarchy",
  convergence: "convergence",
  "problem-solution": "problem-solution",
  "problem-method-result": "problem-solution",
  "argument-evidence": "argument-evidence",
  "multi-set-common-intersection": "containment",
  "iceberg-visible-hidden": "layered",
  "decision-tradeoff": "comparison",
  "internal-external-ecosystem": "network",
  "hub-tiered-ecosystem": "hub",
  "branching-decision": "branching",
  "branching-scenario": "branching",
  "goal-strategy-metrics": "goal-alignment",
  "role-stage": "role-stage",
  matrix: "matrix",
  "matrix-grid": "matrix",
});

export function logicIdForStructuredData(type) {
  return STRUCTURED_DATA_LOGIC_IDS[type] ?? null;
}
