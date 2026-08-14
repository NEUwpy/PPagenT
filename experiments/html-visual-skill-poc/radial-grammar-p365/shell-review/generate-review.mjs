import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { addComponent, layoutForFrame } from "../pptx-roundtrip/generate.mjs";
import { academicReportShell } from "../../../../src/runtime/shells/academic-report.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../../../..");
const componentRoot = path.resolve(here, "..");

function parseArgs(argv) {
  const values = { input: "review-input.json", out: "output" };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined || !(key in values)) throw new Error(`不支持的参数：${argv[index] ?? "<empty>"}`);
    values[key] = value;
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(here, args.input);
const outputDir = path.resolve(here, args.out);
const sourcePptx = path.join(projectRoot, "PPT源", "PPT模板-封面正文尾页.pptx");
const contentFrame = academicReportShell.slots.contentFrame;

function assetUrl(htmlDir, assetPath) {
  return path.relative(htmlDir, path.resolve(path.dirname(inputPath), assetPath)).split(path.sep).join("/");
}

function componentHtml(input, items, stateDir) {
  const props = {
    items: items.map((item) => ({ ...item, icon: item.icon ? assetUrl(stateDir, item.icon) : undefined })),
    centerVisual: { ...input.centerVisual, src: input.centerVisual?.src ? assetUrl(stateDir, input.centerVisual.src) : undefined },
    count: items.length,
    visibleItems: items.map((item) => item.id),
  };
  const scriptPath = path.relative(stateDir, path.join(componentRoot, "radial-structure.js")).split(path.sep).join("/");
  const stylePath = path.relative(stateDir, path.join(componentRoot, "radial-structure.css")).split(path.sep).join("/");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Parallel Radial ${items.length}</title>
  <link rel="stylesheet" href="${stylePath}" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: #fff; }
    #content-frame { width: ${contentFrame.width}px; height: ${contentFrame.height}px; }
  </style>
</head>
<body>
  <main id="content-frame"><div id="radial-component" style="width:100%;height:100%"></div></main>
  <script src="${scriptPath}"></script>
  <script>
    window.__RADIAL_CONTROLLER__ = mountRadialStructure(
      document.querySelector("#radial-component"),
      ${JSON.stringify(props).replace(/</g, "\\u003c")}
    );
  </script>
</body>
</html>`;
}

function records(snapshot) {
  return snapshot.ndjson.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function uniqueRecord(all, slideNumber, kind, predicate, label) {
  const matches = all.filter((item) => item.slide === slideNumber && item.kind === kind && predicate(item));
  if (matches.length !== 1) throw new Error(`第 ${slideNumber} 页 ${label} 匹配失败：${matches.length}`);
  return matches[0];
}

async function editShell(presentation, slideNumber, input, count) {
  const snapshot = await presentation.inspect({
    kind: "textbox,shape,image",
    include: "id,slide,kind,name,text",
    maxChars: 200000,
  });
  const all = records(snapshot);
  const editText = (source, replacement, style = null) => {
    const record = uniqueRecord(all, slideNumber, "textbox", (item) => item.text === source, `文本 ${source}`);
    const target = presentation.resolve(record.id);
    target.text.replace(source, replacement);
    if (style) target.text.style = { ...target.text.style, ...style };
  };
  editText("01", String(slideNumber).padStart(2, "0"));
  editText("正文页", input.sectionName);
  editText("主旨句", `${input.slideTitle}｜${count} 项`, {
    typeface: "HYWenRunSongYun U",
    fontSize: 30,
    bold: true,
    autoFit: "none",
  });
  const bodyRecord = uniqueRecord(all, slideNumber, "textbox", (item) => item.text === "正文", "正文占位符");
  presentation.resolve(bodyRecord.id).text = "";
  const arrowRecord = uniqueRecord(all, slideNumber, "shape", (item) => item.name === "箭头: 下 9", "来源箭头");
  presentation.resolve(arrowRecord.id).delete();
  const imageRecord = uniqueRecord(all, slideNumber, "image", (item) => item.name === "图片 10", "来源图片");
  presentation.resolve(imageRecord.id).delete();
}

async function renderHtmlStates(input) {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const executablePath = process.env.BROWSER_EXECUTABLE_PATH;
  if (!executablePath) throw new Error("缺少 BROWSER_EXECUTABLE_PATH");
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const count of input.stateCounts) {
      const stateDir = path.join(outputDir, "html", String(count));
      await fs.mkdir(stateDir, { recursive: true });
      const items = input.items.slice(0, count);
      const htmlPath = path.join(stateDir, "index.html");
      await fs.writeFile(htmlPath, componentHtml(input, items, stateDir), "utf8");
      const page = await browser.newPage({ viewport: { width: contentFrame.width, height: contentFrame.height } });
      await page.goto(`file:///${htmlPath.replaceAll("\\", "/")}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(outputDir, `html-state-${count}.png`) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const outputPptx = path.join(outputDir, `${input.outputName}.pptx`);
  await fs.mkdir(outputDir, { recursive: true });
  await renderHtmlStates(input);

  const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePptx));
  const originals = [...presentation.slides.items];
  const sourceSlide = originals[2];
  const slides = input.stateCounts.map(() => sourceSlide.duplicate());
  for (const original of originals) original.delete();
  slides.forEach((slide, index) => slide.moveTo(index));

  for (const [index, count] of input.stateCounts.entries()) {
    await editShell(presentation, index + 1, input, count);
    const items = input.items.slice(0, count);
    const layout = layoutForFrame(contentFrame, items);
    await addComponent(slides[index], { ...input, contentFrame }, items, layout, inputPath);
    slides[index].speakerNotes.textFrame.setText([
      "[Sources]",
      "- Shell：PPT源/PPT模板-封面正文尾页.pptx 第 3 页",
      "- Style Group 来源：【动画版】500页创意图文排版PPT模板-深蓝版.pptx 第 365 页",
      "- 结构：parallel / radial-p365 / state=" + count,
      "[/Sources]",
    ].join("\n"));
  }

  const exported = await PresentationFile.exportPptx(presentation);
  await exported.save(outputPptx);
  for (const [index, slide] of slides.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(outputDir, `pptx-state-${input.stateCounts[index]}.png`), Buffer.from(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(
      path.join(outputDir, `pptx-state-${input.stateCounts[index]}.layout.json`),
      await layout.text(),
      "utf8",
    );
  }
  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(path.join(outputDir, "pptx-montage.webp"), Buffer.from(await montage.arrayBuffer()));
  const inspection = await presentation.inspect({
    kind: "slide,textbox,shape,image,notes,layout",
    maxChars: 300000,
  });
  await fs.writeFile(path.join(outputDir, "inspection.ndjson"), inspection.ndjson, "utf8");
  await fs.writeFile(path.join(outputDir, "run-summary.json"), JSON.stringify({
    skillId: "parallel",
    styleGroupId: "radial-p365",
    source: "PPT源/【动画版】500页创意图文排版PPT模板-深蓝版.pptx#365",
    shell: academicReportShell.id,
    contentFrame,
    states: input.stateCounts,
    mediaContract: input.mediaContract,
    outputPptx: path.basename(outputPptx),
  }, null, 2), "utf8");
  console.log(JSON.stringify({ outputPptx, states: input.stateCounts, contentFrame }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
