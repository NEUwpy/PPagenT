import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
const schema = JSON.parse(await fs.readFile(new URL("content.schema.json", import.meta.url), "utf8"));
const checkSchema = new Ajv({ allErrors: true }).compile(schema);

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export async function validateContent(content, sourceRoot = repository) {
  if (!checkSchema(content)) {
    return checkSchema.errors.map(({ instancePath, message }) => `${instancePath || "/"} ${message}`);
  }
  const errors = [];
  const root = await fs.realpath(sourceRoot);
  const sourceIds = new Set();
  const files = new Map();
  for (const { id, file, quote } of content.sources) {
    if (sourceIds.has(id)) errors.push(`重复来源 ${id}`);
    sourceIds.add(id);
    try {
      const target = path.resolve(root, file);
      if (path.isAbsolute(file) || !inside(root, target)) throw new Error("需要稿件根目录内的相对路径");
      if (!files.has(target)) {
        const resolved = await fs.realpath(target);
        if (!inside(root, resolved)) throw new Error("来源文件解析到稿件根目录外");
        files.set(target, await fs.readFile(resolved, "utf8"));
      }
      if (!files.get(target).includes(quote)) throw new Error("引文无法逐字定位");
    } catch (error) {
      errors.push(`${id}（${file}） ${error.message}`);
    }
  }

  const ids = new Set();
  function register(id) {
    if (ids.has(id)) errors.push(`页内重复 ID ${id}`);
    ids.add(id);
  }
  function walk(value, location) {
    if (!value || typeof value !== "object") return;
    for (const id of value.sourceIds ?? []) {
      if (!sourceIds.has(id)) errors.push(`${location} 引用未知来源 ${id}`);
    }
    for (const [key, child] of Object.entries(value)) walk(child, location + "/" + key);
  }
  function checkScopes(scopes, children) {
    const siblings = new Set(children.map(({ id }) => id));
    for (const { id, appliesTo } of scopes ?? []) {
      register(id);
      for (const target of appliesTo) {
        if (!siblings.has(target)) errors.push(`${id} 的作用域 ${target} 不属于该层级`);
      }
    }
  }
  function checkDetail({ id, detail }) {
    if (!detail) return;
    const outgoing = new Map(detail.nodes.map((node) => [node.id, new Set()]));
    const seen = new Set();
    for (const node of detail.nodes) register(node.id);
    for (const { type, from, to } of detail.links ?? []) {
      if (type === "precedes" && from.length !== 1) errors.push(`${id} 的一条先后边必须只有一个起点`);
      if (type === "contributes-to" && from.includes(to)) errors.push(`${id} 的成因集合包含自身结果`);
      const key = JSON.stringify([type, [...from].sort(), to]);
      if (seen.has(key)) errors.push(`${id} 含重复链接 ${key}`);
      seen.add(key);
      for (const start of from) {
        if (outgoing.has(start) && outgoing.has(to)) outgoing.get(start).add(to);
        else errors.push(`${id} 的链接 ${start} → ${to} 越出本条目`);
      }
    }
    const complete = new Set();
    const active = new Set();
    function visit(node) {
      if (active.has(node)) return false;
      if (complete.has(node)) return true;
      active.add(node);
      const acyclic = [...outgoing.get(node)].every(visit);
      active.delete(node);
      complete.add(node);
      return acyclic;
    }
    if (![...outgoing.keys()].every(visit)) errors.push(`${id} 的节点链接成环`);
  }

  const { page } = content;
  register(page.id);
  walk(page, "/page");
  checkScopes(page.scopeNotes, page.groups);
  for (const group of page.groups) {
    register(group.id);
    checkScopes(group.scopeNotes, group.items);
    if (group.relation === "comparison" && group.items.length < 2) errors.push(`${group.id} 至少需要两项才能比较`);
    if (group.relation === "cases" && group.items.filter((item) => !item.appliesAcrossCases).length < 2) {
      errors.push(`${group.id} 至少需要两个适用情形`);
    }
    for (const item of group.items) {
      register(item.id);
      if (item.appliesAcrossCases && group.relation !== "cases") errors.push(`${item.id} 没有对应的情形组`);
      checkDetail(item);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length < 3) throw new Error("node validate-content.mjs <input.json> [...]");
  for (const file of process.argv.slice(2)) {
    const errors = await validateContent(JSON.parse(await fs.readFile(file, "utf8")));
    console.log(JSON.stringify({ file, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  }
}
