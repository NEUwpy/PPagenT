import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "../../ppt-engine/index.mjs";
import { addText } from "../../asset-runtime/component-builders.mjs";
import { renderPageComposition } from "../../render/page-composition.mjs";
import { renderStructureAsset, closeHtmlComponentRuntime } from "../legacy-structure-assets.mjs";
import { exportTemplateMappedQa } from "../../asset-runtime/template-utils.mjs";
import { neutralEditorialTheme } from "./neutral-editorial-theme.mjs";
import { northeasternUniversitySkin as baseSkin } from "./northeastern-university-contract.mjs";

export const neutralEditorialSkin = Object.freeze({
  id: "neutral-editorial-001",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentSourceFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: { ...neutralEditorialTheme, structureColorMode: "continuous-tone-v1" },
  typographyRoles: {
    ...baseSkin.typographyRoles,
    displayTypeface: neutralEditorialTheme.fonts?.display ?? "Noto Serif SC",
    bodyTypeface: neutralEditorialTheme.fonts?.body ?? "Noto Sans SC",
    composition: Object.fromEntries(Object.entries(baseSkin.typographyRoles.composition).map(([key, value]) => [
      key, { ...value, fontSizes: value.fontSizes.map(size => Math.max(12, Math.round(size * 0.78))) },
    ])),
  },
});

function rule(slide) {
  slide.shapes.add({ geometry: "line", position: { left: 338, top: 60.5, width: 882, height: 0 }, fill: "none", line: { style: "solid", fill: "#D7D4CA", width: 1 } });
}

function shell(slide, page, index) {
  slide.background.fill = "#F5F4EF";
  addText(slide, String(index + 1).padStart(2, "0"), { left: 56, top: 48, width: 24, height: 24 }, { name: "neutral-section-number", typeface: "Noto Sans SC", fontSize: 18, color: "#A35D4F", verticalAlignment: "middle" });
  addText(slide, page.content.title, { left: 91, top: 44, width: 230, height: 36 }, { name: "neutral-page-title", typeface: "Noto Serif SC", fontSize: 25, bold: true, color: "#201F1D", verticalAlignment: "middle" });
  rule(slide);
  addText(slide, "灰稿交接 · 正式生成", { left: 56, top: 679, width: 240, height: 18 }, { name: "neutral-footer-label", typeface: "Noto Sans SC", fontSize: 11, color: "#85837B", verticalAlignment: "middle" });
  addText(slide, String(index + 1).padStart(2, "0"), { left: 1198, top: 679, width: 26, height: 18 }, { name: "neutral-folio", typeface: "Noto Sans SC", fontSize: 11, color: "#85837B", alignment: "right", verticalAlignment: "middle" });
}

export async function renderNeutralEditorialDeck({ root, pages, outputPptx, qaDir, manuscriptSource, structureRenderer = renderStructureAsset }) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  try {
    for (const [index, page] of pages.entries()) {
      const slide = presentation.slides.add();
      shell(slide, page, index);
      const skinOnly = page._skinOnly || page.payload?.assetId === "northeastern-university-cover-001";
      if (page.composition) {
        const { componentFrame } = renderPageComposition(slide, page.content, page._layout, page.composition, neutralEditorialSkin.bodyFrame, neutralEditorialSkin.typographyRoles);
        if (!skinOnly && page.payload && componentFrame) await structureRenderer(slide, page.payload, neutralEditorialSkin, componentFrame, root);
      } else if (!skinOnly && page.payload) {
        await structureRenderer(slide, page.payload, neutralEditorialSkin, neutralEditorialSkin.bodyFrame, root);
      }
      slide.speakerNotes.textFrame.setText(["[Sources]", `- 灰稿：${manuscriptSource}`, `- Skin：${neutralEditorialSkin.id}`, "[/Sources]"].join("\n"));
    }
    await fs.mkdir(path.dirname(outputPptx), { recursive: true });
    if (qaDir) await exportTemplateMappedQa(presentation, qaDir);
    await (await PresentationFile.exportPptx(presentation)).save(outputPptx);
    return outputPptx;
  } finally {
    await closeHtmlComponentRuntime();
  }
}
