const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");

const host = "127.0.0.1";
const args = process.argv.slice(2);

function option(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function isProjectRoot(candidate) {
  return fs.existsSync(path.join(candidate, "package.json"))
    && fs.existsSync(path.join(candidate, "src", "tools", "serve-visual-skill-dashboard.mjs"));
}

function findProjectRoot(explicitRoot = "") {
  const seeds = [explicitRoot, path.dirname(process.execPath), process.cwd()].filter(Boolean);
  for (const seed of seeds) {
    let current = path.resolve(seed);
    for (let depth = 0; depth < 5; depth += 1) {
      if (isProjectRoot(current)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

function loadProjectModule(root, targetPath, targetArgv) {
  process.env.PPAGENT_DASHBOARD_TARGET = targetPath;
  process.env.PPAGENT_DASHBOARD_EXE = process.execPath;
  process.argv = [process.execPath, targetPath, ...targetArgv];
  const fileRequire = createRequire(path.join(root, "package.json"));
  fileRequire(path.join(root, "src", "launcher", "ppa-dashboard-worker.cjs"));
}

const modeRoot = findProjectRoot(option("--root"));

if (args[0] === "--serve") {
  if (!modeRoot) throw new Error("找不到 PPagenT 项目根目录。");
  const port = option("--port", "4192");
  const serverPath = path.join(modeRoot, "src", "tools", "serve-visual-skill-dashboard.mjs");
  loadProjectModule(modeRoot, serverPath, ["--root", modeRoot, "--port", port]);
} else if (args[0] === "--render-preview") {
  if (!modeRoot) throw new Error("找不到 PPagenT 项目根目录。");
  const deckPath = args[1];
  const outputDir = args[2];
  if (!deckPath || !outputDir) throw new Error("缺少 PPT 预览参数。");
  const rendererPath = path.join(modeRoot, "src", "tools", "render-pptx-evidence.mjs");
  loadProjectModule(modeRoot, rendererPath, [deckPath, outputDir]);
} else if (args[0] === "--render-source-slide") {
  if (!modeRoot) throw new Error("找不到 PPagenT 项目根目录。");
  const deckPath = args[1];
  const slideNumber = args[2];
  const outputPath = args[3];
  if (!deckPath || !slideNumber || !outputPath) throw new Error("缺少来源 PPT 预览参数。");
  const rendererPath = path.join(modeRoot, "src", "tools", "render-pptx-slide-evidence.mjs");
  loadProjectModule(modeRoot, rendererPath, [deckPath, slideNumber, outputPath]);
} else {
  launch().catch((error) => {
    const root = modeRoot || path.dirname(process.execPath);
    const message = `[${new Date().toLocaleString()}] ${error.stack || error.message}\n`;
    try { fs.writeFileSync(path.join(root, "PPA看板-启动错误.log"), message, "utf8"); } catch {}
    console.error("PPA 看板启动失败：", error.message);
    process.exitCode = 1;
  });
}

function normalize(value) {
  return path.resolve(value).replaceAll("\\", "/").toLowerCase();
}

function getHealth(port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const request = http.get({ host, port, path: "/health", timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", () => resolve(false));
    probe.listen({ host, port }, () => probe.close(() => resolve(true)));
  });
}

function openDashboard(url) {
  const child = spawn("explorer.exe", [url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function waitForDashboard(port, root) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const health = await getHealth(port, 500);
    if (health?.status === "ok" && normalize(health.root) === normalize(root)) return health;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("实时看板服务未能在 30 秒内启动。");
}

async function launch() {
  const root = modeRoot;
  if (!root) throw new Error("请把 PPA看板.exe 保留在 PPagenT 项目根目录内。");

  let selectedPort = null;
  for (let port = 4192; port <= 4202; port += 1) {
    const health = await getHealth(port);
    if (health?.status === "ok" && normalize(health.root) === normalize(root)) {
      const url = `http://${host}:${port}/#formal`;
      if (!args.includes("--no-open")) openDashboard(url);
      else console.log(url);
      return;
    }
    if (!health && await isPortFree(port)) {
      selectedPort = port;
      break;
    }
  }
  if (!selectedPort) throw new Error("4192–4202 端口均被占用，无法启动本地看板。");

  const child = spawn(process.execPath, ["--serve", "--root", root, "--port", String(selectedPort)], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, PPAGENT_DASHBOARD_EXE: process.execPath },
  });
  child.unref();
  await waitForDashboard(selectedPort, root);

  const url = `http://${host}:${selectedPort}/#formal`;
  if (!args.includes("--no-open")) openDashboard(url);
  else console.log(url);
}
