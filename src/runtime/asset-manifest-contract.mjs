const RENDERERS = new Set(["skin", "html-component", "legacy-builder"]);
const POINT_POLICIES = new Set(["forbidden", "optional", "required"]);

function push(issues, condition, message) {
  if (!condition) issues.push(message);
}

export function normalizeFormalAssetManifest(asset) {
  const normalized = structuredClone(asset);
  const runtime = normalized.runtime;
  if (
    normalized.kind === "component"
    && runtime
    && runtime.renderer !== "skin"
    && runtime.contentContract
  ) {
    // PageContent exposes every top-level component item through the same
    // semantic-node interface. Asset-specific roles belong in structuredData
    // or field contracts, not in this selector-facing discriminator.
    runtime.contentContract.itemRole = "semantic-node";
  }
  return normalized;
}

export function inspectAssetManifestContract(asset, manifestLabel = asset?.id ?? "asset.json") {
  const issues = [];
  const runtime = asset?.runtime;
  push(issues, typeof asset?.id === "string" && Boolean(asset.id), `${manifestLabel} 缺少资产 id`);
  push(issues, Boolean(runtime), `${asset?.id ?? manifestLabel} 缺少 runtime`);
  if (!runtime) return { valid: false, issues };

  const renderer = runtime.renderer;
  push(issues, RENDERERS.has(renderer), `${asset.id} 的 runtime.renderer 非法或缺失`);
  push(issues, typeof runtime.entry === "string" && Boolean(runtime.entry), `${asset.id} 缺少 runtime.entry`);
  push(issues, typeof runtime.mapperExport === "string" && Boolean(runtime.mapperExport), `${asset.id} 缺少 mapperExport`);
  if (renderer !== "skin") {
    push(issues, typeof runtime.logicId === "string" && Boolean(runtime.logicId), `${asset.id} 缺少 logicId`);
    push(issues, typeof runtime.structureGroupId === "string" && Boolean(runtime.structureGroupId), `${asset.id} 缺少 structureGroupId`);
  }
  push(issues, typeof runtime.familyId === "string" && Boolean(runtime.familyId), `${asset.id} 缺少 familyId`);
  push(issues, typeof runtime.variantId === "string" && Boolean(runtime.variantId), `${asset.id} 缺少 variantId`);
  push(issues, typeof runtime.silhouette === "string" && Boolean(runtime.silhouette), `${asset.id} 缺少 silhouette`);
  push(issues, Array.isArray(runtime.supportedBaseRelations), `${asset.id} 缺少 supportedBaseRelations`);
  push(issues, Number.isInteger(runtime.itemCount?.min) && Number.isInteger(runtime.itemCount?.max), `${asset.id} 缺少 itemCount 范围`);

  if (runtime.contentContract) {
    push(issues, runtime.contentContract.itemRole === "semantic-node", `${asset.id} 的 contentContract.itemRole 必须是 semantic-node`);
    push(issues, POINT_POLICIES.has(runtime.contentContract.points), `${asset.id} 的 contentContract.points 非法`);
    if (runtime.contentContract.bindings) {
      push(issues, Array.isArray(runtime.contentContract.bindings), `${asset.id} 的 contentContract.bindings 必须是数组`);
      if (Array.isArray(runtime.contentContract.bindings)) {
        for (const binding of runtime.contentContract.bindings) {
          push(issues, typeof binding.id === "string" && Boolean(binding.id), `${asset.id} 的 binding 缺少 id`);
          push(issues, binding.scope === "per-component-item", `${asset.id}:${binding.id} 的 binding.scope 暂只支持 per-component-item`);
          push(issues, binding.valueType === "text-list", `${asset.id}:${binding.id} 的 binding.valueType 暂只支持 text-list`);
          push(issues, Number.isInteger(binding.minItems) && Number.isInteger(binding.maxItems)
            && binding.minItems >= 1 && binding.maxItems >= binding.minItems,
          `${asset.id}:${binding.id} 的条目范围非法`);
          push(issues, Number.isInteger(binding.maxChars) && binding.maxChars > 0, `${asset.id}:${binding.id} 缺少 maxChars`);
          push(issues, binding.grounding === "source-fragment", `${asset.id}:${binding.id} 的 grounding 非法`);
        }
      }
    }
  }

  if (runtime.slotContract) {
    push(issues, runtime.slotContract.schemaVersion === "1.0", `${asset.id} 的 slotContract.schemaVersion 非法`);
    push(issues, runtime.slotContract.coordinateSpace === "design-frame", `${asset.id} 的 slotContract.coordinateSpace 必须是 design-frame`);
    push(issues, typeof runtime.slotContract.resolverExport === "string" && Boolean(runtime.slotContract.resolverExport), `${asset.id} 的 slotContract 缺少 resolverExport`);
    push(issues, typeof runtime.slotContract.binding === "string" && Boolean(runtime.slotContract.binding), `${asset.id} 的 slotContract 缺少 binding`);
    push(issues, runtime.slotContract.maxDepth === 1, `${asset.id} 的 slotContract.maxDepth 当前只允许 1`);
    push(issues, runtime.slotContract.childPolicy === "registered-core-only", `${asset.id} 的 slotContract.childPolicy 必须是 registered-core-only`);
    push(issues, runtime.slotContract.fallback === "plain-text", `${asset.id} 的 slotContract.fallback 必须是 plain-text`);
  }

  return { valid: issues.length === 0, issues };
}

export function assertAssetManifestContract(asset, manifestLabel) {
  const result = inspectAssetManifestContract(asset, manifestLabel);
  if (!result.valid) throw new Error(result.issues[0]);
  return result;
}
