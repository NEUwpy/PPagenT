import baseline from "../让六地红-v0.6.2/codex-director-provider.mjs";

const deckId = "liudi-red-v0.6.3";

function findPage(items, pageId, label) {
  const page = items.find((item) => item.pageId === pageId);
  if (!page) throw new Error(`${label} 缺少 ${pageId}`);
  return page;
}

export default {
  metadata: {
    providerKind: "codex-as-api-frozen-director",
    providerId: deckId,
    contentDirector: "Codex",
    visualDirector: "Codex",
  },

  async contentDirector(input) {
    const result = await baseline.contentDirector(input);
    result.deckPlan.deckId = deckId;
    const page = findPage(result.pageContents, "p11", "PageContent");
    page.items = [
      { id: "grasp-01", title: "研学链贯通血脉", body: "" },
      { id: "grasp-02", title: "任务单激发担当", body: "" },
      { id: "grasp-03", title: "VR跨越时空", body: "" },
      { id: "grasp-04", title: "宣讲团传递信仰", body: "" },
      { id: "grasp-05", title: "育人机制夯实成长", body: "" },
    ];
    page.notes = "红色基因";
    return result;
  },

  async visualDirector(input) {
    const result = await baseline.visualDirector(input);
    if (input.phase === "intent") {
      const page = result.pageIntents.find((item) => item.intentId === "i11");
      Object.assign(page, {
        purposeKey: "explain_topics",
        purposeText: "围绕红色基因呈现五个同级实践抓手",
        baseRelation: "hub",
        relationTraits: {
          temporal: false,
          cyclic: false,
          converging: false,
          branched: false,
          dimensions: 2,
          secondaryDimension: "category",
        },
        structure: { itemCount: 5, ordered: false, sameLevel: true },
      });
      return result;
    }

    result.visualPlan.deckId = deckId;
    result.compositionPlan.deckId = deckId;
    const candidateSet = findPage(input.candidateSets, "p11", "CandidateSet");
    const radial = candidateSet.candidates.find((candidate) => candidate.assetId === "radial-hub-001");
    if (!radial) throw new Error("p11 的五个同级抓手没有获得核心中心辐射资产");
    Object.assign(findPage(result.visualPlan.pages, "p11", "VisualPlan"), {
      familyId: radial.familyId,
      variantId: radial.variantId,
      silhouette: radial.silhouette,
      adaptationStatus: radial.adaptationStatus,
      reason: "五个明确抓手共同支撑红色基因，使用核心中心辐射资产的五节点扩散状态。",
    });
    Object.assign(findPage(result.compositionPlan.pages, "p11", "CompositionPlan"), {
      compositionId: "component-full",
      componentItemIds: ["grasp-01", "grasp-02", "grasp-03", "grasp-04", "grasp-05"],
      componentContentMode: "full",
      textSlots: [],
      reason: "五个抓手全部进入核心辐射组件，不再压成单段正文。",
    });
    return result;
  },
};
