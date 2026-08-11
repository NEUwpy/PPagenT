import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const JAVASCRIPT_EXTENSIONS = new Set([".js", ".mjs"]);

export class DistillationArtifactError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DistillationArtifactError";
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(code, message, details) {
  throw new DistillationArtifactError(code, message, details);
}

function posixPath(value) {
  return value.replaceAll(path.sep, "/");
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function existingFile(target, code = "ARTIFACT_FILE_MISSING") {
  let stat;
  try {
    stat = await fs.stat(target);
  } catch (error) {
    if (error?.code === "ENOENT") fail(code, `file does not exist: ${target}`, { path: target });
    throw error;
  }
  if (!stat.isFile()) fail("ARTIFACT_NOT_FILE", `expected a file: ${target}`, { path: target });
  return stat;
}

async function resolveRepoFile(repoRoot, target, missingCode) {
  const resolvedRoot = await fs.realpath(path.resolve(repoRoot));
  const lexicalTarget = path.resolve(resolvedRoot, target);
  if (lexicalTarget !== resolvedRoot && !isInside(resolvedRoot, lexicalTarget)) {
    fail("ARTIFACT_PATH_ESCAPE", `path escapes repository: ${target}`, { path: target });
  }
  await existingFile(lexicalTarget, missingCode);
  const realTarget = await fs.realpath(lexicalTarget);
  if (!isInside(resolvedRoot, realTarget)) {
    fail("ARTIFACT_PATH_ESCAPE", `resolved path escapes repository: ${target}`, { path: target });
  }
  return { resolvedRoot, absolutePath: realTarget, relativePath: posixPath(path.relative(resolvedRoot, realTarget)) };
}

export async function sha256File(target) {
  const absolutePath = path.resolve(target);
  const stat = await existingFile(absolutePath);
  const bytes = await fs.readFile(absolutePath);
  return {
    digest: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`,
    sizeBytes: stat.size,
  };
}

function tokenizeModule(source) {
  let output = "";
  let state = "code";
  let quote = null;
  let stringValue = "";
  const strings = [];
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") {
        state = "code";
        output += character;
      } else output += " ";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else output += character === "\n" ? "\n" : " ";
      continue;
    }
    if (state === "string") {
      if (character === "\\") {
        if (index + 1 < source.length) {
          const escaped = source[++index];
          stringValue += escaped;
        }
      } else if (character === quote) {
        output += `__PPAGENT_STRING_${strings.length}__`;
        strings.push(stringValue);
        state = "code";
        quote = null;
        stringValue = "";
      } else stringValue += character;
      continue;
    }
    if (character === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
    } else {
      output += character;
      if (character === "'" || character === '"' || character === "`") {
        state = "string";
        quote = character;
        output = output.slice(0, -1);
      }
    }
  }
  return { code: output, strings };
}

function moduleSpecifiers(source, modulePath) {
  const { code, strings } = tokenizeModule(source);
  const dynamicPattern = /\bimport\s*\(\s*__PPAGENT_STRING_(\d+)__\s*\)/gu;
  for (const match of code.matchAll(dynamicPattern)) {
    const specifier = strings[Number(match[1])];
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      fail("DYNAMIC_LOCAL_IMPORT", `dynamic local import is not auditable: ${specifier}`, {
        modulePath,
        specifier,
      });
    }
  }
  if (/\bimport\s*\(/u.test(code.replace(dynamicPattern, ""))) {
    fail("DYNAMIC_IMPORT_UNAUDITABLE", "non-literal dynamic import cannot produce a complete dependency closure", {
      modulePath,
    });
  }

  const specifiers = [];
  const patterns = [
    /\bimport\s*(?:(?:[\w*$\s{},]+)\s+from\s+)?__PPAGENT_STRING_(\d+)__/gu,
    /\bexport\s*(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*__PPAGENT_STRING_(\d+)__/gu,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) specifiers.push(strings[Number(match[1])]);
  }
  return [...new Set(specifiers)].sort();
}

