import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import JSZip from "jszip";

const outRoot = "C:/PPagenT/experiments/university-skin-pilot/round-01/source-audit";
const sources = [
  {
    id: "runtime-template",
    pptx: "C:/PPagenT/assets/主题/东北大学-001/runtime-template.pptx",
  },
  {
    id: "source-template",
    pptx: "C:/PPagenT/PPT源/PPT模板-封面正文尾页.pptx",
  },
];

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function inspectOne(source) {
  const outDir = path.join(outRoot, source.id);
  await fs.mkdir(outDir, { recursive: true });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(source.pptx));
  const records = [];
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(outDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(outDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
    records.push({
      slide: index + 1,
      layout: JSON.parse(await fs.readFile(path.join(outDir, `${stem}.layout.json`), "utf8")),
    });
  }
  const inspected = await presentation.inspect({
    kind: "slide,textbox,shape,image,table,chart,notes,thread,layout",
    maxChars: 500000,
  });
  await fs.writeFile(path.join(outDir, "inspect.ndjson"), inspected.ndjson ?? String(inspected));
  const zip = await JSZip.loadAsync(await fs.readFile(source.pptx));
  const themeEntries = Object.keys(zip.files).filter((name) => /^ppt\/theme\/theme[^/]*\.xml$/.test(name));
  const themeHashes = [];
  for (const name of themeEntries) {
    const bytes = await zip.file(name).async("nodebuffer");
    themeHashes.push({ name, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  }
  await fs.writeFile(path.join(outDir, "summary.json"), JSON.stringify({
    id: source.id,
    pptx: source.pptx,
    slideCount: presentation.slides.items.length,
    slideRecords: records.map((record) => ({ slide: record.slide, objectCount: record.layout.elements?.length ?? null })),
    themeHashes,
  }, null, 2));
  return { id: source.id, slideCount: presentation.slides.items.length, themeHashes };
}

const result = [];
for (const source of sources) result.push(await inspectOne(source));
console.log(JSON.stringify(result, null, 2));
