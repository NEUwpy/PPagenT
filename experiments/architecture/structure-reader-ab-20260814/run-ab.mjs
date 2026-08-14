import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeepSeekJsonModel } from "../../../src/agent/deepseek-director-provider.mjs";
import { createModelDirectorProvider } from "../../../src/agent/model-director-provider.mjs";
import { loadDirectorGuidelines } from "../../../src/agent/director-guidelines.mjs";
import { loadDirectorOutputSchemas } from "../../../src/agent/director-output-schemas.mjs";
import { detectStructuralCues } from "../../../src/agent/structural-cue-reader.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(experimentDir, "../../..");
const local = JSON.parse(await fs.readFile(path.join(root, "config", "deepseek.local.json"), "utf8"));
const rawMarkdown = await fs.readFile(path.join(experimentDir, "input.md"), "utf8");
const baseUrl = process.env.PPAGENT_DEEPSEEK_BASE_URL || local.baseUrl || "https://api.deepseek.com";
const endpoint = process.env.PPAGENT_DEEPSEEK_ENDPOINT || local.endpoint || `${baseUrl.replace(/\/$/, "")}/chat/completions`;
const model = process.env.PPAGENT_DEEPSEEK_MODEL || local.model || "deepseek-v4-flash";
const apiKey = process.env.DEEPSEEK_API_KEY || local.apiKey;
if (!apiKey) throw new Error("缺少 DEEPSEEK_API_KEY 或 config/deepseek.local.json apiKey");

function roleSettings(name, defaults) {
  return { ...defaults, ...(local.roles?.[name] ?? {}) };
}

function trackedFetch(records, runName) {
  return async (url, options) => {
    const request = JSON.parse(options.body);
    const system = request.messages?.[0]?.content ?? "";
    const role = system.includes("批量视觉结构线索解析器")
      ? "structure-batch"
      : system.includes("视觉结构线索解析器") ? "structure" : "content";
    const startedAt = Date.now();
    const response = await fetch(url, options);
    let usage = null;
    let finishReason = null;
    try {
      const payload = await response.clone().json();
      usage = payload.usage ?? null;
      finishReason = payload.choices?.[0]?.finish_reason ?? null;
    } catch {
      // Provider owns response parsing and error handling.
    }
    records.push({
      run: runName,
      role,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      usage,
      finishReason,
    });
    return response;
  };
}

function createModel(settings, fetchImpl) {
  return new DeepSeekJsonModel({
    apiKey,
    model,
    endpoint,
    requestTimeoutMs: local.requestTimeoutMs ?? 120000,
    maxJsonAttempts: 2,
    fetchImpl,
    ...settings,
  });
}

function pageByTitle(output, titlePart) {
  return output.pageContents.find((page) => page.title.includes(titlePart));
}

function itemSummary(page) {
  return (page?.items ?? []).map((item) => ({
    title: item.title,
    body: item.body,
    points: item.points ?? [],
  }));
}

function evaluate(output) {
  const comparison = pageByTitle(output, "80");
  const transformation = pageByTitle(output, "一万个模板");
  const comparisonItems = comparison?.items ?? [];
  const transformationItems = transformation?.items ?? [];
  const middle = transformationItems.find((item) => /规律|经验/.test(item.title)) ?? transformationItems[1];
  return {
    pageCount: output.pageContents.length,
    comparison: {
      mainItemCount: comparisonItems.length,
      has80: comparisonItems.some((item) => /80/.test(`${item.title}${item.body}`)),
      has95: comparisonItems.some((item) => /95/.test(`${item.title}${item.body}`)),
      pointCounts: comparisonItems.map((item) => item.points?.length ?? 0),
      items: itemSummary(comparison),
    },
    transformation: {
      mainItemCount: transformationItems.length,
      hasWork: transformationItems.some((item) => /作品/.test(item.title)),
      hasRule: transformationItems.some((item) => /规律|经验/.test(item.title)),
      hasAbility: transformationItems.some((item) => /能力/.test(item.title)),
      middlePointCount: middle?.points?.length ?? 0,
      middlePoints: middle?.points ?? [],
      items: itemSummary(transformation),
    },
  };
}

