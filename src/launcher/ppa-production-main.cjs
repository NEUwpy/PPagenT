const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");

const host = "127.0.0.1";
const args = process.argv.slice(2);
function option(name, fallback = "") { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; }
function isProjectRoot(candidate) { return fs.existsSync(path.join(candidate, "package.json")) && fs.existsSync(path.join(candidate, "src", "tools", "serve-production-workbench.mjs")); }
function findProjectRoot(explicitRoot = "") {
  for (const seed of [explicitRoot, path.dirname(process.execPath), process.cwd()].filter(Boolean)) {
    let current = path.resolve(seed);
    for (let depth = 0; depth < 5; depth += 1) {
      if (isProjectRoot(current)) return current;
      const parent = path.dirname(current); if (parent === current) break; current = parent;
    }
  }
  return null;
}
function loadProjectModule(root, targetPath, targetArgv) {
  process.env.PPAGENT_PRODUCTION_TARGET = targetPath;
  process.argv = [process.execPath, targetPath, ...targetArgv];
  createRequire(path.join(root, "package.json"))(path.join(root, "src", "launcher", "ppa-production-worker.cjs"));
}
const modeRoot = findProjectRoot(option("--root"));
if (args[0] === "--serve") {
  if (!modeRoot) throw new Error("找不到 PPagenT 项目根目录。");
  loadProjectModule(modeRoot, path.join(modeRoot, "src", "tools", "serve-production-workbench.mjs"), ["--root", modeRoot, "--port", option("--port", "4212")]);
} else {
  launch().catch((error) => {
    const root = modeRoot || path.dirname(process.execPath);
    try { fs.writeFileSync(path.join(root, "PPA生产工作台-启动错误.log"), `[${new Date().toLocaleString()}] ${error.stack || error.message}\n`, "utf8"); } catch {}
    console.error(error); process.exitCode = 1;
  });
}
function normalize(value) { return path.resolve(value).replaceAll("\\", "/").toLowerCase(); }
function getHealth(port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const request = http.get({ host, port, path: "/health", timeout: timeoutMs }, (response) => {
      let body = ""; response.setEncoding("utf8"); response.on("data", chunk => { body += chunk; }); response.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    request.on("timeout", () => request.destroy()); request.on("error", () => resolve(null));
  });
}
function isPortFree(port) { return new Promise(resolve => { const probe = net.createServer(); probe.unref(); probe.once("error", () => resolve(false)); probe.listen({ host, port }, () => probe.close(() => resolve(true))); }); }
function openBrowser(url) { const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore", windowsHide: false }); child.unref(); }
async function stopExisting(root) {
  for (let port = 4212; port <= 4222; port += 1) {
    const health = await getHealth(port);
    if (health?.status !== "ok" || health.app !== "ppagent-production-workbench" || normalize(health.root) !== normalize(root)) continue;
    if (Number.isInteger(health.pid) && health.pid > 0 && health.pid !== process.pid) process.kill(health.pid);
    for (let attempt = 0; attempt < 40 && !(await isPortFree(port)); attempt += 1) await new Promise(resolve => setTimeout(resolve, 100));
  }
}
async function findExisting(root) {
  for (let port = 4212; port <= 4222; port += 1) {
    const health = await getHealth(port);
    if (health?.status === "ok" && health.app === "ppagent-production-workbench" && normalize(health.root) === normalize(root)) {
      return { port, health };
    }
  }
  return null;
}
async function waitFor(port, root) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const health = await getHealth(port, 500);
    if (health?.status === "ok" && health.app === "ppagent-production-workbench" && normalize(health.root) === normalize(root)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("正式生成工作台未能在 30 秒内启动。");
}
async function launch() {
  const root = modeRoot;
  if (!root) throw new Error("请把 PPA生产工作台.exe 保留在 PPagenT 项目根目录内。");
  const existing = await findExisting(root);
  if (existing) {
    const existingUrl = `http://${host}:${existing.port}/?launch=${Date.now()}`;
    if (!args.includes("--no-open")) openBrowser(existingUrl); else console.log(existingUrl);
    return;
  }
  let selectedPort = null;
  for (let port = 4212; port <= 4222; port += 1) if (await isPortFree(port)) { selectedPort = port; break; }
  if (!selectedPort) throw new Error("4212–4222 端口均被占用。");
  const child = spawn(process.execPath, ["--serve", "--root", root, "--port", String(selectedPort)], { cwd: root, detached: true, windowsHide: true, stdio: "ignore", env: { ...process.env } });
  child.unref(); await waitFor(selectedPort, root);
  const url = `http://${host}:${selectedPort}/?launch=${Date.now()}`;
  if (!args.includes("--no-open")) openBrowser(url); else console.log(url);
}
