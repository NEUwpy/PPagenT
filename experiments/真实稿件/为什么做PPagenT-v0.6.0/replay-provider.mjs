import baseProvider from "../为什么做PPagenT-v0.5.0/replay-provider.mjs";

function v06VisualPlan(base) {
  const visualPlan = structuredClone(base);
  visualPlan.visualLanguage = "继承东北大学 Skin，以整页 CompositionPlan 编排内容；双向比较只调用忠实蒸馏自典型来源页的镜像双栏核心资产。";
  for (const page of visualPlan.pages) {
    if (["p03", "p08"].includes(page.pageId)) {
      page.silhouette = "symmetric-column-contrast";
      page.reason = page.pageId === "p03"
        ? "两种生成路线构成方向明确的对比，调用第 55 页蒸馏的镜像双栏；两侧保持等宽等高，右侧只用颜色和状态标记突出。"
        : "视觉规范与经验能力构成两个完整对象，调用同一核心双栏资产；单项模式仍保持对齐、承载面和右侧重点。";
    }
  }
  return visualPlan;
}

export default {
  metadata: {
    providerKind: "frozen-director-replay",
    providerId: "ppagent-faithful-distillation-v0.6.0",
    modelIdentity: "Codex development calibration; v0.5 composition with source-faithful comparison asset",
    roles: ["content-director", "visual-director"],
    productionReviews: false
  },

  async contentDirector(args) {
    return baseProvider.contentDirector(args);
  },

  async visualDirector(args) {
    const result = await baseProvider.visualDirector(args);
    if (args.phase === "composition") {
      return {
        ...result,
        visualPlan: v06VisualPlan(result.visualPlan),
      };
    }
    return result;
  },
};
