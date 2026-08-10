import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import baseProvider from "../为什么做PPagenT-v0.3.3/replay-provider.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const compositionPlan = JSON.parse(await fs.readFile(path.join(experimentDir, "composition-plan.json"), "utf8"));
const compositionSha256 = crypto.createHash("sha256").update(JSON.stringify(compositionPlan)).digest("hex");
if (compositionSha256 !== "8902bff127e347a378803307fcf94d524ad7c2a6cc438ccbefa6159a3024147f") {
  throw new Error("Frozen CompositionPlan hash mismatch");
}

function v05VisualPlan(base) {
  const visualPlan = structuredClone(base);
  visualPlan.visualLanguage = "继承东北大学 Skin，以整页 CompositionPlan 先决定文字、结构和留白，再从核心资产库选择结构组件。";
  visualPlan.rhythmStrategy = "封面后交替使用编辑式文字页、结构图主导页和混合页；同一结构只在语义确实匹配时复用。";
  for (const page of visualPlan.pages) {
    if (["p02", "p07"].includes(page.pageId)) {
      page.familyId = "skin-body-editorial";
      page.variantId = "editorial";
      page.silhouette = "editorial-page";
      page.adaptationStatus = "adaptive";
      page.reason = page.pageId === "p02"
        ? "三类判断与关键追问采用编辑式清单，页面不调用结构图。"
        : "核心能力作为大主张，两条论据作为支持信息，页面不调用结构图。";
    }
    if (page.pageId === "p05") {
      page.reason = "调用核心顺序资产表达三段推进，但只在左侧承担结构骨架；右侧文字槽展开稳定交付的核心判断。";
    }
  }
  return visualPlan;
}

export default {
  metadata: {
    providerKind: "frozen-director-replay",
    providerId: "ppagent-composition-v0.5.0",
    modelIdentity: "Codex development calibration; frozen content with whole-page composition plan",
    roles: ["content-director", "visual-director"],
    productionReviews: false
  },

  async contentDirector(args) {
    return baseProvider.contentDirector(args);
  },

  async visualDirector(args) {
    if (args.phase === "intent") return baseProvider.visualDirector(args);
    if (args.phase === "composition") {
      const { visualPlan } = await baseProvider.visualDirector(args);
      return {
        visualPlan: v05VisualPlan(visualPlan),
        compositionPlan: structuredClone(compositionPlan),
      };
    }
    throw new Error(`Unknown visual director phase: ${args.phase}`);
  },
};
