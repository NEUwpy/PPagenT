function candidateId(candidate) {
  return [candidate.familyId, candidate.variantId, candidate.silhouette].join("::");
}

export function compactVisualSkillContext(pageContents, pageIntents, candidateSets) {
  return pageContents.map((page, index) => ({
    pageId: page.pageId,
    intentId: pageIntents[index].intentId,
    title: page.title,
    relation: pageIntents[index].baseRelation,
    purposeKey: pageIntents[index].purposeKey,
    items: page.items.map((item) => ({
      id: item.id, title: item.title, body: item.body, pointCount: item.points?.length ?? 0,
    })),
    candidates: candidateSets[index].candidates.map((candidate) => ({
      candidateId: candidateId(candidate),
      logicId: candidate.logicId,
      structureGroupId: candidate.structureGroupId,
      itemRange: candidate.itemCount,
      contentReadiness: candidate.contentReadiness ?? "ready",
      mediaMode: candidate.mediaContract?.mode ?? "no-image",
      iconsRequiredPerItem: Boolean(candidate.mediaContract?.requiredPerComponentItem),
      fallbackBody: Boolean(candidate.fallbackBody),
    })),
  }));
}

export function visualSkillRoutingSchema(pageContents, candidateSets) {
  const candidateIds = [...new Set(candidateSets.flatMap((set) => (
    set.candidates.map((candidate) => candidateId(candidate))
  )))];
  const pageIds = pageContents.map((page) => page.pageId);
  const itemIds = [...new Set(pageContents.flatMap((page) => page.items.map((item) => item.id)))];
  return {
    name: "ppagent_visual_skill_routing",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["selections"],
      properties: {
        selections: {
          type: "array",
          minItems: pageContents.length,
          maxItems: pageContents.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["pageId", "candidateId", "centerLabel", "iconQueries", "refinementItemIds", "reason"],
            properties: {
              pageId: { type: "string", enum: pageIds },
              candidateId: { type: "string", enum: candidateIds },
              centerLabel: { type: "string", minLength: 2, maxLength: 8 },
              iconQueries: {
                type: "array",
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["sourceItemId", "query"],
                  properties: {
                    sourceItemId: { type: "string", enum: itemIds },
                    query: { type: "string", minLength: 1, maxLength: 40 },
                  },
                },
              },
              refinementItemIds: {
                type: "array",
                maxItems: 6,
                uniqueItems: true,
                items: { type: "string", enum: itemIds },
              },
              reason: { type: "string", minLength: 1, maxLength: 120 },
            },
          },
        },
      },
    },
  };
}

function chooseComposition(candidate, page) {
  const compositions = candidate.compositions ?? [];
  const component = compositions.find((item) => item.requiresComponent);
  if (component) return component;
  const preferredId = page.items.length <= 1
    ? "editorial-single-focus"
    : page.items.length === 2
      ? "editorial-dual-statement"
      : "editorial-list";
  return compositions.find((item) => item.id === preferredId) ?? compositions[0];
}

function distributeTextSlots(page, composition) {
  const slots = (composition.slots ?? []).filter((slot) => slot.role === "text");
  if (!slots.length || !page.items.length) return [];
  if (slots.length === 1) {
    return [{ slotId: slots[0].id, sourceItemIds: page.items.map((item) => item.id), contentMode: "full" }];
  }
  const groups = Array.from({ length: slots.length }, () => []);
  page.items.forEach((item, index) => {
    const groupIndex = Math.min(slots.length - 1, Math.floor(index * slots.length / page.items.length));
    groups[groupIndex].push(item.id);
  });
  return slots.flatMap((slot, index) => (
    groups[index].length
      ? [{ slotId: slot.id, sourceItemIds: groups[index], contentMode: "full" }]
      : []
  ));
}

function buildComponentBindings(candidate, page) {
  const contracts = candidate.contentContract?.bindings ?? [];
  const bindings = [];
  for (const contract of contracts.filter((item) => item.scope === "per-component-item")) {
    for (const item of page.items) {
      const points = (item.points ?? []).map((point) => String(point?.text ?? point).trim()).filter(Boolean);
      if (points.length < contract.minItems) continue;
      bindings.push({
        bindingId: contract.id,
        sourceItemId: item.id,
        entries: points.slice(0, contract.maxItems).map((point) => ({ text: point, sourceFragment: point })),
      });
    }
  }
  return bindings.length ? bindings : undefined;
}

