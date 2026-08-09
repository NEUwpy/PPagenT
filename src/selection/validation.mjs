import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

export async function createRuleValidators(root = process.cwd()) {
  const schemaRoot = path.join(root, "schemas");
  const names = [
    "page-content.schema.json",
    "page-intent.schema.json",
    "asset-contract.schema.json",
    "resolution-plan.schema.json",
    "layout-decision.schema.json",
    "render-payload.schema.json",
    "failure-case.schema.json",
  ];
  const schemas = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readJson(path.join(schemaRoot, name))])));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const schema of Object.values(schemas)) ajv.addSchema(schema);

  const purposeVocabulary = await readJson(path.join(root, "catalog", "purpose-vocabulary.json"));
  const purposeKeys = new Set(purposeVocabulary.purposes.map((item) => item.key));

  return {
    ajv,
    purposeKeys,
    validatePageContent: ajv.getSchema(schemas["page-content.schema.json"].$id),
    validatePageIntent: ajv.getSchema(schemas["page-intent.schema.json"].$id),
    validateAssetContract: ajv.getSchema(schemas["asset-contract.schema.json"].$id),
    validateResolutionPlan: ajv.getSchema(schemas["resolution-plan.schema.json"].$id),
    validateLayoutDecision: ajv.getSchema(schemas["layout-decision.schema.json"].$id),
    validateRenderPayload: ajv.getSchema(schemas["render-payload.schema.json"].$id),
    validateFailureCase: ajv.getSchema(schemas["failure-case.schema.json"].$id),
  };
}

export function validationMessage(ajv, validator) {
  return ajv.errorsText(validator.errors, { separator: "; " });
}
