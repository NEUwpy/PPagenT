export const PAGE_ROLES = Object.freeze([
  "opening",
  "orientation",
  "problem",
  "explanation",
  "evidence",
  "comparison",
  "process",
  "decision",
  "recommendation",
  "summary",
  "closing",
]);

export const DENSITY_TARGETS = Object.freeze(["quiet", "balanced", "dense"]);
export const VISUAL_WEIGHTS = Object.freeze(["quiet", "normal", "anchor", "peak"]);
export const COMPOSITION_FAMILIES = Object.freeze([
  "cover",
  "agenda",
  "closing",
  "statement",
  "editorial-flow",
  "split",
  "cards",
  "comparison",
  "timeline",
  "flow",
  "matrix",
  "hierarchy",
  "network",
  "diagram",
]);

function textOf(...values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

export function derivePageRole({ page, deckPage, intent, index = 0, pageCount = 1 }) {
  const shellRole = page?.shellRole ?? page?.presentationRole;
  if (shellRole === "cover") return "opening";
  if (shellRole === "agenda") return "orientation";
  if (shellRole === "closing") return "closing";

  const text = textOf(page?.title, page?.coreMessage, deckPage?.narrativeJob);
  if (/(问题|痛点|挑战|风险|矛盾|why|problem|challenge)/i.test(text)) return "problem";
  if (/(证据|数据|结果|成果|验证|案例|evidence|result|proof|case)/i.test(text)) return "evidence";
  if (/(对比|比较|差异|取舍|versus|compare|comparison)/i.test(text) || intent?.baseRelation === "comparison") return "comparison";
  if (/(流程|路径|步骤|阶段|时序|process|workflow|timeline)/i.test(text)
    || new Set(["sequence", "progression", "cycle"]).has(intent?.baseRelation)) return "process";
  if (/(决策|选择|判断|取舍|decision|choice)/i.test(text)) return "decision";
  if (/(建议|方案|行动|下一步|recommend|action|next step)/i.test(text)) return "recommendation";
  if (/(总结|结论|回顾|收束|summary|conclusion|takeaway)/i.test(text) || index === pageCount - 1) return "summary";
  if (/(背景|现状|范围|议程|定义|context|background|scope)/i.test(text) || index === 0) return "orientation";
  return "explanation";
}

export function deriveDensityTarget(intent) {
  if (intent?.density === "high") return "dense";
  if (intent?.density === "low") return "quiet";
  return "balanced";
}

export function deriveVisualWeight(pageRole, densityTarget) {
  if (new Set(["decision", "summary"]).has(pageRole)) return "anchor";
  if (pageRole === "evidence" && densityTarget !== "dense") return "anchor";
  if (densityTarget === "quiet") return "quiet";
  return "normal";
}

export function compositionFamilyFor({ composition, candidate, intent, page }) {
  const id = String(composition?.id ?? composition ?? "").toLowerCase();
  const shellRole = page?.shellRole ?? page?.presentationRole;
  if (shellRole === "cover" || /cover/.test(id)) return "cover";
  if (shellRole === "agenda" || /agenda|contents/.test(id)) return "agenda";
  if (shellRole === "closing" || /closing|ending|end-page/.test(id)) return "closing";
  if (/timeline|time-line/.test(id)) return "timeline";
  if (/matrix/.test(id)) return "matrix";
  if (/comparison|compare/.test(id)) return "comparison";
  if (/dual|split|two-column/.test(id)) return "split";
  if (/single-focus|statement|hero/.test(id)) return "statement";
  if (/card|grid|list/.test(id) && intent?.baseRelation !== "matrix") return "cards";

  const relation = candidate?.expressionIntent?.baseRelation ?? intent?.baseRelation;
  if (relation === "comparison") return "comparison";
  if (relation === "matrix") return "matrix";
  if (new Set(["sequence", "progression", "cycle", "causal", "convergence", "branching"]).has(relation)) return "flow";
  if (new Set(["hierarchy", "layered"]).has(relation)) return "hierarchy";
  if (new Set(["hub", "network", "intersection"]).has(relation)) return "network";
  if (composition?.requiresComponent) return "diagram";
  return "editorial-flow";
}

export function summarizeRhythmPages(pages) {
  const normalizedPages = pages.map((page) => ({
    pageId: page.pageId,
    pageRole: page.pageRole,
    densityTarget: page.densityTarget,
    visualWeight: page.visualWeight,
    compositionFamily: page.compositionFamily,
    ...(page.continuityGroup ? { continuityGroup: page.continuityGroup } : {}),
    ...(page.contrastBreakBefore ? { contrastBreakBefore: true } : {}),
  }));
  const grouped = new Map();
  for (const page of normalizedPages) {
    if (!page.continuityGroup) continue;
    const bucket = grouped.get(page.continuityGroup) ?? [];
    bucket.push(page.pageId);
    grouped.set(page.continuityGroup, bucket);
  }
  return {
    schemaVersion: "1.0",
    anchorPageIds: normalizedPages.filter((page) => new Set(["anchor", "peak"]).has(page.visualWeight)).map((page) => page.pageId),
    quietPageIds: normalizedPages.filter((page) => page.visualWeight === "quiet").map((page) => page.pageId),
    continuityGroups: [...grouped.entries()].map(([groupId, pageIds]) => ({ groupId, pageIds })),
    contrastBreaks: normalizedPages.filter((page) => page.contrastBreakBefore).map((page) => page.pageId),
    pages: normalizedPages,
  };
}

function candidateFamilies(candidate, intent, page) {
  return new Set((candidate?.compositions ?? []).map((composition) => (
    compositionFamilyFor({ composition, candidate, intent, page })
  )));
}

export function auditDeckRhythm({ visualPlan, candidateSets = [], pageContents = [], pageIntents = [] }) {
  const pages = visualPlan?.pages ?? [];
  const warnings = [];
  const candidateByPage = new Map(candidateSets.map((set) => [set.pageId, set]));

  for (let index = 2; index < pages.length; index += 1) {
    const run = pages.slice(index - 2, index + 1);
    if (!run.every((page) => page.compositionFamily === run[0].compositionFamily)) continue;
    if (run[0].continuityGroup && run.every((page) => page.continuityGroup === run[0].continuityGroup)) continue;
    const current = pages[index];
    const set = candidateByPage.get(current.pageId);
    const intent = pageIntents[index];
    const page = pageContents[index];
    const alternatives = new Set((set?.candidates ?? []).flatMap((candidate) => (
      [...candidateFamilies(candidate, intent, page)]
    )));
    alternatives.delete(current.compositionFamily);
    if (!alternatives.size) continue;
    warnings.push({
      pageId: current.pageId,
      code: "composition-family-three-in-row",
      compositionFamily: current.compositionFamily,
      previousPageIds: run.slice(0, 2).map((item) => item.pageId),
      legalAlternativeFamilies: [...alternatives],
    });
  }

  const bodyPages = pages.filter((page) => !new Set(["cover", "agenda", "closing"]).has(page.compositionFamily));
  if (bodyPages.length >= 5) {
    const familyCounts = new Map();
    bodyPages.forEach((page) => familyCounts.set(page.compositionFamily, (familyCounts.get(page.compositionFamily) ?? 0) + 1));
    const [dominantFamily, dominantCount] = [...familyCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
    const dominatedPagesHaveAlternatives = bodyPages
      .filter((page) => page.compositionFamily === dominantFamily)
      .some((rhythmPage) => {
        const index = pages.findIndex((page) => page.pageId === rhythmPage.pageId);
        const set = candidateByPage.get(rhythmPage.pageId);
        const alternatives = new Set((set?.candidates ?? []).flatMap((candidate) => (
          [...candidateFamilies(candidate, pageIntents[index], pageContents[index])]
        )));
        alternatives.delete(dominantFamily);
        return alternatives.size > 0;
      });
    if (dominantCount / bodyPages.length > 0.6 && dominatedPagesHaveAlternatives) {
      warnings.push({
        code: "composition-family-dominance",
        compositionFamily: dominantFamily,
        share: Number((dominantCount / bodyPages.length).toFixed(4)),
        pageIds: bodyPages.filter((page) => page.compositionFamily === dominantFamily).map((page) => page.pageId),
      });
    }
    if (new Set(bodyPages.map((page) => page.densityTarget)).size === 1) {
      warnings.push({
        code: "density-rhythm-flat",
        densityTarget: bodyPages[0].densityTarget,
        pageIds: bodyPages.map((page) => page.pageId),
      });
    }
    if (!bodyPages.some((page) => new Set(["anchor", "peak"]).has(page.visualWeight))) {
      warnings.push({ code: "visual-anchor-missing", pageIds: bodyPages.map((page) => page.pageId) });
    }
    const boxed = bodyPages.filter((page) => new Set(["cards", "matrix"]).has(page.compositionFamily));
    if (boxed.length / bodyPages.length > 0.6) {
      warnings.push({
        code: "boxed-layout-dominance",
        share: Number((boxed.length / bodyPages.length).toFixed(4)),
        pageIds: boxed.map((page) => page.pageId),
      });
    }
  }
  return { status: warnings.length ? "warning" : "accepted", warnings };
}
