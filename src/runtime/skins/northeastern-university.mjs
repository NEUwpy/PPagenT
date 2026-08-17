import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  prepareTemplateMappedStarter,
} from "../../asset-runtime/template-utils.mjs";
import { closeHtmlComponentRuntime, isSkinOnlyAsset, renderStructureAsset } from "../assets.mjs";
import { fitChineseTextToFrame } from "../../render/chinese-typography.mjs";
import { loadCompositionLayouts } from "../../composition/layouts.mjs";
import { renderPageComposition } from "../../render/page-composition.mjs";
import { academicReportShell } from "../shells/academic-report.mjs";
import { northeasternUniversityTheme } from "./northeastern-university-theme.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const northeasternUniversitySkin = {
  id: "northeastern-university-001",
  shell: academicReportShell,
  bodyFrame: academicReportShell.slots.contentFrame,
  componentSourceFrame: academicReportShell.slots.contentFrame,
  componentTheme: northeasternUniversityTheme,
  typographyRoles: {
    // Windows exposes the installed 汉仪文润宋韵 U family under this canonical name.
    displayTypeface: "HYWenRunSongYun U",
    bodyTypeface: "Microsoft YaHei",
    coverTitle: { fontSizes: [64, 58, 52], maxLines: 2, lineHeight: 1.15 },
    coverSubtitle: { fontSizes: [30, 28, 26], maxLines: 2, lineHeight: 1.2 },
    coverMeta: { fontSizes: [24, 22, 20], maxLines: 2, lineHeight: 1.2 },
    agendaItems: { fontSizes: [24, 22, 20], maxLines: 5, lineHeight: 1.35 },
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
      dualTitle: { fontSizes: [32, 29, 26], maxLines: 2 },
      dualBody: { fontSizes: [21, 19, 17], maxLines: 7 },
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

  if (assetId === "northeastern-university-agenda-001") {
    const agendaFrame = { left: 135, top: 205, width: 1010, height: 350 };
    const agendaText = (page.payload.parameters.items ?? [])
      .map((item, itemIndex) => `${itemIndex + 1}. ${item}`)
      .join("\n");
    const agenda = fitSkinText(agendaText, agendaFrame, "agendaItems");
    return {
      sourceSlideNumber: 2,
      textEdits: [
        { sourceText: "目录", replacementText: page.payload.parameters.title || "目录" },
        {
          sourceText: "1. 定义问题\n2. 真参数未知如何实现“样本-最优偏移量”的选择\n3. 一些关于神经网络的验证\n4. 论文准备\n5. 下一个研究课题",
          replacementText: agenda.text,
          position: agendaFrame,
          textStyle: {
            typeface: northeasternUniversitySkin.typographyRoles.bodyTypeface,
            fontSize: agenda.fontSize,
            autoFit: "none",
            verticalAlignment: "middle",
          },
          writeMode: "replace-all",
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
  structureRenderer = renderStructureAsset,
}) {
  const starterPptx = path.join(path.dirname(outputPptx), ".runtime", "template-starter.pptx");
  let bodyPageNumber = 0;
  const recipes = pages.map((page) => {
    const isBody = ![
      "northeastern-university-cover-001",
      "northeastern-university-agenda-001",
      "northeastern-university-closing-001",
    ].includes(page.payload.assetId);
    if (isBody) bodyPageNumber += 1;
    return pageRecipe(page, isBody ? bodyPageNumber : 0, manuscriptSource);
  });
  await prepareTemplateMappedStarter({
    sourcePptx,
    sourceSlideNumbers: recipes.map((recipe) => recipe.sourceSlideNumber),
    starterPptx,
  });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
  const slides = await applyTemplateMappedRecipes(presentation, recipes);
  const layouts = await loadCompositionLayouts(projectRoot);

  try {
    for (const [index, page] of pages.entries()) {
      if (!page.composition) {
        if (!isSkinOnlyAsset(page.payload.assetId)) await structureRenderer(slides[index], page.payload, northeasternUniversitySkin);
        continue;
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
        await structureRenderer(slides[index], page.payload, northeasternUniversitySkin, componentFrame);
      }
    }

    await fs.mkdir(path.dirname(outputPptx), { recursive: true });
    const pptx = await PresentationFile.exportPptx(presentation);
    await pptx.save(outputPptx);
    if (qaDir) await exportTemplateMappedQa(presentation, qaDir);
    return outputPptx;
  } finally {
    await closeHtmlComponentRuntime();
  }
}
