import fs from "node:fs/promises";
import path from "node:path";
import { enrichPageIntent } from "../content/page-content.mjs";

function parseArgs(args) {
  const options = { content: null, intentDraft: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--content") options.content = path.resolve(args[++index]);
    else if (arg === "--intent-draft") options.intentDraft = path.resolve(args[++index]);
    else throw new Error(`未知参数: ${arg}`);
  }
  if (!options.content || !options.intentDraft) {
    throw new Error("需要 --content <page-content.json> --intent-draft <intent-draft.json>");
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const pageContent = JSON.parse(await fs.readFile(options.content, "utf8"));
const intentDraft = JSON.parse(await fs.readFile(options.intentDraft, "utf8"));
console.log(JSON.stringify(enrichPageIntent(intentDraft, pageContent), null, 2));
