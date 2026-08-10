import path from "node:path";
import { renderNortheasternUniversityDeck } from "../runtime/skins/northeastern-university.mjs";
import { auditRenderedDeck } from "../tools/audit-rendered-typography.mjs";

export function createNortheasternUniversityRenderer({ sourcePptx, outputPptx, manuscriptSource }) {
  if (!sourcePptx || !outputPptx) throw new Error("NEU renderer 需要 sourcePptx 和 outputPptx");
  return async function renderWorkflowDeck({
    outputDir,
    deckPlan,
    pageContents,
    pageIntents,
    compositionPlan,
    layoutDecisions,
    renderPayloads,
  }) {
    const qaDir = path.join(outputDir, "qa");
    const pages = pageContents.map((content, index) => ({
      meta: { sectionName: "核心观点" },
      content,
      intent: pageIntents[index],
      decision: layoutDecisions[index],
      payload: renderPayloads[index],
      composition: compositionPlan.pages[index],
    }));
    await renderNortheasternUniversityDeck({
      pages,
      sourcePptx: path.resolve(sourcePptx),
      outputPptx: path.resolve(outputPptx),
      qaDir,
      manuscriptSource,
    });
    const requiredQaSlides = layoutDecisions
      .map((decision, index) => [
        "northeastern-university-cover-001",
        "northeastern-university-closing-001",
      ].includes(decision.selectedAssetId) ? null : `slide-${String(index + 1).padStart(2, "0")}`)
      .filter(Boolean);
    const qualityAudit = await auditRenderedDeck(qaDir, {
      minimumFontSize: 16,
      tolerance: 0.5,
      requiredQaSlides,
    });
    if (qualityAudit.status !== "passed") {
      const error = new Error("确定性渲染质量门禁未通过；本次 PPT 不得交付");
      error.code = "RENDER_QUALITY_GATE_FAILED";
      error.qualityAudit = qualityAudit;
      throw error;
    }
    return {
      outputPptx: path.resolve(outputPptx),
      pageEvidence: pages.map((_, index) => path.join(qaDir, `slide-${String(index + 1).padStart(2, "0")}.png`)),
      montage: path.join(qaDir, "montage.webp"),
      qualityAudit,
    };
  };
}
