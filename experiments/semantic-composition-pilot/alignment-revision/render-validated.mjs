import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const here = path.resolve(import.meta.dirname);
const pptxPath = path.join(here, "final", "semantic-composition-pilot-alignment-revision-validated-20260909-r2.pptx");
const renderDir = path.join(here, "renders-alignment-revision-validated-20260909-r2");
await fs.mkdir(renderDir, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(renderDir, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(renderDir, `slide-${index + 1}.layout.json`), await layout.text());
}
console.log(JSON.stringify({ pptxPath, renderDir, slides: presentation.slides.items.length }, null, 2));
