import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runWorkflowCli } from "../../src/agent/run-workflow.mjs";
import { loadDeepSeekLocalConfig } from "../../src/agent/deepseek-provider-from-env.mjs";
import { createPenguinSingleAgentProvider } from "./single-agent.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    values[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(experimentDir, "..", "..");
const args = parseArgs(process.argv.slice(2));
const input = path.resolve(root, args.input ?? "稿件/为什么做PPagenT-v1.md");
const output = path.resolve(root, args.output ?? "output/penguin-harness-v2/为什么做PPagenT-single-agent.pptx");
const runDir = path.resolve(root, args["run-dir"] ?? ".tmp/penguin-harness-v2/single-agent-run");

const local = await loadDeepSeekLocalConfig(root);
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.PPAGENT_DEEPSEEK_API_KEY || local.apiKey;
if (!apiKey) throw new Error("缺少 DeepSeek API Key；请配置 config/deepseek.local.json 或 DEEPSEEK_API_KEY");
const config = {
  ...local,
  apiKey,
  baseUrl: process.env.PPAGENT_DEEPSEEK_BASE_URL || local.baseUrl || "https://api.deepseek.com",
  model: process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash",
};

await fs.mkdir(runDir, { recursive: true });
const liveProvider = createPenguinSingleAgentProvider({ root, runDir, config });
const seedContentPath = args["seed-content"] ? path.resolve(root, args["seed-content"]) : null;
let seededContent = null;
if (seedContentPath) {
  const stat = await fs.stat(seedContentPath);
  seededContent = stat.isDirectory() ? {
    deckPlan: JSON.parse(await fs.readFile(path.join(seedContentPath, "deck-plan.json"), "utf8")),
    pageContents: JSON.parse(await fs.readFile(path.join(seedContentPath, "page-contents.json"), "utf8")),
    contentDraftMarkdown: await fs.readFile(path.join(seedContentPath, "content-draft.md"), "utf8"),
    contentMetadata: JSON.parse(await fs.readFile(path.join(seedContentPath, "content-metadata.json"), "utf8")),
  } : JSON.parse(await fs.readFile(seedContentPath, "utf8"));
}
const provider = seededContent ? {
  ...liveProvider,
  async contentDirector(input) {
    if (seededContent) {
      const value = seededContent;
      seededContent = null;
      return value;
    }
    return liveProvider.contentDirector(input);
  },
} : liveProvider;
const startedAt = Date.now();
let result;
try {
  result = await runWorkflowCli({
    root,
    input,
    output,
    "run-dir": runDir,
    providerInstance: provider,
    providerLabel: "experiments/penguin-harness-v2/single-agent.mjs",
    mode: "production",
    guaranteeDelivery: true,
    maxContentAttempts: 1,
    maxVisualAttempts: 1,
    allowVisualContentFeedback: false,
    // Structure is an optional expression aid. If its registered capacity does
    // not fit the manuscript, route the page to Layout/Text instead of asking
    // the content agent to mutilate the argument to satisfy a template.
    preferLayoutFallbackOverContentCompression: true,
  });
} finally {
  provider.dispose();
}

process.stdout.write(`${JSON.stringify({
  status: result.status,
  outputPptx: result.outputPptx,
  runDir,
  durationMs: Date.now() - startedAt,
  pageCount: result.renderResult?.pageEvidence?.length ?? null,
  qualityAudit: result.renderResult?.qualityAudit ?? null,
}, null, 2)}\n`);
