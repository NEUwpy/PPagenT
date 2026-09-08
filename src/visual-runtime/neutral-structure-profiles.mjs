// Scope: the 35 structures with existing HTML and Native user approval (2026-09-08).
export const neutralStructureProfiles = Object.freeze([
  {
    "id": "hub-two-tier-capabilities-004",
    "rootClasses": [
      "two-tier-review"
    ]
  },
  {
    "id": "hub-radial-001",
    "rootClasses": [
      "hub-review"
    ]
  },
  {
    "id": "hub-directed-outcomes-002",
    "rootClasses": [
      "radial-review"
    ]
  },
  {
    "id": "comparison-pros-cons-balance-005",
    "rootClasses": [
      "balance-review"
    ]
  },
  {
    "id": "network-internal-external-ecosystem-001",
    "rootClasses": [
      "network-review"
    ]
  },
  {
    "id": "layered-iceberg-depth-006",
    "rootClasses": [
      "rev",
      "rev-iceberg"
    ]
  },
  {
    "id": "layered-architecture-001",
    "rootClasses": [
      "architecture-review"
    ]
  },
  {
    "id": "branching-decision-routes-001",
    "rootClasses": [
      "branching-decision-review"
    ]
  },
  {
    "id": "hierarchy-grouped-breakdown-005",
    "rootClasses": [
      "grouped-review"
    ]
  },
  {
    "id": "cycle-single-chain-feedback-002",
    "rootClasses": [
      "single-chain-feedback"
    ]
  },
  {
    "id": "comparison-dual-verdict-001",
    "rootClasses": [
      "comparison-review"
    ]
  },
  {
    "id": "parallel-folded-notes-grid-002",
    "rootClasses": [
      "notes-review",
      "notes-adapted"
    ]
  },
  {
    "id": "cycle-racetrack-loop-005",
    "rootClasses": [
      "cycle-racetrack-review"
    ]
  },
  {
    "id": "causal-mediator-chain-003",
    "rootClasses": [
      "mechanism"
    ]
  },
  {
    "id": "convergence-many-to-one-003",
    "rootClasses": [
      "merge"
    ]
  },
  {
    "id": "containment-multi-set-intersection-001",
    "rootClasses": [
      "intersection-review"
    ]
  },
  {
    "id": "cycle-loop-001",
    "rootClasses": [
      "cycle-review"
    ]
  },
  {
    "id": "branching-scenario-fan-004",
    "rootClasses": [
      "geo",
      "scenario"
    ]
  },
  {
    "id": "progression-maturity-steps-002",
    "rootClasses": [
      "maturity-ladder"
    ]
  },
  {
    "id": "goal-alignment-strategy-metrics-001",
    "rootClasses": [
      "goal-alignment-review"
    ]
  },
  {
    "id": "matrix-quadrant-priority-001",
    "rootClasses": [
      "matrix-review"
    ]
  },
  {
    "id": "parallel-equal-cards-001",
    "rootClasses": [
      "parallel-review"
    ]
  },
  {
    "id": "convergence-simple-funnel-001",
    "rootClasses": [
      "simple-funnel",
      "simple-funnel-adapted"
    ]
  },
  {
    "id": "matrix-cross-grid-003",
    "rootClasses": [
      "matrix-cross-grid"
    ]
  },
  {
    "id": "argument-evidence-conclusion-001",
    "rootClasses": [
      "argument-evidence-review"
    ]
  },
  {
    "id": "convergence-funnel-001",
    "rootClasses": [
      "funnel-review"
    ]
  },
  {
    "id": "progression-spectrum-focus-001",
    "rootClasses": [
      "spectrum-review"
    ]
  },
  {
    "id": "progression-growth-curve-004",
    "rootClasses": [
      "mountain-progress"
    ]
  },
  {
    "id": "problem-solution-outcome-001",
    "rootClasses": [
      "problem-solution-review"
    ]
  },
  {
    "id": "problem-method-result-001",
    "rootClasses": [
      "problem-method-review"
    ]
  },
  {
    "id": "role-stage-collaboration-001",
    "rootClasses": [
      "role-stage-review"
    ]
  },
  {
    "id": "sequence-phase-gates-004",
    "rootClasses": [
      "phase-gates-review"
    ]
  },
  {
    "id": "containment-consensus-field-005",
    "rootClasses": [
      "consensus-review"
    ]
  },
  {
    "id": "sequence-flow-001",
    "rootClasses": [
      "sequence-review"
    ]
  },
  {
    "id": "causal-fishbone-attribution-001",
    "rootClasses": [
      "causal-review"
    ]
  }
]);

export function supportsNeutralStructure(markup) {
 const root = String(markup).match(/<[^>]+data-ppt-root[^>]*>/)?.[0] ?? "";
 const classes = new Set(root.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? []);
 return neutralStructureProfiles.some(p => p.rootClasses.every(c => classes.has(c)));
}
