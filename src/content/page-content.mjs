import {
  hierarchyMatrixFromStructuredData,
  hierarchyMatrixIssues,
} from "./hierarchy-matrix.mjs";
import {
  LOGIC_INTENT_DEFAULTS,
  logicIdForStructuredData,
} from "./formal-logic-contract.mjs";

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

  if (structured.type === "hierarchy") {
    issues.push(...hierarchyMatrixIssues(hierarchyMatrixFromStructuredData(structured)));
  }

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

  if (structured.type === "multi-set-common-intersection") {
    compareIdSets(structured.setIds, itemIds, "structuredData.setIds", issues);
  }

  if (structured.type === "iceberg-visible-hidden") {
    const assigned = [...structured.visibleIds, ...structured.hiddenIds];
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.visibleIds/hiddenIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.visibleIds/hiddenIds", issues);
  }

  if (structured.type === "decision-tradeoff") {
    const assigned = [...structured.benefitIds, ...structured.riskIds];
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.benefitIds/riskIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.benefitIds/riskIds", issues);
  }

  if (structured.type === "internal-external-ecosystem") {
    const assigned = [...structured.internalIds, ...structured.externalIds];
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.internalIds/externalIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.internalIds/externalIds", issues);
    const actorSet = new Set(assigned);
    const internalSet = new Set(structured.internalIds);
    const externalSet = new Set(structured.externalIds);
    const signatures = structured.links.map((link) => [link.from, link.to].sort().join("::"));
    const duplicateLinks = duplicateValues(signatures);
    if (duplicateLinks.length) issues.push({ field: "structuredData.links", code: "DUPLICATE_NETWORK_LINK", ids: duplicateLinks });
    structured.links.forEach((link, index) => {
      if (!actorSet.has(link.from)) issues.push({ field: `structuredData.links[${index}].from`, code: "UNKNOWN_ITEM_REFERENCE", ids: [link.from] });
      if (!actorSet.has(link.to)) issues.push({ field: `structuredData.links[${index}].to`, code: "UNKNOWN_ITEM_REFERENCE", ids: [link.to] });
      if (link.from === link.to) issues.push({ field: `structuredData.links[${index}]`, code: "SELF_NETWORK_LINK", ids: [link.from] });
    });
    const validLinks = structured.links.filter((link) => actorSet.has(link.from) && actorSet.has(link.to) && link.from !== link.to);
    if (!validLinks.some((link) => internalSet.has(link.from) && internalSet.has(link.to))) {
      issues.push({ field: "structuredData.links", code: "MISSING_INTERNAL_NETWORK_LINK" });
    }
    if (!validLinks.some((link) => externalSet.has(link.from) && externalSet.has(link.to))) {
      issues.push({ field: "structuredData.links", code: "MISSING_EXTERNAL_NETWORK_LINK" });
    }
    if (!validLinks.some((link) => (internalSet.has(link.from) && externalSet.has(link.to)) || (externalSet.has(link.from) && internalSet.has(link.to)))) {
      issues.push({ field: "structuredData.links", code: "MISSING_CROSS_DOMAIN_NETWORK_LINK" });
    }
  }

  if (structured.type === "hub-tiered-ecosystem") {
    const assigned = [...structured.innerIds, ...structured.outerIds];
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.innerIds/outerIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.innerIds/outerIds", issues);
  }

  if (structured.type === "branching-decision") {
    const branchIds = structured.branches.map((branch) => branch.id);
    const duplicates = duplicateValues(branchIds);
    if (duplicates.length) issues.push({ field: "structuredData.branches", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(branchIds, itemIds, "structuredData.branches", issues);
  }

  if (structured.type === "branching-scenario") {
    const scenarioIds = structured.scenarios.map((scenario) => scenario.id);
    const duplicates = duplicateValues(scenarioIds);
    if (duplicates.length) issues.push({ field: "structuredData.scenarios", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(scenarioIds, itemIds, "structuredData.scenarios", issues);
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

  if (structured.type === "matrix-grid") {
    const rowIds = structured.rows.map((row) => row.id);
    const columnIds = structured.columns.map((column) => column.id);
    const duplicateRows = duplicateValues(rowIds);
    const duplicateColumns = duplicateValues(columnIds);
    if (duplicateRows.length) issues.push({ field: "structuredData.rows", code: "DUPLICATE_MATRIX_ROW", ids: duplicateRows });
    if (duplicateColumns.length) issues.push({ field: "structuredData.columns", code: "DUPLICATE_MATRIX_COLUMN", ids: duplicateColumns });
    const rowSet = new Set(rowIds);
    const columnSet = new Set(columnIds);
    const cellKeys = structured.cells.map((cell) => `${cell.rowId}|${cell.columnId}`);
    const duplicateCells = duplicateValues(cellKeys);
    if (duplicateCells.length) issues.push({ field: "structuredData.cells", code: "DUPLICATE_MATRIX_CELL", ids: duplicateCells });
    structured.cells.forEach((cell, index) => {
      if (!rowSet.has(cell.rowId)) issues.push({ field: `structuredData.cells[${index}].rowId`, code: "UNKNOWN_MATRIX_ROW", ids: [cell.rowId] });
      if (!columnSet.has(cell.columnId)) issues.push({ field: `structuredData.cells[${index}].columnId`, code: "UNKNOWN_MATRIX_COLUMN", ids: [cell.columnId] });
      if (structured.cellMode === "intensity" && !Number.isInteger(cell.intensity)) {
        issues.push({ field: `structuredData.cells[${index}].intensity`, code: "MISSING_MATRIX_INTENSITY" });
      }
    });
    const expectedCells = rowIds.flatMap((rowId) => columnIds.map((columnId) => `${rowId}|${columnId}`));
    const actualCellSet = new Set(cellKeys);
    const missingCells = expectedCells.filter((key) => !actualCellSet.has(key));
    if (missingCells.length) issues.push({ field: "structuredData.cells", code: "MISSING_MATRIX_CELL", ids: missingCells });
    const assigned = [
      ...structured.rows.map((row) => row.itemId).filter(Boolean),
      ...structured.cells.flatMap((cell) => cell.itemIds ?? []),
    ];
    const duplicates = duplicateValues(assigned);
    if (duplicates.length) issues.push({ field: "structuredData.rows[].itemId/structuredData.cells[].itemIds", code: "DUPLICATE_REFERENCE", ids: duplicates });
    compareIdSets(assigned, itemIds, "structuredData.rows[].itemId/structuredData.cells[].itemIds", issues);
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
  if (pageContent.structuredData?.type === "hierarchy") {
    const topology = hierarchyMatrixFromStructuredData(pageContent.structuredData);
    const nodes = topology?.layers.flat() ?? [];
    const lengths = nodes.map((node) => countChars(node.label) + countChars(node.role) + countChars(node.groupLabel));
    const maxItemChars = lengths.length ? Math.max(...lengths) : 0;
    const minItemChars = lengths.length ? Math.min(...lengths) : 0;
    const average = lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0;
    return {
      titleChars: countChars(pageContent.title),
      itemCount: Math.max(0, ...((topology?.layers.slice(1) ?? []).map((layer) => layer.length))),
      maxItemChars,
      avgItemChars: round(average),
      minItemChars,
      maxItemTitleChars: nodes.length ? Math.max(...nodes.map((node) => countChars(node.label))) : 0,
      maxItemBodyChars: nodes.length ? Math.max(...nodes.map((node) => countChars(node.role) + countChars(node.groupLabel))) : 0,
      imbalanceRatio: minItemChars > 0 ? round(maxItemChars / minItemChars) : maxItemChars > 0 ? maxItemChars : 0,
    };
  }
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

function hierarchyDepth(structuredData) {
  return hierarchyMatrixFromStructuredData(structuredData)?.layers.length ?? 0;
}

function progressionMode(pageContent) {
  const source = [
    pageContent.title,
    pageContent.logicIntent?.reason,
    pageContent.sourceText,
  ].filter(Boolean).join("\n");
  if (/(?:连续维度|连续区间|光谱|分布|一端是|另一端是|低[^，。；]{0,12}中[^，。；]{0,12}高|中间区域|重点区域)/.test(source)) {
    return "continuous-spectrum";
  }
  if (/(?:成熟度|等级|级别|门槛|分级|L[1-9]|当前级|目标级)/i.test(source)) {
    return "discrete-levels";
  }
  return "growth-path";
}

function inferredLogicId(pageContent) {
  if (pageContent.logicIntent?.logicId) return pageContent.logicIntent.logicId;
  const structuredLogicId = logicIdForStructuredData(pageContent.structuredData?.type);
  if (structuredLogicId) return structuredLogicId;
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
  const hierarchyTopology = logicId === "hierarchy" ? hierarchyMatrixFromStructuredData(pageContent.structuredData) : null;
  const hierarchyItemCount = hierarchyTopology
    ? Math.max(0, ...hierarchyTopology.layers.slice(1).map((layer) => layer.length))
    : 0;
  const structureItemCount = logicId === "hierarchy" ? hierarchyItemCount : (pageContent.items?.length ?? 0);
  const structure = {
    itemCount: structureItemCount,
    ordered: Boolean(defaults.ordered),
    sameLevel: Boolean(defaults.sameLevel),
    dimensions: { items: structureItemCount },
  };
  if (logicId === "hierarchy") {
    structure.hierarchyDepth = hierarchyDepth(pageContent.structuredData);
    structure.dimensions.levels = structure.hierarchyDepth;
  }
  if (pageContent.structuredData?.type === "matrix-grid") {
    structure.dimensions.rows = pageContent.structuredData.rows.length;
    structure.dimensions.columns = pageContent.structuredData.columns.length;
    structure.dimensions.cellMode = pageContent.structuredData.cellMode;
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
      ...(logicId === "progression" ? { progressionMode: progressionMode(pageContent) } : {}),
    },
    structure,
    density: "unknown",
    emphasis: (pageContent.items ?? []).flatMap((item, index) => item.emphasis ? [index] : []),
    evidenceTypes: ["text"],
    confidence: 1,
    assumptions: pageContent.logicIntent ? [] : ["兼容旧 PageContent：程序根据结构字段或备注推断 Logic"],
  }, pageContent);
}
