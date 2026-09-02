function fail(message) {
  throw new Error(`PageExpressionPlan：${message}`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function contentRefIndex(pageContent) {
  const refs = new Map([["coreMessage", { kind: "core", value: pageContent.coreMessage }]]);
  for (const block of pageContent.contentBlocks ?? []) {
    refs.set(`blocks.${block.id}`, { kind: "block", value: block });
    for (const item of block.items ?? []) {
      refs.set(`blocks.${block.id}.items.${item.id}`, { kind: "item", block, value: item });
    }
  }
  return refs;
}

function requiredContentRefs(pageContent) {
  return [
    "coreMessage",
    ...(pageContent.contentBlocks ?? [])
      .filter((block) => block.required)
      .map((block) => `blocks.${block.id}`),
  ];
}

function walkExpressions(expressions, visitor, structureDepth = 0, parent = null) {
  for (const expression of expressions ?? []) {
    const nextDepth = structureDepth + (expression.type === "structure" ? 1 : 0);
    visitor(expression, { structureDepth: nextDepth, parent });
    walkExpressions(expression.children, visitor, nextDepth, expression);
  }
}

export function validatePageContentBlocks(pageContent) {
  if (!pageContent || pageContent.schemaVersion !== "0.1") fail("内容块契约版本必须为 0.1");
  if (!nonEmpty(pageContent.pageId) || !nonEmpty(pageContent.title)) fail("页面需要 pageId 与 title");
  if (!nonEmpty(pageContent.coreMessage?.markdown) || !pageContent.coreMessage?.sourceFragments?.length) {
    fail(`${pageContent.pageId} 的 coreMessage 必须包含 Markdown 与来源片段`);
  }
  if (!Array.isArray(pageContent.contentBlocks) || !pageContent.contentBlocks.length) {
    fail(`${pageContent.pageId} 至少需要一个 contentBlock`);
  }
  const blockIds = new Set();
  const itemRefs = new Set();
  for (const block of pageContent.contentBlocks) {
    if (!nonEmpty(block.id) || blockIds.has(block.id)) fail(`${pageContent.pageId} 存在空或重复 block id`);
    blockIds.add(block.id);
    if (!nonEmpty(block.role) || typeof block.required !== "boolean") fail(`${block.id} 缺少 role 或 required`);
    if (!Array.isArray(block.sourceFragments) || !block.sourceFragments.length) fail(`${block.id} 缺少来源片段`);
    if (!Array.isArray(block.items)) fail(`${block.id}.items 必须是数组`);
    if (!nonEmpty(block.markdown) && !block.items.length) fail(`${block.id} 必须有 Markdown 或 items`);
    for (const item of block.items) {
      const ref = `${block.id}.${item.id}`;
      if (!nonEmpty(item.id) || itemRefs.has(ref)) fail(`${block.id} 存在空或重复 item id`);
      itemRefs.add(ref);
      if (!nonEmpty(item.markdown) || !item.sourceFragments?.length || typeof item.required !== "boolean") {
        fail(`${block.id}.${item.id} 缺少 Markdown、来源或 required`);
      }
    }
  }
  for (const relation of pageContent.blockRelations ?? []) {
    if (!blockIds.has(relation.from) || !blockIds.has(relation.to)) {
      fail(`${pageContent.pageId} 的块关系引用了不存在的内容块`);
    }
  }
  return pageContent;
}

export function validatePageExpressionPlan(pageContent, plan, { maxStructureDepth = 2 } = {}) {
  validatePageContentBlocks(pageContent);
  if (!plan || plan.schemaVersion !== "0.1") fail("表达计划版本必须为 0.1");
  if (plan.pageId !== pageContent.pageId) fail(`计划 pageId ${plan.pageId} 与内容页 ${pageContent.pageId} 不一致`);
  if (!nonEmpty(plan.planId) || !nonEmpty(plan.compositionId)) fail("计划需要 planId 与 compositionId");
  if (!Array.isArray(plan.expressions) || !plan.expressions.length) fail(`${plan.pageId} 没有表达节点`);

  const availableRefs = contentRefIndex(pageContent);
  const coverage = new Map([...availableRefs.keys()].map((ref) => [ref, 0]));
  const expressionIds = new Set();
  let maximumDepth = 0;
  walkExpressions(plan.expressions, (expression, context) => {
    if (!nonEmpty(expression.expressionId) || expressionIds.has(expression.expressionId)) {
      fail(`${plan.pageId} 存在空或重复 expressionId`);
    }
    expressionIds.add(expression.expressionId);
    if (!new Set(["structure", "text", "media"]).has(expression.type)) fail(`${expression.expressionId} 的表达类型非法`);
    if (!nonEmpty(expression.regionKey)) fail(`${expression.expressionId} 缺少 regionKey`);
    if (!Array.isArray(expression.contentBindings) || !Array.isArray(expression.children)) {
      fail(`${expression.expressionId} 的 contentBindings/children 必须是数组`);
    }
    if (expression.type !== "structure" && expression.children.length) {
      fail(`${expression.expressionId} 只有 Structure 可以承载子表达`);
    }
    if (expression.type === "text" && !expression.text) fail(`${expression.expressionId} 缺少文字渲染决策`);
    if (expression.type === "structure" && !expression.structure) fail(`${expression.expressionId} 缺少 Structure Group 决策`);
    if (expression.type === "media" && !expression.media) fail(`${expression.expressionId} 缺少媒体适配决策`);
    maximumDepth = Math.max(maximumDepth, context.structureDepth);
    if (context.structureDepth > maxStructureDepth) {
      fail(`${expression.expressionId} 形成第 ${context.structureDepth} 层 Structure，超过上限 ${maxStructureDepth}`);
    }
    for (const binding of expression.contentBindings) {
      if (!availableRefs.has(binding.contentRef)) fail(`${expression.expressionId} 引用了不存在的 ${binding.contentRef}`);
      coverage.set(binding.contentRef, (coverage.get(binding.contentRef) ?? 0) + 1);
      const bound = availableRefs.get(binding.contentRef);
      if (bound.kind === "item") {
        const blockRef = `blocks.${bound.block.id}`;
        coverage.set(blockRef, (coverage.get(blockRef) ?? 0) + 1);
      }
    }
  });

  const missing = requiredContentRefs(pageContent).filter((ref) => coverage.get(ref) !== 1);
  if (missing.length) {
    fail(`${plan.pageId} 的必需内容必须恰好覆盖一次：${missing.map((ref) => `${ref}=${coverage.get(ref) ?? 0}`).join("，")}`);
  }
  return {
    status: "valid",
    maximumStructureDepth: maximumDepth,
    expressionCount: expressionIds.size,
    coverage: Object.fromEntries([...coverage].filter(([, count]) => count > 0)),
  };
}

export function resolveContentReference(pageContent, contentRef) {
  validatePageContentBlocks(pageContent);
  const resolved = contentRefIndex(pageContent).get(contentRef);
  if (!resolved) fail(`${pageContent.pageId} 不存在内容引用 ${contentRef}`);
  return resolved;
}

export function flattenExpressions(plan) {
  const result = [];
  walkExpressions(plan?.expressions ?? [], (expression, context) => result.push({
    expression,
    structureDepth: context.structureDepth,
    parentExpressionId: context.parent?.expressionId ?? null,
  }));
  return result;
}
