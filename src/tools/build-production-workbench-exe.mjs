import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 25 || (major === 25 && minor < 5)) throw new Error(`构建 EXE 需要 Node.js 25.5 或更高版本；当前为 ${process.versions.node}。`);
const tempRoot = path.join(projectRoot, ".tmp", "ppa-production-workbench-exe");
const tempOutput = path.join(tempRoot, "PPA生产工作台.exe");
const finalOutput = path.join(projectRoot, "PPA生产工作台.exe");
const configPath = path.join(tempRoot, "sea-config.json");
await fs.mkdir(tempRoot, { recursive: true });
await fs.rm(tempOutput, { force: true });
await fs.writeFile(configPath, JSON.stringify({
  main: path.join(projectRoot, "src", "launcher", "ppa-production-main.cjs"), mainFormat: "commonjs", output: tempOutput,
  disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, execArgvExtension: "none",
}, null, 2), "utf8");
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--build-sea", configPath], { cwd: projectRoot, windowsHide: true, stdio: "inherit" });
  child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(`Node SEA 构建失败：${code}`)));
});
await fs.copyFile(tempOutput, finalOutput);
console.log(JSON.stringify({ status: "passed", output: finalOutput, bytes: (await fs.stat(finalOutput)).size, node: process.versions.node }, null, 2));
