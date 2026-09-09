import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const here = import.meta.dirname;
for (const run of ["first-draft", "revision-01", "revision-02"]) {
  const pptxPath = path.join(here, `layout-reservation-luna-high-${run}-validated.pptx`);
  const renderDir = path.join(here, `renders-${run}-validated`);
  await fs.mkdir(renderDir, { recursive: true });
  const deck = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  for (const [index, slide] of deck.slides.items.entries()) {
    const png = await deck.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(renderDir, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(renderDir, `slide-${index + 1}.layout.json`), await layout.text());
  }
}
