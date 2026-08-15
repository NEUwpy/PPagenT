function countChars(value) {
  return Array.from(String(value ?? "").trim()).length;
}

export function normalizeSemanticRefinementRequests(requests, pageContents, candidateSets) {
  if (!Array.isArray(requests) || !requests.length) return [];
  const pages = new Map(pageContents.map((page) => [page.pageId, page]));
  const sets = new Map(candidateSets.map((set) => [set.pageId, set]));
  const normalized = [];
  const seenPages = new Set();

  for (const request of requests) {
    if (!request || seenPages.has(request.pageId)) continue;
    const page = pages.get(request.pageId);
    const candidate = sets.get(request.pageId)?.candidates?.find((item) => (
      item.familyId === request.familyId && item.variantId === request.variantId
    ));
    if (!page || !candidate || candidate.contentContract?.adaptationOwner === "visual-director") continue;
    if (!new Set(["optional", "required"]).has(candidate.contentContract?.points)) continue;
    const maxPointsPerItem = Math.min(candidate.textCapacity?.maxPointsPerItem ?? 0, 6);
    const maxPointChars = candidate.textCapacity?.maxPointChars ?? 0;
    if (maxPointsPerItem < 1 || maxPointChars < 1) continue;

    const items = new Map(page.items.map((item) => [item.id, item]));
    const itemIds = [...new Set(request.itemIds ?? [])].filter((id) => (
      items.has(id) && !(items.get(id).points?.length)
    ));
    if (!itemIds.length) continue;
    normalized.push({
      pageId: request.pageId,
      familyId: request.familyId,
      variantId: request.variantId,
      itemIds,
      maxPointsPerItem,
      maxPointChars,
      reason: request.reason,
    });
    seenPages.add(request.pageId);
  }
  return normalized;
}

export function refinementOutputSchema() {
  return {
    name: "ppagent_content_refinement",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["refinements"],
      properties: {
        refinements: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["pageId", "items"],
            properties: {
              pageId: { type: "string", minLength: 1 },
              items: {
                type: "array",
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["itemId", "points"],
                  properties: {
                    itemId: { type: "string", minLength: 1 },
                    points: {
                      type: "array",
                      minItems: 1,
                      maxItems: 6,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["text", "sourceFragment"],
                        properties: {
                          text: { type: "string", minLength: 1 },
                          sourceFragment: { type: "string", minLength: 1 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function applySemanticRefinements(pageContents, requests, output) {
  const requestByPage = new Map(requests.map((request) => [request.pageId, request]));
  const resultByPage = new Map((output?.refinements ?? []).map((result) => [result.pageId, result]));
  let changed = false;
  const report = [];
  const refinedPages = pageContents.map((page) => {
    const request = requestByPage.get(page.pageId);
    const result = resultByPage.get(page.pageId);
    if (!request || !result || !Array.isArray(result.items)) return page;
    const allowedIds = new Set(request.itemIds);
    const patches = new Map();
    for (const item of result.items) {
      if (!allowedIds.has(item.itemId) || !Array.isArray(item.points)) continue;
      const points = item.points
        .filter((point) => (
          point
          && countChars(point.text) > 0
          && countChars(point.text) <= request.maxPointChars
          && typeof point.sourceFragment === "string"
          && point.sourceFragment.length > 0
          && page.sourceText.includes(point.sourceFragment)
        ))
        .slice(0, request.maxPointsPerItem)
        .map((point) => point.text.trim());
      const uniquePoints = [...new Set(points)];
      if (uniquePoints.length) patches.set(item.itemId, uniquePoints);
    }
    if (!patches.size) {
      report.push({ pageId: page.pageId, status: "insufficient" });
      return page;
    }
    changed = true;
    report.push({
      pageId: page.pageId,
      status: "refined",
      items: [...patches].map(([itemId, points]) => ({ itemId, points })),
    });
    return {
      ...page,
      items: page.items.map((item) => (
        patches.has(item.id) ? { ...item, points: patches.get(item.id) } : item
      )),
    };
  });
  return { pageContents: refinedPages, changed, report };
}
