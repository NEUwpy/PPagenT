import fs from "node:fs/promises";
import path from "node:path";
import { adaptiveMinimumFrame, getStructureAdaptationProfile } from "../runtime/structure-adaptation.mjs";

const root = path.resolve(process.argv[2] ?? process.cwd());
const assetRoot = path.join(root, "assets", "结构图");
const migrated = [];

for (const entry of await fs.readdir(assetRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(assetRoot, entry.name);
  const manifestPath = path.join(directory, "asset.json");
  let source;
  let asset;
  try {
    source = await fs.readFile(manifestPath, "utf8");
    asset = JSON.parse(source);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (asset.status !== "core" || asset.kind !== "component" || asset.runtime?.renderer !== "html-component") continue;

  const profile = getStructureAdaptationProfile(asset);
  const minimum = adaptiveMinimumFrame(asset);
  const spatial = asset.spatialContract ?? {};
  spatial.resizeMode = "adaptive";
  spatial.adaptiveMinimumFrame = { width: minimum.width, height: minimum.height };
  spatial.adaptation = {
    mode: "profiled-reflow",
    profile: profile.id,
    axis: profile.axis,
    preserves: profile.preserve,
    textPolicy: "discrete-font-tier-with-space-feedback",
    fallback: "STRUCTURE_SPACE_INSUFFICIENT",
    evidence: "profile-contract-unverified",
  };
  spatial.supportedCompositionIds = [
    ...new Set([
      ...(spatial.supportedCompositionIds ?? []),
      "component-aside-right",
      "component-lead-top",
    ]),
  ];
  asset.spatialContract = spatial;
  asset.runtime.spatialResolverExport = "resolveSpatialRequirement";
  asset.runtime.contract ??= {};
  asset.runtime.contract.adaptationStatus = "adaptive";

  const pretty = source.includes("\n");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const output = JSON.stringify(asset, null, pretty ? 2 : 0).replace(/\n/g, eol);
  await fs.writeFile(manifestPath, pretty ? `${output}${eol}` : output, "utf8");
  migrated.push({ id: asset.id, profile: profile.id, minimumFrame: minimum });
}

console.log(JSON.stringify({ count: migrated.length, assets: migrated }, null, 2));

