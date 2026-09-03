import {
  canonicalTextLayoutId,
  compatibleTextLayouts,
  inferTextContentRoles,
  normalizeTextContentRoles,
  resolveTextLayoutDefinition,
  textLayoutAcceptsContentRoles,
} from "./text-layout-library.mjs";

function text(value) {
  return String(value ?? "").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function textRegionFieldPattern(field) {
  return text(field).replace(/\[\d+\]/g, "[]");
}

function pathTokens(field) {
  return text(field)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

function valueAtPath(source, field) {
  return pathTokens(field).reduce((value, token) => value?.[token], source);
}

function parentValue(source, field) {
  const tokens = pathTokens(field);
  tokens.pop();
  return tokens.reduce((value, token) => value?.[token], source);
}

function contentForSlot(parameters, slot) {
  const direct = valueAtPath(parameters, slot.field);
  if (direct !== undefined && direct !== null) {
    const leaf = pathTokens(slot.field).at(-1);
    if (leaf === "title") return { title: direct };
    if (leaf === "body") return { body: direct };
    if (leaf === "value") return { value: direct };
    if (leaf === "label") return { label: direct };
    return direct;
  }
  if (pathTokens(slot.field).at(-1) === "support") {
    const parent = parentValue(parameters, slot.field) ?? {};
    return { body: parent.body, points: parent.points };
  }
  return undefined;
}

function hasContent(value) {
  if (Array.isArray(value)) return value.some(hasContent);
  if (value && typeof value === "object") return Object.values(value).some(hasContent);
  return Boolean(text(value));
}

function textRegionSlots(variant) {
  return (variant?.slots ?? []).filter((slot) => slot.contentType === "text-region" && slot.textLayout);
}

function variantScore(variant, parameters) {
  const slots = textRegionSlots(variant);
  if (!slots.length) return null;
  let present = 0;
  for (const slot of slots) {
    const content = contentForSlot(parameters, slot);
    if (hasContent(content)) present += 1;
    else if (slot.required) return null;
  }
  return [present, slots.length];
}

function compareScore(left, right) {
  if (left[0] !== right[0]) return right[0] - left[0];
  return right[1] - left[1];
}

export function selectTextRegionContractVariant(slotContract, parameters) {
  const ranked = (slotContract?.variants ?? [])
    .map((variant) => ({ variant, score: variantScore(variant, parameters) }))
    .filter((entry) => entry.score)
    .sort((left, right) => compareScore(left.score, right.score));
  return ranked[0]?.variant ?? null;
}

function layoutStatus(layoutId) {
  try {
    return resolveTextLayoutDefinition(layoutId).status;
  } catch {
    return "unknown";
  }
}

function canonicalLayoutIds(values = []) {
  return unique(values.map((value) => {
    try {
      return canonicalTextLayoutId(value);
    } catch {
      return null;
    }
  }));
}

/**
 * Build the compact, progressively disclosed Region catalog used by the visual
 * director. Exact DOM nodes and builder code remain undisclosed.
 */
export function summarizeTextRegionContract(slotContract) {
  const selectionByVariant = new Map((slotContract?.states ?? []).map((state) => (
    [state.variantId, state.selection ?? {}]
  )));
  const minimumFontSize = Number(slotContract?.minimumFontSize) || 12;
  const groups = new Map();
  for (const variant of slotContract?.variants ?? []) {
    for (const slot of textRegionSlots(variant)) {
      const regionKey = textRegionFieldPattern(slot.field);
      const group = groups.get(regionKey) ?? {
        regionKey,
        contentRoles: new Set(),
        defaults: new Map(),
        compatible: new Set(),
        frames: [],
        states: [],
      };
      const defaultLayoutId = canonicalTextLayoutId(slot.textLayout.defaultId || slot.textLayout.id);
      group.defaults.set(defaultLayoutId, (group.defaults.get(defaultLayoutId) ?? 0) + 1);
      group.compatible.add(defaultLayoutId);
      for (const layoutId of canonicalLayoutIds(slot.textLayout.compatible ?? [])) {
        if (layoutStatus(layoutId) === "approved") group.compatible.add(layoutId);
      }
      for (const role of normalizeTextContentRoles(slot.textLayout.contentRoles ?? [])) group.contentRoles.add(role);
      if (slot.frame?.width > 0 && slot.frame?.height > 0) {
        group.frames.push(slot.frame);
        const width = slot.innerFrame?.width ?? slot.frame.width;
        const height = slot.innerFrame?.height ?? slot.frame.height;
        const fontPx = minimumFontSize * (4 / 3);
        const estimatedMaxChars = Math.max(1, Math.floor(
          Math.floor(width / fontPx) * Math.floor(height / (fontPx * 1.2)) * 0.8,
        ));
        group.states.push({
          selection: selectionByVariant.get(variant.id) ?? {},
          width,
          height,
          estimatedMaxChars,
        });
      }
      groups.set(regionKey, group);
    }
  }
  return [...groups.values()].map((group) => {
    const defaultLayoutId = [...group.defaults.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
    const contentRoles = [...group.contentRoles].sort();
    const compatibleLayoutIds = [...group.compatible]
      .filter((layoutId) => layoutId === defaultLayoutId || textLayoutAcceptsContentRoles(layoutId, contentRoles))
      .sort((left, right) => (
        Number(right === defaultLayoutId) - Number(left === defaultLayoutId)
        || left.localeCompare(right)
      ));
    const stateCapacities = [...new Map(group.states.map((state) => [
      JSON.stringify([state.selection, state.width, state.height, state.estimatedMaxChars]),
      state,
    ])).values()];
    return {
      regionKey: group.regionKey,
      contentRoles,
      defaultLayoutId,
      compatibleLayoutIds,
      frameRange: group.frames.length ? {
        minWidth: Math.min(...group.frames.map((frame) => frame.width)),
        maxWidth: Math.max(...group.frames.map((frame) => frame.width)),
        minHeight: Math.min(...group.frames.map((frame) => frame.height)),
        maxHeight: Math.max(...group.frames.map((frame) => frame.height)),
      } : null,
      minimumFontSize,
      stateCapacities,
    };
  }).sort((left, right) => left.regionKey.localeCompare(right.regionKey));
}

function legalLayoutsForSlot(slot, content) {
  const defaultLayoutId = canonicalTextLayoutId(slot.textLayout.defaultId || slot.textLayout.id);
  const inferredRoles = inferTextContentRoles(content);
  const declaredRoles = normalizeTextContentRoles(slot.textLayout.contentRoles ?? []);
  // A Region may receive an object that also contains data rendered by a
  // sibling Region (for example strategy.metrics). Only the roles declared by
  // this Region belong to its typography decision.
  const roles = declaredRoles.length
    ? inferredRoles.filter((role) => declaredRoles.includes(role))
    : inferredRoles;
  const declared = canonicalLayoutIds(slot.textLayout.compatible ?? [defaultLayoutId]);
  const measured = compatibleTextLayouts({
    width: slot.innerFrame?.width ?? slot.frame?.width,
    height: slot.innerFrame?.height ?? slot.frame?.height,
    contentRoles: roles,
    status: "approved",
  });
  const legal = declared.filter((layoutId) => measured.includes(layoutId));
  // The asset's current default has already passed its own HTML/Native intake
  // state. Preserve that approved pairing even when the generic catalog's
  // conservative minimum frame is larger than this specific Region.
  if (textLayoutAcceptsContentRoles(defaultLayoutId, roles)) legal.unshift(defaultLayoutId);
  return { defaultLayoutId, roles, legal: unique(legal) };
}

/**
 * Deterministic matcher, not an Agent. It expands the visual director's compact
 * Region choices to exact runtime Region IDs and falls back only inside each
 * asset's predeclared legal candidate set.
 */
export function matchTextLayoutsForPayload({ slotContract, parameters, choices = [] } = {}) {
  const variant = selectTextRegionContractVariant(slotContract, parameters);
  if (!variant) return { bindings: {}, decisions: [], warnings: [] };
  const preferredByRegion = new Map((Array.isArray(choices) ? choices : [])
    .map((choice) => [textRegionFieldPattern(choice.regionKey), canonicalTextLayoutId(choice.layoutId)]));
  const bindings = {};
  const decisions = [];
  const warnings = [];
  for (const slot of textRegionSlots(variant)) {
    const content = contentForSlot(parameters, slot);
    if (!hasContent(content)) continue;
    const regionKey = textRegionFieldPattern(slot.field);
    const { defaultLayoutId, roles, legal } = legalLayoutsForSlot(slot, content);
    if (!legal.length) {
      const error = new Error(`${slot.id} 没有满足内容角色与区域约束的 Text Layout`);
      error.code = "TEXT_LAYOUT_NO_MATCH";
      error.details = { slotId: slot.id, regionKey, roles };
      throw error;
    }
    const preferred = preferredByRegion.get(regionKey);
    const layoutId = preferred && legal.includes(preferred) ? preferred : (legal.includes(defaultLayoutId) ? defaultLayoutId : legal[0]);
    if (preferred && preferred !== layoutId) {
      warnings.push({
        code: "text-layout-choice-normalized",
        slotId: slot.id,
        regionKey,
        requestedLayoutId: preferred,
        selectedLayoutId: layoutId,
      });
    }
    bindings[slot.id] = layoutId;
    decisions.push({ slotId: slot.id, regionKey, layoutId, contentRoles: roles });
  }
  return { bindings, decisions, warnings };
}
