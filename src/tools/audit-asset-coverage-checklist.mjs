import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? process.cwd());
const checklistPath = path.join(root, "docs", "工作流", "资产积累与入库", "资产覆盖清单.md");
const coreRegistryPath = path.join(root, "assets", "registry.json");
const candidateRegistryPath = path.join(root, "备选资产", "registry.json");

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

const [checklist, coreRegistry, candidateRegistry] = await Promise.all([
  fs.readFile(checklistPath, "utf8"),
  readJson(coreRegistryPath),
  readJson(candidateRegistryPath),
]);

const issues = [];
const inventory = new Map(candidateRegistry.assets.map((asset) => [asset.id, asset]));
for (const asset of coreRegistry.assets) {
  if (!inventory.has(asset.id)) issues.push(`核心资产不在备选注册表中: ${asset.id}`);
}

const coreIds = new Set(coreRegistry.assets.map((asset) => asset.id));
const seen = new Map();
const assetLinePattern = /^\s*-\s*\[([ xX])\]\s+(.+?)\s+<!--\s*asset:([a-z0-9-]+)\s*-->\s*$/gm;
let match;
while ((match = assetLinePattern.exec(checklist)) !== null) {
  const [, mark, label, id] = match;
  const lineNumber = checklist.slice(0, match.index).split("\n").length;
  if (seen.has(id)) {
    issues.push(`清单重复资产: ${id}（第 ${seen.get(id).lineNumber}、${lineNumber} 行）`);
    continue;
  }
  seen.set(id, { checked: mark.toLowerCase() === "x", label: label.trim(), lineNumber });
}

for (const [id, asset] of inventory) {
  const item = seen.get(id);
  if (!item) {
    issues.push(`清单漏列资产: ${id}`);
    continue;
  }
  if (!item.label.includes(asset.name)) issues.push(`清单名称与注册表不一致: ${id}（应包含“${asset.name}”）`);
  const shouldBeChecked = coreIds.has(id);
  if (item.checked !== shouldBeChecked) {
    issues.push(`清单勾选状态与核心注册表不一致: ${id}（应为 ${shouldBeChecked ? "[x]" : "[ ]"}）`);
  }
}

for (const id of seen.keys()) {
  if (!inventory.has(id)) issues.push(`清单包含未知或已移除资产: ${id}`);
}

const report = {
  status: issues.length ? "failed" : "passed",
  checklist: path.relative(root, checklistPath).replaceAll("\\", "/"),
  registeredAssetCount: inventory.size,
  coreAssetCount: coreIds.size,
  checklistAssetCount: seen.size,
  issues,
};

console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
