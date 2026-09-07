import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// This harness only exercises the artifact/render/import path on an already
// accepted baseline deck. It does not invoke a structure or assess adaptation.
const runtimeHelpers = "C:\\Users\\ilove\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.826.12353\\skills\\presentations\\container_tools\\runtime_helpers.mjs";
const { importRuntimeModule } = await import(pathToFileURL(runtimeHelpers).href);
const { FileBlob, PresentationFile } = await importRuntimeModule("@oai/artifact-tool");

const root = path.dirname(fileURLToPath(import.meta.url));
const input = path.resolve(process.argv[2] ?? path.join(root, "fixture", "neutral-core-convergence-06-baseline.pptx"));
const output = path.resolve(process.argv[3] ?? path.join(root, "pipeline-output"));
const evidence = path.resolve(process.argv[4] ?? path.join(root, "pipeline-evidence"));

await fs.mkdir(output, { recursive: true });
await fs.mkdir(evidence, { recursive: true });

function writeBlob(filePath, blob) {
  return blob.arrayBuffer().then((buffer) => fs.writeFile(filePath, Buffer.from(buffer)));
}

function inspectLayout(layout, slideIndex) {
  const frame = layout.slide?.frame ?? { left: 0, top: 0, width: 1280, height: 720 };
  const elements = Array.isArray(layout.elements) ? layout.elements : [];
  const outside = [];
  let pictures = 0;
  let textShapes = 0;
  let lineCount = 0;
  for (const element of elements) {
    if (element.kind === "image" || element.kind === "picture") pictures += 1;
    if (element.text !== undefined) textShapes += 1;
    lineCount += Number(element.textLayout?.lineCount ?? 0);
    const bbox = element.bbox;
    if (Array.isArray(bbox) && bbox.length >= 4) {
      const [left, top, width, height] = bbox;
      if (left < frame.left || top < frame.top || left + width > frame.left + frame.width || top + height > frame.top + frame.height) {
        outside.push({ id: element.id, name: element.name, bbox });
      }
    }
  }
  return {
    slide: slideIndex + 1,
    frame,
    elementCount: elements.length,
    textShapes,
    pictures,
    renderedLineCount: lineCount,
    outsideSlide: outside,
    source: "baseline_fixture"
  };
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
const slides = Array.isArray(presentation.slides?.items) ? presentation.slides.items : [];
const slideReports = [];
for (let index = 0; index < slides.length; index += 1) {
  const slide = slides[index];
  const layoutText = await (await slide.export({ format: "layout" })).text();
  const layout = JSON.parse(layoutText);
  const layoutPath = path.join(output, `slide-${String(index + 1).padStart(2, "0")}.layout.json`);
  const pngPath = path.join(output, `slide-${String(index + 1).padStart(2, "0")}.png`);
  await fs.writeFile(layoutPath, JSON.stringify(layout, null, 2), "utf8");
  await writeBlob(pngPath, await presentation.export({ slide, format: "png", scale: 1 }));
  slideReports.push({ ...inspectLayout(layout, index), layoutPath, pngPath });
}

const montagePath = path.join(output, "deck-montage.webp");
await writeBlob(montagePath, await presentation.export({ format: "webp", montage: true, scale: 1 }));

const inspectText = await presentation.inspect({
  kind: "slide,textbox,shape,image,table,chart,notes,layout",
  maxChars: 30000,
});
await fs.writeFile(path.join(evidence, "import-inspect.ndjson"), inspectText.ndjson ?? String(inspectText), "utf8");

const report = {
  status: "baseline_toolchain_verified",
  adaptationStatus: "not_assessed",
  input,
  output,
  evidence,
  slideCount: slides.length,
  slides: slideReports,
  montagePath,
  checks: {
    artifactToolImport: true,
    artifactToolLayoutExport: true,
    artifactToolPngExport: true,
    artifactToolMontageExport: true,
    outsideSlideCount: slideReports.reduce((sum, slide) => sum + slide.outsideSlide.length, 0),
    pictureCount: slideReports.reduce((sum, slide) => sum + slide.pictures, 0),
  },
  interpretation: "仅证明旧 baseline PPTX 可以被 Artifact Tool 导入、导出布局/PNG/montage；不证明新结构适配、正式调用或页面 QA。"
};
await fs.writeFile(path.join(evidence, "pipeline-report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

