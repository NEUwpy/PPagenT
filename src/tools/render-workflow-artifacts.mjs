import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNortheasternUniversityRenderer } from "../agent/neu-renderer.mjs";

function parseArgs(argv) {
  const options = {
    plan: "", content: "", intents: "", decisions: "", payloads: "", source: "", output: "", "qa-dir": "", result: "",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined || !(key in options)) throw new Error(`不支持的参数：${argv[index] ?? "<empty>"}`);
    options[key] = value;
  }
  for (const key of Object.keys(options)) if (!options[key]) throw new Error(`缺少 --${key}`);
  return options;
}

export async function renderWorkflowArtifacts(options) {
  const read = (target) => fs.readFile(path.resolve(target), "utf8").then(JSON.parse);
  const [deckPlan, pageContents, pageIntents, layoutDecisions, renderPayloads] = await Promise.all([
    read(options.plan), read(options.content), read(options.intents), read(options.decisions), read(options.payloads),
  ]);
  const renderer = createNortheasternUniversityRenderer({
    sourcePptx: path.resolve(options.source),
    outputPptx: path.resolve(options.output),
    manuscriptSource: "docs/为什么做PPagenT.md",
  });
  const result = await renderer({
    outputDir: path.resolve(options["qa-dir"]),
    deckPlan,
    pageContents,
    pageIntents,
    layoutDecisions,
    renderPayloads,
  });
  await fs.mkdir(path.dirname(path.resolve(options.result)), { recursive: true });
  await fs.writeFile(path.resolve(options.result), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await renderWorkflowArtifacts(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${result.outputPptx}\n`);
}
