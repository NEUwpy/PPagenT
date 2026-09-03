import fs from "node:fs/promises";
import path from "node:path";
import { renderNortheasternUniversityDeck } from "../runtime/skins/northeastern-university.mjs";
import { auditRenderedDeck } from "../tools/audit-rendered-typography.mjs";

function compactSectionName(intent, job) {
  const actionLabels = [
    ["揭示", "问题"],
    ["提出", "问题"],
    ["论证", "观点"],
    ["解释", "机制"],
    ["介绍", "机制"],
    ["阐述", "价值"],
    ["强调", "价值"],
    ["指明", "用户"],
    ["扩展", "受众"],
    ["说明", "积累"],
    ["深化", "认知"],
    ["总结", "收束"],
  ];
  const normalized = String(job ?? "").trim();
  const actionMatch = actionLabels.find(([prefix]) => normalized.startsWith(prefix));
  if (actionMatch) return actionMatch[1];
  return {
    comparison: "对比",
    sequence: "流程",
    hierarchy: "架构",
    layered: "分层",
    parallel: "要点",
  }[intent?.baseRelation] ?? "观点";
}

export function createNortheasternUniversityRenderer({
  root = process.cwd(),
  sourcePptx,
  templateSourceKind = "local-source",
  outputPptx,
  manuscriptSource,
}) {
  if (!sourcePptx || !outputPptx) throw new Error("NEU renderer 需要 sourcePptx 和 outputPptx");

  function workflowPages({ deckPlan, pageContents, pageIntents, visualPlan, compositionPlan, layoutDecisions, renderPayloads }) {
    return pageContents.map((content, index) => ({
      meta: { sectionName: compactSectionName(pageIntents[index], deckPlan.pages[index]?.narrativeJob) },
      narrativeJob: deckPlan.pages[index]?.narrativeJob ?? "",
      content,
      intent: pageIntents[index],
      visual: visualPlan?.pages?.[index] ?? {},
      decision: layoutDecisions[index],
      payload: renderPayloads[index],
      composition: compositionPlan.pages[index],
    }));
  }

  async function stageWorkflowDeck({
    outputDir,
    deckPlan,
    pageContents,
    pageIntents,
    visualPlan,
    compositionPlan,
    layoutDecisions,
    renderPayloads,
  }) {
    const qaDir = path.join(outputDir, "qa");
    const stagedPptx = path.join(outputDir, "staged-deck.pptx");
    const pages = workflowPages({ deckPlan, pageContents, pageIntents, visualPlan, compositionPlan, layoutDecisions, renderPayloads });
    await renderNortheasternUniversityDeck({
      root,
      pages,
      sourcePptx: path.resolve(sourcePptx),
      outputPptx: stagedPptx,
      qaDir,
      manuscriptSource,
      templateSourceKind,
    });
    const requiredQaSlides = layoutDecisions
      .map((decision, index) => [
        "northeastern-university-cover-001",
        "northeastern-university-agenda-001",
        "northeastern-university-closing-001",
      ].includes(decision.selectedAssetId) ? null : `slide-${String(index + 1).padStart(2, "0")}`)
      .filter(Boolean);
    const qualityAudit = await auditRenderedDeck(qaDir, {
      minimumFontSize: 12,
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
      schemaVersion: "1.0",
      status: "ready-for-approval",
      stagedPptx,
      pageEvidence: pages.map((_, index) => path.join(qaDir, `slide-${String(index + 1).padStart(2, "0")}.png`)),
      montage: path.join(qaDir, "montage.webp"),
      pageCount: pages.length,
      qualityAudit,
    };
  }

  const renderWorkflowDeck = async function renderWorkflowDeck({ stagingResult }) {
    if (!stagingResult?.stagedPptx) throw new Error("正式交付必须使用已经通过预览门禁的暂存 PPTX");
    const stagedPptx = path.resolve(stagingResult.stagedPptx);
    const finalPptx = path.resolve(outputPptx);
    await fs.mkdir(path.dirname(finalPptx), { recursive: true });
    await fs.copyFile(stagedPptx, finalPptx);
    return {
      outputPptx: finalPptx,
      pageEvidence: stagingResult.pageEvidence,
      montage: stagingResult.montage,
      nativePreview: {
        stagedPptx,
        pageCount: stagingResult.pageCount,
      },
      qualityAudit: stagingResult.qualityAudit,
    };
  };
  renderWorkflowDeck.stage = stageWorkflowDeck;
  return renderWorkflowDeck;
}
