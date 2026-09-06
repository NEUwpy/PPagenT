import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import JSZip from "jszip";
import { prepareTemplateMappedStarter, applyTemplateMappedRecipes, exportTemplateMappedQa } from "../../src/asset-runtime/template-utils.mjs";
import { addText } from "../../src/asset-runtime/component-builders.mjs";
import { renderStructureAsset, closeHtmlComponentRuntime } from "../../src/runtime/assets.mjs";
import { northeasternUniversitySkin as skin } from "../../src/runtime/skins/northeastern-university-contract.mjs";
import { textBlocks, fitBlock, regionFrame, TEXT_SKILL, layoutFeedback } from "./grid-project.mjs";

export async function buildGridDeck(root, project, pageIds, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  const pages = pageIds.map((id) => project.pages.find((p) => p.pageId === id));
  const starterPptx = path.join(outputDir, "starter.pptx");
  await prepareTemplateMappedStarter({ sourcePptx: path.join(root, "assets/主题/东北大学-001/runtime-template.pptx"), sourceSlideNumbers: pages.map(() => 3), starterPptx });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
  const recipes = pages.map((page) => ({
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "01", replacementText: String(project.pages.indexOf(page) + 1).padStart(2, "0") },
      { sourceText: "正文页", replacementText: "正文" },
      { sourceText: "主旨句", replacementText: page.title, position: { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 }, textStyle: { typeface: skin.typographyRoles.displayTypeface, fontSize: 32, alignment: "left", autoFit: "none" } },
      { sourceText: "正文", replacementText: "", writeMode: "replace-all" },
    ],
    deletions: [{ kind: "shape", name: "箭头: 下 9" }, { kind: "image", name: "图片 10" }],
    notes: `[Sources]\n- 稿件：${project.sourcePath}\n- Skin：assets/主题/东北大学-001/runtime-template.pptx\n[/Sources]\n\n完整 PageBrief：\n${page.claim}\n${page.items.map((i) => `${i.id} [${i.sourceIds.join(",")}]\n${i.sourceText}`).join("\n\n")}`,
  }));
  const slides = await applyTemplateMappedRecipes(presentation, recipes);
  let usedStructure = false;
  try {
    for (const [index, page] of pages.entries()) {
      for (const region of page.composition.regions) {
        if (region.skillId === TEXT_SKILL) {
          for (const block of textBlocks(region)) {
            const fit = fitBlock(block);
            if (!fit.fits) throw new Error(`文字无法放入 ${page.pageId}/${region.id}`);
            addText(slides[index], fit.text, block.frame, { name: `grid:${region.id}:${block.sourceItemId}:${block.role}`, fontSize: block.size, typeface: skin.typographyRoles.bodyTypeface, color: block.role === "title" ? "#2F5EA8" : "#404040", bold: block.role === "title", alignment: page.composition.alignment, verticalAlignment: "top", autoFit: "none" });
          }
        } else {
          usedStructure = true;
          await renderStructureAsset(slides[index], { assetId: region.skillId, parameters: { title: page.title, items: region.view.map((v) => ({ key: v.sourceItemId, title: v.title, body: v.body })) } }, skin, regionFrame(region), root);
        }
      }
    }
    const pptxPath = path.join(outputDir, "deck.pptx");
    await (await PresentationFile.exportPptx(presentation)).save(pptxPath);
    // Preserve reference themes byte-for-byte after the runtime export.
    const original = await JSZip.loadAsync(await fs.readFile(path.join(root, "assets/主题/东北大学-001/runtime-template.pptx")));
    const exported = await JSZip.loadAsync(await fs.readFile(pptxPath));
    for (const name of Object.keys(original.files).filter((n) => /^ppt\/theme\/theme[^/]*\.xml$/.test(n))) exported.file(name, await original.file(name).async("nodebuffer"));
    await fs.writeFile(pptxPath, await exported.generateAsync({ type: "nodebuffer" }));
    await exportTemplateMappedQa(presentation, path.join(outputDir, "qa"));
    const feedback = await Promise.all(pages.map(async (page, index) => {
      const layout = JSON.parse(await fs.readFile(path.join(outputDir, "qa", `slide-${String(index + 1).padStart(2, "0")}.layout.json`), "utf8"));
      return layoutFeedback(layout, page, page.composition);
    }));
    await fs.writeFile(path.join(outputDir, "feedback.json"), JSON.stringify(feedback, null, 2));
    return { pptxPath, feedback };
  } finally { if (usedStructure) await closeHtmlComponentRuntime(); }
}
