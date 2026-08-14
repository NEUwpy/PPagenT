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
  return {
    contentDirector: {
      name: "ppagent_content_director",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["deckPlan", "pageContents"],
        properties: {
          deckPlan,
          pageContents: { type: "array", minItems: 1, items: pageContent },
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
        properties: { visualPlan, compositionPlan },
      },
    },
    visualReview: { name: "ppagent_visual_review", schema: visualReview },
  };
}
