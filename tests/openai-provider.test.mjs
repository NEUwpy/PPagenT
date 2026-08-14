import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createModelDirectorProvider } from "../src/agent/model-director-provider.mjs";
import { OpenAIJsonModel } from "../src/agent/openai-director-provider.mjs";
import { loadDirectorGuidelines } from "../src/agent/director-guidelines.mjs";

test("模型 DirectorProvider 为两位导演和研发审查调用传入明确输出 schema 与渲染图片", async () => {
  const calls = [];
  const model = {
    identity: "fake:model",
    async generateJson(input) {
      calls.push(input);
      return {};
    },
  };
  const schemas = Object.fromEntries(
    ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"]
      .map((name) => [name, { name, schema: { type: "object" } }]),
  );
  schemas.visualIntent.schema = {
    type: "object",
    properties: {
      pageIntents: { items: { properties: { purposeKey: { type: "string" } } } },
    },
  };
  const provider = createModelDirectorProvider({
    contentModel: model, visualModel: model, reviewerModel: model, schemas,
    guidelines: {
      content: "内容准则",
      visual: "视觉准则",
      purposeVocabulary: [{ key: "explain_topics", description: "说明主题" }],
    },
  });
  await provider.contentDirector({ rawMarkdown: "原稿", attempt: 1 });
  await provider.contentReview({ rawMarkdown: "原稿", attempt: 1, deckPlan: {}, pageContents: [] });
  await provider.visualDirector({ phase: "intent", attempt: 1, deckPlan: {}, pageContents: [] });
  await provider.visualDirector({ phase: "composition", attempt: 1, deckPlan: {}, pageContents: [], candidateSets: [] });
  await provider.visualReview({ stage: "post-render", pageEvidence: ["a.png"], attempt: 1 });
  assert.deepEqual(calls.map((call) => call.outputSchema.name), [
    "contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview",
  ]);
  assert.deepEqual(calls.at(-1).imagePaths, ["a.png"]);
  assert.equal(calls[0].context.executionGuidelines, "内容准则");
  assert.equal(calls[2].context.executionGuidelines, "视觉准则");
  assert.equal(calls[2].context.allowedPurposeVocabulary[0].key, "explain_topics");
  assert.deepEqual(
    calls[2].outputSchema.schema.properties.pageIntents.items.properties.purposeKey.enum,
    ["explain_topics"],
  );
  assert.equal(calls[3].context.executionGuidelines, "视觉准则");
  assert.match(calls[3].task, /CompositionPlan/);
  assert.equal(provider.metadata.providerKind, "live-schema-aware-model-provider");
});

test("API 运行时直接读取正式生成工作流中的两份导演提示词", async () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
  const guidelines = await loadDirectorGuidelines(root);
  assert.match(guidelines.content, /内容导演读取完整原稿/);
  assert.match(guidelines.visual, /不得现场自创结构/);
  assert.match(guidelines.visual, /整页信息构成/);
});

test("OpenAI Responses 客户端发送 JSON Schema 并把逐页 PNG 作为视觉输入", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-openai-provider-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  const imagePath = path.join(tempDir, "page.png");
  await fs.writeFile(imagePath, Buffer.from([137, 80, 78, 71]));
  let requestBody = null;
  const model = new OpenAIJsonModel({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }] }; } };
    },
  });
  const output = await model.generateJson({
    role: "审查者",
    task: "逐页审查",
    context: { stage: "post-render" },
    outputSchema: { name: "review", schema: { type: "object", properties: { ok: { type: "boolean" } } } },
    imagePaths: [imagePath],
  });
  assert.deepEqual(output, { ok: true });
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.name, "review");
  assert.equal(requestBody.input[1].content[1].type, "input_image");
  assert.match(requestBody.input[1].content[1].image_url, /^data:image\/png;base64,/);
});
