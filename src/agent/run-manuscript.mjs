import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichPageIntent } from "../content/page-content.mjs";
import { mapRenderPayload } from "../render/render-payload.mjs";
import { loadContractCatalog, matchPageIntent } from "../selection/contracts.mjs";
import { createRuleValidators, validationMessage } from "../selection/validation.mjs";
import { renderNortheasternUniversityDeck } from "../runtime/skins/northeastern-university.mjs";

async function writeJson(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertValid(validators, validator, value, label) {
  if (!validator(value)) {
    throw new Error(`${label} 校验失败：${validationMessage(validators.ajv, validator)}`);
  }
}

function parseArgs(args) {
  const options = { root: process.cwd(), input: "", output: "", "run-dir": "", "qa-dir": "" };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${name || "<empty>"}`);
    const key = name.slice(2);
    if (!(key in options)) throw new Error(`不支持的参数：--${key}`);
    options[key] = value;
  }
  for (const required of ["input", "output", "run-dir"]) {
    if (!options[required]) throw new Error(`缺少 --${required}`);
  }
  return Object.fromEntries(Object.entries(options).map(([key, value]) => [key, value ? path.resolve(value) : value]));
}

export async function runManuscript(options) {
  const root = path.resolve(options.root ?? process.cwd());
  const inputPath = path.resolve(options.input);
  const outputPptx = path.resolve(options.output);
  const runDir = path.resolve(options.runDir ?? options["run-dir"]);
  const qaDir = options.qaDir ?? options["qa-dir"] ?? "";
  const specification = JSON.parse(await fs.readFile(inputPath, "utf8"));
  if (specification.skin?.id !== "northeastern-university-001") {
    throw new Error(`尚未实现 Skin：${specification.skin?.id ?? "<empty>"}`);
  }
  if (!Array.isArray(specification.pages) || specification.pages.length === 0) {
    throw new Error("真实稿件规格中没有 pages");
  }

  const validators = await createRuleValidators(root);
  const contracts = await loadContractCatalog(root);
  const pages = [];

  for (const [index, page] of specification.pages.entries()) {
    const label = `第 ${index + 1} 页 ${page.content?.pageId ?? "<unknown>"}`;
    assertValid(validators, validators.validatePageContent, page.content, `${label} PageContent`);
    const intent = enrichPageIntent(page.intentDraft, page.content);
    assertValid(validators, validators.validatePageIntent, intent, `${label} PageIntent`);
    if (!validators.purposeKeys.has(intent.purposeKey)) {
      throw new Error(`${label} 使用未知 purposeKey：${intent.purposeKey}`);
    }
    const decision = matchPageIntent(intent, contracts);
    assertValid(validators, validators.validateLayoutDecision, decision, `${label} LayoutDecision`);
    if (!decision.selectedAssetId) {
      throw new Error(`${label} 未形成唯一资产选择：${decision.decision}`);
    }
    const payload = mapRenderPayload(page.content, intent, decision);
    assertValid(validators, validators.validateRenderPayload, payload, `${label} RenderPayload`);

    const runtimePage = { meta: page.meta ?? {}, content: page.content, intent, decision, payload };
    pages.push(runtimePage);
    const pageDir = path.join(runDir, `${String(index + 1).padStart(2, "0")}-${page.content.pageId}`);
    await writeJson(path.join(pageDir, "page-content.json"), page.content);
    await writeJson(path.join(pageDir, "page-intent.json"), intent);
    await writeJson(path.join(pageDir, "layout-decision.json"), decision);
    await writeJson(path.join(pageDir, "render-payload.json"), payload);
  }

  const sourcePptx = path.resolve(root, specification.skin.sourcePptx);
  await renderNortheasternUniversityDeck({
    pages,
    sourcePptx,
    outputPptx,
    qaDir: qaDir ? path.resolve(qaDir) : "",
    manuscriptSource: specification.source,
  });
  const audit = {
    schemaVersion: "1.0",
    manuscript: specification.name,
    version: specification.version,
    input: path.relative(root, inputPath).replaceAll("\\", "/"),
    output: path.relative(root, outputPptx).replaceAll("\\", "/"),
    skinId: specification.skin.id,
    pageCount: pages.length,
    selectedAssets: pages.map((page) => page.decision.selectedAssetId),
    status: "generated-awaiting-visual-qa",
  };
  await writeJson(path.join(runDir, "run.json"), audit);
  return { outputPptx, runDir, pages, audit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runManuscript({
    root: args.root,
    input: args.input,
    output: args.output,
    runDir: args["run-dir"],
    qaDir: args["qa-dir"],
  });
  console.log(result.outputPptx);
}
