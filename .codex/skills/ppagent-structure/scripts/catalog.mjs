import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { discoverCoreAssetPackages, loadCoreAssetPackage } from "../../../../src/runtime/core-asset-packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const [command = "list", ...args] = process.argv.slice(2);
const packages = (await discoverCoreAssetPackages(root)).filter(p => p.runtime.renderer !== "skin");
if (command === "list") {
  const logic = args[args.indexOf("--logic") + 1];
  const filtered = args.includes("--logic") ? packages.filter(p => p.runtime.logicId === logic) : packages;
  const summary = p => ({ id:p.assetId, name:p.asset.name, logic:p.runtime.logicId, semantic:p.asset.semanticContract, avoid:p.asset.doNotUseWhen, capacity:p.asset.capacity, mediaFields:p.asset.fieldContract?.editable?.filter(f => /image|media|photo/i.test(f.field)) ?? [] });
  console.log(JSON.stringify(args.includes("--logic") ? filtered.map(summary) : { total:packages.length, logics:Object.fromEntries([...new Set(packages.map(p=>p.runtime.logicId))].sort().map(l=>[l,packages.filter(p=>p.runtime.logicId===l).length])), next:"list --logic <logicId>; inspect <assetId>" },null,2));
} else if (command === "reference") {
  const p = await loadCoreAssetPackage(args[0],root);
  const assetDir = path.dirname(p.manifestPath);
  const intentPath = path.join(assetDir, "visual-intent.md");
  const available = async name => {
    const file = path.join(assetDir, name);
    try { await fs.access(file); return path.relative(root,file); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  let visualIntent;
  try { visualIntent = await fs.readFile(intentPath,"utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; visualIntent = null; }
  console.log(JSON.stringify({
    mode:"reference", referenceAssetId:p.assetId, name:p.asset.name,
    logic:p.runtime.logicId, semantic:p.asset.semanticContract,
    avoid:p.asset.doNotUseWhen, source:p.asset.source,
    visualIntent, implementation:{
      manifest:path.relative(root,p.manifestPath), runtime:path.relative(root,p.entryPath),
      review:await available("review.mjs"), styles:await available("component.css"),
    },
    guidance:"参考中的关系与设计方法供本稿重组；源坐标、尺寸、节点容量与内部造型不限制新表达。按稿件保留关系与条件，按本次主题与排版指南绘制原生元素。记录来源与变化，不把参考重组报告为 invokeStructure 成功，也不自动修改或晋升核心资产。直接执行原组件时仍须 inspect 并遵守原调用契约。",
  },null,2));
} else if (command === "inspect") {
  const p = await loadCoreAssetPackage(args[0],root);
  const implementation = await import(pathToFileURL(p.entryPath).href);
  const previewParameters = implementation[p.runtime.previewParametersExport ?? "previewParameters"];
  console.log(JSON.stringify({ assetId:p.assetId, manifestPath:path.relative(root,p.manifestPath), entryPath:path.relative(root,p.entryPath), asset:p.asset, previewParameters, textCapacity:p.textCapacity, textFlow:p.textFlow, component:{ designFrame:p.component?.designFrame, variants:p.component?.variants } },null,2));
} else throw new Error("Use list [--logic <id>], inspect <assetId>, or reference <assetId>");
