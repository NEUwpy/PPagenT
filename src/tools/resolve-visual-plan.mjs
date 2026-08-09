import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVisualPlan } from "../agent/visual-resolution.mjs";

function parseArgs(argv) {
  const options = {
    root: process.cwd(), content: "", intents: "", candidates: "", plan: "", decisions: "", payloads: "", result: "",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined || !(key in options)) throw new Error(`不支持的参数：${argv[index] ?? "<empty>"}`);
    options[key] = value;
  }
  for (const key of ["content", "intents", "candidates", "plan", "decisions", "payloads", "result"]) {
    if (!options[key]) throw new Error(`缺少 --${key}`);
  }
  return options;
}

export async function resolveVisualArtifacts(options) {
  const read = (target) => fs.readFile(path.resolve(target), "utf8").then(JSON.parse);
  const [pageContents, pageIntents, candidateSets, visualPlan] = await Promise.all([
    read(options.content), read(options.intents), read(options.candidates), read(options.plan),
  ]);
  const resolved = await resolveVisualPlan({
    root: path.resolve(options.root ?? process.cwd()),
    pageContents,
    pageIntents,
    candidateSets,
    visualPlan,
  });
  await Promise.all([
    fs.mkdir(path.dirname(path.resolve(options.result)), { recursive: true }),
    fs.mkdir(path.dirname(path.resolve(options.decisions)), { recursive: true }),
    fs.mkdir(path.dirname(path.resolve(options.payloads)), { recursive: true }),
  ]);
  await fs.writeFile(path.resolve(options.result), `${JSON.stringify({ status: resolved.status, feedback: resolved.feedback }, null, 2)}\n`, "utf8");
  if (resolved.status === "accepted") {
    await Promise.all([
      fs.writeFile(path.resolve(options.decisions), `${JSON.stringify(resolved.layoutDecisions, null, 2)}\n`, "utf8"),
      fs.writeFile(path.resolve(options.payloads), `${JSON.stringify(resolved.renderPayloads, null, 2)}\n`, "utf8"),
    ]);
  }
  return resolved;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await resolveVisualArtifacts(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${result.status}\n`);
}
