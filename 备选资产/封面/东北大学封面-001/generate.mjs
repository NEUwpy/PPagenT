import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateSinglePageAsset,
  parseNamedArgs,
} from "../../../src/asset-runtime/template-utils.mjs";

const assetDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(assetDir, "../../..");
const params = parseNamedArgs({
  title: "PPagenT 模板复现实验",
  presenter: "PPagenT",
  date: "2026.08.08",
  output: path.join(assetDir, "example.pptx"),
});

const output = await generateSinglePageAsset({
  sourcePptx: path.join(projectRoot, "workbench", "source-archive", "PPT模板-封面正文尾页.pptx"),
  sourceSlideNumber: 1,
  replacements: [
    ["MDM方法偏移量自适应选取", params.title],
    ["汇报人：魏鹏宇", `汇报人：${params.presenter}`],
    ["2026.07.20", params.date],
  ],
  outputPptx: path.resolve(params.output),
});

console.log(output);
