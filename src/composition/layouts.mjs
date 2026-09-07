import fs from "node:fs/promises";
import path from "node:path";
import { discoverCoreAssetPackages } from "../runtime/core-asset-packages.mjs";

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

export async function loadCompositionLayouts(root = process.cwd()) {
  const catalog = await readJson(path.join(root, "catalog", "composition-layouts.json"));
  return new Map(catalog.layouts.map((layout) => [layout.id, layout]));
}

export async function loadCoreAssetMetadata(root = process.cwd()) {
  const packageRecords = (await discoverCoreAssetPackages(root))
    .map((item) => [item.assetId, item.asset]);
  return new Map(packageRecords);
}

export function assetKind(assetId, metadata) {
  if (assetId.includes("cover")) return "cover";
  if (assetId.includes("agenda")) return "agenda";
  if (assetId.includes("closing")) return "closing";
  if (metadata?.kind === "component") return "component";
  return "body";
}

export function resolveNormalizedFrame(bodyFrame, normalized) {
  return {
    left: bodyFrame.left + bodyFrame.width * normalized.left,
    top: bodyFrame.top + bodyFrame.height * normalized.top,
    width: bodyFrame.width * normalized.width,
    height: bodyFrame.height * normalized.height,
  };
}

function stateFootprint(metadata, itemCount) {
  if (!Number.isInteger(itemCount)) return null;
  return metadata?.spatialContract?.stateFootprints?.[String(itemCount)] ?? null;
}

function verifiedAdaptive(metadata) {
  return metadata?.spatialContract?.resizeMode === "adaptive"
    && metadata?.runtime?.contract?.adaptationStatus === "verified";
}

function naturalCropFits(metadata, layout, bodyFrame, itemCount) {
  if (layout.componentResizeMode !== "natural-crop") return false;
  const footprint = stateFootprint(metadata, itemCount);
  const componentSlot = layout.slots.find((slot) => slot.role === "component");
  if (!footprint || !componentSlot) return false;
  const frame = resolveNormalizedFrame(bodyFrame, componentSlot.frame);
  return frame.width >= footprint.width && frame.height >= footprint.height;
}

function adaptiveFits(metadata, layout, bodyFrame) {
  if (!verifiedAdaptive(metadata) || !bodyFrame || !(layout.componentResizeModes ?? []).includes("adaptive")) return false;
  const minimum = metadata.spatialContract?.adaptiveMinimumFrame;
  const componentSlot = layout.slots.find((slot) => slot.role === "component");
  if (!minimum || !componentSlot) return false;
  const frame = resolveNormalizedFrame(bodyFrame, componentSlot.frame);
  return frame.width >= minimum.width && frame.height >= minimum.height;
}

function adaptiveFitError(metadata, composition, frame, minimum, reason) {
  const error = new Error(
    `${metadata.id} 不能动态重排进 ${composition.id}：${Math.round(frame.width)}x${Math.round(frame.height)} < ${minimum?.width ?? "?"}x${minimum?.height ?? "?"}`,
  );
  error.code = "STRUCTURE_FRAME_UNSUPPORTED";
  error.assetId = metadata.id;
  error.targetFrame = { ...frame };
  error.requiredFrame = minimum ? { ...minimum } : null;
  error.reason = reason;
  error.details = {
    assetId: metadata.id,
    compositionId: composition.id,
    actualFrame: { ...frame },
    requiredFrame: minimum ? { ...minimum } : null,
    reason,
  };
  return error;
}

export function compositionCandidatesForAsset(layouts, assetId, metadata, { hasMedia = false, itemCount = null } = {}) {
  const kind = assetKind(assetId, metadata);
  const allowedBySpatialContract = metadata?.spatialContract?.supportedCompositionIds ?? [];
  const contentFrame = metadata?.spatialContract?.contentFrame;
  const naturalBodyFrame = contentFrame
    ? { left: 0, top: 0, width: contentFrame.width, height: contentFrame.height }
    : null;
  return [...layouts.values()].filter((layout) => {
    if (!layout.allowedAssetKinds.includes(kind)) return false;
    if (layout.requiresMedia && !hasMedia) return false;
    if (kind === "component" && verifiedAdaptive(metadata)
      && allowedBySpatialContract.includes(layout.id)
      && !adaptiveFits(metadata, layout, naturalBodyFrame)) return false;
    if (kind === "component"
      && !allowedBySpatialContract.includes(layout.id)
      && !(naturalBodyFrame && naturalCropFits(metadata, layout, naturalBodyFrame, itemCount))) return false;
    return true;
  });
}

export function assertSpatialFit(metadata, composition, bodyFrame, { itemCount = null } = {}) {
  if (metadata?.kind !== "component") return;
  const componentSlot = composition.slots.find((slot) => slot.role === "component");
  if (!componentSlot) throw new Error(`${composition.id} 缺少 component 槽位`);
  const frame = resolveNormalizedFrame(bodyFrame, componentSlot.frame);
  if (verifiedAdaptive(metadata)) {
    const allowed = metadata.spatialContract?.supportedCompositionIds ?? [];
    if (!allowed.includes(composition.id)) {
      throw adaptiveFitError(metadata, composition, frame, null, "动态适配契约未开放该 Composition");
    }
    const minimum = metadata.spatialContract?.adaptiveMinimumFrame;
    if (!minimum || frame.width < minimum.width || frame.height < minimum.height) {
      throw adaptiveFitError(metadata, composition, frame, minimum, "区域小于已验证动态适配下界");
    }
    return;
  }
  if (composition.componentResizeMode === "natural-crop") {
    const footprint = stateFootprint(metadata, itemCount);
    if (!footprint) throw new Error(`${metadata.id} 的 ${itemCount ?? "?"} 项 State 没有登记自然占用尺寸`);
    if (frame.width < footprint.width || frame.height < footprint.height) {
      throw new Error(
        `${metadata.id} 的 ${itemCount} 项自然占用不能放入 ${composition.id}：${Math.round(frame.width)}x${Math.round(frame.height)} < ${footprint.width}x${footprint.height}`,
      );
    }
    return;
  }
  const minimum = metadata.spatialContract?.minimumFrame;
  if (!minimum || frame.width < minimum.width || frame.height < minimum.height) {
    throw new Error(
      `${metadata.id} 不能放入 ${composition.id}：${Math.round(frame.width)}x${Math.round(frame.height)} < ${minimum?.width ?? "?"}x${minimum?.height ?? "?"}`,
    );
  }
}
