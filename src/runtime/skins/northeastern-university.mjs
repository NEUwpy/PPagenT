import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  prepareTemplateMappedStarter,
} from "../../asset-runtime/template-utils.mjs";
import { isSkinOnlyAsset, renderStructureAsset } from "../assets.mjs";
import { wrapChineseText } from "../../render/chinese-typography.mjs";
import { loadCompositionLayouts } from "../../composition/layouts.mjs";
import { renderPageComposition } from "../../render/page-composition.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const northeasternUniversitySkin = {
  id: "northeastern-university-001",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentSourceFrame: { left: 40, top: 135, width: 1200, height: 520 },
  componentTheme: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    accent: "#2F5EA8",
    accentAlt: "#4C88E8",
    accentSoft: "#DCE9FA",
    cyan: "#78AEEF",
    dark: "#2B2B2B",
    body: "#404040",
    muted: "#6F7D91",
    line: "#AFC6E8",
    font: "Microsoft YaHei",
    typography: {
      componentHeading: 29,
      componentTitle: 26,
      componentItemTitle: 21,
      componentBody: 19,
      componentLabel: 18,
      componentMeta: 17,
    },
  },
};

function sourceNotes(page, manuscriptSource) {
  return [
    "[Sources]",
    `- 内容：${manuscriptSource}`,
    "- 视觉：PPT模板-封面正文尾页.pptx（用户提供的东北大学模板）",
    `- PPagenT：${page.intent.intentId} → ${page.decision.selectedAssetId}`,
    ...(page.composition ? [`- 整页编排：${page.composition.compositionId}`] : []),
    "[/Sources]",
  ].join("\n");
}

function pageRecipe(page, index, manuscriptSource) {
  const assetId = page.payload.assetId;
  const notes = sourceNotes(page, manuscriptSource);
  if (assetId === "northeastern-university-cover-001") {
    return {
      sourceSlideNumber: 1,
      textEdits: [
        { sourceText: "MDM方法偏移量自适应选取", replacementText: page.payload.parameters.title },
        {
          sourceText: "汇报人：魏鹏宇",
          replacementText: wrapChineseText(
            page.payload.parameters.subtitle
              || (page.payload.parameters.presenter ? `汇报人：${page.payload.parameters.presenter}` : ""),
            14,
          ),
          position: { left: 390, top: 448, width: 500, height: 150 },
          textStyle: { fontSize: 26, autoFit: "shrinkText", alignment: "center", verticalAlignment: "middle" },
        },
        { sourceText: "2026.07.20", replacementText: page.payload.parameters.date },
      ],
      notes,
    };
  }

  if (assetId === "northeastern-university-closing-001") {
    return {
      sourceSlideNumber: 4,
      textEdits: [
        { sourceText: "敬请老师批评指正", replacementText: page.payload.parameters.text },
      ],
      notes,
    };
  }

  return {
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "01", replacementText: String(index).padStart(2, "0") },
      { sourceText: "正文页", replacementText: page.meta.sectionName || "核心观点" },
      { sourceText: "主旨句", replacementText: page.content.title },
      { sourceText: "正文", replacementText: "", writeMode: "replace-all" },
    ],
    deletions: [
      { kind: "shape", name: "箭头: 下 9" },
      { kind: "image", name: "图片 10" },
    ],
    notes,
  };
}

export async function renderNortheasternUniversityDeck({
  pages,
  sourcePptx,
  outputPptx,
  qaDir,
  manuscriptSource,
}) {
  const starterPptx = path.join(path.dirname(outputPptx), ".runtime", "template-starter.pptx");
  const recipes = pages.map((page, index) => pageRecipe(page, index, manuscriptSource));
  await prepareTemplateMappedStarter({
    sourcePptx,
    sourceSlideNumbers: recipes.map((recipe) => recipe.sourceSlideNumber),
    starterPptx,
  });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
  const slides = await applyTemplateMappedRecipes(presentation, recipes);
  const layouts = await loadCompositionLayouts(projectRoot);

  pages.forEach((page, index) => {
    if (!page.composition) {
      if (!isSkinOnlyAsset(page.payload.assetId)) renderStructureAsset(slides[index], page.payload, northeasternUniversitySkin);
      return;
    }
    const layout = layouts.get(page.composition.compositionId);
    if (!layout) throw new Error(`Unknown composition layout: ${page.composition.compositionId}`);
    const { componentFrame } = renderPageComposition(
      slides[index],
      page.content,
      layout,
      page.composition,
      northeasternUniversitySkin.bodyFrame,
    );
    if (!isSkinOnlyAsset(page.payload.assetId)) {
      if (!componentFrame) throw new Error(`${page.composition.compositionId} is missing a component slot`);
      renderStructureAsset(slides[index], page.payload, northeasternUniversitySkin, componentFrame);
    }
  });

  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  if (qaDir) await exportTemplateMappedQa(presentation, qaDir);
  return outputPptx;
}
