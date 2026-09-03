import fs from "node:fs/promises";
import path from "node:path";

function withoutMeta(schema) {
  const copy = structuredClone(schema);
  delete copy.$schema;
  delete copy.$id;
  return copy;
}

export async function loadDirectorOutputSchemas(root) {
  const read = async (name) => withoutMeta(
    JSON.parse(await fs.readFile(path.join(root, "schemas", name), "utf8")),
  );
  const [deckPlan, pageContent, pageIntent, contentReview, visualPlan, compositionPlan, visualReview] = await Promise.all([
    read("deck-plan.schema.json"),
    read("page-content.schema.json"),
    read("page-intent.schema.json"),
    read("content-review.schema.json"),
    read("visual-plan.schema.json"),
    read("composition-plan.schema.json"),
    read("visual-review.schema.json"),
  ]);
  const logicIntent = structuredClone(pageContent.properties.logicIntent);
  const relationBindings = {
    type: "object",
    additionalProperties: false,
    required: ["type", "literals", "references"],
    properties: {
      type: { type: "string", minLength: 1 },
      literals: {
        type: "array",
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "value"],
          properties: {
            path: { type: "string", pattern: "^/" },
            value: {
              oneOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                {
                  type: "array",
                  maxItems: 12,
                  items: {
                    type: "array",
                    maxItems: 12,
                    items: {
                      type: "array",
                      maxItems: 12,
                      items: { enum: [0, 1] },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      references: {
        type: "array",
        minItems: 1,
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "ref"],
          properties: {
            path: { type: "string", pattern: "^/" },
            ref: {
              type: "string",
              pattern: "^(?:page\\.title|item:[1-9][0-9]*\\.(?:id|title|body|point:[1-9][0-9]*))$",
            },
          },
        },
      },
    },
  };
  return {
    contentDirector: {
      name: "ppagent_content_director",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "deckMetadata", "contentMarkdown", "pageMetadata"],
        properties: {
          schemaVersion: { const: "0.1" },
          deckMetadata: {
            type: "object",
            additionalProperties: false,
            required: [
              "deckId", "title", "communicationJob", "audience", "audienceOutcome",
              "centralTakeaway", "narrativeArc",
            ],
            properties: {
              deckId: structuredClone(deckPlan.properties.deckId),
              title: structuredClone(deckPlan.properties.title),
              communicationJob: structuredClone(deckPlan.properties.communicationJob),
              audience: structuredClone(deckPlan.properties.audience),
              audienceOutcome: structuredClone(deckPlan.properties.audienceOutcome),
              centralTakeaway: structuredClone(deckPlan.properties.centralTakeaway),
              narrativeArc: structuredClone(deckPlan.properties.narrativeArc),
            },
          },
          contentMarkdown: { type: "string", minLength: 1 },
          pageMetadata: {
            type: "array",
            minItems: 1,
            maxItems: 30,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["logicIntent", "sourceBlockIds"],
              properties: {
                logicIntent,
                itemMetadata: {
                  type: "array",
                  maxItems: 20,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      logicIntent,
                      emphasis: { type: "boolean" },
                      polarity: { enum: ["positive", "negative", "neutral"] },
                    },
                  },
                },
                sourceAnchors: {
                  type: "array",
                  minItems: 1,
                  maxItems: 2,
                  items: { type: "string", minLength: 1, maxLength: 160 },
                },
                sourceBlockIds: {
                  type: "array",
                  minItems: 1,
                  uniqueItems: true,
                  items: { type: "string", pattern: "^source-[0-9]{3,}$" },
                },
                relationBindings,
              },
            },
          },
        },
      },
    },
    contentReview: { name: "ppagent_content_review", schema: contentReview },
    visualIntent: {
      name: "ppagent_visual_intent",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["pageIntents"],
        properties: {
          pageIntents: { type: "array", minItems: 1, items: pageIntent },
        },
      },
    },
    visualComposition: {
      name: "ppagent_visual_composition",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["visualPlan", "compositionPlan"],
        properties: {
          visualPlan,
          compositionPlan,
          semanticRefinementRequests: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["pageId", "familyId", "variantId", "itemIds", "reason"],
              properties: {
                pageId: { type: "string", minLength: 1 },
                familyId: { type: "string", minLength: 1 },
                variantId: { type: "string", minLength: 1 },
                itemIds: {
                  type: "array",
                  minItems: 1,
                  maxItems: 6,
                  uniqueItems: true,
                  items: { type: "string", minLength: 1 },
                },
                reason: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
    visualReview: { name: "ppagent_visual_review", schema: visualReview },
  };
}
