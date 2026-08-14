import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDir, "..", "..", "..");
const sourcePptx = path.join(root, "PPT源", "狗哥蓝色-精美逻辑图PPT模板.pptx");
const outputDir = path.join(root, "experiments", "html-visual-skill-poc", "catalog-agenda-poc", "source-review");
const sourceSlideNumbers = Array.from({ length: 10 }, (_, index) => index + 4);

async function writeBlob(target, blob) {
  await fs.writeFile(target, new Uint8Array(await blob.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const source = await PresentationFile.importPptx(await FileBlob.load(sourcePptx));

for (const sourceSlideNumber of sourceSlideNumbers) {
  const slide = source.slides.items[sourceSlideNumber - 1];
  if (!slide) throw new Error(`源页不存在：${sourceSlideNumber}`);
  await writeBlob(
    path.join(outputDir, `source-slide-${String(sourceSlideNumber).padStart(2, "0")}.png`),
    await source.export({ slide, format: "png", scale: 1 }),
  );
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(
    path.join(outputDir, `source-slide-${String(sourceSlideNumber).padStart(2, "0")}.layout.json`),
    await layout.text(),
    "utf8",
  );
}

console.log(JSON.stringify({ sourcePptx, outputDir, sourceSlideNumbers }, null, 2));
