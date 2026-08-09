import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildVisualCandidateSets } from "../agent/visual-resolution.mjs";
import { enrichPageIntent } from "../content/page-content.mjs";

function parseArgs(argv) {
  const options = { root: process.cwd(), content: "", intents: "", output: "", enriched: "" };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined || !(key in options)) throw new Error(`不支持的参数：${argv[index] ?? "<empty>"}`);
    options[key] = value;
  }
  for (const key of ["content", "intents", "output", "enriched"]) if (!options[key]) throw new Error(`缺少 --${key}`);
  return options;
}

export async function buildVisualCandidateArtifacts(options) {
  const [pageContents, drafts] = await Promise.all([
    fs.readFile(path.resolve(options.content), "utf8").then(JSON.parse),
    fs.readFile(path.resolve(options.intents), "utf8").then(JSON.parse),
  ]);
  if (pageContents.length !== drafts.length) throw new Error("PageContent 与 PageIntent 草案页数不一致");
  const pageIntents = drafts.map((draft, index) => enrichPageIntent(draft, pageContents[index]));
  const candidateSets = await buildVisualCandidateSets({
    root: path.resolve(options.root ?? process.cwd()),
    pageContents,
    pageIntents,
  });
  await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  await Promise.all([
    fs.writeFile(path.resolve(options.output), `${JSON.stringify(candidateSets, null, 2)}\n`, "utf8"),
    fs.writeFile(path.resolve(options.enriched), `${JSON.stringify(pageIntents, null, 2)}\n`, "utf8"),
  ]);
  return { pageIntents, candidateSets };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildVisualCandidateArtifacts(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${result.candidateSets.length}\n`);
}
