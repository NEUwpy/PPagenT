import fs from "node:fs/promises";
import path from "node:path";

import { inspectAssetManifestContract } from "./asset-manifest-contract.mjs";
import { inspectCoreAssetReachability } from "./core-asset-reachability.mjs";
import { inspectFormalAssetContract } from "./formal-asset-contract.mjs";
import { inspectHtmlComponentEligibility } from "./html-component-eligibility.mjs";

async function readJsonIfPresent(target) {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function inspectAssetIntakeState({ asset, assetDir, logicMap, root = process.cwd() }) {
  const runtime = asset.runtime ?? {};
  const renderer = runtime.renderer;
  const isHtmlComponent = renderer === "html-component";
  const isStructure = asset.kind === "component" && renderer !== "skin";
  const manifestContract = inspectAssetManifestContract(asset);
  const formalReachability = inspectCoreAssetReachability(asset);
  const formalContract = await inspectFormalAssetContract(asset, root);
  const htmlEligibility = isHtmlComponent
    ? await inspectHtmlComponentEligibility(assetDir, asset.id)
    : { eligible: true, hasVisualIntent: true, htmlApproved: true, userApproved: true, stage: "not-applicable" };

  const slotContractPath = path.join(assetDir, "slot-contract.json");
  const slotContract = isHtmlComponent ? await readJsonIfPresent(slotContractPath) : null;
  const slotContractReady = !isHtmlComponent || Boolean(
    slotContract
    && slotContract.assetId === asset.id
    && slotContract.status === "ready",
  );

  const requiredFiles = isHtmlComponent ? [
    runtime.entry,
    asset.generator ?? "generate.mjs",
    asset.showcase ?? "example.pptx",
  ].filter(Boolean) : [runtime.entry].filter(Boolean);
  const missingFiles = [];
  for (const name of requiredFiles) {
    const target = path.resolve(assetDir, name);
    const relative = path.relative(assetDir, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !await exists(target)) {
      missingFiles.push(name);
    }
  }

  const logics = Array.isArray(logicMap?.logics) ? logicMap.logics : [];
  const logic = isStructure ? logics.find((entry) => entry.id === runtime.logicId) : null;
  const registered = !isStructure || Boolean(logic?.assetIds?.includes(asset.id));
  const readinessIssues = unique([
    ...manifestContract.issues,
    ...formalReachability.issues,
    ...formalContract.issues.map((issue) => `AssetContract: ${issue}`),
    isHtmlComponent && !htmlEligibility.hasVisualIntent ? "缺少 visual-intent.md" : null,
    isHtmlComponent && !htmlEligibility.htmlApproved ? "HTML 尚未审批" : null,
    isHtmlComponent && !htmlEligibility.userApproved ? "Native/PPT 与 Skin 尚未审批" : null,
    isHtmlComponent && !slotContractReady ? "Slot Contract 缺失或未 ready" : null,
    isStructure && !logic ? `Logic 能力地图中不存在 ${runtime.logicId ?? "未声明"}` : null,
    ...missingFiles.map((name) => `缺少入库产物 ${name}`),
  ]);
  const readyToRegister = readinessIssues.length === 0;
  const coreConsistent = asset.status === "core" && readyToRegister && registered;

  let stage;
  if (asset.status === "withdrawn" || asset.status === "superseded") stage = asset.status;
  else if (isHtmlComponent && !htmlEligibility.hasVisualIntent) stage = "requires-redistillation";
  else if (isHtmlComponent && !htmlEligibility.htmlApproved) stage = "awaiting-html-review";
  else if (isHtmlComponent && !htmlEligibility.userApproved) stage = "awaiting-native-review";
  else if (!readyToRegister) stage = asset.status === "core" ? "invalid-core" : "blocked-before-registration";
  else if (coreConsistent) stage = "core";
  else if (asset.status === "core") stage = "invalid-core";
  else stage = "ready-to-register";

  return {
    stage,
    readyToRegister,
    coreConsistent,
    registered,
    readinessIssues,
    manifestContract,
    formalReachability,
    formalContract,
    htmlEligibility,
    slotContractReady,
    slotContractStatus: slotContract?.status ?? null,
    missingFiles,
    logicId: runtime.logicId ?? null,
  };
}
