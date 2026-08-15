import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const [input, slideNumberValue, output] = process.argv.slice(2);
const slideNumber = Number(slideNumberValue);
if (!input || !output || !Number.isInteger(slideNumber) || slideNumber < 1) {
  throw new Error("usage: node src/tools/render-pptx-slide-evidence.mjs <input.pptx> <slide-number> <output.png>");
}

const inputPath = path.resolve(input);
const outputPath = path.resolve(output);
const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPath));
const slide = presentation.slides.items[slideNumber - 1];
if (!slide) throw new Error(`PPT 只有 ${presentation.slides.items.length} 页，无法读取第 ${slideNumber} 页`);

const image = await presentation.export({ slide, format: "png", scale: 1 });
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, Buffer.from(await image.arrayBuffer()));

console.log(JSON.stringify({
  status: "passed",
  input: inputPath,
  slideNumber,
  output: outputPath,
}, null, 2));
