import fs from "node:fs/promises";
import path from "node:path";
import { createModelDirectorProvider } from "./model-director-provider.mjs";
import { loadDirectorGuidelines } from "./director-guidelines.mjs";

function withoutMeta(schema) {
  const copy = structuredClone(schema);
  delete copy.$schema;
  delete copy.$id;
  return copy;
}

async function loadSchemas(root) {
  const read = async (name) => withoutMeta(JSON.parse(await fs.readFile(path.join(root, "schemas", name), "utf8")));
  const [deckPlan, pageContent, pageIntent, contentReview, visualPlan, compositionPlan, visualReview] = await Promise.all([
    read("deck-plan.schema.json"),
    read("page-content.schema.json"),
    read("page-intent.schema.json"),
    read("content-review.schema.json"),
    read("visual-plan.schema.json"),
    read("composition-plan.schema.json"),
    read("visual-review.schema.json"),
  ]);
  return {
    contentDirector: {
      name: "ppagent_content_director",
      schema: {
        type: "object", additionalProperties: false, required: ["deckPlan", "pageContents"],
        properties: { deckPlan, pageContents: { type: "array", minItems: 1, items: pageContent } },
      },
    },
    contentReview: { name: "ppagent_content_review", schema: contentReview },
    visualIntent: {
      name: "ppagent_visual_intent",
      schema: {
        type: "object", additionalProperties: false, required: ["pageIntents"],
        properties: { pageIntents: { type: "array", minItems: 1, items: pageIntent } },
      },
    },
    visualComposition: {
      name: "ppagent_visual_composition",
      schema: {
        type: "object", additionalProperties: false, required: ["visualPlan", "compositionPlan"],
        properties: { visualPlan, compositionPlan },
      },
    },
    visualReview: { name: "ppagent_visual_review", schema: visualReview },
  };
}

function mimeType(filePath) {
  return path.extname(filePath).toLowerCase() === ".jpg" || path.extname(filePath).toLowerCase() === ".jpeg"
    ? "image/jpeg"
    : "image/png";
}

function outputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI Responses API 没有返回可解析的 output_text");
}

export class OpenAIJsonModel {
  constructor({ apiKey, model, endpoint = "https://api.openai.com/v1/responses", fetchImpl = globalThis.fetch }) {
    if (!apiKey) throw new Error("缺少 OPENAI_API_KEY");
    if (!model) throw new Error("缺少 PPAGENT_OPENAI_MODEL");
    if (typeof fetchImpl !== "function") throw new Error("当前 Node 运行时没有 fetch");
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.identity = `openai-responses:${model}`;
  }

  async generateJson({ role, task, context, outputSchema, imagePaths = [] }) {
    if (!outputSchema?.name || !outputSchema?.schema) throw new Error("模型调用缺少输出 JSON schema");
    const userContent = [{
      type: "input_text",
      text: `${task}\n\n以下是唯一工作上下文：\n${JSON.stringify(context)}`,
    }];
    for (const imagePath of imagePaths ?? []) {
      const bytes = await fs.readFile(path.resolve(imagePath));
      userContent.push({
        type: "input_image",
        image_url: `data:${mimeType(imagePath)};base64,${bytes.toString("base64")}`,
        detail: "high",
      });
    }
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: "system", content: [{ type: "input_text", text: `${role}。只输出符合给定 JSON Schema 的对象。` }] },
          { role: "user", content: userContent },
        ],
        text: {
          format: {
            type: "json_schema",
            name: outputSchema.name,
            schema: outputSchema.schema,
            strict: false,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI Responses API 调用失败：${response.status} ${await response.text()}`);
    return JSON.parse(outputText(await response.json()));
  }
}

export async function createOpenAIDirectorProvider({ root, apiKey, model, endpoint, fetchImpl }) {
  const resolvedRoot = path.resolve(root);
  const [schemas, guidelines] = await Promise.all([
    loadSchemas(resolvedRoot),
    loadDirectorGuidelines(resolvedRoot),
  ]);
  const contentModel = new OpenAIJsonModel({ apiKey, model, endpoint, fetchImpl });
  const visualModel = new OpenAIJsonModel({ apiKey, model, endpoint, fetchImpl });
  const reviewerModel = new OpenAIJsonModel({ apiKey, model, endpoint, fetchImpl });
  return createModelDirectorProvider({ contentModel, visualModel, reviewerModel, schemas, guidelines });
}
