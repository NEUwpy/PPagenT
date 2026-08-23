function countChars(value) {
  return Array.from(String(value ?? "").trim()).length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function duplicateValues(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function compareIdSets(actual, expected, label, issues) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const unknown = [...actualSet].filter((id) => !expectedSet.has(id));
  const missing = [...expectedSet].filter((id) => !actualSet.has(id));
  if (unknown.length) issues.push({ field: label, code: "UNKNOWN_ITEM_REFERENCE", ids: unknown });
  if (missing.length) issues.push({ field: label, code: "UNASSIGNED_ITEM", ids: missing });
}

/** Validate relationships that JSON Schema cannot express across arrays. */
export function validateStructuredDataReferences(pageContent) {
  const issues = [];
  const items = pageContent.items ?? [];
  const itemIds = items.map((item) => item.id);
  const duplicateItemIds = duplicateValues(itemIds);
  if (duplicateItemIds.length) issues.push({ field: "items", code: "DUPLICATE_ITEM_ID", ids: duplicateItemIds });

  const structured = pageContent.structuredData;
  if (!structured) return issues;

  if (structured.type === "problem-solution") {
    const pairIds = structured.pairs.map((pair) => pair.id);
    const duplicates = duplicateValues(pairIds);
    if (duplicates.length) issues.push({ field: "structuredData.pairs", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(pairIds, itemIds, "structuredData.pairs", issues);
    const itemById = new Map(items.map((item) => [item.id, item]));
    structured.pairs.forEach((pair, index) => {
      const item = itemById.get(pair.id);
      if (item && (item.title !== pair.problem.title || item.body !== pair.problem.body)) {
        issues.push({ field: `structuredData.pairs[${index}]`, code: "PAIR_ITEM_MIRROR_MISMATCH", ids: [pair.id] });
      }
    });
  }

  if (structured.type === "problem-method-result") {
    compareIdSets(structured.methodIds, itemIds, "structuredData.methodIds", issues);
  }

  if (structured.type === "argument-evidence") {
    compareIdSets(structured.evidenceIds, itemIds, "structuredData.evidenceIds", issues);
  }

  if (structured.type === "branching-decision") {
    const branchIds = structured.branches.map((branch) => branch.id);
    const duplicates = duplicateValues(branchIds);
    if (duplicates.length) issues.push({ field: "structuredData.branches", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(branchIds, itemIds, "structuredData.branches", issues);
  }

  if (structured.type === "goal-strategy-metrics") {
    const strategyIds = structured.strategies.map((strategy) => strategy.id);
    const duplicates = duplicateValues(strategyIds);
    if (duplicates.length) issues.push({ field: "structuredData.strategies", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(strategyIds, itemIds, "structuredData.strategies", issues);
    const metricCounts = new Set(structured.strategies.map((strategy) => strategy.metrics.length));
    if (metricCounts.size > 1) issues.push({ field: "structuredData.strategies[].metrics", code: "INCONSISTENT_METRIC_COUNT" });
  }

  if (structured.type === "role-stage") {
    const stageIds = structured.stages.map((stage) => stage.id);
    const roleIds = structured.roles.map((role) => role.id);
    const assignmentIds = structured.assignments.map((assignment) => assignment.id);
    const duplicateStages = duplicateValues(stageIds);
    const duplicateRoles = duplicateValues(roleIds);
    const duplicateAssignments = duplicateValues(assignmentIds);
    if (duplicateStages.length) issues.push({ field: "structuredData.stages", code: "DUPLICATE_STAGE_ID", ids: duplicateStages });
    if (duplicateRoles.length) issues.push({ field: "structuredData.roles", code: "DUPLICATE_ROLE_ID", ids: duplicateRoles });
    if (duplicateAssignments.length) issues.push({ field: "structuredData.assignments", code: "DUPLICATE_REFERENCE", ids: duplicateAssignments });
    compareIdSets(assignmentIds, itemIds, "structuredData.assignments", issues);
    const stageSet = new Set(stageIds);
    const roleSet = new Set(roleIds);
    const cells = structured.assignments.map((assignment) => `${assignment.stageId}|${assignment.roleId}`);
    const duplicateCells = duplicateValues(cells);
    if (duplicateCells.length) issues.push({ field: "structuredData.assignments", code: "DUPLICATE_STAGE_ROLE_CELL", ids: duplicateCells });
    structured.assignments.forEach((assignment, index) => {
      if (!stageSet.has(assignment.stageId)) issues.push({ field: `structuredData.assignments[${index}].stageId`, code: "UNKNOWN_STAGE_REFERENCE", ids: [assignment.stageId] });
      if (!roleSet.has(assignment.roleId)) issues.push({ field: `structuredData.assignments[${index}].roleId`, code: "UNKNOWN_ROLE_REFERENCE", ids: [assignment.roleId] });
    });
  }

  if (structured.type === "matrix") {
    const quadrantIds = structured.quadrants.map((quadrant) => quadrant.id);
    const duplicateQuadrants = duplicateValues(quadrantIds);
    if (duplicateQuadrants.length) issues.push({ field: "structuredData.quadrants", code: "DUPLICATE_QUADRANT_ID", ids: duplicateQuadrants });
    const assigned = structured.quadrants.flatMap((quadrant) => quadrant.itemIds);
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.quadrants[].itemIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.quadrants[].itemIds", issues);
  }

  if (structured.type === "convergence") {
    const inputIds = structured.inputs.map((input) => input.id);
    const phaseIds = structured.phases.map((phase) => phase.id);
    const duplicateInputs = duplicateValues(inputIds);
    const duplicatePhases = duplicateValues(phaseIds);
    if (duplicateInputs.length) issues.push({ field: "structuredData.inputs", code: "DUPLICATE_INPUT_ID", ids: duplicateInputs });
    if (duplicatePhases.length) issues.push({ field: "structuredData.phases", code: "DUPLICATE_PHASE_ID", ids: duplicatePhases });
    const assigned = structured.phases.flatMap((phase) => phase.stepIds);
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.phases[].stepIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.phases[].stepIds", issues);
  }

  return issues;
}

export function computeContentStats(pageContent) {
  if (pageContent.structuredData?.type === "problem-solution") {
    const pairs = pageContent.structuredData.pairs ?? [];
    const pairLengths = pairs.map((pair) => [
      pair.problem?.title,
      pair.problem?.body,
      pair.solution?.title,
      pair.solution?.body,
    ].reduce((sum, value) => sum + countChars(value), 0));
    const titles = pairs.flatMap((pair) => [pair.problem?.title, pair.solution?.title]).map(countChars);
    const bodies = pairs.flatMap((pair) => [pair.problem?.body, pair.solution?.body]).map(countChars);
    const maxItemChars = pairLengths.length ? Math.max(...pairLengths) : 0;
    const minItemChars = pairLengths.length ? Math.min(...pairLengths) : 0;
    const average = pairLengths.length ? pairLengths.reduce((sum, value) => sum + value, 0) / pairLengths.length : 0;
    return {
      titleChars: countChars(pageContent.title),
      itemCount: pairs.length,
      maxItemChars,
      avgItemChars: round(average),
      minItemChars,
      maxItemTitleChars: titles.length ? Math.max(...titles) : 0,
      maxItemBodyChars: bodies.length ? Math.max(...bodies) : 0,
      imbalanceRatio: minItemChars > 0 ? round(maxItemChars / minItemChars) : maxItemChars > 0 ? maxItemChars : 0,
    };
  }
  const items = pageContent.items ?? [];
  const itemTitleLengths = items.map((item) => countChars(item.title));
  const itemBodyLengths = items.map((item) => countChars(item.body));
  const itemPointLengths = items.map((item) => (
    (item.points ?? []).reduce((sum, point) => sum + countChars(point), 0)
  ));
  const itemLengths = items.map((item, index) => (
    itemTitleLengths[index] + itemBodyLengths[index] + itemPointLengths[index]
  ));
  const maxItemChars = itemLengths.length ? Math.max(...itemLengths) : 0;
  const minItemChars = itemLengths.length ? Math.min(...itemLengths) : 0;
  const average = itemLengths.length ? itemLengths.reduce((sum, value) => sum + value, 0) / itemLengths.length : 0;

  return {
    titleChars: countChars(pageContent.title),
    itemCount: items.length,
    maxItemChars,
    avgItemChars: round(average),
    minItemChars,
    maxItemTitleChars: itemTitleLengths.length ? Math.max(...itemTitleLengths) : 0,
    maxItemBodyChars: itemBodyLengths.length ? Math.max(...itemBodyLengths) : 0,
    imbalanceRatio: minItemChars > 0 ? round(maxItemChars / minItemChars) : maxItemChars > 0 ? maxItemChars : 0,
  };
}

export function enrichPageIntent(intentDraft, pageContent) {
  const contentStats = computeContentStats(pageContent);
  const dimensions = { ...(intentDraft.structure?.dimensions ?? {}) };
  const pointCounts = (pageContent.items ?? []).map((item) => item.points?.length ?? 0);
  const pointLengths = (pageContent.items ?? []).flatMap((item) => (
    (item.points ?? []).map((point) => countChars(point))
  ));
  dimensions.maxPointsPerItem = pointCounts.length ? Math.max(...pointCounts) : 0;
  dimensions.maxPointChars = pointLengths.length ? Math.max(...pointLengths) : 0;
  dimensions.totalPoints = pointCounts.reduce((sum, value) => sum + value, 0);
  if (intentDraft.baseRelation === "comparison" && pageContent.items?.length === 2) {
    const pointCount = (value) => Math.max(
      1,
      String(value ?? "").split(/\r?\n|[;；]/).map((item) => item.trim()).filter(Boolean).length,
    );
    dimensions.groups = 2;
    dimensions.itemsPerGroup = Math.max(...pageContent.items.map((item) => pointCount(item.body)));
  }
  return {
    ...intentDraft,
    schemaVersion: "1.1",
    structure: {
      ...intentDraft.structure,
      itemCount: contentStats.itemCount,
      dimensions,
    },
    contentStats,
  };
}

const LOGIC_INTENT_DEFAULTS = Object.freeze({
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

function hierarchyDepth(node) {
  if (!node) return 0;
  const childDepths = (node.children ?? []).map(hierarchyDepth);
  return 1 + (childDepths.length ? Math.max(...childDepths) : 0);
}

function inferredLogicId(pageContent) {
  if (pageContent.logicIntent?.logicId) return pageContent.logicIntent.logicId;
  if (pageContent.structuredData?.type === "problem-solution") return "problem-solution";
  if (pageContent.structuredData?.type === "problem-method-result") return "problem-solution";
  if (pageContent.structuredData?.type === "argument-evidence") return "argument-evidence";
  if (pageContent.structuredData?.type === "branching-decision") return "branching";
  if (pageContent.structuredData?.type === "goal-strategy-metrics") return "goal-alignment";
  if (pageContent.structuredData?.type === "role-stage") return "role-stage";
  if (pageContent.structuredData?.type === "matrix") return "matrix";
  if (pageContent.structuredData?.type === "convergence") return "convergence";
  if (pageContent.structuredData?.type === "hierarchy") return "hierarchy";
  const noteMatch = String(pageContent.notes ?? "").match(/PPagenT主关系=([a-z-]+)/);
  return noteMatch?.[1] ?? "editorial";
}

/**
 * Convert the content director's coarse Logic choice into the internal PageIntent contract.
 * This is deterministic: the visual director selects a Structure Group, but never reclassifies Logic.
 */
export function buildPageIntentFromContent(pageContent) {
  const logicId = inferredLogicId(pageContent);
  const defaults = LOGIC_INTENT_DEFAULTS[logicId] ?? {
    purposeKey: "summarize_research_method",
    baseRelation: "other",
  };
  const source = String(pageContent.sourceText ?? "");
  const temporal = logicId === "sequence"
    && /(?:\d{4}\s*年|第[一二三四五六七八九十\d]+阶段|时间轴|里程碑|路线图|历史|演进|年度|季度|月份|未来\s*\d+)/.test(source);
  const structure = {
    itemCount: pageContent.items?.length ?? 0,
    ordered: Boolean(defaults.ordered),
    sameLevel: Boolean(defaults.sameLevel),
    dimensions: { items: pageContent.items?.length ?? 0 },
  };
  if (logicId === "hierarchy") {
    structure.hierarchyDepth = hierarchyDepth(pageContent.structuredData?.root);
  }
  return enrichPageIntent({
    intentId: `${pageContent.pageId}-intent`,
    purposeKey: defaults.purposeKey,
    purposeText: pageContent.logicIntent?.reason ?? `按 ${logicId} 组织本页内容`,
    baseRelation: defaults.baseRelation,
    relationTraits: {
      temporal,
      cyclic: Boolean(defaults.cyclic),
      converging: Boolean(defaults.converging),
      branched: Boolean(defaults.branched),
      dimensions: defaults.dimensions ?? 1,
      secondaryDimension: defaults.secondaryDimension ?? "none",
    },
    structure,
    density: "unknown",
    emphasis: (pageContent.items ?? []).flatMap((item, index) => item.emphasis ? [index] : []),
    evidenceTypes: ["text"],
    confidence: 1,
    assumptions: pageContent.logicIntent ? [] : ["兼容旧 PageContent：程序根据结构字段或备注推断 Logic"],
  }, pageContent);
}
