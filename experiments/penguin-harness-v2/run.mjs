import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runWorkflowCli } from "../../src/agent/run-workflow.mjs";
import { loadDeepSeekLocalConfig } from "../../src/agent/deepseek-provider-from-env.mjs";
import { createPenguinHarnessProviderV2 } from "./orchestrator.mjs";

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
const output = path.resolve(root, args.output ?? "output/penguin-harness-v2/为什么做PPagenT.pptx");
const runDir = path.resolve(root, args["run-dir"] ?? ".tmp/penguin-harness-v2/run");

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
const provider = createPenguinHarnessProviderV2({ root, runDir, config });
const startedAt = Date.now();
let result;
try {
  result = await runWorkflowCli({
    root,
    input,
    output,
    "run-dir": runDir,
    providerInstance: provider,
    providerLabel: "experiments/penguin-harness-v2/orchestrator.mjs",
    mode: "production",
    guaranteeDelivery: true,
    // One initial pass plus one targeted feedback pass. If the exact Structure
    // still cannot carry the text, the formal workflow uses the registered
    // editorial fallback instead of turning the Harness into a retry machine.
    maxContentAttempts: 3,
    maxVisualAttempts: 2,
    allowVisualContentFeedback: true,
  });
} finally {
  await provider.dispose();
}

process.stdout.write(`${JSON.stringify({
  status: result.status,
  outputPptx: result.outputPptx,
  runDir,
  durationMs: Date.now() - startedAt,
  pageCount: result.renderResult?.pageEvidence?.length ?? null,
  qualityAudit: result.renderResult?.qualityAudit ?? null,
}, null, 2)}\n`);
