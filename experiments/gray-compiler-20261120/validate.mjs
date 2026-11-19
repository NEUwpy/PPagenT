import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";

const schema = JSON.parse(await fs.readFile(new URL("page-plan.schema.json", import.meta.url), "utf8"));
const validateSchema = new Ajv({ allErrors: true }).compile(schema);

export function collectFields(value, location = "/page") {
  if (!value || typeof value !== "object") return [];
  if (typeof value.text === "string" && Array.isArray(value.sourceIds)) return [{ field: value, location }];
  return Object.entries(value).flatMap(([key, child]) => collectFields(child, location + "/" + key));
}

export function onSlideFields(page) {
  const { notes, ...visible } = page;
  return collectFields(visible);
}

export function bindingKey(text, sourceIds) {
  return JSON.stringify([text, [...sourceIds].sort()]);
}

function isInside(root, file) {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export async function validatePagePlan(plan, repository) {
  if (!validateSchema(plan)) {
    return { errors: validateSchema.errors.map(({ instancePath, keyword, message, params }) => ({
      code: "schema", location: instancePath || "/", rule: keyword, message, params,
    })), sources: [] };
  }

  const errors = [];
  const resolvedSources = [];
  const sourceIds = new Set();
  const files = new Map();
  const root = await fs.realpath(repository);
  const fail = (code, location, message) => errors.push({ code, location, message });
  for (const [index, source] of plan.sources.entries()) {
    const location = "/sources/" + index;
    if (sourceIds.has(source.id)) {
      fail("duplicate-source", location, source.id);
      continue;
    }
    sourceIds.add(source.id);
    const candidate = path.resolve(root, source.file);
    if (path.isAbsolute(source.file) || !isInside(root, candidate)) {
      fail("source-path", location, "来源必须是仓库内的相对文件路径");
      continue;
    }
    try {
      if (!files.has(candidate)) {
        const file = await fs.realpath(candidate);
        if (!isInside(root, file)) throw new Error("来源文件解析到仓库外部");
        const text = await fs.readFile(file, "utf8");
        files.set(candidate, { text, sha256: createHash("sha256").update(text).digest("hex") });
      }
      const { text, sha256 } = files.get(candidate);
      const start = text.indexOf(source.quote);
      if (!source.quote.trim() || start < 0) {
        fail("source-quote", location, source.id + " 的引文没有在来源中逐字找到");
        continue;
      }
      const end = start + source.quote.length;
      resolvedSources.push({ ...source, sha256, span: [start, end], spanUnit: "UTF-16",
        ambiguousQuote: text.indexOf(source.quote, start + 1) >= 0 });
    } catch (error) {
      fail("source-file", location, error.message);
    }
  }

  for (const { field, location } of collectFields(plan.page)) {
    if (!field.text.trim() || field.text !== field.text.trim()) {
      fail("field-text", location, "文字需要非空，并去掉首尾空白");
    }
    for (const id of field.sourceIds) {
      if (!sourceIds.has(id)) fail("unknown-source", location, id);
    }
  }

  const ids = new Map();
  function register(id, location, registry = ids) {
    if (registry.has(id)) fail("duplicate-id", location, id + " 已在 " + registry.get(id) + " 注册");
    else registry.set(id, location);
  }
  function checkNotes(notes, validTargets, location) {
    for (const [index, note] of (notes ?? []).entries()) {
      const here = location + "/" + index;
      register(note.id, here);
      for (const target of note.appliesTo) {
        if (!validTargets.has(target)) fail("invalid-scope", here, target + " 不属于此说明所在范围");
      }
    }
  }
  for (const [groupIndex, group] of plan.page.groups.entries()) {
    const location = "/page/groups/" + groupIndex;
    register(group.id, location);
    if (["comparison", "sequence"].includes(group.relation) && group.items.length < 2) {
      fail("relation-count", location, group.relation + " 至少需要两项");
    }
    for (const [index, item] of group.items.entries()) {
      const here = location + "/items/" + index;
      register(item.id, here);
      if (item.component?.kind === "convergence") {
        const inputs = new Map();
        item.component.inputs.forEach((input, number) =>
          register(input.id, here + "/component/inputs/" + number, inputs));
      }
    }
    checkNotes(group.scopeNotes, new Set(group.items.map(({ id }) => id)), location + "/scopeNotes");
  }
  checkNotes(plan.page.scopeNotes, new Set(plan.page.groups.map(({ id }) => id)), "/page/scopeNotes");
  return { errors, sources: resolvedSources };
}
