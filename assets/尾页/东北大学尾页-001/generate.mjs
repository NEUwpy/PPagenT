import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSinglePageAsset, parseNamedArgs } from "../../../src/asset-runtime/template-utils.mjs";

const assetDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(assetDir, "../../..");
const params = parseNamedArgs({ text: "谢谢观看", output: path.join(assetDir, "example.pptx") });

const output = await generateSinglePageAsset({
  sourcePptx: path.join(projectRoot, "workbench", "source-archive", "PPT模板-封面正文尾页.pptx"),
  sourceSlideNumber: 4,
  replacements: [["敬请老师批评指正", params.text]],
  outputPptx: path.resolve(params.output),
});

console.log(output);
