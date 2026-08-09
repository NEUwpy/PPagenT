import path from "node:path";
import { renderNortheasternUniversityDeck } from "../runtime/skins/northeastern-university.mjs";

export function createNortheasternUniversityRenderer({ sourcePptx, outputPptx, manuscriptSource }) {
  if (!sourcePptx || !outputPptx) throw new Error("NEU renderer 需要 sourcePptx 和 outputPptx");
  return async function renderWorkflowDeck({
    outputDir,
    deckPlan,
    pageContents,
    pageIntents,
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
    }));
    await renderNortheasternUniversityDeck({
      pages,
      sourcePptx: path.resolve(sourcePptx),
      outputPptx: path.resolve(outputPptx),
      qaDir,
      manuscriptSource,
    });
    return {
      outputPptx: path.resolve(outputPptx),
      pageEvidence: pages.map((_, index) => path.join(qaDir, `slide-${String(index + 1).padStart(2, "0")}.png`)),
      montage: path.join(qaDir, "montage.webp"),
    };
  };
}
