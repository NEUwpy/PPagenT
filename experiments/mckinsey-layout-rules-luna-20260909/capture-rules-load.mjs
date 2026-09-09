import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(import.meta.dirname, "rules-load-stdout.txt");
const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run rules:load -- --profile generation --skin northeastern-university-001"], {
  cwd: root,
  windowsHide: true,
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => { stderr += chunk; });
const code = await new Promise((resolve) => child.on("close", resolve));
await fs.writeFile(out, stdout, "utf8");
if (stderr) process.stderr.write(stderr);
if (code !== 0) process.exitCode = code;
console.log(JSON.stringify({ out, code, bytes: Buffer.byteLength(stdout) }, null, 2));
