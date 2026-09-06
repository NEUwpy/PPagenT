import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const RUNTIME = process.argv[2];
const OUT = process.argv[3];
const files = process.argv.slice(4);

if (!RUNTIME || !OUT || files.length === 0) throw new Error("usage: inspect_sources.mjs <runtime> <out> <pptx...>");

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
}

for (const file of files) {
  const label = path.basename(file, path.extname(file)).replace(/[^a-zA-Z0-9_-]+/g, "_");
  const dir = path.join(OUT, label);
  await fs.mkdir(dir, { recursive: true });
  const p = await PresentationFile.importPptx(await FileBlob.load(file));
  const slides = [...p.slides.items];
  const inspect = await p.inspect({ kind: "deck,slide,textbox,shape,image,table,chart,notes,layout", maxChars: 300000 });
  await fs.writeFile(path.join(dir, "inspect.ndjson"), inspect.ndjson || "", "utf8");
  const manifest = { source: file, slideCount: slides.length, slides: [] };
  for (const [i, slide] of slides.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    await writeBlob(path.join(dir, `${stem}.png`), await p.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(dir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
    manifest.slides.push({ slide: i + 1, layout: `${stem}.layout.json`, png: `${stem}.png` });
  }
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ label, slideCount: slides.length, dir }));
}