function routingError(message, details = {}) {
  const error = new Error(message);
  error.code = "MODEL_JSON_INVALID";
  error.details = details;
  return error;
}

export function expandVisualSkillRouting(routing, input) {
  const byPage = new Map();
  for (const selection of routing?.selections ?? []) {
    if (byPage.has(selection.pageId)) throw routingError("视觉路由重复返回页面", { pageId: selection.pageId });
    byPage.set(selection.pageId, selection);
  }
  const visualPages = [];
  const compositionPages = [];
  const semanticRefinementRequests = [];

  input.pageContents.forEach((page, index) => {
    const intent = input.pageIntents[index];
    const selection = byPage.get(page.pageId);
    if (!selection) throw routingError("视觉路由遗漏页面", { pageId: page.pageId });
    const selectedCandidate = input.candidateSets[index].candidates.find((item) => (
      candidateId(item) === selection.candidateId
    ));
    if (!selectedCandidate) throw routingError("视觉路由选择了该页不存在的 Structure Group", {
      pageId: page.pageId, candidateId: selection.candidateId,
    });
    const readyCoreCandidates = input.candidateSets[index].candidates.filter((item) => (
      !item.fallbackBody && (item.contentReadiness ?? "ready") === "ready"
    ));
    const candidate = readyCoreCandidates.length === 1 ? readyCoreCandidates[0] : selectedCandidate;
    const composition = chooseComposition(candidate, page);
    if (!composition) throw routingError("Structure Group 没有可用 Composition", { pageId: page.pageId });
    const validItemIds = new Set(page.items.map((item) => item.id));
    const iconQueries = (selection.iconQueries ?? []).filter((item) => validItemIds.has(item.sourceItemId));
    visualPages.push({
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
      adaptationStatus: candidate.adaptationStatus,
      ...(candidate.mediaContract?.mode === "semantic-icon" ? { iconQueries } : {}),
      reason: candidate === selectedCandidate
        ? selection.reason
        : "程序确认该页只有一个语义、数量与容量均适配的核心 Structure Group，直接调用",
    });
    const requiresComponent = Boolean(composition.requiresComponent);
    const bindings = requiresComponent ? buildComponentBindings(candidate, page) : undefined;
    const supportsCenterLabel = (candidate.slotCapabilities?.textSlots ?? [])
      .some((slot) => slot.role === "center-title");
    compositionPages.push({
      pageId: page.pageId,
      intentId: intent.intentId,
      compositionId: composition.id,
      componentItemIds: requiresComponent ? page.items.map((item) => item.id) : [],
      componentContentMode: requiresComponent ? "full" : "none",
      textSlots: requiresComponent ? [] : distributeTextSlots(page, composition),
      ...(bindings ? { componentBindings: bindings } : {}),
      ...(supportsCenterLabel ? {
        componentText: [{
          sourceField: "page-title",
          targetRole: "center-title",
          text: selection.centerLabel,
          sourceFragment: page.title,
        }],
      } : {}),
      reason: requiresComponent
        ? "Structure Group 承担完整页面内容，字段由正式 Slot Contract 确定性绑定"
        : "当前 Logic 无适配结构，使用主题正文 Composition 承载内容",
    });
    const refinementItemIds = [...new Set(selection.refinementItemIds ?? [])]
      .filter((itemId) => validItemIds.has(itemId));
    if (candidate.contentReadiness === "needs-semantic-refinement" && refinementItemIds.length) {
      semanticRefinementRequests.push({
        pageId: page.pageId,
        familyId: candidate.familyId,
        variantId: candidate.variantId,
        itemIds: refinementItemIds,
        reason: "所选 Structure Group 的节点内字段尚未满足合同",
      });
    }
  });

  return {
    visualPlan: {
      schemaVersion: "1.0",
      deckId: input.deckPlan.deckId,
      skinId: input.skinId,
      visualLanguage: "遵循所选主题与已确认 Structure Group 的统一设计语言",
      rhythmStrategy: "优先使用语义适配的核心结构，避免相邻页面机械重复",
      pages: visualPages,
    },
    compositionPlan: {
      schemaVersion: "1.0",
      deckId: input.deckPlan.deckId,
      skinId: input.skinId,
      pages: compositionPages,
    },
    semanticRefinementRequests,
  };
}
