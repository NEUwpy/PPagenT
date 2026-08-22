import fs from "node:fs/promises";
import path from "node:path";
import { discoverAssetManifestEntries } from "./asset-manifest-inventory.mjs";

const root = path.resolve(process.argv[2] ?? process.cwd());
const checklistPath = path.join(root, "docs", "工作流", "资产积累与入库", "资产覆盖清单.md");

const [checklist, coreAssets] = await Promise.all([
  fs.readFile(checklistPath, "utf8"),
  discoverAssetManifestEntries(root, "assets"),
]);

const issues = [];
const inventory = new Map(coreAssets.map((asset) => [asset.id, asset]));
const coreIds = new Set(coreAssets.filter((asset) => asset.status === "core").map((asset) => asset.id));
const seen = new Map();
const assetLinePattern = /^\s*-\s*\[([ xX])\]\s+(.+)$/gm;
let match;
while ((match = assetLinePattern.exec(checklist)) !== null) {
  const [, mark, label] = match;
  const lineNumber = checklist.slice(0, match.index).split("\n").length;
  const ids = [...label.matchAll(/`([a-z0-9-]+)`/g)].map((item) => item[1]);
  const checked = mark.toLowerCase() === "x";
  if (checked && ids.length === 0) issues.push(`已勾选条目缺少资产 ID（第 ${lineNumber} 行）`);
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push(`清单重复资产: ${id}（第 ${seen.get(id).lineNumber}、${lineNumber} 行）`);
      continue;
    }
    seen.set(id, { checked, label: label.trim(), lineNumber });
  }
}

if (seen.size === 0) issues.push("清单没有解析出任何资产 ID；拒绝空清单假通过");

for (const [id, item] of seen) {
  const asset = inventory.get(id);
  if (!asset) {
    issues.push(`清单包含未知或已移除资产: ${id}`);
    continue;
  }
  const shouldBeChecked = coreIds.has(id);
  if (item.checked !== shouldBeChecked) {
    issues.push(`清单勾选状态与核心资产目录不一致: ${id}（应为 ${shouldBeChecked ? "[x]" : "[ ]"}）`);
  }
}

const report = {
  status: issues.length ? "failed" : "passed",
  checklist: path.relative(root, checklistPath).replaceAll("\\", "/"),
  registeredAssetCount: inventory.size,
  coreAssetCount: coreIds.size,
  checklistAssetCount: seen.size,
  unlistedDiscoveredAssetCount: [...inventory.keys()].filter((id) => !seen.has(id)).length,
  issues,
};

console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
