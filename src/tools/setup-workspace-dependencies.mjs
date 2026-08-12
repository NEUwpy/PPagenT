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

if (isDirectory(localPackage)) {
  process.stdout.write(`workspace dependency ready: ${localPackage}\n`);
  process.exit(0);
}

if (fs.existsSync(localPackage)) {
  throw new Error(`依赖位置已存在但不可用，请人工检查：${localPackage}`);
}

const runtimesRoot = path.join(os.homedir(), ".cache", "codex-runtimes");
const candidates = isDirectory(runtimesRoot)
  ? fs.readdirSync(runtimesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(runtimesRoot, entry.name, "dependencies", "node", "node_modules", "@oai", "artifact-tool"))
    .filter(isDirectory)
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
  : [];

if (candidates.length === 0) {
  throw new Error("未找到 Codex 工作区内置的 @oai/artifact-tool；请先在 Codex 中加载工作区依赖");
}

fs.mkdirSync(path.dirname(localPackage), { recursive: true });
fs.symlinkSync(candidates[0], localPackage, process.platform === "win32" ? "junction" : "dir");
process.stdout.write(`workspace dependency linked: ${localPackage} -> ${candidates[0]}\n`);
