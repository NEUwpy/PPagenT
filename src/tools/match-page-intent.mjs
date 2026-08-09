import fs from "node:fs/promises";
import path from "node:path";
import { loadContractCatalog, matchPageIntent } from "../selection/contracts.mjs";
import { createRuleValidators, validationMessage } from "../selection/validation.mjs";

function parseArgs(args) {
  const options = { root: process.cwd(), intent: null, includeDeferred: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") options.root = path.resolve(args[++index]);
    else if (arg === "--intent") options.intent = path.resolve(args[++index]);
    else if (arg === "--include-deferred") options.includeDeferred = true;
    else throw new Error(`未知参数: ${arg}`);
  }
  if (!options.intent) throw new Error("需要 --intent <page-intent.json>");
  return options;
}

const options = parseArgs(process.argv.slice(2));
const intent = JSON.parse(await fs.readFile(options.intent, "utf8"));
const validators = await createRuleValidators(options.root);
if (!validators.validatePageIntent(intent)) {
  throw new Error(`PageIntent 校验失败: ${validationMessage(validators.ajv, validators.validatePageIntent)}`);
}
if (!validators.purposeKeys.has(intent.purposeKey)) {
  throw new Error(`未知 purposeKey: ${intent.purposeKey}`);
}
const contracts = await loadContractCatalog(options.root);
const result = matchPageIntent(intent, contracts, { includeDeferred: options.includeDeferred });
console.log(JSON.stringify(result, null, 2));
