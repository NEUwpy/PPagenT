import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";
import { addComponent, layoutForFrame } from "../pptx-roundtrip/generate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENT_ROOT = path.resolve(HERE, "..");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    args[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  if (!args.input || !args.out) throw new Error("Usage: node generate.mjs --input <json> --out <directory>");
  return args;
}

function assetUrl(inputPath, htmlDir, assetPath) {
  const absolute = path.resolve(path.dirname(inputPath), assetPath);
  return path.relative(htmlDir, absolute).split(path.sep).join("/");
}

function visibleItems(input) {
  const source = Array.isArray(input.items) ? input.items : [];
  if (Array.isArray(input.visibleItems)) {
    return input.visibleItems.map((id) => source.find((item) => item.id === id)).filter(Boolean);
  }
  return source.slice(0, Number(input.count || source.length));
}

function htmlForInput(input, inputPath, outputDir, items) {
  const htmlDir = outputDir;
  const props = {
    items: items.map((item) => ({
      ...item,
      icon: item.icon ? assetUrl(inputPath, htmlDir, item.icon) : undefined,
    })),
    centerVisual: {
      ...input.centerVisual,
      src: assetUrl(inputPath, htmlDir, input.centerVisual.src),
    },
    count: items.length,
    visibleItems: items.map((item) => item.id),
  };
  const scriptPath = path.relative(htmlDir, path.join(COMPONENT_ROOT, "radial-structure.js")).split(path.sep).join("/");
  const stylePath = path.relative(htmlDir, path.join(COMPONENT_ROOT, "radial-structure.css")).split(path.sep).join("/");
  const payload = JSON.stringify(props).replace(/</g, "\\u003c");
  const frame = input.contentFrame;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.outputName}</title>
  <link rel="stylesheet" href="${stylePath}" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body { display: grid; place-items: center; min-height: 100vh; background: #ffffff; }
    .content-frame { width: min(${frame.width}px, 92vw); height: min(${frame.height}px, 86vh); }
    #radial-component { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <main class="content-frame" aria-label="Content Frame">
    <div id="radial-component"></div>
  </main>
  <script src="${scriptPath}"></script>
  <script>
    window.__RADIAL_INPUT__ = ${payload};
    window.__RADIAL_CONTROLLER__ = mountRadialStructure(
      document.querySelector("#radial-component"),
      window.__RADIAL_INPUT__
    );
  </script>
</body>
</html>
`;
}

function countKinds(ndjson) {
  const counts = { slide: 0, textbox: 0, image: 0, shape: 0 };
  for (const line of String(ndjson).split(/\r?\n/)) {
    for (const kind of Object.keys(counts)) {
      if (line.includes(`"kind":"${kind}"`)) counts[kind] += 1;
    }
  }
  return counts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(HERE, args.input);
  const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
  if (!input.outputName) throw new Error("Input must define outputName.");
  if (!input.contentFrame || !input.centerVisual?.src) throw new Error("Input must define contentFrame and centerVisual.src.");
  const items = visibleItems(input);
  if (items.length !== 5) throw new Error(`This checkpoint expects exactly 5 visible items, got ${items.length}.`);
  const outputDir = path.resolve(HERE, args.out);
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, "index.html"), htmlForInput(input, inputPath, outputDir, items), "utf8");

  if (process.env.BROWSER_EXECUTABLE_PATH) {
    const { chromium } = createRequire(import.meta.url)("playwright");
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto(`file://${path.join(outputDir, "index.html")}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outputDir, "html-preview.png"), fullPage: true });
    await browser.close();
  } else {
    console.log("BROWSER_EXECUTABLE_PATH not set; HTML screenshot is verified in the application browser.");
  }

  const layout = layoutForFrame(input.contentFrame, items);
  await fs.writeFile(path.join(outputDir, "layout.json"), JSON.stringify({ outputName: input.outputName, input: path.basename(inputPath), ...layout }, null, 2), "utf8");

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  slide.background.fill = "#ffffff";
  await addComponent(slide, input, items, layout, inputPath);
  const slidePng = await slide.export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(outputDir, "pptx-slide-1.png"), Buffer.from(await slidePng.arrayBuffer()));
  const pptx = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(outputDir, `${input.outputName}.pptx`);
  await pptx.save(pptxPath);

  const imported = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  const inspection = await imported.inspect({ kind: "slide,textbox,shape,image", maxChars: 50000 });
  const inspectionText = inspection?.ndjson || JSON.stringify(inspection, null, 2);
  await fs.writeFile(path.join(outputDir, "object-inspection.ndjson"), inspectionText, "utf8");
  const importedSlide = imported.slides.getItem(0);
  const roundtripPng = await importedSlide.export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(outputDir, "pptx-roundtrip.png"), Buffer.from(await roundtripPng.arrayBuffer()));
  const objectCounts = countKinds(inspectionText);
  if (objectCounts.textbox !== 10 || objectCounts.image !== 6 || objectCounts.shape === 0) {
    throw new Error(`Unexpected editable object counts: ${JSON.stringify(objectCounts)}`);
  }
  await fs.writeFile(path.join(outputDir, "generation-summary.json"), JSON.stringify({
    outputName: input.outputName,
    visibleIds: items.map((item) => item.id),
    contentFrame: input.contentFrame,
    html: "index.html",
    pptx: path.basename(pptxPath),
    objectCounts,
    htmlPreview: "html-preview.png",
    pptxPreview: "pptx-slide-1.png",
    roundtripPreview: "pptx-roundtrip.png"
  }, null, 2), "utf8");
  console.log(JSON.stringify({ outputDir, visibleCount: items.length, allocation: layout.rules.sideAllocation, objectCounts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
