import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { defaultProjectRoot } from "./visual-skill-dashboard-data.mjs";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 25 || (major === 25 && minor < 5)) {
  throw new Error(`构建 PPA看板.exe 需要 Node.js 25.5 或更高版本；当前为 ${process.versions.node}。`);
}

const tempRoot = path.join(defaultProjectRoot, ".tmp", "ppa-dashboard-exe");
const tempOutput = path.join(tempRoot, "PPA看板.exe");
const finalOutput = path.join(defaultProjectRoot, "PPA看板.exe");
const configPath = path.join(tempRoot, "sea-config.json");
const config = {
  main: path.join(defaultProjectRoot, "src", "launcher", "ppa-dashboard-main.cjs"),
  mainFormat: "commonjs",
  output: tempOutput,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  execArgvExtension: "none",
};

await fs.mkdir(tempRoot, { recursive: true });
await fs.rm(tempOutput, { force: true });
await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--build-sea", configPath], {
    cwd: defaultProjectRoot,
    windowsHide: true,
    stdio: "inherit",
  });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Node SEA 构建失败，退出码 ${code}`)));
});

await fs.copyFile(tempOutput, finalOutput);
const stat = await fs.stat(finalOutput);
console.log(JSON.stringify({
  status: "passed",
  output: finalOutput,
  bytes: stat.size,
  node: process.versions.node,
}, null, 2));
