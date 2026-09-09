import fs from "node:fs/promises";
import path from "node:path";

const here = import.meta.dirname;
const runSpecs = [
  { run: "first-draft-validated", regionFile: "regions-first-draft.json", metadataFile: "run-first-draft.json" },
  { run: "revision-01-validated", regionFile: "regions-revision-01.json", metadataFile: "run-revision-01.json" },
  { run: "revision-02-validated", regionFile: "regions-revision-02.json", metadataFile: "run-revision-02.json" },
];
const result = { runs: {}, checks: [] };

function inside(box, frame) {
  const [left, top, width, height] = Array.isArray(frame)
    ? frame
    : [frame.left, frame.top, frame.width, frame.height];
  return box[0] >= left - 0.5 && box[1] >= top - 0.5
    && box[0] + box[2] <= left + width + 0.5
    && box[1] + box[3] <= top + height + 0.5;
}

for (const { run, regionFile, metadataFile } of runSpecs) {
  const regions = JSON.parse(await fs.readFile(path.join(here, regionFile), "utf8"));
  const metadata = JSON.parse(await fs.readFile(path.join(here, metadataFile), "utf8"));
  const renderDir = path.join(here, `renders-${run}`);
  const slides = [];
  for (const [index, arrangement] of ["visual-left", "visual-right", "visual-top"].entries()) {
    const layout = JSON.parse(await fs.readFile(path.join(renderDir, `slide-${index + 1}.layout.json`), "utf8"));
    const elements = layout.elements ?? [];
    const region = regions[arrangement];
    const ladder = elements.filter((e) => String(e.name ?? "").includes("maturity-"));
    const ladderInside = ladder.every((e) => inside(e.bbox, [region.visual.left, region.visual.top, region.visual.width, region.visual.height]));
    const narrativeText = elements.filter((e) => ["能力形成", "扩围三项边界"].includes(e.text)
      || String(e.text ?? "").startsWith("本方案失败："));
    const narrativeInside = narrativeText.every((e) => inside(e.bbox, [region.narrative.left, region.narrative.top, region.narrative.width, region.narrative.height]));
    const narrativeBodyText = elements.filter((e) => typeof e.text === "string"
      && e.text.trim()
      && inside(e.bbox, [region.narrative.left, region.narrative.top, region.narrative.width, region.narrative.height])
      && !narrativeText.includes(e)
      && !String(e.name ?? "").startsWith("maturity-"));
    const bodyText = elements.filter((e) => typeof e.text === "string" && (e.text.includes("可记录：") || e.text.includes("人员：") || e.text.includes("保持正文 18")));
    const bodyFonts = [...new Set(bodyText.flatMap((e) => (e.paragraphs ?? []).map((p) => p.resolvedTextStyle?.fontSize)).filter(Boolean))];
    const narrativeBodyFonts = [...new Set(narrativeBodyText.flatMap((e) => (e.paragraphs ?? []).map((p) => p.resolvedTextStyle?.fontSize)).filter(Boolean))];
    const headingFonts = [...new Set(narrativeText.flatMap((e) => (e.paragraphs ?? []).map((p) => p.resolvedTextStyle?.fontSize)).filter(Boolean))];
    const narrativeBodyInside = narrativeBodyText.every((e) => inside(e.bbox, [region.narrative.left, region.narrative.top, region.narrative.width, region.narrative.height]));
    const slideResult = {
      arrangement,
      slide: index + 1,
      ladderElements: ladder.length,
      ladderInsideVisual: ladderInside,
      narrativeHeadings: narrativeText.length,
      narrativeInside,
      narrativeBodyBoxes: narrativeBodyText.length,
      narrativeBodyInside,
      bodyFontSizes: bodyFonts,
      narrativeBodyFontSizes: narrativeBodyFonts,
      narrativeHeadingFontSizes: headingFonts,
      narrativeStatus: metadata.records[index]?.narrative?.status ?? "unknown",
      allTextBoxesWithinSlide: elements.filter((e) => e.kind === "shape" && Array.isArray(e.bbox)).every((e) => inside(e.bbox, [0, 0, 1280, 720])),
    };
    slides.push(slideResult);
  }
  result.runs[run] = slides;
}
result.checks = [
  "结构对象实际落在 reserveRegions 返回的 visual 区域内",
  "narrative 标题实际落在 reserveRegions 返回的 narrative 区域内",
  "narrative 正文实际落在 reserveRegions 返回的 narrative 区域内",
  "页外正文请求字号为 18，局部标题请求字号为 21",
  "所有导出对象边界位于 1280×720 页面内",
];
await fs.writeFile(path.join(here, "visual-audit.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
