import fs from "node:fs/promises";
import path from "node:path";
import {
  DistillationArtifactError,
  collectLocalDependencyClosure,
  sha256File,
  summarizeInputArtifacts,
  validateArtifactSummary,
} from "./artifacts.mjs";

function fail(code, message, details = {}) {
  throw new DistillationArtifactError(code, message, details);
}

function posixPath(value) {
  return value.replaceAll(path.sep, "/");
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function realRepositoryRoot(repoRoot) {
  const root = path.resolve(repoRoot);
  let stat;
  try {
    stat = await fs.stat(root);
  } catch (error) {
    if (error?.code === "ENOENT") fail("REPOSITORY_ROOT_MISSING", `repository root does not exist: ${root}`);
    throw error;
  }
  if (!stat.isDirectory()) fail("REPOSITORY_ROOT_INVALID", `repository root is not a directory: ${root}`);
  return fs.realpath(root);
}

async function forbiddenTargets(root, forbiddenPaths) {
  const targets = new Set();
  for (const value of forbiddenPaths) {
    const lexical = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
    targets.add(lexical);
    try {
      targets.add(await fs.realpath(lexical));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return targets;
}

async function resolveArtifact(root, artifact) {
  if (!validateArtifactSummary(artifact)) {
    fail("ARTIFACT_SUMMARY_INVALID", "artifact summary is incomplete or malformed", { artifact });
  }
  if (path.isAbsolute(artifact.path)) {
    fail("ARTIFACT_PATH_ABSOLUTE", "artifact paths must be repository-relative", { path: artifact.path });
  }
  const lexical = path.resolve(root, artifact.path);
  if (!isInside(root, lexical)) {
    fail("ARTIFACT_PATH_ESCAPE", "artifact path escapes repository", { path: artifact.path });
  }
  let stat;
  try {
    stat = await fs.stat(lexical);
  } catch (error) {
    if (error?.code === "ENOENT") fail("ARTIFACT_FILE_MISSING", "artifact file is missing", { path: artifact.path });
    throw error;
  }
  if (!stat.isFile()) fail("ARTIFACT_NOT_FILE", "artifact path is not a file", { path: artifact.path });
  const realTarget = await fs.realpath(lexical);
  if (!isInside(root, realTarget)) {
    fail("ARTIFACT_PATH_ESCAPE", "artifact symlink resolves outside repository", { path: artifact.path });
  }
  return { lexical, realTarget, relativePath: posixPath(path.relative(root, realTarget)) };
}

export async function verifyArtifactSummaries(artifacts, {
  repoRoot = process.cwd(),
  forbiddenPaths = [],
} = {}) {
  if (!Array.isArray(artifacts)) fail("ARTIFACT_LIST_INVALID", "artifacts must be an array");
  const root = await realRepositoryRoot(repoRoot);
  const forbidden = await forbiddenTargets(root, forbiddenPaths);
  const roles = new Set();
  const lexicalPaths = new Set();
  const realPaths = new Set();
  const verified = [];

  for (const artifact of artifacts) {
    if (artifact?.role === "validation-report") {
      fail("FORBIDDEN_ARTIFACT_ROLE", "validation report cannot be listed as its own evidence");
    }
    if (roles.has(artifact?.role)) {
      fail("DUPLICATE_ARTIFACT_ROLE", `artifact role appears more than once: ${artifact?.role}`, {
        role: artifact?.role,
      });
    }
    roles.add(artifact?.role);
    const resolved = await resolveArtifact(root, artifact);
    if (lexicalPaths.has(resolved.lexical) || realPaths.has(resolved.realTarget)) {
      fail("DUPLICATE_ARTIFACT_PATH", `artifact file appears more than once: ${artifact.path}`, {
        path: artifact.path,
      });
    }
    lexicalPaths.add(resolved.lexical);
    realPaths.add(resolved.realTarget);
    if (forbidden.has(resolved.lexical) || forbidden.has(resolved.realTarget)) {
      fail("FORBIDDEN_ARTIFACT_PATH", "forbidden file cannot be listed as evidence", { path: artifact.path });
    }
    const current = await sha256File(resolved.realTarget);
    if (current.sizeBytes !== artifact.sizeBytes) {
      fail("ARTIFACT_SIZE_MISMATCH", "artifact size changed after summary", {
        path: artifact.path,
        expected: artifact.sizeBytes,
        actual: current.sizeBytes,
      });
    }
    if (current.digest !== artifact.digest) {
      fail("ARTIFACT_DIGEST_MISMATCH", "artifact content changed after summary", {
        path: artifact.path,
        expected: artifact.digest,
        actual: current.digest,
      });
    }
    verified.push({ ...artifact, path: resolved.relativePath });
  }

  return {
    status: "passed",
    artifacts: verified.sort((left, right) => left.path.localeCompare(right.path) || left.role.localeCompare(right.role)),
  };
}

const REQUIRED_CONFIG_FIELDS = [
  "repoRoot",
  "caseManifestPath",
  "assetMetadataPath",
  "sourcePptxPath",
  "skinSourcePath",
  "lockfilePath",
  "auditorPath",
  "builderEntryPath",
  "validationReportPath",
];

export async function buildRequiredInputArtifacts(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    fail("INPUT_CONFIG_INVALID", "input artifact configuration must be an object");
  }
  if (Object.hasOwn(config, "inputs") || Object.hasOwn(config, "rawInputs") || Object.hasOwn(config, "artifacts")) {
    fail("RAW_INPUTS_FORBIDDEN", "callers cannot provide raw input artifacts");
  }
  const unknown = Object.keys(config).filter((key) => !REQUIRED_CONFIG_FIELDS.includes(key));
  if (unknown.length) fail("UNKNOWN_INPUT_CONFIG_FIELD", `unknown input artifact configuration: ${unknown.join(", ")}`);
  const missing = REQUIRED_CONFIG_FIELDS.filter((key) => typeof config[key] !== "string" || config[key].length === 0);
  if (missing.length) fail("INPUT_CONFIG_FIELD_MISSING", `missing input artifact configuration: ${missing.join(", ")}`);

  const fixedEntries = [
    { role: "case-manifest", path: config.caseManifestPath },
    { role: "asset-metadata", path: config.assetMetadataPath },
    { role: "source-pptx", path: config.sourcePptxPath },
    { role: "lockfile", path: config.lockfilePath },
  ];
  const fixed = await summarizeInputArtifacts(fixedEntries, {
    repoRoot: config.repoRoot,
    validationReportPath: config.validationReportPath,
  });
  const root = await realRepositoryRoot(config.repoRoot);
  const entrySpecs = [
    ["builder-entry", config.builderEntryPath],
    ["skin-entry", config.skinSourcePath],
    ["auditor-entry", config.auditorPath],
  ];
  const codeByPath = new Map();
  const entryPathByRole = new Map();
  for (const [role, entryPath] of entrySpecs) {
    const realEntry = await fs.realpath(path.resolve(root, entryPath));
    const relativeEntry = posixPath(path.relative(root, realEntry));
    if ([...entryPathByRole.values()].includes(relativeEntry)) {
      fail("INPUT_ENTRY_PATH_COLLISION", `multiple required code entries resolve to ${relativeEntry}`);
    }
    entryPathByRole.set(role, relativeEntry);
    const closure = await collectLocalDependencyClosure(entryPath, { repoRoot: config.repoRoot });
    for (const artifact of closure) codeByPath.set(artifact.path, artifact);
  }
  const entryArtifacts = [...entryPathByRole].map(([role, entryPath]) => {
    const artifact = codeByPath.get(entryPath);
    if (!artifact) fail("INPUT_ENTRY_MISSING_FROM_CLOSURE", `${role} is missing from its dependency closure`);
    codeByPath.delete(entryPath);
    return { role, ...artifact };
  });
  const dependencyArtifacts = [...codeByPath.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((artifact, index) => ({
      role: `code-dependency-${String(index + 1).padStart(3, "0")}`,
      ...artifact,
    }));
  const artifacts = [...fixed, ...entryArtifacts, ...dependencyArtifacts];
  return (await verifyArtifactSummaries(artifacts, {
    repoRoot: config.repoRoot,
    forbiddenPaths: [config.validationReportPath],
  })).artifacts;
}