function batchOutputSchema(cues) {
  return {
    name: "ppagent_structural_cues_batch",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["results"],
      properties: {
        results: {
          type: "array",
          minItems: cues.length,
          maxItems: cues.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["cueId", "atoms"],
            properties: {
              cueId: { enum: cues.map((cue) => cue.cueId) },
              atoms: {
                type: "array",
                minItems: 1,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "body", "sourceFragments"],
                  properties: {
                    title: { type: "string", minLength: 1, maxLength: 10 },
                    body: { type: "string", minLength: 1, maxLength: 32 },
                    sourceFragments: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                    points: {
                      type: "array",
                      maxItems: 4,
                      items: { type: "string", minLength: 1, maxLength: 8 },
                    },
                    polarity: { enum: ["positive", "negative", "neutral"] },
                    emphasis: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

async function createBatchedStructureModel(records, runName, settings, fetchImpl) {
  const cues = detectStructuralCues(rawMarkdown);
  const remote = createModel(settings, fetchImpl);
  const output = await remote.generateJson({
    role: "PPagenT 批量视觉结构线索解析器",
    task: "一次处理所有 cues，逐个返回且不得遗漏。direct-comparison 必须恰好两个 atoms，不输出 points；sequence-transformation 必须恰好三个 atoms，标题依次使用 requiredNodeTitles，只有中间 atom 含 requiredMiddlePointCount 个 points。每个 atom 只使用对应 source，不增加新事实。",
    context: {
      cues: cues.map((cue) => ({
        cueId: cue.cueId,
        type: cue.type,
        relation: cue.relation,
        sectionHeading: cue.sectionHeading,
        source: cue.source,
        ...(cue.anchorTitles ? { requiredNodeTitles: cue.anchorTitles } : {}),
        ...(cue.supportingPointCount ? { requiredMiddlePointCount: cue.supportingPointCount } : {}),
      })),
    },
    outputSchema: batchOutputSchema(cues),
  });
  const byId = new Map(output.results.map((result) => [result.cueId, result]));
  if (byId.size !== cues.length || cues.some((cue) => !byId.has(cue.cueId))) {
    throw new Error("批量结构解析遗漏 cueId");
  }
  return {
    identity: `${runName}:batched-structure-reader`,
    async generateJson(input) {
      const result = byId.get(input.context.cueId);
      if (!result) throw new Error(`批量结构解析缺少 ${input.context.cueId}`);
      return structuredClone({ atoms: result.atoms });
    },
  };
}

async function run(runName, structureMode) {
  const records = [];
  const fetchImpl = trackedFetch(records, runName);
  const contentSettings = roleSettings("content", {
    thinking: "enabled",
    reasoningEffort: "low",
    maxTokens: 16384,
  });
  const structureSettings = roleSettings("structure", {
    thinking: "disabled",
    reasoningEffort: "low",
    maxTokens: 4096,
  });
  const contentModel = createModel(contentSettings, fetchImpl);
  const unusedModel = createModel({ thinking: "disabled", maxTokens: 1024 }, fetchImpl);
  const [schemas, guidelines] = await Promise.all([
    loadDirectorOutputSchemas(root),
    loadDirectorGuidelines(root),
  ]);
  const startedAt = Date.now();
  const structureModel = structureMode === "per-cue"
    ? createModel(structureSettings, fetchImpl)
    : structureMode === "batch"
      ? await createBatchedStructureModel(records, runName, structureSettings, fetchImpl)
      : null;
  const provider = createModelDirectorProvider({
    contentModel,
    structureModel,
    visualIntentModel: unusedModel,
    visualCompositionModel: unusedModel,
    reviewerModel: unusedModel,
    schemas,
    guidelines,
  });
  const output = await provider.contentDirector({
    rawMarkdown,
    skinId: "northeastern-university",
    attempt: 1,
    previous: null,
    previousReview: null,
  });
  return {
    runName,
    structureMode,
    wallTimeMs: Date.now() - startedAt,
    requestCount: records.length,
    requests: records,
    evaluation: evaluate(output),
    output,
  };
}

const batchOnly = process.argv.includes("--batch-only");
const previous = batchOnly
  ? JSON.parse(await fs.readFile(path.join(experimentDir, "result.json"), "utf8"))
  : null;
const direct = previous?.direct ?? await run("direct-content-director", "none");
const assisted = previous?.assisted ?? await run("local-structure-hints", "per-cue");
const batched = await run("batched-structure-hints", "batch");
const result = {
  generatedAt: new Date().toISOString(),
  model,
  input: "input.md",
  direct,
  assisted,
  batched,
};
await fs.writeFile(path.join(experimentDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  model,
  direct: {
    wallTimeMs: direct.wallTimeMs,
    requestCount: direct.requestCount,
    evaluation: direct.evaluation,
  },
  assisted: {
    wallTimeMs: assisted.wallTimeMs,
    requestCount: assisted.requestCount,
    evaluation: assisted.evaluation,
  },
  batched: {
    wallTimeMs: batched.wallTimeMs,
    requestCount: batched.requestCount,
    evaluation: batched.evaluation,
  },
}, null, 2)}\n`);
