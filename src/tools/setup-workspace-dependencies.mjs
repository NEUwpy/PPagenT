import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const localPackage = path.join(projectRoot, "node_modules", "@oai", "artifact-tool");

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function packageEntrypoint(target) {
  try {
    const packageJsonPath = path.join(target, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const exported = packageJson.exports?.["."];
    const relativeEntry = typeof exported === "string" ? exported : packageJson.module || packageJson.main;
    if (!relativeEntry) return null;
    const entrypoint = path.resolve(target, relativeEntry);
    return fs.statSync(entrypoint).isFile() ? entrypoint : null;
  } catch {
    return null;
  }
}

if (isDirectory(localPackage) && packageEntrypoint(localPackage)) {
  process.stdout.write(`workspace dependency ready: ${localPackage}\n`);
  process.exit(0);
}

if (fs.existsSync(localPackage)) {
  fs.rmSync(localPackage, { recursive: true, force: true });
  process.stdout.write(`removed invalid workspace dependency link: ${localPackage}\n`);
}

const runtimesRoot = path.join(os.homedir(), ".cache", "codex-runtimes");
const candidates = isDirectory(runtimesRoot)
  ? fs.readdirSync(runtimesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      runtimeName: entry.name,
      runtimePath: path.join(runtimesRoot, entry.name),
      packagePath: path.join(runtimesRoot, entry.name, "dependencies", "node", "node_modules", "@oai", "artifact-tool"),
    }))
    .filter((candidate) => isDirectory(candidate.packagePath) && packageEntrypoint(candidate.packagePath))
    .sort((left, right) => {
      const leftPrevious = left.runtimeName.includes(".previous-") ? 1 : 0;
      const rightPrevious = right.runtimeName.includes(".previous-") ? 1 : 0;
      return leftPrevious - rightPrevious
        || fs.statSync(right.runtimePath).mtimeMs - fs.statSync(left.runtimePath).mtimeMs;
    })
  : [];

if (candidates.length === 0) {
  throw new Error("未找到 Codex 工作区内置的 @oai/artifact-tool；请先在 Codex 中加载工作区依赖");
}

fs.mkdirSync(path.dirname(localPackage), { recursive: true });
fs.symlinkSync(candidates[0].packagePath, localPackage, process.platform === "win32" ? "junction" : "dir");
process.stdout.write(`workspace dependency linked: ${localPackage} -> ${candidates[0].packagePath}\n`);
