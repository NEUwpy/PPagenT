import path from "node:path";
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
} else if (command === "inspect") {
  const p = await loadCoreAssetPackage(args[0],root);
  const implementation = await import(pathToFileURL(p.entryPath).href);
  const previewParameters = implementation[p.runtime.previewParametersExport ?? "previewParameters"];
  console.log(JSON.stringify({ assetId:p.assetId, manifestPath:path.relative(root,p.manifestPath), entryPath:path.relative(root,p.entryPath), asset:p.asset, previewParameters, textCapacity:p.textCapacity, textFlow:p.textFlow, component:{ designFrame:p.component?.designFrame, variants:p.component?.variants } },null,2));
} else throw new Error("Use list [--logic <id>] or inspect <assetId>");
