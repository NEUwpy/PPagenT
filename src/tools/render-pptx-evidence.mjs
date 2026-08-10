import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const [input, outputDir] = process.argv.slice(2);
if (!input || !outputDir) {
  throw new Error("usage: node src/tools/render-pptx-evidence.mjs <input.pptx> <output-dir>");
}

const inputPath = path.resolve(input);
const outputPath = path.resolve(outputDir);
const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPath));
await fs.mkdir(outputPath, { recursive: true });

for (const [index, slide] of [...presentation.slides.items].entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  const image = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(outputPath, `${stem}.png`), Buffer.from(await image.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(outputPath, `${stem}.layout.json`), await layout.text(), "utf8");
}

console.log(JSON.stringify({
  status: "passed",
  input: inputPath,
  outputDir: outputPath,
  slideCount: presentation.slides.items.length,
}, null, 2));
