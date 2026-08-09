import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const projectRoot = "C:\\PPagenT";
const sourcePptx = path.join(projectRoot, "PPT模板-封面正文尾页.pptx");
const finalPptx = path.join(projectRoot, "outputs", "PPagenT-模板复现实验.pptx");
const qaDir = path.join(projectRoot, ".tmp", "template-poc", "standalone-final");

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function findExactText(presentation, slideNumber, sourceText) {
  const snapshot = await presentation.inspect({
    kind: "textbox",
    search: sourceText,
    maxChars: 12000,
  });
  const records = (snapshot.ndjson || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const matches = records.filter(
    (record) => record.slide === slideNumber && record.text === sourceText,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one exact text match on slide ${slideNumber}: ${sourceText}; found ${matches.length}`,
    );
  }
  return presentation.resolve(matches[0].id);
}

async function replaceText(presentation, slideNumber, sourceText, replacementText) {
  const target = await findExactText(presentation, slideNumber, sourceText);
  target.text.replace(sourceText, replacementText);
}

async function main() {
  await fs.mkdir(path.dirname(finalPptx), { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });

  const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePptx));
  const sourceSlides = [...presentation.slides.items];
  const selectedSlides = [
    sourceSlides[0].duplicate(),
    sourceSlides[2].duplicate(),
    sourceSlides[3].duplicate(),
  ];

  for (const slide of sourceSlides) slide.delete();
  selectedSlides.forEach((slide, index) => slide.moveTo(index));

  await replaceText(presentation, 1, "MDM方法偏移量自适应选取", "PPagenT 模板复现实验");
  await replaceText(presentation, 1, "汇报人：魏鹏宇", "汇报人：PPagenT");
  await replaceText(presentation, 1, "2026.07.20", "2026.08.08");

  await replaceText(presentation, 2, "主旨句", "模板复现结论");
  await replaceText(presentation, 2, "正文", "正文内容可以由代码写入");

  await replaceText(presentation, 3, "敬请老师批评指正", "谢谢观看");

  for (const [index, slide] of presentation.slides.items.entries()) {
    const padded = String(index + 1).padStart(2, "0");
    await writeBlob(
      path.join(qaDir, `final-slide-${padded}.png`),
      await presentation.export({ slide, format: "png", scale: 1 }),
    );
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(
      path.join(qaDir, `final-slide-${padded}.layout.json`),
      await layout.text(),
      "utf8",
    );
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
  console.log(finalPptx);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
