import baseProvider from "../为什么做PPagenT-v0.6.0/replay-provider.mjs";

function correctedIntent(intent) {
  if (intent.intentId !== "why-ppagent-v0.3.3-p08") return intent;
  return {
    ...intent,
    purposeKey: "present_parallel_points",
    purposeText: "并列说明组织视觉系统可以替换、底层经验能力可以复用，两项共同证明首个 Skin 不是产品最终边界。",
    baseRelation: "parallel",
    relationTraits: {
      ...intent.relationTraits,
      secondaryDimension: "category",
    },
    structure: {
      ...intent.structure,
      ordered: false,
      sameLevel: true,
      dimensions: {},
    },
    confidence: 0.99,
    assumptions: [
      "两项共同支撑扩展边界，不存在共同评价维度、优劣或二选一关系，因此不是比较。",
    ],
  };
}

function correctedCompositionPlan(plan) {
  const next = structuredClone(plan);
  const page = next.pages.find((entry) => entry.pageId === "p08");
  Object.assign(page, {
    compositionId: "editorial-focus-reverse",
    componentItemIds: [],
    componentContentMode: "none",
    textSlots: [
      { slotId: "primary", sourceItemIds: ["reuse-01"], contentMode: "full" },
      { slotId: "support", sourceItemIds: ["boundary-01"], contentMode: "full" },
    ],
    reason: "两项是共同支撑扩展边界的互补事实，不是比较；用右侧大主张突出可复用能力，并以左侧可替换 Skin 作为支持，避免与前页重复同一构图方向。",
  });
  return next;
}

function correctedVisualPlan(plan) {
  const next = structuredClone(plan);
  const page = next.pages.find((entry) => entry.pageId === "p08");
  Object.assign(page, {
    familyId: "skin-body-editorial",
    variantId: "editorial",
    silhouette: "editorial-page",
    adaptationStatus: "adaptive",
    reason: "可替换 Skin 与可复用能力共同说明产品可以跨场景扩展，不存在对照关系，因此选择文字主导主张页。",
  });
  return next;
}

export default {
  metadata: {
    providerKind: "frozen-director-replay",
    providerId: "ppagent-semantic-correction-v0.6.1",
    modelIdentity: "Codex development calibration; p08 parallel evidence correction",
    roles: ["content-director", "visual-director"],
    productionReviews: false
  },

  async contentDirector(args) {
    return baseProvider.contentDirector(args);
  },

  async visualDirector(args) {
    const result = await baseProvider.visualDirector(args);
    if (args.phase === "intent") {
      return { pageIntents: result.pageIntents.map(correctedIntent) };
    }
    if (args.phase === "composition") {
      return {
        ...result,
        visualPlan: correctedVisualPlan(result.visualPlan),
        compositionPlan: correctedCompositionPlan(result.compositionPlan),
      };
    }
    return result;
  },
};
