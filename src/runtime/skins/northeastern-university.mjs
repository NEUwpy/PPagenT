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
import { fitChineseTextToFrame } from "../../render/chinese-typography.mjs";
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
  typographyRoles: {
    displayTypeface: "汉仪文润宋韵 U",
    bodyTypeface: "Microsoft YaHei",
    coverTitle: { fontSizes: [64, 58, 52], maxLines: 2, lineHeight: 1.15 },
    coverSubtitle: { fontSizes: [30, 28, 26], maxLines: 2, lineHeight: 1.2 },
    coverMeta: { fontSizes: [24, 22, 20], maxLines: 2, lineHeight: 1.2 },
    pageTitle: { fontSizes: [32], maxLines: 1, lineHeight: 1.1 },
    closingTitle: { fontSizes: [52, 48, 44], maxLines: 3, lineHeight: 1.1 },
    composition: {
      leadTitle: { fontSizes: [30, 27, 24], maxLines: 4 },
      leadBody: { fontSizes: [19, 18, 17], maxLines: 6 },
      rowTitle: { fontSizes: [23, 21, 19], maxLines: 1 },
      rowBody: { fontSizes: [18, 17, 16], maxLines: 4 },
      asideTitle: { fontSizes: [27, 24, 22], maxLines: 4 },
      asideBody: { fontSizes: [18, 17, 16], maxLines: 8 },
      singleTitle: { fontSizes: [36, 32, 28], maxLines: 2 },
      singleBody: { fontSizes: [24, 22, 20], maxLines: 5 },
      singleSupport: { fontSizes: [19, 18, 17], maxLines: 3 },
    },
  },
};

function fitSkinText(value, frame, roleName, { preferSemanticBreaks = false } = {}) {
  const role = northeasternUniversitySkin.typographyRoles[roleName];
  const result = fitChineseTextToFrame(value, {
    ...frame,
    ...role,
    preferSemanticBreaks,
  });
  if (!result?.fits) {
    const error = new Error(`${roleName} 文本无法在 Skin 允许的字号档位内排下`);
    error.code = "SKIN_TEXT_FIT_FAILED";
    error.role = roleName;
    error.text = value;
    throw error;
  }
  return result;
}

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
    const titleFrame = { left: 16.98, top: 198.16, width: 1252.71, height: 169.4 };
    const subtitleFrame = { left: 240, top: 400, width: 800, height: 76 };
    const metaFrame = { left: 390, top: 548, width: 500, height: 72 };
    const title = fitSkinText(page.payload.parameters.title || "", titleFrame, "coverTitle", {
      preferSemanticBreaks: true,
    });
    const subtitleSource = page.payload.parameters.subtitle || "";
    const subtitle = subtitleSource
      ? fitSkinText(`— ${subtitleSource}`, subtitleFrame, "coverSubtitle", { preferSemanticBreaks: true })
      : { text: "", fontSize: northeasternUniversitySkin.typographyRoles.coverSubtitle.fontSizes[0] };
    const metaSource = [
      page.payload.parameters.presenter ? `汇报人：${page.payload.parameters.presenter}` : "",
      page.payload.parameters.organization || "",
      page.payload.parameters.date || "",
    ].filter(Boolean).join("｜");
    const meta = metaSource
      ? fitSkinText(metaSource, metaFrame, "coverMeta")
      : { text: "", fontSize: northeasternUniversitySkin.typographyRoles.coverMeta.fontSizes[0] };
    return {
      sourceSlideNumber: 1,
      textEdits: [
        {
          sourceText: "MDM方法偏移量自适应选取",
          replacementText: title.text,
          position: titleFrame,
          textStyle: {
            typeface: northeasternUniversitySkin.typographyRoles.displayTypeface,
            fontSize: title.fontSize,
            autoFit: "none",
            alignment: "center",
            verticalAlignment: "middle",
          },
        },
        {
          sourceText: "汇报人：魏鹏宇",
          replacementText: subtitle.text,
          position: subtitleFrame,
          textStyle: {
            typeface: northeasternUniversitySkin.typographyRoles.displayTypeface,
            fontSize: subtitle.fontSize,
            autoFit: "none",
            alignment: "center",
            verticalAlignment: "middle",
          },
        },
        {
          sourceText: "2026.07.20",
          replacementText: meta.text,
          position: metaFrame,
          textStyle: {
            typeface: northeasternUniversitySkin.typographyRoles.bodyTypeface,
            fontSize: meta.fontSize,
            autoFit: "none",
            alignment: "center",
            verticalAlignment: "middle",
          },
        },
      ],
      notes,
    };
  }

  if (assetId === "northeastern-university-closing-001") {
    const closingFrame = { left: 16.98, top: 198.16, width: 1252.71, height: 169.4 };
    const closing = fitSkinText(
      page.payload.parameters.text || "",
      closingFrame,
      "closingTitle",
      { preferSemanticBreaks: true },
    );
    return {
      sourceSlideNumber: 4,
      textEdits: [
        {
          sourceText: "敬请老师批评指正",
          replacementText: closing.text,
          position: closingFrame,
          textStyle: {
            typeface: northeasternUniversitySkin.typographyRoles.displayTypeface,
            fontSize: closing.fontSize,
            autoFit: "none",
            alignment: "center",
            verticalAlignment: "middle",
          },
        },
      ],
      notes,
    };
  }

  const bodyTitleFrame = { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 };
  const bodyTitle = fitSkinText(page.content.title, bodyTitleFrame, "pageTitle");
  return {
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "01", replacementText: String(index).padStart(2, "0") },
      { sourceText: "正文页", replacementText: page.meta.sectionName || "核心观点" },
      {
        sourceText: "主旨句",
        replacementText: bodyTitle.text,
        position: bodyTitleFrame,
        textStyle: {
          typeface: northeasternUniversitySkin.typographyRoles.displayTypeface,
          fontSize: bodyTitle.fontSize,
          autoFit: "none",
        },
      },
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
      northeasternUniversitySkin.typographyRoles,
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
