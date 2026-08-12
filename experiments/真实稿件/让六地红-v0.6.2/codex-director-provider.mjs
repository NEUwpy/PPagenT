import baseline from "../让六地红-v0.6.1/codex-director-provider.mjs";

const deckId = "liudi-red-v0.6.2";

function compositionPage(result, pageId) {
  const page = result.compositionPlan.pages.find((item) => item.pageId === pageId);
  if (!page) throw new Error(`视觉导演结果缺少 ${pageId}`);
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
    const comparison = result.pageContents.find((page) => page.pageId === "p02");
    comparison.items.find((item) => item.id === "high").polarity = "positive";
    comparison.items.find((item) => item.id === "low").polarity = "negative";
    return result;
  },

  async visualDirector(input) {
    const result = await baseline.visualDirector(input);
    if (input.phase === "intent") return result;
    result.visualPlan.deckId = deckId;
    result.compositionPlan.deckId = deckId;

    Object.assign(compositionPage(result, "p06"), {
      compositionId: "editorial-focus",
      componentItemIds: [],
      componentContentMode: "none",
      textSlots: [
        { slotId: "primary", sourceItemIds: ["vr-data"], contentMode: "full" },
        { slotId: "support", sourceItemIds: ["vr-course", "vr-reach", "vr-recognition"], contentMode: "full" },
      ],
      reason: "避免与相隔一页的正文列表重复，用主信息加支撑项呈现 VR 基地。",
    });
    Object.assign(compositionPage(result, "p11"), {
      compositionId: "editorial-single-focus",
      componentItemIds: [],
      componentContentMode: "none",
      textSlots: [
        { slotId: "primary", sourceItemIds: ["synthesis", "instruction"], contentMode: "full" },
      ],
      reason: "本页只有一个收束判断，总书记嘱托作为支撑证据进入同一单观点骨架。",
    });
    return result;
  },
};
