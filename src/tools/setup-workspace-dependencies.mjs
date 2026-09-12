import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PPT_ENGINE_PACKAGE } from "../ppt-engine/probe.mjs";

// 只从 probe.mjs 取包名，不 import index.mjs：本脚本的职责正是"让引擎变得可解析"，
// 而 index.mjs 静态 import 引擎——在联接建立之前 import 它必然失败。probe.mjs 只用 node 内置模块。
const ENGINE_PACKAGE_SEGMENTS = PPT_ENGINE_PACKAGE.split("/");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const localPackage = path.join(projectRoot, "node_modules", ...ENGINE_PACKAGE_SEGMENTS);

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
      packagePath: path.join(runtimesRoot, entry.name, "dependencies", "node", "node_modules", ...ENGINE_PACKAGE_SEGMENTS),
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
  throw new Error(`未找到 Codex 工作区内置的 ${PPT_ENGINE_PACKAGE}；请先在 Codex 中加载工作区依赖`);
}

fs.mkdirSync(path.dirname(localPackage), { recursive: true });
fs.symlinkSync(candidates[0].packagePath, localPackage, process.platform === "win32" ? "junction" : "dir");
process.stdout.write(`workspace dependency linked: ${localPackage} -> ${candidates[0].packagePath}\n`);
