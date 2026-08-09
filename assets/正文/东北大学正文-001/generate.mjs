import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSinglePageAsset, parseNamedArgs } from "../../../src/asset-runtime/template-utils.mjs";

const assetDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(assetDir, "../../..");
const params = parseNamedArgs({
  "section-number": "01",
  "section-name": "正文页",
  title: "模板复现结论",
  body: "正文内容可以由代码写入",
  output: path.join(assetDir, "example.pptx"),
});

const output = await generateSinglePageAsset({
  sourcePptx: path.join(projectRoot, "workbench", "source-archive", "PPT模板-封面正文尾页.pptx"),
  sourceSlideNumber: 3,
  replacements: [
    ["01", params["section-number"]],
    ["正文页", params["section-name"]],
    ["主旨句", params.title],
    ["正文", params.body],
  ],
  outputPptx: path.resolve(params.output),
});

console.log(output);
