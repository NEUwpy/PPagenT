import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// 这个模块刻意**不**静态 import "@oai/artifact-tool"。
// 原因：引擎缺失时恰恰是最需要给出可读原因的时候，静态 import 会让本模块自己先炸掉。
// 需要拿到 Presentation/PresentationFile/FileBlob 的调用方走 index.mjs（那边是静态转出）；
// 需要在动手前先问"引擎到底在不在"的调用方走这里的 probePptEngine()。
// 真源与许可全文：node_modules/@oai/artifact-tool/LICENSE.md（专有许可，随包分发，不得改写）。

// 包名的唯一真源。setup-workspace-dependencies.mjs（负责把引擎联接进 node_modules）也从这里取，
// 否则替换引擎时它会成为最容易漏掉的一处——那个脚本不在交付链路上，改引擎的人不会顺手看到它。
export const PPT_ENGINE_PACKAGE = "@oai/artifact-tool";

const ENGINE_PACKAGE = PPT_ENGINE_PACKAGE;

/**
 * 引擎的许可事实。放在这里而不是只留在包内的 LICENSE.md，是因为引擎缺失时也要读得到它——
 * 审计与看板需要能显示"当前产物受什么许可约束"，而不是让人去翻 node_modules。
 * 措辞保留许可原文，不概括成"内部使用"这类说法，避免读的人以为可以放宽。
 */
export const PPT_ENGINE_LICENSE = Object.freeze({
  package: ENGINE_PACKAGE,
  holder: "OpenAI, L.L.C.",
  classification: "PROPRIETARY AND CONFIDENTIAL",
  restrictedTo: "internal evaluation and testing purposes",
  prohibited: Object.freeze(["production", "commercial", "benchmarking"]),
  redistributable: false,
  revocable: true,
  note: "不得复制进交付包；替换引擎只需改 src/ppt-engine/ 这一层。",
});

function readJson(target) {
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch {
    return null;
  }
}

/** 引擎从哪来。经目录联接取自 Codex 运行时缓存，是本项目当前的常态，不是异常。 */
export function classifyEngineSource(realPath) {
  const normalized = realPath.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("/codex-runtimes/")) return "codex-runtime";
  if (normalized.includes("/node_modules/")) return "local-node-modules";
  return "unknown";
}

/**
 * 探测 PPT 引擎是否真的可用。
 * 返回 {available, source, packagePath, version, license, reason}；不可用时 reason 给出可读原因，
 * 而不是让调用方去解读 ERR_MODULE_NOT_FOUND。本函数不抛异常，除非调用方要求（见 mustProbePptEngine）。
 */
export async function probePptEngine() {
  const base = { source: null, packagePath: null, version: null, license: PPT_ENGINE_LICENSE, reason: "" };
  let entryResolved;
  try {
    entryResolved = createRequire(import.meta.url).resolve(ENGINE_PACKAGE);
  } catch {
    return { ...base, available: false, reason: `未找到 ${ENGINE_PACKAGE}：请先运行 node src/tools/setup-workspace-dependencies.mjs（它从 Codex 工作区运行时缓存建立目录联接），或在远端提供等效的实现与工具说明。` };
  }
  // 该包的 exports 只开放了 "." 与子路径，没开放 "./package.json"，所以不能直接 resolve 它，
  // 改为从入口文件向上找带同名 name 的 package.json。写死这个细节，免得后来人以为可以简化掉。
  let packagePath = path.dirname(entryResolved);
  let pkg = null;
  for (let depth = 0; depth < 6; depth += 1) {
    const parsed = readJson(path.join(packagePath, "package.json"));
    if (parsed?.name === ENGINE_PACKAGE) { pkg = parsed; break; }
    const parent = path.dirname(packagePath);
    if (parent === packagePath) break;
    packagePath = parent;
  }
  if (!pkg) {
    return { ...base, available: false, packagePath, reason: `${ENGINE_PACKAGE} 的入口解析到 ${entryResolved}，但向上找不到它的 package.json。` };
  }
  let realPath;
  try {
    // 解析目录联接，才能区分"仓库自己的依赖"和"从 Codex 运行时缓存借来的"。
    realPath = fs.realpathSync(packagePath);
  } catch {
    realPath = packagePath;
  }
  const source = classifyEngineSource(realPath);
  if (!fs.existsSync(entryResolved)) {
    return { ...base, available: false, source, packagePath: realPath, version: pkg.version ?? null, reason: `${ENGINE_PACKAGE} 的入口 ${entryResolved} 不存在。` };
  }
  try {
    await import(pathToFileURL(entryResolved).href);
  } catch (error) {
    return { ...base, available: false, source, packagePath: realPath, version: pkg.version ?? null, reason: `${ENGINE_PACKAGE} 入口加载失败：${error.message}` };
  }
  return { available: true, source, packagePath: realPath, version: pkg.version ?? null, license: PPT_ENGINE_LICENSE, reason: "" };
}

/** 与 probePptEngine 相同，但不可用时直接抛——供"没有引擎就无法继续"的调用点使用。 */
export async function mustProbePptEngine() {
  const probe = await probePptEngine();
  if (!probe.available) throw new Error(`PPT 引擎不可用。${probe.reason}`);
  return probe;
}
