import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  prepareTemplateMappedStarter,
} from "../../../src/asset-runtime/template-utils.mjs";
import { renderCatalogAgendaOnSlide, SAMPLE_CATALOG_ITEMS } from "./generate.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDir, "..", "..", "..");
const output = path.resolve(process.argv[2] ?? path.join(moduleDir, "example.pptx"));
const qaDir = path.resolve(process.argv[3] ?? path.join(moduleDir, "qa"));
const starterPptx = path.join(qaDir, "template-starter.pptx");
const sourcePptx = path.join(root, "PPT源", "PPT模板-封面正文尾页.pptx");
const sourceAgendaText = "1. 定义问题\n2. 真参数未知如何实现“样本-最优偏移量”的选择\n3. 一些关于神经网络的验证\n4. 论文准备\n5. 下一个研究课题";
const counts = [3, 4, 5, 6, 7];

await fs.mkdir(qaDir, { recursive: true });
await prepareTemplateMappedStarter({
  sourcePptx,
  sourceSlideNumbers: counts.map(() => 2),
  starterPptx,
});
const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
const slides = await applyTemplateMappedRecipes(presentation, counts.map((count) => ({
  textEdits: [
    { sourceText: "目录", replacementText: `目录 · ${count} 项` },
    { sourceText: sourceAgendaText, replacementText: "", writeMode: "replace-all" },
  ],
  notes: [
    "[Sources]",
    "- Shell：PPT源/PPT模板-封面正文尾页.pptx#slide=2",
    "- 目录标签语法：PPT源/狗哥蓝色-精美逻辑图PPT模板.pptx#slides=4-13",
    `- 候选状态：${count} 项目录标签卡片`,
    "[/Sources]",
  ].join("\n"),
})));

slides.forEach((slide, index) => {
  renderCatalogAgendaOnSlide(slide, {
    items: SAMPLE_CATALOG_ITEMS.slice(0, counts[index]),
    activeIndex: null,
  });
});

await fs.mkdir(path.dirname(output), { recursive: true });
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(output);
await exportTemplateMappedQa(presentation, qaDir);
console.log(JSON.stringify({ output, qaDir, counts }, null, 2));