export async function collectLocalDependencyClosure(entryModule, { repoRoot = process.cwd() } = {}) {
  const entry = await resolveRepoFile(repoRoot, entryModule, "DEPENDENCY_ENTRY_MISSING");
  if (path.extname(entry.absolutePath).toLowerCase() === ".cjs") {
    fail("UNSUPPORTED_CJS_DEPENDENCY", "CommonJS dependency closure is not statically auditable", {
      path: entry.relativePath,
    });
  }
  const pending = [entry.absolutePath];
  const visited = new Set();
  const files = new Map();

  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const relativePath = posixPath(path.relative(entry.resolvedRoot, current));
    const summary = await sha256File(current);
    files.set(relativePath, { path: relativePath, ...summary });

    if (!JAVASCRIPT_EXTENSIONS.has(path.extname(current).toLowerCase())) continue;
    const source = await fs.readFile(current, "utf8");
    for (const specifier of moduleSpecifiers(source, relativePath)) {
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
      const lexicalDependency = path.resolve(path.dirname(current), specifier);
      if (!isInside(entry.resolvedRoot, lexicalDependency)) {
        fail("DEPENDENCY_PATH_ESCAPE", `dependency escapes repository: ${specifier}`, {
          modulePath: relativePath,
          specifier,
        });
      }
      await existingFile(lexicalDependency, "DEPENDENCY_FILE_MISSING");
      const realDependency = await fs.realpath(lexicalDependency);
      if (!isInside(entry.resolvedRoot, realDependency)) {
        fail("DEPENDENCY_PATH_ESCAPE", `resolved dependency escapes repository: ${specifier}`, {
          modulePath: relativePath,
          specifier,
        });
      }
      if (path.extname(realDependency).toLowerCase() === ".cjs") {
        fail("UNSUPPORTED_CJS_DEPENDENCY", "CommonJS dependency closure is not statically auditable", {
          modulePath: relativePath,
          specifier,
        });
      }
      pending.push(realDependency);
    }
  }

  return [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function existingDirectory(target, code) {
  let stat;
  try {
    stat = await fs.stat(target);
  } catch (error) {
    if (error?.code === "ENOENT") fail(code, `directory does not exist: ${target}`, { path: target });
    throw error;
  }
  if (!stat.isDirectory()) fail(code, `expected a directory: ${target}`, { path: target });
}

export async function createFreshRunDirectory({ allowedRoot, runDir }) {
  if (!allowedRoot || !runDir) fail("RUN_DIR_ARGUMENT_REQUIRED", "allowedRoot and runDir are required");
  const lexicalRoot = path.resolve(allowedRoot);
  await existingDirectory(lexicalRoot, "ALLOWED_ROOT_INVALID");
  const realRoot = await fs.realpath(lexicalRoot);
  const target = path.resolve(runDir);
  if (target === lexicalRoot || target === realRoot) {
    fail("RUN_DIR_EQUALS_ALLOWED_ROOT", "runDir must not equal allowedRoot", { runDir: target });
  }
  if (!isInside(lexicalRoot, target)) {
    fail("RUN_DIR_PATH_ESCAPE", "runDir must stay under allowedRoot", { runDir: target });
  }

  const parent = path.dirname(target);
  await existingDirectory(parent, "RUN_DIR_PARENT_INVALID");
  const realParent = await fs.realpath(parent);
  if (realParent !== realRoot && !isInside(realRoot, realParent)) {
    fail("RUN_DIR_PATH_ESCAPE", "runDir parent resolves outside allowedRoot", { runDir: target });
  }
  try {
    await fs.mkdir(target, { recursive: false });
  } catch (error) {
    if (error?.code === "EEXIST") fail("RUN_DIR_ALREADY_EXISTS", "runDir already exists", { runDir: target });
    throw error;
  }
  return target;
}

export async function summarizeInputArtifacts(entries, { repoRoot = process.cwd(), validationReportPath } = {}) {
  if (!validationReportPath) fail("VALIDATION_REPORT_PATH_REQUIRED", "validationReportPath is required");
  const resolvedRoot = await fs.realpath(path.resolve(repoRoot));
  const lexicalReportTarget = path.resolve(resolvedRoot, validationReportPath);
  if (!isInside(resolvedRoot, lexicalReportTarget)) {
    fail("VALIDATION_REPORT_PATH_ESCAPE", "validation report must stay inside repository", {
      path: validationReportPath,
    });
  }
  let reportTarget = lexicalReportTarget;
  try {
    reportTarget = await fs.realpath(lexicalReportTarget);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!isInside(resolvedRoot, reportTarget)) {
    fail("VALIDATION_REPORT_PATH_ESCAPE", "resolved validation report escapes repository", {
      path: validationReportPath,
    });
  }
  const seen = new Set();
  const artifacts = [];
  for (const entry of entries) {
    if (!entry?.role || !entry?.path) fail("ARTIFACT_ENTRY_INVALID", "artifact role and path are required");
    const resolved = await resolveRepoFile(resolvedRoot, entry.path, "ARTIFACT_FILE_MISSING");
    if (resolved.absolutePath === reportTarget) {
      fail("VALIDATION_REPORT_SELF_DIGEST", "validation report must not summarize itself", { path: entry.path });
    }
    const key = `${entry.role}\0${resolved.relativePath}`;
    if (seen.has(key)) fail("DUPLICATE_ARTIFACT_ENTRY", `duplicate artifact entry: ${entry.role}/${entry.path}`);
    seen.add(key);
    artifacts.push({ role: entry.role, path: resolved.relativePath, ...await sha256File(resolved.absolutePath) });
  }
  return artifacts.sort((left, right) => left.path.localeCompare(right.path) || left.role.localeCompare(right.role));
}

export async function writeInputArtifactList(outputPath, entries, options) {
  const target = path.resolve(outputPath);
  const reportTarget = path.resolve(options.repoRoot ?? process.cwd(), options.validationReportPath ?? "");
  if (target === reportTarget) {
    fail("VALIDATION_REPORT_SELF_WRITE", "input artifact list must not overwrite validation report", { path: target });
  }
  const artifacts = await summarizeInputArtifacts(entries, options);
  const payload = { schemaVersion: "1.0", artifacts };
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return payload;
}

export function validateArtifactSummary(value) {
  return Boolean(value
    && typeof value.path === "string"
    && typeof value.role === "string"
    && DIGEST_PATTERN.test(value.digest)
    && Number.isInteger(value.sizeBytes)
    && value.sizeBytes >= 0);
}
